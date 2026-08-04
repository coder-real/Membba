import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

function friendlyError(message) {
  if (!message) return 'Something went wrong. Please try again.'
  const m = message.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.'
  if (m.includes('invalid')) return 'Please enter a valid email address.'
  return message
}

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const bg = dark ? 'bg-gray-50 dark:bg-[#0a0a0a]' : 'bg-gray-50'
  const card = dark ? 'bg-white dark:bg-[#111] border-gray-200 dark:border-[#1e1e1e]' : 'bg-white border-gray-200'
  const inputCls = dark
    ? 'bg-gray-50 dark:bg-[#0a0a0a] border-[#2a2a2a] text-black dark:text-white placeholder-gray-600 focus:border-[#9FFF57]/50 focus:ring-[#9FFF57]/25'
    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#7de040]/60 focus:ring-[#7de040]/20'

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await resetPassword(email.trim())
    setLoading(false)
    if (error) return toast.error(friendlyError(error.message))
    setSent(true)
    toast.success('Reset link sent')
  }

  return (
    <div className={`min-h-screen ${bg} flex flex-col transition-colors duration-300`}>
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1a1a1a]">
        <Link to="/" className="flex items-center gap-2">
          <img src="/green.svg" alt="Membba" className="h-7" />
          <span className="font-bold tracking-tight text-gray-900 dark:text-white">Membba</span>
        </Link>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] dark:text-white/60 transition-colors"
        >
          {dark ? '☀' : '☾'}
        </button>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className={`border rounded-2xl p-8 ${card}`}>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 text-xs text-[#9FFF57] border border-[#9FFF57]/25 bg-[#9FFF57]/5 rounded-full px-3 py-1 mb-5 tracking-widest uppercase">
                Password reset
              </div>
              <h1 className="text-2xl font-black mb-1 text-gray-900 dark:text-white">Forgot your password?</h1>
              <p className="text-sm text-gray-500">Enter your email and we’ll send you a secure reset link.</p>
            </div>

            {sent ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-[#9FFF57]/20 bg-[#9FFF57]/10 p-4">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Check your inbox</p>
                  <p className="text-sm text-gray-600 dark:text-white/50 mt-1">
                    If an account exists for <span className="font-semibold">{email}</span>, you’ll receive a password reset link shortly.
                  </p>
                </div>
                <Link to="/login" className="block text-center w-full bg-[#9FFF57] text-black py-3 rounded-xl font-black text-sm hover:bg-[#8aed47] transition-colors">
                  Back to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-gray-500">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-colors ${inputCls}`}
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#9FFF57] text-black py-3 rounded-xl font-black text-sm hover:bg-[#8aed47] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}

            <p className="text-xs text-center mt-6 text-gray-500">
              Remembered your password? <Link to="/login" className="text-[#9FFF57] hover:underline font-medium">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
