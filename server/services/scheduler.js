/**
 * scheduler.js — Membba Scheduled Content Engine (Feature 3)
 *
 * Checks for pending scheduled_posts every minute (called from cron in index.js).
 * Optionally personalizes the tone per group via Groq before sending.
 */

import { supabase } from '../lib/supabase.js'
import { generateText } from './ai.js'

// ── Vary tone per group if AI personalization is enabled ─────────────────────
async function personalizeContent(content, communityName) {
  try {
    return await generateText(
      `Rewrite this announcement slightly for the community called "${communityName}". 
      Keep the same information and meaning but make it feel natural for this specific group. 
      Do not add greetings or sign-offs — just return the rewritten message body. 
      Original: ${content}`
    )
  } catch {
    return content // fallback to original on AI error
  }
}

// ── Main export — called by the every-minute cron job ────────────────────────
export async function processScheduledPosts() {
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select('*, communities(name, whatsapp_group_id, platform, telegram_chat_id)')
    .eq('status', 'pending')
    .lte('scheduled_time', new Date().toISOString())
    .limit(20)

  if (error) {
    console.error('[scheduler] fetch error:', error.message)
    return 0
  }

  if (!posts || posts.length === 0) return 0

  let sentCount = 0

  for (const post of posts) {
    const community = post.communities
    if (!community) continue

    try {
      let content = post.content

      // Optionally personalize tone via Groq
      if (post.personalize_ai && community.name) {
        content = await personalizeContent(content, community.name)
      }

      if (community.platform === 'whatsapp' && community.whatsapp_group_id) {
        const { sendWhatsAppMessage } = await import('./whatsapp.js')
        await sendWhatsAppMessage(community.whatsapp_group_id, content)

      } else if ((community.platform === 'telegram' || !community.platform) && community.telegram_chat_id) {
        // Telegram broadcast
        const token = process.env.TELEGRAM_BOT_TOKEN
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: community.telegram_chat_id, text: content }),
        })
      }

      // Mark as sent
      await supabase
        .from('scheduled_posts')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', post.id)

      sentCount++
      console.log(`[scheduler] sent post ${post.id} to ${community.name}`)

    } catch (err) {
      console.error(`[scheduler] failed to send post ${post.id}:`, err.message)
      // Don't mark as failed — retry next minute
    }
  }

  return sentCount
}
