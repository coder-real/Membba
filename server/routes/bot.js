import express from 'express'
import { supabase } from '../lib/supabase.js'
import { sendTelegramMessage } from '../services/telegram.js'
import axios from 'axios'

const router = express.Router()

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

// ─────────────────────────────────────────────────────
// POST /api/bot/webhook
// Telegram calls this for every message/update sent to the bot.
// Register this URL with:
//   https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-domain.com/api/bot/webhook
// For local dev use ngrok: ngrok http 3001
// ─────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.sendStatus(200) // always respond immediately to Telegram

  const update = req.body
  const message = update?.message || update?.edited_message
  if (!message) return

  const chatId = message.chat.id
  const userId = message.from?.id
  const text = (message.text || '').trim().toLowerCase()
  const firstName = message.from?.first_name || 'there'

  // /start or /myid — reply with their Telegram User ID
  if (text === '/start' || text === '/myid') {
    const replyText =
      `👋 Hi ${firstName}!\n\n` +
      `Your *Telegram User ID* is:\n` +
      `\`${userId}\`\n\n` +
      `Copy that number and paste it into the payment form when subscribing to a community.\n\n` +
      `Once you've paid, I'll send your group invite link right here! 🎉`

    await sendTelegramMessage({ userId: chatId, text: replyText })
    return
  }

  // /status — check if user has an active subscription
  if (text === '/status') {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('status, expires_at, communities(name)')
      .eq('telegram_user_id', userId)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(5)

    if (!subs?.length) {
      await sendTelegramMessage({
        userId: chatId,
        text: `You don't have any active subscriptions.\n\nFind a community to join via your invite link.`,
      })
    } else {
      const lines = subs.map(s =>
        `• *${s.communities?.name}* — expires ${new Date(s.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      )
      await sendTelegramMessage({
        userId: chatId,
        text: `✅ *Your active subscriptions:*\n\n${lines.join('\n')}`,
      })
    }
    return
  }

  // Default: help message
  await sendTelegramMessage({
    userId: chatId,
    text:
      `Hi ${firstName}! I'm Membba Bot 🤖\n\n` +
      `Commands:\n` +
      `/start or /myid — get your Telegram User ID\n` +
      `/status — check your active subscriptions`,
  })
})

// ─────────────────────────────────────────────────────
// GET /api/bot/set-webhook
// Call this once to register the webhook with Telegram.
// Usage: GET http://localhost:3001/api/bot/set-webhook?url=https://your-ngrok-url.ngrok.io
// ─────────────────────────────────────────────────────
router.get('/set-webhook', async (req, res) => {
  const serverUrl = process.env.SERVER_URL
  if (!serverUrl) {
    return res.status(400).json({ message: 'SERVER_URL environment variable is missing on this server.' })
  }

  const webhookUrl = `${serverUrl}/api/bot/webhook`

  try {
    const { data } = await axios.post(`${BASE}/setWebhook`, { url: webhookUrl })
    return res.json({ ok: data.ok, result: data.result, webhook_url: webhookUrl })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────
// GET /api/bot/webhook-info
// Check what webhook URL is currently registered.
// ─────────────────────────────────────────────────────
router.get('/webhook-info', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE}/getWebhookInfo`)
    return res.json(data)
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

export default router
