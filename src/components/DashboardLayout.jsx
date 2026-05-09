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
  HiOutlineArrowRightOnRectangle,
  HiOutlinePlusCircle,
  HiOutlineBars3,
  HiOutlineXMark,
  HiOutlineSun,
  HiOutlineMoon,
} from 'react-icons/hi2'

const navLinks = [
  { label: 'Overview',     path: '/dashboard',               Icon: HiOutlineSquares2X2 },
  { label: 'Communities',  path: '/dashboard/communities',   Icon: HiOutlineUserGroup  },
  { label: 'Members',      path: '/dashboard/members',       Icon: HiOutlineUsers      },
  { label: 'Payments',     path: '/dashboard/payments',      Icon: HiOutlineCreditCard },
  { label: 'Settings',     path: '/dashboard/settings',      Icon: HiOutlineCog6Tooth  },
]

export default function DashboardLayout({ children }) {
  const { user, signOut } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [open, setOpen] = useState(false)

  // Close sidebar when route changes on mobile
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    navigate('/')
  }

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Creator'
  const initial     = displayName[0]?.toUpperCase()

  // Theme-aware classes
  const sideBg      = dark ? 'bg-[#0a0a0a] border-white/[0.06]' : 'bg-white border-gray-200'
  const mainBg      = dark ? 'bg-[#0d0d0d] text-white' : 'bg-gray-50 text-gray-900'
  const headerBg    = dark ? 'bg-[#0a0a0a] border-white/[0.06]' : 'bg-white border-gray-200'
  const navActive   = dark ? 'bg-[#9FFF57]/10 text-white' : 'bg-[#9FFF57]/15 text-gray-900'
  const navInactive = dark ? 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
  const iconActive  = dark ? 'text-[#9FFF57]' : 'text-[#5ab020]'
  const iconInact   = dark ? 'text-white/30 group-hover:text-white/60' : 'text-gray-400 group-hover:text-gray-600'
  const userNameCls = dark ? 'text-white' : 'text-gray-900'
  const userEmailCls = dark ? 'text-white/30' : 'text-gray-400'
  const signOutCls  = dark ? 'text-white/35 hover:text-red-400 hover:bg-white/[0.04]' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
  const toggleBtnCls = dark
    ? 'bg-white/[0.07] hover:bg-white/[0.12] text-white/60'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-500'

  /* ── Shared sidebar content ─────────────────────────── */
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={`px-6 py-6 border-b ${dark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/green.svg" alt="Membba" className="h-8" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5">
        {navLinks.map(({ label, path, Icon }) => {
          const active = location.pathname === path ||
            (path !== '/dashboard' && location.pathname.startsWith(path))
          return (
            <Link
              key={path}
              to={path}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all ${
                active ? navActive : navInactive
              }`}
            >
              <Icon
                size={18}
                className={`flex-shrink-0 transition-colors ${active ? iconActive : iconInact}`}
              />
              {label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#9FFF57] flex-shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* New Community */}
      <div className="px-3 pb-4">
        <Link
          to="/dashboard/communities/new"
          className="flex items-center justify-center gap-2 w-full bg-[#9FFF57] text-black py-2.5 rounded-lg text-[13px] font-bold hover:bg-[#b0ff6e] active:bg-[#8aed47] transition-all"
        >
          <HiOutlinePlusCircle size={16} />
          New Community
        </Link>
      </div>

      {/* Theme toggle + User footer */}
      <div className={`px-4 py-4 border-t ${dark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#9FFF57]/10 border border-[#9FFF57]/20 flex items-center justify-center text-sm font-bold text-[#9FFF57] flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-semibold truncate leading-tight ${userNameCls}`}>{displayName}</p>
            <p className={`text-[11px] truncate leading-tight ${userEmailCls}`}>{user?.email}</p>
          </div>
          {/* Theme toggle in sidebar */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${toggleBtnCls}`}
          >
            {dark ? <HiOutlineSun size={14} /> : <HiOutlineMoon size={14} />}
          </button>
        </div>
        <button
          onClick={handleSignOut}
          className={`w-full flex items-center gap-2 px-3 py-2 text-[12.5px] rounded-lg transition-all ${signOutCls}`}
        >
          <HiOutlineArrowRightOnRectangle size={15} />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className={`flex min-h-screen ${mainBg} transition-colors duration-300`} style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Desktop Sidebar (hidden on mobile) ─────────── */}
      <aside className={`hidden lg:flex w-60 border-r flex-col flex-shrink-0 ${sideBg}`}>
        <SidebarContent />
      </aside>

      {/* ── Mobile Backdrop ─────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile Drawer Sidebar ───────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 border-r
        flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out
        lg:hidden
        ${open ? 'translate-x-0' : '-translate-x-full'}
        ${sideBg}
      `}>
        <button
          onClick={() => setOpen(false)}
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${
            dark ? 'text-white/40 hover:text-white hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          <HiOutlineXMark size={20} />
        </button>
        <SidebarContent />
      </aside>

      {/* ── Main Content ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">

        {/* Mobile Top Bar */}
        <header className={`lg:hidden flex items-center justify-between px-5 py-4 border-b sticky top-0 z-30 ${headerBg}`}>
          <button
            onClick={() => setOpen(true)}
            className={`p-1.5 rounded-lg transition-colors ${
              dark ? 'text-white/50 hover:text-white hover:bg-white/[0.06]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <HiOutlineBars3 size={22} />
          </button>

          <img src="/green.svg" alt="Membba" className="h-7" />

          <div className="flex items-center gap-1">
            {/* Theme toggle in mobile header */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`p-1.5 rounded-lg transition-colors ${
                dark ? 'text-white/50 hover:text-white hover:bg-white/[0.06]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {dark ? <HiOutlineSun size={18} /> : <HiOutlineMoon size={18} />}
            </button>
            <Link
              to="/dashboard/communities/new"
              className={`p-1.5 rounded-lg transition-colors ${
                dark ? 'text-[#9FFF57]/80 hover:text-[#9FFF57] hover:bg-[#9FFF57]/10' : 'text-[#5ab020] hover:text-[#3d8015] hover:bg-[#9FFF57]/10'
              }`}
            >
              <HiOutlinePlusCircle size={22} />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
