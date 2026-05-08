import axios from 'axios'
import { supabase } from '../lib/supabase.js'
import { sendTelegramMessage } from './telegram.js'

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

let offset = 0
let running = false

/**
 * Handle a single incoming Telegram message.
 * Only responds to PRIVATE chats — ignores group mentions entirely.
 */
async function handleMessage(message) {
  // Only handle private messages — never reply in groups
  if (message.chat.type !== 'private') return

  const chatId = message.chat.id  // in private chat, this equals the user's ID
  const userId = message.from?.id
  const text = (message.text || '').trim().toLowerCase()
  const firstName = message.from?.first_name || 'there'

  console.log(`[bot] private message from ${userId} (@${message.from?.username || 'unknown'}): ${text}`)

  if (text === '/start' || text === '/myid') {
    await sendTelegramMessage({
      userId: chatId,
      text:
        `👋 Hi ${firstName}!\n\n` +
        `Your *Telegram User ID* is:\n` +
        `\`${userId}\`\n\n` +
        `Copy that number and paste it into the payment form when joining a community.\n\n` +
        `Once you've paid, I'll send your group invite link right here! 🎉`,
    })
    return
  }

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
        text: `You have no active subscriptions.\n\nFind a community to join via your invite link.`,
      })
    } else {
      const lines = subs.map(s =>
        `• *${s.communities?.name}* — expires ${new Date(s.expires_at).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}`
      )
      await sendTelegramMessage({
        userId: chatId,
        text: `✅ *Your active subscriptions:*\n\n${lines.join('\n')}`,
      })
    }
    return
  }

  // Default help
  await sendTelegramMessage({
    userId: chatId,
    text:
      `Hi ${firstName}! I'm Membba Bot 🤖\n\n` +
      `Commands:\n` +
      `/start or /myid — get your Telegram User ID\n` +
      `/status — check your active subscriptions`,
  })
}

/**
 * Start long-polling loop.
 * Uses getUpdates with a 30-second timeout — no webhook or tunnel needed.
 * Automatically deletes any existing webhook first.
 */
export async function startPolling() {
  if (running) return
  running = true

  // Delete any existing webhook so polling works
  try {
    await axios.post(`${BASE}/deleteWebhook`, { drop_pending_updates: false })
    console.log('[bot] webhook deleted — polling mode active')
  } catch (err) {
    console.warn('[bot] could not delete webhook:', err.message)
  }

  console.log('[bot] long-polling started')

  const poll = async () => {
    if (!running) return

    try {
      const { data } = await axios.get(`${BASE}/getUpdates`, {
        params: { offset, timeout: 30, allowed_updates: ['message'] },
        timeout: 35000,
      })

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1
          if (update.message) {
            handleMessage(update.message).catch(err =>
              console.error('[bot] handleMessage error:', err.message)
            )
          }
        }
      }
    } catch (err) {
      const status = err.response?.status
      const code = err.code

      if (status === 409) {
        console.warn('[bot] 409 Conflict — another server instance is polling. Stop the duplicate. Retrying in 5s...')
        await new Promise(r => setTimeout(r, 5000))
      } else if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        // Network issue reaching Telegram — wait before retrying to avoid log spam
        await new Promise(r => setTimeout(r, 5000))
      } else if (!err.message?.includes('ECONNRESET') && !err.message?.includes('timeout')) {
        console.error('[bot] polling error:', err.message)
      }
    }

    setImmediate(poll)
  }

  poll()
}

export function stopPolling() {
  running = false
}
