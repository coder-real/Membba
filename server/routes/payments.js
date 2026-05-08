import express from 'express'
import crypto from 'crypto'
import axios from 'axios'
import { supabase } from '../lib/supabase.js'
import { createSubscription } from '../services/subscription.js'
import { checkBotAdminStatus } from '../services/telegram.js'

const router = express.Router()

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_BASE = 'https://api.paystack.co'

// ─────────────────────────────────────────────────────
// POST /api/payments/initialize
// Looks up plan price from DB (never trust frontend price).
// ─────────────────────────────────────────────────────
router.post('/initialize', async (req, res) => {
  const { plan_id, email, telegram_user_id, whatsapp_phone } = req.body

  if (!plan_id || !email) {
    return res.status(400).json({ message: 'plan_id and email are required' })
  }

  try {
    const { data: plan, error: planErr } = await supabase
      .from('plans')
      .select('*, communities(id, name, slug, platform, telegram_chat_id)')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()

    if (planErr || !plan) {
      return res.status(404).json({ message: 'Plan not found or inactive' })
    }

    const community = plan.communities
    const amountKobo = Math.round(plan.price * 100) // Paystack uses kobo

    const { data: psRes } = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount: amountKobo,
        currency: plan.currency || 'NGN',
        callback_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/success`,
        metadata: {
          plan_id: plan.id,
          community_id: community.id,
          telegram_user_id: telegram_user_id || null,
          whatsapp_phone: whatsapp_phone || null,
          platform: community.platform || 'telegram',
          email,
        },
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    )

    if (!psRes.status) {
      return res.status(502).json({ message: psRes.message || 'Paystack initialization failed' })
    }

    const reference = psRes.data.reference

    await supabase.from('payments').insert({
      community_id: community.id,
      plan_id: plan.id,
      email,
      telegram_user_id: telegram_user_id ? parseInt(telegram_user_id) : null,
      whatsapp_phone: whatsapp_phone || null,
      paystack_reference: reference,
      amount: plan.price,
      status: 'pending',
    })

    return res.json({ authorization_url: psRes.data.authorization_url, reference })
  } catch (err) {
    console.error('[initialize] error:', err.message)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─────────────────────────────────────────────────────
// POST /api/payments/webhook
// Paystack HMAC-verified event handler.
// CRITICAL: verify signature — skip and anyone can fake a payment.
// ─────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-paystack-signature']
  const rawBody = req.body // express.raw() Buffer

  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex')

  if (hash !== signature) {
    console.warn('[webhook] invalid signature — rejected')
    return res.status(401).send('Invalid signature')
  }

  const event = JSON.parse(rawBody.toString())

  if (event.event !== 'charge.success') {
    return res.sendStatus(200)
  }

  const { reference, metadata, customer } = event.data
  const { plan_id, community_id, telegram_user_id, whatsapp_phone, email: metaEmail } = metadata || {}
  const email = metaEmail || customer?.email

  res.sendStatus(200) // respond immediately

  handleSuccessfulPayment({ reference, plan_id, community_id, telegram_user_id, whatsapp_phone, email })
    .catch(err => console.error('[webhook] handleSuccessfulPayment failed:', err.message))
})

// ─────────────────────────────────────────────────────
// GET /api/payments/verify/:reference
// Fallback for when webhook is delayed or missed.
// Called by PaymentSuccessPage on load — returns invite_link for display.
// ─────────────────────────────────────────────────────
router.get('/verify/:reference', async (req, res) => {
  const { reference } = req.params

  try {
    // Idempotency check — webhook may have already processed this
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id, status, expires_at, communities(name, slug)')
      .eq('paystack_reference', reference)
      .maybeSingle()

    if (existing) {
      return res.json({
        success: true,
        already_processed: true,
        subscription: existing,
        invite_link: null, // was already sent via Telegram DM by webhook handler
      })
    }

    // Verify with Paystack API
    const { data: psRes } = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    )

    if (!psRes.status || psRes.data.status !== 'success') {
      return res.json({ success: false, message: psRes.message })
    }

    const { metadata, customer } = psRes.data
    const { plan_id, community_id, telegram_user_id, whatsapp_phone, platform, email: metaEmail } = metadata || {}
    const email = metaEmail || customer?.email

    const result = await handleSuccessfulPayment({ reference, plan_id, community_id, telegram_user_id, whatsapp_phone, email })

    return res.json({
      success: true,
      subscription: result.subscription,
      invite_link: result.inviteLink || null,
      platform: platform || 'telegram',
    })
  } catch (err) {
    console.error('[verify] error:', err.message)
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
async function handleSuccessfulPayment({ reference, plan_id, community_id, telegram_user_id, whatsapp_phone, email }) {
  await supabase
    .from('payments')
    .update({ status: 'success' })
    .eq('paystack_reference', reference)

  const result = await createSubscription({
    communityId: community_id,
    planId: plan_id,
    email,
    telegramUserId: telegram_user_id ? parseInt(telegram_user_id) : null,
    whatsappPhone: whatsapp_phone || null,
    paystackReference: reference,
  })

  const { inviteLink, ...subscription } = result
  return { subscription, inviteLink }
}

export default router
