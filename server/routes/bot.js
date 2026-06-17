import express from 'express'
import { supabase } from '../lib/supabase.js'
import { sendTelegramMessage, deleteTelegramMessage } from '../services/telegram.js'
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

  // TSK-106: Detect if bot was added to a group (via new_chat_members or /start in group)
  if (message.chat.type === 'group' || message.chat.type === 'supergroup') {
    const isBotAdded = message.new_chat_members?.some(member => member.username === 'membba_bot' || member.is_bot)
    if (isBotAdded || text.startsWith('/start')) {
      const res = await sendTelegramMessage({
        userId: chatId,
        text: `✅ *Membba Bot connected!*\n\nYour Group Chat ID is:\n\`${chatId}\`\n\nCopy and paste this into your Membba dashboard to complete setup.\n\n_(This message will automatically self-destruct in 30 seconds for privacy)_`
      })
      if (res && res.result && res.result.message_id) {
        setTimeout(() => {
          deleteTelegramMessage({ chatId, messageId: res.result.message_id })
        }, 30 * 1000)
      }
    }
    return // Do not process standard bot features in groups
  }

  // Only handle private messages for the rest — never reply in groups
  if (message.chat.type !== 'private') return

  if (text.startsWith('/start') || text === '/myid') {
    const param = text.replace('/start', '').trim()

    // TSK-106: UID Auto Fill Flow
    if (param.startsWith('uid_')) {
      const token = param.replace('uid_', '').trim()
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: row } = await supabase
        .from('telegram_uid_tokens')
        .select('token')
        .eq('token', token)
        .gte('created_at', cutoff)
        .maybeSingle()

      if (row) {
        await supabase.from('telegram_uid_tokens').update({ uid: userId }).eq('token', token)
        await sendTelegramMessage({
          userId: chatId,
          text: `✅ *Telegram connected!*\n\nYour ID \`${userId}\` has been captured.\n\n🔙 Return to the browser — your ID has been filled in automatically!`
        })
      } else {
        await sendTelegramMessage({ userId: chatId, text: `⚠️ This link has expired. Please try connecting again from the payment page.` })
      }
      return
    }

    // TSK-301: Deep-link param e.g. /start join_my-community-slug
    if (param.startsWith('join_')) {
      const slug = param.replace('join_', '').trim()
      const { data: community } = await supabase
        .from('communities')
        .select('id, name, slug, plans(id, name, price, is_active)')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()

      if (!community) {
        await sendTelegramMessage({ userId: chatId, text: `⚠️ Community not found. The link may have expired.\n\nYou can browse communities at our platform.` })
        return
      }

      const activePlans = (community.plans || []).filter(p => p.is_active)
      const planList = activePlans.length
        ? activePlans.map(p => `• *${p.name}* — ₦${p.price.toLocaleString()}`).join('\n')
        : '_No active plans available_'

      const payUrl = `${process.env.CLIENT_URL || 'https://membba.com'}/join/${slug}`

      await sendTelegramMessage({
        userId: chatId,
        text:
          `🎉 *${community.name}*\n\n` +
          `Available plans:\n${planList}\n\n` +
          `Your Telegram ID: \`${userId}\`\n\n` +
          `[→ Pay & Join](${payUrl})`,
      })
      return
    }

    // Default /start
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
  const { url } = req.query
  if (!url) {
    return res.status(400).json({ message: 'Pass ?url=https://your-domain.com as query param' })
  }

  const webhookUrl = `${url}/api/bot/webhook`

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
