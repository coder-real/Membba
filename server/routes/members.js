import express from 'express'
import { supabase } from '../lib/supabase.js'
import { kickChatMember, sendTelegramMessage } from '../services/telegram.js'
import { removeWhatsAppMember } from '../services/whatsapp.js'

const router = express.Router()

// ─────────────────────────────────────────────────────
// POST /api/members/:subscriptionId/remove
// Manually remove a member: kick from Telegram + cancel subscription.
// Only the community creator can call this.
// ─────────────────────────────────────────────────────
router.post('/:subscriptionId/remove', async (req, res) => {
  const { subscriptionId } = req.params

  try {
    // Fetch full subscription details
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('*, communities(telegram_chat_id, name, slug, creator_id)')
      .eq('id', subscriptionId)
      .single()

    if (error || !sub) {
      return res.status(404).json({ message: 'Subscription not found' })
    }

    // Kick from Telegram group if we have the necessary IDs
    const tgChatId = sub.communities?.telegram_chat_id
    const tgUserId = sub.telegram_user_id

    if (tgChatId && tgUserId) {
      try {
        await kickChatMember({ chatId: tgChatId, userId: tgUserId })

        // Notify the member they were removed
        const joinUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/join/${sub.communities?.slug}`
        await sendTelegramMessage({
          userId: tgUserId,
          text: `⛔ You have been removed from *${sub.communities?.name}* by the community admin.\n\n[Rejoin here](${joinUrl})`,
        })
      } catch (tgErr) {
        console.error('[members/remove] Telegram kick failed:', tgErr.message)
        // Non-fatal — still cancel the subscription
      }
    }

    // Kick from WhatsApp if applicable
    const waGroupId = sub.communities?.whatsapp_group_id
    const waPhone = sub.whatsapp_phone
    
    if (waGroupId && waPhone) {
      try {
        await removeWhatsAppMember(waGroupId, waPhone)
      } catch (waErr) {
        console.error('[members/remove] WhatsApp kick failed:', waErr.message)
      }
    }

    // Mark subscription as cancelled
    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subscriptionId)

    if (updateErr) throw updateErr

    console.log(`[members/remove] manually removed sub ${subscriptionId} (ID:${tgUserId || waPhone})`)

    return res.json({ success: true, message: 'Member removed successfully' })
  } catch (err) {
    console.error('[members/remove] error:', err.message)
    return res.status(500).json({ message: 'Failed to remove member' })
  }
})

// ─────────────────────────────────────────────────────
// POST /api/members/:id/resend-invite
// Re-sends the Telegram invite link to the subscriber via DM.
// ─────────────────────────────────────────────────────
import { sendTelegramInvite as _sendTelegramInvite } from '../services/telegram.js'

router.post('/:subscriptionId/resend-invite', async (req, res) => {
  const { subscriptionId } = req.params
  try {
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('*, communities(telegram_chat_id, whatsapp_group_invite_link, name, slug, platform)')
      .eq('id', subscriptionId)
      .single()

    if (error || !sub) return res.status(404).json({ message: 'Subscription not found' })
    if (sub.status !== 'active') return res.status(400).json({ message: 'Subscription is not active' })

    const platform = sub.communities?.platform || 'telegram'

    if (platform !== 'telegram') {
      return res.status(400).json({ message: 'Re-send invite is only available for Telegram communities' })
    }

    if (!sub.telegram_user_id || !sub.communities?.telegram_chat_id) {
      return res.status(400).json({ message: 'Missing Telegram user ID or Chat ID' })
    }

    await _sendTelegramInvite({
      chatId: sub.communities.telegram_chat_id,
      telegramUserId: sub.telegram_user_id,
      communityName: sub.communities.name,
      communitySlug: sub.communities.slug,
    })

    console.log(`[members/resend-invite] resent invite for sub ${subscriptionId}`)
    return res.json({ success: true, message: 'Invite resent successfully' })
  } catch (err) {
    console.error('[members/resend-invite] error:', err.message)
    const friendlyMsg = err.message?.includes('bot was blocked')
      ? 'Member has not started @membba_bot — ask them to send /start first.'
      : 'Failed to resend invite. The member may not have started the bot.'
    return res.status(500).json({ message: friendlyMsg })
  }
})

export default router
