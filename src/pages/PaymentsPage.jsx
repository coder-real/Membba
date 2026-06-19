import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import Avatar from '../components/Avatar'
import Skeleton from '../components/ui/Skeleton'

export default function PaymentsPage() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchPayments() }, [user])

  const fetchPayments = async () => {
    const { data: communities } = await supabase.from('communities').select('id').eq('creator_id', user.id)
    const ids = communities?.map(c => c.id) || []
    if (!ids.length) { setLoading(false); return }
    const { data } = await supabase
      .from('payments')
      .select('*, communities(name), plans(name)')
      .in('community_id', ids)
      .order('created_at', { ascending: false })
    setPayments(data || [])
    setLoading(false)
  }

  const totalRevenue   = payments.filter(p => p.status === 'success').reduce((s, p) => s + (p.amount || 0), 0)
  const now            = new Date()
  const monthRevenue   = payments.filter(p => p.status === 'success' && new Date(p.created_at).getMonth() === now.getMonth()).reduce((s, p) => s + (p.amount || 0), 0)
  
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const failedCount    = payments.filter(p => p.status === 'failed').length

  const summaryCards = [
    { label: 'TOTAL COLLECTED', value: `₦${(totalRevenue || 0).toLocaleString()}`, sub: 'All time', subColor: 'text-[#9FFF57]' },
    { label: 'THIS MONTH',      value: `₦${(monthRevenue || 0).toLocaleString()}`, sub: '↑ Up this month', subColor: 'text-[#9FFF57]' },
    { label: 'PENDING',         value: `₦${pendingPayments.reduce((s,p) => s + (p.amount||0), 0).toLocaleString()}`, sub: `${pendingPayments.length} transactions`, subColor: 'text-[#96989d]' },
    { label: 'FAILED',          value: failedCount === 0 ? 'NO' : failedCount,      sub: failedCount === 0 ? 'No issues' : `${failedCount} transactions`, subColor: 'text-[#96989d]' },
  ]

  const Pill = ({ status }) => {
    if (status === 'success') return (
      <span className="inline-flex items-center gap-1.5 bg-[#9FFF57]/10 border border-[#9FFF57]/10 px-2 py-0.5 rounded-[4px] text-[14px] font-bold text-[#9FFF57]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#9FFF57]" /> Paid
      </span>
    )
    if (status === 'failed') return (
      <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/10 px-2 py-0.5 rounded-[4px] text-[14px] font-bold text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Failed
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/10 px-2 py-0.5 rounded-[4px] text-[14px] font-bold text-yellow-400">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Pending
      </span>
    )
  }

  return (
    <DashboardLayout pageTitle="Payments">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-7 mb-6">
        <div>
          <h1 className="text-[24px] font-black text-[#f2f3f5] tracking-tight">Payments</h1>
          <p className="text-[14px] text-[#b5bac1] mt-1">Transaction history across all communities</p>
        </div>
        <button className="border border-white/[0.08] text-[#dbdee1] px-4 py-2 rounded-[6px] text-[14px] font-medium hover:bg-white/[0.02] transition-colors">
          Export
        </button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-[#111] rounded-[8px] p-7 shadow-sm border border-white/[0.02] flex flex-col justify-between min-h-[96px] hover:bg-white/[0.02] transition-colors">
            <p className="text-[14px] font-bold text-[#b5bac1] uppercase tracking-wide mb-1">{card.label}</p>
            {loading ? (
              <Skeleton width="w-24" height="h-7" />
            ) : (
              <div>
                <p className="text-[24px] font-black text-[#f2f3f5] leading-none mb-1">{card.value}</p>
                <p className={`text-[14px] font-bold ${card.subColor}`}>{card.sub}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Transactions table */}
      <div className="bg-[#111] rounded-[8px] shadow-sm border border-white/[0.02] overflow-hidden">
        {loading ? (
          <div className="p-7 space-y-4">
            <Skeleton width="w-full" height="h-6" />
            <Skeleton width="w-full" height="h-6" />
            <Skeleton width="w-full" height="h-6" />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-[14px] font-semibold text-[#f2f3f5] mb-1">No transactions yet</p>
            <p className="text-[14px] text-[#96989d]">Payments will appear here when members subscribe.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {['Date', 'Member', 'Community', 'Plan', 'Amount', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-[14px] font-bold text-[#b5bac1] uppercase tracking-[0.8px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.015] transition-colors cursor-default">
                      <td className="px-5 py-3 text-[14px] font-medium text-[#b5bac1]">
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={p.email} size={24} />
                          <span className="text-[14px] font-semibold text-[#f2f3f5] max-w-[150px] truncate">{p.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[14px] text-[#dbdee1]">{p.communities?.name}</td>
                      <td className="px-5 py-3 text-[14px] text-[#dbdee1]">{p.plans?.name || 'Standard'}</td>
                      <td className="px-5 py-3 text-[14px] font-bold text-[#9FFF57]">₦{p.amount?.toLocaleString()}</td>
                      <td className="px-5 py-3"><Pill status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-white/[0.04]">
              {payments.map(p => (
                <div key={p.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={p.email} size={24} />
                      <p className="text-[14px] font-semibold text-[#f2f3f5] truncate">{p.email}</p>
                    </div>
                    <Pill status={p.status} />
                  </div>
                  <div className="flex flex-col ml-[34px] gap-1">
                    <p className="text-[14px] text-[#b5bac1]">{p.communities?.name} · {p.plans?.name || 'Standard'}</p>
                    <p className="text-[14px] text-[#b5bac1]">
                      {new Date(p.created_at).toLocaleDateString()} — <span className="font-bold text-[#9FFF57]">₦{p.amount?.toLocaleString()}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
