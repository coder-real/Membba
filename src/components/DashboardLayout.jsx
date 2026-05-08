import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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

  /* ── Shared sidebar content ─────────────────────────── */
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/[0.06]">
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
                active
                  ? 'bg-[#9FFF57]/10 text-white'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
            >
              <Icon
                size={18}
                className={`flex-shrink-0 transition-colors ${active ? 'text-[#9FFF57]' : 'text-white/30 group-hover:text-white/60'}`}
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

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#9FFF57]/10 border border-[#9FFF57]/20 flex items-center justify-center text-sm font-bold text-[#9FFF57] flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">{displayName}</p>
            <p className="text-[11px] text-white/30 truncate leading-tight">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-white/35 hover:text-red-400 hover:bg-white/[0.04] rounded-lg transition-all"
        >
          <HiOutlineArrowRightOnRectangle size={15} />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-[#0d0d0d] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Desktop Sidebar (hidden on mobile) ─────────── */}
      <aside className="hidden lg:flex w-60 bg-[#0a0a0a] border-r border-white/[0.06] flex-col flex-shrink-0">
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
        fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0a0a] border-r border-white/[0.06]
        flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out
        lg:hidden
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Close button inside drawer */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <HiOutlineXMark size={20} />
        </button>
        <SidebarContent />
      </aside>

      {/* ── Main Content ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">

        {/* Mobile Top Bar */}
        <header className="lg:hidden flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0a0a0a] sticky top-0 z-30">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <HiOutlineBars3 size={22} />
          </button>

          <img src="/green.svg" alt="Membba" className="h-7" />

          <Link
            to="/dashboard/communities/new"
            className="p-1.5 rounded-lg text-[#9FFF57]/80 hover:text-[#9FFF57] hover:bg-[#9FFF57]/10 transition-colors"
          >
            <HiOutlinePlusCircle size={22} />
          </Link>
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
