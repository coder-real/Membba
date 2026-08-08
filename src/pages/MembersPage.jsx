import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/api'
import { useAuth } from '../context/AuthContext'

import Avatar from '../components/Avatar'
import Skeleton from '../components/ui/Skeleton'
import WhatsAppModeBadge from '../components/WhatsAppModeBadge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

const TABS = ['all', 'active', 'expired', 'cancelled']

export default function MembersPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [removing, setRemoving] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [resending, setResending] = useState(null)
  const [selected, setSelected] = useState(null)
  const [memberPayments, setMemberPayments] = useState([])
  const [memberEscalations, setMemberEscalations] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(null)
  const [extending, setExtending] = useState(null)
  const [resolvingEscalation, setResolvingEscalation] = useState(null)

  useEffect(() => { fetchSubs() }, [user])
  useEffect(() => { if (selected) loadMemberDetails(selected) }, [selected?.id])
  useEffect(() => {
    if (!subscriptions.length) return
    const subId = searchParams.get('subscription')
    const email = searchParams.get('email')
    const phone = searchParams.get('phone')
    const communityId = searchParams.get('community')
    if (!subId && !email && !phone) return

    const match = subscriptions.find(s => {
      if (subId && s.id === subId) return true
      if (email && s.email?.toLowerCase() === email.toLowerCase() && (!communityId || s.community_id === communityId)) return true
      if (phone && (s.whatsapp_phone === phone || String(s.telegram_user_id || '') === phone)) return true
      return false
    })
    if (match) setSelected(match)
  }, [subscriptions, searchParams])

  const fetchSubs = async () => {
    setLoading(true)
    const { data: communities } = await supabase.from('communities').select('id').eq('creator_id', user.id)
    const ids = communities?.map(c => c.id) || []
    if (!ids.length) { setLoading(false); return }
    const { data } = await supabase
      .from('subscriptions')
      .select('*, communities(name, slug, platform, whatsapp_setup_mode), plans(name, price, duration_minutes)')
      .in('community_id', ids)
      .order('started_at', { ascending: false })
    setSubscriptions(data || [])
    setLoading(false)
  }

  async function loadMemberDetails(s) {
    setDetailLoading(true)
    try {
      const [{ data: payments }, { data: escalations }] = await Promise.all([
        supabase
          .from('payments')
          .select('*, communities(name, slug, platform, whatsapp_setup_mode), plans(name)')
          .eq('email', s.email)
          .eq('community_id', s.community_id)
          .order('created_at', { ascending: false })
          .limit(10),
        s.whatsapp_phone
          ? supabase
              .from('ai_escalations')
              .select('*')
              .eq('phone', s.whatsapp_phone)
              .order('created_at', { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] }),
      ])
      setMemberPayments(payments || [])
      setMemberEscalations(escalations || [])
    } catch {
      setMemberPayments([])
      setMemberEscalations([])
    } finally {
      setDetailLoading(false)
    }
  }

  const getAuthHeaders = async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  const handleRemove = async (s) => {
    setRemoving(s.id)
    try {
      const res = await fetch(`${API_BASE}/api/members/${s.id}/remove`, { method: 'POST', headers: await getAuthHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to remove member')
      toast.success('Member removed')
      fetchSubs()
      if (selected?.id === s.id) setSelected(prev => prev ? { ...prev, status: 'cancelled' } : prev)
    } catch (err) { toast.error(err.message || 'Failed to remove member') }
    setRemoving(null)
  }

  const handleResend = async (s) => {
    setResending(s.id)
    try {
      const res = await fetch(`${API_BASE}/api/members/${s.id}/resend-invite`, { method: 'POST', headers: await getAuthHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to resend invite')
      toast.success('Invite resent')
    } catch (err) { toast.error(err.message || 'Failed to resend invite') }
    setResending(null)
  }

  const verifyPayment = async (reference) => {
    if (!reference) return
    setVerifyingPayment(reference)
    try {
      const res = await fetch(`${API_BASE}/api/payments/verify/${encodeURIComponent(reference)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.message || 'Payment could not be verified')
      toast.success(data.already_processed ? 'Payment already processed' : 'Payment verified')
      await fetchSubs()
      if (selected) await loadMemberDetails(selected)
    } catch (err) {
      toast.error(err.message || 'Payment could not be verified')
    } finally {
      setVerifyingPayment(null)
    }
  }

  const extendSubscription = async (s, days = 30) => {
    setExtending(s.id)
    try {
      const res = await fetch(`${API_BASE}/api/members/${s.id}/extend`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ days }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to extend subscription')
      toast.success(data.message || `Extended by ${days} days`)
      setSelected(data.subscription || s)
      await fetchSubs()
    } catch (err) {
      toast.error(err.message || 'Failed to extend subscription')
    } finally {
      setExtending(null)
    }
  }

  const resolveEscalation = async (id) => {
    setResolvingEscalation(id)
    try {
      const res = await fetch(`${API_BASE}/api/ai/escalations/${id}/resolve`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to resolve escalation')
      setMemberEscalations(prev => prev.map(e => e.id === id ? { ...e, status: 'resolved' } : e))
      toast.success('Escalation resolved')
    } catch (err) {
      toast.error(err.message || 'Failed to resolve escalation')
    } finally {
      setResolvingEscalation(null)
    }
  }

  const copyRenewalLink = (s) => {
    const slug = s.communities?.slug
    if (!slug) return toast.error('Community slug not available')
    const url = `${window.location.origin}/join/${slug}`
    navigator.clipboard.writeText(url)
    toast.success('Renewal link copied')
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = (tab === 'all' ? subscriptions : subscriptions.filter(s => s.status === tab))
    .filter(s => {
      if (!normalizedQuery) return true
      return [s.email, s.communities?.name, s.plans?.name, s.whatsapp_phone, String(s.telegram_user_id || ''), s.paystack_reference]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(normalizedQuery))
    })

  const counts = {
    all: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    expired: subscriptions.filter(s => s.status === 'expired').length,
    cancelled: subscriptions.filter(s => s.status === 'cancelled').length,
  }

  const Pill = ({ status }) => {
    if (status === 'active') return <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[12px] font-medium text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active</span>
    if (status === 'expired') return <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[12px] font-medium text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Expired</span>
    return <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-[12px] font-medium text-white/50"><span className="w-1.5 h-1.5 rounded-full bg-white/40" /> Cancelled</span>
  }

  const DetailRow = ({ label, value, mono }) => (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
      <span className="text-[12px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <span className={`text-[13px] font-semibold text-right text-gray-900 dark:text-white ${mono ? 'font-mono break-all' : ''}`}>{value || '—'}</span>
    </div>
  )

  return (
    <>
      <div className="mb-6">
        <h1 className="page-title text-gray-900 dark:text-[#f2f3f5]">Members</h1>
        <p className="body-md text-gray-600 dark:text-[#b5bac1] mt-1">All subscribers across your communities</p>
      </div>

      <div className="mb-3 flex flex-col gap-2 rounded-[8px] border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#111] sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search email, community, phone…"
          className="min-w-0 flex-1 rounded-[6px] border border-gray-200 bg-gray-50 px-3 py-2 data-primary text-gray-900 outline-none focus:border-[#c8f135] dark:border-white/10 dark:bg-black/20 dark:text-white"
        />
        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-[6px] data-primary text-[12px] font-bold transition-all capitalize ${tab === t ? 'bg-[#c8f135] text-black' : 'border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-white/45 dark:hover:bg-white/5'}`}>
              {t} <span className="ml-1 opacity-70 data-mono">{counts[t]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#111] rounded-[8px] shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3"><Skeleton width="w-full" height="h-6" /><Skeleton width="w-full" height="h-6" /><Skeleton width="w-full" height="h-6" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center px-6">
            <p className="section-title text-gray-900 dark:text-[#f2f3f5] mb-1">No {tab !== 'all' ? tab : ''} members</p>
            <p className="body-md text-gray-500 dark:text-[#96989d]">{tab === 'all' ? 'Members will appear here when they subscribe.' : `No members with "${tab}" status.`}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr className="border-b border-gray-200 dark:border-white/10">{['Member', 'Community / Plan', 'Platform ID', 'Started', 'Expires', 'Status', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left table-header text-gray-600 dark:text-[#b5bac1]">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {filtered.map(s => (
                    <tr key={s.id} onClick={() => setSelected(s)} className={`hover:bg-white/[0.025] transition-colors cursor-pointer ${s.status !== 'active' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar name={s.email} size={24} /><span className="data-primary text-gray-900 dark:text-[#f2f3f5] max-w-[180px] truncate">{s.email}</span></div></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="data-primary text-gray-800 dark:text-[#dbdee1]">{s.communities?.name}</span>
                          {s.plans?.name && <span className="body-md text-gray-500 dark:text-[#96989d]">· {s.plans.name}</span>}
                          {s.communities?.platform === 'whatsapp' && <WhatsAppModeBadge mode={s.communities?.whatsapp_setup_mode || 'basic'} size="xs" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 data-mono text-gray-500 dark:text-[#96989d]">{s.telegram_user_id || s.whatsapp_phone || '—'}</td>
                      <td className="px-4 py-3 data-mono text-gray-500 dark:text-[#96989d]">{new Date(s.started_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 data-mono text-gray-500 dark:text-[#96989d]">{new Date(s.expires_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><Pill status={s.status} /></td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelected(s)} className="label-xs px-2.5 py-1 rounded-[4px] font-bold text-[#c8f135] hover:bg-[#c8f135]/10 transition-colors">View</button>
                          {s.status === 'active' && <button onClick={() => setRemoveTarget(s)} disabled={removing === s.id} className="label-xs px-2.5 py-1 rounded-[4px] font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors">{removing === s.id ? '…' : 'Remove'}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100 dark:divide-white/[0.05]">
              {filtered.map(s => (
                <div key={s.id} onClick={() => setSelected(s)} className={`px-4 py-3.5 cursor-pointer ${s.status !== 'active' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-2"><div className="flex items-center gap-2.5 min-w-0"><Avatar name={s.email} size={24} /><p className="text-[14px] text-gray-900 dark:text-[#f2f3f5] font-semibold truncate">{s.email}</p></div><Pill status={s.status} /></div>
                  <p className="text-[14px] text-gray-800 dark:text-[#dbdee1] mb-1.5 ml-[34px]">{s.communities?.name}{s.plans?.name && <span className="text-gray-500 dark:text-[#96989d]"> · {s.plans.name}</span>}</p>
                  <div className="ml-[34px] flex flex-wrap items-center gap-2">
                    <p className="text-[14px] text-gray-500 dark:text-[#96989d]">Expires {new Date(s.expires_at).toLocaleDateString()}</p>
                    {s.communities?.platform === 'whatsapp' && <WhatsAppModeBadge mode={s.communities?.whatsapp_setup_mode || 'basic'} size="xs" />}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 text-[12px] text-gray-500 dark:border-white/10 dark:text-white/35">
            <span>{filtered.length} of {subscriptions.length} members</span>
            <span>Click a row to open member details</span>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove this member?"
        description={removeTarget?.email ? `${removeTarget.email} will lose access and their subscription will be cancelled.` : 'This member will lose access.'}
        confirmLabel="Remove member"
        loading={removing === removeTarget?.id}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={async () => { const target = removeTarget; setRemoveTarget(null); await handleRemove(target) }}
      />

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelected(null)}>
          <aside className="w-full max-w-lg h-[70vh] sm:h-[65vh] lg:h-full overflow-y-auto bg-white p-6 shadow-2xl dark:bg-[#111] rounded-t-2xl lg:rounded-none border-t border-gray-200 dark:border-white/10 lg:border-t-0 lg:border-l" onClick={e => e.stopPropagation()}>
            {/* Mobile Grab Handle Bar */}
            <div className="lg:hidden mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-white/20" />
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={selected.email} size={42} />
                <div className="min-w-0">
                  <h2 className="text-[20px] font-black text-gray-900 dark:text-white truncate">{selected.email}</h2>
                  <p className="text-[13px] text-gray-500 dark:text-white/40">{selected.communities?.name} · {selected.plans?.name || 'Plan'}</p>
                </div>
              </div>
              <button onClick={() => { setSelected(null); setSearchParams({}) }} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">✕</button>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              <Pill status={selected.status} />
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-bold text-gray-600 dark:bg-white/5 dark:text-white/50">{selected.communities?.platform || 'platform'}</span>
              {selected.communities?.platform === 'whatsapp' && (
                <WhatsAppModeBadge mode={selected.communities?.whatsapp_setup_mode || 'basic'} />
              )}
            </div>

            <div className="rounded-none border border-gray-200 p-4 dark:border-white/10 mb-5">
              <DetailRow label="Platform ID" value={selected.telegram_user_id || selected.whatsapp_phone} mono />
              {selected.communities?.platform === 'whatsapp' && (
                <DetailRow
                  label="WhatsApp mode"
                  value={(selected.communities?.whatsapp_setup_mode || 'basic') === 'advanced'
                    ? 'Advanced group automation (Beta)'
                    : 'Basic access — official WhatsApp delivery'}
                />
              )}
              <DetailRow label="Started" value={new Date(selected.started_at).toLocaleString()} />
              <DetailRow label="Expires" value={new Date(selected.expires_at).toLocaleString()} />
              <DetailRow label="Payment ref" value={selected.paystack_reference} mono />
              <DetailRow label="Subscription ID" value={selected.id} mono />
            </div>

            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={() => copyRenewalLink(selected)} className="rounded-none border border-gray-200 px-4 py-3 text-[13px] font-bold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5">Copy renewal link</button>
              <button onClick={() => extendSubscription(selected, 30)} disabled={extending === selected.id} className="rounded-none bg-[#c8f135] px-4 py-3 text-[13px] font-black text-black disabled:opacity-50">{extending === selected.id ? 'Extending…' : '+30 days'}</button>
              {selected.status === 'active' && selected.telegram_user_id && !selected.whatsapp_phone && <button onClick={() => handleResend(selected)} disabled={resending === selected.id} className="rounded-none bg-[#229ED9] px-4 py-3 text-[13px] font-black text-white disabled:opacity-50">{resending === selected.id ? 'Sending…' : 'Resend invite'}</button>}
              {selected.status === 'active' && <button onClick={() => setRemoveTarget(selected)} disabled={removing === selected.id} className="rounded-none border border-red-300 px-4 py-3 text-[13px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10">{removing === selected.id ? 'Removing…' : 'Remove member'}</button>}
            </div>

            <section className="mb-6">
              <h3 className="font-black text-gray-900 dark:text-white mb-3">Payment history</h3>
              {detailLoading ? <p className="text-sm text-gray-500">Loading…</p> : memberPayments.length ? memberPayments.map(p => (
                <div key={p.id} className="rounded-none border border-gray-200 p-3 mb-2 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">₦{Number(p.amount || 0).toLocaleString()}</p><span className="text-xs text-gray-500 capitalize">{p.status}</span></div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-gray-400 break-all">{p.paystack_reference}</p>
                    <a href={`/dashboard/payments?reference=${encodeURIComponent(p.paystack_reference)}`} className="text-xs font-bold text-[#c8f135] hover:underline">Open</a>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{new Date(p.created_at).toLocaleString()}</p>
                  {p.status === 'pending' && (
                    <button
                      onClick={() => verifyPayment(p.paystack_reference)}
                      disabled={verifyingPayment === p.paystack_reference}
                      className="mt-2 rounded-lg bg-[#c8f135] px-3 py-1.5 text-xs font-black text-black disabled:opacity-50"
                    >
                      {verifyingPayment === p.paystack_reference ? 'Checking…' : 'Verify payment'}
                    </button>
                  )}
                </div>
              )) : <p className="text-sm text-gray-500">No payments found for this member/community.</p>}
            </section>

            <section>
              <h3 className="font-black text-gray-900 dark:text-white mb-3">AI escalations</h3>
              {detailLoading ? <p className="text-sm text-gray-500">Loading…</p> : memberEscalations.length ? memberEscalations.map(e => (
                <div key={e.id} className="rounded-none border border-gray-200 p-3 mb-2 dark:border-white/10">
                  <div className="flex items-center gap-2 mb-2"><span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-bold text-amber-500">{e.intent}</span><span className="text-xs text-gray-400">{e.status}</span></div>
                  <p className="text-sm text-gray-900 dark:text-white">{e.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(e.created_at).toLocaleString()}</p>
                  {e.status === 'open' && (
                    <button
                      onClick={() => resolveEscalation(e.id)}
                      disabled={resolvingEscalation === e.id}
                      className="mt-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5"
                    >
                      {resolvingEscalation === e.id ? 'Resolving…' : 'Mark resolved'}
                    </button>
                  )}
                </div>
              )) : <p className="text-sm text-gray-500">No AI escalations for this member.</p>}
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
