import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'
import { HiOutlineLink, HiOutlinePencilSquare, HiOutlineTrash } from 'react-icons/hi2'

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

  useEffect(() => { fetchCommunities() }, [user])

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
    else { toast.success('Community deleted'); fetchCommunities() }
  }

  const joinLink = (slug) => `${window.location.origin}/join/${slug}`
  const copyLink = (slug) => { navigator.clipboard.writeText(joinLink(slug)); toast.success('Join link copied!') }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Communities</h1>
          <p className="text-[14px] text-white/50 mt-1.5">Manage your paid community groups</p>
        </div>
        <Link
          to="/dashboard/communities/new"
          className="inline-flex items-center gap-2 border border-[#9FFF57]/40 text-[#9FFF57] px-4 py-2.5 rounded-lg text-[13px] font-bold hover:bg-[#9FFF57]/5 transition-colors"
        >
          ⊕ New Community
        </Link>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[13px] text-white/30">Loading...</div>
      ) : communities.length === 0 ? (
        <div className="bg-[#111] border border-white/[0.07] rounded-xl py-20 text-center px-6">
          <p className="text-[15px] text-white/50 mb-6">You haven't created any communities yet.</p>
          <Link to="/dashboard/communities/new" className="inline-flex items-center gap-2 bg-[#9FFF57] text-black px-6 py-3 rounded-lg text-[14px] font-bold hover:bg-[#b0ff6e] transition-colors">
            Create Your First Community →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {communities.map(c => {
            const activePlans  = (c.plans || []).filter(p => p.is_active)
            const memberCount  = c.subscriptions?.[0]?.count ?? 0
            const isTelegram   = !c.platform || c.platform === 'telegram'
            const isWhatsApp   = c.platform === 'whatsapp'
            const hasBot       = isTelegram ? Boolean(c.telegram_chat_id) : Boolean(c.whatsapp_group_id)

            return (
              <div key={c.id} className="bg-[#111] border border-white/[0.07] rounded-xl p-5 sm:p-6 hover:border-white/[0.12] transition-all">

                {/* Title row */}
                <div className="flex flex-wrap items-start gap-2 mb-2">
                  <h2 className="text-[15px] sm:text-[16px] font-bold text-white">{c.name}</h2>

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    isWhatsApp ? 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/25' : 'bg-[#229ED9]/10 text-[#229ED9] border-[#229ED9]/25'
                  }`}>
                    {isWhatsApp ? <FaWhatsapp size={11} /> : <FaTelegram size={11} />}
                    {isWhatsApp ? 'WhatsApp' : 'Telegram'}
                  </span>

                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    c.is_active ? 'bg-[#9FFF57]/10 text-[#9FFF57] border-[#9FFF57]/20' : 'bg-white/5 text-white/30 border-white/10'
                  }`}>
                    {c.is_active ? '● Active' : '○ Inactive'}
                  </span>

                  {!hasBot && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-yellow-400/10 text-yellow-400 border-yellow-400/20">
                      ⚠ {isWhatsApp ? 'Group not registered' : 'Bot not configured'}
                    </span>
                  )}
                </div>

                {c.description && (
                  <p className="text-[13px] text-white/50 mb-3 leading-relaxed">{c.description}</p>
                )}

                {/* Plans */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {activePlans.length > 0 ? activePlans.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 bg-white/[0.04] text-white/60 border border-white/[0.08] rounded-lg px-3 py-1 text-[12px] font-medium">
                      {p.name}
                      <span className="text-[#9FFF57] font-bold">₦{p.price.toLocaleString()}</span>
                      <span className="text-white/30">· {formatDuration(p.duration_minutes)}</span>
                    </span>
                  )) : (
                    <span className="text-[12.5px] text-red-400">No active plans — add one to accept payments</span>
                  )}
                </div>

                {/* Subscriber link */}
                <div className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 mb-4 max-w-full overflow-hidden">
                  <HiOutlineLink size={13} className="text-white/30 flex-shrink-0" />
                  <span className="text-[11.5px] text-white/40 font-mono truncate">{joinLink(c.slug)}</span>
                </div>

                {/* Actions + member count */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[12px] text-white/35 font-medium">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => copyLink(c.slug)} className="inline-flex items-center gap-1.5 text-[12px] border border-[#9FFF57]/25 text-[#9FFF57]/80 px-3 py-1.5 rounded-lg hover:bg-[#9FFF57]/5 hover:text-[#9FFF57] transition-all font-medium">
                      <HiOutlineLink size={13} /> Copy Link
                    </button>
                    <Link to={`/dashboard/communities/${c.id}/edit`} className="inline-flex items-center gap-1.5 text-[12px] border border-white/[0.1] text-white/50 px-3 py-1.5 rounded-lg hover:border-white/20 hover:text-white transition-all font-medium">
                      <HiOutlinePencilSquare size={13} /> Edit
                    </Link>
                    <button onClick={() => handleDelete(c.id)} className="inline-flex items-center gap-1.5 text-[12px] border border-red-500/15 text-red-400/70 px-3 py-1.5 rounded-lg hover:bg-red-500/5 hover:text-red-400 hover:border-red-500/30 transition-all font-medium">
                      <HiOutlineTrash size={13} /> Delete
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
