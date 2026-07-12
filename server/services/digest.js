/**
 * digest.js — Membba Daily Admin Digest (Feature 4)
 *
 * Runs at 8am every morning via cron in index.js.
 * Pulls real data from Supabase, feeds it to Groq,
 * and delivers a human-readable WhatsApp briefing
 * directly to the admin's phone — zero dashboards to check.
 */

import { supabase } from '../lib/supabase.js'
import { generateText } from './ai.js'

// ── Pull everything needed for the briefing ───────────────────────────────────
async function collectDigestData() {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString()

  const [
    { data: newSubs,     error: e1 },
    { data: expiredSubs, error: e2 },
    { data: payments,    error: e3 },
    { data: escalations, error: e4 },
  ] = await Promise.all([
    // New subscriptions in the last 24h
    supabase
      .from('subscriptions')
      .select('email, communities(name), plans(name)')
      .gte('created_at', yesterday)
      .eq('status', 'active'),

    // Subscriptions that expired in the last 24h
    supabase
      .from('subscriptions')
      .select('email, communities(name)')
      .gte('expires_at', yesterday)
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'expired'),

    // Revenue from successful payments in last 24h
    supabase
      .from('payments')
      .select('amount, email')
      .gte('created_at', yesterday)
      .eq('status', 'success'),

    // AI conversations that need admin review (unanswered escalations)
    supabase
      .from('member_conversations')
      .select('phone, content')
      .eq('role', 'user')
      .gte('created_at', yesterday),
  ])

  if (e1 || e2 || e3 || e4) {
    console.error('[digest] Supabase query error:', e1?.message || e2?.message || e3?.message || e4?.message)
  }

  const totalRevenue = (payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0)

  return {
    newMembers:    newSubs     || [],
    expiredToday:  expiredSubs || [],
    paymentsToday: payments    || [],
    dmCount:       escalations?.length || 0,
    totalRevenue,
  }
}

// ── Build the prompt and call Groq ───────────────────────────────────────────
async function generateDigest(data) {
  const { newMembers, expiredToday, paymentsToday, dmCount, totalRevenue } = data

  const newMemberLines = newMembers.length > 0
    ? newMembers.map(m => `• ${m.email} joined ${m.communities?.name || 'a community'} (${m.plans?.name || 'unknown plan'})`).join('\n')
    : '• None today'

  const expiredLines = expiredToday.length > 0
    ? expiredToday.map(m => `• ${m.email} (${m.communities?.name || 'unknown community'})`).join('\n')
    : '• None today'

  const prompt = `Write a concise morning WhatsApp briefing for a community manager.
Keep it under 200 words, warm and actionable, using simple bullet points.
Do not use markdown headers. Use plain text only — this is a WhatsApp message.

Here is the data for today:

New members (${newMembers.length}):
${newMemberLines}

Subscriptions that expired today (${expiredToday.length}):
${expiredLines}

Revenue collected today: ₦${totalRevenue.toLocaleString()} across ${paymentsToday.length} payment(s)

Member DMs received by the bot today: ${dmCount}

Start with "📊 Morning Briefing" as the first line.
End with one short actionable recommendation for the day.`

  return generateText(prompt)
}

// ── Main export — called by the cron job ────────────────────────────────────
export async function sendMorningDigest() {
  console.log('[digest] building morning briefing...')

  const adminJid = process.env.ADMIN_JID
  if (!adminJid) {
    console.warn('[digest] ADMIN_JID not set — skipping digest')
    return
  }

  try {
    const data = await collectDigestData()
    const message = await generateDigest(data)

    const adminPhone = adminJid.replace('@s.whatsapp.net', '')

    // Lazy import to avoid circular deps
    const { sendWhatsAppMessage } = await import('./whatsapp.js')
    await sendWhatsAppMessage(adminPhone, message)

    console.log('[digest] morning briefing sent to admin ✅')
  } catch (err) {
    console.error('[digest] failed to send digest:', err.message)
  }
}
