import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  HiOutlineBolt,
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineNewspaper,
  HiOutlineCalendarDays,
  HiOutlineTrash,
  HiOutlinePlusCircle,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineSparkles,
} from 'react-icons/hi2'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ── Toggle Switch component ────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-[#9FFF57]' : 'bg-gray-300 dark:bg-white/20'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ── Feature card with toggle ──────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, description, badge, checked, onChange, disabled, children }) {
  return (
    <div className={`bg-white dark:bg-[#111] rounded-[10px] p-6 border transition-all ${
      checked
        ? 'border-[#9FFF57]/40 dark:border-[#9FFF57]/30'
        : 'border-gray-200 dark:border-white/10'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`w-10 h-10 rounded-[8px] flex items-center justify-center flex-shrink-0 ${
            checked ? 'bg-[#9FFF57]/15' : 'bg-gray-100 dark:bg-white/5'
          }`}>
            <Icon size={20} className={checked ? 'text-[#9FFF57]' : 'text-gray-500 dark:text-white/40'} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[14px] font-bold text-gray-900 dark:text-[#f2f3f5]">{title}</h3>
              {badge && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#9FFF57]/15 text-[#9FFF57]">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-[13px] text-gray-500 dark:text-[#96989d] leading-relaxed">{description}</p>
          </div>
        </div>
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
      {children && checked && (
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Scheduled post row ────────────────────────────────────────────────────
function PostRow({ post, onCancel }) {
  const isPending = post.status === 'pending'
  const isSent = post.status === 'sent'
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className={`mt-0.5 flex-shrink-0 ${isSent ? 'text-[#9FFF57]' : isPending ? 'text-[#f0883e]' : 'text-gray-400'}`}>
        {isSent ? <HiOutlineCheckCircle size={16} /> : isPending ? <HiOutlineClock size={16} /> : <HiOutlineXCircle size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-gray-800 dark:text-[#dbdee1] leading-snug truncate">{post.content}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[12px] text-gray-400 dark:text-[#72767d]">
            {post.communities?.name || 'Unknown community'} · {new Date(post.scheduled_time).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            })}
          </span>
          {post.personalize_ai && (
            <span className="text-[11px] font-semibold text-[#9FFF57] flex items-center gap-0.5">
              <HiOutlineSparkles size={11} /> AI
            </span>
          )}
        </div>
      </div>
      {isPending && (
        <button
          onClick={() => onCancel(post.id)}
          className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0 p-1"
        >
          <HiOutlineTrash size={14} />
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AutomationsPage() {
  const { user } = useAuth()

  const [settings, setSettings] = useState({
    ai_responder: true,
    daily_digest: true,
    scheduler: true,
    digest_time: '08:00',
  })
  const [saving, setSaving] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)

  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [communities, setCommunities] = useState([])

  // New post form
  const [showForm, setShowForm] = useState(false)
  const [newPost, setNewPost] = useState({
    community_id: '',
    content: '',
    scheduled_time: '',
    personalize_ai: false,
  })
  const [submitting, setSubmitting] = useState(false)

  // ── Helpers ──────────────────────────────────────────────────────────
  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  async function apiFetch(path, opts = {}) {
    const token = await getToken()
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Request failed')
    return res.json()
  }

  // ── Load on mount ────────────────────────────────────────────────────
  useEffect(() => {
    loadSettings()
    loadPosts()
    loadCommunities()
  }, [])

  async function loadSettings() {
    try {
      const data = await apiFetch('/api/automations/settings')
      setSettings(data)
    } catch (err) {
      toast.error('Could not load settings')
    } finally {
      setLoadingSettings(false)
    }
  }

  async function loadPosts() {
    try {
      const data = await apiFetch('/api/automations/posts')
      setPosts(data)
    } catch {
      // non-fatal
    } finally {
      setLoadingPosts(false)
    }
  }

  async function loadCommunities() {
    const { data } = await supabase
      .from('communities')
      .select('id, name, platform')
      .eq('creator_id', user.id)
      .order('name')
    setCommunities(data || [])
  }

  // ── Save settings ────────────────────────────────────────────────────
  async function saveSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    setSaving(true)
    try {
      await apiFetch('/api/automations/settings', { method: 'POST', body: next })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // ── Schedule post ────────────────────────────────────────────────────
  async function schedulePost(e) {
    e.preventDefault()
    if (!newPost.community_id || !newPost.content || !newPost.scheduled_time) {
      toast.error('Please fill in all fields')
      return
    }
    setSubmitting(true)
    try {
      const created = await apiFetch('/api/automations/posts', {
        method: 'POST',
        body: {
          ...newPost,
          scheduled_time: new Date(newPost.scheduled_time).toISOString(),
        },
      })
      setPosts(prev => [created, ...prev])
      setNewPost({ community_id: '', content: '', scheduled_time: '', personalize_ai: false })
      setShowForm(false)
      toast.success('Post scheduled!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Cancel post ──────────────────────────────────────────────────────
  async function cancelPost(id) {
    try {
      await apiFetch(`/api/automations/posts/${id}`, { method: 'DELETE' })
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'cancelled' } : p))
      toast.success('Post cancelled')
    } catch {
      toast.error('Failed to cancel post')
    }
  }

  const pendingPosts = posts.filter(p => p.status === 'pending')
  const pastPosts    = posts.filter(p => p.status !== 'pending')

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 mt-2">
        <div>
          <h1 className="text-[28px] font-black text-black dark:text-white tracking-tight leading-tight">Automations</h1>
          <p className="text-[14px] text-gray-500 dark:text-white/50 mt-1">
            Control what Membba does automatically on your behalf
          </p>
        </div>
        {saving && (
          <span className="text-[13px] text-[#9FFF57] font-semibold animate-pulse">Saving…</span>
        )}
      </div>

      {/* Feature Toggles */}
      <section className="mb-8">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-500 dark:text-white/30 mb-4">
          AI Features
        </h2>
        <div className="space-y-3">

          {/* AI First Responder */}
          <FeatureCard
            icon={HiOutlineChatBubbleLeftEllipsis}
            title="AI First Responder"
            description="Automatically replies to member DMs using their live subscription data as context. Escalates to you when unsure."
            badge="Live"
            checked={settings.ai_responder}
            onChange={v => saveSettings({ ai_responder: v })}
            disabled={loadingSettings}
          />

          {/* Daily Digest */}
          <FeatureCard
            icon={HiOutlineNewspaper}
            title="Daily Admin Digest"
            description="Sends you a morning briefing on WhatsApp every day with new members, revenue, and escalations."
            badge="8am WAT"
            checked={settings.daily_digest}
            onChange={v => saveSettings({ daily_digest: v })}
            disabled={loadingSettings}
          >
            <div className="flex items-center gap-3">
              <label className="text-[13px] text-gray-500 dark:text-[#96989d] flex-shrink-0">Send at</label>
              <input
                type="time"
                value={settings.digest_time}
                onChange={e => setSettings(s => ({ ...s, digest_time: e.target.value }))}
                onBlur={() => saveSettings({ digest_time: settings.digest_time })}
                className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[6px] px-3 py-1.5 text-[13px] text-gray-900 dark:text-white text-center"
              />
              <span className="text-[12px] text-gray-400 dark:text-[#72767d]">WAT (Africa/Lagos)</span>
            </div>
          </FeatureCard>

          {/* Scheduled Broadcasts */}
          <FeatureCard
            icon={HiOutlineCalendarDays}
            title="Scheduled Broadcasts"
            description="Schedule messages to be sent to your communities at a specific time. Enable AI personalisation to auto-vary the tone per group."
            checked={settings.scheduler}
            onChange={v => saveSettings({ scheduler: v })}
            disabled={loadingSettings}
          />

        </div>
      </section>

      {/* Scheduled Posts Manager */}
      {settings.scheduler && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-gray-500 dark:text-white/30">
              Scheduled Posts {pendingPosts.length > 0 && (
                <span className="ml-2 text-[11px] text-[#9FFF57] normal-case font-semibold">
                  {pendingPosts.length} queued
                </span>
              )}
            </h2>
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100/50 hover:bg-gray-200/50 dark:bg-white/5 dark:hover:bg-white/10 text-[13px] font-bold text-gray-900 dark:text-white rounded-[8px] transition-all"
            >
              {showForm ? <HiOutlineXCircle size={16} className="text-gray-400" /> : <HiOutlinePlusCircle size={16} className="text-[#9FFF57]" />}
              {showForm ? 'Close Composer' : 'New Broadcast'}
            </button>
          </div>

          {/* New Post Form - Redesigned */}
          {showForm && (
            <form onSubmit={schedulePost} className="bg-[#fafafa] dark:bg-[#141414] rounded-[16px] p-6 sm:p-8 border border-gray-200 dark:border-white/10 shadow-2xl mb-8 space-y-6 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 w-full left-0 h-1 bg-gradient-to-r from-transparent via-[#9FFF57]/80 to-transparent opacity-100"></div>
              
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[18px] font-black tracking-tight text-gray-900 dark:text-white">Compose Broadcast</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Target Community
                  </label>
                  <select
                    value={newPost.community_id}
                    onChange={e => setNewPost(p => ({ ...p, community_id: e.target.value }))}
                    required
                    className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[12px] px-4 py-3 text-[14px] font-medium text-gray-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#9FFF57]/50 transition-all shadow-sm cursor-pointer"
                  >
                    <option value="" className="text-gray-400">Select a community…</option>
                    {communities.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.platform || 'telegram'})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Schedule For
                  </label>
                  <input
                    type="datetime-local"
                    value={newPost.scheduled_time}
                    onChange={e => setNewPost(p => ({ ...p, scheduled_time: e.target.value }))}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[12px] px-4 py-3 text-[14px] font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#9FFF57]/50 transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  <span>Message Body</span>
                  <span className={`lowercase tracking-normal font-medium ${newPost.content.length > 1000 ? 'text-red-400' : 'text-gray-400'}`}>
                    {newPost.content.length} / 1000 char
                  </span>
                </label>
                <textarea
                  value={newPost.content}
                  onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                  required
                  maxLength={1000}
                  rows={5}
                  placeholder="Draft your announcement here… Make it count."
                  className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[12px] px-4 py-3 text-[15px] leading-relaxed text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/20 resize-none focus:outline-none focus:ring-2 focus:ring-[#9FFF57]/50 transition-all shadow-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-5 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group rounded-lg p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-white/5 transition">
                  <div className={`w-10 h-6 flex items-center bg-gray-200 dark:bg-white/10 rounded-full p-1 transition duration-300 ease-in-out ${newPost.personalize_ai ? 'bg-[#9FFF57]' : ''}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ease-in-out ${newPost.personalize_ai ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newPost.personalize_ai}
                    onChange={e => setNewPost(p => ({ ...p, personalize_ai: e.target.checked }))}
                    className="hidden"
                  />
                  <div className="flex items-center gap-1.5">
                    <HiOutlineSparkles className={newPost.personalize_ai ? "text-[#9FFF57]" : "text-gray-400"} size={16} />
                    <span className="text-[13px] font-bold text-gray-700 dark:text-[#dbdee1] transition">
                      Auto-personalise tone per group with AI
                    </span>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto bg-[#9FFF57] hover:bg-[#b0ff6e] text-[#111] font-black px-8 py-3 rounded-[12px] text-[14px] flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 shadow-[0_0_15px_rgba(159,255,87,0.25)] hover:shadow-[0_0_25px_rgba(159,255,87,0.4)]"
                >
                  {submitting ? 'Setting up…' : (
                    <>
                      <HiOutlineCalendarDays size={18} />
                      Set Broadcast
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Queue */}
          <div className="bg-white dark:bg-[#111] rounded-[12px] border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
            {loadingPosts ? (
              <div className="p-8 text-center text-[14px] text-gray-400 dark:text-[#72767d] animate-pulse">Loading queue…</div>
            ) : posts.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HiOutlineCalendarDays size={32} className="text-gray-300 dark:text-white/20" />
                </div>
                <h4 className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">Queue is empty</h4>
                <p className="text-[14px] text-gray-400 dark:text-[#72767d]">No broadcasts are currently scheduled.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {pendingPosts.length > 0 && (
                  <div className="px-6 pt-5 pb-3">
                     <p className="text-[11px] font-bold uppercase tracking-widest text-[#9FFF57] mb-2 flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-[#9FFF57] animate-pulse"></span>
                       Queued for Delivery
                     </p>
                    <div className="space-y-1">
                      {pendingPosts.map(p => <PostRow key={p.id} post={p} onCancel={cancelPost} />)}
                    </div>
                  </div>
                )}
                {pastPosts.length > 0 && (
                  <div className="px-6 pt-5 pb-5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#72767d] mb-2">History logs</p>
                    <div className="space-y-1">
                       {pastPosts.slice(0, 10).map(p => <PostRow key={p.id} post={p} onCancel={cancelPost} />)}
                    </div>
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
