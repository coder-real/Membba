import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'
import { sendTelegramMessage, deleteTelegramMessage } from './telegram.js'

export function makeTelegramGroupToken() {
  return crypto.randomBytes(9).toString('base64url')
}

export function extractGroupLinkToken(text = '') {
  const raw = String(text || '').trim()
  const match = raw.match(/(?:^|\s)(?:\/start(?:@\w+)?\s+)?(?:token_|group_)([A-Za-z0-9_-]{8,64})/i)
  return match?.[1] || null
}

export async function createTelegramGroupLinkToken({ creatorId, communityId = null }) {
  const token = makeTelegramGroupToken()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('telegram_group_link_tokens')
    .insert({
      token,
      creator_id: creatorId,
      community_id: communityId,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getTelegramGroupLinkStatus(token, creatorId = null) {
  let query = supabase
    .from('telegram_group_link_tokens')
    .select('*')
    .eq('token', token)

  if (creatorId) query = query.eq('creator_id', creatorId)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data || null
}

export async function completeTelegramGroupLink({ token, chatId, chatTitle, messageId = null }) {
  if (!token || !chatId) return { linked: false, reason: 'missing_token_or_chat' }

  const now = new Date().toISOString()
  const { data: row, error: rowErr } = await supabase
    .from('telegram_group_link_tokens')
    .select('*')
    .eq('token', token)
    .gte('expires_at', now)
    .maybeSingle()

  if (rowErr) throw rowErr
  if (!row) return { linked: false, reason: 'token_not_found_or_expired' }

  const { data, error } = await supabase
    .from('telegram_group_link_tokens')
    .update({
      chat_id: chatId,
      chat_title: chatTitle || null,
      status: 'connected',
      connected_at: now,
    })
    .eq('token', token)
    .select()
    .single()

  if (error) throw error

  try {
    const res = await sendTelegramMessage({
      userId: chatId,
      text: `✅ *Membba connected*\n\nGroup: *${chatTitle || 'this group'}*\nChat ID: \`${chatId}\`\n\nReturn to Membba — your group should show as connected automatically.`,
    })

    const idToDelete = res?.result?.message_id || messageId
    if (idToDelete) {
      setTimeout(() => {
        deleteTelegramMessage({ chatId, messageId: idToDelete }).catch(() => {})
      }, 45 * 1000)
    }
  } catch (err) {
    console.warn('[telegram-group-link] confirmation message skipped:', err.message)
  }

  return { linked: true, row: data }
}

export async function expireOldTelegramGroupTokens() {
  await supabase
    .from('telegram_group_link_tokens')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
}
