import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'

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
      .select('*, subscriptions(count)')
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

  const paymentLink = (slug) => `${window.location.origin}/join/${slug}`

  const copyLink = (slug) => {
    navigator.clipboard.writeText(paymentLink(slug))
    toast.success('Payment link copied!')
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
        <div className="bg-white border border-gray-200 rounded p-10 text-center">
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
          {communities.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-base">{c.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <span>₦{c.price?.toLocaleString()} / {c.billing_cycle}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
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

              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                Payment link: <span className="font-mono">{paymentLink(c.slug)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
