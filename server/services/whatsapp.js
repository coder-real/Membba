import pkg from 'whatsapp-web.js'
const { Client, RemoteAuth, LocalAuth } = pkg
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

// ── In-memory whitelist ─────────────────────────────────────────────────────
// When the bot adds someone via addParticipants(), the group_join event fires
// asynchronously. WhatsApp's @lid privacy mode means the participant's ID in
// that event doesn't match their stored phone number. We track recently-added
// phones here so group_join can skip the kick check for them.
const recentlyAddedPhones = new Set()
function whitelistPhone(phone, ttlMs = 90_000) {
  recentlyAddedPhones.add(phone)
  setTimeout(() => recentlyAddedPhones.delete(phone), ttlMs)
}

export function getWhatsAppStatus() { return status }
export function getWhatsAppQR() { return currentQR }

/**
 * Initialize the WhatsApp client.
 * Session is persisted to Supabase via RemoteAuth — survives Render redeploys.
 * On first run: shows QR to scan. After that: auto-restores from Supabase.
 */
export async function initWhatsApp() {
  const isProd = process.env.NODE_ENV === 'production'

  client = new Client({
    authStrategy: isProd 
      ? new RemoteAuth({
          store: new SupabaseStore(),
          backupSyncIntervalMs: 300_000, // save session to Supabase every 5 min
        })
      : new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
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
    const joinedId = notification.id?.participant // may be @c.us OR @lid (privacy mode)

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

    // If the bot itself added this member, bypass the check!
    // We already validated their subscription during the auto-add phase.
    // notification.author contains the ID of the admin who initiated the add.
    if (notification.author === me) {
      console.log(`[whatsapp] Bot auto-added this participant. Bypassing subscription check.`)
      return
    }

    // ── Resolve @lid → real phone number ───────────────────────────────────
    // WhatsApp's new privacy mode sends participant IDs as @lid instead of
    // @c.us (e.g., "50259757637718@lid" instead of "2347040883919@c.us").
    // We must resolve the real phone via getContactById before checking DB.
    let phone = joinedId.replace(/@c\.us$|@lid$|@s\.whatsapp\.net$/, '')

    if (joinedId.endsWith('@lid')) {
      try {
        const contact = await client.getContactById(joinedId)
        if (contact?.number) {
          phone = contact.number
          console.log(`[whatsapp] resolved @lid ${joinedId} → phone ${phone}`)
        } else {
          // Can't resolve lid — give them the benefit of the doubt
          console.warn(`[whatsapp] could not resolve @lid ${joinedId}, skipping kick check`)
          return
        }
      } catch (err) {
        console.warn(`[whatsapp] @lid resolution failed for ${joinedId}: ${err.message}, skipping`)
        return
      }
    }

    // ── Grace period — wait 5s to let the subscription record settle ────────
    // The webhook that creates the subscription fires around the same time
    // as the member clicking the invite link, so there can be a short race.
    await delay(5000)

    console.log(`[whatsapp] ${phone} joined group ${groupId} — checking subscription...`)

    // Get community IDs for this group
    const { data: groupCommunities } = await supabase
      .from('communities')
      .select('id')
      .eq('whatsapp_group_id', groupId)

    const communityIds = groupCommunities?.map(c => c.id) || []
    if (!communityIds.length) {
      console.warn(`[whatsapp] no community found for group ${groupId}, skipping check`)
      return
    }

    // Check if they have an active subscription for this group
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('whatsapp_phone', phone)
      .eq('status', 'active')
      .in('community_id', communityIds)
      .maybeSingle()

    if (!sub) {
      // Check if this phone was recently whitelisted (bot-added in the last 90s)
      // OR if the community has a recently-created active subscription (handles @lid mismatch)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const { data: recentSub } = await supabase
        .from('subscriptions')
        .select('id')
        .in('community_id', communityIds)
        .eq('status', 'active')
        .gte('created_at', twoMinutesAgo)
        .maybeSingle()

      if (recentSub || recentlyAddedPhones.has(phone)) {
        console.log(`[whatsapp] ${phone} was recently added by bot — skipping kick`)
        return
      }

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
 * Send invite link to a new subscriber, or automatically add them to the group.
 */
export async function sendWhatsAppInvite(phone, inviteLink, communityName, communityId, groupId) {
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
      
      // WhatsApp returns a map of results, 200 = Success, 403 = Privacy restricted
      const joinStatus = res && res[participantId]
      if (joinStatus && joinStatus.code === 200) {
        addedDirectly = true
        console.log(`[whatsapp] Successfully auto-added ${phone} to group!`)
      }
    } catch (err) {
      console.warn(`[whatsapp] Failed to auto-add ${phone}:`, err.message)
    }
  }

  if (addedDirectly) {
    const text = `🎉 Welcome! You have been automatically added to the WhatsApp Group for *${communityName}* by the admin.\n\nPlease check your chat list to start participating!`
    await sendWhatsAppMessage(phone, text)
  } else {
    // Fallback: If their privacy settings block being added, send the invite link via DM
    const text =
      `🎉 Welcome! You're now a member of *${communityName}*.\n\n` +
      `Tap the link below to join the group:\n${inviteLink}\n\n` +
      `⚠️ _This link is for you only. Do not share it._`

    await sendWhatsAppMessage(phone, text)
    console.warn(`[whatsapp] Invite link rotation temporarily disabled. Member ${phone} must use the standard link.`)
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
