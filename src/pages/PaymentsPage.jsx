import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import API_BASE from '../lib/api'

import Avatar from '../components/Avatar'
import Skeleton from '../components/ui/Skeleton'
import WhatsAppModeBadge from '../components/WhatsAppModeBadge'
import CopyableField from '../components/ui/CopyableField'

export default function PaymentsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => { fetchPayments() }, [user])

  const fetchPayments = async () => {
    setLoading(true)
    const { data: communities } = await supabase.from('communities').select('id').eq('creator_id', user.id)
    const ids = communities?.map(c => c.id) || []
    if (!ids.length) { setPayments([]); setLoading(false); return }
    const { data } = await supabase
      .from('payments')
      .select('*, communities(name, platform, whatsapp_setup_mode), plans(name)')
      .in('community_id', ids)
      .order('created_at', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }

  async function verifyPayment(reference) {
    if (!reference) return
    setVerifying(reference)
    try {
      const res = await fetch(`${API_BASE}/api/payments/verify/${reference}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.message || 'Payment is not successful yet')
      toast.success(data.already_processed ? 'Already processed' : 'Payment verified')
      fetchPayments()
    } catch (err) {
      toast.error(err.message || 'Verification failed')
      fetchPayments()
    } finally {
      setVerifying(null)
    }
  }

  function openMember(payment) {
    const params = new URLSearchParams({ email: payment.email || '' })
    if (payment.community_id) params.set('community', payment.community_id)
    if (payment.whatsapp_phone) params.set('phone', payment.whatsapp_phone)
    else if (payment.telegram_user_id) params.set('phone', String(payment.telegram_user_id))
    navigate(`/dashboard/members?${params.toString()}`)
  }

  function copyReference(reference) {
    navigator.clipboard.writeText(reference || '')
    toast.success('Reference copied')
  }

  const referenceFilter = searchParams.get('reference') || ''
  const normalizedQuery = query.trim().toLowerCase()
  const visiblePayments = (referenceFilter ? payments.filter(p => p.paystack_reference === referenceFilter) : payments)
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => {
      if (!normalizedQuery) return true
      return [p.email, p.paystack_reference, p.communities?.name, p.plans?.name, p.whatsapp_phone, String(p.telegram_user_id || '')]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(normalizedQuery))
    })

  const totalRevenue   = payments.filter(p => p.status === 'success').reduce((s, p) => s + (p.amount || 0), 0)
  const now            = new Date()
  const monthRevenue   = payments.filter(p => p.status === 'success' && new Date(p.created_at).getMonth() === now.getMonth()).reduce((s, p) => s + (p.amount || 0), 0)
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const failedCount    = payments.filter(p => p.status === 'failed').length

  const summaryCards = [
    { label: 'TOTAL COLLECTED', value: `₦${(totalRevenue || 0).toLocaleString()}`, sub: 'All time', subColor: 'text-[#c8f135]' },
    { label: 'THIS MONTH',      value: `₦${(monthRevenue || 0).toLocaleString()}`, sub: 'This month', subColor: 'text-[#c8f135]' },
    { label: 'PENDING',         value: `₦${pendingPayments.reduce((s,p) => s + (p.amount||0), 0).toLocaleString()}`, sub: `${pendingPayments.length} transactions`, subColor: 'text-amber-500' },
    { label: 'FAILED',          value: failedCount === 0 ? '0' : failedCount,      sub: failedCount === 0 ? 'No issues' : `${failedCount} transactions`, subColor: failedCount ? 'text-red-400' : 'text-gray-500 dark:text-[#96989d]' },
  ]

  const Pill = ({ status }) => {
    if (status === 'success') return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[12px] font-medium text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Paid
      </span>
    )
    if (status === 'failed') return (
      <span className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full text-[12px] font-medium text-rose-400">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Failed
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[12px] font-medium text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Pending
      </span>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="page-title text-gray-900 dark:text-[#f2f3f5]">Payments</h1>
          <p className="body-md text-gray-600 dark:text-[#b5bac1] mt-1">Transaction history, references, and manual verification</p>
        </div>
        <button
          onClick={fetchPayments}
          className="btn-secondary"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-white dark:bg-[#111] rounded-none p-5 sm:p-6 shadow-sm border border-gray-200 dark:border-white/10 flex flex-col justify-between min-h-[95px] hover:bg-white/[0.02] transition-colors">
            <p className="table-header text-gray-500 dark:text-[#b5bac1] mb-2 text-[11px] sm:text-[12px] font-extrabold tracking-wider">{card.label}</p>
            {loading ? (
              <Skeleton width="w-24" height="h-9" />
            ) : (
              <div>
                <p className="font-sans text-[30px] sm:text-[36px] font-black text-gray-900 dark:text-[#f2f3f5] leading-none mb-2 tracking-tight">{card.value}</p>
                <p className={`text-[12px] font-bold ${card.subColor}`}>{card.sub}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {pendingPayments.length > 0 && !loading && (
        <div className="mb-5 rounded-[12px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 body-md text-amber-700 dark:text-amber-300">
          <span className="font-black">Pending payments:</span> If a customer says they paid but access was not created, use the Verify button beside their reference. This asks Paystack again and creates the subscription if payment succeeded.
        </div>
      )}

      {referenceFilter && (
        <div className="mb-5 rounded-[12px] border border-[#c8f135]/20 bg-[#c8f135]/10 px-4 py-3 body-md text-gray-700 dark:text-white/70">
          Showing payment reference <span className="data-mono font-bold">{referenceFilter}</span>. <button onClick={() => navigate('/dashboard/payments')} className="font-bold text-[#c8f135] hover:underline">Clear filter</button>
        </div>
      )}

      <div className="mb-3 flex flex-col gap-2 rounded-none border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#111] sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search email, reference, community…"
          className="min-w-0 flex-1 rounded-[6px] border border-gray-200 bg-gray-50 px-3 py-2 data-primary text-gray-900 outline-none focus:border-[#c8f135] dark:border-white/10 dark:bg-black/20 dark:text-white"
        />
        <div className="flex flex-wrap gap-2">
          {['all', 'success', 'pending', 'failed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-[6px] px-3 py-1.5 data-primary text-[12px] font-bold capitalize transition ${statusFilter === s ? 'bg-[#c8f135] text-black' : 'border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-white/45 dark:hover:bg-white/5'}`}>
              {s === 'success' ? 'paid' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#111] rounded-none shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            <Skeleton width="w-full" height="h-6" />
            <Skeleton width="w-full" height="h-6" />
            <Skeleton width="w-full" height="h-6" />
          </div>
        ) : visiblePayments.length === 0 ? (
          <div className="py-12 text-center px-6">
            <p className="section-title text-gray-900 dark:text-[#f2f3f5] mb-1">No transactions yet</p>
            <p className="body-md text-gray-500 dark:text-[#96989d]">Payments will appear here when members subscribe.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10">
                    {['Date', 'Member', 'Community', 'Plan', 'Reference', 'Amount', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left table-header text-gray-600 dark:text-[#b5bac1]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {visiblePayments.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.015] transition-colors cursor-default">
                      <td className="px-4 py-2.5 data-mono text-gray-600 dark:text-[#b5bac1]">
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={p.email} size={24} />
                          <span className="data-primary text-gray-900 dark:text-[#f2f3f5] max-w-[150px] truncate">{p.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="data-primary text-gray-800 dark:text-[#dbdee1]">{p.communities?.name}</span>
                          {p.communities?.platform === 'whatsapp' && <WhatsAppModeBadge mode={p.communities?.whatsapp_setup_mode || 'basic'} size="xs" />}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 body-md text-gray-800 dark:text-[#dbdee1]">{p.plans?.name || 'Standard'}</td>
                      <td className="px-4 py-2.5">
                        <CopyableField value={p.paystack_reference} label="Copy reference" className="w-[190px]" />
                      </td>
                      <td className="px-4 py-2.5 financial text-[#c8f135]">₦{p.amount?.toLocaleString()}</td>
                      <td className="px-4 py-2.5"><Pill status={p.status} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openMember(p)}
                            className="label-xs px-2.5 py-1 rounded-[4px] border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5"
                          >
                            Member
                          </button>
                          {p.status === 'pending' && (
                            <button
                              onClick={() => verifyPayment(p.paystack_reference)}
                              disabled={verifying === p.paystack_reference}
                              className="label-xs px-2.5 py-1 rounded-[4px] bg-[#c8f135] font-black text-black hover:bg-[#d6ff4f] disabled:opacity-50"
                            >
                              {verifying === p.paystack_reference ? 'Checking…' : 'Verify'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-gray-100 dark:divide-white/[0.05]">
              {visiblePayments.map(p => (
                <div key={p.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={p.email} size={24} />
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-[#f2f3f5] truncate">{p.email}</p>
                    </div>
                    <Pill status={p.status} />
                  </div>
                  <div className="flex flex-col ml-[34px] gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] text-gray-600 dark:text-[#b5bac1]">{p.communities?.name} · {p.plans?.name || 'Standard'}</p>
                      {p.communities?.platform === 'whatsapp' && <WhatsAppModeBadge mode={p.communities?.whatsapp_setup_mode || 'basic'} size="xs" />}
                    </div>
                    <p className="text-[14px] text-gray-600 dark:text-[#b5bac1]">
                      {new Date(p.created_at).toLocaleDateString()} — <span className="font-bold text-[#c8f135]">₦{p.amount?.toLocaleString()}</span>
                    </p>
                    <CopyableField value={p.paystack_reference} label="Copy reference" className="w-full" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => openMember(p)} className="w-fit rounded-[6px] border border-gray-200 px-3 py-1.5 text-[12px] font-bold text-gray-600 dark:border-white/10 dark:text-white/50">Open member</button>
                      {p.status === 'pending' && (
                        <button
                          onClick={() => verifyPayment(p.paystack_reference)}
                          disabled={verifying === p.paystack_reference}
                          className="w-fit rounded-[6px] bg-[#c8f135] px-3 py-1.5 text-[12px] font-black text-black disabled:opacity-50"
                        >
                          {verifying === p.paystack_reference ? 'Checking…' : 'Verify payment'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {!loading && visiblePayments.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 text-[12px] text-gray-500 dark:border-white/10 dark:text-white/35">
            <span>{visiblePayments.length} of {payments.length} payments</span>
            <span>Sorted newest first</span>
          </div>
        )}
      </div>
    </>
  )
}
