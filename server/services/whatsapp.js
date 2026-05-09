import pkg from 'whatsapp-web.js'
const { Client, RemoteAuth } = pkg
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
      .maybeSingle()
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

/**
 * Initialize the WhatsApp client.
 * Session is persisted to Supabase via RemoteAuth — survives Render redeploys.
 * On first run: shows QR to scan. After that: auto-restores from Supabase.
 */
export async function initWhatsApp() {
  client = new Client({
    authStrategy: new RemoteAuth({
      store: new SupabaseStore(),
      backupSyncIntervalMs: 300_000, // save session to Supabase every 5 min
    }),
    puppeteer: {
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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

  client.on('auth_failure', msg => {
    status = 'awaiting_qr'
    console.error('[whatsapp] auth failure:', msg)
  })

  client.on('disconnected', reason => {
    status = 'initializing'
    console.warn('[whatsapp] disconnected:', reason)
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
export async function sendWhatsAppInvite(phone, inviteLink, communityName, communityId, groupId) {
  const text =
    `🎉 Welcome! You're now a member of *${communityName}*.\n\n` +
    `Tap the link below to join the group:\n${inviteLink}\n\n` +
    `⚠️ _This link is for you only. Do not share it — it will stop working after use._`

  await sendWhatsAppMessage(phone, text)

  // Rotate the link immediately so forwarded links are dead
  if (groupId && communityId) {
    await revokeAndRefreshGroupLink(groupId, communityId)
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
