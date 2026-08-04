import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const { dark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function prepareSession() {
      try {
        const code = params.get('code')
        if (code) await supabase.auth.exchangeCodeForSession(code)

        const { data } = await supabase.auth.getSession()
        setReady(Boolean(data.session))
      } catch {
        setReady(false)
      } finally {
        setChecking(false)
      }
    }
    prepareSession()
  }, [params])

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    if (form.password !== form.confirm) return toast.error("Passwords don't match")

    setLoading(true)
    const { error } = await updatePassword(form.password)
    setLoading(false)
    if (error) return toast.error(error.message)

    toast.success('Password updated. You can now log in.')
    await supabase.auth.signOut()
    navigate('/login')
  }

  const bg = dark ? 'bg-gray-50 dark:bg-[#0a0a0a]' : 'bg-gray-50'
  const card = dark ? 'bg-white dark:bg-[#111] border-gray-200 dark:border-[#1e1e1e]' : 'bg-white border-gray-200'
  const inputCls = dark
    ? 'bg-gray-50 dark:bg-[#0a0a0a] border-[#2a2a2a] text-black dark:text-white placeholder-gray-600 focus:border-[#9FFF57]/50 focus:ring-[#9FFF57]/25'
    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#7de040]/60 focus:ring-[#7de040]/20'

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
                Secure reset
              </div>
              <h1 className="text-2xl font-black mb-1 text-gray-900 dark:text-white">Create a new password</h1>
              <p className="text-sm text-gray-500">Choose a strong password for your Membba account.</p>
            </div>

            {checking ? (
              <p className="text-sm text-gray-500">Checking reset link…</p>
            ) : !ready ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                  <p className="text-sm font-bold text-red-600 dark:text-red-300">Reset link is invalid or expired</p>
                  <p className="text-sm text-red-500/80 dark:text-red-200/70 mt-1">Please request a new password reset link.</p>
                </div>
                <Link to="/forgot-password" className="block text-center w-full bg-[#9FFF57] text-black py-3 rounded-xl font-black text-sm hover:bg-[#8aed47] transition-colors">
                  Request new link
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-gray-500">New password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-colors ${inputCls}`}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-gray-500">Confirm password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-colors ${inputCls}`}
                    placeholder="Repeat password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#9FFF57] text-black py-3 rounded-xl font-black text-sm hover:bg-[#8aed47] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
