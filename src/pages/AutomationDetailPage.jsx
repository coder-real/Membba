import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  HiOutlineArrowLeft,
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineNewspaper,
  HiOutlineCalendarDays,
  HiOutlineSparkles,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineArrowPath,
  HiOutlinePlusCircle,
  HiOutlineTrash,
  HiOutlineBell,
} from 'react-icons/hi2'
import API_BASE from '../lib/api'
import Tooltip from '../components/Tooltip'

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-label="Toggle"
      className={`relative inline-flex h-[26px] w-[46px] items-center rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0
        ${checked ? 'bg-[#c8f135]' : 'bg-gray-200 dark:bg-white/15'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-md transition-transform duration-200
        ${checked ? 'translate-x-[23px]' : 'translate-x-[4px]'}`}
      />
    </button>
  )
}

function PostRow({ post, onCancel }) {
  const isPending = post.status === 'pending'
  const isSent    = post.status === 'sent'
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className={`mt-0.5 flex-shrink-0 ${isSent ? 'text-[#c8f135]' : isPending ? 'text-amber-400' : 'text-gray-300 dark:text-white/20'}`}>
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
            <span className="text-[11px] font-bold text-[#c8f135] flex items-center gap-0.5">
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

export default function AutomationDetailPage() {
  const { key } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [settings, setSettings] = useState({
    ai_responder: false,
    daily_digest: false,
    scheduler:    false,
    digest_time:  '08:00',
  })
  const [saving, setSaving] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)

  // AI responder state
  const [readiness, setReadiness] = useState(null)
  const [aiTest, setAiTest] = useState({ phone: '', text: 'How do I renew my subscription?' })
  const [aiTesting, setAiTesting] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  // Broadcast scheduler state
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [communities, setCommunities] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newPost, setNewPost] = useState({ community_id: '', content: '', scheduled_time: '', personalize_ai: false })
  const [submitting, setSubmitting] = useState(false)

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) return data.session.access_token
    const refreshed = await supabase.auth.refreshSession().catch(() => null)
    return refreshed?.data?.session?.access_token || null
  }

  async function apiFetch(path, opts = {}, didRetry = false) {
    const token = await getToken()
    if (!token) throw new Error('Session expired.')
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401 && !didRetry) {
      const refreshed = await supabase.auth.refreshSession().catch(() => null)
      if (refreshed?.data?.session?.access_token) return apiFetch(path, opts, true)
    }
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed')
    return data
  }

  useEffect(() => {
    loadSettings()
    if (key === 'ai_responder') {
      loadReadiness()
    } else if (key === 'scheduler') {
      loadPosts()
      loadCommunities()
    }
  }, [key])

  async function loadSettings() {
    try {
      const data = await apiFetch('/api/automations/settings')
      if (data) setSettings(prev => ({ ...prev, ...data }))
    } catch { /* defaults */ }
    finally { setLoadingSettings(false) }
  }

  async function loadReadiness() {
    try {
      const data = await apiFetch('/api/ai/status')
      setReadiness(data)
    } catch { setReadiness(null) }
  }

  async function loadPosts() {
    setLoadingPosts(true)
    try {
      const data = await apiFetch('/api/automations/posts')
      setPosts(data || [])
    } catch { /* empty */ }
    finally { setLoadingPosts(false) }
  }

  async function loadCommunities() {
    const { data } = await supabase
      .from('communities').select('id, name, platform')
      .eq('creator_id', user.id).order('name')
    setCommunities(data || [])
  }

  async function saveSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    setSaving(true)
    try {
      await apiFetch('/api/automations/settings', { method: 'POST', body: next })
      toast.success('Settings updated')
    } catch { toast.error('Failed to save settings') }
    finally { setSaving(false) }
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

  const metaMap = {
    ai_responder: {
      title: 'AI First Responder',
      icon: HiOutlineChatBubbleLeftEllipsis,
      iconBg: 'bg-[#c8f135]/15',
      iconColor: 'text-[#c8f135]',
      description: 'Configure and test live AI DM responses for community members.',
    },
    daily_digest: {
      title: 'Daily Admin Digest',
      icon: HiOutlineNewspaper,
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-500',
      description: 'Configure your morning WhatsApp briefing schedule and content.',
    },
    scheduler: {
      title: 'Scheduled Broadcasts',
      icon: HiOutlineCalendarDays,
      iconBg: 'bg-amber-400/15',
      iconColor: 'text-amber-400',
      description: 'Manage queued announcements and schedule new community broadcasts.',
    },
  }

  const meta = metaMap[key] || metaMap.ai_responder
  const Icon = meta.icon
  const isEnabled = Boolean(settings[key])

  const pendingPosts = posts.filter(p => p.status === 'pending')
  const pastPosts    = posts.filter(p => p.status !== 'pending')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/automations')}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-gray-500 hover:text-gray-900 dark:text-white/40 dark:hover:text-white transition-colors"
        >
          <HiOutlineArrowLeft size={14} /> Back to Automations
        </button>
      </div>

      {/* Header banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
            <Icon size={24} className={meta.iconColor} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[20px] font-black text-gray-900 dark:text-white">{meta.title}</h1>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isEnabled ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                {isEnabled ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <p className="text-[13px] text-gray-500 dark:text-white/40 mt-0.5">{meta.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-gray-500 dark:text-white/40">Status:</span>
          <Toggle
            checked={isEnabled}
            onChange={v => saveSettings({ [key]: v })}
            disabled={loadingSettings || saving}
          />
        </div>
      </div>

      {/* ── AI FIRST RESPONDER DETAILS ── */}
      {key === 'ai_responder' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-title text-gray-900 dark:text-white">Simulator & Test Bench</h2>
                <p className="body-md text-gray-500 dark:text-white/40 mt-0.5">Test how the AI responds to member DMs in real time.</p>
              </div>
              <Link to="/dashboard/ai-inbox" className="btn-secondary text-[12px]">View AI Inbox</Link>
            </div>

            <form onSubmit={runAiTest} className="grid grid-cols-1 lg:grid-cols-[200px_1fr_auto] gap-3 items-start">
              <div>
                <label className="label-xs text-gray-500 dark:text-white/40 mb-1.5 block">Phone Number</label>
                <input
                  value={aiTest.phone}
                  onChange={e => setAiTest(t => ({ ...t, phone: e.target.value }))}
                  placeholder="2347040883919"
                  className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 px-3 py-2 text-[14px] text-black dark:text-white focus:outline-none focus:border-[#c8f135]"
                />
              </div>
              <div>
                <label className="label-xs text-gray-500 dark:text-white/40 mb-1.5 block">Test DM Content</label>
                <input
                  value={aiTest.text}
                  onChange={e => setAiTest(t => ({ ...t, text: e.target.value }))}
                  placeholder="How do I renew my subscription?"
                  className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 px-3 py-2 text-[14px] text-black dark:text-white focus:outline-none focus:border-[#c8f135]"
                />
              </div>
              <button
                type="submit"
                disabled={aiTesting}
                className="lg:mt-[22px] btn-primary px-5 py-2 inline-flex items-center gap-2 text-[13px]"
              >
                {aiTesting ? <HiOutlineArrowPath className="animate-spin" size={14} /> : <HiOutlineSparkles size={14} />}
                {aiTesting ? 'Testing…' : 'Run Test'}
              </button>
            </form>

            {aiResult && (
              <div className="border border-[#c8f135]/30 bg-[#c8f135]/[0.05] p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-black/20 text-white text-[11px] font-bold px-2.5 py-0.5 uppercase tracking-wide">Intent: {aiResult.intent}</span>
                  <span className="bg-black/20 text-white text-[11px] font-bold px-2.5 py-0.5 uppercase tracking-wide">Action: {aiResult.action?.action || 'reply_only'}</span>
                  {aiResult.escalation?.escalated && <span className="bg-amber-500/20 text-amber-300 text-[11px] font-bold px-2.5 py-0.5">Escalated to Inbox</span>}
                </div>
                <p className="text-[14px] text-black dark:text-white leading-relaxed">{aiResult.reply}</p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 p-6 space-y-3">
            <h3 className="section-title text-gray-900 dark:text-white">Escalation Policy</h3>
            <p className="body-md text-gray-500 dark:text-white/40">
              When a member asks about refunds, dispute resolution, or complex payment failures, the AI automatically transfers the conversation to your AI Inbox and flags it for human attention.
            </p>
          </div>
        </div>
      )}

      {/* ── DAILY DIGEST DETAILS ── */}
      {key === 'daily_digest' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 p-6 space-y-5">
            <h2 className="section-title text-gray-900 dark:text-white">Dispatch Schedule</h2>
            <div className="flex flex-wrap items-center gap-4">
              <label className="label-xs text-gray-500 dark:text-white/40 uppercase tracking-widest">
                Preferred Send Time
              </label>
              <input
                type="time"
                value={settings.digest_time}
                onChange={e => setSettings(s => ({ ...s, digest_time: e.target.value }))}
                onBlur={() => saveSettings({ digest_time: settings.digest_time })}
                className="bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 px-3 py-2 text-[14px] font-bold text-black dark:text-white focus:outline-none focus:border-violet-400"
              />
              <span className="text-[13px] text-gray-500 dark:text-white/40">WAT (West Africa Time)</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 p-6 space-y-3">
            <h3 className="section-title text-gray-900 dark:text-white">Briefing Contents</h3>
            <ul className="space-y-2 text-[13px] text-gray-600 dark:text-white/60 list-disc list-inside">
              <li>24-hour total revenue & new paid subscriptions</li>
              <li>Active member count & retention metrics</li>
              <li>Unresolved items currently in AI Inbox</li>
              <li>Automated bot status & connection health</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── SCHEDULER DETAILS ── */}
      {key === 'scheduler' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title text-gray-900 dark:text-white">Broadcast Queue</h2>
                <p className="body-md text-gray-500 dark:text-white/40 mt-0.5">{pendingPosts.length} pending delivery · {pastPosts.length} completed</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(v => !v)}
                className="btn-primary inline-flex items-center gap-2 text-[13px]"
              >
                {showForm ? <HiOutlineXCircle size={15} /> : <HiOutlinePlusCircle size={15} />}
                {showForm ? 'Close Composer' : 'New Broadcast'}
              </button>
            </div>

            {showForm && (
              <form onSubmit={schedulePost} className="border border-gray-200 dark:border-white/10 p-6 space-y-4 bg-gray-50/50 dark:bg-white/[0.02]">
                <h3 className="text-[15px] font-bold text-black dark:text-white">Compose Broadcast</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-xs text-gray-500 dark:text-white/40 mb-1 block">Target Community</label>
                    <select
                      value={newPost.community_id}
                      onChange={e => setNewPost(p => ({ ...p, community_id: e.target.value }))}
                      required
                      className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 px-3 py-2 text-[14px] text-black dark:text-white focus:outline-none focus:border-[#c8f135]"
                    >
                      <option value="">Select community…</option>
                      {communities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.platform || 'telegram'})</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="label-xs text-gray-500 dark:text-white/40 mb-1 block">Schedule For</label>
                    <input
                      type="datetime-local"
                      value={newPost.scheduled_time}
                      onChange={e => setNewPost(p => ({ ...p, scheduled_time: e.target.value }))}
                      required
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 px-3 py-2 text-[14px] text-black dark:text-white focus:outline-none focus:border-[#c8f135]"
                    />
                  </div>
                </div>

                <div>
                  <label className="label-xs text-gray-500 dark:text-white/40 mb-1 block">Message Content</label>
                  <textarea
                    value={newPost.content}
                    onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                    required maxLength={1000} rows={4}
                    placeholder="Write your announcement here…"
                    className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 p-3 text-[14px] text-black dark:text-white placeholder-gray-400 dark:placeholder-white/20 focus:outline-none focus:border-[#c8f135]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer" onClick={() => setNewPost(p => ({ ...p, personalize_ai: !p.personalize_ai }))}>
                    <input type="checkbox" checked={newPost.personalize_ai} readOnly className="sr-only" />
                    <div className={`w-8 h-5 rounded-full p-[2px] flex items-center ${newPost.personalize_ai ? 'bg-[#c8f135]' : 'bg-gray-300 dark:bg-white/20'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${newPost.personalize_ai ? 'translate-x-3' : ''}`} />
                    </div>
                    <span className="text-[13px] font-semibold text-gray-800 dark:text-white">AI-personalise tone</span>
                  </label>

                  <button type="submit" disabled={submitting} className="btn-primary px-6 py-2 text-[13px]">
                    {submitting ? 'Scheduling…' : 'Schedule Broadcast'}
                  </button>
                </div>
              </form>
            )}

            {/* Queue list */}
            {loadingPosts ? (
              <div className="p-8 text-center text-gray-400 animate-pulse text-[14px]">Loading queue…</div>
            ) : posts.length === 0 ? (
              <p className="text-[13px] text-gray-400 dark:text-white/30 text-center py-8">No scheduled broadcasts in queue.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {pendingPosts.length > 0 && (
                  <div className="py-2">
                    <p className="label-xs text-amber-500 font-bold uppercase tracking-widest mb-2">Pending Delivery</p>
                    {pendingPosts.map(p => <PostRow key={p.id} post={p} onCancel={cancelPost} />)}
                  </div>
                )}
                {pastPosts.length > 0 && (
                  <div className="py-2">
                    <p className="label-xs text-gray-400 dark:text-white/30 uppercase tracking-widest mb-2">History</p>
                    {pastPosts.slice(0, 15).map(p => <PostRow key={p.id} post={p} onCancel={cancelPost} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
