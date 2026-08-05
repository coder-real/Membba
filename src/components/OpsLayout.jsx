import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Bot,
  Building2,
  CreditCard,
  Inbox,
  LifeBuoy,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/api'

const OPS_LINKS = [
  { label: 'Overview', path: '/membba-staff', Icon: Activity, end: true },
  { label: 'Help Desk', path: '/membba-staff/helpdesk', Icon: LifeBuoy },
]

export default function OpsLayout() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) return data.session.access_token
    const refreshed = await supabase.auth.refreshSession().catch(() => null)
    return refreshed?.data?.session?.access_token || null
  }

  async function checkAccess() {
    setChecking(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Please sign in with a Membba staff account.')
      const res = await fetch(`${API_BASE}/api/ops/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Ops access required')
      setSummary(data)
      setAllowed(true)
    } catch (err) {
      setError(err.message)
      setAllowed(false)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { checkAccess() }, [])

  if (checking) {
    return <div className="min-h-screen bg-[var(--color-bg-app)] p-8 text-[var(--color-text-secondary)]">Checking staff access…</div>
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-app)] p-6 flex items-center justify-center">
        <div className="ds-card max-w-md p-7 text-center">
          <ShieldCheck size={36} className="mx-auto mb-4 text-[var(--color-danger)]" />
          <h1 className="text-[22px] font-bold text-[var(--color-text-primary)]">Membba staff only</h1>
          <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">{error || 'You do not have permission to access this area.'}</p>
          <p className="mt-4 text-[12px] text-[var(--color-text-muted)]">Ask an admin to add your email to MEMBBA_ADMIN_EMAILS.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary mt-5">Back to creator app</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] text-[var(--color-text-primary)] font-sans">
      <aside className="fixed inset-y-0 left-0 hidden w-[220px] border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] p-3 lg:block">
        <Link to="/membba-staff" className="mb-6 flex items-center gap-2 px-2 py-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] text-[var(--color-text-on-brand)]">
            <Bot size={18} strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-[14px] font-bold leading-4">Membba Ops</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Staff console</p>
          </div>
        </Link>

        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Operations</p>
        <nav className="space-y-1">
          {OPS_LINKS.map(({ label, path, Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) => `flex items-center gap-3 rounded-[var(--radius-default)] px-3 py-2 text-[13px] font-medium transition-all ${isActive ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'}`}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-3 left-3 right-3">
          <Link to="/dashboard" className="btn-secondary w-full justify-center">
            <ArrowLeft size={15} /> Creator dashboard
          </Link>
        </div>
      </aside>

      <div className="lg:ml-[220px]">
        <header className="sticky top-0 z-30 flex h-[52px] items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] px-4 lg:px-8">
          <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <ShieldCheck size={16} />
            <span>Internal support workspace</span>
          </div>
          <div className="hidden items-center gap-4 text-[12px] text-[var(--color-text-muted)] md:flex">
            <span>{summary?.open_escalations || 0} open issues</span>
            <span>{summary?.pending_payments || 0} pending payments</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-6 lg:px-8 lg:py-8">
          <Outlet context={{ summary, refreshOpsSummary: checkAccess }} />
        </main>
      </div>
    </div>
  )
}
