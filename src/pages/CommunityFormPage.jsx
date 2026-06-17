import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'
import telegramLogo from '../assets/icons8-telegram.svg'
import whatsappLogo from '../assets/icons8-whatsapp.svg'

const generateSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const parseDurationToMinutes = (text) => {
  const t = text.trim().toLowerCase()
  const match = t.match(/^(\d+(?:\.\d+)?)\s*(minute|minutes|min|hour|hours|hr|day|days|week|weeks|month|months)$/)
  if (!match) return null
  const num = parseFloat(match[1])
  const unit = match[2]
  if (unit.startsWith('minute') || unit === 'min') return Math.round(num)
  if (unit.startsWith('hour') || unit === 'hr') return Math.round(num * 60)
  if (unit.startsWith('day')) return Math.round(num * 24 * 60)
  if (unit.startsWith('week')) return Math.round(num * 7 * 24 * 60)
  if (unit.startsWith('month')) return Math.round(num * 30 * 24 * 60)
  return null
}

const formatDuration = (minutes) => {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  if (minutes < 1440) return `${Math.round(minutes / 60)} hour${Math.round(minutes / 60) !== 1 ? 's' : ''}`
  if (minutes < 10080) return `${Math.round(minutes / 1440)} day${Math.round(minutes / 1440) !== 1 ? 's' : ''}`
  if (minutes < 43200) return `${Math.round(minutes / 10080)} week${Math.round(minutes / 10080) !== 1 ? 's' : ''}`
  return `${Math.round(minutes / 43200)} month${Math.round(minutes / 43200) !== 1 ? 's' : ''}`
}

const emptyPlan = { name: '', description: '', price: '', duration: '' }

export default function CommunityFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [form, setForm] = useState({
    name: '',
    description: '',
    platform: 'telegram',
    telegram_chat_id: '',
    whatsapp_group_invite_link: '',
    welcome_message_enabled: true,
    welcome_message: "Hello {name}! Welcome to {community}. We're excited to have you onboard for the {plan} plan.",
  })
  const [activeTab, setActiveTab] = useState('settings') // 'settings' | 'automations'
  const [plans, setPlans] = useState([{ ...emptyPlan }])
  const [existingPlans, setExistingPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [registeringGroup, setRegisteringGroup] = useState(false)
  const [waGroupId, setWaGroupId] = useState(null)
  const [setupModal, setSetupModal] = useState(null) // null | { loading: true } | { allPass, checks }
  const [connectQr, setConnectQr] = useState(null)

  const openConnectQr = async () => {
    // Generate QR code to add bot to a group
    // Note: removed &admin=invite_users... as it often breaks the group search on some Telegram clients
    const deepLink = `https://t.me/membba_bot?startgroup=setup`
    try {
      const dataUrl = await QRCode.toDataURL(deepLink, { width: 300, margin: 2 })
      setConnectQr({ dataUrl, deepLink })
    } catch {
      toast.error('Failed to generate connection QR code')
    }
  }

  const runSetupCheck = async () => {
    setSetupModal({ loading: true, checks: [] })
    try {
      const res = await fetch(`/api/telegram/check-setup/${id}`)
      const data = await res.json()
      
      // Animate checks appearing one by one
      if (data.checks) {
        let currentChecks = []
        for (let i = 0; i < data.checks.length; i++) {
          await new Promise(r => setTimeout(r, 600)) // Artificial delay for premium feel
          currentChecks.push(data.checks[i])
          setSetupModal(prev => ({ ...prev, checks: [...currentChecks] }))
        }
        await new Promise(r => setTimeout(r, 400))
      }
      setSetupModal(prev => ({ ...prev, loading: false, allPass: data.allPass }))
    } catch {
      setSetupModal({ 
        loading: false, 
        allPass: false, 
        checks: [{ id: 'error', label: 'Could not reach server', pass: false, hint: 'Check your internet connection.' }] 
      })
    }
  }

  useEffect(() => { if (isEditing) fetchCommunity() }, [id])

  const fetchCommunity = async () => {
    const { data, error } = await supabase.from('communities').select('*').eq('id', id).single()
    if (error) return toast.error(error.message)
    setForm({
      name: data.name || '',
      description: data.description || '',
      platform: data.platform || 'telegram',
      telegram_chat_id: data.telegram_chat_id || '',
      whatsapp_group_invite_link: data.whatsapp_group_invite_link || '',
      welcome_message_enabled: data.welcome_message_enabled ?? true,
      welcome_message: data.welcome_message || "Hello {name}! Welcome to {community}. We're excited to have you onboard for the {plan} plan.",
    })
    setWaGroupId(data.whatsapp_group_id || null)

    const { data: planData } = await supabase
      .from('plans').select('*').eq('community_id', id).eq('is_active', true).order('created_at', { ascending: true })
    if (planData?.length) { setExistingPlans(planData); setPlans([{ ...emptyPlan }]) }
  }

  const handleFormChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const setPlatform = (p) => setForm(prev => ({ ...prev, platform: p }))

  const handlePlanChange = (index, e) => {
    const { name, value } = e.target
    setPlans(prev => prev.map((p, i) => i === index ? { ...p, [name]: value } : p))
  }

  const addPlanRow = () => setPlans(prev => [...prev, { ...emptyPlan }])
  const removePlanRow = (index) => setPlans(prev => prev.filter((_, i) => i !== index))

  const handleDeleteExistingPlan = async (planId) => {
    if (!confirm('Delete this plan? Existing subscribers keep access until expiry.')) return
    const { error } = await supabase.from('plans').update({ is_active: false }).eq('id', planId)
    if (error) return toast.error(error.message)
    setExistingPlans(prev => prev.filter(p => p.id !== planId))
    toast.success('Plan removed')
  }

  const handleRegisterWhatsAppGroup = async () => {
    if (!form.whatsapp_group_invite_link.trim()) {
      return toast.error('Enter a WhatsApp group invite link first')
    }
    if (!form.whatsapp_group_invite_link.includes('chat.whatsapp.com')) {
      return toast.error('Invalid WhatsApp invite link — must contain chat.whatsapp.com')
    }
    setRegisteringGroup(true)
    try {
      const res = await fetch('/api/whatsapp/join-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_link: form.whatsapp_group_invite_link,
          community_id: id || null,
        }),
      })
      const data = await res.json()
      if (data.group_id) {
        setWaGroupId(data.group_id)
        toast.success('WhatsApp group registered! ✅')
      } else {
        toast.error(data.message || 'Failed to join group')
      }
    } catch {
      toast.error('Could not reach server')
    } finally {
      setRegisteringGroup(false)
    }
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)

    const parsedPlans = []
    for (const plan of plans) {
      if (!plan.name && !plan.price && !plan.duration) continue
      if (!plan.name || !plan.price || !plan.duration) {
        toast.error('Each plan needs a name, price, and duration')
        setLoading(false)
        return
      }
      const minutes = parseDurationToMinutes(plan.duration)
      if (!minutes || minutes <= 0) {
        toast.error(`Invalid duration "${plan.duration}". Try: "7 days", "30 days", "2 minutes"`)
        setLoading(false)
        return
      }
      parsedPlans.push({ ...plan, duration_minutes: minutes, price: parseFloat(plan.price) })
    }

    if (!isEditing && parsedPlans.length === 0) {
      toast.error('Add at least one subscription plan')
      setLoading(false)
      return
    }

    // Platform-specific validation
    if (form.platform === 'telegram' && !form.telegram_chat_id) {
      toast.error('Telegram Chat ID is required for Telegram communities')
      setLoading(false)
      return
    }

    const payload = {
      name: form.name,
      description: form.description,
      platform: form.platform,
      telegram_chat_id: form.platform === 'telegram' && form.telegram_chat_id
        ? parseInt(form.telegram_chat_id) : null,
      whatsapp_group_invite_link: form.platform === 'whatsapp'
        ? form.whatsapp_group_invite_link || null : null,
      welcome_message_enabled: form.welcome_message_enabled,
      welcome_message: form.welcome_message,
      creator_id: user.id,
      is_active: true,
    }

    let communityId = id
    let error

    if (isEditing) {
      const res = await supabase.from('communities').update(payload).eq('id', id)
      error = res.error
    } else {
      const res = await supabase.from('communities')
        .insert({ ...payload, slug: generateSlug(form.name) }).select().single()
      error = res.error
      if (!error) communityId = res.data.id
    }

    if (error) { toast.error(error.message); setLoading(false); return }

    if (parsedPlans.length > 0) {
      const { error: planError } = await supabase.from('plans').insert(
        parsedPlans.map(p => ({
          community_id: communityId,
          name: p.name,
          description: p.description || null,
          price: p.price,
          currency: 'NGN',
          duration_minutes: p.duration_minutes,
          is_active: true,
        }))
      )
      if (planError) { toast.error('Community saved but plans failed: ' + planError.message); setLoading(false); return }
    }

    setLoading(false)
    toast.success(isEditing ? 'Community updated!' : 'Community created!')
    navigate('/dashboard/communities')
  }

  const slug = generateSlug(form.name)

  return (
    <>
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">
                {isEditing ? 'Edit Community' : 'Create Community'}
              </h1>
              <p className="text-[14px] text-white/50 mt-1.5">Set up your paid community in a few steps</p>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={runSetupCheck}
                className="flex-shrink-0 inline-flex items-center gap-1.5 border border-white/[0.1] text-white/50 px-4 py-2 rounded-lg text-[12.5px] font-semibold hover:border-white/20 hover:text-white/70 transition-colors"
              >
                📋 Test Setup
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4 mb-8 border-b border-white/[0.05]">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`pb-4 text-[14px] font-bold transition-colors ${activeTab === 'settings' ? 'text-[#9FFF57] border-b-2 border-[#9FFF57]' : 'text-white/40 hover:text-white/70'}`}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('automations')}
            className={`pb-4 text-[14px] font-bold transition-colors ${activeTab === 'automations' ? 'text-[#9FFF57] border-b-2 border-[#9FFF57]' : 'text-white/40 hover:text-white/70'}`}
          >
            Automations
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Settings Tab */}
          <div className={activeTab === 'settings' ? 'space-y-6' : 'hidden'}>

          {/* Community Details */}
          <div className="bg-[#111] border border-white/[0.07] rounded-xl p-7 space-y-5">
            <h2 className="text-[15px] font-bold text-white">Community Details</h2>

            <div>
              <label className="block text-[11px] font-bold text-white/45 mb-2 uppercase tracking-widest">Community Name *</label>
              <input
                type="text" name="name" required value={form.name} onChange={handleFormChange}
                className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#9FFF57]/40 focus:ring-1 focus:ring-[#9FFF57]/15 transition-colors"
                placeholder="e.g. Crypto Inner Circle"
              />
              {form.name && !isEditing && (
                <p className="text-[11.5px] text-white/30 mt-2 font-mono">
                  {window.location.origin}/join/{slug}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white/45 mb-2 uppercase tracking-widest">Description</label>
              <textarea
                name="description" value={form.description} onChange={handleFormChange} rows={3}
                className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#9FFF57]/40 focus:ring-1 focus:ring-[#9FFF57]/15 transition-colors resize-none"
                placeholder="What will members get access to?"
              />
            </div>

            {/* ─── n8n-style Platform Picker ─── */}
            <div>
              <label className="block text-[11px] font-bold text-white/40 mb-4 uppercase tracking-widest">Platform *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Telegram Card */}
                <button
                  type="button"
                  onClick={() => setPlatform('telegram')}
                  className={`group relative overflow-hidden text-left rounded-2xl border-2 p-5 transition-all duration-300 ${
                    form.platform === 'telegram'
                      ? 'border-[#229ED9] bg-[#229ED9]/[0.07] shadow-[0_0_30px_rgba(34,158,217,0.12)]'
                      : 'border-white/[0.06] bg-white/[0.02] opacity-60 hover:opacity-80 hover:border-white/[0.12]'
                  }`}
                >
                  {/* watermark logo */}
                  <img src={telegramLogo} alt="" className="absolute right-4 top-1/2 -translate-y-1/2 w-20 h-20 opacity-[0.06] select-none pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        form.platform === 'telegram' ? 'bg-[#229ED9]/20' : 'bg-white/[0.04]'
                      }`}>
                        <img src={telegramLogo} alt="Telegram" className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-white">Telegram</p>
                        {form.platform === 'telegram' && (
                          <span className="text-[10px] font-bold text-[#229ED9] uppercase tracking-widest">Selected</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[12px] text-white/40 leading-relaxed">Bot auto-adds &amp; removes members. Fully automated, no phone number needed.</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {['Instant delivery','Bot-managed','Reliable'].map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[#229ED9]/10 text-[#229ED9]/80 border border-[#229ED9]/15 font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                </button>

                {/* WhatsApp Card */}
                <button
                  type="button"
                  onClick={() => setPlatform('whatsapp')}
                  className={`group relative overflow-hidden text-left rounded-2xl border-2 p-5 transition-all duration-300 ${
                    form.platform === 'whatsapp'
                      ? 'border-[#25D366] bg-[#25D366]/[0.07] shadow-[0_0_30px_rgba(37,211,102,0.10)]'
                      : 'border-white/[0.06] bg-white/[0.02] opacity-60 hover:opacity-80 hover:border-white/[0.12]'
                  }`}
                >
                  {/* watermark logo */}
                  <img src={whatsappLogo} alt="" className="absolute right-4 top-1/2 -translate-y-1/2 w-20 h-20 opacity-[0.06] select-none pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        form.platform === 'whatsapp' ? 'bg-[#25D366]/20' : 'bg-white/[0.04]'
                      }`}>
                        <img src={whatsappLogo} alt="WhatsApp" className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-white">WhatsApp</p>
                        {form.platform === 'whatsapp' && (
                          <span className="text-[10px] font-bold text-[#25D366] uppercase tracking-widest">Selected</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[12px] text-white/40 leading-relaxed">Via dedicated WhatsApp number. Managed via whatsapp-web.js on your server.</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {['Requires number','Invite-based','Manual setup'].map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[#25D366]/10 text-[#25D366]/80 border border-[#25D366]/15 font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                </button>
              </div>
            </div>

          </div>{/* end Community Details card */}

          {/* ─── Telegram Setup Section ─── */}
          {form.platform === 'telegram' && (
            <div
              className="rounded-2xl border-2 border-[#229ED9]/30 bg-[#229ED9]/[0.04] relative overflow-hidden"
              style={{ boxShadow: '0 0 40px rgba(34,158,217,0.06)' }}
            >
              {/* Corner watermark */}
              <img src={telegramLogo} alt="" className="absolute -right-6 -bottom-6 w-36 h-36 opacity-[0.04] pointer-events-none select-none" />

              {/* Header */}
              <div className="flex items-center gap-3 px-7 py-5 border-b border-[#229ED9]/10">
                <div className="w-9 h-9 rounded-xl bg-[#229ED9]/15 flex items-center justify-center">
                  <img src={telegramLogo} alt="Telegram" className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[14px] font-black text-white">Telegram Group Setup</p>
                  <p className="text-[11.5px] text-[#229ED9]/70">Connect your group in 2 steps</p>
                </div>
              </div>

              <div className="px-7 py-6 space-y-6">

                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#229ED9]/20 border border-[#229ED9]/30 flex items-center justify-center text-[#229ED9] text-[12px] font-black">1</div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-white mb-1">Add Membba Bot to your group as Admin</p>
                    <p className="text-[12px] text-white/40 mb-3">Scan the QR or click the button to open Telegram and select your group. The bot will automatically send your Chat ID.</p>
                    <button
                      type="button"
                      onClick={openConnectQr}
                      className="inline-flex items-center gap-2 bg-[#229ED9] text-white text-[13px] font-bold px-5 py-2.5 rounded-xl hover:bg-[#1a8fc4] transition-colors"
                    >
                      <img src={telegramLogo} alt="" className="w-4 h-4 invert brightness-0" />
                      Connect via Bot
                    </button>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#229ED9]/20 border border-[#229ED9]/30 flex items-center justify-center text-[#229ED9] text-[12px] font-black">2</div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-white mb-1">Paste your Group Chat ID</p>
                    <p className="text-[12px] text-white/40 mb-3">The bot will post the ID to your group. Copy it here. It will self-destruct in 5 minutes.</p>
                    <input
                      type="text"
                      name="telegram_chat_id"
                      value={form.telegram_chat_id || ''}
                      onChange={handleFormChange}
                      className="w-full bg-[#0a0a0a] border border-[#229ED9]/20 rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#229ED9]/50 focus:ring-1 focus:ring-[#229ED9]/15 transition-colors font-mono"
                      placeholder="e.g. -1001234567890"
                    />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ─── WhatsApp Setup Section ─── */}
          {form.platform === 'whatsapp' && (
            <div
              className="rounded-2xl border-2 border-[#25D366]/30 bg-[#25D366]/[0.03] relative overflow-hidden"
              style={{ boxShadow: '0 0 40px rgba(37,211,102,0.05)' }}
            >
              {/* Corner watermark */}
              <img src={whatsappLogo} alt="" className="absolute -right-6 -bottom-6 w-36 h-36 opacity-[0.04] pointer-events-none select-none" />

              {/* Header */}
              <div className="flex items-center gap-3 px-7 py-5 border-b border-[#25D366]/10">
                <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 flex items-center justify-center">
                  <img src={whatsappLogo} alt="WhatsApp" className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[14px] font-black text-white">WhatsApp Group Setup</p>
                  <p className="text-[11.5px] text-[#25D366]/70">Requires a dedicated WhatsApp number</p>
                </div>
              </div>

              <div className="px-7 py-6 space-y-6">

                {/* Requirements notice */}
                <div className="flex gap-3 bg-yellow-400/5 border border-yellow-400/15 rounded-xl p-4">
                  <span className="text-yellow-400 text-[16px] flex-shrink-0">⚠</span>
                  <div className="text-[12px] text-white/50 space-y-1 leading-relaxed">
                    <p className="text-yellow-400 font-bold text-[12.5px] mb-1.5">Requirements</p>
                    <p>Use a <span className="text-white/80">dedicated WhatsApp number</span> — never your personal number.</p>
                    <p>Authenticate the number at <span className="text-white/60 font-mono text-[11px]">/api/whatsapp/qr</span> before continuing.</p>
                  </div>
                </div>

                {/* Group invite link */}
                <div>
                  <label className="block text-[11px] font-bold text-white/40 mb-2 uppercase tracking-widest">Group Invite Link *</label>
                  <input
                    type="url"
                    name="whatsapp_group_invite_link"
                    value={form.whatsapp_group_invite_link}
                    onChange={handleFormChange}
                    className="w-full bg-[#0a0a0a] border border-[#25D366]/20 rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#25D366]/50 focus:ring-1 focus:ring-[#25D366]/15 transition-colors"
                    placeholder="https://chat.whatsapp.com/xxxxxxxxxx"
                  />
                </div>

                {/* Register button */}
                {isEditing ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRegisterWhatsAppGroup}
                      disabled={registeringGroup}
                      className="inline-flex items-center gap-2 bg-[#25D366] text-white text-[13px] font-bold px-5 py-2.5 rounded-xl hover:bg-[#1da851] disabled:opacity-50 transition-colors"
                    >
                      <img src={whatsappLogo} alt="" className="w-4 h-4 invert brightness-0" />
                      {registeringGroup ? 'Joining group...' : 'Register Group'}
                    </button>
                    {waGroupId && <span className="text-[12.5px] text-[#9FFF57] font-semibold">✅ Registered ({waGroupId})</span>}
                    {!waGroupId && <span className="text-[12.5px] text-yellow-400/70">⚠ Not yet registered</span>}
                  </div>
                ) : (
                  <p className="text-[12px] text-white/30">Save the community first, then return here to register the group.</p>
                )}

              </div>
            </div>
          )}

          {/* Existing Plans (edit mode) */}
          {isEditing && existingPlans.length > 0 && (
            <div className="bg-[#111] border border-white/[0.07] rounded-xl p-7">
              <h2 className="text-[15px] font-bold text-white mb-5">Existing Plans</h2>
              <div className="space-y-2">
                {existingPlans.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-3.5">
                    <div>
                      <span className="font-semibold text-[14px] text-white">{p.name}</span>
                      <span className="text-white/35 ml-3 text-[12.5px]">₦{p.price.toLocaleString()} · {formatDuration(p.duration_minutes)}</span>
                    </div>
                    <button type="button" onClick={() => handleDeleteExistingPlan(p.id)}
                      className="text-[12px] text-red-400/70 hover:text-red-400 transition-colors font-medium">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Builder */}
          <div className="bg-[#111] border border-white/[0.07] rounded-xl p-7 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-white">{isEditing ? 'Add New Plans' : 'Subscription Plans'}</h2>
                <p className="text-[12px] text-white/35 mt-1">
                  e.g. <span className="font-mono text-white/50">2 minutes</span>, <span className="font-mono text-white/50">7 days</span>, <span className="font-mono text-white/50">30 days</span>, <span className="font-mono text-white/50">1 month</span>
                </p>
              </div>
              <button type="button" onClick={addPlanRow}
                className="text-[12.5px] border border-[#9FFF57]/25 text-[#9FFF57]/80 px-4 py-2 rounded-lg hover:bg-[#9FFF57]/5 hover:text-[#9FFF57] transition-all font-semibold">
                + Add Plan
              </button>
            </div>

            {plans.map((plan, i) => (
              <div key={i} className="border border-white/[0.07] bg-[#0a0a0a] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Plan {i + 1}</p>
                  {plans.length > 1 && (
                    <button type="button" onClick={() => removePlanRow(i)}
                      className="text-[12px] text-red-400/60 hover:text-red-400 transition-colors">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-white/40 mb-2 uppercase tracking-widest">Plan Name *</label>
                    <input type="text" name="name" value={plan.name} onChange={e => handlePlanChange(i, e)}
                      className="w-full bg-[#111] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#9FFF57]/40 focus:ring-1 focus:ring-[#9FFF57]/15 transition-colors"
                      placeholder="Monthly Plan" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/40 mb-2 uppercase tracking-widest">Price (₦) *</label>
                    <input type="number" name="price" min="100" value={plan.price} onChange={e => handlePlanChange(i, e)}
                      className="w-full bg-[#111] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#9FFF57]/40 focus:ring-1 focus:ring-[#9FFF57]/15 transition-colors"
                      placeholder="2000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-white/40 mb-2 uppercase tracking-widest">Duration *</label>
                    <input type="text" name="duration" value={plan.duration} onChange={e => handlePlanChange(i, e)}
                      className="w-full bg-[#111] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#9FFF57]/40 focus:ring-1 focus:ring-[#9FFF57]/15 transition-colors"
                      placeholder="e.g. 30 days" />
                    {plan.duration && (() => {
                      const mins = parseDurationToMinutes(plan.duration)
                      return mins
                        ? <p className="text-[12px] text-[#9FFF57] mt-1.5 font-medium">✓ {formatDuration(mins)}</p>
                        : <p className="text-[12px] text-red-400 mt-1.5">Invalid format</p>
                    })()}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-white/40 mb-2 uppercase tracking-widest">Description (optional)</label>
                    <input type="text" name="description" value={plan.description} onChange={e => handlePlanChange(i, e)}
                      className="w-full bg-[#111] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#9FFF57]/40 focus:ring-1 focus:ring-[#9FFF57]/15 transition-colors"
                      placeholder="What's included" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          </div>

          {/* Automations Tab */}
          <div className={activeTab === 'automations' ? 'space-y-6' : 'hidden'}>
            <div className="bg-[#111] border border-white/[0.07] rounded-xl p-7">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-[15px] font-bold text-white mb-1">Welcome Message</h2>
                  <p className="text-[12px] text-white/40">Send an automated DM to new subscribers when they pay.</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-[12px] font-bold text-white/50">{form.welcome_message_enabled ? 'ON' : 'OFF'}</span>
                  <input type="checkbox" name="welcome_message_enabled" checked={form.welcome_message_enabled} onChange={e => handleFormChange({target: {name: 'welcome_message_enabled', value: e.target.checked}})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-white/[0.05] border border-white/[0.1] rounded-full peer peer-checked:bg-[#9FFF57]/20 peer-checked:border-[#9FFF57]/50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/40 peer-checked:after:bg-[#9FFF57] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-[20px] relative"></div>
                </label>
              </div>

              <div className={form.welcome_message_enabled ? 'mt-6 pt-6 border-t border-white/[0.05]' : 'hidden'}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11px] font-bold text-white/45 mb-2 uppercase tracking-widest">Message Template</label>
                    <textarea 
                      rows={6} 
                      name="welcome_message" 
                      value={form.welcome_message} 
                      onChange={handleFormChange} 
                      placeholder="Welcome {name}..." 
                      className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white focus:border-[#9FFF57]/40 outline-none resize-none leading-relaxed" 
                    />
                    <p className="text-[12px] text-white/30 mt-3 leading-relaxed">
                      Variables: <code className="bg-white/5 border border-white/[0.05] px-1.5 py-0.5 rounded text-[#9FFF57]">{"{name}"}</code> <code className="bg-white/5 border border-white/[0.05] px-1.5 py-0.5 rounded text-[#9FFF57]">{"{community}"}</code> <br className="hidden lg:block"/> <code className="bg-white/5 border border-white/[0.05] px-1.5 py-0.5 rounded text-[#9FFF57] mt-1 lg:mt-0 inline-block">{"{plan}"}</code> <code className="bg-white/5 border border-white/[0.05] px-1.5 py-0.5 rounded text-[#9FFF57]">{"{expires_on}"}</code>
                    </p>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/[0.05] rounded-xl p-5 shadow-inner">
                    <p className="text-[11px] font-bold text-white/20 mb-3 uppercase tracking-widest">Live Preview</p>
                    <p className="text-[14px] text-white/70 whitespace-pre-wrap leading-relaxed">
                      {form.welcome_message
                        .replace(/{name}/g, "JohnDoe")
                        .replace(/{community}/g, form.name || "Your Community")
                        .replace(/{plan}/g, plans[0]?.name || existingPlans[0]?.name || "Pro")
                        .replace(/{expires_on}/g, new Date().toLocaleDateString())
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="bg-[#9FFF57] text-black px-7 py-3 rounded-xl text-[14px] font-bold hover:bg-[#b0ff6e] disabled:opacity-50 transition-colors">
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Community'}
            </button>
            <button type="button" onClick={() => navigate('/dashboard/communities')}
              className="border border-white/[0.1] text-white/45 px-7 py-3 rounded-xl text-[14px] font-medium hover:border-white/20 hover:text-white/70 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>

      {/* TSK-105/TSK-106: Test Setup Modal with sequential fading */}
      {setupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#111] border border-white/[0.1] rounded-2xl p-7 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setSetupModal(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              disabled={setupModal.loading && (setupModal.checks || []).length < 2}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h3 className="text-[16px] font-black text-white mb-5">📋 Running Diagnostics...</h3>
            
            <div className="space-y-4 mb-6 min-h-[120px]">
              {/* Render verified checks sequentially */}
              {(setupModal.checks || []).map((c, i) => (
                <div key={c.id} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <span className="flex-shrink-0 mt-0.5 text-[16px]">{c.pass ? '✅' : '❌'}</span>
                  <div>
                    <p className={`text-[13px] font-semibold ${c.pass ? 'text-white/70' : 'text-white'}`}>{c.label}</p>
                    {!c.pass && <p className="text-[12px] text-white/35 mt-0.5 leading-relaxed">{c.hint}</p>}
                  </div>
                </div>
              ))}

              {/* Show simple spinner for pending check */}
              {setupModal.loading && (
                <div className="flex items-center gap-3 opacity-50 animate-pulse">
                   <svg className="animate-spin text-[#9FFF57] flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <p className="text-[13px] font-semibold text-white/50">Processing...</p>
                </div>
              )}
            </div>

            {!setupModal.loading && (
              <div className={`rounded-xl px-4 py-3 text-[13px] font-semibold text-center animate-in fade-in zoom-in-95 duration-500 ${setupModal.allPass ? 'bg-[#9FFF57]/10 text-[#9FFF57] border border-[#9FFF57]/20' : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'}`}>
                {setupModal.allPass ? '🚀 All systems go — your community is live!' : '⚠️ Fix the issues above before marketing.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TSK-106: Connect via Telegram Bot Modal */}
      {connectQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#111] border border-white/[0.1] rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl relative">
            <button
              onClick={() => setConnectQr(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            
            <div className="mx-auto w-12 h-12 bg-[#229ED9]/10 rounded-full flex items-center justify-center mb-4 text-[#229ED9]">
              <FaTelegram size={24} />
            </div>
            <h3 className="text-[17px] font-black text-white mb-2">Connect Telegram Group</h3>
            <p className="text-[12.5px] text-white/40 mb-6 leading-relaxed px-2">
              Scan this QR to add Membba Bot as an admin to your Telegram Group. It will reply with your Chat ID.
            </p>
            
            <div className="bg-white p-3 rounded-2xl inline-block mb-6 shadow-lg">
              <img src={connectQr.dataUrl} alt="Connect Telegram Bot" className="w-48 h-48" />
            </div>

            <p className="text-[11.5px] font-bold text-white/30 uppercase tracking-widest mb-3" >OR CLICK DIRECTLY</p>
            
            <a
              href={connectQr.deepLink}
              target="_blank" rel="noopener noreferrer"
              className="block w-full border border-[#229ED9]/40 bg-[#229ED9]/10 text-[#229ED9] px-5 py-3 rounded-xl text-[14px] font-bold hover:bg-[#229ED9]/20 transition-colors"
            >
              Open in Telegram
            </a>
          </div>
        </div>
      )}
    </>
  )
}
