import express from 'express'
import { supabase } from '../lib/supabase.js'
import { kickChatMember, sendTelegramMessage } from '../services/telegram.js'

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
    const chatId = sub.communities?.telegram_chat_id
    const userId = sub.telegram_user_id

    if (chatId && userId) {
      try {
        await kickChatMember({ chatId, userId })

        // Notify the member they were removed
        const joinUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/join/${sub.communities?.slug}`
        await sendTelegramMessage({
          userId,
          text: `⛔ You have been removed from *${sub.communities?.name}* by the community admin.\n\n[Rejoin here](${joinUrl})`,
        })
      } catch (tgErr) {
        console.error('[members/remove] Telegram kick failed:', tgErr.message)
        // Non-fatal — still cancel the subscription
      }
    }

    // Mark subscription as cancelled
    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subscriptionId)

    if (updateErr) throw updateErr

    console.log(`[members/remove] manually removed sub ${subscriptionId} (userId:${userId})`)

    return res.json({ success: true, message: 'Member removed successfully' })
  } catch (err) {
    console.error('[members/remove] error:', err.message)
    return res.status(500).json({ message: 'Failed to remove member' })
  }
})

export default router
