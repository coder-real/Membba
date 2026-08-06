import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
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
    <div className="h-8 w-8 overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]" title={name}>
      {avatar
        ? <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
        : <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-[var(--color-brand)]">{name[0]?.toUpperCase()}</div>}
    </div>
  )
}

function BotStatus({ online }) {
  return (
    <div className="flex items-center gap-2" title={online ? 'Bot online' : 'Bot offline'}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]">
        <span
          aria-hidden="true"
          className={`h-5 w-5 ${online ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`}
          style={{
            WebkitMask: "url('/bot-icon.svg') center / contain no-repeat",
            mask: "url('/bot-icon.svg') center / contain no-repeat",
          }}
        />
      </span>
      <span className={`hidden text-[12px] font-medium sm:inline ${online ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}

function ChannelStatusBar({ telegramOnline, whatsappOnline, metaOnline }) {
  const items = [
    { id: 'telegram', title: telegramOnline ? 'Telegram bot online' : 'Telegram not connected', online: telegramOnline, color: '#229ED9', Icon: FaTelegram },
    { id: 'whatsapp', title: whatsappOnline ? 'WhatsApp advanced connected' : 'WhatsApp advanced offline', online: whatsappOnline, color: '#25D366', Icon: FaWhatsapp },
    { id: 'api', title: metaOnline ? 'Official WhatsApp API configured' : 'Official WhatsApp API not configured', online: metaOnline, color: '#c8f135', Icon: Cloud },
  ]
  return (
    <button
      type="button"
      onClick={() => { window.location.href = '/dashboard/settings?tab=integrations' }}
      className="hidden items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-1 md:flex"
      title="Messaging channel status"
    >
      {items.map(item => {
        const Icon = item.Icon
        return (
          <span key={item.id} className="relative flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)]" title={item.title}>
            <Icon size={15} style={{ color: item.online ? item.color : 'var(--color-text-muted)' }} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[var(--color-bg-elevated)]" style={{ backgroundColor: item.online ? item.color : 'var(--color-danger)' }} />
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

  // If a user lands directly on a section with children, show its child nav.
  // If they manually close that same section, respect the close until they navigate elsewhere.
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

  const ParentButton = ({ item }) => {
    const active = activeNav.id === item.id || activeParent === item.id
    const Icon = item.Icon
    return (
      <button
        type="button"
        onClick={() => onParentClick(item)}
        className={`group/nav relative mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-[var(--radius-default)] border-l-2 px-3 py-[7px] text-left text-[13px] font-medium transition-all ${
          active
            ? 'border-transparent bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
            : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'
        } ${subnavOpen ? 'justify-center px-0' : ''}`}
        title={subnavOpen ? item.label : undefined}
      >
        <Icon size={18} strokeWidth={1.5} className="shrink-0" />
        <span className={`truncate ${subnavOpen ? 'hidden' : 'inline'}`}>{item.label}</span>
        {subnavOpen && (
          <span className="pointer-events-none absolute left-[46px] z-[90] whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-1 text-[12px] text-[var(--color-text-primary)] opacity-0 shadow-2xl transition-opacity duration-150 group-hover/nav:opacity-100">
            {item.label}
          </span>
        )}
      </button>
    )
  }

  const Sidebar = () => (
    <div className="flex h-full flex-col bg-[var(--color-bg-sidebar)] py-3 text-[var(--color-text-primary)]">
      <div className={`mb-1 flex items-center px-3 ${subnavOpen ? 'justify-center' : 'gap-2'}`}>
        <img src="/green.svg" alt="Membba" className="h-7" />
        <span className={`font-bold tracking-tight ${subnavOpen ? 'hidden' : 'inline'}`}>Membba</span>
      </div>
      <div className="space-y-1 pt-2">
        {NAV.map(item => <ParentButton key={item.id} item={item} />)}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-app)] text-[var(--color-text-primary)] font-sans">
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 z-50 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] transition-[width] duration-200 ease-in-out ${subnavOpen ? 'w-[52px]' : 'w-[220px]'}`}>
        <Sidebar />
      </aside>

      {subnavOpen && (
        <aside className="hidden lg:block fixed inset-y-0 left-[52px] z-40 w-[200px] border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] px-3 py-4 opacity-100 transition-[opacity,transform] duration-200 ease-in-out">
          <p className="mb-4 px-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{subnavParent.label}</p>
          {subnavParent.sections.map(section => (
            <div key={section.label} className="mb-5">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{section.label}</p>
              <div className="space-y-1">
                {section.items.map(child => {
                  const ChildIcon = child.Icon
                  return (
                    <Link
                      key={`${child.label}-${child.path}`}
                      to={child.path}
                      className={`flex items-center gap-2 rounded-[var(--radius-default)] border-l-2 px-3 py-2 text-[13px] font-medium transition-all ${
                        isChildActive(child.path)
                          ? 'border-transparent bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                          : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {ChildIcon && <ChildIcon size={18} strokeWidth={1.5} className="shrink-0" />}
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>
      )}

      {mobileOpen && <div className="fixed inset-0 z-40 bg-[var(--color-bg-overlay)] backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-[var(--color-border-subtle)] transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar />
      </aside>

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col transition-[margin] duration-200 ease-in-out ${subnavOpen ? 'lg:ml-[252px]' : 'lg:ml-[220px]'}`}>
        <header className="sticky top-0 z-10 flex h-[48px] flex-shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="btn-ghost p-1.5 lg:hidden">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-secondary)]">
              <span>Membba</span>
              <span className="text-[var(--color-text-muted)]">/</span>
              <span className="text-[var(--color-text-primary)]">{pageName}</span>
              <span className="ml-2 hidden rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-secondary)] sm:inline-flex">Creator Hub</span>
            </div>
          </div>
          <div className="relative flex items-center gap-3" ref={avatarMenuRef}>
            <ChannelStatusBar telegramOnline={channelStatus.telegram} whatsappOnline={channelStatus.whatsapp} metaOnline={channelStatus.meta} />
            <BotStatus online={botOnline} />
            <button type="button" onClick={() => setAvatarOpen(v => !v)} aria-label="Open account menu" className="rounded-full">
              <UserAvatar user={user} />
            </button>
            {avatarOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-[9999] w-[240px] origin-top-right rounded-[14px] border border-[var(--color-border-default)] p-2 text-[13px] opacity-100 shadow-2xl transition-all duration-150"
                style={{ backgroundColor: 'var(--color-bg-surface)', boxShadow: '0 18px 55px rgba(0,0,0,0.55)' }}
              >
                <div className="border-b border-[var(--color-border-subtle)] px-3 py-3 text-[var(--color-text-secondary)]">
                  <p className="truncate font-mono text-[12px]">{user?.email}</p>
                </div>
                <button onClick={() => { setAvatarOpen(false); navigate('/dashboard/settings?tab=account') }} className="mt-2 flex w-full items-center rounded-[var(--radius-md)] px-3 py-2 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]">
                  Account
                </button>
                <button onClick={() => { setAvatarOpen(false); navigate('/dashboard/settings?tab=billing') }} className="flex w-full items-center rounded-[var(--radius-md)] px-3 py-2 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]">
                  Upgrade to Pro
                </button>
                <div className="my-2 border-t border-[var(--color-border-subtle)] pt-2">
                  <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Theme</p>
                  <div className="space-y-1 pl-5 pr-2">
                    {['system', 'dark', 'light'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTheme(mode)}
                        className={`flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-1.5 text-left text-[12px] capitalize ${theme === mode ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'}`}
                      >
                        <span>{mode}</span>
                        {theme === mode && <span className="text-[var(--color-brand)]">•</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSignOut} className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)]">
                  <LogOut size={15} strokeWidth={1.5} /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--color-bg-app)]">
          <div className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-8 sm:py-10 page-enter">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}
