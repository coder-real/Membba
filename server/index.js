import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import paymentsRouter from './routes/payments.js'
import botRouter from './routes/bot.js'
import membersRouter from './routes/members.js'
import whatsappRouter from './routes/whatsapp.js'
import { processExpiredSubscriptions } from './services/subscription.js'
import { startPolling } from './services/botPoller.js'
import { initWhatsApp } from './services/whatsapp.js'

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

  // Telegram bot long-polling
  startPolling()

  // WhatsApp client (only starts if ENABLE_WHATSAPP=true in .env)
  // Chromium takes ~10s to start — this is intentionally non-blocking
  if (process.env.ENABLE_WHATSAPP === 'true') {
    initWhatsApp().catch(err => console.error('[whatsapp] init error:', err.message))
  } else {
    console.log('[whatsapp] disabled — set ENABLE_WHATSAPP=true in .env to enable')
  }
})

export default app
