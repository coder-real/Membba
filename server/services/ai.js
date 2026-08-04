/**
 * ai.js — Membba AI context engine (Groq)
 *
 * Powers:
 *   1. AI First Responder  (WhatsApp DM replies)
 *   2. Smart Auto-Add      (personalized welcome messages)
 *   3. Broadcast Engine    (per-group tone variation)
 *   4. Daily Admin Digest  (morning briefing generation)
 *   5. Per-Member Memory   (context + history)
 */

import Groq from 'groq-sdk'
import { supabase } from '../lib/supabase.js'

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const HISTORY_LIMIT = 10
const MAX_TOKENS = 420

const INTENTS = {
  GREETING: 'greeting',
  RENEWAL: 'renewal',
  SUBSCRIPTION_STATUS: 'subscription_status',
  INVITE_MISSING: 'invite_missing',
  PAYMENT_ISSUE: 'payment_issue',
  REFUND: 'refund',
  ACCESS_REMOVED: 'access_removed',
  HUMAN_ADMIN: 'human_admin',
  UNKNOWN_MEMBER: 'unknown_member',
  GENERAL_SUPPORT: 'general_support',
}

// ── Lightweight intent detection ─────────────────────────────────────────────
// This is intentionally deterministic for now. Groq writes the human reply, while
// Membba keeps control of the product logic and safety rules.
function detectIntent(text, member) {
  const t = (text || '').toLowerCase()

  if (!member) return INTENTS.UNKNOWN_MEMBER

  if (/\b(refund|money back|reverse|reversal|chargeback)\b/.test(t)) return INTENTS.REFUND
  if (/\b(admin|human|creator|owner|support|agent|person|someone)\b/.test(t)) return INTENTS.HUMAN_ADMIN
  if (/\b(paid|payment|paystack|debited|charged|receipt|transaction|reference|bank|card)\b/.test(t)) return INTENTS.PAYMENT_ISSUE
  if (/\b(invite|link|group link|join link|access link|didn't get|did not get|haven't received|have not received)\b/.test(t)) return INTENTS.INVITE_MISSING
  if (/\b(renew|renewal|subscribe again|resubscribe|pay again|extend|expired)\b/.test(t)) return INTENTS.RENEWAL
  if (/\b(status|active|expire|expires|expiry|valid|when.*end|how long)\b/.test(t)) return INTENTS.SUBSCRIPTION_STATUS
  if (/\b(removed|kicked|blocked|can't enter|cant enter|lost access|no access)\b/.test(t)) return INTENTS.ACCESS_REMOVED
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|yo|sup|what'?s good)\b/.test(t.trim())) return INTENTS.GREETING

  return INTENTS.GENERAL_SUPPORT
}

function getIntentGuidance(intent, member, actionPlan = null) {
  const status = member?.status || 'unknown'
  const renewalUrl = member?.renewal_url

  const common = `Current capability: you can answer and guide. Do not claim you have performed backend actions like resending invites, verifying Paystack, adding/removing users, or issuing refunds unless the system explicitly says it was done. Internal next action: ${actionPlan?.action || 'reply_only'}. Admin needed: ${actionPlan?.needs_admin ? 'yes' : 'no'}.`

  switch (intent) {
    case INTENTS.UNKNOWN_MEMBER:
      return `${common}\nThe sender is not matched to any subscription by WhatsApp phone. Be warm. Say you can't find an active Membba subscription for this WhatsApp number yet. Ask them to use the phone number/email they paid with or wait for an admin if they believe this is a mistake.`
    case INTENTS.RENEWAL:
      return `${common}\nThe user wants to renew. If status is expired/cancelled, empathize briefly and include the exact renewal URL if available: ${renewalUrl || 'not available'}. If status is active, mention they are currently active and can renew/extend from the same community page if they want.`
    case INTENTS.SUBSCRIPTION_STATUS:
      return `${common}\nThe user wants subscription status. Answer directly using the known status and expiry date. If expired, include the renewal URL if available.`
    case INTENTS.INVITE_MISSING:
      return `${common}\nThe user needs an invite/group link. If status is active, apologize and say this should be resent/checked by the admin; do not pretend you resent it. If status is expired, explain they need to renew first and include the renewal URL if available.`
    case INTENTS.PAYMENT_ISSUE:
      return `${common}\nThe user has a payment issue. Be calm. Do not claim payment was verified unless payment status is in profile. Ask for patience and say an admin may need to confirm the transaction. If the subscription is active, reassure them access should be available.`
    case INTENTS.REFUND:
      return `${common}\nRefunds require admin approval. Do not promise a refund. Acknowledge and say you'll flag it for admin review.`
    case INTENTS.ACCESS_REMOVED:
      return `${common}\nThe user lost access or was removed. If expired/cancelled, explain it is likely because the subscription ended and include renewal URL. If active, say it may be a group-access issue and should be checked by admin.`
    case INTENTS.HUMAN_ADMIN:
      return `${common}\nThe user wants a human/admin. Acknowledge and say you'll make sure the admin is aware. Keep it short.`
    case INTENTS.GREETING:
      return `${common}\nThe user is greeting. Reply naturally and briefly, then offer to help with subscription, payment, invite, or community access.`
    default:
      return `${common}\nHandle as general community support. Be helpful but do not invent facts. If it requires admin action, say so.`
  }
}


function buildActionPlan(intent, member) {
  const status = member?.status || 'unknown'
  const renewalUrl = member?.renewal_url || null

  const plan = {
    intent,
    needs_admin: false,
    member_status: status,
    action: 'reply_only',
    action_label: null,
    public_note: null,
  }

  if (!member) {
    return {
      ...plan,
      needs_admin: true,
      action: 'identify_member',
      action_label: 'Ask admin/member to confirm payment identity',
      public_note: 'No subscription was found for this WhatsApp number.',
    }
  }

  if (intent === INTENTS.RENEWAL || intent === INTENTS.SUBSCRIPTION_STATUS || intent === INTENTS.ACCESS_REMOVED) {
    if (['expired', 'cancelled'].includes(status)) {
      return {
        ...plan,
        action: 'send_renewal_link',
        action_label: 'Send renewal link',
        public_note: renewalUrl ? `Renewal link: ${renewalUrl}` : 'Renewal link unavailable.',
      }
    }
    return {
      ...plan,
      action: 'explain_active_status',
      action_label: 'Explain active subscription status',
      public_note: 'Member currently has an active subscription.',
    }
  }

  if (intent === INTENTS.INVITE_MISSING) {
    if (status === 'active') {
      return {
        ...plan,
        needs_admin: true,
        action: 'resend_invite_needed',
        action_label: 'Admin/bot should resend invite',
        public_note: 'Do not claim the invite was resent unless the resend API has run.',
      }
    }
    return {
      ...plan,
      action: 'send_renewal_link',
      action_label: 'Explain expired access and send renewal link',
      public_note: renewalUrl ? `Renewal link: ${renewalUrl}` : 'Renewal link unavailable.',
    }
  }

  if (intent === INTENTS.PAYMENT_ISSUE) {
    return {
      ...plan,
      needs_admin: true,
      action: 'verify_payment_needed',
      action_label: 'Admin should verify Paystack/payment status',
      public_note: 'Ask for payment reference only if needed; do not say payment was confirmed.',
    }
  }

  if (intent === INTENTS.REFUND) {
    return {
      ...plan,
      needs_admin: true,
      action: 'refund_review_needed',
      action_label: 'Admin should review refund request',
      public_note: 'Do not promise refunds.',
    }
  }

  if (intent === INTENTS.HUMAN_ADMIN) {
    return {
      ...plan,
      needs_admin: true,
      action: 'admin_followup_needed',
      action_label: 'Admin follow-up requested',
      public_note: 'Keep it short and confirm admin follow-up.',
    }
  }

  return plan
}


function prettyCommunityName(member) {
  return (member?.community_name || 'the community').replace(/\s+/g, ' ').trim()
}

function buildHumanDraft(intent, member, actionPlan) {
  const group = prettyCommunityName(member)
  const url = member?.renewal_url
  const expiry = member?.expires_at
    ? new Date(member.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  if (!member) {
    return `I can’t find a subscription linked to this WhatsApp number yet. If you paid with another number or email, send it here so it can be matched.`
  }

  switch (intent) {
    case INTENTS.RENEWAL:
      if (['expired', 'cancelled'].includes(member.status)) {
        return url
          ? `Ah, your access to ${group} has expired. You can renew here: ${url}. Once that’s done, you should be able to get back in.`
          : `Ah, your access to ${group} has expired. I can’t see the renewal link right now, so I’ll flag this for the admin to check.`
      }
      return `You’re still active on ${group}. If you want to extend your access, you can use the community page${url ? ` here: ${url}` : ''}.`

    case INTENTS.SUBSCRIPTION_STATUS:
      if (member.status === 'active') {
        return expiry
          ? `You’re active on ${group}. Your access runs until ${expiry}.`
          : `You’re active on ${group}. I can’t see the exact expiry date right now, but your access is still valid.`
      }
      return url
        ? `Your access to ${group} expired${expiry ? ` on ${expiry}` : ''}. You can renew here: ${url}.`
        : `Your access to ${group} has expired. I’ll flag this so the admin can help with the renewal link.`

    case INTENTS.INVITE_MISSING:
      if (member.status === 'active') {
        return `Sorry about that — you should have received the invite for ${group}. I’ll flag it for the admin to check and resend.`
      }
      return url
        ? `It looks like your access to ${group} isn’t active right now. Renew here first: ${url}. After that, the invite should come through.`
        : `It looks like your access to ${group} isn’t active right now. I’ll flag this for the admin to check.`

    case INTENTS.PAYMENT_ISSUE:
      return `Sorry about that — if payment went through and the link didn’t arrive, I’ll flag it for the admin to confirm and send the invite.`

    case INTENTS.REFUND:
      return `Okay, I’ll flag this for the admin to review. Refunds have to be checked from their side first, so they’ll follow up with you.`

    case INTENTS.ACCESS_REMOVED:
      if (['expired', 'cancelled'].includes(member.status)) {
        return url
          ? `You were likely removed because your access to ${group} expired. You can renew here: ${url}.`
          : `You were likely removed because your access to ${group} expired. I’ll flag this for the admin to help with renewal.`
      }
      return `You should still have access to ${group}, so this needs a quick check. I’ll flag it for the admin.`

    case INTENTS.HUMAN_ADMIN:
      return `Sure — I’ll flag this for the admin to check.`

    case INTENTS.GREETING:
      return `Hey — I’m here. Do you need help with payment, renewal, or getting into the group?`

    default:
      return `Got it. I’ll help as much as I can — if it needs access or payment checks, I’ll flag it for the admin.`
  }
}

const BOTTY_PHRASES = [
  'i hope this message finds you',
  'thank you for reaching out',
  'i am here to assist',
  "i'm here to assist",
  'happy to help',
  'bear with me',
  "i'll keep an eye",
  'taken care of',
  'is there anything else i can help',
  'feel free to let me know',
  'i understand your concern',
  'dear user',
  'please be rest assured',
  'kindly note',
  'we apologize for any inconvenience',
  'your request has been received',
]

function soundsBotty(reply) {
  const lower = (reply || '').toLowerCase()
  return BOTTY_PHRASES.some(p => lower.includes(p)) || reply.length > 520
}

function cleanReply(reply) {
  return (reply || '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
}

// ── System prompt — personality, data, intent, and product rules ─────────────
function buildSystemPrompt(member, intent, actionPlan) {
  const status = member?.status || 'unknown'
  const plan = member?.plan_name || 'unknown'
  const since = member?.created_at
    ? new Date(member.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'unknown'
  const expires = member?.expires_at
    ? new Date(member.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'unknown'
  const name = member?.name || 'there'
  const group = member?.community_name || 'the community'
  const renewalUrl = member?.renewal_url || 'unknown'
  const intentGuidance = getIntentGuidance(intent, member, actionPlan)
  const humanDraft = buildHumanDraft(intent, member, actionPlan)

  return `You are Membba's community support assistant for ${group}, a paid WhatsApp community.

Your job is to sound like a capable human community assistant — warm, direct, and natural. Avoid stiff support phrases.

MEMBER PROFILE (do not ask for these details; you already have them):
- Name: ${name}
- Subscription status: ${status}
- Plan: ${plan}
- Member since: ${since}
- Expires: ${expires}
- Renewal link: ${renewalUrl}

DETECTED INTENT:
- ${intent}

INTENT GUIDANCE:
${intentGuidance}

ACTION PLAN (internal; do not mention these field names):
- Action: ${actionPlan?.action || 'reply_only'}
- Admin needed: ${actionPlan?.needs_admin ? 'yes' : 'no'}
- Public note: ${actionPlan?.public_note || 'none'}

SUGGESTED HUMAN DRAFT:
${humanDraft}

Use the suggested draft as your baseline. You may make it slightly warmer, but do not make it longer or more formal.

HUMAN TONE EXAMPLES:
- Renewal: "Your access has expired, but you can renew here: [url]. Once that’s done, you should be able to get back in."
- Missing invite while active: "You should have access, so this needs a quick check. I’ll flag it for the admin to resend the invite."
- Payment issue: "Thanks for the heads-up. Payment issues need a quick confirmation from the admin side, so I’ll flag this for review."
- Unknown member: "I can’t find a subscription attached to this WhatsApp number yet. If you paid with another number or email, send that over and the admin can match it."

STYLE RULES:
1. Write like a real WhatsApp support person: friendly, short, and clear.
2. Keep it to 2–4 short sentences unless steps are needed.
3. Use contractions naturally: "you're", "I'll", "can't".
4. Avoid customer-support clichés: "happy to help", "bear with me", "I understand your concern", "I'm here to assist", "taken care of", and "Is there anything else".
5. Do not use markdown headings. Bullets are okay only for steps.
6. If the subscription is expired and a renewal link exists, include the exact renewal URL.
7. Never say "click this link" or "use the link" unless the actual URL appears in the reply.
8. Never pretend to perform actions. You can say what should happen next or that admin review is needed.
9. Never assume silence means the issue is resolved.
10. Prefer one concrete next step over vague reassurance.
11. If admin action is needed, say it plainly: "I’ll flag this for the admin to check." Do not overpromise.`
}

// ── Pull member context from Supabase ────────────────────────────────────────
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
        name,
        slug
      )
    `)
    .eq('whatsapp_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    status: data.status,
    plan_name: data.plans?.name || null,
    created_at: data.created_at,
    expires_at: data.expires_at,
    community_name: data.communities?.name || null,
    community_slug: data.communities?.slug || null,
    renewal_url: data.communities?.slug
      ? `${process.env.CLIENT_URL || 'http://localhost:5173'}/join/${data.communities.slug}`
      : null,
  }
}

// ── Pull last N conversation turns from Supabase ─────────────────────────────
async function getHistory(phone) {
  const { data } = await supabase
    .from('member_conversations')
    .select('role, content')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  return (data || []).reverse()
}

async function saveMessage(phone, role, content) {
  await supabase.from('member_conversations').insert({ phone, role, content })
}

async function callGroq(systemPrompt, history, userMessage) {
  if (!groq) throw new Error('GROQ_API_KEY is not set')

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ]

  const create = async (msgs, temperature = 0.62) => {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: msgs,
      max_tokens: MAX_TOKENS,
      temperature,
    })
    return cleanReply(completion.choices[0]?.message?.content?.trim() || '')
  }

  let reply = await create(messages, 0.62)

  // One rewrite pass if the model slips into generic support-bot language.
  if (soundsBotty(reply)) {
    reply = await create([
      ...messages,
      { role: 'assistant', content: reply },
      {
        role: 'user',
        content: 'Rewrite your last reply as a natural WhatsApp message from a real community assistant. Make it shorter, warmer, and more direct. Remove generic support phrases. Keep any URL exactly if present.',
      },
    ], 0.55)
  }

  const lower = reply.toLowerCase()

  const uncertaintyPhrases = [
    'i\'m not sure',
    'i don\'t know',
    'i cannot',
    'admin will need',
    'requires admin',
    'admin review',
    'flag this for',
    'admin to check',
  ]

  const confident = reply.length > 25 && !uncertaintyPhrases.some(p => lower.includes(p))

  return { reply, confident }
}

async function maybeEscalate({ phone, text, reply, confident, intent, actionPlan }) {
  const shouldEscalate = actionPlan?.needs_admin || !confident || [
    INTENTS.PAYMENT_ISSUE,
    INTENTS.REFUND,
    INTENTS.INVITE_MISSING,
    INTENTS.HUMAN_ADMIN,
  ].includes(intent)

  if (!shouldEscalate) return { escalated: false, escalation_id: null }

  let escalationId = null

  // Persist the follow-up so it is not lost if WhatsApp admin alerts are offline.
  try {
    const { data, error } = await supabase
      .from('ai_escalations')
      .insert({
        phone,
        intent,
        action: actionPlan?.action || null,
        message: text,
        ai_reply: reply,
        status: 'open',
      })
      .select('id')
      .single()

    if (!error) escalationId = data?.id || null
    else console.warn('[ai] escalation was not saved:', error.message)
  } catch (err) {
    console.warn('[ai] escalation save skipped:', err.message)
  }

  const adminJid = process.env.ADMIN_JID
  if (adminJid) {
    try {
      const { sendWhatsAppMessage } = await import('./whatsapp.js')
      await sendWhatsAppMessage(
        adminJid.replace('@s.whatsapp.net', ''),
        `⚠️ AI follow-up needed\nIntent: ${intent}\nAction: ${actionPlan?.action || 'review'}\nFrom: ${phone}\nMessage: "${text}"\nAI reply: "${reply}"`
      ).catch(() => {})
    } catch {
      // Non-blocking: do not break member replies if WhatsApp admin alert fails.
    }
  }

  return { escalated: true, escalation_id: escalationId }
}

export async function getAIReplyDetailed(phone, text) {
  try {
    const [member, history] = await Promise.all([
      getMemberContext(phone),
      getHistory(phone),
    ])

    const intent = detectIntent(text, member)
    const actionPlan = buildActionPlan(intent, member)
    const systemPrompt = buildSystemPrompt(member, intent, actionPlan)
    const { reply, confident } = await callGroq(systemPrompt, history, text)

    Promise.all([
      saveMessage(phone, 'user', text),
      saveMessage(phone, 'assistant', reply),
    ]).catch(err => console.error('[ai] failed to save conversation:', err.message))

    const escalation = await maybeEscalate({ phone, text, reply, confident, intent, actionPlan })

    return {
      reply,
      intent,
      action: actionPlan,
      escalation,
      confident,
      member: member
        ? {
            status: member.status,
            plan_name: member.plan_name,
            community_name: member.community_name,
            community_slug: member.community_slug,
            renewal_url: member.renewal_url,
            expires_at: member.expires_at,
          }
        : null,
    }
  } catch (err) {
    console.error('[ai] getAIReply failed:', err.message)
    return {
      reply: `Sorry, I'm having trouble right now. Please try again in a moment or message the admin if it's urgent.`,
      intent: INTENTS.GENERAL_SUPPORT,
      confident: false,
      member: null,
    }
  }
}

// Backwards-compatible function used by whatsapp.js.
export async function getAIReply(phone, text) {
  const result = await getAIReplyDetailed(phone, text)
  return result.reply
}

// Utility: generate text for broadcasts, digests etc.
export async function generateText(prompt) {
  if (!groq) throw new Error('GROQ_API_KEY is not set')

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: MAX_TOKENS,
    temperature: 0.65,
  })
  return completion.choices[0]?.message?.content?.trim() || ''
}

export { INTENTS, detectIntent }
