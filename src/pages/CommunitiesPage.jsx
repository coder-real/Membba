import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'

const formatDuration = (minutes) => {
  if (!minutes) return '—'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  if (minutes < 10080) return `${Math.round(minutes / 1440)}d`
  if (minutes < 43200) return `${Math.round(minutes / 10080)}w`
  return `${Math.round(minutes / 43200)} mo`
}

export default function CommunitiesPage() {
  const { user } = useAuth()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCommunities()
  }, [user])

  const fetchCommunities = async () => {
    const { data, error } = await supabase
      .from('communities')
      .select('*, plans(id, name, price, duration_minutes, is_active), subscriptions(count)')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })

    if (error) toast.error(error.message)
    else setCommunities(data || [])
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this community? This cannot be undone.')) return
    const { error } = await supabase.from('communities').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Community deleted')
      fetchCommunities()
    }
  }

  const joinLink = (slug) => `${window.location.origin}/join/${slug}`

  const copyLink = (slug) => {
    navigator.clipboard.writeText(joinLink(slug))
    toast.success('Join link copied!')
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Communities</h1>
        <Link
          to="/dashboard/communities/new"
          className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
        >
          + New Community
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : communities.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-gray-500 mb-4">You haven't created any communities yet.</p>
          <Link
            to="/dashboard/communities/new"
            className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
          >
            Create Your First Community
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {communities.map(c => {
            const activePlans = (c.plans || []).filter(p => p.is_active)
            const memberCount = c.subscriptions?.[0]?.count ?? 0
            const isTelegram = !c.platform || c.platform === 'telegram'
            const isWhatsApp = c.platform === 'whatsapp'
            const hasBot = isTelegram ? Boolean(c.telegram_chat_id) : Boolean(c.whatsapp_group_id)

            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-base">{c.name}</h2>
                      {/* Platform badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isWhatsApp ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isWhatsApp
                          ? <><FaWhatsapp size={12} /> WhatsApp</>
                          : <><FaTelegram size={12} /> Telegram</>}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {!hasBot && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                          {isWhatsApp ? '⚠ Group not registered' : '⚠ Bot not configured'}
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{c.description}</p>
                    )}

                    {/* Plans */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {activePlans.length > 0 ? activePlans.map(p => (
                        <span key={p.id} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs">
                          {p.name} · ₦{p.price.toLocaleString()} · {formatDuration(p.duration_minutes)}
                        </span>
                      )) : (
                        <span className="text-xs text-red-500">No active plans — add one to accept payments</span>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-gray-400 font-mono truncate">
                      {joinLink(c.slug)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <span className="text-xs text-gray-500 self-center">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => copyLink(c.slug)}
                      className="text-xs border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50"
                    >
                      Copy Link
                    </button>
                    <Link
                      to={`/dashboard/communities/${c.id}/edit`}
                      className="text-xs border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
