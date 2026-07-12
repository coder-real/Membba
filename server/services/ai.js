/**
 * ai.js — Membba AI context engine (Groq)
 *
 * This module is the foundation for all 5 AI features:
 *   1. AI First Responder  (DM replies)
 *   2. Smart Auto-Add      (personalised welcome messages)
 *   3. Broadcast Engine    (per-group tone variation)
 *   4. Daily Admin Digest  (morning briefing generation)
 *   5. Per-Member Memory   (this file — context + history)
 *
 * Three universal rules encoded into every call:
 *   Rule 1: Never assume silence = resolution.
 *   Rule 2: Never ask for info we already have.
 *   Rule 3: If subscription is expired, guide toward renewal — warm, not pushy.
 */

import Groq from 'groq-sdk'
import { supabase } from '../lib/supabase.js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const MODEL = 'llama-3.3-70b-versatile'
const HISTORY_LIMIT = 10   // last N messages to inject as context
const MAX_TOKENS = 512      // keep replies concise for WhatsApp

// ── System prompt — the personality and rules for the AI ──────────────────────
// This is injected into EVERY Groq call, ensuring consistent behaviour
// across all 5 features regardless of the calling context.
function buildSystemPrompt(member) {
  const status = member?.status || 'unknown'
  const plan   = member?.plan_name || 'unknown'
  const since  = member?.created_at
    ? new Date(member.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'unknown'
  const expires = member?.expires_at
    ? new Date(member.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'unknown'
  const name   = member?.name || 'there'
  const group  = member?.community_name || 'the community'

  return `You are a helpful and friendly support assistant for ${group}, a paid WhatsApp community powered by Membba.

MEMBER PROFILE (do NOT ask for any of this — you already have it):
- Name: ${name}
- Subscription status: ${status}
- Plan: ${plan}
- Member since: ${since}
- Expires: ${expires}

BEHAVIOUR RULES (strictly enforce these — they are non-negotiable):
1. NEVER assume silence or a short reply means the issue is resolved. Always confirm explicitly.
2. NEVER ask for information listed above — you already have it.
3. If status is 'expired', acknowledge it empathetically, then guide toward renewing (warm and helpful, never pushy or pressuring).
4. Keep replies concise and WhatsApp-friendly — short paragraphs, no markdown headers, bullet points only when listing steps.
5. If you are genuinely unsure or the question requires admin action (e.g. refunds, manual overrides), say so clearly and tell them an admin will follow up — do NOT make up answers.
6. Speak as if you work at the community, not as a generic AI bot. Use the community name naturally.`
}

// ── Pull member context from Supabase ─────────────────────────────────────────
async function getMemberContext(phone) {
  const { data } = await supabase
    .from('subscriptions')
    .select(`
      status,
      created_at,
      expires_at,
      plans (
        name
      ),
      communities (
        name
      )
    `)
    .eq('whatsapp_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    status:         data.status,
    plan_name:      data.plans?.name || null,
    created_at:     data.created_at,
    expires_at:     data.expires_at,
    community_name: data.communities?.name || null,
  }
}

// ── Pull last N conversation turns from Supabase ──────────────────────────────
async function getHistory(phone) {
  const { data } = await supabase
    .from('member_conversations')
    .select('role, content')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  // Reverse so oldest → newest for correct prompt order
  return (data || []).reverse()
}

// ── Persist a message turn to Supabase ───────────────────────────────────────
async function saveMessage(phone, role, content) {
  await supabase.from('member_conversations').insert({ phone, role, content })
}

// ── Call Groq and get a reply ─────────────────────────────────────────────────
async function callGroq(systemPrompt, history, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ]

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: MAX_TOKENS,
    temperature: 0.5,
  })

  const reply = completion.choices[0]?.message?.content?.trim() || ''

  // Mark as not-confident if the reply is very short or contains uncertainty phrases
  const uncertaintyPhrases = ['i\'m not sure', 'i don\'t know', 'i cannot', 'admin will', 'please contact']
  const confident = reply.length > 40 && !uncertaintyPhrases.some(p => reply.toLowerCase().includes(p))

  return { reply, confident }
}

// ── Main export — handles the complete AI reply loop ─────────────────────────
// Call this from whatsapp.js whenever a private DM arrives.
export async function getAIReply(phone, text) {
  try {
    // 1. Load live context + conversation history in parallel
    const [member, history] = await Promise.all([
      getMemberContext(phone),
      getHistory(phone),
    ])

    // 2. Build the system prompt with real member data
    const systemPrompt = buildSystemPrompt(member)

    // 3. Call Groq
    const { reply, confident } = await callGroq(systemPrompt, history, text)

    // 4. Persist both turns (fire-and-forget — don't block the reply)
    Promise.all([
      saveMessage(phone, 'user', text),
      saveMessage(phone, 'assistant', reply),
    ]).catch(err => console.error('[ai] failed to save conversation:', err.message))

    // 5. If AI wasn't confident, flag it for admin review
    if (!confident) {
      const adminJid = process.env.ADMIN_JID
      if (adminJid) {
        // Lazy import to avoid circular deps — ai.js shouldn't import whatsapp.js directly
        const { sendWhatsAppMessage } = await import('./whatsapp.js')
        await sendWhatsAppMessage(
          adminJid.replace('@s.whatsapp.net', ''),
          `⚠️ AI escalation needed\nFrom: ${phone}\nQuestion: "${text}"\nAI reply: "${reply}"`
        ).catch(() => {}) // Non-blocking
      }
    }

    return reply
  } catch (err) {
    console.error('[ai] getAIReply failed:', err.message)
    return `Sorry, I'm having trouble right now. Please try again in a moment or reach out to the admin for urgent help.`
  }
}

// ── Utility: generate text for any one-off purpose (broadcasts, digests etc.) ─
// Used by Features 3 and 4 — no history or member context needed.
export async function generateText(prompt) {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: MAX_TOKENS,
    temperature: 0.6,
  })
  return completion.choices[0]?.message?.content?.trim() || ''
}
