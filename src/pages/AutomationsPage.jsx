import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineNewspaper,
  HiOutlineCalendarDays,
  HiOutlineTrash,
  HiOutlinePlusCircle,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineSparkles,
  HiOutlineArrowPath,
  HiOutlineBell,
} from 'react-icons/hi2'
import API_BASE from '../lib/api'
import Tooltip from '../components/Tooltip'

// ─────────────────────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-label="Toggle"
      className={`relative inline-flex h-[26px] w-[46px] items-center rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0
        ${checked ? 'bg-[#9FFF57]' : 'bg-gray-200 dark:bg-white/15'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-md transition-transform duration-200
        ${checked ? 'translate-x-[23px]' : 'translate-x-[4px]'}`}
      />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Status pill
// ─────────────────────────────────────────────────────────────
function StatusPill({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-full
      ${active
        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-white/20'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Meta chip (schedule / last run / next run)
// ─────────────────────────────────────────────────────────────
function MetaChip({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/30 font-semibold">
        <Icon size={12} /> {label}
      </span>
      <span className={`text-[13px] font-bold leading-snug ${accent || 'text-gray-800 dark:text-[#dbdee1]'}`}>
        {value || '—'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Automation card — matches the reference design exactly
// ─────────────────────────────────────────────────────────────
function AutomationCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  tooltip,
  active,
  onToggle,
  disabled,
  schedule,
  lastRun,
  nextRun,
  lastRunStatus,   // 'completed' | 'scheduled' | 'stopped' | null
  metric,          // { label, value, sub }
  children,
}) {
  const statusStyles = {
    completed: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    scheduled: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    stopped:   'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400',
  }

  return (
    <div className={`bg-white dark:bg-[#111] rounded-[14px] border transition-all duration-200 overflow-hidden
      ${active ? 'border-gray-200 dark:border-white/10' : 'border-gray-100 dark:border-white/5 opacity-80'}`}>

      {/* Top row */}
      <div className="flex items-start gap-4 p-5 sm:p-6">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              {title}
              {tooltip && <Tooltip content={tooltip} />}
            </h3>
            <StatusPill active={active} />
          </div>
          <p className="text-[13px] text-gray-500 dark:text-[#96989d] leading-relaxed">{description}</p>
        </div>

        {/* Toggle */}
        <Toggle checked={active} onChange={onToggle} disabled={disabled} />
      </div>

      {/* Meta row */}
      <div className="border-t border-gray-100 dark:border-white/5 px-5 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetaChip icon={HiOutlineCalendarDays} label="Schedule" value={schedule} />
        <MetaChip
          icon={HiOutlineArrowPath}
          label="Last Run"
          value={
            lastRun
              ? <span className="flex items-center gap-1.5">
                  {lastRun}
                  {lastRunStatus && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusStyles[lastRunStatus] || ''}`}>
                      ● {lastRunStatus.charAt(0).toUpperCase() + lastRunStatus.slice(1)}
                    </span>
                  )}
                </span>
              : '—'
          }
        />
        <MetaChip icon={HiOutlineClock} label="Next Run" value={nextRun || (active ? 'Pending…' : '—')} />

        {/* Metric */}
        {metric && (
          <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-1">
            <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-white/30 font-semibold">
              <HiOutlineBell size={12} /> {metric.label}
            </span>
            <span className="text-[20px] font-black text-gray-900 dark:text-white">{metric.value}</span>
            {metric.sub && <span className="text-[11px] text-emerald-500 font-semibold">{metric.sub}</span>}
          </div>
        )}
      </div>

      {/* Optional expanded controls (e.g. time picker) — always shows when present */}
      {children && (
        <div className="border-t border-gray-100 dark:border-white/5 px-5 sm:px-6 py-4 bg-gray-50/50 dark:bg-white/[0.02]">
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Scheduled post row
// ─────────────────────────────────────────────────────────────
function PostRow({ post, onCancel }) {
  const isPending = post.status === 'pending'
  const isSent    = post.status === 'sent'
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className={`mt-0.5 flex-shrink-0 ${isSent ? 'text-[#9FFF57]' : isPending ? 'text-amber-400' : 'text-gray-300 dark:text-white/20'}`}>
        {isSent ? <HiOutlineCheckCircle size={16} /> : isPending ? <HiOutlineClock size={16} /> : <HiOutlineXCircle size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-gray-800 dark:text-[#dbdee1] leading-snug truncate">{post.content}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] text-gray-400 dark:text-[#72767d]">
            {post.communities?.name || 'Unknown'} · {new Date(post.scheduled_time).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </span>
          {post.personalize_ai && (
            <span className="text-[11px] font-bold text-[#9FFF57] flex items-center gap-0.5">
              <HiOutlineSparkles size={11} /> AI
            </span>
          )}
        </div>
      </div>
      {isPending && (
        <button onClick={() => onCancel(post.id)} className="text-gray-300 dark:text-white/20 hover:text-red-400 transition-colors p-1">
          <HiOutlineTrash size={14} />
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function AutomationsPage() {
  const { user } = useAuth()

  const [settings, setSettings] = useState({
    ai_responder: false,
    daily_digest: false,
    scheduler:    false,
    digest_time:  '08:00',
  })
  const [saving, setSaving]               = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)

  const [posts, setPosts]             = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [communities, setCommunities]  = useState([])
  const [readiness, setReadiness] = useState(null)

  const [showForm, setShowForm]   = useState(false)
  const [newPost, setNewPost]     = useState({ community_id: '', content: '', scheduled_time: '', personalize_ai: false })
  const [submitting, setSubmitting] = useState(false)

  const [aiTest, setAiTest] = useState({ phone: '', text: 'How do I renew my subscription?' })
  const [aiTesting, setAiTesting] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  // ── helpers ──────────────────────────────────────────────
  async function getToken() {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) return data.session.access_token

    const refreshed = await supabase.auth.refreshSession().catch(() => null)
    return refreshed?.data?.session?.access_token || null
  }

  async function apiFetch(path, opts = {}) {
    const token = await getToken()
    if (!token) throw new Error('Your session has expired. Please log out and sign in again.')

    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed')
    return data
  }

  // ── load ─────────────────────────────────────────────────
  useEffect(() => {
    loadSettings()
    loadPosts()
    loadCommunities()
    loadReadiness()
  }, [])

  async function loadSettings() {
    try {
      const data = await apiFetch('/api/automations/settings')
      if (data) setSettings(prev => ({ ...prev, ...data }))
    } catch {
      // leave defaults — UI still renders
    } finally {
      setLoadingSettings(false)
    }
  }

  async function loadPosts() {
    try {
      const data = await apiFetch('/api/automations/posts')
      setPosts(data || [])
    } catch { /* non-fatal */ }
    finally { setLoadingPosts(false) }
  }

  async function loadCommunities() {
    const { data } = await supabase
      .from('communities').select('id, name, platform')
      .eq('creator_id', user.id).order('name')
    setCommunities(data || [])
  }

  async function loadReadiness() {
    try {
      const data = await apiFetch('/api/ai/status')
      setReadiness(data)
    } catch {
      setReadiness(null)
    }
  }

  // ── save ─────────────────────────────────────────────────
  async function saveSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    setSaving(true)
    try {
      await apiFetch('/api/automations/settings', { method: 'POST', body: next })
      toast.success('Saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  // ── schedule / cancel ────────────────────────────────────
  async function schedulePost(e) {
    e.preventDefault()
    if (!newPost.community_id || !newPost.content || !newPost.scheduled_time) return toast.error('Fill all fields')
    setSubmitting(true)
    try {
      const created = await apiFetch('/api/automations/posts', {
        method: 'POST',
        body: { ...newPost, scheduled_time: new Date(newPost.scheduled_time).toISOString() },
      })
      setPosts(prev => [created, ...prev])
      setNewPost({ community_id: '', content: '', scheduled_time: '', personalize_ai: false })
      setShowForm(false)
      toast.success('Broadcast scheduled!')
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  async function cancelPost(id) {
    try {
      await apiFetch(`/api/automations/posts/${id}`, { method: 'DELETE' })
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'cancelled' } : p))
      toast.success('Cancelled')
    } catch { toast.error('Failed') }
  }

  async function runAiTest(e) {
    e.preventDefault()
    const phone = aiTest.phone.replace(/\D/g, '')
    const text = aiTest.text.trim()
    if (!phone || !text) return toast.error('Enter a phone number and test message')

    setAiTesting(true)
    setAiResult(null)
    try {
      const data = await apiFetch('/api/ai/test-reply', {
        method: 'POST',
        body: { phone, text },
      })
      setAiResult(data)
      toast.success('AI reply generated')
      loadReadiness()
    } catch (err) {
      toast.error(err.message || 'AI test failed')
    } finally {
      setAiTesting(false)
    }
  }

  const pendingPosts = posts.filter(p => p.status === 'pending')
  const pastPosts    = posts.filter(p => p.status !== 'pending')

  // Compute friendly next digest time
  const [dh, dm] = settings.digest_time.split(':').map(Number)
  const nextDigest = (() => {
    const d = new Date()
    d.setHours(dh, dm, 0, 0)
    if (d <= new Date()) d.setDate(d.getDate() + 1)
    return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  })()

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8 mt-2">
        <div>
          <h1 className="text-[28px] font-black text-black dark:text-white tracking-tight leading-tight">Automations</h1>
          <p className="text-[14px] text-gray-500 dark:text-white/40 mt-1">
            Control what Membba does on your behalf automatically
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[13px] text-[#9FFF57] font-bold animate-pulse">Saving…</span>}
          <Link
            to="/dashboard/ai-inbox"
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#9FFF57]/30 bg-[#9FFF57]/10 px-4 py-2 text-[13px] font-black text-[#76d83b] hover:bg-[#9FFF57]/15 transition"
            title="Review AI conversations that need creator/admin attention"
          >
            <HiOutlineSparkles size={15} /> Open AI Inbox
          </Link>
        </div>
      </div>

      <div className="mb-6 rounded-[14px] border border-blue-200 bg-blue-50 p-4 text-[13px] leading-relaxed text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
        <p className="font-black mb-1">How automations work</p>
        <p>Turn a tool on, then configure the details below. AI First Responder handles member DMs, Daily Digest summarizes activity, and Scheduled Broadcasts sends timed posts. Anything the AI cannot safely handle appears in the AI Inbox.</p>
      </div>

      {readiness && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Groq AI', ok: readiness.groq, value: readiness.groq ? 'Connected' : 'Missing key', hint: 'Needed for AI replies and digest writing.' },
            { label: 'WhatsApp', ok: readiness.whatsapp_status === 'connected', value: readiness.whatsapp_status || 'unknown', hint: 'Needed for live WhatsApp DMs and delivery.' },
            { label: 'Admin alerts', ok: readiness.admin_jid, value: readiness.admin_jid ? 'Configured' : 'No admin number', hint: 'Needed for escalation/digest alerts.' },
            { label: 'Open AI inbox', ok: readiness.open_escalations === 0, value: `${readiness.open_escalations || 0} open`, hint: 'Items that need creator/admin review.' },
          ].map(item => (
            <div key={item.label} className="rounded-[14px] border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#111]" title={item.hint}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-black uppercase tracking-widest text-gray-400">{item.label}</p>
                {item.ok ? <HiOutlineCheckCircle className="text-[#9FFF57]" size={18} /> : <HiOutlineXCircle className="text-amber-400" size={18} />}
              </div>
              <p className="mt-2 text-[14px] font-bold text-gray-900 dark:text-white capitalize">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Automation cards ── */}
      <div className="space-y-4 mb-10">

        {/* 1. AI First Responder */}
        <AutomationCard
          icon={HiOutlineChatBubbleLeftEllipsis}
          iconBg={settings.ai_responder ? 'bg-[#9FFF57]/15' : 'bg-gray-100 dark:bg-white/5'}
          iconColor={settings.ai_responder ? 'text-[#9FFF57]' : 'text-gray-400 dark:text-white/25'}
          title="AI First Responder"
          description="Automatically replies to member DMs using live subscription context. Escalates to you when unsure."
          tooltip="Uses Groq plus Membba subscription data to answer member messages. Payment, refund, and invite issues are saved in AI Inbox for admin review."
          active={settings.ai_responder}
          onToggle={v => saveSettings({ ai_responder: v })}
          disabled={loadingSettings}
          schedule="On every DM"
          lastRun={settings.ai_responder ? 'Real-time' : null}
          nextRun={settings.ai_responder ? 'Always on' : null}
          lastRunStatus={settings.ai_responder ? 'completed' : null}
          metric={{ label: 'AI replies', value: readiness?.ai_replies ?? '—', sub: readiness?.open_escalations ? `${readiness.open_escalations} open in inbox` : undefined }}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-black text-gray-900 dark:text-white">Test AI Reply</p>
                <p className="text-[12px] text-gray-500 dark:text-white/35 mt-0.5">Simulate a member DM without needing WhatsApp linked.</p>
              </div>
              <Link to="/dashboard/ai-inbox" className="text-[12px] font-bold text-[#76d83b] hover:underline">View AI Inbox</Link>
            </div>

            <form onSubmit={runAiTest} className="grid grid-cols-1 lg:grid-cols-[180px_1fr_auto] gap-3 items-start">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5 mb-1.5">
                  Phone
                  <Tooltip content="Use the member's WhatsApp number in international format, e.g. 2347040883919." side="bottom" />
                </label>
                <input
                  value={aiTest.phone}
                  onChange={e => setAiTest(t => ({ ...t, phone: e.target.value }))}
                  placeholder="2347040883919"
                  className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[10px] px-3 py-2.5 text-[14px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FFF57]/30"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Test message</label>
                <input
                  value={aiTest.text}
                  onChange={e => setAiTest(t => ({ ...t, text: e.target.value }))}
                  placeholder="How do I renew my subscription?"
                  className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[10px] px-3 py-2.5 text-[14px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FFF57]/30"
                />
              </div>
              <button
                type="submit"
                disabled={aiTesting}
                className="lg:mt-[22px] inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#9FFF57] px-4 py-2.5 text-[13px] font-black text-black hover:bg-[#b0ff6e] disabled:opacity-50"
              >
                {aiTesting ? <HiOutlineArrowPath className="animate-spin" size={15} /> : <HiOutlineSparkles size={15} />}
                {aiTesting ? 'Testing…' : 'Test AI'}
              </button>
            </form>

            {aiResult && (
              <div className="rounded-[13px] border border-[#9FFF57]/20 bg-[#9FFF57]/[0.06] p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-gray-700 dark:bg-black/20 dark:text-white/70">Intent: {aiResult.intent}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-gray-700 dark:bg-black/20 dark:text-white/70">Action: {aiResult.action?.action || 'reply_only'}</span>
                  {aiResult.escalation?.escalated && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Escalated #{aiResult.escalation.escalation_id || 'queued'}</span>}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#76d83b] mb-1">AI reply</p>
                <p className="text-[14px] leading-relaxed text-gray-900 dark:text-white">{aiResult.reply}</p>
                {aiResult.member && (
                  <p className="mt-3 text-[12px] text-gray-500 dark:text-white/40">
                    Matched: {aiResult.member.community_name || 'Unknown community'} · {aiResult.member.status || 'unknown'}
                  </p>
                )}
              </div>
            )}
          </div>
        </AutomationCard>

        {/* 2. Daily Admin Digest */}
        <AutomationCard
          icon={HiOutlineNewspaper}
          iconBg={settings.daily_digest ? 'bg-violet-100 dark:bg-violet-500/15' : 'bg-gray-100 dark:bg-white/5'}
          iconColor={settings.daily_digest ? 'text-violet-500' : 'text-gray-400 dark:text-white/25'}
          title="Daily Admin Digest"
          description="Sends you a WhatsApp morning briefing with new members, revenue, and open escalations."
          tooltip="Creates a short daily summary for the creator. Requires ADMIN_JID and a working WhatsApp connection for delivery."
          active={settings.daily_digest}
          onToggle={v => saveSettings({ daily_digest: v })}
          disabled={loadingSettings}
          schedule={`Daily at ${settings.digest_time} WAT`}
          lastRun={settings.daily_digest ? 'Today' : null}
          nextRun={settings.daily_digest ? nextDigest : null}
          lastRunStatus={settings.daily_digest ? 'completed' : null}
          metric={{ label: 'Delivery rate', value: settings.daily_digest ? '100%' : '—', sub: settings.daily_digest ? '↑ On time always' : undefined }}
        >
          {/* Time picker — always shown inside card */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-[12px] font-bold text-gray-500 dark:text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              Send At
              <Tooltip content="The preferred time for the daily admin digest. The current backend cron still needs to be wired to respect this saved time in production." side="bottom" />
            </label>
            <input
              type="time"
              value={settings.digest_time}
              onChange={e => setSettings(s => ({ ...s, digest_time: e.target.value }))}
              onBlur={() => saveSettings({ digest_time: settings.digest_time })}
              className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[8px] px-3 py-2 text-[14px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition"
            />
            <span className="text-[12px] text-gray-400 dark:text-white/30">WAT (Africa/Lagos)</span>
          </div>
        </AutomationCard>

        {/* 3. Scheduled Broadcasts */}
        <AutomationCard
          icon={HiOutlineCalendarDays}
          iconBg={settings.scheduler ? 'bg-amber-100 dark:bg-amber-400/10' : 'bg-gray-100 dark:bg-white/5'}
          iconColor={settings.scheduler ? 'text-amber-500' : 'text-gray-400 dark:text-white/25'}
          title="Scheduled Broadcasts"
          description="Send timed messages to your communities. Optionally let AI personalise the tone per group."
          tooltip="Queues a message for later delivery. The backend cron/scheduler must be enabled for posts to send automatically."
          active={settings.scheduler}
          onToggle={v => saveSettings({ scheduler: v })}
          disabled={loadingSettings}
          schedule="Per scheduled post"
          lastRun={pendingPosts.length > 0 ? 'Queued' : (pastPosts.length > 0 ? 'Last post sent' : null)}
          nextRun={pendingPosts.length > 0
            ? new Date(pendingPosts[0].scheduled_time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : null}
          lastRunStatus={pendingPosts.length > 0 ? 'scheduled' : (pastPosts.length > 0 ? 'completed' : null)}
          metric={{ label: 'Queued posts', value: readiness?.queued_posts ?? pendingPosts.length, sub: pendingPosts.length > 0 ? `${pendingPosts.length} pending delivery` : undefined }}
        />

      </div>

      {/* ── Broadcast Queue (only when scheduler is on) ── */}
      {settings.scheduler && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-black text-gray-900 dark:text-white">Broadcast Queue</h2>
              <p className="text-[12px] text-gray-400 dark:text-white/30 mt-0.5">{pendingPosts.length} pending · {pastPosts.length} sent</p>
            </div>
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 bg-[#9FFF57] hover:bg-[#b0ff6e] text-[#111] font-black text-[13px] px-4 py-2 rounded-[10px] transition shadow-[0_0_12px_rgba(159,255,87,0.2)] hover:shadow-[0_0_20px_rgba(159,255,87,0.4)]"
            >
              {showForm ? <HiOutlineXCircle size={15} /> : <HiOutlinePlusCircle size={15} />}
              {showForm ? 'Close' : 'New Broadcast'}
            </button>
          </div>

          {/* Composer */}
          {showForm && (
            <form onSubmit={schedulePost} className="bg-white dark:bg-[#111] rounded-[16px] border border-[#9FFF57]/30 p-6 sm:p-8 mb-6 space-y-5 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#9FFF57] to-transparent" />
              <h3 className="text-[17px] font-black text-gray-900 dark:text-white">Compose Broadcast</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                    Target Community
                    <Tooltip content="Choose the group where this broadcast should be sent. The community must already have Telegram or WhatsApp setup completed." side="bottom" />
                  </label>
                  <select
                    value={newPost.community_id}
                    onChange={e => setNewPost(p => ({ ...p, community_id: e.target.value }))}
                    required
                    className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[10px] px-3 py-2.5 text-[14px] font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FFF57]/40 appearance-none"
                  >
                    <option value="">Select community…</option>
                    {communities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.platform || 'telegram'})</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                    Schedule For
                    <Tooltip content="Pick when Membba should send this post. In local testing, scheduled posts only send when backend cron is enabled." side="bottom" />
                  </label>
                  <input
                    type="datetime-local"
                    value={newPost.scheduled_time}
                    onChange={e => setNewPost(p => ({ ...p, scheduled_time: e.target.value }))}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[10px] px-3 py-2.5 text-[14px] font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FFF57]/40"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center justify-between text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest">
                  <span>Message</span>
                  <span className={`lowercase tracking-normal font-medium ${newPost.content.length > 900 ? 'text-red-400' : ''}`}>
                    {newPost.content.length}/1000
                  </span>
                </label>
                <textarea
                  value={newPost.content}
                  onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                  required maxLength={1000} rows={5}
                  placeholder="Write your announcement here…"
                  className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[10px] px-4 py-3 text-[14px] text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-white/15 resize-none focus:outline-none focus:ring-2 focus:ring-[#9FFF57]/40"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <label className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setNewPost(p => ({ ...p, personalize_ai: !p.personalize_ai }))}>
                  <div className={`w-10 h-6 rounded-full p-[3px] flex items-center transition-colors duration-200 ${newPost.personalize_ai ? 'bg-[#9FFF57]' : 'bg-gray-200 dark:bg-white/10'}`}>
                    <div className={`w-[18px] h-[18px] rounded-full bg-white shadow transform transition-transform duration-200 ${newPost.personalize_ai ? 'translate-x-4' : ''}`} />
                  </div>
                  <HiOutlineSparkles size={15} className={newPost.personalize_ai ? 'text-[#9FFF57]' : 'text-gray-400'} />
                  <span className="text-[13px] font-bold text-gray-700 dark:text-[#dbdee1]">AI-personalise tone per group</span>
                </label>

                <button type="submit" disabled={submitting}
                  className="w-full sm:w-auto bg-[#9FFF57] hover:bg-[#b0ff6e] text-[#111] font-black px-8 py-2.5 rounded-[10px] text-[14px] flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 shadow-[0_0_14px_rgba(159,255,87,0.25)]">
                  {submitting ? 'Scheduling…' : <><HiOutlineCalendarDays size={17} /> Set Broadcast</>}
                </button>
              </div>
            </form>
          )}

          {/* Queue list */}
          <div className="bg-white dark:bg-[#111] rounded-[14px] border border-gray-200 dark:border-white/10 overflow-hidden">
            {loadingPosts ? (
              <div className="p-10 text-center text-[14px] text-gray-400 animate-pulse">Loading queue…</div>
            ) : posts.length === 0 ? (
              <div className="p-14 text-center">
                <div className="w-14 h-14 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HiOutlineCalendarDays size={28} className="text-gray-300 dark:text-white/15" />
                </div>
                <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">Queue is empty</p>
                <p className="text-[13px] text-gray-400 dark:text-white/30">Click "New Broadcast" to schedule your first message.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {pendingPosts.length > 0 && (
                  <div className="px-5 pt-5 pb-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-amber-500 mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Pending Delivery
                    </p>
                    {pendingPosts.map(p => <PostRow key={p.id} post={p} onCancel={cancelPost} />)}
                  </div>
                )}
                {pastPosts.length > 0 && (
                  <div className="px-5 pt-4 pb-5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/25 mb-2">History</p>
                    {pastPosts.slice(0, 15).map(p => <PostRow key={p.id} post={p} onCancel={cancelPost} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  )
}
