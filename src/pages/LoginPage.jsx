import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import AuthShell, { GoogleIcon, authInputClass, authLabelClass } from '../components/AuthShell'
import Button from '../components/ui/Button'

function friendlyError(message) {
  if (!message) return 'Something went wrong. Please try again.'
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) return 'Incorrect email or password. Please check and try again.'
  if (m.includes('email not confirmed')) return 'Please confirm your email address first. Check your inbox.'
  if (m.includes('user not found')) return 'No account found with that email. Would you like to register?'
  if (m.includes('too many requests') || m.includes('rate limit')) return 'Too many attempts. Please wait a minute before trying again.'
  return message
}

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(form.email, form.password)
    setLoading(false)
    if (error) toast.error(friendlyError(error.message))
    else { toast.success('Welcome back!'); navigate('/dashboard') }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { setGoogleLoading(false); toast.error(friendlyError(error.message)) }
  }

  return (
    <AuthShell
      eyebrow="Creator Dashboard"
      title="Welcome back"
      description="Log in to manage your paid communities, members, payments, and automations."
      footer={<>Secured by Supabase · Payments by Paystack</>}
    >
      <button onClick={handleGoogle} disabled={googleLoading} className="btn-secondary mb-5 w-full justify-center py-3 disabled:opacity-60">
        <GoogleIcon /> {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div className="mb-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
        <span className="text-[12px] text-[var(--color-text-muted)]">or with email</span>
        <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={authLabelClass}>Email</label>
          <input type="email" name="email" required value={form.email} onChange={handleChange} className={authInputClass} placeholder="you@example.com" />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Password</label>
            <Link to="/forgot-password" className="text-[12px] font-medium text-[var(--color-brand)] hover:opacity-80">Forgot password?</Link>
          </div>
          <input type="password" name="password" required value={form.password} onChange={handleChange} className={authInputClass} placeholder="Your password" />
        </div>
        <Button type="submit" variant="primary" disabled={loading} className="w-full py-3 disabled:opacity-50">
          {loading ? 'Signing in…' : 'Login to Dashboard →'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--color-text-secondary)]">
        Don't have an account? <Link to="/register" className="font-medium text-[var(--color-brand)] hover:opacity-80">Create one free</Link>
      </p>
    </AuthShell>
  )
}
