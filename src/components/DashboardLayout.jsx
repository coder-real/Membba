import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const navLinks = [
  { label: 'Overview', path: '/dashboard' },
  { label: 'Communities', path: '/dashboard/communities' },
  { label: 'Members', path: '/dashboard/members' },
  { label: 'Payments', path: '/dashboard/payments' },
  { label: 'Settings', path: '/dashboard/settings' },
]

export default function DashboardLayout({ children }) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    navigate('/')
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <Link to="/" className="text-xl font-bold text-black">Membba</Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`block px-3 py-2 rounded text-sm font-medium ${
                location.pathname === link.path
                  ? 'bg-black text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 truncate mb-2">{user?.email}</p>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
