import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import AuthShell, { authInputClass, authLabelClass } from '../components/AuthShell'
import Button from '../components/ui/Button'

function friendlyError(message) {
  if (!message) return 'Something went wrong. Please try again.'
  const m = message.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.'
  if (m.includes('invalid')) return 'Please enter a valid email address.'
  return message
}

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

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
    <AuthShell
      eyebrow="Password reset"
      title="Forgot your password?"
      description="Enter your email and we’ll send you a secure reset link."
      footer={<>Remembered it? <Link to="/login" className="font-medium text-[var(--color-brand)] hover:opacity-80">Login</Link></>}
    >
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] bg-[var(--color-brand-muted)] p-4">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Check your inbox</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
              If an account exists for <span className="font-semibold">{email}</span>, you’ll receive a password reset link shortly.
            </p>
          </div>
          <Button as={Link} to="/login" variant="primary" className="w-full py-3">Back to login</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={authLabelClass}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={authInputClass} placeholder="you@example.com" />
          </div>
          <Button type="submit" variant="primary" disabled={loading} className="w-full py-3 disabled:opacity-50">
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
