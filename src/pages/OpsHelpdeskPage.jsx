import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineLifebuoy,
  HiOutlineShieldCheck,
} from 'react-icons/hi2'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/api'

function Pill({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-white/50 dark:border-white/10',
    green: 'bg-[#9FFF57]/15 text-[#76d83b] border-[#9FFF57]/20',
    amber: 'bg-amber-400/10 text-amber-700 border-amber-400/20 dark:text-amber-300',
    red: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-300',
    blue: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300',
  }
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-bold ${tones[tone]}`}>{children}</span>
}

export default function OpsHelpdeskPage() {
  const [summary, setSummary] = useState(null)
  const [data, setData] = useState({ escalations: [], payments: [], communities: [], recent_creators: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [lookupRef, setLookupRef] = useState('')
  const [lookup, setLookup] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [subBusy, setSubBusy] = useState(null)
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [notesLoading, setNotesLoading] = useState(false)

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) return data.session.access_token
    const refreshed = await supabase.auth.refreshSession().catch(() => null)
    return refreshed?.data?.session?.access_token || null
  }

  async function apiFetch(path, opts = {}) {
    const token = await getToken()
    if (!token) throw new Error('Please sign in first.')
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.message || 'Request failed')
    return body
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [s, h] = await Promise.all([
        apiFetch('/api/ops/summary'),
        apiFetch('/api/ops/helpdesk'),
      ])
      setSummary(s)
      setData(h)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function resolveEscalation(id) {
    setBusyId(id)
    try {
      await apiFetch(`/api/ops/escalations/${id}/resolve`, { method: 'PATCH' })
      toast.success('Resolved')
      setData(prev => ({ ...prev, escalations: prev.escalations.filter(e => e.id !== id) }))
      setSummary(prev => prev ? { ...prev, open_escalations: Math.max(0, (prev.open_escalations || 1) - 1) } : prev)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function lookupPayment(e) {
    e.preventDefault()
    const ref = lookupRef.trim()
    if (!ref) return toast.error('Enter a Paystack reference')
    setLookupLoading(true)
    try {
      const data = await apiFetch(`/api/ops/payments/${encodeURIComponent(ref)}`)
      setLookup(data)
      loadNotes('payment', data.payment?.paystack_reference || ref)
      toast.success('Payment loaded')
    } catch (err) {
      setLookup(null)
      toast.error(err.message)
    } finally {
      setLookupLoading(false)
    }
  }

  async function loadNotes(entityType, entityId) {
    if (!entityType || !entityId) return
    setNotesLoading(true)
    try {
      const data = await apiFetch(`/api/ops/notes?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`)
      setNotes(data || [])
    } catch (err) {
      // Notes table may not exist until migration is run; don't block the helpdesk.
      setNotes([])
    } finally {
      setNotesLoading(false)
    }
  }

  async function addLookupNote(e) {
    e.preventDefault()
    const ref = lookup?.payment?.paystack_reference
    if (!ref || !noteText.trim()) return
    try {
      const res = await apiFetch('/api/ops/notes', {
        method: 'POST',
        body: { entity_type: 'payment', entity_id: ref, note: noteText.trim() },
      })
      setNotes(prev => [res.note, ...prev])
      setNoteText('')
      toast.success('Note added')
    } catch (err) {
      toast.error(err.message || 'Could not save note')
    }
  }

  async function verifyLookupPayment() {
    const ref = lookup?.payment?.paystack_reference || lookupRef.trim()
    if (!ref) return
    setLookupLoading(true)
    try {
      const result = await apiFetch(`/api/ops/payments/${encodeURIComponent(ref)}/verify`, { method: 'POST' })
      toast.success(result.repaired ? 'Payment verified and subscription repaired' : 'Payment verified')
      const fresh = await apiFetch(`/api/ops/payments/${encodeURIComponent(ref)}`)
      setLookup(fresh)
      loadNotes('payment', ref)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLookupLoading(false)
    }
  }

  async function runSearch(e) {
    e.preventDefault()
    if (searchQ.trim().length < 2) return toast.error('Search term must be at least 2 characters')
    setSearchLoading(true)
    try {
      const results = await apiFetch(`/api/ops/search?q=${encodeURIComponent(searchQ.trim())}`)
      setSearchResults(results)
      toast.success('Search complete')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSearchLoading(false)
    }
  }

  async function subscriptionAction(id, action, body = {}) {
    setSubBusy(`${action}:${id}`)
    try {
      const res = await apiFetch(`/api/ops/subscriptions/${id}/${action}`, { method: 'POST', body })
      toast.success(res.message || 'Done')
      if (searchQ.trim().length >= 2) {
        const results = await apiFetch(`/api/ops/search?q=${encodeURIComponent(searchQ.trim())}`)
        setSearchResults(results)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubBusy(null)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-black p-8 text-gray-500">Loading Membba Ops…</div>
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black p-6 flex items-center justify-center">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-7 text-center dark:border-red-500/20 dark:bg-[#111]">
          <HiOutlineShieldCheck size={36} className="mx-auto mb-3 text-red-400" />
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Ops access required</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-white/45">{error}</p>
          <p className="mt-4 text-xs text-gray-400 dark:text-white/25">Add your email to MEMBBA_ADMIN_EMAILS in the backend environment to access this page.</p>
          <Link to="/dashboard" className="mt-5 inline-block rounded-xl bg-[#9FFF57] px-5 py-2.5 text-sm font-black text-black">Back to dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-black dark:text-white">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-[#111]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#9FFF57]/20 bg-[#9FFF57]/10 px-3 py-1 text-[12px] font-black text-[#76d83b]">
              <HiOutlineLifebuoy size={14} /> Membba Operations
            </div>
            <h1 className="text-2xl font-black tracking-tight">Creator Help Desk</h1>
            <p className="text-sm text-gray-500 dark:text-white/40">Internal queue for creator support, payments, AI escalations, and setup issues.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
              <HiOutlineArrowPath size={16} /> Refresh
            </button>
            <Link to="/dashboard" className="rounded-xl bg-[#9FFF57] px-4 py-2 text-sm font-black text-black">Creator app</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            ['Creators', summary?.creators || 0],
            ['Communities', summary?.communities || 0],
            ['Active subs', summary?.active_subscriptions || 0],
            ['Open issues', summary?.open_escalations || 0],
            ['Pending payments', summary?.pending_payments || 0],
            ['Revenue', `₦${Number(summary?.total_revenue || 0).toLocaleString()}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </section>


        <section className="mb-7 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
          <div className="mb-4">
            <h2 className="font-black">Global search</h2>
            <p className="text-sm text-gray-500 dark:text-white/35">Search creators, communities, members, payments, phone numbers, emails, and Paystack references.</p>
          </div>
          <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search email, phone, community slug, payment reference..."
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#9FFF57]/30 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <button disabled={searchLoading} className="rounded-xl bg-[#9FFF57] px-5 py-3 text-sm font-black text-black disabled:opacity-50">
              {searchLoading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {searchResults && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <h3 className="mb-3 font-black">Members / subscriptions</h3>
                {searchResults.subscriptions?.length ? searchResults.subscriptions.map(sub => (
                  <div key={sub.id} className="border-b border-gray-100 py-3 last:border-0 dark:border-white/5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="mb-1 flex gap-2"><Pill tone={sub.status === 'active' ? 'green' : sub.status === 'expired' ? 'amber' : 'gray'}>{sub.status}</Pill><Pill>{sub.communities?.platform || 'platform'}</Pill></div>
                        <p className="font-bold">{sub.email}</p>
                        <p className="text-sm text-gray-500 dark:text-white/40">{sub.whatsapp_phone || sub.telegram_user_id || 'No platform ID'} · {sub.communities?.name} · {sub.plans?.name || 'Plan'}</p>
                        <p className="text-xs text-gray-400">Expires {new Date(sub.expires_at).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => subscriptionAction(sub.id, 'extend', { days: 30 })} disabled={subBusy === `extend:${sub.id}`} className="rounded-lg bg-[#9FFF57] px-3 py-1.5 text-xs font-black text-black disabled:opacity-50">+30 days</button>
                        <button onClick={() => subscriptionAction(sub.id, 'resend-invite')} disabled={subBusy === `resend-invite:${sub.id}` || sub.status !== 'active'} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40 dark:border-white/10">Resend invite</button>
                        <button onClick={() => subscriptionAction(sub.id, 'cancel')} disabled={subBusy === `cancel:${sub.id}`} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-500 disabled:opacity-40">Cancel</button>
                      </div>
                    </div>
                  </div>
                )) : <p className="text-sm text-gray-500">No subscriptions found.</p>}
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <h3 className="mb-3 font-black">Payments</h3>
                {searchResults.payments?.length ? searchResults.payments.map(p => (
                  <div key={p.id} className="border-b border-gray-100 py-3 last:border-0 dark:border-white/5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="mb-1 flex gap-2"><Pill tone={p.status === 'success' ? 'green' : p.status === 'failed' ? 'red' : 'amber'}>{p.status}</Pill><Pill>{p.communities?.platform || 'platform'}</Pill></div>
                        <p className="font-bold">{p.email}</p>
                        <p className="text-sm text-gray-500 dark:text-white/40">{p.communities?.name} · ₦{Number(p.amount || 0).toLocaleString()}</p>
                        <p className="font-mono text-xs text-gray-400">{p.paystack_reference}</p>
                      </div>
                      <button onClick={() => { setLookupRef(p.paystack_reference); setLookup(null); setTimeout(() => document.querySelector('[placeholder^="Paystack reference"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0) }} className="text-xs font-bold text-[#76d83b] hover:underline">Open lookup</button>
                    </div>
                  </div>
                )) : <p className="text-sm text-gray-500">No payments found.</p>}
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <h3 className="mb-3 font-black">Creators</h3>
                {searchResults.creators?.length ? searchResults.creators.map(c => (
                  <Link to={`/ops/creators/${c.id}`} key={c.id} className="block border-b border-gray-100 py-3 last:border-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/[0.03]">
                    <p className="font-bold">{c.name}</p>
                    <p className="text-sm text-gray-500 dark:text-white/40">{c.email}</p>
                  </Link>
                )) : <p className="text-sm text-gray-500">No creators found.</p>}
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <h3 className="mb-3 font-black">Communities</h3>
                {searchResults.communities?.length ? searchResults.communities.map(c => (
                  <div key={c.id} className="border-b border-gray-100 py-3 last:border-0 dark:border-white/5">
                    <div className="flex items-center justify-between gap-2"><p className="font-bold">{c.name}</p><Pill tone={c.is_active ? 'green' : 'gray'}>{c.is_active ? 'active' : 'inactive'}</Pill></div>
                    <p className="text-sm text-gray-500 dark:text-white/40">/{c.slug} · {c.platform} · {c.creator?.email || 'Unknown creator'}</p>
                    {c.creator?.id && <Link to={`/ops/creators/${c.creator.id}`} className="mt-1 inline-block text-xs font-bold text-[#76d83b] hover:underline">Open creator profile</Link>}
                  </div>
                )) : <p className="text-sm text-gray-500">No communities found.</p>}
              </div>
            </div>
          )}
        </section>

        <section className="mb-7 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
          <div className="mb-4">
            <h2 className="font-black">Payment lookup</h2>
            <p className="text-sm text-gray-500 dark:text-white/35">Search by Paystack reference, view timeline, verify with Paystack, and repair missing subscriptions.</p>
          </div>
          <form onSubmit={lookupPayment} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={lookupRef}
              onChange={e => setLookupRef(e.target.value)}
              placeholder="Paystack reference e.g. ryylv9ilpr"
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-[#9FFF57]/30 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <button disabled={lookupLoading} className="rounded-xl bg-[#9FFF57] px-5 py-3 text-sm font-black text-black disabled:opacity-50">
              {lookupLoading ? 'Checking…' : 'Lookup'}
            </button>
          </form>

          {lookup && (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Pill tone={lookup.payment.status === 'success' ? 'green' : lookup.payment.status === 'failed' ? 'red' : 'amber'}>{lookup.payment.status}</Pill>
                  <Pill>{lookup.payment.communities?.platform || 'platform'}</Pill>
                  {lookup.subscription ? <Pill tone="green">subscription exists</Pill> : <Pill tone="red">no subscription</Pill>}
                </div>
                <p className="font-bold">{lookup.payment.email}</p>
                <p className="text-sm text-gray-500 dark:text-white/40">{lookup.payment.communities?.name} · {lookup.payment.plans?.name || 'Plan'}</p>
                <p className="mt-2 text-2xl font-black text-[#76d83b]">₦{Number(lookup.payment.amount || 0).toLocaleString()}</p>
                <p className="mt-2 font-mono text-xs text-gray-400">{lookup.payment.paystack_reference}</p>
                {lookup.creator && <p className="mt-2 text-sm text-gray-500 dark:text-white/40">Creator: {lookup.creator.name} · {lookup.creator.email}</p>}
                <button onClick={verifyLookupPayment} disabled={lookupLoading} className="mt-4 rounded-xl bg-[#9FFF57] px-4 py-2 text-sm font-black text-black disabled:opacity-50">
                  Verify / repair subscription
                </button>
              </div>
              <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <h3 className="mb-3 font-black">Payment timeline</h3>
                {lookup.events?.length ? lookup.events.map(ev => (
                  <div key={ev.id} className="border-b border-gray-100 py-2 last:border-0 dark:border-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{ev.event}</p>
                      <Pill tone={ev.status === 'success' ? 'green' : ev.status === 'failed' ? 'red' : 'gray'}>{ev.status}</Pill>
                    </div>
                    <p className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleString()}</p>
                    {ev.message && <p className="mt-1 text-xs text-gray-500 dark:text-white/40">{ev.message}</p>}
                  </div>
                )) : <p className="text-sm text-gray-500">No payment events yet. Run the payment-events migration if this stays empty.</p>}
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-black">Internal notes</h3>
                  <span className="text-xs text-gray-400">Payment reference notes</span>
                </div>
                <form onSubmit={addLookupNote} className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add internal note, e.g. Creator contacted on WhatsApp..."
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9FFF57]/30 dark:border-white/10 dark:bg-black/20 dark:text-white"
                  />
                  <button className="rounded-xl bg-[#9FFF57] px-4 py-2 text-sm font-black text-black">Add note</button>
                </form>
                {notesLoading ? <p className="text-sm text-gray-500">Loading notes…</p> : notes.length ? notes.map(n => (
                  <div key={n.id} className="border-b border-gray-100 py-2 last:border-0 dark:border-white/5">
                    <p className="text-sm">{n.note}</p>
                    <p className="mt-1 text-xs text-gray-400">{n.created_by_email || 'Ops'} · {new Date(n.created_at).toLocaleString()}</p>
                  </div>
                )) : <p className="text-sm text-gray-500">No notes yet. Run ops-notes migration if saving notes fails.</p>}
              </div>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-white/5">
                <h2 className="font-black">Open AI Escalations</h2>
                <p className="text-sm text-gray-500 dark:text-white/35">Member conversations where the AI requested human review.</p>
              </div>
              {data.escalations.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">No open escalations.</div>
              ) : data.escalations.map(e => (
                <div key={e.id} className="border-b border-gray-100 p-5 last:border-0 dark:border-white/5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Pill tone="amber">{e.intent}</Pill>
                    <Pill>{e.action || 'review'}</Pill>
                    <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{e.phone}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
                      <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-gray-400">Member said</p>
                      <p className="text-sm">{e.message}</p>
                    </div>
                    <div className="rounded-xl bg-[#9FFF57]/10 p-3">
                      <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-[#76d83b]">AI replied</p>
                      <p className="text-sm">{e.ai_reply}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => resolveEscalation(e.id)}
                    disabled={busyId === e.id}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#9FFF57] px-4 py-2 text-sm font-black text-black disabled:opacity-50"
                  >
                    <HiOutlineCheckCircle size={16} /> Mark resolved
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-white/5">
                <h2 className="font-black">Payment Issues</h2>
                <p className="text-sm text-gray-500 dark:text-white/35">Pending or failed transactions creators may contact support about.</p>
              </div>
              {data.payments.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">No pending or failed payments.</div>
              ) : data.payments.map(p => (
                <div key={p.id} className="border-b border-gray-100 p-5 last:border-0 dark:border-white/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex gap-2"><Pill tone={p.status === 'failed' ? 'red' : 'amber'}>{p.status}</Pill><Pill>{p.communities?.platform || 'platform'}</Pill></div>
                      <p className="font-bold">{p.email}</p>
                      <p className="text-sm text-gray-500 dark:text-white/40">{p.communities?.name} · {p.plans?.name || 'Plan'} · ₦{Number(p.amount || 0).toLocaleString()}</p>
                      <p className="mt-1 font-mono text-xs text-gray-400">{p.paystack_reference}</p>
                      <button
                        onClick={() => { setLookupRef(p.paystack_reference); setLookup(null); setTimeout(() => { document.querySelector('[placeholder^=\"Paystack reference\"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 0) }}
                        className="mt-2 text-xs font-bold text-[#76d83b] hover:underline"
                      >
                        Open in lookup
                      </button>
                    </div>
                    <div className="text-right text-sm text-gray-500 dark:text-white/40">
                      <p>{p.creator?.name}</p>
                      <p>{p.creator?.email}</p>
                      {p.creator?.id && <Link to={`/ops/creators/${p.creator.id}`} className="text-xs font-bold text-[#76d83b] hover:underline">Creator profile</Link>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-white/5">
                <h2 className="font-black">Recent Creators</h2>
              </div>
              {data.recent_creators.map(c => (
                <div key={c.id} className="border-b border-gray-100 px-5 py-4 last:border-0 dark:border-white/5">
                  <p className="font-bold">{c.name}</p>
                  <p className="text-sm text-gray-500 dark:text-white/40">{c.email}</p>
                  <p className="mt-1 text-xs text-gray-400">Joined {new Date(c.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-white/5">
                <h2 className="font-black">Recent Communities</h2>
              </div>
              {data.communities.slice(0, 12).map(c => (
                <div key={c.id} className="border-b border-gray-100 px-5 py-4 last:border-0 dark:border-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{c.name}</p>
                    <Pill tone={c.is_active ? 'green' : 'gray'}>{c.is_active ? 'active' : 'inactive'}</Pill>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-white/40">/{c.slug} · {c.platform}</p>
                  <p className="mt-1 text-xs text-gray-400">{c.creator?.email || 'Unknown creator'}</p>
                  {c.creator?.id && <Link to={`/ops/creators/${c.creator.id}`} className="mt-1 inline-block text-xs font-bold text-[#76d83b] hover:underline">Open creator</Link>}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
