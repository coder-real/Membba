import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FaTelegram as FaTg, FaWhatsapp as FaWa } from 'react-icons/fa'
import { useTheme } from '../context/ThemeContext'
import {
  Activity,
  BadgeCheck,
  BellDot,
  LogOut,
  House,
  Inbox,
  Orbit,
  Puzzle,
  Settings,
  Sparkles,
  SquareFunction,
  WalletCards,
  Cloud,
  ChevronRight,
  X,
  Menu,
  Moon,
  Sun,
  Laptop,
} from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', Icon: House },
  {
    id: 'communities',
    label: 'Communities',
    path: '/dashboard/communities',
    Icon: Orbit,
    sections: [
      { label: 'Communities', items: [
        { label: 'All communities', path: '/dashboard/communities', Icon: Orbit },
        { label: 'Create community', path: '/dashboard/communities/new', Icon: Sparkles },
      ]},
    ],
  },
  { id: 'members', label: 'Members', path: '/dashboard/members', Icon: BadgeCheck },
  { id: 'payments', label: 'Payments', path: '/dashboard/payments', Icon: WalletCards },
  {
    id: 'automation',
    label: 'Automations',
    path: '/dashboard/automations',
    Icon: SquareFunction,
    sections: [
      { label: 'AI Tools', items: [
        { label: 'Automations', path: '/dashboard/automations', Icon: SquareFunction },
        { label: 'Conversations', path: '/dashboard/ai-inbox', Icon: Inbox },
      ]},
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/dashboard/settings',
    Icon: Settings,
    sections: [
      { label: 'Account', items: [
        { label: 'My Account', path: '/dashboard/settings?tab=account', Icon: Settings },
        { label: 'Billing', path: '/dashboard/settings?tab=billing', Icon: WalletCards },
        { label: 'Notifications', path: '/dashboard/settings?tab=notifications', Icon: BellDot },
      ]},
      { label: 'Platform', items: [
        { label: 'Integrations', path: '/dashboard/settings?tab=integrations', Icon: Puzzle },
        { label: 'Danger Zone', path: '/dashboard/settings?tab=danger', Icon: Activity },
      ]},
    ],
  },
]

function UserAvatar({ user }) {
  const name = user?.user_metadata?.name || user?.email || 'Creator'
  const avatar = user?.user_metadata?.avatar_url
  return (
    <div className="h-9 w-9 overflow-hidden rounded-full border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5" title={name}>
      {avatar
        ? <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
        : <div className="flex h-full w-full items-center justify-center text-[13px] font-black text-[#c8f135]">{name[0]?.toUpperCase()}</div>}
    </div>
  )
}

function BotStatus({ online }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5" title={online ? 'WhatsApp Bot Active' : 'WhatsApp Bot Offline'}>
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-[#c8f135]' : 'bg-red-500'}`} />
      <span className={`hidden text-[13px] font-bold sm:inline ${online ? 'text-gray-700 dark:text-white/80' : 'text-red-400'}`}>
        {online ? 'Bot Active' : 'Offline'}
      </span>
    </div>
  )
}

function ChannelStatusBar({ telegramOnline, whatsappOnline, metaOnline, navigate, className = 'hidden md:flex' }) {
  const items = [
    { id: 'telegram', title: telegramOnline ? 'Telegram bot online' : 'Telegram not connected', online: telegramOnline, color: '#229ED9', Icon: FaTg },
    { id: 'whatsapp', title: whatsappOnline ? 'WhatsApp bot connected' : 'WhatsApp bot offline', online: whatsappOnline, color: '#25D366', Icon: FaWa },
    { id: 'api', title: metaOnline ? 'Official WhatsApp API configured' : 'Official WhatsApp API not configured', online: metaOnline, color: '#c8f135', Icon: Cloud },
  ]
  return (
    <button
      type="button"
      onClick={() => navigate('/dashboard/settings?tab=integrations')}
      className={`${className} items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 dark:border-white/10 dark:bg-white/5`}
      title="Messaging channel status"
    >
      {items.map(item => {
        const Icon = item.Icon
        return (
          <span key={item.id} className="relative flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-black" title={item.title}>
            <Icon size={13} style={{ color: item.online ? item.color : 'gray' }} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-black" style={{ backgroundColor: item.online ? item.color : '#ef4444' }} />
          </span>
        )
      })}
    </button>
  )
}

export default function DashboardLayout({ children, pageTitle }) {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeParent, setActiveParent] = useState(null)
  const [closedParent, setClosedParent] = useState(null)
  const [botOnline, setBotOnline] = useState(true)
  const [channelStatus, setChannelStatus] = useState({ telegram: false, whatsapp: false, meta: false })
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarMenuRef = useRef(null)

  const activeNav = useMemo(() => {
    return [...NAV].sort((a, b) => b.path.length - a.path.length).find(item => {
      if (item.path === '/dashboard') return location.pathname === '/dashboard'
      if (item.id === 'automation') return location.pathname === '/dashboard/automations' || location.pathname === '/dashboard/ai-inbox'
      return location.pathname === item.path || location.pathname.startsWith(item.path + '/')
    }) || NAV[0]
  }, [location.pathname])

  const subnavParent = NAV.find(item => item.id === activeParent && item.sections)
  const subnavOpen = Boolean(subnavParent)
  const pageName = pageTitle || activeNav.label

  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  useEffect(() => {
    if (activeNav.sections && closedParent !== activeNav.id) {
      setActiveParent(activeNav.id)
    }
    if (closedParent && activeNav.id !== closedParent) setClosedParent(null)
  }, [activeNav.id, closedParent])

  useEffect(() => {
    if (!avatarOpen) return
    const onPointerDown = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) setAvatarOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setAvatarOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [avatarOpen])

  const handleSignOut = async () => {
    await signOut()
    setAvatarOpen(false)
    navigate('/')
  }

  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const [health, telegram, whatsapp, meta] = await Promise.allSettled([
          fetch('/api/health'),
          fetch('/api/telegram/status').then(r => r.json()),
          fetch('/api/whatsapp/status').then(r => r.json()),
          fetch('/api/meta/status').then(r => r.json()),
        ])
        if (!alive) return
        setBotOnline(health.status === 'fulfilled' && health.value.ok)
        setChannelStatus({
          telegram: telegram.status === 'fulfilled' && Boolean(telegram.value?.online),
          whatsapp: whatsapp.status === 'fulfilled' && whatsapp.value?.status === 'connected',
          meta: meta.status === 'fulfilled' && Boolean(meta.value?.configured),
        })
      } catch {
        if (alive) {
          setBotOnline(false)
          setChannelStatus({ telegram: false, whatsapp: false, meta: false })
        }
      }
    }
    check()
    const id = setInterval(check, 30000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const isChildActive = (path) => {
    const [pathname, query = ''] = path.split('?')
    if (location.pathname !== pathname) return false
    if (!query) return true
    return location.search === `?${query}`
  }

  const onParentClick = (item) => {
    if (!item.sections) {
      setActiveParent(null)
      setClosedParent(null)
      navigate(item.path)
      return
    }
    if (activeParent === item.id) {
      setActiveParent(null)
      setClosedParent(item.id)
      return
    }
    setClosedParent(null)
    setActiveParent(item.id)
    navigate(item.sections[0]?.items[0]?.path || item.path)
  }

  // ── Desktop Sidebar Component ─────────────────────────────────────
  const DesktopSidebar = () => (
    <div className="flex h-full flex-col bg-[#0d0d0d] py-3 text-white border-r border-white/10">
      <div className={`mb-1 flex items-center px-3 ${subnavOpen ? 'justify-center' : 'gap-2.5'}`}>
        <img src="/green.svg" alt="Membba" className="h-8" />
        <span className={`font-black text-[18px] tracking-tight ${subnavOpen ? 'hidden' : 'inline'}`}>Membba</span>
      </div>
      <div className="space-y-1.5 pt-3">
        {NAV.map(item => {
          const active = activeNav.id === item.id || activeParent === item.id
          const Icon = item.Icon
          const collapsed = subnavOpen
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onParentClick(item)}
              className={`group/nav relative mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-none px-3.5 py-3 text-left text-[16px] font-semibold transition-all ${
                active
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon size={20} strokeWidth={1.8} className="shrink-0" />
              <span className={`truncate ${collapsed ? 'hidden' : 'inline'}`}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white font-sans">
      {/* Desktop Left Sidebar */}
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 z-50 flex-col transition-[width] duration-200 ease-in-out ${subnavOpen ? 'w-[52px]' : 'w-[220px]'}`}>
        <DesktopSidebar />
      </aside>

      {/* Desktop Subnav Panel */}
      {subnavOpen && (
        <aside className="hidden lg:block fixed inset-y-0 left-[52px] z-40 w-[200px] border-r border-white/10 bg-[#111111] px-3.5 py-4 opacity-100 transition-all duration-200">
          <p className="mb-4 px-2 text-[15px] font-black uppercase tracking-wider text-white">{subnavParent.label}</p>
          {subnavParent.sections.map(section => (
            <div key={section.label} className="mb-5">
              <p className="mb-2 px-2 text-[12px] font-bold uppercase tracking-[0.1em] text-white/40">{section.label}</p>
              <div className="space-y-1">
                {section.items.map(child => {
                  const ChildIcon = child.Icon
                  const active = isChildActive(child.path)
                  return (
                    <Link
                      key={`${child.label}-${child.path}`}
                      to={child.path}
                      className={`flex items-center gap-2.5 rounded-none px-3.5 py-2.5 text-[15px] font-medium transition-all ${
                        active
                          ? 'bg-white/10 text-white font-bold'
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {ChildIcon && <ChildIcon size={18} strokeWidth={1.6} className="shrink-0" />}
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>
      )}

      {/* ── SUPABASE-INSPIRED MOBILE DRAWER OVERLAY ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-[#0a0a0a]">
          {/* Top Drawer Header */}
          <div className="flex h-[52px] items-center justify-between border-b border-white/10 px-4 bg-[#111]">
            <div className="flex items-center gap-2 font-bold text-[15px] text-white">
              <img src="/green.svg" alt="Membba" className="h-6" />
              <span>membba</span>
              <span className="text-white/30">/</span>
              <span className="text-[#c8f135]">{pageName}</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 text-white/60 hover:text-white focus:outline-none"
              aria-label="Close drawer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Scrollable Navigation */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#0a0a0a]">
            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between bg-[#141414] border border-white/10 p-3 rounded-none">
              <div className="flex items-center gap-2">
                <BotStatus online={botOnline} />
                <ChannelStatusBar telegramOnline={channelStatus.telegram} whatsappOnline={channelStatus.whatsapp} metaOnline={channelStatus.meta} navigate={navigate} className="flex" />
              </div>
              <Link
                to="/dashboard/communities/new"
                onClick={() => setMobileOpen(false)}
                className="btn-primary text-[13px] px-3.5 py-1.5 inline-flex items-center gap-1.5 font-bold rounded-none"
              >
                <Sparkles size={14} /> + New Community
              </Link>
            </div>

            {/* Categorized Navigation Sections */}
            <div className="space-y-5">
              {/* Group 1: Core */}
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/40 mb-2 px-1">MAIN MENU</p>
                <div className="space-y-1 border border-white/10 bg-[#111] p-1 rounded-none">
                  {[
                    { label: 'Dashboard', path: '/dashboard', Icon: House },
                    { label: 'Communities', path: '/dashboard/communities', Icon: Orbit },
                    { label: 'Members', path: '/dashboard/members', Icon: BadgeCheck },
                    { label: 'Payments', path: '/dashboard/payments', Icon: WalletCards },
                  ].map(item => {
                    const Icon = item.Icon
                    const active = location.pathname === item.path
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-3 text-[15px] font-semibold transition-colors rounded-none ${
                          active ? 'bg-[#1a1a1a] text-white font-bold border-l-2 border-[#c8f135]' : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={19} className={active ? 'text-[#c8f135]' : 'text-white/50'} />
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight size={15} className="text-white/20" />
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Group 2: AI & Automations */}
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/40 mb-2 px-1">AUTOMATIONS & AI</p>
                <div className="space-y-1 border border-white/10 bg-[#111] p-1 rounded-none">
                  {[
                    { label: 'Automations', path: '/dashboard/automations', Icon: SquareFunction },
                    { label: 'AI Inbox Conversations', path: '/dashboard/ai-inbox', Icon: Inbox },
                  ].map(item => {
                    const Icon = item.Icon
                    const active = location.pathname === item.path
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-3 text-[15px] font-semibold transition-colors rounded-none ${
                          active ? 'bg-[#1a1a1a] text-white font-bold border-l-2 border-[#c8f135]' : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={19} className={active ? 'text-[#c8f135]' : 'text-white/50'} />
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight size={15} className="text-white/20" />
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Group 3: Settings */}
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/40 mb-2 px-1">SETTINGS & CONFIG</p>
                <div className="space-y-1 border border-white/10 bg-[#111] p-1 rounded-none">
                  {[
                    { label: 'My Account', path: '/dashboard/settings?tab=account', Icon: Settings },
                    { label: 'Billing & Plan', path: '/dashboard/settings?tab=billing', Icon: WalletCards },
                    { label: 'Notifications', path: '/dashboard/settings?tab=notifications', Icon: BellDot },
                    { label: 'Integrations', path: '/dashboard/settings?tab=integrations', Icon: Puzzle },
                  ].map(item => {
                    const Icon = item.Icon
                    const active = isChildActive(item.path)
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-3 text-[15px] font-semibold transition-colors rounded-none ${
                          active ? 'bg-[#1a1a1a] text-white font-bold border-l-2 border-[#c8f135]' : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={19} className={active ? 'text-[#c8f135]' : 'text-white/50'} />
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight size={15} className="text-white/20" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Footer Account Area */}
          <div className="p-4 border-t border-white/10 bg-[#111] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar user={user} />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">{user?.user_metadata?.name || 'Creator'}</p>
                  <p className="text-[11px] text-white/40 font-mono truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 text-red-400 hover:bg-red-500/10 transition-colors"
                title="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex min-h-screen min-w-0 flex-1 flex-col transition-[margin] duration-200 ease-in-out ${subnavOpen ? 'lg:ml-[252px]' : 'lg:ml-[220px]'}`}>
        <header className="sticky top-0 z-10 flex h-[56px] flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#0d0d0d] px-4 sm:px-6 relative">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-1.5 text-white/70 hover:text-white lg:hidden">
              <Menu size={22} />
            </button>
            <div className="hidden items-center gap-2 text-[16px] font-bold text-white/60 lg:flex">
              <span className="text-white font-black">membba</span>
              <span className="text-white/25">/</span>
              <span className="text-[#c8f135]">{pageName}</span>
              <span className="ml-2 border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/60">Creator Hub</span>
            </div>
          </div>
          <img src="/green.svg" alt="Membba" className="pointer-events-none absolute left-1/2 h-7 -translate-x-1/2 lg:hidden" />
          <div className="relative flex items-center gap-3" ref={avatarMenuRef}>
            <ChannelStatusBar telegramOnline={channelStatus.telegram} whatsappOnline={channelStatus.whatsapp} metaOnline={channelStatus.meta} navigate={navigate} />
            <BotStatus online={botOnline} />
            <button type="button" onClick={() => setAvatarOpen(v => !v)} aria-label="Open account menu" className="rounded-full">
              <UserAvatar user={user} />
            </button>
            {avatarOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-[9999] w-[240px] origin-top-right rounded-none border border-white/10 p-2 text-[13px] opacity-100 shadow-2xl transition-all duration-150 bg-[#111]"
                style={{ boxShadow: '0 18px 55px rgba(0,0,0,0.85)' }}
              >
                <div className="border-b border-white/10 px-3 py-3 text-white/60">
                  <p className="truncate font-mono text-[12px] text-white">{user?.email}</p>
                </div>
                <button onClick={() => { setAvatarOpen(false); navigate('/dashboard/settings?tab=account') }} className="mt-2 flex w-full items-center px-3 py-2 text-left text-white hover:bg-white/10">
                  Account
                </button>
                <button onClick={() => { setAvatarOpen(false); navigate('/dashboard/settings?tab=billing') }} className="flex w-full items-center px-3 py-2 text-left text-white hover:bg-white/10">
                  Upgrade to Pro
                </button>
                <div className="my-2 border-t border-white/10 pt-2">
                  <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-widest text-white/40">Theme</p>
                  <div className="space-y-1 pl-3 pr-2">
                    {['system', 'dark', 'light'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTheme(mode)}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] capitalize ${theme === mode ? 'bg-white/10 text-white font-bold' : 'text-white/60 hover:bg-white/5'}`}
                      >
                        <span>{mode}</span>
                        {theme === mode && <span className="text-[#c8f135]">•</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSignOut} className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-400 hover:bg-red-500/10">
                  <LogOut size={15} strokeWidth={1.5} /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#0a0a0a]">
          <div className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 sm:py-8 page-enter">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}
