import express from 'express'
import { supabase } from '../lib/supabase.js'
import {
  getWhatsAppStatus,
  getWhatsAppQR,
  getPairingCode,
  getWhatsAppError,
  getWhatsAppDebug,
  getQRImage,
  joinGroup,
  restartWhatsApp,
  initWhatsApp,
  resetWhatsAppSession,
} from '../services/whatsapp.js'

const router = express.Router()

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/whatsapp/status
// Returns: { status, qr, pairingCode }
// Status: 'initializing' | 'needs_scan' | 'needs_pairing_code' | 'syncing' | 'connected' | 'reconnecting'
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', (_req, res) => {
  res.json({
    status:      getWhatsAppStatus(),
    qr:          getWhatsAppQR() || null,
    pairingCode: getPairingCode() || null,
    error:       getWhatsAppError() || null,
    debug:       getWhatsAppDebug(),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/connect
// Body: { method: 'qr' | 'pairing_code', phoneNumber?: string }
// Starts the connection using the chosen auth method.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/connect', async (req, res) => {
  const { method, phoneNumber, resetSession } = req.body || {}
  const usePairingCode = method === 'pairing_code'

  if (usePairingCode && !phoneNumber) {
    return res.status(400).json({ message: 'phoneNumber is required for pairing_code method' })
  }

  try {
    if (resetSession) await resetWhatsAppSession()
    // Clean up any existing socket and start one new connection with the
    // requested auth method. Do not call initWhatsApp twice here — QR and
    // pairing-code flows depend on these exact options being used on startup.
    await restartWhatsApp({ usePairingCode, phoneNumber })
    res.json({ ok: true, method })
  } catch (err) {
    console.error('[whatsapp/connect] error:', err.message)
    res.status(500).json({ message: 'Failed to start WhatsApp connection' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/restart
// ─────────────────────────────────────────────────────────────────────────────
router.post('/restart', async (_req, res) => {
  try {
    await restartWhatsApp()
    res.json({ ok: true, status: getWhatsAppStatus() })
  } catch (err) {
    console.error('[whatsapp/restart] error:', err.message)
    res.status(500).json({ message: 'Failed to restart WhatsApp client' })
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/reset-session
// Clears stored Baileys auth state so the bot number can be linked fresh.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-session', async (_req, res) => {
  try {
    await resetWhatsAppSession()
    res.json({ ok: true, status: getWhatsAppStatus() })
  } catch (err) {
    console.error('[whatsapp/reset-session] error:', err.message)
    res.status(500).json({ message: 'Failed to reset WhatsApp session' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/whatsapp/qr
// Browser-friendly HTML QR page — supports new statuses
// ─────────────────────────────────────────────────────────────────────────────
router.get('/qr', async (req, res) => {
  const s = getWhatsAppStatus()

  if (s === 'connected') {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>✅ WhatsApp Bot Connected</h2>
        <p>The bot is online and ready. No QR scan needed.</p>
      </body></html>
    `)
  }

  if (s === 'needs_pairing_code') {
    const code = getPairingCode()
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>📱 Enter Pairing Code in WhatsApp</h2>
        <p style="font-size:36px;letter-spacing:8px;font-weight:bold">${code || '...'}</p>
        <p>Open WhatsApp → Linked Devices → Link a Device → Enter this code</p>
        <script>setTimeout(() => location.reload(), 5000)</script>
      </body></html>
    `)
  }

  if (s === 'initializing' || s === 'reconnecting') {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>⏳ ${s === 'reconnecting' ? 'Reconnecting…' : 'Initializing…'}</h2>
        <p>The WhatsApp client is starting up. Refresh in a few seconds.</p>
        <script>setTimeout(() => location.reload(), 3000)</script>
      </body></html>
    `)
  }

  const qrDataUrl = await getQRImage()
  if (!qrDataUrl) {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>No QR available yet</h2>
        <p>Refresh in a moment...</p>
        <script>setTimeout(() => location.reload(), 2000)</script>
      </body></html>
    `)
  }

  res.send(`
    <html>
    <head><title>Membba — WhatsApp QR</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:40px;background:#f9fafb">
      <h2 style="margin-bottom:8px">Scan with WhatsApp</h2>
      <p style="color:#6b7280;margin-bottom:24px">
        Open WhatsApp → Linked Devices → Link a Device → scan this QR
      </p>
      <img src="${qrDataUrl}" style="width:280px;height:280px;border:1px solid #e5e7eb;border-radius:12px" />
      <p style="color:#9ca3af;margin-top:16px;font-size:13px">
        QR expires in ~20 seconds. Page auto-refreshes.
      </p>
      <script>setTimeout(() => location.reload(), 18000)</script>
    </body>
    </html>
  `)
})


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/reset-session
// Clears stored Baileys auth state so the bot number can be linked fresh.
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/whatsapp/qr-data   — JSON for the React SettingsPage
// ─────────────────────────────────────────────────────────────────────────────
router.get('/qr-data', async (_req, res) => {
  const s = getWhatsAppStatus()
  res.json({
    status:      s,
    qr:          getWhatsAppQR() || null,
    pairingCode: getPairingCode() || null,
    error:       getWhatsAppError() || null,
    debug:       getWhatsAppDebug(),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/join-group
// Body: { invite_link, community_id }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/join-group', async (req, res) => {
  const { invite_link, community_id } = req.body

  if (!invite_link) {
    return res.status(400).json({ message: 'invite_link is required' })
  }
  if (!invite_link.includes('chat.whatsapp.com')) {
    return res.status(400).json({ message: 'Invalid WhatsApp invite link' })
  }

  try {
    const groupId = await joinGroup(invite_link)

    if (community_id && groupId) {
      await supabase
        .from('communities')
        .update({ whatsapp_group_id: groupId, whatsapp_group_invite_link: invite_link })
        .eq('id', community_id)
    }

    return res.json({ ok: true, group_id: groupId })
  } catch (err) {
    console.error('[whatsapp/join-group] error:', err.message)
    return res.status(500).json({ message: err.message })
  }
})

export default router
