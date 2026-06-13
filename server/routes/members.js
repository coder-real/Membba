import express from 'express'
import { supabase } from '../lib/supabase.js'
import { kickChatMember, sendTelegramMessage } from '../services/telegram.js'
import { removeWhatsAppMember, sendWhatsAppMessage, getWhatsAppStatus } from '../services/whatsapp.js'

const router = express.Router()

// ─────────────────────────────────────────────────────
// POST /api/members/:subscriptionId/remove
// Manually remove a member: kick from Telegram/WhatsApp + cancel subscription.
// Only the community creator can call this.
// ─────────────────────────────────────────────────────
router.post('/:subscriptionId/remove', async (req, res) => {
  const { subscriptionId } = req.params

  try {
    // Fetch full subscription details
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('*, communities(platform, telegram_chat_id, whatsapp_group_id, name, slug, creator_id)')
      .eq('id', subscriptionId)
      .single()

    if (error || !sub) {
      return res.status(404).json({ message: 'Subscription not found' })
    }

    const platform = sub.communities?.platform || 'telegram'
    const joinUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/join/${sub.communities?.slug}`
    const removeMsg = `⛔ You have been removed from *${sub.communities?.name}* by the community admin.\n\nRejoin here: ${joinUrl}`

    if (platform === 'telegram') {
      const chatId = sub.communities?.telegram_chat_id
      const userId = sub.telegram_user_id

      if (chatId && userId) {
        try {
          await kickChatMember({ chatId, userId })
          await sendTelegramMessage({ userId, text: removeMsg })
        } catch (tgErr) {
          console.error('[members/remove] Telegram kick failed:', tgErr.message)
        }
      }
    } else if (platform === 'whatsapp') {
      const groupId = sub.communities?.whatsapp_group_id
      const phone = sub.whatsapp_phone

      if (groupId && phone) {
        if (getWhatsAppStatus() === 'authenticated') {
          try {
            await removeWhatsAppMember(groupId, phone)
            await sendWhatsAppMessage(phone, removeMsg)
          } catch (waErr) {
            console.error('[members/remove] WhatsApp kick failed:', waErr.message)
          }
        } else {
          console.warn('[members/remove] WhatsApp client offline, member removed from DB only.')
        }
      }
    }

    // Mark subscription as cancelled
    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subscriptionId)

    if (updateErr) throw updateErr

    console.log(`[members/remove] manually removed sub ${subscriptionId} (userId/phone: ${sub.telegram_user_id || sub.whatsapp_phone})`)

    return res.json({ success: true, message: 'Member removed successfully' })
  } catch (err) {
    console.error('[members/remove] error:', err.message)
    return res.status(500).json({ message: 'Failed to remove member' })
  }
})

export default router
