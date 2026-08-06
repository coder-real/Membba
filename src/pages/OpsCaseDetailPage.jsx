import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowLeft, CheckCircle, GitBranch, RefreshCw, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/api'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Card, { CardBody, CardHeader } from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const STATUSES = ['open', 'in_progress', 'escalated', 'resolved', 'closed']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const CATEGORIES = ['payout', 'bot_integration', 'billing', 'account_access', 'payment_issue', 'member_access', 'bug', 'general']

function statusTone(status) {
  if (status === 'resolved' || status === 'closed') return 'success'
  if (status === 'escalated') return 'danger'
  if (status === 'in_progress') return 'warning'
  return 'warning'
}

export default function OpsCaseDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [engineeringSummary, setEngineeringSummary] = useState('')

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
      const result = await apiFetch(`/api/ops/cases/${id}`)
      setData(result)
      setResolution(result.case?.resolution_notes || '')
      setEngineeringSummary(result.case?.engineering_summary || '')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function updateCase(patch) {
    setSaving(true)
    try {
      const result = await apiFetch(`/api/ops/cases/${id}`, { method: 'PATCH', body: patch })
      setData(prev => ({ ...prev, case: result.case }))
      toast.success('Case updated')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    try {
      const result = await apiFetch(`/api/ops/cases/${id}/notes`, { method: 'POST', body: { note } })
      setData(prev => ({ ...prev, notes: [result.note, ...(prev.notes || [])] }))
      setNote('')
      toast.success('Note added')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function escalate() {
    setSaving(true)
    try {
      const result = await apiFetch(`/api/ops/cases/${id}/escalate`, { method: 'POST', body: { engineering_summary: engineeringSummary, priority: 'high' } })
      setData(prev => ({ ...prev, case: result.case }))
      toast.success('Escalated to engineering')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function resolveCase() {
    setSaving(true)
    try {
      const result = await apiFetch(`/api/ops/cases/${id}/resolve`, { method: 'POST', body: { resolution_notes: resolution } })
      setData(prev => ({ ...prev, case: result.case }))
      toast.success('Case resolved')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-[var(--color-text-secondary)]">Loading case…</div>
  if (!data?.case) return <div className="text-[var(--color-text-secondary)]">Case not found.</div>

  const c = data.case

  return (
    <>
      <PageHeader
        eyebrow="Case detail"
        title={c.subject}
        description="Internal Membba staff case for a creator-reported issue."
        action={<Button as={Link} to="/membba-staff/cases" variant="secondary"><ArrowLeft size={15} /> Back to cases</Button>}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={statusTone(c.status)}>{c.status.replace('_', ' ')}</Badge>
        <Badge tone={c.priority === 'urgent' || c.priority === 'high' ? 'danger' : 'neutral'}>{c.priority}</Badge>
        <span className="badge bg-[rgba(160,160,160,0.10)] text-[var(--color-text-secondary)]">{c.category.replace('_', ' ')}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Case details" description="Creator report and internal handling fields." />
            <CardBody className="space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Description</label>
                <p className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-3 text-[14px] leading-6 text-[var(--color-text-secondary)]">{c.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select className="input" value={c.status} onChange={e => updateCase({ status: e.target.value })}>{STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
                <select className="input" value={c.priority} onChange={e => updateCase({ priority: e.target.value })}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select>
                <select className="input" value={c.category} onChange={e => updateCase({ category: e.target.value })}>{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>)}</select>
              </div>
              <input className="input" placeholder="Assigned to email" value={c.assigned_to_email || ''} onChange={e => setData(prev => ({ ...prev, case: { ...prev.case, assigned_to_email: e.target.value } }))} onBlur={e => updateCase({ assigned_to_email: e.target.value })} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Internal notes" description="Visible to Membba staff only." />
            <CardBody>
              <form onSubmit={addNote} className="mb-4 flex flex-col gap-2 sm:flex-row">
                <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Add note…" />
                <Button type="submit" variant="primary" disabled={saving}>Add note</Button>
              </form>
              <div className="space-y-3">
                {data.notes?.length ? data.notes.map(n => (
                  <div key={n.id} className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] p-3">
                    <p className="text-[13px] text-[var(--color-text-primary)]">{n.note}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{n.created_by_email || 'Membba staff'} · {new Date(n.created_at).toLocaleString()}</p>
                  </div>
                )) : <p className="text-[13px] text-[var(--color-text-muted)]">No notes yet.</p>}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Escalation / resolution" description="Use escalation for engineering-only issues; resolution closes the loop for Ops." />
            <CardBody className="space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Engineering summary</label>
                <textarea className="input min-h-[96px]" value={engineeringSummary} onChange={e => setEngineeringSummary(e.target.value)} placeholder="Steps to reproduce, logs, affected creator, expected result…" />
                <Button onClick={escalate} variant="secondary" disabled={saving} className="mt-2"><GitBranch size={15} /> Escalate to engineering</Button>
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Resolution summary</label>
                <textarea className="input min-h-[96px]" value={resolution} onChange={e => setResolution(e.target.value)} placeholder="What fixed the issue? What should Ops know next time?" />
                <Button onClick={resolveCase} variant="primary" disabled={saving} className="mt-2"><CheckCircle size={15} /> Resolve case</Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Creator" description="Linked creator account" />
            <CardBody>
              {c.creator ? (
                <div className="space-y-2 text-[13px]">
                  <p className="font-semibold text-[var(--color-text-primary)]">{c.creator.name}</p>
                  <p className="font-mono text-[12px] text-[var(--color-text-secondary)]">{c.creator.email}</p>
                  <Link to={`/membba-staff/creators/${c.creator.id}`} className="btn-secondary mt-3 w-full justify-center">Open creator profile</Link>
                </div>
              ) : <p className="text-[13px] text-[var(--color-text-muted)]">No creator account linked. Creator email: {c.creator_email || '—'}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Creator snapshot" description="Live account signals" />
            <CardBody>
              {data.creator_snapshot ? (
                <div className="space-y-3 text-[13px] text-[var(--color-text-secondary)]">
                  <div className="flex justify-between"><span>Communities</span><span className="font-semibold text-[var(--color-text-primary)]">{data.creator_snapshot.communities?.length || 0}</span></div>
                  <div className="flex justify-between"><span>Active subs</span><span className="font-semibold text-[var(--color-text-primary)]">{data.creator_snapshot.active_subscriptions || 0}</span></div>
                  <div className="flex justify-between"><span>Pending payments</span><span className="font-semibold text-[var(--color-text-primary)]">{data.creator_snapshot.pending_payments || 0}</span></div>
                  <div className="pt-2">
                    {data.creator_snapshot.communities?.slice(0, 5).map(com => (
                      <p key={com.id} className="truncate text-[12px] text-[var(--color-text-muted)]">/{com.slug} · {com.platform} · {(com.telegram_chat_id || com.whatsapp_group_id) ? 'connected' : 'setup needed'}</p>
                    ))}
                  </div>
                </div>
              ) : <p className="text-[13px] text-[var(--color-text-muted)]">No linked creator snapshot.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity trail" description="Every case action is logged." />
            <CardBody>
              <div className="space-y-3">
                {data.activity?.length ? data.activity.map(a => (
                  <div key={a.id} className="border-b border-[var(--color-border-subtle)] pb-3 last:border-0 last:pb-0">
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{a.action.replaceAll('_', ' ')}</p>
                    {a.message && <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{a.message}</p>}
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{a.actor_email || 'Membba staff'} · {new Date(a.created_at).toLocaleString()}</p>
                  </div>
                )) : <p className="text-[13px] text-[var(--color-text-muted)]">No activity yet.</p>}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
