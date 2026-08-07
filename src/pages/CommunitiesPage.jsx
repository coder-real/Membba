import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'
import { HiOutlineLink, HiOutlinePencilSquare, HiOutlineTrash, HiOutlinePlusCircle, HiOutlineUsers } from 'react-icons/hi2'
import Skeleton from '../components/ui/Skeleton'
import WhatsAppModeBadge from '../components/WhatsAppModeBadge'
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
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = communities
    .filter(c => {
      if (tab === 'telegram') return !c.platform || c.platform === 'telegram'
      if (tab === 'whatsapp') return c.platform === 'whatsapp'
      return true
    })
    .filter(c => {
      if (statusFilter === 'active') return c.is_active
      if (statusFilter === 'inactive') return !c.is_active
      if (statusFilter === 'needs_setup') {
        const isTelegram = !c.platform || c.platform === 'telegram'
        const isWhatsApp = c.platform === 'whatsapp'
        const hasBot = isTelegram ? Boolean(c.telegram_chat_id) : Boolean(c.whatsapp_group_id || (c.whatsapp_setup_mode || 'basic') === 'basic')
        return !hasBot || !c.plans?.some(p => p.is_active)
      }
      return true
    })
    .filter(c => {
      if (!normalizedQuery) return true
      return [c.name, c.slug, c.description, c.platform]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(normalizedQuery))
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
          className="inline-flex items-center gap-2 bg-[#c8f135] hover:bg-[#d6ff4f] text-black px-4 py-2 rounded-[6px] text-[14px] font-bold transition-colors shadow-sm"
        >
          <HiOutlinePlusCircle size={15} />
          New Community
        </Link>
      </div>

      <div className="mb-3 flex flex-col gap-2 rounded-[8px] border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#111]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search communities…"
            className="min-w-0 flex-1 rounded-[6px] border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-[#c8f135] dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
          <div className="flex flex-wrap gap-2">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 rounded-[6px] text-[12px] font-bold transition-colors ${
                  tab === t.id ? 'bg-[#c8f135] text-black' : 'border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-white/45 dark:hover:bg-white/5'
                }`}
              >
                {t.label} <span className="ml-1 opacity-70">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-white/5">
          {[
            { id: 'all', label: 'All statuses' },
            { id: 'active', label: 'Active' },
            { id: 'inactive', label: 'Inactive' },
            { id: 'needs_setup', label: 'Needs setup' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`rounded-[6px] px-3 py-1.5 text-[12px] font-bold transition ${statusFilter === item.id ? 'bg-white/[0.08] text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-50 dark:text-white/45 dark:hover:bg-white/5'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
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
          <Link to="/dashboard/communities/new" className="inline-flex items-center gap-2 bg-[#c8f135] hover:bg-[#d6ff4f] text-black px-6 py-2.5 rounded-[6px] text-[14px] font-bold transition-colors">
            <HiOutlinePlusCircle size={15} /> Create Community
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#111]">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10">
                  {['Community', 'Platform', 'Setup', 'Plans', 'Members', 'Join link', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[13px] font-bold uppercase tracking-[0.8px] text-gray-500 dark:text-[#b5bac1]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {filtered.map(c => {
                  const activePlans = (c.plans || []).filter(p => p.is_active)
                  const memberCount = c.subscriptions?.[0]?.count ?? 0
                  const isTelegram = !c.platform || c.platform === 'telegram'
                  const isWhatsApp = c.platform === 'whatsapp'
                  const hasSetup = isTelegram
                    ? Boolean(c.telegram_chat_id)
                    : ((c.whatsapp_setup_mode || 'basic') === 'basic' ? Boolean(c.whatsapp_group_invite_link) : Boolean(c.whatsapp_group_id))
                  const telegramAdminKnown = isTelegram && c.telegram_chat_id && typeof botStatus[c.id] === 'boolean'
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.025]">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-gray-900 dark:text-white">{c.name}</p>
                          <p className="mt-0.5 truncate text-[12px] text-gray-500 dark:text-white/35">/{c.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[12px] font-bold ${isWhatsApp ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-[#229ED9]/10 text-[#229ED9]'}`}>
                          {isWhatsApp ? <FaWhatsapp size={12} /> : <FaTelegram size={12} />}
                          {isWhatsApp ? 'WhatsApp' : 'Telegram'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-black ${hasSetup ? 'bg-[#c8f135]/10 text-[#c8f135]' : 'bg-amber-400/10 text-amber-400'}`}>
                            {hasSetup ? 'Ready' : 'Needs setup'}
                          </span>
                          {isWhatsApp && <WhatsAppModeBadge mode={c.whatsapp_setup_mode || 'basic'} size="xs" />}
                          {telegramAdminKnown && (
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${botStatus[c.id] ? 'bg-[#c8f135]/10 text-[#c8f135]' : 'bg-amber-400/10 text-amber-400'}`}>
                              {botStatus[c.id] ? 'Bot admin' : 'Bot missing'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {activePlans.length ? (
                          <div className="flex max-w-[220px] flex-wrap gap-1.5">
                            {activePlans.slice(0, 2).map(p => (
                              <span key={p.id} className="rounded-[6px] bg-gray-100 px-2 py-1 text-[12px] font-semibold text-gray-700 dark:bg-white/5 dark:text-white/65">{p.name} · ₦{Number(p.price || 0).toLocaleString()}</span>
                            ))}
                            {activePlans.length > 2 && <span className="text-[12px] text-gray-400">+{activePlans.length - 2}</span>}
                          </div>
                        ) : <span className="text-[12px] font-semibold text-red-400">No plans</span>}
                      </td>
                      <td className="px-4 py-3 text-[14px] font-semibold text-gray-700 dark:text-white/70"><HiOutlineUsers className="mr-1 inline" size={14} />{memberCount}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => copyLink(c.slug)} className="max-w-[210px] truncate font-mono text-[12px] text-gray-500 hover:text-[#c8f135] dark:text-white/35" title={joinLink(c.slug)}>
                          {joinLink(c.slug)}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isTelegram && <button onClick={() => openQRModal(c)} className="rounded-[6px] border border-gray-200 px-2.5 py-1.5 text-[12px] font-bold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5">QR</button>}
                          <Link to={`/dashboard/communities/${c.id}/edit`} className="rounded-[6px] border border-gray-200 px-2.5 py-1.5 text-[12px] font-bold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5">Edit</Link>
                          <button onClick={() => handleDelete(c.id)} className="rounded-[6px] border border-red-500/20 px-2.5 py-1.5 text-[12px] font-bold text-red-400 hover:bg-red-500/10">Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-white/[0.05] lg:hidden">
            {filtered.map(c => {
              const activePlans = (c.plans || []).filter(p => p.is_active)
              const memberCount = c.subscriptions?.[0]?.count ?? 0
              const isTelegram = !c.platform || c.platform === 'telegram'
              const isWhatsApp = c.platform === 'whatsapp'
              const hasSetup = isTelegram
                ? Boolean(c.telegram_chat_id)
                : ((c.whatsapp_setup_mode || 'basic') === 'basic' ? Boolean(c.whatsapp_group_invite_link) : Boolean(c.whatsapp_group_id))
              return (
                <div key={c.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-black text-gray-900 dark:text-white">{c.name}</p>
                      <p className="mt-0.5 text-[12px] text-gray-500 dark:text-white/35">/{c.slug} · {memberCount} member{memberCount !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-[6px] px-2 py-1 text-[12px] font-bold ${isWhatsApp ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-[#229ED9]/10 text-[#229ED9]'}`}>
                      {isWhatsApp ? <FaWhatsapp size={12} /> : <FaTelegram size={12} />}
                      {isWhatsApp ? 'WhatsApp' : 'Telegram'}
                    </span>
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[12px] font-black ${hasSetup ? 'bg-[#c8f135]/10 text-[#c8f135]' : 'bg-amber-400/10 text-amber-400'}`}>{hasSetup ? 'Ready' : 'Needs setup'}</span>
                    {isWhatsApp && <WhatsAppModeBadge mode={c.whatsapp_setup_mode || 'basic'} size="xs" />}
                    {activePlans.length ? <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-bold text-gray-600 dark:bg-white/5 dark:text-white/45">{activePlans.length} plan{activePlans.length !== 1 ? 's' : ''}</span> : <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[12px] font-bold text-red-400">No plans</span>}
                  </div>
                  <button onClick={() => copyLink(c.slug)} className="mb-3 block w-full truncate rounded-[6px] bg-gray-50 px-3 py-2 text-left font-mono text-[12px] text-gray-500 dark:bg-white/[0.03] dark:text-white/35">{joinLink(c.slug)}</button>
                  <div className="flex flex-wrap gap-2">
                    {isTelegram && <button onClick={() => openQRModal(c)} className="rounded-[6px] border border-gray-200 px-3 py-1.5 text-[12px] font-bold text-gray-600 dark:border-white/10 dark:text-white/50">QR Code</button>}
                    <Link to={`/dashboard/communities/${c.id}/edit`} className="rounded-[6px] border border-gray-200 px-3 py-1.5 text-[12px] font-bold text-gray-600 dark:border-white/10 dark:text-white/50">Edit</Link>
                    <button onClick={() => handleDelete(c.id)} className="rounded-[6px] border border-red-500/20 px-3 py-1.5 text-[12px] font-bold text-red-400">Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 text-[12px] text-gray-500 dark:border-white/10 dark:text-white/35">
            <span>{filtered.length} of {communities.length} communities</span>
            <span>Sorted newest first</span>
          </div>
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
