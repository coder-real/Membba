import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import toast from 'react-hot-toast'
import {
  HiOutlineSquares2X2,
  HiOutlineUserGroup,
  HiOutlineUsers,
  HiOutlineCreditCard,
  HiOutlineCog6Tooth,
  HiOutlineMagnifyingGlass,
  HiOutlineBolt,
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineArrowRightOnRectangle,
} from 'react-icons/hi2'
import { HiOutlineBolt as Bolt } from 'react-icons/hi2'

// ── Avatar initials circle ───────────────────────────────
const AVATAR_COLORS = ['#9FFF57','#57C4FF','#FF6B9D','#FFB347','#B39DFF','#48CFAD']
function UserAvatar({ name, size = 28 }) {
  const idx = name ? name.charCodeAt(0) % AVATAR_COLORS.length : 0
  const color = AVATAR_COLORS[idx]
  return (
    <div
      style={{ width: size, height: size, background: color + '22', border: `1.5px solid ${color}44`, color, fontSize: Math.floor(size * 0.38) }}
      className="rounded-full flex items-center justify-center font-bold select-none flex-shrink-0"
    >
      {name ? name[0].toUpperCase() : '?'}
    </div>
  )
}

// ── Nav structure (mirrors reference images exactly) ────
const WORKSPACE_LINKS = [
  { label: 'Communities', path: '/dashboard/communities', Icon: HiOutlineUserGroup  },
  { label: 'Members',     path: '/dashboard/members',     Icon: HiOutlineUsers      },
  { label: 'Payments',    path: '/dashboard/payments',    Icon: HiOutlineCreditCard },
]
const TOOL_LINKS = [
  { label: 'Automations', path: '/dashboard/automations', Icon: HiOutlineBolt },
  { label: 'Settings',    path: '/dashboard/settings',    Icon: HiOutlineCog6Tooth  },
]

export default function DashboardLayout({ children, pageTitle }) {
  const { user, signOut } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Creator'

  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    navigate('/')
  }

  const isActive = (path) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname === path || location.pathname.startsWith(path + '/')

  // Figure out breadcrumb label
  const allLinks = [
    { label: 'Overview', path: '/dashboard' },
    ...WORKSPACE_LINKS,
    ...TOOL_LINKS,
  ]
  const activeLink = allLinks.find(l => isActive(l.path)) || allLinks[0]
  const pageName = pageTitle || activeLink.label

  // Subscription counts placeholder (could be data-driven later)
  const COUNTS = {}

  // ── Reusable NavItem ─────────────────────────────────
  const NavItem = ({ label, path, Icon, count }) => {
    const active = isActive(path)
    return (
      <Link
        to={path}
        className={`group flex items-center gap-3 px-3 py-[9px] rounded-[8px] text-[14px] font-medium transition-all mx-2 ${
          active
            ? 'bg-[rgba(159,255,87,0.12)] text-white'
            : 'text-[#96989d] hover:text-[#dcddde] hover:bg-white/[0.04]'
        }`}
      >
        <Icon size={18} className={active ? 'text-[#9FFF57]' : 'text-[#72767d] group-hover:text-[#96989d]'} />
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && count !== null && (
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
            active ? 'bg-[#9FFF57]/20 text-[#9FFF57]' : 'bg-white/[0.08] text-white/50'
          }`}>
            {count}
          </span>
        )}
        {active && (
          <span className="w-[3px] h-4 bg-[#9FFF57] rounded-full absolute right-0" />
        )}
      </Link>
    )
  }

  // ── Section label ─────────────────────────────────────
  const SectionLabel = ({ label }) => (
    <p className="px-3 pt-4 pb-1 text-[11px] font-bold text-[#72767d] uppercase tracking-[0.7px] select-none">
      {label}
    </p>
  )

  // ── Sidebar body (reused for desktop + mobile drawer) ──
  const SidebarBody = () => (
    <div className="flex flex-col h-full">
      {/* Page/section header in sidebar (mirrors "Overview" at top) */}
      <div className="px-3 py-3 border-b border-white/[0.06] flex-shrink-0">
        <p className="text-[14px] font-bold text-white truncate">{pageName}</p>
      </div>

      {/* Nav scroll area */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Dashboard (top, ungrouped) */}
        <div className="mx-1 mt-1 mb-0.5">
          <Link
            to="/dashboard"
            className={`flex items-center gap-2.5 px-2 py-[7px] rounded-[6px] text-[13.5px] font-medium transition-all ${
              isActive('/dashboard')
                ? 'bg-[rgba(159,255,87,0.12)] text-white'
                : 'text-[#96989d] hover:text-[#dcddde] hover:bg-[rgba(255,255,255,0.06)]'
            }`}
          >
            <HiOutlineSquares2X2 size={16} className={isActive('/dashboard') ? 'text-[#9FFF57]' : 'text-[#72767d]'} />
            Dashboard
          </Link>
        </div>

        {/* WORKSPACE group */}
        <SectionLabel label="Workspace" />
        <div className="relative space-y-0.5">
          {WORKSPACE_LINKS.map(({ label, path, Icon }) => (
            <NavItem key={path} label={label} path={path} Icon={Icon} />
          ))}
        </div>

        {/* TOOLS group */}
        <SectionLabel label="Tools" />
        <div className="relative space-y-0.5">
          {TOOL_LINKS.map(({ label, path, Icon }) => (
            <NavItem key={path} label={label} path={path} Icon={Icon} />
          ))}
        </div>
      </div>

      {/* User card at bottom */}
      <div className="border-t border-white/[0.06] p-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.06] transition-all">
          <UserAvatar name={displayName} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white/90 truncate leading-tight">{displayName}</p>
            <p className="text-[11px] text-[#72767d] truncate leading-tight">Free plan</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              type="button"
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-[#72767d] hover:text-white hover:bg-white/[0.12] transition-all"
            >
              {dark ? <HiOutlineSun size={18} /> : <HiOutlineMoon size={18} />}
            </button>
            <button
              onClick={handleSignOut}
              type="button"
              aria-label="Sign out"
              className="p-2 rounded-lg text-[#72767d] hover:text-red-400 hover:bg-red-500/15 transition-all"
            >
              <HiOutlineArrowRightOnRectangle size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className="flex min-h-screen text-[14px] text-[#dcddde] bg-[#000]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Desktop Sidebar (Fixed, Hidden on Mobile) ───── */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-[240px] flex-col border-r border-white/[0.06] z-50 overflow-y-auto bg-[#111]"
      >
        <SidebarBody />
      </aside>

      {/* ── Mobile: Backdrop ─────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: Drawer ──────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-[#111]
          border-r border-white/[0.06]
          transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]
          lg:hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarBody />
      </aside>

      {/* ── Main content area with left margin for fixed sidebar ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen lg:ml-[240px]">

        {/* ── Topbar ─────────────────────────────────────── */}
        <header
          className="h-[60px] flex-shrink-0 border-b border-white/[0.06] bg-[#111]/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 sticky top-0"
        >
          {/* Left: mobile menu + breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="lg:hidden text-[#72767d] hover:text-white p-1.5 rounded transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5 text-[14px]">
              <span className="text-[#72767d] font-medium">Workspace</span>
              <span className="text-[#4f545c] font-light">·</span>
              <span className="text-white font-semibold">{pageName}</span>
            </div>
          </div>

          {/* Right: search */}
          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[13px] text-[#72767d] cursor-text hover:bg-white/[0.06] transition-all"
              style={{ background: '#1e1f22', minWidth: 160 }}
            >
              <HiOutlineMagnifyingGlass size={14} />
              <span>Search...</span>
            </div>
          </div>
        </header>

        {/* ── Page content ───────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8 page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
