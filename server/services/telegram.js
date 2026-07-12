import axios from 'axios'
import { supabase } from '../lib/supabase.js'

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

/**
 * Helper: call Telegram API and return the response body.
 * On error, parses Telegram's error response and throws a clean Error.
 * If Telegram returns migrate_to_chat_id, auto-updates the community and retries.
 */
async function tg(method, data, retryWithNewId = true) {
  try {
    const res = await axios.post(`${BASE}/${method}`, data)
    return res.data
  } catch (err) {
    const tgError = err.response?.data
    const msg = tgError?.description || err.message

    // Supergroup migration — Telegram upgrades regular groups to supergroups.
    // The old chat_id stops working; Telegram tells us the new one.
    if (tgError?.parameters?.migrate_to_chat_id && retryWithNewId && data.chat_id) {
      const newChatId = tgError.parameters.migrate_to_chat_id
      console.warn(`[telegram] group migrated to supergroup: old=${data.chat_id} new=${newChatId}`)

      // Save new chat ID to all communities that had the old one
      await supabase
        .from('communities')
        .update({ telegram_chat_id: newChatId })
        .eq('telegram_chat_id', data.chat_id)

      console.log(`[telegram] updated community telegram_chat_id to ${newChatId}`)

      // Retry with new ID (no second retry to avoid infinite loop)
      return tg(method, { ...data, chat_id: newChatId }, false)
    }

    console.error(`[telegram] ${method} failed:`, JSON.stringify(tgError || err.message))
    throw new Error(`Telegram ${method} error: ${msg}`)
  }
}

/**
 * Generate a single-use invite link and send it to the subscriber via DM.
 *
 * REQUIREMENTS:
 *   1. Bot must be admin with "Invite users via link" permission
 *   2. Subscriber must have sent /start to the bot first
 *
 * If DM fails (user hasn't /started), the invite link is still returned
 * so the caller can show it on the payment success page.
 */
export async function sendTelegramInvite({
  chatId,
  telegramUserId,
  communityName,
  communitySlug,
  customMessage,
  inviteLinkTtlMinutes = 60,   // 0 = never expire
  msgAutoDeleteSeconds  = 120,  // 0 = never delete
}) {
  // Build invite link params
  const linkParams = {
    chat_id: chatId,
    name: `sub_${telegramUserId}`,
  }
  if (inviteLinkTtlMinutes > 0) {
    linkParams.expire_date = Math.floor(Date.now() / 1000) + inviteLinkTtlMinutes * 60
  }

  const linkRes = await tg('createChatInviteLink', linkParams)

  if (!linkRes.ok) {
    throw new Error(`createChatInviteLink returned not ok: ${JSON.stringify(linkRes)}`)
  }

  const inviteLink = linkRes.result.invite_link

  try {
    const expiryNote = inviteLinkTtlMinutes > 0
      ? `\n\n⚠️ This link expires in ${inviteLinkTtlMinutes >= 60
          ? `${inviteLinkTtlMinutes / 60} hour${inviteLinkTtlMinutes / 60 !== 1 ? 's' : ''}`
          : `${inviteLinkTtlMinutes} minute${inviteLinkTtlMinutes !== 1 ? 's' : ''}`}.`
      : ''

    const defaultWelcome = `✅ Payment confirmed!\n\nClick below to join ${communityName}:`
    const welcomeText = customMessage || defaultWelcome

    const msgRes = await tg('sendMessage', {
      chat_id: telegramUserId,
      text: `${welcomeText}\n${inviteLink}${expiryNote}`,
    })
    console.log(`[telegram] invite sent to user ${telegramUserId}`)

    // Auto-delete the DM after the configured delay
    if (msgAutoDeleteSeconds > 0 && msgRes?.ok && msgRes.result?.message_id) {
      const messageId = msgRes.result.message_id
      setTimeout(() => {
        deleteTelegramMessage({ chatId: telegramUserId, messageId })
      }, msgAutoDeleteSeconds * 1000)
      console.log(`[telegram] scheduled DM delete for msg ${messageId} in ${msgAutoDeleteSeconds}s`)
    }
  } catch (err) {
    console.warn(`[telegram] could not DM user ${telegramUserId}: ${err.message}`)
    console.warn('[telegram] subscriber must /start the bot before the bot can DM them.')
  }

  return inviteLink
}

/**
 * Remove a member from the group using ban + immediate unban.
 * ban  → removes them and revokes old invite links
 * unban → lets them rejoin by paying again
 * Auto-handles supergroup migration via the tg() helper.
 */
export async function kickChatMember({ chatId, userId }) {
  if (!userId) return

  try {
    await tg('banChatMember', { chat_id: chatId, user_id: userId })
    await tg('unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true })
    console.log(`[telegram] kicked user ${userId} from chat ${chatId}`)
  } catch (err) {
    const msg = err.message || ''
    if (msg.includes('can\'t remove chat owner')) {
      console.log(`[telegram] skip kicking ${userId} — user is the chat owner`)
    } else if (msg.includes('PARTICIPANT_ID_INVALID') || msg.includes('user not found')) {
      console.log(`[telegram] skip kicking ${userId} — invalid ID or not in chat`)
    } else if (msg.includes('chat not found')) {
      console.log(`[telegram] skip kicking ${userId} — chat ${chatId} not found (deleted or bot kicked)`)
    } else {
      throw err
    }
  }
}

/**
 * Send a plain message to a user. Fails silently if user hasn't /started.
 */
export async function sendTelegramMessage({ userId, text }) {
  try {
    const res = await tg('sendMessage', { chat_id: userId, text, parse_mode: 'Markdown' })
    return res
  } catch (err) {
    console.warn(`[telegram] sendMessage to ${userId} failed: ${err.message}`)
    return null
  }
}

/**
 * Check if the bot is an admin with invite/remove permissions.
 */
export async function checkBotAdminStatus(chatId) {
  try {
    // Extract botId directly from token without making a network request
    const botId = process.env.TELEGRAM_BOT_TOKEN.split(':')[0]
    
    const memberRes = await tg('getChatMember', { chat_id: chatId, user_id: botId })
    const m = memberRes.result
    return (
      m.status === 'administrator' &&
      (m.can_invite_users === true || m.can_restrict_members === true)
    )
  } catch (err) {
    console.warn(`[telegram] checkBotAdminStatus failed for ${chatId}:`, err.message)
    return false
  }
}

/**
 * Delete a message from a chat (used for self-destructing group ID messages)
 */
export async function deleteTelegramMessage({ chatId, messageId }) {
  try {
    await tg('deleteMessage', { chat_id: chatId, message_id: messageId })
  } catch (err) {
    console.warn(`[telegram] deleteMessage failed for ${chatId}/${messageId}:`, err.message)
  }
}
