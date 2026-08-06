import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { supabase } from '../lib/supabase.js'
import { isAIResponderEnabledForPhone, logAutomationRun } from './automation.js'

import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys'

// ── Custom Supabase AuthState Wrapper ───────────────────────────────────────
// Replaces useMultiFileAuthState to persist Baileys directly into DB.
const useSupabaseAuthState = async () => {
  const writeData = async (data, id) => {
    // Serialize data the exact same way Baileys does for disk
    const stringData = JSON.stringify(data, BufferJSON.replacer)
    await supabase.from('baileys_sessions').upsert({ id, data: JSON.parse(stringData) })
  }

  const readData = async (id) => {
    try {
      const { data } = await supabase.from('baileys_sessions').select('data').eq('id', id).single()
      if (data?.data) {
        return JSON.parse(JSON.stringify(data.data), BufferJSON.reviver)
      }
      return null
    } catch { return null } // Not found
  }

  const removeData = async (id) => {
    try { await supabase.from('baileys_sessions').delete().eq('id', id) } catch { /* ignore */ }
  }

  let creds = await readData('creds')
  if (!creds) {
    creds = initAuthCreds()
    await writeData(creds, 'creds')
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {}
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`)
              if (type === 'app-state-sync-key' && value) {
                value = makeCacheableSignalKeyStore(value, pino({ level: 'silent' }))
              }
              data[id] = value
            })
          )
          return data
        },
        set: async (data) => {
          const tasks = []
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id]
              const key = `${category}-${id}`
              tasks.push(value ? writeData(value, key) : removeData(key))
            }
          }
          await Promise.all(tasks)
        }
      }
    },
    saveCreds: () => {
      return writeData(creds, 'creds')
    }
  }
}

// ── Status & state ────────────────────────────────────────────────────────────
// 'initializing' | 'needs_scan' | 'needs_pairing_code' | 'syncing' | 'connected' | 'reconnecting'
let status = 'initializing'
let currentQRDataUrl = null
let pairingCode = null
let pairingRequestedAt = null
let pairingPhoneNumber = null
let lastError = null
let sock = null
let connectionOptions = {}
let isConnecting = false  // Lock — prevents overlapping initWhatsApp() calls

// ── Phone whitelist — skip auto-kick for members we just added ────────────────
const phoneWhitelist = new Map() // phone → expiry timestamp
const lidToPhoneMap = new Map()  // lid → phone string

export function whitelistPhone(phone) {
  phoneWhitelist.set(phone, Date.now() + 90_000)
  console.log(`[whatsapp] whitelisted ${phone} for 90s`)
}

export function mapLidToPhone(lid, phone) {
  lidToPhoneMap.set(lid, phone)
  // Keep it for a day just in case (optional, we only need it briefly)
  setTimeout(() => lidToPhoneMap.delete(lid), 86400000)
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
export function getWhatsAppError()  { return lastError }
export function getWhatsAppDebug()  {
  return {
    status,
    hasSocket: Boolean(sock),
    registered: Boolean(sock?.authState?.creds?.registered || sock?.authState?.creds?.me?.id),
    account: sock?.authState?.creds?.me?.id || null,
    pairingRequestedAt,
    pairingPhoneLast4: pairingPhoneNumber ? pairingPhoneNumber.slice(-4) : null,
    lastError,
  }
}

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
  // ── Connection lock — bail out if already connecting ──────────────────────
  if (isConnecting) {
    console.log('[whatsapp] connection attempt already in progress — skipping')
    return
  }
  isConnecting = true
  connectionOptions = opts
  const { usePairingCode = false, phoneNumber = null } = opts

  // ── Kill previous socket cleanly before creating a new one ────────────────
  if (sock) {
    try {
      sock.ev.removeAllListeners()  // stop old listeners from firing on the new socket
      sock.end(undefined)
    } catch { /* ignore */ }
    sock = null
  }

  try {
    const { state, saveCreds } = await useSupabaseAuthState()

    console.log('[session] creds registered (from Supabase):', state.creds.registered)
    console.log('[session] has me:', state.creds.me ? JSON.stringify(state.creds.me) : false)

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
    // Use Baileys' built-in browser profile instead of a hand-rolled tuple.
    // This matches the documented connection examples more closely.
    browser: Browsers.ubuntu('Membba'),
    connectTimeoutMs: 30_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 25_000,
    markOnlineOnConnect: false,            // don't show "online" in WhatsApp UI
    syncFullHistory: false,               // don't pull message history (saves RAM)
  })

    // Persist credentials whenever they change
    sock.ev.on('creds.update', saveCreds)

    // Pairing-code path: request the code shortly after the socket is created.
    // Requesting inside every connection.update event can race with WhatsApp and
    // produce "Connection Closed" before the socket is ready.
    const hasLinkedIdentity = Boolean(state.creds.registered || state.creds.me?.id)
    if (usePairingCode && phoneNumber && !hasLinkedIdentity) {
      setTimeout(async () => {
        try {
          if (!sock || sock.authState.creds.registered || sock.authState.creds.me?.id) return
          const cleanPhone = phoneNumber.replace(/\D/g, '')
          const code = await sock.requestPairingCode(cleanPhone)
          pairingCode = code
          pairingRequestedAt = new Date().toISOString()
          pairingPhoneNumber = cleanPhone
          lastError = null
          status = 'needs_pairing_code'
          console.log('[whatsapp] pairing code ready:', pairingCode)
        } catch (err) {
          lastError = err.message
          status = 'pairing_failed'
          console.error('[whatsapp] pairing code request failed:', err.message)
        }
      }, 3000)
    }

    // ── Release the lock as soon as the socket is wired up ──────────────────
    isConnecting = false

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

    if (connection === 'open') {
      status = 'connected'
      lastError = null
      currentQRDataUrl = null
      pairingCode = null
      pairingRequestedAt = null
      pairingPhoneNumber = null
      console.log('[whatsapp] client ready — bot is online')
      await drainPendingInvites()
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : null

      const didLogOut = statusCode === DisconnectReason.loggedOut
      const connectionReplaced = statusCode === DisconnectReason.connectionReplaced

      if (didLogOut || connectionReplaced) {
        // Permanent/manual attention states — don't auto-restart. Auto-restarting
        // after connectionReplaced creates an infinite loop when another server
        // or WhatsApp Web session takes over the same linked device.
        status = connectionReplaced ? 'connection_replaced' : 'logged_out'
        lastError = connectionReplaced
          ? 'WhatsApp connection was replaced by another active session. Stop the other session, then restart this one.'
          : 'WhatsApp logged out. Reset the session and reconnect.'
        currentQRDataUrl = null
        pairingCode = null
        console.warn(`[whatsapp] ${status} — waiting for manual reconnect`)
      } else {
        status = 'reconnecting'
        lastError = statusCode ? `Disconnected (${statusCode})` : 'Disconnected'
        console.warn(`[whatsapp] disconnected (${statusCode}) — reconnecting in 5s...`)
        setTimeout(() => initWhatsApp(connectionOptions), 5000)
      }
    }
  })

  // ── Private DM handler — AI First Responder ──────────────────────────────
  // Only fires for incoming private DMs to the bot. Group messages are ignored.
  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    // Only handle 'notify' type (new incoming messages, not history sync)
    if (type !== 'notify') return

    for (const msg of msgs) {
      // Skip: no content, status updates, or messages sent BY the bot itself
      if (!msg.message || msg.key.fromMe) continue

      const jid = msg.key.remoteJid || ''

      // Skip group messages — only handle private 1-to-1 DMs
      if (jid.endsWith('@g.us')) continue

      // Extract the phone number (strip @s.whatsapp.net)
      const phone = jid.replace('@s.whatsapp.net', '').replace(/[^\d]/g, '')
      if (!phone) continue

      // Extract text from any message type
      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.documentMessage?.caption ||
        ''
      ).trim()

      if (!text) continue

      console.log(`[ai] DM from ${phone}: "${text.substring(0, 60)}"`)

      try {
        const enabled = await isAIResponderEnabledForPhone(phone)
        if (!enabled) {
          console.log(`[ai] responder disabled for ${phone}, skipping reply`)
          await logAutomationRun({ type: 'ai_responder', status: 'skipped', message: 'AI responder disabled', metadata: { phone } })
          continue
        }

        // Lazy import to avoid circular deps at module load time
        const { getAIReplyDetailed } = await import('./ai.js')
        const result = await getAIReplyDetailed(phone, text)
        await sock.sendMessage(jid, { text: result.reply })
        await logAutomationRun({ type: 'ai_responder', status: 'success', message: 'AI reply sent', metadata: { phone, intent: result.intent, escalated: result.escalation?.escalated || false } })
        console.log(`[ai] replied to ${phone}`)
      } catch (err) {
        await logAutomationRun({ type: 'ai_responder', status: 'failed', message: err.message, metadata: { phone } })
        console.error(`[ai] failed to reply to ${phone}:`, err.message)
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

      // Wait a moment so that if this was an auto-add, the `groupParticipantsUpdate` 
      // result has time to populate `lidToPhoneMap`
      await delay(3000)

      let phone = jid.split('@')[0]

      // If this is an @lid, see if we mapped it back to a phone number
      if (jid.includes('@lid') && lidToPhoneMap.has(jid)) {
        phone = lidToPhoneMap.get(jid)
        console.log(`[whatsapp] resolved LID ${jid} -> phone ${phone}`)
      }

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
  } catch (err) {
    isConnecting = false
    console.error('[whatsapp] initWhatsApp failed:', err.message)
  }
}

// ── Restart ───────────────────────────────────────────────────────────────────
export async function resetWhatsAppSession() {
  console.log('[whatsapp] clearing Baileys session...')
  try {
    if (sock) {
      try { sock.ev.removeAllListeners(); sock.end(undefined) } catch { /* ignore */ }
      sock = null
    }
    await supabase.from('baileys_sessions').delete().neq('id', '__never__')
    status = 'initializing'
    currentQRDataUrl = null
    pairingCode = null
    pairingRequestedAt = null
    pairingPhoneNumber = null
    lastError = null
  } catch (err) {
    lastError = err.message
    throw err
  }
}

export async function restartWhatsApp(opts = null) {
  console.log('[whatsapp] restarting client...')
  status = 'initializing'
  lastError = null
  currentQRDataUrl = null
  pairingCode = null
  pairingRequestedAt = null
  pairingPhoneNumber = null

  if (opts) connectionOptions = opts

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


export function parseWhatsAppInviteLink(inviteLink) {
  const raw = String(inviteLink || '').trim()
  const code = raw.split('chat.whatsapp.com/')[1]?.split(/[?#]/)[0]
  return code || null
}

export async function resolveInviteLink(inviteLink) {
  const code = parseWhatsAppInviteLink(inviteLink)
  if (!code) throw new Error('Invalid WhatsApp invite link')

  const result = {
    ok: true,
    invite_code: code,
    connected: status === 'connected',
    group_id: null,
    group_name: null,
    participants_count: null,
  }

  if (sock && status === 'connected') {
    try {
      const info = await sock.groupGetInviteInfo(code)
      result.group_id = info?.id || null
      result.group_name = info?.subject || null
      result.participants_count = info?.size || info?.participants?.length || null
    } catch (err) {
      // Some invite links cannot be inspected until accepted. Return validation success
      // but include the inspection error for diagnostics.
      result.inspect_error = err.message
    }
  }

  return result
}

// ── Join a group via invite link ──────────────────────────────────────────────
export async function joinGroup(inviteLink) {
  if (!sock || status !== 'connected') {
    throw new Error('WhatsApp client not ready — scan the QR code first')
  }
  const code = parseWhatsAppInviteLink(inviteLink)
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
      const addedParticipant = result?.[0]
      const addCode = addedParticipant?.status
      console.log(`[whatsapp] groupParticipantsUpdate code for ${phone}:`, addCode, JSON.stringify(addedParticipant))

      if (addCode === '200') {
        addedDirectly = true
        console.log(`[whatsapp] successfully auto-added ${phone} to group!`)
        
        // WhatsApp assigns an @lid when adding users. Save this mapping so the 
        // group-participants.update handler knows who this is.
        if (addedParticipant?.jid && addedParticipant.jid.includes('@lid')) {
          mapLidToPhone(addedParticipant.jid, phone)
        }

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
