import express from 'express'
import axios from 'axios'
import { supabase } from '../lib/supabase.js'
import { createSubscription } from '../services/subscription.js'
import { sendTelegramInvite } from '../services/telegram.js'
import { sendWhatsAppInvite, getWhatsAppStatus } from '../services/whatsapp.js'

const router = express.Router()

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_BASE = 'https://api.paystack.co'

async function logPaymentEvent({ reference = null, event, status = 'info', message = null, payload = {} }) {
  try {
    await supabase.from('payment_events').insert({
      paystack_reference: reference,
      event,
      status,
      message,
      payload,
    })
  } catch {
    // ignore logging failures in ops tools
  }
}

async function getPaymentBundle(reference) {
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*, communities(id, name, slug, platform, creator_id, telegram_chat_id, whatsapp_group_id, whatsapp_group_invite_link), plans(id, name, price, duration_minutes)')
    .eq('paystack_reference', reference)
    .maybeSingle()
  if (error) throw error
  if (!payment) return null

  const [{ data: subscription }, { data: events }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('*, communities(name, slug, platform), plans(name)')
      .eq('paystack_reference', reference)
      .maybeSingle(),
    supabase
      .from('payment_events')
      .select('*')
      .eq('paystack_reference', reference)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return { payment, subscription: subscription || null, events: events || [] }
}


async function getSubscriptionFull(subscriptionId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, communities(id, name, slug, platform, telegram_chat_id, whatsapp_group_id, whatsapp_group_invite_link, creator_id), plans(id, name, duration_minutes)')
    .eq('id', subscriptionId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

async function resendInviteForSubscription(sub) {
  if (!sub) throw new Error('Subscription not found')
  if (sub.status !== 'active') throw new Error('Member does not have an active subscription')

  const community = sub.communities
  const platform = community?.platform || 'telegram'

  if (platform === 'telegram') {
    if (!sub.telegram_user_id || !community?.telegram_chat_id) {
      throw new Error('Missing Telegram user ID or group chat ID')
    }
    await sendTelegramInvite({
      chatId: community.telegram_chat_id,
      telegramUserId: sub.telegram_user_id,
      communityName: community.name,
      communitySlug: community.slug,
    })
    return { delivery: 'telegram_dm', queued: false }
  }

  if (platform === 'whatsapp') {
    if (!sub.whatsapp_phone || !community?.whatsapp_group_invite_link) {
      throw new Error('Missing WhatsApp phone or group invite link')
    }

    if (getWhatsAppStatus() === 'connected') {
      await sendWhatsAppInvite(
        sub.whatsapp_phone,
        community.whatsapp_group_invite_link,
        community.name,
        community.id,
        community.whatsapp_group_id || null,
      )
      return { delivery: 'whatsapp_dm', queued: false }
    }

    await supabase.from('whatsapp_pending_invites').insert({
      phone: sub.whatsapp_phone,
      invite_link: community.whatsapp_group_invite_link,
      community_name: community.name,
      community_id: community.id,
      group_id: community.whatsapp_group_id || null,
      custom_message: `Here’s your invite link for ${community.name}:\n${community.whatsapp_group_invite_link}`,
    })
    return { delivery: 'whatsapp_pending_queue', queued: true }
  }

  throw new Error(`Unsupported platform: ${platform}`)
}

async function verifyAndRepairPayment(reference, opsEmail = null) {
  if (!PAYSTACK_SECRET) throw new Error('Paystack is not configured')

  const bundle = await getPaymentBundle(reference)
  if (!bundle) throw new Error('Payment not found in Membba')

  const { payment } = bundle
  const { data: psRes } = await axios.get(
    `${PAYSTACK_BASE}/transaction/verify/${reference}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
  )

  await logPaymentEvent({ reference, event: 'ops_verify_attempt', status: 'info', message: `Ops verify by ${opsEmail || 'unknown'}`, payload: psRes.data || {} })

  if (!psRes.status || psRes.data.status !== 'success') {
    await supabase.from('payments').update({ status: 'failed' }).eq('paystack_reference', reference)
    await logPaymentEvent({ reference, event: 'ops_verify_not_success', status: 'failed', message: psRes.message || psRes.data?.status, payload: psRes.data || {} })
    return { success: false, payment_status: 'failed', message: psRes.message || 'Paystack has not confirmed this payment.' }
  }

  const expectedKobo = Math.round(Number(payment.amount || 0) * 100)
  if (Number(psRes.data.amount) !== expectedKobo) {
    await logPaymentEvent({ reference, event: 'ops_amount_mismatch', status: 'failed', message: `Expected ${expectedKobo}, got ${psRes.data.amount}`, payload: psRes.data || {} })
    throw new Error('Paystack amount does not match Membba payment amount')
  }

  await supabase.from('payments').update({ status: 'success' }).eq('paystack_reference', reference)

  let subscription = bundle.subscription
  let repaired = false

  if (!subscription) {
    const metadata = psRes.data.metadata || {}
    const platform = payment.communities?.platform || metadata.platform || 'telegram'
    const result = await createSubscription({
      communityId: payment.community_id || metadata.community_id,
      planId: payment.plan_id || metadata.plan_id,
      email: (payment.email || metadata.email || psRes.data.customer?.email || '').toLowerCase(),
      telegramUserId: platform === 'telegram'
        ? parseInt(payment.telegram_user_id || metadata.telegram_user_id || 0) || null
        : null,
      whatsappPhone: platform === 'whatsapp'
        ? String(payment.whatsapp_phone || metadata.whatsapp_phone || '').replace(/\D/g, '') || null
        : null,
      paystackReference: reference,
    })
    const { inviteLink, ...sub } = result
    subscription = sub
    repaired = true
    await logPaymentEvent({ reference, event: 'ops_subscription_repaired', status: 'success', message: 'Ops created missing subscription', payload: { subscription_id: sub.id, inviteLink: inviteLink || null } })
  } else {
    await logPaymentEvent({ reference, event: 'ops_verify_success', status: 'success', message: 'Payment already had subscription', payload: { subscription_id: subscription.id } })
  }

  return { success: true, payment_status: 'success', repaired, subscription }
}


function adminEmails() {
  return String(process.env.MEMBBA_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

async function getOpsUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return { user: null, error: 'unauthorized' }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { user: null, error: 'unauthorized' }

  const email = data.user.email?.toLowerCase()
  const allowed = adminEmails()
  if (!email || allowed.length === 0 || !allowed.includes(email)) {
    return { user: data.user, error: 'forbidden' }
  }

  return { user: data.user, error: null }
}

async function requireOps(req, res) {
  const { user, error } = await getOpsUser(req)
  if (!error) return user
  if (error === 'unauthorized') res.status(401).json({ message: 'Unauthorized' })
  else res.status(403).json({ message: 'This area is only for Membba operations admins.' })
  return null
}

// ─────────────────────────────────────────────────────
// GET /api/ops/summary
// Internal Membba operations summary.
// ─────────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  try {
    const [
      usersResult,
      { count: communities },
      { count: activeSubs },
      { count: openEscalations },
      { count: pendingPayments },
      { data: revenueRows },
    ] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from('communities').select('*', { count: 'exact', head: true }),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('ai_escalations').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('payments').select('amount').eq('status', 'success'),
    ])

    const revenue = (revenueRows || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)

    res.json({
      creators: usersResult.data?.users?.length || 0,
      communities: communities || 0,
      active_subscriptions: activeSubs || 0,
      open_escalations: openEscalations || 0,
      pending_payments: pendingPayments || 0,
      total_revenue: revenue,
    })
  } catch (err) {
    console.error('[ops/summary] error:', err.message)
    res.status(500).json({ message: 'Failed to load operations summary' })
  }
})

// ─────────────────────────────────────────────────────
// GET /api/ops/helpdesk
// Internal support queue for creator/customer operations.
// ─────────────────────────────────────────────────────
router.get('/helpdesk', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  try {
    const [
      { data: escalations, error: escErr },
      { data: payments, error: payErr },
      { data: communities, error: commErr },
      usersResult,
    ] = await Promise.all([
      supabase
        .from('ai_escalations')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('payments')
        .select('*, communities(name, slug, creator_id, platform), plans(name)')
        .in('status', ['pending', 'failed'])
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('communities')
        .select('id, creator_id, name, slug, platform, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.auth.admin.listUsers({ page: 1, perPage: 50 }),
    ])

    if (escErr || payErr || commErr) throw escErr || payErr || commErr

    const users = usersResult.data?.users || []
    const userById = new Map(users.map(u => [u.id, {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.email?.split('@')[0] || 'Creator',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }]))

    const creatorIds = [
      ...(communities || []).map(c => c.creator_id),
      ...(payments || []).map(p => p.communities?.creator_id),
    ].filter(Boolean)

    // Fetch missing creator profiles from auth admin if they were not in the first page.
    const missing = [...new Set(creatorIds)].filter(id => !userById.has(id))
    await Promise.all(missing.slice(0, 25).map(async id => {
      const { data } = await supabase.auth.admin.getUserById(id)
      if (data?.user) {
        const u = data.user
        userById.set(u.id, {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || u.email?.split('@')[0] || 'Creator',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        })
      }
    }))

    res.json({
      escalations: escalations || [],
      payments: (payments || []).map(p => ({ ...p, creator: userById.get(p.communities?.creator_id) || null })),
      communities: (communities || []).map(c => ({ ...c, creator: userById.get(c.creator_id) || null })),
      recent_creators: users.slice(0, 20).map(u => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || u.email?.split('@')[0] || 'Creator',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })),
    })
  } catch (err) {
    console.error('[ops/helpdesk] error:', err.message)
    res.status(500).json({ message: 'Failed to load helpdesk' })
  }
})


// ─────────────────────────────────────────────────────
// PATCH /api/ops/escalations/:id
// Update internal support metadata: status, assignee, priority.
// ─────────────────────────────────────────────────────
router.patch('/escalations/:id', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  const patch = {}
  if (req.body?.status) {
    patch.status = req.body.status
    if (req.body.status === 'resolved') patch.resolved_at = new Date().toISOString()
  }
  if (req.body?.assigned_to_email !== undefined) patch.assigned_to_email = req.body.assigned_to_email || null
  if (req.body?.priority) patch.priority = req.body.priority

  if (!Object.keys(patch).length) return res.status(400).json({ message: 'No updates provided' })

  try {
    const { data, error } = await supabase
      .from('ai_escalations')
      .update(patch)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json({ ok: true, escalation: data })
  } catch (err) {
    console.error('[ops/escalations/update] error:', err.message)
    res.status(500).json({ message: 'Failed to update escalation' })
  }
})

// ─────────────────────────────────────────────────────
// PATCH /api/ops/escalations/:id/resolve
// Operations-level resolve for any AI escalation.
// ─────────────────────────────────────────────────────
router.patch('/escalations/:id/resolve', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  try {
    const { data, error } = await supabase
      .from('ai_escalations')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json({ ok: true, escalation: data })
  } catch (err) {
    console.error('[ops/escalations/resolve] error:', err.message)
    res.status(500).json({ message: 'Failed to resolve escalation' })
  }
})



// ─────────────────────────────────────────────────────
// GET /api/ops/creators/:id
// Deep-dive creator profile for Membba operations.
// ─────────────────────────────────────────────────────
router.get('/creators/:id', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  const creatorId = req.params.id

  try {
    const [{ data: authUser }, { data: communities, error: commErr }, { data: settings }] = await Promise.all([
      supabase.auth.admin.getUserById(creatorId),
      supabase
        .from('communities')
        .select('id, creator_id, name, slug, platform, is_active, telegram_chat_id, whatsapp_group_id, whatsapp_group_invite_link, created_at')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false }),
      supabase
        .from('automation_settings')
        .select('*')
        .eq('creator_id', creatorId)
        .maybeSingle(),
    ])

    if (commErr) throw commErr
    if (!authUser?.user) return res.status(404).json({ message: 'Creator not found' })

    const communityIds = (communities || []).map(c => c.id)

    let payments = []
    let subscriptions = []
    let escalations = []

    if (communityIds.length) {
      const [{ data: payRows, error: payErr }, { data: subRows, error: subErr }] = await Promise.all([
        supabase
          .from('payments')
          .select('*, communities(name, slug, platform), plans(name)')
          .in('community_id', communityIds)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('subscriptions')
          .select('*, communities(name, slug, platform), plans(name)')
          .in('community_id', communityIds)
          .order('created_at', { ascending: false })
          .limit(100),
      ])
      if (payErr || subErr) throw payErr || subErr
      payments = payRows || []
      subscriptions = subRows || []

      const phones = [...new Set(subscriptions.map(s => s.whatsapp_phone).filter(Boolean))]
      if (phones.length) {
        const { data: escRows, error: escErr } = await supabase
          .from('ai_escalations')
          .select('*')
          .in('phone', phones)
          .order('created_at', { ascending: false })
          .limit(100)
        if (escErr) throw escErr
        escalations = escRows || []
      }
    }

    const { data: notes } = await supabase
      .from('ops_notes')
      .select('*')
      .eq('entity_type', 'creator')
      .eq('entity_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(r => r, () => ({ data: [] }))

    const user = authUser.user
    const totalRevenue = payments.filter(p => p.status === 'success').reduce((sum, p) => sum + Number(p.amount || 0), 0)

    res.json({
      creator: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Creator',
        phone: user.user_metadata?.phone || null,
        bio: user.user_metadata?.bio || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      summary: {
        communities: communities?.length || 0,
        payments: payments.length,
        successful_payments: payments.filter(p => p.status === 'success').length,
        pending_payments: payments.filter(p => p.status === 'pending').length,
        total_revenue: totalRevenue,
        subscriptions: subscriptions.length,
        active_subscriptions: subscriptions.filter(s => s.status === 'active').length,
        expired_subscriptions: subscriptions.filter(s => s.status === 'expired').length,
        open_escalations: escalations.filter(e => e.status === 'open').length,
      },
      communities: communities || [],
      payments,
      subscriptions,
      escalations,
      automation_settings: settings || null,
      notes: notes || [],
    })
  } catch (err) {
    console.error('[ops/creators/detail] error:', err.message)
    res.status(500).json({ message: err.message || 'Failed to load creator detail' })
  }
})

// ─────────────────────────────────────────────────────
// GET /api/ops/search?q=
// Search creators, communities, subscriptions/members, and payments.
// ─────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  const q = String(req.query.q || '').trim()
  if (q.length < 2) return res.status(400).json({ message: 'Search term must be at least 2 characters' })

  try {
    const qLike = `%${q}%`
    const digits = q.replace(/\D/g, '')

    const [usersResult, communitiesResult, paymentsResult, subsResult] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase
        .from('communities')
        .select('id, creator_id, name, slug, platform, is_active, created_at')
        .or(`name.ilike.${qLike},slug.ilike.${qLike}`)
        .limit(25),
      supabase
        .from('payments')
        .select('*, communities(name, slug, platform, creator_id), plans(name)')
        .or(`email.ilike.${qLike},paystack_reference.ilike.${qLike}${digits ? `,whatsapp_phone.ilike.%${digits}%` : ''}`)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('subscriptions')
        .select('*, communities(name, slug, platform, creator_id), plans(name)')
        .or(`email.ilike.${qLike}${digits ? `,whatsapp_phone.ilike.%${digits}%,telegram_user_id.eq.${digits}` : ''}`)
        .order('created_at', { ascending: false })
        .limit(25),
    ])

    if (communitiesResult.error || paymentsResult.error || subsResult.error) {
      throw communitiesResult.error || paymentsResult.error || subsResult.error
    }

    const users = usersResult.data?.users || []
    const creators = users
      .filter(u => {
        const email = u.email || ''
        const name = u.user_metadata?.name || ''
        return email.toLowerCase().includes(q.toLowerCase()) || name.toLowerCase().includes(q.toLowerCase())
      })
      .slice(0, 25)
      .map(u => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || u.email?.split('@')[0] || 'Creator',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }))

    const creatorIds = [
      ...(communitiesResult.data || []).map(c => c.creator_id),
      ...(paymentsResult.data || []).map(p => p.communities?.creator_id),
      ...(subsResult.data || []).map(su => su.communities?.creator_id),
    ].filter(Boolean)
    const userById = new Map(creators.map(c => [c.id, c]))
    await Promise.all([...new Set(creatorIds)].filter(id => !userById.has(id)).slice(0, 50).map(async id => {
      const { data } = await supabase.auth.admin.getUserById(id)
      if (data?.user) {
        const u = data.user
        userById.set(u.id, { id: u.id, email: u.email, name: u.user_metadata?.name || u.email?.split('@')[0] || 'Creator', created_at: u.created_at, last_sign_in_at: u.last_sign_in_at })
      }
    }))

    res.json({
      creators,
      communities: (communitiesResult.data || []).map(c => ({ ...c, creator: userById.get(c.creator_id) || null })),
      payments: (paymentsResult.data || []).map(p => ({ ...p, creator: userById.get(p.communities?.creator_id) || null })),
      subscriptions: (subsResult.data || []).map(sub => ({ ...sub, creator: userById.get(sub.communities?.creator_id) || null })),
    })
  } catch (err) {
    console.error('[ops/search] error:', err.message)
    res.status(500).json({ message: 'Search failed' })
  }
})

// ─────────────────────────────────────────────────────
// POST /api/ops/subscriptions/:id/extend { days }
// Extend a member subscription by N days.
// ─────────────────────────────────────────────────────
router.post('/subscriptions/:id/extend', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  const days = Math.max(1, Math.min(365, parseInt(req.body?.days || 30)))

  try {
    const sub = await getSubscriptionFull(req.params.id)
    if (!sub) return res.status(404).json({ message: 'Subscription not found' })

    const currentExpiry = new Date(sub.expires_at)
    const base = currentExpiry > new Date() ? currentExpiry : new Date()
    const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'active', expires_at: newExpiry.toISOString() })
      .eq('id', sub.id)
      .select('*, communities(name, slug, platform), plans(name)')
      .single()

    if (error) throw error

    await supabase.from('ops_notes').insert({
      entity_type: 'subscription',
      entity_id: sub.id,
      note: `Extended subscription by ${days} day(s). New expiry: ${newExpiry.toISOString()}`,
      created_by_email: opsUser.email,
    }).then(() => {}, () => {})

    res.json({ ok: true, subscription: data })
  } catch (err) {
    console.error('[ops/subscriptions/extend] error:', err.message)
    res.status(500).json({ message: err.message || 'Failed to extend subscription' })
  }
})

router.post('/subscriptions/:id/cancel', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  try {
    const sub = await getSubscriptionFull(req.params.id)
    if (!sub) return res.status(404).json({ message: 'Subscription not found' })

    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', sub.id)
      .select('*, communities(name, slug, platform), plans(name)')
      .single()
    if (error) throw error

    await supabase.from('ops_notes').insert({ entity_type: 'subscription', entity_id: sub.id, note: 'Subscription cancelled by ops.', created_by_email: opsUser.email }).then(() => {}, () => {})
    res.json({ ok: true, subscription: data })
  } catch (err) {
    console.error('[ops/subscriptions/cancel] error:', err.message)
    res.status(500).json({ message: err.message || 'Failed to cancel subscription' })
  }
})

router.post('/subscriptions/:id/resend-invite', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  try {
    const sub = await getSubscriptionFull(req.params.id)
    if (!sub) return res.status(404).json({ message: 'Subscription not found' })

    const result = await resendInviteForSubscription(sub)
    await supabase.from('ops_notes').insert({ entity_type: 'subscription', entity_id: sub.id, note: `Invite resent/queued by ops (${result.delivery}).`, created_by_email: opsUser.email }).then(() => {}, () => {})
    res.json({ ok: true, ...result, message: result.queued ? 'Invite queued for WhatsApp delivery.' : 'Invite resent.' })
  } catch (err) {
    console.error('[ops/subscriptions/resend-invite] error:', err.message)
    res.status(500).json({ message: err.message || 'Failed to resend invite' })
  }
})

// ─────────────────────────────────────────────────────
// Ops notes
// ─────────────────────────────────────────────────────
router.get('/notes', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  const { entity_type, entity_id } = req.query
  if (!entity_type || !entity_id) return res.status(400).json({ message: 'entity_type and entity_id are required' })

  try {
    const { data, error } = await supabase
      .from('ops_notes')
      .select('*')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('[ops/notes] error:', err.message)
    res.status(500).json({ message: 'Failed to load notes' })
  }
})

router.post('/notes', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  const { entity_type, entity_id, note } = req.body || {}
  if (!entity_type || !entity_id || !note?.trim()) return res.status(400).json({ message: 'entity_type, entity_id and note are required' })

  try {
    const { data, error } = await supabase
      .from('ops_notes')
      .insert({ entity_type, entity_id, note: note.trim(), created_by_email: opsUser.email })
      .select()
      .single()
    if (error) throw error
    res.json({ ok: true, note: data })
  } catch (err) {
    console.error('[ops/notes/create] error:', err.message)
    res.status(500).json({ message: 'Failed to save note' })
  }
})

// ─────────────────────────────────────────────────────
// GET /api/ops/payments/:reference
// Lookup one payment with linked subscription and event timeline.
// ─────────────────────────────────────────────────────
router.get('/payments/:reference', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  try {
    const bundle = await getPaymentBundle(req.params.reference)
    if (!bundle) return res.status(404).json({ message: 'Payment not found' })

    let creator = null
    const creatorId = bundle.payment?.communities?.creator_id
    if (creatorId) {
      const { data } = await supabase.auth.admin.getUserById(creatorId)
      if (data?.user) {
        creator = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Creator',
        }
      }
    }

    res.json({ ...bundle, creator })
  } catch (err) {
    console.error('[ops/payments/lookup] error:', err.message)
    res.status(500).json({ message: err.message || 'Failed to lookup payment' })
  }
})

// ─────────────────────────────────────────────────────
// POST /api/ops/payments/:reference/verify
// Verify with Paystack and repair missing subscription if needed.
// ─────────────────────────────────────────────────────
router.post('/payments/:reference/verify', async (req, res) => {
  const opsUser = await requireOps(req, res)
  if (!opsUser) return

  try {
    const result = await verifyAndRepairPayment(req.params.reference, opsUser.email)
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[ops/payments/verify] error:', err.message)
    await logPaymentEvent({ reference: req.params.reference, event: 'ops_verify_error', status: 'failed', message: err.message })
    res.status(500).json({ message: err.message || 'Failed to verify payment' })
  }
})

export default router
