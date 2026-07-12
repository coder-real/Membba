import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'
import { HiOutlineLink, HiOutlinePencilSquare, HiOutlineTrash, HiOutlinePlusCircle, HiOutlineUsers } from 'react-icons/hi2'
import Skeleton from '../components/ui/Skeleton'
import API_BASE from '../lib/api'

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
  const [botStatus, setBotStatus] = useState({})
  const [qrModal, setQrModal] = useState(null)
  const [tab, setTab] = useState('all')

  const openQRModal = async (c) => {
    const deepLink = `https://t.me/membba_bot?start=join_${c.slug}`
    try {
      const dataUrl = await QRCode.toDataURL(deepLink, { width: 280, margin: 2 })
      setQrModal({ name: c.name, slug: c.slug, dataUrl, deepLink })
    } catch { toast.error('Failed to generate QR code') }
  }

  useEffect(() => { fetchCommunities() }, [user])

  const fetchCommunities = async () => {
    const { data, error } = await supabase
      .from('communities')
      .select('*, plans(id, name, price, duration_minutes, is_active), subscriptions(count)')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setCommunities(data || [])
    const telegramComms = (data || []).filter(c => !c.platform || c.platform === 'telegram')
    const checks = await Promise.allSettled(
      telegramComms.map(c =>
        fetch(`${API_BASE}/api/telegram/check-admin/${c.telegram_chat_id}`)
          .then(r => r.json())
          .then(d => ({ id: c.id, isAdmin: d.isAdmin }))
      )
    )
    const statusMap = {}
    checks.forEach(r => { if (r.status === 'fulfilled') statusMap[r.value.id] = r.value.isAdmin })
    setBotStatus(statusMap)
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this community? This cannot be undone.')) return
    const { error } = await supabase.from('communities').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Community deleted'); fetchCommunities() }
  }

  const joinLink = (slug) => `${window.location.origin}/join/${slug}`
  const copyLink = (slug) => { navigator.clipboard.writeText(joinLink(slug)); toast.success('Link copied!') }

  const filtered = communities.filter(c => {
    if (tab === 'telegram') return !c.platform || c.platform === 'telegram'
    if (tab === 'whatsapp') return c.platform === 'whatsapp'
    return true
  })

  const telegramCount  = communities.filter(c => !c.platform || c.platform === 'telegram').length
  const whatsappCount  = communities.filter(c => c.platform === 'whatsapp').length

  const TABS = [
    { id: 'all',      label: `All`, count: communities.length },
    { id: 'telegram', label: `Telegram`, count: telegramCount },
    { id: 'whatsapp', label: `WhatsApp`, count: whatsappCount },
  ]

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-7 mb-6">
        <div>
          <h1 className="text-[24px] font-black text-gray-900 dark:text-[#f2f3f5] tracking-tight">Communities</h1>
          <p className="text-[14px] text-gray-600 dark:text-[#b5bac1] mt-1">
            {communities.length} active group{communities.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/dashboard/communities/new"
          className="inline-flex items-center gap-2 bg-[#9FFF57] hover:bg-[#b0ff6e] text-black px-4 py-2 rounded-[6px] text-[14px] font-bold transition-colors shadow-sm"
        >
          <HiOutlinePlusCircle size={15} />
          New Community
        </Link>
      </div>

      {/* Pill Tab Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-[4px] text-[14px] font-medium transition-colors ${
              tab === t.id
                ? 'bg-white/[0.08] text-gray-900 dark:text-[#f2f3f5]'
                : 'text-gray-500 dark:text-[#96989d] hover:text-gray-800 dark:text-[#dbdee1] hover:bg-white/[0.03]'
            }`}
          >
            {t.label} 
            <span className={`ml-1.5 text-[14px] ${tab === t.id ? 'text-gray-900 dark:text-[#f2f3f5]/50' : 'text-gray-500 dark:text-[#72767d]'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(k => (
            <div key={k} className="bg-white dark:bg-[#111] rounded-[8px] p-7 shadow-sm border border-gray-200 dark:border-white/10">
              <Skeleton width="w-48" height="h-6" className="mb-4" />
              <Skeleton width="w-full" height="h-3" className="mb-2" />
              <Skeleton width="w-3/4" height="h-3" className="mb-6" />
              <div className="flex gap-2">
                <Skeleton width="w-24" height="h-8" />
                <Skeleton width="w-24" height="h-8" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#111] rounded-[8px] py-20 text-center px-6 border border-gray-200 dark:border-white/10">
          <p className="text-[14px] font-bold text-gray-900 dark:text-[#f2f3f5] mb-2">
            {tab === 'all' ? "No communities yet" : `No ${tab} communities`}
          </p>
          <p className="text-[14px] text-gray-500 dark:text-[#96989d] mb-6">
            {tab === 'all' ? 'Create your first paid community to start accepting members.' : `You haven't added any ${tab} groups yet.`}
          </p>
          <Link to="/dashboard/communities/new" className="inline-flex items-center gap-2 bg-[#9FFF57] hover:bg-[#b0ff6e] text-black px-6 py-2.5 rounded-[6px] text-[14px] font-bold transition-colors">
            <HiOutlinePlusCircle size={15} /> Create Community
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const activePlans = (c.plans || []).filter(p => p.is_active)
            const memberCount = c.subscriptions?.[0]?.count ?? 0
            const isTelegram  = !c.platform || c.platform === 'telegram'
            const isWhatsApp  = c.platform === 'whatsapp'
            const hasBot      = isTelegram ? Boolean(c.telegram_chat_id) : Boolean(c.whatsapp_group_id)

            return (
              <div key={c.id} className="bg-white dark:bg-[#111] rounded-[8px] p-7 shadow-sm border border-gray-200 dark:border-white/10 hover:bg-white/[0.02] transition-colors">
                
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-2.5 mb-3">
                  <h2 className="text-[16px] font-bold text-gray-900 dark:text-[#f2f3f5] mr-1">{c.name}</h2>

                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[14px] font-bold ${
                    isWhatsApp ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-[#229ED9]/10 text-[#229ED9]'
                  }`}>
                    {isWhatsApp ? <FaWhatsapp size={10} /> : <FaTelegram size={10} />}
                    {isWhatsApp ? 'WhatsApp' : 'Telegram'}
                  </span>

                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[14px] font-bold ${
                    c.is_active ? 'bg-[#9FFF57]/10 text-[#9FFF57]' : 'bg-white/[0.05] text-gray-500 dark:text-[#96989d]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-[#9FFF57]' : 'bg-[#4f545c]'}`} />
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>

                  {!hasBot && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[14px] font-bold bg-yellow-400/10 text-yellow-400">
                      ⚠ {isWhatsApp ? 'Group not registered' : 'Bot not configured'}
                    </span>
                  )}

                  {isTelegram && c.telegram_chat_id && typeof botStatus[c.id] === 'boolean' && (
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[14px] font-bold ${
                      botStatus[c.id] ? 'bg-[#9FFF57]/10 text-[#9FFF57]' : 'bg-yellow-400/10 text-yellow-400'
                    }`}>
                      {botStatus[c.id] ? '✅ Bot admin' : '⚠️ Bot not detected'}
                    </span>
                  )}
                </div>

                {c.description && (
                  <p className="text-[14px] text-gray-800 dark:text-[#dbdee1] mb-5 leading-relaxed">{c.description}</p>
                )}

                {/* Plans */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {activePlans.length > 0 ? activePlans.map((p, idx) => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-[#1e1f22] text-gray-900 dark:text-[#f2f3f5] rounded-[6px] px-3 py-1.5 text-[14px] font-medium border border-transparent">
                      {p.name}
                      <span className="text-[#9FFF57] font-bold">₦{p.price.toLocaleString()}</span>
                      <span className="text-gray-500 dark:text-[#72767d]">· {formatDuration(p.duration_minutes)}</span>
                    </span>
                  )) : (
                    <span className="text-[14px] text-red-400/90 font-medium">No active plans — add one to accept payments</span>
                  )}
                </div>

                {/* Join link */}
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#1e1f22] rounded-[4px] px-3 py-2 mb-5 w-max max-w-full">
                  <HiOutlineLink size={14} className="text-gray-500 dark:text-[#96989d] flex-shrink-0" />
                  <span className="text-[14px] text-gray-600 dark:text-[#b5bac1] font-mono truncate">{joinLink(c.slug)}</span>
                </div>

                {/* Footer: member count + action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-7 pt-4 border-t border-gray-200 dark:border-white/10">
                  <span className="flex items-center gap-1.5 text-[14px] text-gray-600 dark:text-[#b5bac1] font-medium">
                    <HiOutlineUsers size={14} />
                    {memberCount} member{memberCount !== 1 ? 's' : ''}
                  </span>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => copyLink(c.slug)}
                      className="inline-flex items-center gap-1.5 text-[14px] text-gray-800 dark:text-[#dbdee1] border border-gray-200 dark:border-white/10 hover:bg-white/[0.02] px-3 py-1.5 rounded-[4px] font-medium transition-colors"
                    >
                      <HiOutlineLink size={13} /> Copy Link
                    </button>
                    {isTelegram && (
                      <button
                        onClick={() => openQRModal(c)}
                        className="inline-flex items-center gap-1.5 text-[14px] text-gray-800 dark:text-[#dbdee1] border border-gray-200 dark:border-white/10 hover:bg-white/[0.02] px-3 py-1.5 rounded-[4px] font-medium transition-colors"
                      >
                        QR Code
                      </button>
                    )}
                    <Link
                      to={`/dashboard/communities/${c.id}/edit`}
                      className="inline-flex items-center gap-1.5 text-[14px] text-gray-800 dark:text-[#dbdee1] border border-gray-200 dark:border-white/10 hover:bg-white/[0.02] px-3 py-1.5 rounded-[4px] font-medium transition-colors"
                    >
                      <HiOutlinePencilSquare size={13} /> Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="inline-flex items-center gap-1.5 text-[14px] text-red-400 border border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded-[4px] font-medium transition-colors"
                    >
                      <HiOutlineTrash size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-gray-50 dark:bg-[#0a0a0a] border border-white/[0.05] rounded-[8px] p-8 w-full max-w-xs text-center shadow-2xl relative">
            <button
              onClick={() => setQrModal(null)}
              className="absolute top-7 right-4 text-gray-500 dark:text-[#96989d] hover:text-gray-800 dark:text-[#dbdee1] transition-colors"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <p className="text-[14px] font-bold tracking-widest uppercase text-gray-600 dark:text-[#b5bac1] mb-1">Scan to Join</p>
            <h3 className="text-[16px] font-bold text-gray-900 dark:text-[#f2f3f5] mb-5">{qrModal.name}</h3>
            <img src={qrModal.dataUrl} alt="QR Code" className="w-52 h-52 mx-auto rounded-[8px] mb-4" />
            <p className="text-[14px] text-gray-500 dark:text-[#96989d] mb-6 leading-relaxed">
              Scan with your phone camera or Telegram to join via @membba_bot.
            </p>
            <a
              href={qrModal.dataUrl}
              download={`membba-qr-${qrModal.slug}.png`}
              className="inline-flex items-center gap-2 border border-white/[0.1] text-gray-800 dark:text-[#dbdee1] px-5 py-2.5 rounded-[4px] text-[14px] font-medium hover:bg-white/[0.02] transition-colors"
            >
              ⬇ Download PNG
            </a>
          </div>
        </div>
      )}
    </>
  )
}
