import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'

const STATUS_STYLES = {
  active:    'bg-[#9FFF57]/10 text-[#9FFF57] border border-[#9FFF57]/20',
  expired:   'bg-red-500/10 text-red-400 border border-red-500/20',
  cancelled: 'bg-white/5 text-white/35 border border-white/10',
}

const FILTERS = ['all', 'active', 'expired', 'cancelled']

export default function MembersPage() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [removing, setRemoving] = useState(null)

  useEffect(() => { fetchMembers() }, [user])

  const fetchMembers = async () => {
    const { data: communities } = await supabase.from('communities').select('id').eq('creator_id', user.id)
    const communityIds = communities?.map(c => c.id) || []
    if (communityIds.length === 0) { setSubscriptions([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('subscriptions').select('*, communities(name), plans(name)')
      .in('community_id', communityIds).order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setSubscriptions(data || [])
    setLoading(false)
  }

  const handleRemove = async (sub) => {
    if (!window.confirm(`Remove ${sub.email} from ${sub.communities?.name}?`)) return
    setRemoving(sub.id)
    try {
      const res = await fetch(`/api/members/${sub.id}/remove`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success('Member removed successfully')
        setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'cancelled' } : s))
      } else { toast.error(data.message || 'Failed to remove member') }
    } catch { toast.error('Could not connect to server') }
    finally { setRemoving(null) }
  }

  const filtered = filter === 'all' ? subscriptions : subscriptions.filter(s => s.status === filter)

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Members</h1>
        <p className="text-[14px] text-white/50 mt-1.5">All subscribers across your communities</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-[12.5px] sm:text-[13px] font-semibold capitalize transition-all ${
              filter === f
                ? 'bg-[#9FFF57]/10 text-[#9FFF57] border border-[#9FFF57]/25'
                : 'bg-[#111] border border-white/[0.08] text-white/45 hover:text-white/70'
            }`}>
            {f}
            {f !== 'all' && <span className="ml-1.5 text-[11px] opacity-60">({subscriptions.filter(s => s.status === f).length})</span>}
          </button>
        ))}
      </div>

      <div className="bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[13px] text-white/30">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-white/35">No members found.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    {['Subscriber', 'Community / Plan', 'Telegram / WA ID', 'Started', 'Expires', 'Status', 'Action'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[11px] font-semibold text-white/35 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map(s => (
                    <tr key={s.id} className={`hover:bg-white/[0.02] transition-colors ${s.status !== 'active' ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-4 text-[13px] text-white/75 max-w-[160px] truncate">{s.email}</td>
                      <td className="px-5 py-4">
                        <span className="text-[13px] text-white/80">{s.communities?.name}</span>
                        {s.plans?.name && <span className="text-white/30 ml-2 text-[12px]">· {s.plans.name}</span>}
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-white/35">{s.telegram_user_id || s.whatsapp_phone || '—'}</td>
                      <td className="px-5 py-4 text-[12px] text-white/40">{new Date(s.started_at).toLocaleDateString()}</td>
                      <td className="px-5 py-4 text-[12px] text-white/40">{new Date(s.expires_at).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-block text-[11px] px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLES[s.status] || 'bg-white/5 text-white/35 border border-white/10'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {s.status === 'active' ? (
                          <button onClick={() => handleRemove(s)} disabled={removing === s.id}
                            className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400/80 hover:bg-red-500/5 hover:text-red-400 disabled:opacity-40 transition-all font-medium">
                            {removing === s.id ? 'Removing...' : 'Remove'}
                          </button>
                        ) : <span className="text-[12px] text-white/20">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-white/[0.04]">
              {filtered.map(s => (
                <div key={s.id} className={`px-5 py-4 ${s.status !== 'active' ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-[13px] text-white/80 font-medium truncate flex-1">{s.email}</p>
                    <span className={`flex-shrink-0 inline-block text-[11px] px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLES[s.status] || 'bg-white/5 text-white/35 border border-white/10'}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-white/40 mb-1">
                    {s.communities?.name}{s.plans?.name && <span> · {s.plans.name}</span>}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11.5px] text-white/30">Expires {new Date(s.expires_at).toLocaleDateString()}</p>
                    {s.status === 'active' && (
                      <button onClick={() => handleRemove(s)} disabled={removing === s.id}
                        className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400/80 hover:bg-red-500/5 disabled:opacity-40 transition-all font-medium">
                        {removing === s.id ? 'Removing...' : 'Remove'}
                      </button>
                    )}
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
