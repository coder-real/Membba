import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function MembersPage() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [removing, setRemoving] = useState(null) // subscription id being removed

  useEffect(() => { fetchMembers() }, [user])

  const fetchMembers = async () => {
    const { data: communities } = await supabase
      .from('communities')
      .select('id')
      .eq('creator_id', user.id)

    const communityIds = communities?.map(c => c.id) || []
    if (communityIds.length === 0) { setSubscriptions([]); setLoading(false); return }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, communities(name), plans(name)')
      .in('community_id', communityIds)
      .order('created_at', { ascending: false })

    if (error) toast.error(error.message)
    else setSubscriptions(data || [])
    setLoading(false)
  }

  const handleRemove = async (sub) => {
    if (!window.confirm(`Remove ${sub.email} from ${sub.communities?.name}? This will kick them from the Telegram group.`)) return

    setRemoving(sub.id)
    try {
      const res = await fetch(`/api/members/${sub.id}/remove`, { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        toast.success('Member removed successfully')
        // Update local state immediately
        setSubscriptions(prev =>
          prev.map(s => s.id === sub.id ? { ...s, status: 'cancelled' } : s)
        )
      } else {
        toast.error(data.message || 'Failed to remove member')
      }
    } catch {
      toast.error('Could not connect to server')
    } finally {
      setRemoving(null)
    }
  }

  const filtered = filter === 'all' ? subscriptions : subscriptions.filter(s => s.status === filter)

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-sm text-gray-500 mt-1">All subscribers across your communities</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'active', 'expired', 'cancelled'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize ${
              filter === f ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
            {f !== 'all' && (
              <span className="ml-1 text-xs opacity-60">
                ({subscriptions.filter(s => s.status === f).length})
              </span>
            )}
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
                <th className="px-4 py-2 text-left">Community / Plan</th>
                <th className="px-4 py-2 text-left">Telegram ID</th>
                <th className="px-4 py-2 text-left">Started</th>
                <th className="px-4 py-2 text-left">Expires</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className={s.status !== 'active' ? 'opacity-60' : ''}>
                  <td className="px-4 py-3">{s.email}</td>
                  <td className="px-4 py-3">
                    <span>{s.communities?.name}</span>
                    {s.plans?.name && <span className="text-gray-400 ml-1 text-xs">· {s.plans.name}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.telegram_user_id || '—'}</td>
                  <td className="px-4 py-3">{new Date(s.started_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{new Date(s.expires_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-500'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.status === 'active' ? (
                      <button
                        onClick={() => handleRemove(s)}
                        disabled={removing === s.id}
                        className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                      >
                        {removing === s.id ? 'Removing...' : 'Remove'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
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
