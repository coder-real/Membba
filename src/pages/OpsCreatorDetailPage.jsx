import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineClipboardDocument,
  HiOutlineExclamationTriangle,
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

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
      <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500 dark:text-white/35">{sub}</p>}
    </div>
  )
}

export default function OpsCreatorDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

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
      const result = await apiFetch(`/api/ops/creators/${id}`)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  function copy(value, label = 'Copied') {
    navigator.clipboard.writeText(value || '')
    toast.success(label)
  }

  async function addNote(e) {
    e.preventDefault()
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const res = await apiFetch('/api/ops/notes', {
        method: 'POST',
        body: { entity_type: 'creator', entity_id: id, note: noteText.trim() },
      })
      setData(prev => ({ ...prev, notes: [res.note, ...(prev.notes || [])] }))
      setNoteText('')
      toast.success('Note added')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingNote(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 p-8 text-gray-500 dark:bg-black">Loading creator…</div>

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black p-6 flex items-center justify-center">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-7 text-center dark:border-red-500/20 dark:bg-[#111]">
          <HiOutlineShieldCheck size={36} className="mx-auto mb-3 text-red-400" />
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Could not load creator</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-white/45">{error}</p>
          <Link to="/ops/helpdesk" className="mt-5 inline-block rounded-xl bg-[#9FFF57] px-5 py-2.5 text-sm font-black text-black">Back to helpdesk</Link>
        </div>
      </div>
    )
  }

  const { creator, summary, communities, payments, subscriptions, escalations, automation_settings, notes } = data

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-black dark:text-white">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-[#111]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <Link to="/ops/helpdesk" className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#76d83b] dark:text-white/40">
              <HiOutlineArrowLeft size={16} /> Back to Ops Help Desk
            </Link>
            <h1 className="text-2xl font-black tracking-tight">{creator.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-white/40">
              <span>{creator.email}</span>
              <button onClick={() => copy(creator.email, 'Email copied')} className="text-[#76d83b]"><HiOutlineClipboardDocument size={16} /></button>
              {creator.phone && <span>· {creator.phone}</span>}
            </div>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
            <HiOutlineArrowPath size={16} /> Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="Communities" value={summary.communities} />
          <StatCard label="Revenue" value={`₦${Number(summary.total_revenue || 0).toLocaleString()}`} />
          <StatCard label="Payments" value={summary.payments} sub={`${summary.pending_payments} pending`} />
          <StatCard label="Subscriptions" value={summary.subscriptions} sub={`${summary.active_subscriptions} active`} />
          <StatCard label="Expired" value={summary.expired_subscriptions} />
          <StatCard label="Open AI issues" value={summary.open_escalations} />
        </section>

        <section className="mb-7 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
            <h2 className="font-black">Creator profile</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div><span className="text-gray-400">Created:</span> {new Date(creator.created_at).toLocaleString()}</div>
              <div><span className="text-gray-400">Last sign in:</span> {creator.last_sign_in_at ? new Date(creator.last_sign_in_at).toLocaleString() : '—'}</div>
              <div><span className="text-gray-400">User ID:</span> <span className="font-mono text-xs">{creator.id}</span></div>
              {creator.bio && <div><span className="text-gray-400">Bio:</span> {creator.bio}</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
            <h2 className="font-black">Automation settings</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {automation_settings ? (
                <>
                  <Pill tone={automation_settings.ai_responder ? 'green' : 'gray'}>AI {automation_settings.ai_responder ? 'on' : 'off'}</Pill>
                  <Pill tone={automation_settings.daily_digest ? 'green' : 'gray'}>Digest {automation_settings.daily_digest ? 'on' : 'off'}</Pill>
                  <Pill tone={automation_settings.scheduler ? 'green' : 'gray'}>Scheduler {automation_settings.scheduler ? 'on' : 'off'}</Pill>
                  <Pill>{automation_settings.digest_time || '08:00'} WAT</Pill>
                </>
              ) : <p className="text-sm text-gray-500">No automation settings saved yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111]">
            <h2 className="font-black">Internal notes</h2>
            <form onSubmit={addNote} className="mt-4 flex gap-2">
              <input
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add note..."
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#9FFF57]/30 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <button disabled={savingNote} className="rounded-xl bg-[#9FFF57] px-4 py-2 text-sm font-black text-black disabled:opacity-50">Add</button>
            </form>
            <div className="mt-4 max-h-52 overflow-y-auto">
              {notes?.length ? notes.map(n => (
                <div key={n.id} className="border-b border-gray-100 py-2 last:border-0 dark:border-white/5">
                  <p className="text-sm">{n.note}</p>
                  <p className="mt-1 text-xs text-gray-400">{n.created_by_email || 'Ops'} · {new Date(n.created_at).toLocaleString()}</p>
                </div>
              )) : <p className="text-sm text-gray-500">No notes yet.</p>}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-white/5"><h2 className="font-black">Communities</h2></div>
            {communities.length ? communities.map(c => (
              <div key={c.id} className="border-b border-gray-100 p-5 last:border-0 dark:border-white/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{c.name}</p>
                    <p className="text-sm text-gray-500 dark:text-white/40">/{c.slug} · {c.platform}</p>
                  </div>
                  <div className="flex gap-2"><Pill tone={c.is_active ? 'green' : 'gray'}>{c.is_active ? 'active' : 'inactive'}</Pill>{(c.telegram_chat_id || c.whatsapp_group_id) ? <Pill tone="green">connected</Pill> : <Pill tone="amber">setup needed</Pill>}</div>
                </div>
              </div>
            )) : <div className="p-8 text-sm text-gray-500">No communities.</div>}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-white/5"><h2 className="font-black">Open AI escalations</h2></div>
            {escalations.filter(e => e.status === 'open').length ? escalations.filter(e => e.status === 'open').map(e => (
              <div key={e.id} className="border-b border-gray-100 p-5 last:border-0 dark:border-white/5">
                <div className="mb-2 flex flex-wrap gap-2"><Pill tone="amber">{e.intent}</Pill><Pill>{e.action || 'review'}</Pill></div>
                <p className="text-sm font-bold">{e.phone}</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-white/60">{e.message}</p>
              </div>
            )) : <div className="p-8 text-sm text-gray-500">No open AI escalations.</div>}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-white/5"><h2 className="font-black">Recent subscriptions</h2></div>
            {subscriptions.length ? subscriptions.slice(0, 12).map(sub => (
              <div key={sub.id} className="border-b border-gray-100 p-5 last:border-0 dark:border-white/5">
                <div className="mb-1 flex flex-wrap gap-2"><Pill tone={sub.status === 'active' ? 'green' : sub.status === 'expired' ? 'amber' : 'gray'}>{sub.status}</Pill><Pill>{sub.communities?.platform}</Pill></div>
                <p className="font-bold">{sub.email}</p>
                <p className="text-sm text-gray-500 dark:text-white/40">{sub.communities?.name} · {sub.plans?.name || 'Plan'} · expires {new Date(sub.expires_at).toLocaleDateString()}</p>
              </div>
            )) : <div className="p-8 text-sm text-gray-500">No subscriptions.</div>}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-white/5"><h2 className="font-black">Recent payments</h2></div>
            {payments.length ? payments.slice(0, 12).map(p => (
              <div key={p.id} className="border-b border-gray-100 p-5 last:border-0 dark:border-white/5">
                <div className="mb-1 flex flex-wrap gap-2"><Pill tone={p.status === 'success' ? 'green' : p.status === 'failed' ? 'red' : 'amber'}>{p.status}</Pill><Pill>{p.communities?.platform}</Pill></div>
                <p className="font-bold">{p.email}</p>
                <p className="text-sm text-gray-500 dark:text-white/40">{p.communities?.name} · ₦{Number(p.amount || 0).toLocaleString()}</p>
                <p className="mt-1 font-mono text-xs text-gray-400">{p.paystack_reference}</p>
              </div>
            )) : <div className="p-8 text-sm text-gray-500">No payments.</div>}
          </div>
        </section>
      </main>
    </div>
  )
}
