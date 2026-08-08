import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineInbox,
  HiOutlinePaperAirplane,
  HiOutlineSparkles,
} from 'react-icons/hi2'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/api'
import Tooltip from '../components/Tooltip'
import WhatsAppModeBadge from '../components/WhatsAppModeBadge'

const intentLabels = {
  payment_issue: 'Payment issue',
  invite_missing: 'Invite missing',
  refund: 'Refund request',
  human_admin: 'Admin requested',
  unknown_member: 'Unknown member',
  renewal: 'Renewal',
  subscription_status: 'Status question',
  access_removed: 'Access removed',
  general_support: 'General support',
  greeting: 'Greeting',
}

const intentStyles = {
  payment_issue: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  invite_missing: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  refund: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
  unknown_member: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20',
}

function intentLabel(intent) {
  return intentLabels[intent] || intent?.replace(/_/g, ' ') || 'Follow-up'
}

function IntentPill({ intent }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-bold ${intentStyles[intent] || 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-white/50 dark:border-white/10'}`}>
      {intentLabel(intent)}
    </span>
  )
}

function StatusPill({ status }) {
  const open = status === 'open'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${open ? 'bg-[#c8f135]/15 text-[#c8f135]' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-white/35'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-[#c8f135]' : 'bg-gray-400'}`} />
      {open ? 'Open' : 'Resolved'}
    </span>
  )
}

export default function AIInboxPage() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('open')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [loadError, setLoadError] = useState(null)

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) return data.session.access_token

    const refreshed = await supabase.auth.refreshSession().catch(() => null)
    return refreshed?.data?.session?.access_token || null
  }

  async function apiFetch(path, opts = {}, didRetry = false) {
    const token = await getToken()
    if (!token) throw new Error('Your session has expired. Please log out and sign in again.')

    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    const data = await res.json().catch(() => ({}))

    // Supabase access tokens can expire while the dashboard still looks signed in.
    // If the backend rejects once, force-refresh the session and retry one time.
    if (res.status === 401 && !didRetry) {
      const refreshed = await supabase.auth.refreshSession().catch(() => null)
      if (refreshed?.data?.session?.access_token) return apiFetch(path, opts, true)
    }

    if (!res.ok) throw new Error(data.error || data.message || 'Request failed')
    return data
  }


  async function load() {
    setLoading(true)
    try {
      setLoadError(null)
      const data = await apiFetch(`/api/ai/escalations?status=${status}`)
      setItems(data || [])
    } catch (err) {
      setLoadError(err.message || 'Failed to load AI inbox')
      toast.error(err.message || 'Failed to load AI inbox')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status])

  async function resolveItem(id) {
    setBusyId(id)
    try {
      await apiFetch(`/api/ai/escalations/${id}/resolve`, { method: 'PATCH' })
      toast.success('Marked resolved')
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function resendInvite(id) {
    setBusyId(id)
    try {
      const data = await apiFetch(`/api/ai/escalations/${id}/resend-invite`, { method: 'POST' })
      toast.success(data.message || 'Invite resent')
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const stats = useMemo(() => ({
    open: items.filter(i => i.status === 'open').length,
    payment: items.filter(i => i.intent === 'payment_issue').length,
    invite: items.filter(i => i.intent === 'invite_missing').length,
  }), [items])

  return (
    <>
      <div className="mb-8 mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#c8f135]/20 bg-[#c8f135]/10 px-3 py-1 text-[12px] font-bold text-[#c8f135]">
            <HiOutlineSparkles size={14} /> AI follow-up inbox
          </div>
          <h1 className="text-[28px] font-black tracking-tight text-black dark:text-white flex items-center gap-2">
            AI Inbox
            <Tooltip content="AI Inbox collects conversations where Membba's AI thinks a human should review or take action, like payment checks, refunds, missing invites, or unknown members." side="bottom" />
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-gray-500 dark:text-white/40">
            Review conversations where Membba’s AI needs a human check — payments, refunds, missing invites, and unmatched members.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-gray-200 px-4 py-2 text-[14px] font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"
        >
          <HiOutlineArrowPath className={loading ? 'animate-spin' : ''} size={16} /> Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-none border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
          <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400">Open</p>
          <p className="mt-1 text-[26px] font-black text-black dark:text-white">{stats.open}</p>
        </div>
        <div className="rounded-none border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
          <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400">Payment checks</p>
          <p className="mt-1 text-[26px] font-black text-black dark:text-white">{stats.payment}</p>
        </div>
        <div className="rounded-none border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
          <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400">Invite issues</p>
          <p className="mt-1 text-[26px] font-black text-black dark:text-white">{stats.invite}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {['open', 'resolved', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-[9px] px-3 py-2 text-[13px] font-bold capitalize transition ${status === s ? 'bg-[#c8f135] text-black' : 'border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-white/35 dark:hover:bg-white/5'}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[16px] border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
        {loading ? (
          <div className="p-12 text-center text-[14px] text-gray-400">Loading AI inbox…</div>
        ) : loadError ? (
          <div className="p-10 text-center">
            <HiOutlineExclamationTriangle size={32} className="mx-auto mb-3 text-amber-400" />
            <p className="text-[15px] font-black text-gray-900 dark:text-white">Could not load conversations</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-gray-500 dark:text-white/35">{loadError === 'Unauthorized' ? 'Your dashboard session token was rejected. Sign out and back in if Refresh does not fix it.' : loadError}</p>
            <button onClick={load} className="mt-5 rounded-none bg-[#c8f135] px-4 py-2 text-[13px] font-black text-black">Refresh</button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50 dark:bg-white/5">
              <HiOutlineInbox size={28} className="text-gray-300 dark:text-white/15" />
            </div>
            <p className="text-[15px] font-black text-gray-900 dark:text-white">Nothing to review</p>
            <p className="mt-1 text-[13px] text-gray-400 dark:text-white/30">When the AI escalates a payment, invite, or access issue, it will show up here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {items.map(item => {
              const sub = item.subscription
              const canResend = item.status === 'open' && ['invite_missing', 'payment_issue'].includes(item.intent)
              const active = sub?.status === 'active'
              return (
                <article key={item.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <IntentPill intent={item.intent} />
                        <StatusPill status={item.status} />
                        <span className="text-[12px] font-semibold text-gray-400">
                          {new Date(item.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="mb-4 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
                        <div>
                          <p className="font-bold uppercase tracking-widest text-gray-400 text-[11px]">Member</p>
                          <p className="mt-1 font-mono font-bold text-gray-900 dark:text-white">{item.phone}</p>
                        </div>
                        <div>
                          <p className="font-bold uppercase tracking-widest text-gray-400 text-[11px]">Community</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="font-bold text-gray-900 dark:text-white">{sub?.communities?.name || 'Unknown'}</p>
                            {sub?.communities?.platform === 'whatsapp' && (
                              <WhatsAppModeBadge mode={sub.communities?.whatsapp_setup_mode || 'basic'} size="xs" />
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="font-bold uppercase tracking-widest text-gray-400 text-[11px] flex items-center gap-1.5">
                            Subscription
                            <Tooltip content="Resend invite only works for active subscriptions. Expired members should renew first." />
                          </p>
                          <p className={`mt-1 font-bold ${active ? 'text-[#c8f135]' : 'text-amber-500'}`}>{sub?.status || 'unknown'}{sub?.plans?.name ? ` · ${sub.plans.name}` : ''}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {item.conversation?.length ? (
                          <div className="rounded-[12px] border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Conversation thread</p>
                              <span className="text-[11px] font-mono text-gray-400">last {item.conversation.length}</span>
                            </div>
                            <div className="space-y-2">
                              {item.conversation.map((msg, idx) => (
                                <div key={`${msg.created_at}-${idx}`} className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[86%] rounded-[10px] border px-3 py-2 text-[13px] leading-relaxed ${msg.role === 'assistant' ? 'border-[#c8f135]/20 bg-[#c8f135]/10 text-gray-900 dark:text-white' : 'border-gray-200 bg-white text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white/85'}`}>
                                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest opacity-60">{msg.role === 'assistant' ? 'Membba AI' : 'Member'}</p>
                                    <p>{msg.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-[12px] bg-gray-50 p-4 dark:bg-white/[0.03]">
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">Member said</p>
                              <p className="text-[14px] leading-relaxed text-gray-900 dark:text-white">{item.message}</p>
                            </div>
                            <div className="rounded-[12px] border border-[#c8f135]/15 bg-[#c8f135]/5 p-4">
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#c8f135]">AI replied</p>
                              <p className="text-[14px] leading-relaxed text-gray-800 dark:text-white/80">{item.ai_reply}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {item.status === 'open' && (
                      <div className="flex flex-col gap-2 lg:w-44">
                        {sub && (
                          <Link
                            to={`/dashboard/members?subscription=${sub.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-none border border-[#c8f135]/30 bg-[#c8f135]/10 px-4 py-2.5 text-[13px] font-black text-[#c8f135] transition hover:bg-[#c8f135]/15"
                          >
                            Open member
                          </Link>
                        )}
                        {canResend && (
                          <button
                            onClick={() => resendInvite(item.id)}
                            disabled={busyId === item.id}
                            className="inline-flex items-center justify-center gap-2 rounded-none bg-[#c8f135] px-4 py-2.5 text-[13px] font-black text-black transition hover:bg-[#d6ff4f] disabled:opacity-50"
                            title={active ? 'Resend or queue the invite for this active member' : 'Only active members can receive invite resend'}
                          >
                            <HiOutlinePaperAirplane size={15} /> Resend invite
                          </button>
                        )}
                        <button
                          onClick={() => resolveItem(item.id)}
                          disabled={busyId === item.id}
                          className="inline-flex items-center justify-center gap-2 rounded-none border border-gray-200 px-4 py-2.5 text-[13px] font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"
                        >
                          <HiOutlineCheckCircle size={15} /> Mark resolved
                        </button>
                        {!active && canResend && (
                          <p className="rounded-[9px] bg-amber-50 p-2 text-[11px] font-semibold leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                            Invite resend needs an active subscription. Ask the member to renew first.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
