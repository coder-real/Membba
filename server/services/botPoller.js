import axios from 'axios'
import { supabase } from '../lib/supabase.js'
import { sendTelegramMessage, deleteTelegramMessage } from './telegram.js'

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

let offset = 0
let running = false

/**
 * Handle a single incoming Telegram message.
 */
async function handleMessage(message) {
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

  console.log(`[bot] private message from ${userId} (@${message.from?.username || 'unknown'}): ${text}`)

  if (text.startsWith('/start') || text === '/myid') {
    // TSK-106: UID Auto Fill Flow
    const param = text.replace('/start', '').trim()
    
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
        params: { offset, timeout: 1, allowed_updates: ['message', 'my_chat_member'] },
        timeout: 6000,
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
