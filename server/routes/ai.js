import express from 'express'
import { supabase } from '../lib/supabase.js'
import { getAIReplyDetailed, generateText } from '../services/ai.js'
import { sendTelegramInvite } from '../services/telegram.js'
import { sendWhatsAppInvite, getWhatsAppStatus } from '../services/whatsapp.js'

const router = express.Router()

function testEndpointAllowed() {
  return process.env.NODE_ENV !== 'production' || process.env.AI_TEST_ENABLED === 'true'
}

function assertTestAllowed(req, res) {
  if (testEndpointAllowed()) return true
  res.status(404).json({ message: 'Not found' })
  return false
}

async function getCreatorId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error) return null
  return data?.user?.id || null
}

async function getCreatorCommunityIds(creatorId) {
  const { data, error } = await supabase
    .from('communities')
    .select('id')
    .eq('creator_id', creatorId)
  if (error) throw error
  return (data || []).map(c => c.id)
}

async function getLatestSubscriptionForPhone(phone, communityIds, onlyActive = false) {
  let query = supabase
    .from('subscriptions')
    .select('*, communities(id, name, slug, platform, creator_id, telegram_chat_id, whatsapp_group_id, whatsapp_group_invite_link), plans(name)')
    .eq('whatsapp_phone', phone)
    .in('community_id', communityIds)
    .order('created_at', { ascending: false })
    .limit(1)

  if (onlyActive) query = query.eq('status', 'active')

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data || null
}

async function getOwnedEscalation(escalationId, creatorId) {
  const communityIds = await getCreatorCommunityIds(creatorId)
  if (!communityIds.length) return { escalation: null, subscription: null, error: 'not_found' }

  const { data: escalation, error } = await supabase
    .from('ai_escalations')
    .select('*')
    .eq('id', escalationId)
    .maybeSingle()

  if (error) throw error
  if (!escalation) return { escalation: null, subscription: null, error: 'not_found' }

  const subscription = await getLatestSubscriptionForPhone(escalation.phone, communityIds)
  if (!subscription) return { escalation: null, subscription: null, error: 'forbidden' }

  return { escalation, subscription, error: null }
}

// ─────────────────────────────────────────────────────
// POST /api/ai/test-reply
// Simulates an incoming WhatsApp DM without needing WhatsApp linked.
// Body: { phone: '2347040883919', text: 'How do I renew?' }
// ─────────────────────────────────────────────────────
router.post('/test-reply', async (req, res) => {
  if (!assertTestAllowed(req, res)) return

  const { phone, text } = req.body || {}
  const cleanPhone = String(phone || '').replace(/\D/g, '')
  const message = String(text || '').trim()

  if (!cleanPhone || !message) {
    return res.status(400).json({
      message: 'phone and text are required',
      example: { phone: '2347040883919', text: 'How do I renew my subscription?' },
    })
  }

  try {
    const result = await getAIReplyDetailed(cleanPhone, message)
    res.json({ ok: true, phone: cleanPhone, input: message, ...result })
  } catch (err) {
    console.error('[ai/test-reply] error:', err.message)
    res.status(500).json({ ok: false, message: err.message })
  }
})

// ─────────────────────────────────────────────────────
// POST /api/ai/test-generate
// Simple Groq smoke test for one-off generation.
// Body: { prompt: 'Write a welcome message...' }
// ─────────────────────────────────────────────────────
router.post('/test-generate', async (req, res) => {
  if (!assertTestAllowed(req, res)) return

  const prompt = String(req.body?.prompt || '').trim()
  if (!prompt) return res.status(400).json({ message: 'prompt is required' })

  try {
    const output = await generateText(prompt)
    res.json({ ok: true, prompt, output })
  } catch (err) {
    console.error('[ai/test-generate] error:', err.message)
    res.status(500).json({ ok: false, message: err.message })
  }
})

// ─────────────────────────────────────────────────────
// GET /api/ai/status
// Readiness checks for Automations UI.
// ─────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const [{ count: openEscalations }, { count: aiReplies }, { count: queuedPosts }, runsResult] = await Promise.all([
      supabase.from('ai_escalations').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('member_conversations').select('*', { count: 'exact', head: true }).eq('role', 'assistant'),
      supabase.from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('automation_runs').select('type,status,created_at,message').order('created_at', { ascending: false }).limit(10),
    ])

    res.json({
      groq: Boolean(process.env.GROQ_API_KEY),
      whatsapp_status: getWhatsAppStatus(),
      admin_jid: Boolean(process.env.ADMIN_JID),
      cron_disabled: process.env.DISABLE_CRON === 'true',
      telegram_disabled: process.env.DISABLE_TELEGRAM === 'true',
      open_escalations: openEscalations || 0,
      ai_replies: aiReplies || 0,
      queued_posts: queuedPosts || 0,
      recent_runs: runsResult.error ? [] : (runsResult.data || []),
    })
  } catch (err) {
    console.error('[ai/status] error:', err.message)
    res.status(500).json({ message: 'Failed to load AI status' })
  }
})

// ─────────────────────────────────────────────────────
// GET /api/ai/escalations?status=open|resolved|all
// Creator-facing AI escalation inbox.
// ─────────────────────────────────────────────────────
router.get('/escalations', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ message: 'Unauthorized' })

  const status = req.query.status || 'open'

  try {
    const communityIds = await getCreatorCommunityIds(creatorId)
    if (!communityIds.length) return res.json([])

    const { data: subs, error: subErr } = await supabase
      .from('subscriptions')
      .select('whatsapp_phone, status, expires_at, communities(id, name, slug, platform, whatsapp_setup_mode), plans(name)')
      .in('community_id', communityIds)
      .not('whatsapp_phone', 'is', null)

    if (subErr) throw subErr

    const byPhone = new Map()
    for (const sub of subs || []) {
      if (!sub.whatsapp_phone) continue
      if (!byPhone.has(sub.whatsapp_phone)) byPhone.set(sub.whatsapp_phone, sub)
    }

    const phones = [...byPhone.keys()]
    if (!phones.length) return res.json([])

    let query = supabase
      .from('ai_escalations')
      .select('*')
      .in('phone', phones)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status !== 'all') query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    const enriched = (data || []).map(e => ({
      ...e,
      subscription: byPhone.get(e.phone) || null,
    }))

    res.json(enriched)
  } catch (err) {
    console.error('[ai/escalations] error:', err.message)
    res.status(500).json({ message: 'Failed to load escalations' })
  }
})

// ─────────────────────────────────────────────────────
// PATCH /api/ai/escalations/:id/resolve
// ─────────────────────────────────────────────────────
router.patch('/escalations/:id/resolve', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const { escalation, error } = await getOwnedEscalation(req.params.id, creatorId)
    if (error === 'not_found') return res.status(404).json({ message: 'Escalation not found' })
    if (error === 'forbidden') return res.status(403).json({ message: 'Forbidden' })

    const { data, error: updateErr } = await supabase
      .from('ai_escalations')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', escalation.id)
      .select()
      .single()

    if (updateErr) throw updateErr
    res.json({ ok: true, escalation: data })
  } catch (err) {
    console.error('[ai/escalations/resolve] error:', err.message)
    res.status(500).json({ message: 'Failed to resolve escalation' })
  }
})

// ─────────────────────────────────────────────────────
// POST /api/ai/escalations/:id/resend-invite
// Executes the "resend invite" action for active members.
// ─────────────────────────────────────────────────────
router.post('/escalations/:id/resend-invite', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const { escalation, error } = await getOwnedEscalation(req.params.id, creatorId)
    if (error === 'not_found') return res.status(404).json({ message: 'Escalation not found' })
    if (error === 'forbidden') return res.status(403).json({ message: 'Forbidden' })

    const communityIds = await getCreatorCommunityIds(creatorId)
    const sub = await getLatestSubscriptionForPhone(escalation.phone, communityIds, true)

    if (!sub) {
      return res.status(400).json({
        message: 'No active subscription found for this member. Ask them to renew first.',
      })
    }

    const community = sub.communities
    const platform = community?.platform || 'telegram'
    let result = { delivery: null, queued: false }

    if (platform === 'telegram') {
      if (!sub.telegram_user_id || !community?.telegram_chat_id) {
        return res.status(400).json({ message: 'Missing Telegram user ID or chat ID for this member.' })
      }

      await sendTelegramInvite({
        chatId: community.telegram_chat_id,
        telegramUserId: sub.telegram_user_id,
        communityName: community.name,
        communitySlug: community.slug,
      })
      result.delivery = 'telegram_dm'
    } else if (platform === 'whatsapp') {
      if (!sub.whatsapp_phone || !community?.whatsapp_group_invite_link) {
        return res.status(400).json({ message: 'Missing WhatsApp phone or group invite link.' })
      }

      if (getWhatsAppStatus() === 'connected') {
        await sendWhatsAppInvite(
          sub.whatsapp_phone,
          community.whatsapp_group_invite_link,
          community.name,
          community.id,
          community.whatsapp_group_id,
        )
        result.delivery = 'whatsapp_dm'
      } else {
        await supabase.from('whatsapp_pending_invites').insert({
          phone: sub.whatsapp_phone,
          invite_link: community.whatsapp_group_invite_link,
          community_name: community.name,
          community_id: community.id,
          group_id: community.whatsapp_group_id,
          custom_message: `Here’s your invite link for ${community.name}:\n${community.whatsapp_group_invite_link}`,
        })
        result.delivery = 'whatsapp_pending_queue'
        result.queued = true
      }
    } else {
      return res.status(400).json({ message: `Unsupported platform: ${platform}` })
    }

    await supabase
      .from('ai_escalations')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', escalation.id)

    res.json({ ok: true, ...result, message: result.queued ? 'Invite queued for delivery when WhatsApp reconnects.' : 'Invite resent.' })
  } catch (err) {
    console.error('[ai/escalations/resend-invite] error:', err.message)
    res.status(500).json({ message: err.message || 'Failed to resend invite' })
  }
})

export default router
