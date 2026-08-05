import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AuthShell, { authInputClass, authLabelClass } from '../components/AuthShell'
import Button from '../components/ui/Button'

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
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

  return (
    <AuthShell
      eyebrow="Secure reset"
      title="Create a new password"
      description="Choose a strong password for your Membba account."
    >
      {checking ? (
        <p className="text-[14px] text-[var(--color-text-secondary)]">Checking reset link…</p>
      ) : !ready ? (
        <div className="space-y-5">
          <div className="rounded-[var(--radius-xl)] border border-[rgba(239,68,68,0.2)] bg-[var(--color-danger-muted)] p-4">
            <p className="text-[14px] font-semibold text-[var(--color-danger)]">Reset link is invalid or expired</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">Please request a new password reset link.</p>
          </div>
          <Button as={Link} to="/forgot-password" variant="primary" className="w-full py-3">Request new link</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={authLabelClass}>New password</label>
            <input type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={authInputClass} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className={authLabelClass}>Confirm password</label>
            <input type="password" required minLength={8} value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} className={authInputClass} placeholder="Repeat password" />
          </div>
          <Button type="submit" variant="primary" disabled={loading} className="w-full py-3 disabled:opacity-50">
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
