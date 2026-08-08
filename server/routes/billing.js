import express from 'express'
import axios from 'axios'
import { supabase } from '../lib/supabase.js'

const router = express.Router()
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_BASE = 'https://api.paystack.co'

async function getCreatorId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error) return null
  return data?.user?.id || null
}

async function getUserEmail(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.email || null
}

router.get('/cards', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ message: 'Unauthorized' })

  const { data, error } = await supabase
    .from('billing_payment_methods')
    .select('id, brand, last4, exp_month, exp_year, bank, reusable, is_default, created_at')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ message: error.message })
  res.json(data || [])
})

router.post('/cards/initialize', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ message: 'Unauthorized' })
  if (!PAYSTACK_SECRET) return res.status(500).json({ message: 'Paystack is not configured' })

  const email = await getUserEmail(req)
  if (!email) return res.status(400).json({ message: 'Could not determine user email' })

  try {
    const origin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173'
    const { data: psRes } = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount: 10000, // ₦100 authorization transaction; use Paystack authorization for future billing.
        currency: 'NGN',
        callback_url: `${origin}/dashboard/settings?tab=billing&billing=payment`,
        metadata: {
          purpose: 'membba_add_card',
          creator_id: creatorId,
        },
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    )

    if (!psRes.status) return res.status(502).json({ message: psRes.message || 'Could not initialize card setup' })
    res.json({ authorization_url: psRes.data.authorization_url, reference: psRes.data.reference })
  } catch (err) {
    console.error('[billing/cards/initialize] error:', err.message)
    res.status(500).json({ message: 'Could not initialize card setup' })
  }
})

router.get('/cards/verify/:reference', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ message: 'Unauthorized' })
  if (!PAYSTACK_SECRET) return res.status(500).json({ message: 'Paystack is not configured' })

  const { reference } = req.params

  try {
    const { data: existing } = await supabase
      .from('billing_payment_methods')
      .select('id, brand, last4, exp_month, exp_year, bank, reusable, is_default, created_at')
      .eq('paystack_reference', reference)
      .eq('creator_id', creatorId)
      .maybeSingle()

    if (existing) return res.json({ success: true, already_saved: true, card: existing })

    const { data: psRes } = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    )

    if (!psRes.status || psRes.data.status !== 'success') {
      const paystackStatus = psRes.data?.status || 'unknown'
      const terminalFailure = ['failed', 'abandoned', 'reversed'].includes(paystackStatus)
      return res.status(terminalFailure ? 200 : 202).json({
        success: false,
        pending: !terminalFailure,
        payment_status: paystackStatus,
        message: terminalFailure
          ? (psRes.message || 'Card authorization was not successful')
          : 'Card authorization is still being confirmed by Paystack.',
      })
    }

    const meta = psRes.data.metadata || {}
    if (meta.purpose !== 'membba_add_card' || meta.creator_id !== creatorId) {
      return res.status(400).json({ success: false, message: 'This transaction is not a Membba card setup transaction' })
    }

    const auth = psRes.data.authorization || {}
    if (!auth.authorization_code) {
      return res.status(400).json({ success: false, message: 'Paystack did not return a reusable authorization for this card' })
    }

    const { count } = await supabase
      .from('billing_payment_methods')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)

    const payload = {
      creator_id: creatorId,
      paystack_reference: reference,
      authorization_code: auth.authorization_code,
      brand: auth.card_type || auth.brand || 'card',
      last4: auth.last4 || null,
      exp_month: auth.exp_month || null,
      exp_year: auth.exp_year || null,
      bank: auth.bank || null,
      reusable: auth.reusable !== false,
      is_default: !count,
    }

    const { data, error } = await supabase
      .from('billing_payment_methods')
      .insert(payload)
      .select('id, brand, last4, exp_month, exp_year, bank, reusable, is_default, created_at')
      .single()

    if (error) throw error
    res.json({ success: true, card: data })
  } catch (err) {
    console.error('[billing/cards/verify] error:', err.message)
    res.status(500).json({ success: false, message: err.message || 'Could not verify card setup' })
  }
})

router.delete('/cards/:id', async (req, res) => {
  const creatorId = await getCreatorId(req)
  if (!creatorId) return res.status(401).json({ message: 'Unauthorized' })

  const { error } = await supabase
    .from('billing_payment_methods')
    .delete()
    .eq('id', req.params.id)
    .eq('creator_id', creatorId)

  if (error) return res.status(500).json({ message: error.message })
  res.json({ ok: true })
})

export default router
