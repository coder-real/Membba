import express from 'express'
import { getMetaWhatsAppStatus, parseMetaWebhook, verifyMetaWebhookQuery, markMetaWhatsAppMessageRead } from '../services/metaWhatsApp.js'
import { sendWhatsAppProviderMessage } from '../services/whatsappProvider.js'
import { getAIReplyDetailed } from '../services/ai.js'
import { supabase } from '../lib/supabase.js'

const router = express.Router()

async function getUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error) return null
  return data?.user?.id || null
}

router.get('/status', (_req, res) => {
  res.json(getMetaWhatsAppStatus())
})

// Meta webhook verification endpoint.
router.get('/webhook', (req, res) => {
  const result = verifyMetaWebhookQuery(req.query)
  if (result.ok) return res.status(200).send(result.challenge)
  return res.sendStatus(403)
})

// Meta incoming messages/status webhook.
router.post('/webhook', async (req, res) => {
  res.sendStatus(200)

  const { messages, statuses } = parseMetaWebhook(req.body)
  if (statuses.length) {
    console.log(`[meta] received ${statuses.length} message status update(s)`)
  }

  for (const msg of messages) {
    if (!msg.from || !msg.text) continue
    console.log(`[meta] incoming WhatsApp DM from ${msg.from}: ${msg.text.slice(0, 80)}`)

    try {
      await markMetaWhatsAppMessageRead(msg.id).catch(() => {})
      const result = await getAIReplyDetailed(msg.from, msg.text)
      await sendWhatsAppProviderMessage(msg.from, result.reply)
      console.log(`[meta] AI replied to ${msg.from} intent=${result.intent}`)
    } catch (err) {
      console.error('[meta] webhook message handling failed:', err.message)
    }
  }
})

// Test/send route for internal diagnostics.
router.post('/send-test', async (req, res) => {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  const { to, text } = req.body || {}
  if (!to || !text) return res.status(400).json({ message: 'to and text are required' })

  try {
    const data = await sendWhatsAppProviderMessage(to, text)
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message })
  }
})

export default router
