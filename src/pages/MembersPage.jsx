import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-600',
  pending: 'bg-yellow-100 text-yellow-700',
}

export default function MembersPage() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchMembers()
  }, [user])

  const fetchMembers = async () => {
    // Get creator's communities first
    const { data: communities } = await supabase
      .from('communities')
      .select('id')
      .eq('creator_id', user.id)

    const communityIds = communities?.map(c => c.id) || []

    if (communityIds.length === 0) {
      setSubscriptions([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, communities(name)')
      .in('community_id', communityIds)
      .order('created_at', { ascending: false })

    if (error) toast.error(error.message)
    else setSubscriptions(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all'
    ? subscriptions
    : subscriptions.filter(s => s.status === filter)

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-sm text-gray-500 mt-1">All subscribers across your communities</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'active', 'expired', 'pending'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize ${
              filter === f ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No members found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-left">Subscriber</th>
                <th className="px-4 py-2 text-left">Community</th>
                <th className="px-4 py-2 text-left">Telegram</th>
                <th className="px-4 py-2 text-left">Started</th>
                <th className="px-4 py-2 text-left">Expires</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-3">{s.subscriber_email}</td>
                  <td className="px-4 py-3">{s.communities?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.telegram_username || '—'}</td>
                  <td className="px-4 py-3">{new Date(s.start_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{new Date(s.expiry_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-500'}`}>
                      {s.status}
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
