import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    communities: 0,
    activeMembers: 0,
    expiredMembers: 0,
    totalRevenue: 0,
  })
  const [recentPayments, setRecentPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStats() }, [user])

  const fetchStats = async () => {
    setLoading(true)

    const { count: communityCount } = await supabase
      .from('communities').select('*', { count: 'exact', head: true }).eq('creator_id', user.id)

    const { data: communities } = await supabase
      .from('communities').select('id').eq('creator_id', user.id)

    const communityIds = communities?.map(c => c.id) || []
    let activeCount = 0, expiredCount = 0, revenue = 0

    if (communityIds.length > 0) {
      const { count: active } = await supabase
        .from('subscriptions').select('*', { count: 'exact', head: true })
        .in('community_id', communityIds).eq('status', 'active')

      const { count: expired } = await supabase
        .from('subscriptions').select('*', { count: 'exact', head: true })
        .in('community_id', communityIds).eq('status', 'expired')

      const { data: payments } = await supabase
        .from('payments').select('amount').in('community_id', communityIds).eq('status', 'success')

      const { data: recent } = await supabase
        .from('payments').select('*, communities(name), plans(name)')
        .in('community_id', communityIds).order('created_at', { ascending: false }).limit(5)

      activeCount = active || 0
      expiredCount = expired || 0
      revenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
      setRecentPayments(recent || [])
    }

    setStats({ communities: communityCount || 0, activeMembers: activeCount, expiredMembers: expiredCount, totalRevenue: revenue })
    setLoading(false)
  }

  const statCards = [
    { label: 'Total Revenue',    value: `₦${stats.totalRevenue.toLocaleString()}`, sub: 'All time earnings'       },
    { label: 'Communities',      value: stats.communities,                          sub: 'Active groups'           },
    { label: 'Active Members',   value: stats.activeMembers,                        sub: 'Current subscribers'     },
    { label: 'Expired Members',  value: stats.expiredMembers,                       sub: 'Lapsed subscriptions'    },
  ]

  const statusStyle = (s) => {
    if (s === 'success') return 'bg-[#9FFF57]/10 text-[#9FFF57] border border-[#9FFF57]/20'
    if (s === 'failed')  return 'bg-red-500/10 text-red-400 border border-red-500/20'
    return 'bg-white/5 text-white/40 border border-white/10'
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Overview</h1>
          <p className="text-[14px] text-white/50 mt-1.5">
            Welcome back, <span className="text-white/80">{user?.user_metadata?.name || user?.email}</span>
          </p>
        </div>
        <Link
          to="/dashboard/communities/new"
          className="flex-shrink-0 inline-flex items-center gap-2 border border-[#9FFF57]/40 text-[#9FFF57] px-5 py-2.5 rounded-lg text-[13px] font-bold hover:bg-[#9FFF57]/5 transition-colors"
        >
          ⊕ Create Community
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-[#111] border border-white/[0.07] rounded-xl p-6">
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-3">{card.label}</p>
            <p className="text-[28px] font-black text-white leading-none mb-1.5">
              {loading ? <span className="text-white/20">—</span> : card.value}
            </p>
            <p className="text-[12px] text-white/30">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent Payments */}
      <div className="bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-white">Recent Payments</h2>
            <p className="text-[12px] text-white/40 mt-0.5">Latest transactions across all communities</p>
          </div>
          <Link to="/dashboard/payments" className="text-[13px] text-[#9FFF57]/80 hover:text-[#9FFF57] transition-colors font-medium">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[13px] text-white/30">Loading...</div>
        ) : recentPayments.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[14px] text-white/40 mb-3">No payments yet.</p>
            <Link to="/dashboard/communities/new" className="text-[13px] text-[#9FFF57] underline underline-offset-4">
              Create a community to get started
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {['Email', 'Community', 'Amount', 'Date', 'Status'].map(h => (
                    <th key={h} className="px-6 py-4 text-left text-[11px] font-semibold text-white/35 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recentPayments.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-[13.5px] text-white/70">{p.email}</td>
                    <td className="px-6 py-4">
                      <span className="text-[13.5px] text-white/80">{p.communities?.name}</span>
                      {p.plans?.name && <span className="text-white/30 ml-2 text-[12px]">· {p.plans.name}</span>}
                    </td>
                    <td className="px-6 py-4 text-[14px] font-bold text-white">₦{p.amount?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-[12.5px] text-white/40">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block text-[11px] px-2.5 py-1 rounded-full font-semibold ${statusStyle(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
