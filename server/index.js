import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import paymentsRouter from './routes/payments.js'
import botRouter from './routes/bot.js'
import membersRouter from './routes/members.js'
import whatsappRouter from './routes/whatsapp.js'
import telegramRouter from './routes/telegram.js'
import { processExpiredSubscriptions } from './services/subscription.js'
import { startPolling, stopPolling } from './services/botPoller.js'
import { registerWebhook } from './services/botWebhook.js'
import { initWhatsApp } from './services/whatsapp.js'
import { sendMorningDigest } from './services/digest.js'
import { processScheduledPosts } from './services/scheduler.js'
import automationsRouter from './routes/automations.js'
import aiRouter from './routes/ai.js'
import opsRouter from './routes/ops.js'
import billingRouter from './routes/billing.js'

// ── Global Error Catchers to prevent crashes ──────────────────────────────
// Prevents the entire Node server from crashing if whatsapp-web.js throws
// synchronous EBUSY file-lock errors on Windows during session cleanup.
process.on('uncaughtException', err => {
  console.error('[fatal] uncaught exception prevented crash:', err.message)
})
process.on('unhandledRejection', reason => {
  console.error('[fatal] unhandled rejection prevented crash:', reason)
})

// ── Graceful shutdown — stop Telegram poller before exit ──────────────────
// Prevents 409 Conflict on next startup by ensuring the old getUpdates
// long-poll loop is stopped before Node process terminates.
const shutdown = (signal) => {
  console.log(`[server] ${signal} received — stopping Telegram poller and exiting`)
  stopPolling()
  process.exit(0)
}
process.on('SIGINT',  () => shutdown('SIGINT'))   // Ctrl+C in terminal
process.on('SIGTERM', () => shutdown('SIGTERM'))  // Render / Docker stop

// .env is loaded via --env-file flag in the npm scripts (see package.json)

const app = express()
const PORT = process.env.PORT || 3001

// ── Middleware ────────────────────────────────────────
// Allow multiple frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://membba-73xo.vercel.app',
  process.env.CLIENT_URL
].filter(Boolean)

app.use(cors({ origin: allowedOrigins }))

// Raw body for Paystack webhook HMAC verification — must come BEFORE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))

// JSON body for all other routes
app.use(express.json())

// ── Routes ────────────────────────────────────────────
app.use('/api/payments', paymentsRouter)
app.use('/api/bot', botRouter)
app.use('/api/members', membersRouter)
app.use('/api/whatsapp', whatsappRouter)
app.use('/api/telegram', telegramRouter)
app.use('/api/automations', automationsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/ops', opsRouter)
app.use('/api/billing', billingRouter)

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
)

// ── Manual digest trigger (for testing) ──────────────────
app.post('/api/digest/now', async (_req, res) => {
  try {
    await sendMorningDigest()
    res.json({ ok: true, message: 'Digest sent to admin WhatsApp' })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Cron: process expired subscriptions + scheduled posts ─────────────────
// Disable in local testing with DISABLE_CRON=true to avoid accidentally
// removing real members while validating WhatsApp/AI connectivity.
if (process.env.DISABLE_CRON === 'true') {
  console.log('[cron] disabled — DISABLE_CRON=true')
} else {
  // Every minute: expire subscriptions + send due scheduled posts
  cron.schedule('* * * * *', async () => {
    try {
      const expired = await processExpiredSubscriptions()
      if (expired > 0) console.log(`[cron] expired ${expired} subscription(s)`)
      const sent = await processScheduledPosts()
      if (sent > 0) console.log(`[cron] sent ${sent} scheduled post(s)`)
    } catch (err) {
      console.error('[cron] error:', err.message)
    }
  })

  // Morning admin digest at 8am WAT (UTC+1 = 07:00 UTC)
  cron.schedule('0 7 * * *', async () => {
    console.log('[cron] sending morning digest...')
    try {
      await sendMorningDigest()
    } catch (err) {
      console.error('[cron] digest error:', err.message)
    }
  })
}

app.listen(PORT, () => {
  console.log(`Membba server running on http://localhost:${PORT}`)

  // Telegram bot: use webhook in production, long-polling in local dev.
  // Disable in WhatsApp/AI-only testing with DISABLE_TELEGRAM=true so local
  // startup does not delete or replace a production Telegram webhook.
  if (process.env.DISABLE_TELEGRAM === 'true') {
    console.log('[bot] disabled — DISABLE_TELEGRAM=true')
  } else if (process.env.SERVER_URL) {
    registerWebhook(process.env.SERVER_URL).catch(err =>
      console.error('[bot] webhook registration failed:', err.message)
    )
  } else {
    startPolling()
  }

  // WhatsApp client (only starts if ENABLE_WHATSAPP=true in .env)
  // Chromium takes ~10s to start — this is intentionally non-blocking
  if (process.env.ENABLE_WHATSAPP === 'true') {
    initWhatsApp().catch(err => console.error('[whatsapp] init error:', err.message))
  } else {
    console.log('[whatsapp] disabled — set ENABLE_WHATSAPP=true in .env to enable')
  }
})

export default app
