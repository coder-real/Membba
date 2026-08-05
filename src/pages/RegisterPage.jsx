import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import AuthShell, { GoogleIcon, authInputClass, authLabelClass } from '../components/AuthShell'
import Button from '../components/ui/Button'

function friendlyError(message) {
  if (!message) return 'Something went wrong. Please try again.'
  const m = message.toLowerCase()
  if (m.includes('user already registered') || m.includes('already been registered')) return 'An account with this email already exists. Try logging in instead.'
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters long.'
  if (m.includes('unable to validate email address') || m.includes('invalid email')) return 'Please enter a valid email address.'
  if (m.includes('signup is disabled')) return 'Sign-ups are temporarily disabled. Please try again later.'
  if (m.includes('too many requests') || m.includes('rate limit')) return 'Too many attempts. Please wait a moment before trying again.'
  return message
}

export default function RegisterPage() {
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters long.')
    setLoading(true)
    const { error } = await signUp(form.email, form.password, form.name)
    setLoading(false)
    if (error) toast.error(friendlyError(error.message))
    else { toast.success('Account created! Check your email to confirm.'); navigate('/dashboard') }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { setGoogleLoading(false); toast.error(friendlyError(error.message)) }
  }

  return (
    <AuthShell
      eyebrow="Start free"
      title="Create your Membba account"
      description="Monetize and operate private Telegram or WhatsApp communities from one dark-first dashboard."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-[var(--color-brand)] hover:opacity-80">Login</Link></>}
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
          <label className={authLabelClass}>Name</label>
          <input type="text" name="name" required value={form.name} onChange={handleChange} className={authInputClass} placeholder="Your name" />
        </div>
        <div>
          <label className={authLabelClass}>Email</label>
          <input type="email" name="email" required value={form.email} onChange={handleChange} className={authInputClass} placeholder="you@example.com" />
        </div>
        <div>
          <label className={authLabelClass}>Password</label>
          <input type="password" name="password" required value={form.password} onChange={handleChange} className={authInputClass} placeholder="At least 6 characters" />
        </div>
        <Button type="submit" variant="primary" disabled={loading} className="w-full py-3 disabled:opacity-50">
          {loading ? 'Creating account…' : 'Create account →'}
        </Button>
      </form>
    </AuthShell>
  )
}
