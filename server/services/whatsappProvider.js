import { sendMetaWhatsAppText, getMetaWhatsAppStatus } from './metaWhatsApp.js'
import { sendWhatsAppMessage as sendBaileysMessage, getWhatsAppStatus as getBaileysStatus } from './whatsapp.js'

export function getWhatsAppProviderMode() {
  return process.env.WHATSAPP_PROVIDER || 'baileys'
}

export function getWhatsAppProviderStatus() {
  const mode = getWhatsAppProviderMode()
  const meta = getMetaWhatsAppStatus()
  const baileys = { status: getBaileysStatus() }

  return {
    mode,
    meta,
    baileys,
    canSendOfficial: meta.configured,
    canUseGroupAutomation: baileys.status === 'connected',
  }
}

export async function sendWhatsAppProviderMessage(phone, text, opts = {}) {
  const mode = getWhatsAppProviderMode()

  if (mode === 'meta') {
    return sendMetaWhatsAppText({ to: phone, text, previewUrl: opts.previewUrl ?? true })
  }

  if (mode === 'hybrid') {
    const meta = getMetaWhatsAppStatus()
    if (meta.configured) {
      return sendMetaWhatsAppText({ to: phone, text, previewUrl: opts.previewUrl ?? true })
    }
    return sendBaileysMessage(phone, text)
  }

  return sendBaileysMessage(phone, text)
}
