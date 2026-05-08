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

  useEffect(() => {
    fetchStats()
  }, [user])

  const fetchStats = async () => {
    setLoading(true)

    // Communities count
    const { count: communityCount } = await supabase
      .from('communities')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', user.id)

    // Get community IDs for this creator
    const { data: communities } = await supabase
      .from('communities')
      .select('id')
      .eq('creator_id', user.id)

    const communityIds = communities?.map(c => c.id) || []

    let activeCount = 0
    let expiredCount = 0
    let revenue = 0

    if (communityIds.length > 0) {
      // Active subscriptions
      const { count: active } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .in('community_id', communityIds)
        .eq('status', 'active')

      // Expired subscriptions
      const { count: expired } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .in('community_id', communityIds)
        .eq('status', 'expired')

      // Total revenue
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .in('community_id', communityIds)
        .eq('status', 'success')

      activeCount = active || 0
      expiredCount = expired || 0
      revenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0

      // Recent payments
      const { data: recent } = await supabase
        .from('payments')
        .select('*, communities(name), plans(name)')
        .in('community_id', communityIds)
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentPayments(recent || [])
    }

    setStats({
      communities: communityCount || 0,
      activeMembers: activeCount,
      expiredMembers: expiredCount,
      totalRevenue: revenue,
    })

    setLoading(false)
  }

  const statCards = [
    { label: 'Total Revenue', value: `₦${stats.totalRevenue.toLocaleString()}` },
    { label: 'Communities', value: stats.communities },
    { label: 'Active Members', value: stats.activeMembers },
    { label: 'Expired Members', value: stats.expiredMembers },
  ]

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.user_metadata?.name || user?.email}</p>
        </div>
        <Link
          to="/dashboard/communities/new"
          className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
        >
          + New Community
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded p-4">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold mt-1">
              {loading ? '—' : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Payments */}
      <div className="bg-white border border-gray-200 rounded">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Recent Payments</h2>
          <Link to="/dashboard/payments" className="text-xs text-gray-500 hover:underline">View all</Link>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
        ) : recentPayments.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            No payments yet.{' '}
            <Link to="/dashboard/communities/new" className="underline">Create a community</Link> to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Community</th>
                <th className="px-4 py-2 text-left">Amount</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentPayments.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3">
                    <span>{p.communities?.name}</span>
                    {p.plans?.name && <span className="text-gray-400 ml-1 text-xs">· {p.plans.name}</span>}
                  </td>
                  <td className="px-4 py-3">₦{p.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === 'success' ? 'bg-green-100 text-green-700'
                      : p.status === 'failed' ? 'bg-red-100 text-red-600'
                      : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  )
}
