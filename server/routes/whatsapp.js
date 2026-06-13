import express from 'express'
import { supabase } from '../lib/supabase.js'
import {
  getWhatsAppStatus,
  getQRImage,
  joinGroup,
} from '../services/whatsapp.js'

const router = express.Router()

// ─────────────────────────────────────────────────────
// GET /api/whatsapp/status
// Returns current bot status: initializing | awaiting_qr | authenticated
// ─────────────────────────────────────────────────────
router.get('/status', (_req, res) => {
  res.json({ status: getWhatsAppStatus() })
})

// ─────────────────────────────────────────────────────
// GET /api/whatsapp/qr-data
// Returns JSON with { qr: "dataUrl...", status: "awaiting_qr" }
// ─────────────────────────────────────────────────────
router.get('/qr-data', async (req, res) => {
  const status = getWhatsAppStatus()
  const qr = await getQRImage()
  res.json({ status, qr })
})

// ─────────────────────────────────────────────────────
// GET /api/whatsapp/qr
// Renders the QR code as an HTML page for browser scanning.
// Protect with a secret in production: /api/whatsapp/qr?secret=YOUR_SECRET
// ─────────────────────────────────────────────────────
router.get('/qr', async (req, res) => {
  const status = getWhatsAppStatus()

  if (status === 'authenticated') {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>✅ WhatsApp Bot Authenticated</h2>
        <p>The bot is online and ready. No QR scan needed.</p>
      </body></html>
    `)
  }

  if (status === 'initializing') {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>⏳ Initializing...</h2>
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

// ─────────────────────────────────────────────────────
// POST /api/whatsapp/join-group
// Creator calls this after adding the bot to their group.
// Bot joins the group and saves the group ID to the community.
// Body: { invite_link, community_id }
// ─────────────────────────────────────────────────────
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

    // Save to community if community_id provided
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
