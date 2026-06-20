import pkg from 'whatsapp-web.js'
const { Client, RemoteAuth, LocalAuth } = pkg
import puppeteer from 'puppeteer'
import qrcode from 'qrcode'
import { supabase } from '../lib/supabase.js'

// ── Supabase-backed session store for RemoteAuth ──────────────────────────
// whatsapp-web.js calls save/extract/delete with { session, data }
// where `data` is a Buffer (zip of the .wwebjs_auth folder).
class SupabaseStore {
  async sessionExists({ session }) {
    const { data } = await supabase
      .from('whatsapp_sessions')
      .select('id')
      .eq('id', session)
      .maybeSingle()
    return !!data
  }

  async save({ session, data }) {
    const encoded = Buffer.isBuffer(data) ? data.toString('base64') : data
    await supabase.from('whatsapp_sessions').upsert({
      id: session,
      session: encoded,
      updated_at: new Date().toISOString(),
    })
  }

  async extract({ session }) {
    const { data } = await supabase
      .from('whatsapp_sessions')
      .select('session')
      .eq('id', session)
      .single()
    if (!data) return null
    return Buffer.from(data.session, 'base64')
  }

  async delete({ session }) {
    await supabase.from('whatsapp_sessions').delete().eq('id', session)
  }
}

let currentQR = null
let status = 'initializing' // 'initializing' | 'awaiting_qr' | 'authenticated'
let client = null

// Random delay — reduces WhatsApp ban risk
const delay = ms => new Promise(r => setTimeout(r, ms))
const randomDelay = () => delay(Math.random() * 3000 + 1000) // 1–4 seconds

export function getWhatsAppStatus() { return status }
export function getWhatsAppQR() { return currentQR }

export async function restartWhatsApp() {
  console.log('[whatsapp] restarting client...')
  
  // Track the PID so we can explicitly force-kill it later
  // Windows sometimes leaves zombie Chrome processes holding filesystem locks.
  const pidToKill = client?.pupBrowser?.process()?.pid
  if (pidToKill) {
    console.log(`[whatsapp-debug] tracking chromium PID: ${pidToKill} for cleanup`)
  }

  if (client) {
    console.log('[whatsapp-debug] calling client.destroy()...')
    try {
      await client.destroy()
      console.log('[whatsapp-debug] client.destroy() completed')
    } catch (e) {
      console.warn('[whatsapp-debug] error terminating previous client:', e.message)
    }
    client = null
  }

  // Force-kill the process if it's still alive to release file locks on Windows
  if (pidToKill) {
    console.log(`[whatsapp-debug] asserting death of chromium PID: ${pidToKill}...`)
    try {
      process.kill(pidToKill, 'SIGKILL')
      console.log(`[whatsapp-debug] sent SIGKILL to zombie chromium PID: ${pidToKill}`)
    } catch (err) {
      console.log(`[whatsapp-debug] chromium PID: ${pidToKill} was already dead`)
    }
  }

  status = 'initializing'
  currentQR = null

  // Give Windows a brief moment to naturally release filesystem handles
  console.log('[whatsapp-debug] allowing Windows 500ms to release file locks...')
  await new Promise(r => setTimeout(r, 500))

  await initWhatsApp()
}

/**
 * Initialize the WhatsApp client.
 * Session is persisted to Supabase via RemoteAuth — survives Render redeploys.
 * On first run: shows QR to scan. After that: auto-restores from Supabase.
 */
export async function initWhatsApp() {
  // whatsapp-web.js bundles its own puppeteer (v146) which looks for a different
  // Chrome version than what we install. We explicitly pass our standalone puppeteer's
  // executablePath so both use the same binary (downloaded via .puppeteerrc.cjs).
  let executablePath
  try {
    executablePath = puppeteer.executablePath()
    if (executablePath && typeof executablePath.then === 'function') {
      executablePath = await executablePath
    }
  } catch {
    executablePath = undefined
  }
  console.log('[whatsapp] using chrome at:', executablePath || 'default (system)')

  // On Render (production), we must use RemoteAuth to persist session in Supabase.
  // Locally (Windows), RemoteAuth causes EBUSY crashes when copying locked IndexedDB files.
  const authStrategy = process.env.NODE_ENV === 'production'
    ? new RemoteAuth({
        store: new SupabaseStore(),
        backupSyncIntervalMs: 300_000,
      })
    : new LocalAuth()

  client = new Client({
    authStrategy,
    puppeteer: {
      headless: true,
      executablePath: executablePath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',       // use /tmp instead of /dev/shm (crucial on Render)
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',                   // prevents extra chrome helper processes
        '--single-process',              // run Chrome in a single process (saves ~100MB)
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update',
        '--js-flags=--max-old-space-size=256', // cap V8 heap at 256MB
      ],
    },
  })

  client.on('qr', qr => {
    currentQR = qr
    status = 'awaiting_qr'
    console.log('[whatsapp] QR ready — visit /api/whatsapp/qr to scan')
  })

  client.on('authenticated', () => {
    currentQR = null
    status = 'authenticated'
    console.log('[whatsapp] authenticated ✅')
  })

  client.on('ready', () => {
    status = 'authenticated'
    console.log('[whatsapp] client ready — bot is online')
  })

  client.on('auth_failure', async msg => {
    status = 'awaiting_qr'
    currentQR = null
    console.error('[whatsapp] auth failure — clearing stale session and restarting for fresh QR:', msg)
    // Wipe the stored session so RemoteAuth won't try to restore it again
    try {
      await supabase.from('whatsapp_sessions').delete().neq('id', '__placeholder__')
      console.log('[whatsapp] stale sessions cleared from Supabase')
    } catch (e) {
      console.warn('[whatsapp] could not clear sessions:', e.message)
    }
    // Wait a moment then restart so a new QR is generated
    setTimeout(() => restartWhatsApp(), 3000)
  })

  client.on('disconnected', reason => {
    status = 'initializing'
    console.warn('[whatsapp] disconnected:', reason)
    // Auto-restart on unexpected disconnection
    setTimeout(() => restartWhatsApp(), 5000)
  })

  // ── Auto-kick non-subscribers on group join ─────────────────────────────
  // Fires whenever ANY participant joins a group the bot is in.
  // If they don't have an active subscription → remove them immediately.
  client.on('group_join', async notification => {
    const groupId = notification.chatId
    const joinedId = notification.id?.participant // "2348012345678@c.us"

    if (!joinedId) return

    // Ignore the bot joining its own group (handled separately)
    const me = client.info?.wid?._serialized
    if (joinedId === me) {
      console.log('[whatsapp] bot joined group:', groupId)
      // Save group ID to unregistered WhatsApp community if needed
      const { data: communities } = await supabase
        .from('communities')
        .select('id, name')
        .eq('platform', 'whatsapp')
        .is('whatsapp_group_id', null)
      if (communities?.length) {
        const latest = communities[0]
        await supabase.from('communities').update({ whatsapp_group_id: groupId }).eq('id', latest.id)
        console.log(`[whatsapp] saved group ${groupId} to community "${latest.name}"`)
      }
      return
    }

    const phone = joinedId.replace('@c.us', '')
    console.log(`[whatsapp] ${phone} joined group ${groupId} — checking subscription...`)

    // Check if they have an active subscription for this group
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('whatsapp_phone', phone)
      .eq('status', 'active')
      .in('community_id', (
        // Sub-select: communities that have this group ID
        await supabase
          .from('communities')
          .select('id')
          .eq('whatsapp_group_id', groupId)
          .then(r => r.data?.map(c => c.id) || [])
      ))
      .maybeSingle()

    if (!sub) {
      // Not a paying subscriber — remove immediately
      console.warn(`[whatsapp] non-subscriber ${phone} joined group ${groupId} — kicking`)
      try {
        const chat = await client.getChatById(groupId)
        await chat.removeParticipants([joinedId])
        // Optionally message them explaining why
        await client.sendMessage(joinedId,
          `⛔ You've been removed from this group because you don't have an active subscription.\n\nJoin here to pay and get access.`
        )
        console.log(`[whatsapp] kicked non-subscriber ${phone}`)
      } catch (err) {
        console.error(`[whatsapp] failed to kick non-subscriber ${phone}:`, err.message)
      }
    } else {
      console.log(`[whatsapp] ${phone} is a valid subscriber ✅`)
    }
  })

  try {
    await client.initialize()
  } catch (err) {
    console.error('[whatsapp] initialize error:', err.message)
  }
}

/**
 * Join a WhatsApp group via invite link.
 * Returns the group's internal ID.
 */
export async function joinGroup(inviteLink) {
  if (!client || status !== 'authenticated') {
    throw new Error('WhatsApp client not ready — scan the QR code first')
  }
  const code = inviteLink.split('chat.whatsapp.com/')[1]?.split(/[?#]/)[0]
  if (!code) throw new Error('Invalid WhatsApp invite link')

  const groupId = await client.acceptInvite(code)
  console.log('[whatsapp] joined group:', groupId)
  return groupId
}

/**
 * Send a WhatsApp DM to a phone number.
 */
export async function sendWhatsAppMessage(phone, text) {
  if (!client || status !== 'authenticated') {
    console.warn('[whatsapp] client not ready, skipping message to', phone)
    return
  }
  const chatId = `${phone}@c.us`
  try {
    await randomDelay()
    await client.sendMessage(chatId, text)
    console.log(`[whatsapp] message sent to ${phone}`)
  } catch (err) {
    console.error(`[whatsapp] sendMessage to ${phone} failed:`, err.message)
    throw err
  }
}

/**
 * Revoke the current group invite link and generate + save a fresh one.
 * Called after every subscriber invite to prevent link sharing.
 */
async function revokeAndRefreshGroupLink(groupId, communityId) {
  try {
    const chat = await client.getChatById(groupId)
    await chat.revokeInvite()                      // old link dies instantly
    const newCode = await chat.getInviteCode()     // get fresh code
    const newLink = `https://chat.whatsapp.com/${newCode}`

    // Save the new link to the community so the next subscriber gets the fresh one
    await supabase
      .from('communities')
      .update({ whatsapp_group_invite_link: newLink })
      .eq('id', communityId)

    console.log(`[whatsapp] invite link rotated for community ${communityId}`)
    return newLink
  } catch (err) {
    // Non-fatal — subscriber already received their link
    console.error('[whatsapp] failed to revoke/refresh invite link:', err.message)
  }
}

/**
 * Send invite link to a new subscriber, then immediately rotate the group link.
 * communityId is required to save the new link after rotation.
 */
export async function sendWhatsAppInvite(phone, inviteLink, communityName, communityId, groupId, customMessage) {
  let addedDirectly = false

  if (groupId && client && status === 'authenticated') {
    try {
      const chat = await client.getChatById(groupId)
      const participantId = `${phone}@c.us`

      // Register in whitelist BEFORE adding — the group_join event fires
      // asynchronously and the @lid mapping may differ from the real phone.
      // This 90-second window lets group_join skip the kick for this member.
      whitelistPhone(phone)
      console.log(`[whatsapp] Attempting to auto-add ${phone} to group ${groupId}...`)
      const res = await chat.addParticipants([participantId])
      
      // whatsapp-web.js doesn't throw on privacy blocks, it returns an object like { "234...": { code: 403 } }
      const addStatus = res && res[participantId]
      if (addStatus && addStatus.code === 403) {
        console.warn(`[whatsapp] Failed to auto-add ${phone} (Privacy restricted). Falling back to DM invite.`)
        addedDirectly = false
      } else if (res && typeof res === 'object' && Object.values(res).some(v => v !== 200)) {
        console.warn(`[whatsapp] Failed to auto-add ${phone} (Unknown code). Falling back to DM invite.`)
        addedDirectly = false
      } else {
        console.log(`[whatsapp] Successfully auto-added ${phone} to group!`)
        addedDirectly = true

        // Send a confirmation DM so they know why they were mysteriously added
        const defaultWelcome = `🎉 Welcome! You have been automatically added to the WhatsApp Group for *${communityName}* by the admin.\n\nPlease check your chat list to start participating!`
        const welcomeText = customMessage || defaultWelcome
        await sendWhatsAppMessage(phone, welcomeText)
      }

    } catch (err) {
      console.warn(`[whatsapp] Failed to auto-add ${phone}:`, err.message)
    }
  }

  if (addedDirectly) {
    // We don't need to send the invite link or refresh it
    return
  } else {
    // Fallback: If their privacy settings block being added, send the invite link via DM
    const defaultWelcome = `🎉 Welcome! Join the *${communityName}* community here:`
    const welcomeText = customMessage || defaultWelcome
    const text = `${welcomeText}\n\n${inviteLink}\n\n_Note: Save this number to your contacts if the link is not clickable._`
    await sendWhatsAppMessage(phone, text)

    // Revoke and refresh the group link if possible to prevent sharing
    if (groupId && communityId && inviteLink) {
      await revokeAndRefreshGroupLink(groupId, communityId)
    }
  }
}

/**
 * Remove a subscriber from a WhatsApp group.
 */
export async function removeWhatsAppMember(groupId, phone) {
  if (!client || status !== 'authenticated') {
    throw new Error('WhatsApp client not ready')
  }
  const participantId = `${phone}@c.us`
  try {
    const chat = await client.getChatById(groupId)
    await chat.removeParticipants([participantId])
    console.log(`[whatsapp] removed ${phone} from group ${groupId}`)
  } catch (err) {
    console.error(`[whatsapp] removeParticipants failed:`, err.message)
    throw err
  }
}

/**
 * Generate QR code image as data URL for browser scanning.
 */
export async function getQRImage() {
  if (!currentQR) return null
  return await qrcode.toDataURL(currentQR)
}
