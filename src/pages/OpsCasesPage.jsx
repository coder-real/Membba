import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, Bug, Plus, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Card, { CardBody, CardHeader } from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const CATEGORIES = ['payout', 'bot_integration', 'billing', 'account_access', 'payment_issue', 'member_access', 'bug', 'general']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const STATUSES = ['open', 'in_progress', 'escalated', 'resolved', 'closed', 'all']

function statusTone(status) {
  if (status === 'resolved' || status === 'closed') return 'success'
  if (status === 'escalated') return 'danger'
  if (status === 'in_progress') return 'warning'
  return 'warning'
}

export default function OpsCasesPage() {
  const [cases, setCases] = useState([])
  const [status, setStatus] = useState('open')
  const [assigned, setAssigned] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ creator_email: '', category: 'general', priority: 'normal', subject: '', description: '', assigned_to_email: '' })

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) return data.session.access_token
    const refreshed = await supabase.auth.refreshSession().catch(() => null)
    return refreshed?.data?.session?.access_token || null
  }

  async function apiFetch(path, opts = {}) {
    const token = await getToken()
    if (!token) throw new Error('Please sign in first')
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.message || 'Request failed')
    return body
  }

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status })
      if (assigned) params.set('assigned', assigned)
      const data = await apiFetch(`/api/ops/cases?${params.toString()}`)
      setCases(data || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status, assigned])

  async function createCase(e) {
    e.preventDefault()
    setCreating(true)
    try {
      const payload = { ...form, assigned_to_email: form.assigned_to_email || undefined }
      const res = await apiFetch('/api/ops/cases', { method: 'POST', body: payload })
      toast.success('Case created')
      setCases(prev => [res.case, ...prev])
      setShowCreate(false)
      setForm({ creator_email: '', category: 'general', priority: 'normal', subject: '', description: '', assigned_to_email: '' })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const counts = useMemo(() => ({
    urgent: cases.filter(c => c.priority === 'urgent').length,
    escalated: cases.filter(c => c.status === 'escalated').length,
  }), [cases])

  return (
    <>
      <PageHeader
        eyebrow="Case Management"
        title="Staff Help Desk Cases"
        description="Create and manage internal cases for creator-reported issues. Creators never access this screen."
        action={<Button onClick={() => setShowCreate(v => !v)} variant="primary"><Plus size={15} /> New case</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-5"><p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Loaded cases</p><p className="mt-2 text-2xl font-bold">{cases.length}</p></Card>
        <Card className="p-5"><p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Urgent</p><p className="mt-2 text-2xl font-bold text-[var(--color-danger)]">{counts.urgent}</p></Card>
        <Card className="p-5"><p className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Escalated</p><p className="mt-2 text-2xl font-bold text-[var(--color-warning)]">{counts.escalated}</p></Card>
      </div>

      <Card className="mb-6">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => <button key={s} onClick={() => setStatus(s)} className={`rounded-[var(--radius-md)] border px-3 py-2 text-[13px] font-medium capitalize ${status === s ? 'border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]' : 'border-[var(--color-border-default)] text-[var(--color-text-secondary)]'}`}>{s.replace('_', ' ')}</button>)}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAssigned(assigned === 'me' ? '' : 'me')} className={`btn-secondary ${assigned === 'me' ? 'border-[var(--color-border-strong)]' : ''}`}>Assigned to me</button>
            <button onClick={load} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>
          </div>
        </CardBody>
      </Card>

      {showCreate && (
        <Card className="mb-6">
          <CardHeader title="Create case" description="Use this when a creator reports an issue through email, WhatsApp, phone, or another support channel." />
          <CardBody>
            <form onSubmit={createCase} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="input" placeholder="Creator email (optional)" value={form.creator_email} onChange={e => setForm(f => ({ ...f, creator_email: e.target.value }))} />
                <input className="input" placeholder="Assign to email (optional)" value={form.assigned_to_email} onChange={e => setForm(f => ({ ...f, assigned_to_email: e.target.value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select>
                <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select>
              </div>
              <input className="input" placeholder="Subject" required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              <textarea className="input min-h-[120px]" placeholder="What did the creator report?" required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <Button type="submit" variant="primary" disabled={creating}>{creating ? 'Creating…' : 'Create case'}</Button>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Cases" description="Internal case queue for Membba staff." />
        {loading ? <CardBody><p className="text-[13px] text-[var(--color-text-secondary)]">Loading cases…</p></CardBody> : cases.length === 0 ? (
          <CardBody><p className="text-[13px] text-[var(--color-text-secondary)]">No cases in this view.</p></CardBody>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {cases.map(item => (
              <Link key={item.id} to={`/membba-staff/cases/${item.id}`} className="block p-5 hover:bg-[var(--color-bg-elevated)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge tone={statusTone(item.status)}>{item.status.replace('_', ' ')}</Badge>
                      <Badge tone={item.priority === 'urgent' || item.priority === 'high' ? 'danger' : 'neutral'}>{item.priority}</Badge>
                      <span className="badge bg-[rgba(160,160,160,0.10)] text-[var(--color-text-secondary)]">{item.category.replace('_', ' ')}</span>
                    </div>
                    <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">{item.subject}</p>
                    <p className="mt-1 line-clamp-2 text-[13px] text-[var(--color-text-secondary)]">{item.description}</p>
                  </div>
                  <div className="shrink-0 text-left text-[12px] text-[var(--color-text-muted)] sm:text-right">
                    <p>{item.creator?.email || item.creator_email || 'No creator linked'}</p>
                    <p>{item.assigned_to_email || 'Unassigned'}</p>
                    <p>{new Date(item.updated_at || item.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
