import axios from 'axios'

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v20.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

function config() {
  return {
    token: process.env.META_WHATSAPP_TOKEN,
    phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: process.env.META_WHATSAPP_VERIFY_TOKEN,
  }
}

export function getMetaWhatsAppStatus() {
  const { token, phoneNumberId, verifyToken } = config()
  return {
    configured: Boolean(token && phoneNumberId && verifyToken),
    phone_number_id: phoneNumberId || null,
    graph_version: GRAPH_VERSION,
  }
}

export function normalizeWhatsAppPhone(phone) {
  return String(phone || '').replace(/\D/g, '')
}

export async function sendMetaWhatsAppText({ to, text, previewUrl = true }) {
  const { token, phoneNumberId } = config()
  if (!token || !phoneNumberId) throw new Error('Meta WhatsApp is not configured')

  const recipient = normalizeWhatsAppPhone(to)
  if (!recipient) throw new Error('Recipient WhatsApp phone is required')
  if (!text?.trim()) throw new Error('Message text is required')

  const { data } = await axios.post(
    `${GRAPH_BASE}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: text,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return data
}

export async function markMetaWhatsAppMessageRead(messageId) {
  const { token, phoneNumberId } = config()
  if (!token || !phoneNumberId || !messageId) return null

  const { data } = await axios.post(
    `${GRAPH_BASE}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return data
}

export function parseMetaWebhook(body) {
  const entries = body?.entry || []
  const messages = []
  const statuses = []

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {}
      for (const msg of value.messages || []) {
        const text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ''
        messages.push({
          id: msg.id,
          from: normalizeWhatsAppPhone(msg.from),
          type: msg.type,
          text,
          timestamp: msg.timestamp,
          profileName: value.contacts?.find(c => c.wa_id === msg.from)?.profile?.name || null,
          raw: msg,
        })
      }
      for (const status of value.statuses || []) {
        statuses.push(status)
      }
    }
  }

  return { messages, statuses }
}

export function verifyMetaWebhookQuery(query) {
  const { verifyToken } = config()
  const mode = query['hub.mode']
  const token = query['hub.verify_token']
  const challenge = query['hub.challenge']

  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return { ok: true, challenge }
  }
  return { ok: false }
}
