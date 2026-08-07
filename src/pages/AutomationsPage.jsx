import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  HiOutlineChatBubbleLeftEllipsis,
  HiOutlineNewspaper,
  HiOutlineCalendarDays,
  HiOutlineSparkles,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineArrowPath,
} from 'react-icons/hi2'
import API_BASE from '../lib/api'

// ─── Toggle ─────────────────────────────────────────────────────
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

// ─── Status pill ───────────────────────────────────────────────
function StatusPill({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full tracking-wide
      ${active
        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'}`} />
      {active ? 'ACTIVE' : 'INACTIVE'}
    </span>
  )
}

// ─── System Status Bar ─────────────────────────────────────────
function SystemStatusBar({ readiness }) {
  if (!readiness) return null
  const items = [
    { label: 'Groq AI',       ok: readiness.groq,                            neutral: false },
    { label: 'WhatsApp API',  ok: readiness.whatsapp_status === 'connected',  neutral: false },
    { label: 'Admin Alerts',  ok: readiness.admin_jid,                        neutral: !readiness.admin_jid, degraded: !readiness.admin_jid },
  ]
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] px-5 py-3">
      <span className="label-xs text-gray-500 dark:text-white/40 uppercase tracking-widest">System Status:</span>
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-1.5 text-[13px] font-semibold">
          <span className={`w-2 h-2 rounded-full ${item.ok ? 'bg-emerald-500' : item.degraded ? 'bg-amber-400' : 'bg-red-500'}`} />
          <span className="text-gray-800 dark:text-white">{item.label}</span>
          {item.degraded && !item.ok && (
            <span className="text-[11px] text-amber-400 font-bold">{'{Degraded}'}</span>
          )}
        </span>
      ))}
    </div>
  )
}

// ─── Automation Row Card ───────────────────────────────────────
function AutomationRow({ icon: Icon, iconBg, iconColor, title, description, active, onToggle, disabled, onConfigure }) {
  return (
    <div className={`flex items-center gap-4 bg-white dark:bg-[#111] border px-5 py-5 transition-all
      ${active ? 'border-gray-200 dark:border-white/10' : 'border-gray-100 dark:border-white/5 opacity-75'}`}>
      {/* Icon */}
      <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">{title}</h3>
          <StatusPill active={active} />
        </div>
        <p className="text-[13px] text-gray-500 dark:text-white/40 leading-relaxed">{description}</p>
      </div>

      {/* Action area */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="h-8 w-px bg-gray-200 dark:bg-white/10" />
        <button
          type="button"
          onClick={onConfigure}
          className="text-[13px] font-semibold text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors px-1"
        >
          Configure
        </button>
        <Toggle checked={active} onChange={onToggle} disabled={disabled} />
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────
export default function AutomationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [settings, setSettings] = useState({
    ai_responder: false,
    daily_digest: false,
    scheduler:    false,
    digest_time:  '08:00',
  })
  const [saving, setSaving]               = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [readiness, setReadiness] = useState(null)

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
    loadReadiness()
  }, [])

  async function loadSettings() {
    try {
      const data = await apiFetch('/api/automations/settings')
      if (data) setSettings(prev => ({ ...prev, ...data }))
    } catch { /* leave defaults */ }
    finally { setLoadingSettings(false) }
  }

  async function loadReadiness() {
    try {
      const data = await apiFetch('/api/ai/status')
      setReadiness(data)
    } catch { setReadiness(null) }
  }

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

  const automations = [
    {
      key:         'ai_responder',
      icon:        HiOutlineChatBubbleLeftEllipsis,
      iconBg:      settings.ai_responder ? 'bg-[#c8f135]/15' : 'bg-gray-100 dark:bg-white/5',
      iconColor:   settings.ai_responder ? 'text-[#c8f135]' : 'text-gray-400 dark:text-white/25',
      title:       'AI First Responder',
      description: 'Automatically replies to member DMs using live subscription context. Escalates to you when unsure.',
      active:      settings.ai_responder,
    },
    {
      key:         'daily_digest',
      icon:        HiOutlineNewspaper,
      iconBg:      settings.daily_digest ? 'bg-violet-100 dark:bg-violet-500/15' : 'bg-gray-100 dark:bg-white/5',
      iconColor:   settings.daily_digest ? 'text-violet-500' : 'text-gray-400 dark:text-white/25',
      title:       'Daily Admin Digest',
      description: 'Sends you a WhatsApp morning briefing with new members, revenue, and open escalations.',
      active:      settings.daily_digest,
    },
    {
      key:         'scheduler',
      icon:        HiOutlineCalendarDays,
      iconBg:      settings.scheduler ? 'bg-amber-100 dark:bg-amber-400/10' : 'bg-gray-100 dark:bg-white/5',
      iconColor:   settings.scheduler ? 'text-amber-500' : 'text-gray-400 dark:text-white/25',
      title:       'Scheduled Broadcasts',
      description: 'Send timed messages to your communities. Optionally let AI personalise the tone per group.',
      active:      settings.scheduler,
    },
  ]

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title text-gray-900 dark:text-white">Automations</h1>
          <p className="body-md text-gray-500 dark:text-white/40 mt-1">
            Control what Membba does on your behalf automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[13px] text-[#c8f135] font-bold animate-pulse">Saving…</span>}
          <Link
            to="/dashboard/ai-inbox"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <HiOutlineSparkles size={14} /> Open AI Inbox
          </Link>
        </div>
      </div>

      {/* System status bar */}
      <SystemStatusBar readiness={readiness} />

      {/* Automation rows */}
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/5 border border-gray-200 dark:border-white/10 overflow-hidden">
        {automations.map(a => (
          <AutomationRow
            key={a.key}
            {...a}
            disabled={loadingSettings}
            onToggle={v => saveSettings({ [a.key]: v })}
            onConfigure={() => navigate(`/dashboard/automations/${a.key}`)}
          />
        ))}
      </div>
    </>
  )
}
