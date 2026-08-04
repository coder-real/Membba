import express from 'express'
import { checkBotAdminStatus } from '../services/telegram.js'
import { getWhatsAppStatus } from '../services/whatsapp.js'
import { supabase } from '../lib/supabase.js'

const router = express.Router()

// ─────────────────────────────────────────────────────
// GET /api/telegram/check-admin/:chatId
// Returns { isAdmin: true/false }
// ─────────────────────────────────────────────────────
router.get('/check-admin/:chatId', async (req, res) => {
  const { chatId } = req.params
  if (!chatId) return res.status(400).json({ message: 'chatId required' })
  const isAdmin = await checkBotAdminStatus(chatId)
  res.json({ isAdmin })
})

// ─────────────────────────────────────────────────────
// GET /api/telegram/check-setup/:communityId
// Runs all readiness checks, returns [{ id, label, pass, hint }]
// ─────────────────────────────────────────────────────
router.get('/check-setup/:communityId', async (req, res) => {
  const { communityId } = req.params
  try {
    const { data: community, error } = await supabase
      .from('communities')
      .select('*, plans(id, is_active)')
      .eq('id', communityId)
      .single()

    if (error || !community) return res.status(404).json({ message: 'Community not found' })

    const isTelegram = !community.platform || community.platform === 'telegram'
    const isWhatsApp = community.platform === 'whatsapp'

    const hasActivePlan = (community.plans || []).some(p => p.is_active)

    const [telegramAdmin, waStatus] = await Promise.all([
      isTelegram && community.telegram_chat_id
        ? checkBotAdminStatus(community.telegram_chat_id)
        : Promise.resolve(null),
      isWhatsApp ? Promise.resolve(getWhatsAppStatus()) : Promise.resolve(null),
    ])

    const checks = [
      {
        id: 'community_active',
        label: 'Community is active',
        pass: community.is_active === true,
        hint: 'Go to Edit Community → toggle "Active" to on.',
      },
      {
        id: 'has_plan',
        label: 'At least one active plan',
        pass: hasActivePlan,
        hint: 'Add a plan in Edit Community → Plans tab.',
      },
    ]

    if (isTelegram) {
      checks.push({
        id: 'telegram_chat_id',
        label: 'Telegram group linked',
        pass: Boolean(community.telegram_chat_id),
        hint: 'Enter your Telegram Chat ID in Edit Community → Settings.',
      })
      checks.push({
        id: 'bot_admin',
        label: '@membba_bot is admin',
        pass: telegramAdmin === true,
        hint: 'Add @membba_bot to your group and make it Admin with "Add Members" & "Invite via Link" permissions.',
      })
    }

    if (isWhatsApp) {
      checks.push({
        id: 'whatsapp_group',
        label: 'WhatsApp group linked',
        pass: Boolean(community.whatsapp_group_id),
        hint: 'Use the "Connect WhatsApp" flow to link your group.',
      })
      checks.push({
        id: 'whatsapp_auth',
        label: 'WhatsApp bot connected',
        pass: waStatus === 'connected',
        hint: 'Go to Settings → WhatsApp Bot → Connect WhatsApp and scan the QR code.',
      })
    }

    const allPass = checks.every(c => c.pass)
    res.json({ allPass, checks })
  } catch (err) {
    console.error('[telegram/check-setup] error:', err.message)
    res.status(500).json({ message: 'Setup check failed' })
  }
})

// ─────────────────────────────────────────────────────
// POST /api/telegram/uid-token
// Creates a short-lived token so the bot can capture the user's Telegram UID.
// Returns { token, deepLink }
// ─────────────────────────────────────────────────────
router.post('/uid-token', async (req, res) => {
  const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  const { error } = await supabase
    .from('telegram_uid_tokens')
    .insert({ token, uid: null })
  if (error) return res.status(500).json({ message: 'Could not create token' })
  const deepLink = `https://t.me/membba_bot?start=uid_${token}`
  res.json({ token, deepLink })
})

// ─────────────────────────────────────────────────────
// GET /api/telegram/uid-from-token?token=xyz
// Returns { uid } once bot has resolved the token, or { uid: null } if pending.
// ─────────────────────────────────────────────────────
router.get('/uid-from-token', async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ message: 'token required' })
  // Only accept tokens created in the last 5 minutes
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('telegram_uid_tokens')
    .select('uid')
    .eq('token', token)
    .gte('created_at', cutoff)
    .maybeSingle()
  if (error || !data) return res.json({ uid: null })
  res.json({ uid: data.uid ?? null })
})

export default router
