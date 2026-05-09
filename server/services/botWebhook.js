import axios from 'axios'

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

/**
 * Register the Telegram webhook pointing to this server.
 * Call this once on startup in production (when SERVER_URL is set).
 *
 * Webhook URL will be: {serverUrl}/api/bot/webhook
 */
export async function registerWebhook(serverUrl) {
  const webhookUrl = `${serverUrl}/api/bot/webhook`

  // First delete any leftover polling conflict
  try {
    await axios.post(`${BASE}/deleteWebhook`, { drop_pending_updates: false })
  } catch (_) { /* ignore */ }

  const { data } = await axios.post(`${BASE}/setWebhook`, {
    url: webhookUrl,
    allowed_updates: ['message'],
  })

  if (data.ok) {
    console.log(`[bot] webhook registered → ${webhookUrl}`)
  } else {
    throw new Error(`setWebhook failed: ${JSON.stringify(data)}`)
  }
}
