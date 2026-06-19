import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import Skeleton from '../components/ui/Skeleton'
import Avatar from '../components/Avatar'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ communities: 0, activeMembers: 0, expiredMembers: 0, totalRevenue: 0 })
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
      const { count: active }  = await supabase.from('subscriptions').select('*', { count: 'exact', head: true }).in('community_id', communityIds).eq('status', 'active')
      const { count: expired } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true }).in('community_id', communityIds).eq('status', 'expired')
      const { data: payments } = await supabase.from('payments').select('amount').in('community_id', communityIds).eq('status', 'success')
      const { data: recent }   = await supabase.from('payments').select('*, communities(name), plans(name)').in('community_id', communityIds).order('created_at', { ascending: false }).limit(5)
      activeCount  = active || 0
      expiredCount = expired || 0
      revenue      = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
      setRecentPayments(recent || [])
    }

    setStats({ communities: communityCount || 0, activeMembers: activeCount, expiredMembers: expiredCount, totalRevenue: revenue })
    setLoading(false)
  }

  const statCards = [
    { label: 'TOTAL REVENUE',   value: `₦${stats.totalRevenue.toLocaleString()}`, sub: 'All time earnings',       trend: '↑ 40% vs last month',   trendColor: 'text-[#9FFF57]' },
    { label: 'ACTIVE MEMBERS',  value: stats.activeMembers,                        sub: 'Current subscribers',     trend: '↑ 5 this week',         trendColor: 'text-[#9FFF57]' },
    { label: 'COMMUNITIES',     value: stats.communities,                          sub: 'Active groups',           trend: '2 WhatsApp · 1 Telegram',trendColor: 'text-white/40' },
    { label: 'JUNE EARNINGS',   value: '₦8.5k',                                     sub: 'Projected stats',         trend: 'On track',              trendColor: 'text-white/40' },
  ]

  // Mock data for the chart layout
  const fakeChartPoints = "M0,60 L20,55 L40,49 L60,52 L80,45 L100,48 L120,38 L140,40 L160,30 L180,28 L200,29"

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-7 mb-6 mt-2">
        <div>
          <h1 className="text-[28px] font-black text-white tracking-tight leading-tight">Good morning, {user?.user_metadata?.name?.split(' ')[0] || 'Creator'} 👋</h1>
          <p className="text-[14px] text-white/50 mt-1.5">
            Here's what's happening with your communities.
          </p>
        </div>
        <Link
          to="/dashboard/communities/new"
          className="bg-[#9FFF57] hover:bg-[#b0ff6e] text-black px-4 py-2 rounded font-bold text-[14px] transition-colors shadow-sm"
        >
          New Community
        </Link>
      </div>

      {/* Stat Cards - Discord palette #111 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map((card, i) => (
          <div key={card.label} className="bg-[#111] rounded-[8px] p-7 flex flex-col justify-between shadow-sm min-h-[100px] hover:bg-white/[0.02] transition-colors border-l-2 border-transparent hover:border-[#9FFF57]/50 border-t border-r border-b border-white/[0.02]">
            <p className="text-[14px] font-bold text-[#b5bac1] uppercase tracking-wide mb-1">{card.label}</p>
            {loading ? (
              <Skeleton width="w-24" height="h-7" />
            ) : (
              <div className="flex flex-col">
                <p className="text-[24px] font-black text-white leading-none">{card.value}</p>
                <p className={`text-[14px] font-medium mt-2 ${card.trendColor}`}>{card.trend}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Split Layout: Chart & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        { /* Chart Column */ }
        <div className="lg:col-span-2 bg-[#111] rounded-[8px] p-7 shadow-sm min-h-[300px] flex flex-col justify-between border border-white/[0.02]">
          <div>
            <h2 className="text-[14px] font-bold text-[#f2f3f5] mb-0.5">Revenue over time</h2>
            <p className="text-[14px] text-[#b5bac1]">Last 30 days - All communities</p>
          </div>
          <div className="flex-1 w-full mt-8 relative">
            {/* Minimalist SVG Chart placeholder matching reference */}
            <svg viewBox="0 0 200 80" className="w-full h-full preserve-aspect-ratio-none" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#9FFF57" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#9FFF57" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${fakeChartPoints} L200,80 L0,80 Z`} fill="url(#chartGradient)" />
              <path d={fakeChartPoints} fill="none" stroke="#9FFF57" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="200" cy="29" r="2.5" fill="#9FFF57" />
            </svg>
            <div className="absolute bottom-[-20px] left-0 right-0 flex justify-between text-[14px] font-medium text-[#72767d]">
              <span>May 20</span>
              <span>Jun 3</span>
              <span>Jun 19</span>
            </div>
          </div>
        </div>

        { /* Activity Column */ }
        <div className="bg-[#111] rounded-[8px] p-7 shadow-sm border border-white/[0.02]">
          <h2 className="text-[14px] font-bold text-[#f2f3f5] mb-4">Recent activity</h2>
          {loading ? (
             <div className="space-y-4">
                {[1,2,3,4].map(k => <Skeleton key={k} width="w-full" height="h-4" />)}
             </div>
          ) : recentPayments.length === 0 ? (
             <p className="text-[14px] text-[#96989d]">No recent activity yet.</p>
          ) : (
            <div className="space-y-4">
              {recentPayments.map((p, i) => (
                <div key={p.id} className="flex items-start justify-between gap-3 text-[14px]">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#9FFF57] mt-1.5 flex-shrink-0" />
                    <p className="text-[#dbdee1] leading-snug">
                      <span className="font-semibold">{p.email}</span>{' '}
                      <span className="text-[#96989d]">paid ₦{p.amount?.toLocaleString()} for {p.communities?.name}</span>
                    </p>
                  </div>
                  <span className="text-[#72767d] whitespace-nowrap text-[14px]">
                    {new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
              
              {/* Demo activity items for the visual design */}
              <div className="flex items-start justify-between gap-3 text-[14px]">
                <div className="flex items-start gap-2.5 min-w-0">
                   <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                   <p className="text-[#dbdee1] leading-snug">
                      <span className="font-semibold">alex@gmail.com</span>'s <span className="text-[#96989d]">plan expiring soon</span>
                   </p>
                </div>
                <span className="text-[#72767d] whitespace-nowrap text-[14px]">1 day</span>
              </div>
              <div className="flex items-start justify-between gap-3 text-[14px]">
                <div className="flex items-start gap-2.5 min-w-0">
                   <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                   <p className="text-[#dbdee1] leading-snug">
                      <span className="font-semibold">john@doe.com</span> <span className="text-[#96989d]">was removed</span>
                   </p>
                </div>
                <span className="text-[#72767d] whitespace-nowrap text-[14px]">3 days ago</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Additional Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
        {/* Member Status Breakdown */}
        <div className="bg-[#111] rounded-[8px] p-7 shadow-sm border border-white/[0.02]">
          <h2 className="text-[14px] font-bold text-[#f2f3f5] mb-6">Member Status</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-[#b5bac1]">Active Subscriptions</span>
                <span className="text-[14px] font-bold text-[#9FFF57]">{loading ? '—' : stats.activeMembers}</span>
              </div>
              <div className="w-full bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#9FFF57] h-full" style={{ width: stats.activeMembers > 0 ? '100%' : '0%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-[#b5bac1]">Expired Subscriptions</span>
                <span className="text-[14px] font-bold text-[#ff6b6b]">{loading ? '—' : stats.expiredMembers}</span>
              </div>
              <div className="w-full bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#ff6b6b] h-full" style={{ width: stats.expiredMembers > 0 ? (stats.expiredMembers / (stats.activeMembers + stats.expiredMembers) * 100) : '0%' }} />
              </div>
            </div>
            <div className="pt-3 border-t border-white/[0.06] text-[12px] text-[#96989d]">
              <p>Total: {loading ? '—' : stats.activeMembers + stats.expiredMembers} members</p>
            </div>
          </div>
        </div>

        {/* Communities Overview */}
        <div className="bg-[#111] rounded-[8px] p-7 shadow-sm border border-white/[0.02]">
          <h2 className="text-[14px] font-bold text-[#f2f3f5] mb-6">Communities</h2>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[11px] text-[#72767d] uppercase tracking-wide mb-1">Total Communities</p>
              <p className="text-[28px] font-black text-white">{loading ? '—' : stats.communities}</p>
            </div>
            <div className="w-20 h-20 rounded-full border-4 border-[#9FFF57]/20 flex items-center justify-center">
              <span className="text-[14px] font-bold text-[#9FFF57]">{stats.communities > 0 ? '100%' : '0%'}</span>
            </div>
          </div>
          <div className="text-[12px] text-[#96989d]">
            <p>Active communities managing memberships</p>
          </div>
        </div>

        {/* Revenue Metrics */}
        <div className="bg-[#111] rounded-[8px] p-7 shadow-sm border border-white/[0.02]">
          <h2 className="text-[14px] font-bold text-[#f2f3f5] mb-6">Revenue Metrics</h2>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] text-[#72767d] uppercase tracking-wide mb-2">Avg. Revenue Per Member</p>
              <p className="text-[20px] font-bold text-[#9FFF57]">
                {loading ? '—' : stats.activeMembers > 0 ? `₦${Math.round(stats.totalRevenue / stats.activeMembers).toLocaleString()}` : '—'}
              </p>
            </div>
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-[11px] text-[#72767d] uppercase tracking-wide mb-2">Conversion Rate</p>
              <p className="text-[20px] font-bold text-[#f0883e]">
                {loading ? '—' : (stats.activeMembers + stats.expiredMembers) > 0 ? `${Math.round((stats.activeMembers / (stats.activeMembers + stats.expiredMembers)) * 100)}%` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
