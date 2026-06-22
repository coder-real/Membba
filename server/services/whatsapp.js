import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode'
import { supabase } from '../lib/supabase.js'

// ── Status & state ────────────────────────────────────────────────────────────
// 'initializing' | 'needs_scan' | 'needs_pairing_code' | 'syncing' | 'connected' | 'reconnecting'
let status = 'initializing'
let currentQRDataUrl = null   // base64 PNG for the frontend
let pairingCode = null        // 8-digit code for phone-number login
let sock = null
let connectionOptions = {}    // saved so reconnects use the same options

// ── Phone whitelist — skip auto-kick for members we just added ────────────────
const phoneWhitelist = new Map() // phone → expiry timestamp

export function whitelistPhone(phone) {
  phoneWhitelist.set(phone, Date.now() + 90_000)
  console.log(`[whatsapp] whitelisted ${phone} for 90s`)
}

function isPhoneWhitelisted(phone) {
  const expiry = phoneWhitelist.get(phone)
  if (!expiry) return false
  if (Date.now() > expiry) { phoneWhitelist.delete(phone); return false }
  return true
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms))
const randomDelay = () => delay(Math.random() * 2000 + 500) // 0.5–2.5 s

export function getWhatsAppStatus() { return status }
export function getWhatsAppQR()     { return currentQRDataUrl }
export function getPairingCode()    { return pairingCode }

// ── Pending invite drain (called on every 'connected') ────────────────────────
async function drainPendingInvites() {
  const { data: pending, error } = await supabase
    .from('whatsapp_pending_invites')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !pending?.length) return

  console.log(`[whatsapp] draining ${pending.length} pending invite(s)`)
  for (const invite of pending) {
    try {
      await sendWhatsAppInvite(
        invite.phone,
        invite.invite_link,
        invite.community_name,
        invite.community_id,
        invite.group_id,
        invite.custom_message,
      )
      await supabase.from('whatsapp_pending_invites').delete().eq('id', invite.id)
      console.log(`[whatsapp] drained invite for ${invite.phone}`)
    } catch (err) {
      console.error(`[whatsapp] failed to drain invite for ${invite.phone}:`, err.message)
    }
  }
}

// ── Core connection ───────────────────────────────────────────────────────────
/**
 * Start (or restart) the Baileys WebSocket connection.
 * @param {object} opts
 * @param {boolean} opts.usePairingCode  — skip QR, use phone-number pairing instead
 * @param {string}  opts.phoneNumber     — E.164 number (digits only) for pairing code
 */
export async function initWhatsApp(opts = {}) {
  connectionOptions = opts     // persist for auto-reconnects
  const { usePairingCode = false, phoneNumber = null } = opts

  // Baileys stores session in a local folder — on Render mount a persistent disk here
  const AUTH_DIR = process.env.BAILEYS_AUTH_DIR || './baileys_auth'
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  const { version } = await fetchLatestBaileysVersion()
  console.log(`[whatsapp] Baileys v${version.join('.')} — starting...`)

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    logger: pino({ level: 'silent' }),     // suppress noisy Baileys output
    printQRInTerminal: false,
    browser: ['Membba', 'Chrome', '126.0'], // appear as a normal browser session
    connectTimeoutMs: 30_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    markOnlineOnConnect: false,            // don't show "online" in WhatsApp UI
    syncFullHistory: false,               // don't pull message history (saves RAM)
  })

  // Persist credentials whenever they change (key rotations, etc.)
  sock.ev.on('creds.update', saveCreds)

  // ── Connection state machine ─────────────────────────────────────────────
  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update

    // QR code path
    if (qr && !usePairingCode) {
      try {
        currentQRDataUrl = await qrcode.toDataURL(qr)
      } catch { currentQRDataUrl = null }
      status = 'needs_scan'
      console.log('[whatsapp] QR ready — visit /api/whatsapp/qr to scan')
    }

    // Pairing code path — requested once after socket is open but not yet registered
    if (
      usePairingCode && phoneNumber &&
      !sock.authState.creds.registered &&
      connection !== 'open'
    ) {
      try {
        const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ''))
        pairingCode = code
        status = 'needs_pairing_code'
        console.log('[whatsapp] pairing code ready:', pairingCode)
      } catch (err) {
        console.error('[whatsapp] pairing code request failed:', err.message)
      }
    }

    if (connection === 'open') {
      status = 'connected'
      currentQRDataUrl = null
      pairingCode = null
      console.log('[whatsapp] client ready — bot is online')
      await drainPendingInvites()
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : null

      const shouldLogOut = statusCode === DisconnectReason.loggedOut

      if (shouldLogOut) {
        // Permanent logout — user explicitly logged out on their phone
        status = 'needs_scan'
        currentQRDataUrl = null
        pairingCode = null
        console.warn('[whatsapp] logged out — will show QR for re-auth')
        // Re-init fresh (no saved creds so a QR will appear)
        setTimeout(() => initWhatsApp(), 2000)
      } else {
        status = 'reconnecting'
        console.warn(`[whatsapp] disconnected (${statusCode}) — reconnecting in 5s...`)
        setTimeout(() => initWhatsApp(connectionOptions), 5000)
      }
    }
  })

  // ── Group participant auto-kick (replaces group_join event) -─────────────
  sock.ev.on('group-participants.update', async ({ id: groupId, participants, action }) => {
    if (action !== 'add') return

    for (const jid of participants) {
      // Ignore bot's own join
      if (jid === sock.user?.id) {
        console.log('[whatsapp] bot joined group:', groupId)
        // Attempt to associate with an unregistered community
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
        continue
      }

      const phone = jid.split('@')[0]
      if (isPhoneWhitelisted(phone)) {
        console.log(`[whatsapp] ${phone} is whitelisted — skipping auto-kick`)
        continue
      }

      console.log(`[whatsapp] ${phone} joined group ${groupId} — checking subscription...`)

      // Sub-select communities with this group ID
      const { data: communityRows } = await supabase
        .from('communities')
        .select('id')
        .eq('whatsapp_group_id', groupId)

      const communityIds = communityRows?.map(c => c.id) || []

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('whatsapp_phone', phone)
        .eq('status', 'active')
        .in('community_id', communityIds)
        .maybeSingle()

      if (!sub) {
        console.warn(`[whatsapp] non-subscriber ${phone} joined ${groupId} — kicking`)
        try {
          await sock.groupParticipantsUpdate(groupId, [jid], 'remove')
          await sock.sendMessage(jid, {
            text: `⛔ You've been removed — you don't have an active subscription.\n\nJoin & pay here to get access.`,
          })
          console.log(`[whatsapp] kicked non-subscriber ${phone}`)
        } catch (err) {
          console.error(`[whatsapp] failed to kick ${phone}:`, err.message)
        }
      } else {
        console.log(`[whatsapp] ${phone} is a valid subscriber ✅`)
      }
    }
  })
}

// ── Restart ───────────────────────────────────────────────────────────────────
export async function restartWhatsApp() {
  console.log('[whatsapp] restarting client...')
  status = 'initializing'
  currentQRDataUrl = null
  pairingCode = null

  if (sock) {
    try {
      sock.ev.removeAllListeners()
      sock.end(undefined)
    } catch { /* ignore */ }
    sock = null
  }

  await delay(1000)
  await initWhatsApp(connectionOptions)
}

// ── Send a DM ────────────────────────────────────────────────────────────────
export async function sendWhatsAppMessage(phone, text) {
  if (!sock || status !== 'connected') {
    console.warn('[whatsapp] client not ready, skipping message to', phone)
    return
  }
  const jid = `${phone}@s.whatsapp.net`
  try {
    await randomDelay()
    await sock.sendMessage(jid, { text })
    console.log(`[whatsapp] message sent to ${phone}`)
  } catch (err) {
    console.error(`[whatsapp] sendMessage to ${phone} failed:`, err.message)
    throw err
  }
}

// ── Join a group via invite link ──────────────────────────────────────────────
export async function joinGroup(inviteLink) {
  if (!sock || status !== 'connected') {
    throw new Error('WhatsApp client not ready — scan the QR code first')
  }
  const code = inviteLink.split('chat.whatsapp.com/')[1]?.split(/[?#]/)[0]
  if (!code) throw new Error('Invalid WhatsApp invite link')

  const result = await sock.groupAcceptInvite(code)
  console.log('[whatsapp] joined group:', result)
  return result  // returns the group JID/ID
}

// ── Revoke and refresh group invite link ─────────────────────────────────────
async function revokeAndRefreshGroupLink(groupId, communityId) {
  try {
    await sock.groupRevokeInvite(groupId)
    const newCode = await sock.groupInviteCode(groupId)
    const newLink = `https://chat.whatsapp.com/${newCode}`

    await supabase
      .from('communities')
      .update({ whatsapp_group_invite_link: newLink })
      .eq('id', communityId)

    console.log(`[whatsapp] invite link rotated for community ${communityId}`)
    return newLink
  } catch (err) {
    console.error('[whatsapp] failed to revoke/refresh invite link:', err.message)
  }
}

// ── Send invite to a new subscriber ──────────────────────────────────────────
export async function sendWhatsAppInvite(phone, inviteLink, communityName, communityId, groupId, customMessage) {
  let addedDirectly = false
  const userJid = `${phone}@s.whatsapp.net`

  if (groupId && sock && status === 'connected') {
    try {
      console.log(`[whatsapp] attempting to auto-add ${phone} to group ${groupId}...`)

      // Whitelist BEFORE adding so the group-participants auto-kick skips them
      whitelistPhone(phone)

      const result = await sock.groupParticipantsUpdate(groupId, [userJid], 'add')
      const addCode = result?.[0]?.status
      console.log(`[whatsapp] groupParticipantsUpdate code for ${phone}:`, addCode, JSON.stringify(result?.[0]))

      if (addCode === '200') {
        addedDirectly = true
        console.log(`[whatsapp] successfully auto-added ${phone} to group!`)

        // Send custom welcome message as DM
        const welcome = customMessage
          || `👋 Welcome to *${communityName}*! You've been added to the group.`
        await sendWhatsAppMessage(phone, welcome)

        // Rotate invite link so it can't be shared
        await revokeAndRefreshGroupLink(groupId, communityId)

      } else if (addCode === '403') {
        console.warn(`[whatsapp] privacy block for ${phone} — falling back to DM invite`)
      } else {
        console.warn(`[whatsapp] unexpected status ${addCode} for ${phone} — falling back to DM invite`)
      }
    } catch (err) {
      console.error(`[whatsapp] groupParticipantsUpdate error for ${phone}:`, err.message)
    }
  }

  // ── DM Invite fallback ────────────────────────────────────────────────────
  if (!addedDirectly) {
    try {
      // Get a fresh invite code directly from the group (more reliable than stored link)
      let finalLink = inviteLink
      if (groupId && sock && status === 'connected') {
        try {
          const code = await sock.groupInviteCode(groupId)
          finalLink = `https://chat.whatsapp.com/${code}`
        } catch {
          // stick with stored link
        }
      }

      const dmText = customMessage
        ? `${customMessage}\n\n👇 Tap to join:\n${finalLink}`
        : `👋 Welcome to *${communityName}*!\n\nTap this link to join:\n${finalLink}\n\n⚠️ This link is personal — don't share it.`

      await sendWhatsAppMessage(phone, dmText)
      console.log(`[whatsapp] DM invite sent to ${phone}`)
    } catch (err) {
      console.error(`[whatsapp] DM invite failed for ${phone}:`, err.message)
      throw err
    }
  }
}

// ── Remove a subscriber from a group ─────────────────────────────────────────
export async function removeWhatsAppMember(groupId, phone) {
  if (!sock || status !== 'connected') {
    throw new Error('WhatsApp client not ready')
  }
  const userJid = `${phone}@s.whatsapp.net`
  try {
    await sock.groupParticipantsUpdate(groupId, [userJid], 'remove')
    console.log(`[whatsapp] removed ${phone} from group ${groupId}`)
  } catch (err) {
    console.error(`[whatsapp] remove participant failed:`, err.message)
    throw err
  }
}

// ── QR image for browser (backwards-compat) ────────────────────────────────
export async function getQRImage() {
  return currentQRDataUrl || null
}
