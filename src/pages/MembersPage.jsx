import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/api'
import { useAuth } from '../context/AuthContext'

import Avatar from '../components/Avatar'
import Skeleton from '../components/ui/Skeleton'
import toast from 'react-hot-toast'

const TABS = ['all', 'active', 'expired', 'cancelled']

export default function MembersPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [removing, setRemoving] = useState(null)
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
      .select('*, communities(name, slug, platform), plans(name, price, duration_minutes)')
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
          .select('*, communities(name, slug, platform), plans(name)')
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

  const copyRenewalLink = (s) => {
    const slug = s.communities?.slug
    if (!slug) return toast.error('Community slug not available')
    const url = `${window.location.origin}/join/${slug}`
    navigator.clipboard.writeText(url)
    toast.success('Renewal link copied')
  }

  const filtered = tab === 'all' ? subscriptions : subscriptions.filter(s => s.status === tab)

  const counts = {
    all: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    expired: subscriptions.filter(s => s.status === 'expired').length,
    cancelled: subscriptions.filter(s => s.status === 'cancelled').length,
  }

  const Pill = ({ status }) => {
    if (status === 'active') return <span className="inline-flex items-center gap-1.5 bg-[#c8f135]/10 border border-[#c8f135]/10 px-2 py-0.5 rounded-[4px] text-[14px] font-bold text-[#c8f135]"><span className="w-1.5 h-1.5 rounded-full bg-[#c8f135]" /> Active</span>
    if (status === 'expired') return <span className="inline-flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/10 px-2 py-0.5 rounded-[4px] text-[14px] font-bold text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Expired</span>
    return <span className="inline-flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.05] px-2 py-0.5 rounded-[4px] text-[14px] font-bold text-gray-500 dark:text-[#96989d]"><span className="w-1.5 h-1.5 rounded-full bg-[#4f545c]" /> Cancelled</span>
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
        <h1 className="text-[24px] font-black text-gray-900 dark:text-[#f2f3f5] tracking-tight">Members</h1>
        <p className="text-[14px] text-gray-600 dark:text-[#b5bac1] mt-1">All subscribers across your communities</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-[4px] text-[14px] font-medium transition-all capitalize ${tab === t ? 'bg-white/[0.08] text-gray-900 dark:text-[#f2f3f5]' : 'text-gray-500 dark:text-[#96989d] hover:text-gray-800 dark:text-[#dbdee1] hover:bg-white/[0.03]'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)} <span className="ml-1.5 text-[14px]">{counts[t]}</span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#111] rounded-[8px] shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-7 space-y-4"><Skeleton width="w-full" height="h-6" /><Skeleton width="w-full" height="h-6" /><Skeleton width="w-full" height="h-6" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-[14px] font-semibold text-gray-900 dark:text-[#f2f3f5] mb-1">No {tab !== 'all' ? tab : ''} members</p>
            <p className="text-[14px] text-gray-500 dark:text-[#96989d]">{tab === 'all' ? 'Members will appear here when they subscribe.' : `No members with "${tab}" status.`}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead><tr className="border-b border-gray-200 dark:border-white/10">{['Member', 'Community / Plan', 'Platform ID', 'Started', 'Expires', 'Status', 'Actions'].map(h => <th key={h} className="px-5 py-3.5 text-left text-[14px] font-bold text-gray-600 dark:text-[#b5bac1] uppercase tracking-[0.8px]">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map(s => (
                    <tr key={s.id} onClick={() => setSelected(s)} className={`hover:bg-white/[0.025] transition-colors cursor-pointer ${s.status !== 'active' ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-3.5"><div className="flex items-center gap-2.5"><Avatar name={s.email} size={24} /><span className="text-[14px] font-semibold text-gray-900 dark:text-[#f2f3f5] max-w-[180px] truncate">{s.email}</span></div></td>
                      <td className="px-5 py-3.5"><span className="text-[14px] text-gray-800 dark:text-[#dbdee1]">{s.communities?.name}</span>{s.plans?.name && <span className="text-gray-500 dark:text-[#96989d] ml-2 text-[14px]">· {s.plans.name}</span>}</td>
                      <td className="px-5 py-3.5 font-mono text-[14px] text-gray-500 dark:text-[#96989d]">{s.telegram_user_id || s.whatsapp_phone || '—'}</td>
                      <td className="px-5 py-3.5 text-[14px] text-gray-500 dark:text-[#96989d]">{new Date(s.started_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-[14px] text-gray-500 dark:text-[#96989d]">{new Date(s.expires_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5"><Pill status={s.status} /></td>
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelected(s)} className="text-[14px] px-2.5 py-1 rounded-[4px] font-medium text-[#c8f135] hover:bg-[#c8f135]/10 transition-colors">View</button>
                          {s.status === 'active' && <button onClick={() => handleRemove(s)} disabled={removing === s.id} className="text-[14px] px-2.5 py-1 rounded-[4px] font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors">{removing === s.id ? '…' : 'Remove'}</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-white/[0.04]">
              {filtered.map(s => (
                <div key={s.id} onClick={() => setSelected(s)} className={`px-5 py-4 cursor-pointer ${s.status !== 'active' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-2"><div className="flex items-center gap-2.5 min-w-0"><Avatar name={s.email} size={24} /><p className="text-[14px] text-gray-900 dark:text-[#f2f3f5] font-semibold truncate">{s.email}</p></div><Pill status={s.status} /></div>
                  <p className="text-[14px] text-gray-800 dark:text-[#dbdee1] mb-1.5 ml-[34px]">{s.communities?.name}{s.plans?.name && <span className="text-gray-500 dark:text-[#96989d]"> · {s.plans.name}</span>}</p>
                  <p className="text-[14px] text-gray-500 dark:text-[#96989d] ml-[34px]">Expires {new Date(s.expires_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl dark:bg-[#111]" onClick={e => e.stopPropagation()}>
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
            </div>

            <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10 mb-5">
              <DetailRow label="Platform ID" value={selected.telegram_user_id || selected.whatsapp_phone} mono />
              <DetailRow label="Started" value={new Date(selected.started_at).toLocaleString()} />
              <DetailRow label="Expires" value={new Date(selected.expires_at).toLocaleString()} />
              <DetailRow label="Payment ref" value={selected.paystack_reference} mono />
              <DetailRow label="Subscription ID" value={selected.id} mono />
            </div>

            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={() => copyRenewalLink(selected)} className="rounded-xl border border-gray-200 px-4 py-3 text-[13px] font-bold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5">Copy renewal link</button>
              <button onClick={() => extendSubscription(selected, 30)} disabled={extending === selected.id} className="rounded-xl bg-[#c8f135] px-4 py-3 text-[13px] font-black text-black disabled:opacity-50">{extending === selected.id ? 'Extending…' : '+30 days'}</button>
              {selected.status === 'active' && selected.telegram_user_id && !selected.whatsapp_phone && <button onClick={() => handleResend(selected)} disabled={resending === selected.id} className="rounded-xl bg-[#229ED9] px-4 py-3 text-[13px] font-black text-white disabled:opacity-50">{resending === selected.id ? 'Sending…' : 'Resend invite'}</button>}
              {selected.status === 'active' && <button onClick={() => handleRemove(selected)} disabled={removing === selected.id} className="rounded-xl border border-red-300 px-4 py-3 text-[13px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10">{removing === selected.id ? 'Removing…' : 'Remove member'}</button>}
            </div>

            <section className="mb-6">
              <h3 className="font-black text-gray-900 dark:text-white mb-3">Payment history</h3>
              {detailLoading ? <p className="text-sm text-gray-500">Loading…</p> : memberPayments.length ? memberPayments.map(p => (
                <div key={p.id} className="rounded-xl border border-gray-200 p-3 mb-2 dark:border-white/10">
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
                <div key={e.id} className="rounded-xl border border-gray-200 p-3 mb-2 dark:border-white/10">
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
