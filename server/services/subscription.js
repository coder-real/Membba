import { supabase } from '../lib/supabase.js'
import { sendTelegramInvite, kickChatMember, sendTelegramMessage } from './telegram.js'
import {
  sendWhatsAppInvite,
  removeWhatsAppMember,
  sendWhatsAppMessage,
  getWhatsAppStatus,
} from './whatsapp.js'

/**
 * Create a subscription record after payment is confirmed.
 * Idempotent — skips if a subscription already exists for this reference.
 * Branches on community.platform: 'telegram' | 'whatsapp'
 */
export async function createSubscription({
  communityId, planId, email,
  telegramUserId, whatsappPhone,
  paystackReference,
}) {
  // Idempotency check — don't double-create
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('paystack_reference', paystackReference)
    .maybeSingle()

  if (existing) {
    console.log('[subscription] already exists for reference', paystackReference)
    return { ...existing, inviteLink: null }
  }

  // Fetch plan for duration
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('duration_minutes')
    .eq('id', planId)
    .single()

  if (planErr || !plan) throw new Error('Plan not found: ' + planId)

  // Fetch community for platform + config
  const { data: community, error: commErr } = await supabase
    .from('communities')
    .select('platform, telegram_chat_id, whatsapp_group_id, whatsapp_group_invite_link, name, slug')
    .eq('id', communityId)
    .single()

  if (commErr || !community) throw new Error('Community not found: ' + communityId)

  const platform = community.platform || 'telegram'

  const startedAt = new Date()
  const expiresAt = new Date(startedAt.getTime() + plan.duration_minutes * 60 * 1000)

  // Insert subscription
  const { data: sub, error } = await supabase
    .from('subscriptions')
    .insert({
      community_id: communityId,
      plan_id: planId,
      email,
      telegram_user_id: platform === 'telegram' ? (telegramUserId || null) : null,
      whatsapp_phone: platform === 'whatsapp' ? (whatsappPhone || null) : null,
      paystack_reference: paystackReference,
      status: 'active',
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error('Failed to create subscription: ' + error.message)

  // ── Send invite based on platform ──────────────────────────────────
  let inviteLink = null

  if (platform === 'telegram') {
    if (telegramUserId && community.telegram_chat_id) {
      try {
        inviteLink = await sendTelegramInvite({
          chatId: community.telegram_chat_id,
          telegramUserId,
          communityName: community.name,
          communitySlug: community.slug,
        })
      } catch (err) {
        console.error('[subscription] telegram invite failed:', err.message)
      }
    } else {
      console.warn('[subscription] Telegram: missing userId or chatId, skipping invite')
    }

  } else if (platform === 'whatsapp') {
    console.log(`\n[subscription] Platform is WhatsApp. Checking requirements for auto-add/invite...`)
    console.log(`[subscription] whatsapp_phone: ${whatsappPhone || false}, group_id: ${community.whatsapp_group_id || false}`)
    if (whatsappPhone && community.whatsapp_group_id) {
      if (getWhatsAppStatus() !== 'authenticated') {
        console.warn('[subscription] WhatsApp client not ready — invite skipped. Subscriber will need manual invite.')
      } else {
        try {
          await sendWhatsAppInvite(
            whatsappPhone,
            community.whatsapp_group_invite_link,
            community.name,
            communityId,
            community.whatsapp_group_id
          )
          inviteLink = community.whatsapp_group_invite_link
        } catch (err) {
          console.error('[subscription] whatsapp invite failed:', err.message)
        }
      }
    } else {
      console.warn('[subscription] WhatsApp: missing phone or group ID, skipping invite')
    }
  }

  return { ...sub, inviteLink }
}

/**
 * Cron job handler — finds all active subscriptions that have expired and removes members.
 * Branches on community.platform for removal logic.
 */
export async function processExpiredSubscriptions() {
  const { data: expired, error } = await supabase
    .from('subscriptions')
    .select('*, communities(platform, telegram_chat_id, whatsapp_group_id, name, slug)')
    .eq('status', 'active')
    .lte('expires_at', new Date().toISOString())

  if (error) throw error
  if (!expired?.length) return 0

  let processed = 0

  for (const sub of expired) {
    try {
      const platform = sub.communities?.platform || 'telegram'
      const communityName = sub.communities?.name
      const joinUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/join/${sub.communities?.slug}`
      const expiredMsg = `⏰ Your membership to *${communityName}* has expired.\n\nRenew here: ${joinUrl}`

      if (platform === 'telegram') {
        const chatId = sub.communities?.telegram_chat_id
        const userId = sub.telegram_user_id

        if (chatId && userId) {
          await kickChatMember({ chatId, userId })
          await sendTelegramMessage({ userId, text: expiredMsg })
        } else {
          console.log(`[cron] sub ${sub.id}: missing Telegram chatId or userId, skipping kick`)
        }

      } else if (platform === 'whatsapp') {
        const groupId = sub.communities?.whatsapp_group_id
        const phone = sub.whatsapp_phone

        if (groupId && phone) {
          if (getWhatsAppStatus() === 'authenticated') {
            await removeWhatsAppMember(groupId, phone)
            await sendWhatsAppMessage(phone,
              `⏰ Your membership to *${communityName}* has expired.\n\nRenew here: ${joinUrl}`
            )
          } else {
            console.warn(`[cron] sub ${sub.id}: WhatsApp not ready, skipping removal`)
          }
        } else {
          console.log(`[cron] sub ${sub.id}: missing WhatsApp groupId or phone, skipping removal`)
        }
      }

      // Mark expired regardless of removal outcome
      await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('id', sub.id)

      console.log(`[cron] expired sub ${sub.id} (platform:${platform})`)
      processed++
    } catch (err) {
      console.error(`[cron] failed to expire sub ${sub.id}:`, err.message)
    }
  }

  return processed
}
