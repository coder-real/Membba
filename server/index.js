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
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))

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

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
)

// ── Cron: process expired subscriptions every minute ──
cron.schedule('* * * * *', async () => {
  console.log('[cron] checking expired subscriptions...')
  try {
    const count = await processExpiredSubscriptions()
    if (count > 0) console.log(`[cron] expired ${count} subscription(s)`)
  } catch (err) {
    console.error('[cron] error:', err.message)
  }
})

// ── Start ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Membba server running on http://localhost:${PORT}`)

  // Telegram bot: use webhook in production, long-polling in local dev
  if (process.env.SERVER_URL) {
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
