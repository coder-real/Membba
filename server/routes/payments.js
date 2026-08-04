import express from 'express'
import crypto from 'crypto'
import axios from 'axios'
import { supabase } from '../lib/supabase.js'
import { createSubscription } from '../services/subscription.js'
import { checkBotAdminStatus } from '../services/telegram.js'

const router = express.Router()

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_BASE = 'https://api.paystack.co'

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '')
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function logPaymentEvent({ reference = null, event, status = 'info', message = null, payload = {} }) {
  try {
    const { error } = await supabase.from('payment_events').insert({
      paystack_reference: reference,
      event,
      status,
      message,
      payload,
    })
    if (error) console.warn('[payments] event log skipped:', error.message)
  } catch (err) {
    console.warn('[payments] event log skipped:', err.message)
  }
}

function requirePaystack(res) {
  if (PAYSTACK_SECRET) return true
  res.status(500).json({ message: 'Paystack is not configured' })
  return false
}

async function getPaymentByReference(reference) {
  const { data, error } = await supabase
    .from('payments')
    .select('*, plans(id, price, duration_minutes), communities(id, name, slug, platform)')
    .eq('paystack_reference', reference)
    .maybeSingle()

  if (error) throw error
  return data || null
}

// ─────────────────────────────────────────────────────
// POST /api/payments/initialize
// Looks up plan price from DB (never trust frontend price).
// ─────────────────────────────────────────────────────
router.post('/initialize', async (req, res) => {
  if (!requirePaystack(res)) return

  const email = normalizeEmail(req.body.email)
  const { plan_id } = req.body
  const telegram_user_id = String(req.body.telegram_user_id || '').trim()
  const whatsapp_phone = normalizePhone(req.body.whatsapp_phone)

  if (!plan_id || !email) {
    return res.status(400).json({ message: 'plan_id and email are required' })
  }
  if (!validEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address' })
  }

  try {
    const { data: plan, error: planErr } = await supabase
      .from('plans')
      .select('*, communities(id, name, slug, platform, telegram_chat_id, whatsapp_group_invite_link, whatsapp_group_id, is_active)')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()

    if (planErr || !plan || !plan.communities?.is_active) {
      return res.status(404).json({ message: 'Plan not found or inactive' })
    }

    const community = plan.communities
    const platform = community.platform || 'telegram'

    if (platform === 'whatsapp') {
      if (!whatsapp_phone) return res.status(400).json({ message: 'WhatsApp phone number is required' })
      if (!/^\d{10,15}$/.test(whatsapp_phone)) {
        return res.status(400).json({ message: 'Enter WhatsApp number with country code, no + or spaces' })
      }
    } else if (platform === 'telegram') {
      if (!telegram_user_id) return res.status(400).json({ message: 'Telegram User ID is required' })
      if (!/^\d+$/.test(telegram_user_id)) {
        return res.status(400).json({ message: 'Telegram User ID must be a number' })
      }
    }

    const amountKobo = Math.round(Number(plan.price) * 100)

    // Use the browser origin that initialized payment so Arena/Vercel callbacks
    // return to the correct visible app URL instead of sandbox-local localhost.
    const clientUrl = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173'

    const { data: psRes } = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount: amountKobo,
        currency: plan.currency || 'NGN',
        callback_url: `${clientUrl}/payment/success`,
        metadata: {
          plan_id: plan.id,
          community_id: community.id,
          telegram_user_id: platform === 'telegram' ? telegram_user_id : null,
          whatsapp_phone: platform === 'whatsapp' ? whatsapp_phone : null,
          platform,
          email,
          community_slug: community.slug,
        },
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    )

    if (!psRes.status) {
      await logPaymentEvent({ event: 'initialize_failed', status: 'failed', message: psRes.message, payload: psRes })
      return res.status(502).json({ message: psRes.message || 'Paystack initialization failed' })
    }

    const reference = psRes.data.reference

    const { error: insertErr } = await supabase.from('payments').insert({
      community_id: community.id,
      plan_id: plan.id,
      email,
      telegram_user_id: platform === 'telegram' ? parseInt(telegram_user_id) : null,
      whatsapp_phone: platform === 'whatsapp' ? whatsapp_phone : null,
      paystack_reference: reference,
      amount: plan.price,
      status: 'pending',
    })

    if (insertErr) throw insertErr

    await logPaymentEvent({ reference, event: 'initialize_success', status: 'success', message: 'Paystack transaction initialized', payload: { plan_id, community_id: community.id, platform } })

    return res.json({ authorization_url: psRes.data.authorization_url, reference })
  } catch (err) {
    console.error('[initialize] error:', err.message)
    await logPaymentEvent({ event: 'initialize_error', status: 'failed', message: err.message })
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─────────────────────────────────────────────────────
// POST /api/payments/webhook
// Paystack HMAC-verified event handler.
// ─────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  if (!PAYSTACK_SECRET) return res.status(500).send('Paystack not configured')

  let peekEvent
  try { peekEvent = JSON.parse(req.body.toString()) } catch { peekEvent = null }
  console.log('[webhook] hit:', peekEvent?.event || '(unparseable)', '| ref:', peekEvent?.data?.reference || 'n/a', '| ip:', req.ip)

  const signature = req.headers['x-paystack-signature']
  const rawBody = req.body

  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex')

  if (hash !== signature) {
    console.warn('[webhook] invalid signature — rejected')
    await logPaymentEvent({ reference: peekEvent?.data?.reference, event: 'webhook_invalid_signature', status: 'failed', payload: peekEvent || {} })
    return res.status(401).send('Invalid signature')
  }

  const event = JSON.parse(rawBody.toString())
  const reference = event?.data?.reference
  await logPaymentEvent({ reference, event: `webhook_${event.event}`, status: 'success', payload: event.data || {} })

  if (event.event !== 'charge.success') {
    if (reference && event?.data?.status === 'failed') {
      await supabase.from('payments').update({ status: 'failed' }).eq('paystack_reference', reference)
    }
    return res.sendStatus(200)
  }

  const { metadata, customer, amount, currency } = event.data
  const { plan_id, community_id, telegram_user_id, whatsapp_phone, email: metaEmail } = metadata || {}
  const email = normalizeEmail(metaEmail || customer?.email)

  res.sendStatus(200)

  handleSuccessfulPayment({ reference, plan_id, community_id, telegram_user_id, whatsapp_phone, email, amountKobo: amount, currency })
    .catch(err => console.error('[webhook] handleSuccessfulPayment failed:', err.message))
})

// ─────────────────────────────────────────────────────
// GET /api/payments/verify/:reference
// Fallback for when webhook is delayed or missed.
// ─────────────────────────────────────────────────────
router.get('/verify/:reference', async (req, res) => {
  if (!requirePaystack(res)) return

  const { reference } = req.params

  try {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id, status, expires_at, communities(name, slug, platform)')
      .eq('paystack_reference', reference)
      .maybeSingle()

    if (existing) {
      return res.json({
        success: true,
        already_processed: true,
        subscription: existing,
        platform: existing.communities?.platform || 'telegram',
        invite_link: null,
      })
    }

    const { data: psRes } = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    )

    if (!psRes.status || psRes.data.status !== 'success') {
      await supabase.from('payments').update({ status: 'failed' }).eq('paystack_reference', reference)
      await logPaymentEvent({ reference, event: 'verify_not_success', status: 'failed', message: psRes.message, payload: psRes.data || {} })
      return res.json({ success: false, message: psRes.message || 'Payment was not successful' })
    }

    const { metadata, customer, amount, currency } = psRes.data
    const { plan_id, community_id, telegram_user_id, whatsapp_phone, platform, email: metaEmail } = metadata || {}
    const email = normalizeEmail(metaEmail || customer?.email)

    const result = await handleSuccessfulPayment({ reference, plan_id, community_id, telegram_user_id, whatsapp_phone, email, amountKobo: amount, currency })

    return res.json({
      success: true,
      subscription: result.subscription,
      invite_link: result.inviteLink || null,
      platform: platform || result.platform || 'telegram',
    })
  } catch (err) {
    console.error('[verify] error:', err.message)
    await logPaymentEvent({ reference, event: 'verify_error', status: 'failed', message: err.message })
    return res.status(500).json({ success: false, message: 'Verification error' })
  }
})

// ─────────────────────────────────────────────────────
// GET /api/payments/telegram-check/:chatId
// Called by dashboard to check if bot is admin in the group.
// ─────────────────────────────────────────────────────
router.get('/telegram-check/:chatId', async (req, res) => {
  const chatId = parseInt(req.params.chatId)
  if (!chatId) return res.status(400).json({ ok: false, message: 'Invalid chatId' })

  const isAdmin = await checkBotAdminStatus(chatId)
  return res.json({ ok: isAdmin, chatId })
})

// ─────────────────────────────────────────────────────
// Shared: mark payment success + create subscription
// Returns { subscription, inviteLink }
// ─────────────────────────────────────────────────────
async function handleSuccessfulPayment({ reference, plan_id, community_id, telegram_user_id, whatsapp_phone, email, amountKobo, currency }) {
  const existingPayment = await getPaymentByReference(reference)

  const planId = plan_id || existingPayment?.plan_id
  const communityId = community_id || existingPayment?.community_id
  const resolvedEmail = normalizeEmail(email || existingPayment?.email)
  const resolvedTelegramUserId = telegram_user_id || existingPayment?.telegram_user_id
  const resolvedWhatsappPhone = normalizePhone(whatsapp_phone || existingPayment?.whatsapp_phone)

  if (!planId || !communityId || !resolvedEmail) {
    throw new Error('Missing payment metadata for subscription creation')
  }

  if (existingPayment && amountKobo) {
    const expectedKobo = Math.round(Number(existingPayment.amount) * 100)
    if (Number(amountKobo) !== expectedKobo) {
      await logPaymentEvent({ reference, event: 'amount_mismatch', status: 'failed', message: `Expected ${expectedKobo}, got ${amountKobo}`, payload: { expectedKobo, amountKobo, currency } })
      throw new Error('Payment amount mismatch')
    }
  }

  await supabase
    .from('payments')
    .update({ status: 'success' })
    .eq('paystack_reference', reference)

  const result = await createSubscription({
    communityId,
    planId,
    email: resolvedEmail,
    telegramUserId: resolvedTelegramUserId ? parseInt(resolvedTelegramUserId) : null,
    whatsappPhone: resolvedWhatsappPhone || null,
    paystackReference: reference,
  })

  await logPaymentEvent({ reference, event: 'subscription_created', status: 'success', message: 'Subscription processed after successful payment', payload: { subscription_id: result.id, communityId, planId } })

  const { inviteLink, ...subscription } = result
  return { subscription, inviteLink, platform: existingPayment?.communities?.platform }
}

export default router
