import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

  const totalMembers = stats.activeMembers + stats.expiredMembers
  const statCards = [
    { label: 'TOTAL REVENUE',   value: `₦${stats.totalRevenue.toLocaleString()}`, sub: 'All time earnings', trend: stats.totalRevenue > 0 ? 'Live from successful payments' : 'No payments yet', trendColor: stats.totalRevenue > 0 ? 'text-[#c8f135]' : 'text-gray-500 dark:text-white/40' },
    { label: 'ACTIVE MEMBERS',  value: stats.activeMembers, sub: 'Current subscribers', trend: totalMembers > 0 ? `${totalMembers} total members` : 'No subscribers yet', trendColor: stats.activeMembers > 0 ? 'text-[#c8f135]' : 'text-gray-500 dark:text-white/40' },
    { label: 'COMMUNITIES',     value: stats.communities, sub: 'Active groups', trend: stats.communities > 0 ? 'Ready to accept members' : 'Create your first community', trendColor: stats.communities > 0 ? 'text-[#c8f135]' : 'text-gray-500 dark:text-white/40' },
    { label: 'EXPIRED MEMBERS', value: stats.expiredMembers, sub: 'Need renewal', trend: stats.expiredMembers > 0 ? 'Follow up recommended' : 'No expired members', trendColor: stats.expiredMembers > 0 ? 'text-amber-500' : 'text-gray-500 dark:text-white/40' },
  ]

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-gray-900 dark:text-white">Dashboard</h1>
          <p className="body-md text-gray-500 dark:text-white/50 mt-1">
            Here's what's happening across your communities.
          </p>
        </div>
        <Link
          to="/dashboard/communities/new"
          className="btn-primary"
        >
          New Community
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-[#111] rounded-none p-5 sm:p-6 flex flex-col justify-between shadow-sm hover:border-[#c8f135]/50 transition-colors border border-gray-200 dark:border-white/10">
            <p className="table-header text-gray-500 dark:text-white/50 uppercase mb-3 text-[11px] sm:text-[12px] font-extrabold tracking-wider">{card.label}</p>
            {loading ? (
              <Skeleton width="w-24" height="h-10" />
            ) : (
              <div className="flex flex-col">
                <p className="font-sans text-[34px] sm:text-[44px] font-black text-gray-900 dark:text-white leading-none tracking-tight">{card.value}</p>
                <p className={`text-[13px] font-bold mt-3 ${card.trendColor}`}>{card.trend}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Split Layout: Chart & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        { /* Chart Column */ }
        <div className="lg:col-span-2 bg-white dark:bg-[#111] rounded-none p-6 shadow-sm min-h-[300px] flex flex-col justify-between border border-gray-200 dark:border-white/10">
          <div>
            <h2 className="section-title text-gray-900 dark:text-white mb-0.5 text-[18px] font-black">Revenue over time</h2>
            <p className="body-md text-gray-500 dark:text-white/50 text-[14px]">Last 30 days — All communities</p>
          </div>
          <div className="flex-1 w-full mt-6 relative flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.02] p-6">
            {loading ? (
              <Skeleton width="w-3/4" height="h-24" />
            ) : stats.totalRevenue > 0 ? (
              <div className="w-full">
                <div className="mb-4 flex items-end justify-between">
                  <p className="font-sans text-[38px] sm:text-[48px] font-black text-gray-900 dark:text-white tracking-tight leading-none">₦{stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-[14px] font-black text-[#c8f135]">Total collected</p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"><div className="h-full w-full rounded-full bg-[#c8f135]" /></div>
                <p className="mt-3 text-[13px] text-gray-500 dark:text-white/40">Detailed revenue charts will accumulate as more payments come in.</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="section-title text-gray-900 dark:text-white text-[18px] font-bold">No revenue yet</p>
                <p className="mt-1 body-md text-gray-500 dark:text-white/40 text-[14px]">Revenue will appear here after your first successful payment.</p>
              </div>
            )}
          </div>
        </div>

        { /* Activity Column */ }
        <div className="bg-white dark:bg-[#111] rounded-none p-6 shadow-sm border border-gray-200 dark:border-white/10">
          <h2 className="section-title text-gray-900 dark:text-white mb-4 text-[18px] font-black">Recent activity</h2>
          {loading ? (
             <div className="space-y-4">
                {[1,2,3,4].map(k => <Skeleton key={k} width="w-full" height="h-4" />)}
             </div>
          ) : recentPayments.length === 0 ? (
             <p className="body-md text-gray-500 dark:text-white/40 text-[14px]">No recent activity yet.</p>
          ) : (
            <div className="space-y-4">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 text-[14px]">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-[#c8f135] mt-1.5 flex-shrink-0" />
                    <p className="text-gray-800 dark:text-[#dbdee1] leading-snug">
                      <span className="font-sans font-bold text-gray-900 dark:text-white">{p.email}</span>{' '}
                      <span className="body-md text-gray-500 dark:text-white/50">paid ₦{p.amount?.toLocaleString()} for {p.communities?.name}</span>
                    </p>
                  </div>
                  <span className="text-gray-400 dark:text-white/30 whitespace-nowrap text-[13px] font-mono">
                    {new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Additional Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {/* Member Status Breakdown */}
        <div className="bg-white dark:bg-[#111] rounded-none p-6 shadow-sm border border-gray-200 dark:border-white/10">
          <h2 className="section-title text-gray-900 dark:text-white mb-6 text-[18px] font-black">Member Status</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="body-md text-gray-600 dark:text-white/60 text-[14px]">Active Subscriptions</span>
                <span className="font-sans text-[20px] font-black text-[#c8f135]">{loading ? '—' : stats.activeMembers}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-white/[0.05] rounded-full h-2 overflow-hidden">
                <div className="bg-[#c8f135] h-full" style={{ width: stats.activeMembers > 0 ? '100%' : '0%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="body-md text-gray-600 dark:text-white/60 text-[14px]">Expired Subscriptions</span>
                <span className="font-sans text-[20px] font-black text-amber-500">{loading ? '—' : stats.expiredMembers}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-white/[0.05] rounded-full h-2 overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: stats.expiredMembers > 0 ? (stats.expiredMembers / (stats.activeMembers + stats.expiredMembers) * 100) : '0%' }} />
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-white/10 text-[13px] text-gray-500 dark:text-white/40 font-bold">
              <p>Total: {loading ? '—' : stats.activeMembers + stats.expiredMembers} members</p>
            </div>
          </div>
        </div>

        {/* Communities Overview */}
        <div className="bg-white dark:bg-[#111] rounded-none p-6 shadow-sm border border-gray-200 dark:border-white/10">
          <h2 className="section-title text-gray-900 dark:text-white mb-6 text-[18px] font-black">Communities</h2>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="table-header text-gray-400 dark:text-white/40 uppercase mb-1 text-[11px] font-extrabold tracking-wider">Total Communities</p>
              <p className="font-sans text-[34px] sm:text-[40px] font-black text-gray-900 dark:text-white leading-none mt-1">{loading ? '—' : stats.communities}</p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-[#c8f135]/30 flex items-center justify-center">
              <span className="font-sans text-[16px] font-black text-[#c8f135]">{stats.communities > 0 ? '100%' : '0%'}</span>
            </div>
          </div>
          <div className="text-[13px] text-gray-500 dark:text-white/40">
            <p>Active communities managing memberships</p>
          </div>
        </div>

        {/* Revenue Metrics */}
        <div className="bg-white dark:bg-[#111] rounded-none p-6 shadow-sm border border-gray-200 dark:border-white/10">
          <h2 className="section-title text-gray-900 dark:text-white mb-6 text-[18px] font-black">Revenue Metrics</h2>
          <div className="space-y-4">
            <div>
              <p className="table-header text-gray-400 dark:text-white/40 uppercase mb-2 text-[11px] font-extrabold tracking-wider">Avg. Revenue Per Member</p>
              <p className="font-sans text-[24px] sm:text-[28px] font-black text-[#c8f135]">
                {loading ? '—' : stats.activeMembers > 0 ? `₦${Math.round(stats.totalRevenue / stats.activeMembers).toLocaleString()}` : '—'}
              </p>
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-white/10">
              <p className="table-header text-gray-400 dark:text-white/40 uppercase mb-2 text-[11px] font-extrabold tracking-wider">Conversion Rate</p>
              <p className="font-sans text-[24px] sm:text-[28px] font-black text-amber-500">
                {loading ? '—' : (stats.activeMembers + stats.expiredMembers) > 0 ? `${Math.round((stats.activeMembers / (stats.activeMembers + stats.expiredMembers)) * 100)}%` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
