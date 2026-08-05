import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

import Select from '../components/Select'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'
import telegramLogo from '../assets/icons8-telegram.svg'
import whatsappLogo from '../assets/icons8-whatsapp.svg'
import API_BASE from '../lib/api'
import Tooltip from '../components/Tooltip'

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
    invite_link_ttl_minutes: 60,
    msg_auto_delete_seconds: 120,
  })
  const [currentStep, setCurrentStep] = useState(1) // 1: Platform, 2: Config, 3: Plans, 4: Automations

  const handleNext = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      if (!form.platform) {
        toast.error('Please select a platform')
        return
      }
    }
    if (currentStep === 2) {
      if (!form.name.trim()) {
        toast.error('Community name is required')
        return
      }
      if (form.platform === 'telegram' && !form.telegram_chat_id.trim()) {
        toast.error('Telegram Chat ID is required')
        return
      }
      if (form.platform === 'whatsapp' && !form.whatsapp_group_invite_link.trim()) {
        toast.error('WhatsApp group invite link is required')
        return
      }
    }
    if (currentStep === 3) {
      const hasValidPlan = [...plans, ...existingPlans].some(p => p.name?.trim() && p.price && p.duration)
      if (!hasValidPlan) {
        toast.error('Add at least one complete plan (name, price, duration)')
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setCurrentStep(s => Math.min(4, s + 1))
  }
  const handlePrev = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setCurrentStep(s => Math.max(1, s - 1))
  }
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
      const res = await fetch(`${API_BASE}/api/telegram/check-setup/${id}`)
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
      invite_link_ttl_minutes: data.invite_link_ttl_minutes ?? 60,
      msg_auto_delete_seconds: data.msg_auto_delete_seconds ?? 120,
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
      const res = await fetch(`${API_BASE}/api/whatsapp/join-group`, {
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
      invite_link_ttl_minutes: parseInt(form.invite_link_ttl_minutes) || 60,
      msg_auto_delete_seconds: parseInt(form.msg_auto_delete_seconds) || 0,
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
    <>
      <div className="max-w-2xl">
        <div className="mb-10">
          <div className="flex items-start justify-between gap-7">
            <div>
              <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                {isEditing ? 'Edit Community' : 'Create Community'}
              </h1>
              <p className="text-[14px] text-black dark:text-white/50 mt-1.5">Set up your paid community in a few steps</p>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={runSetupCheck}
                className="flex-shrink-0 inline-flex items-center gap-1.5 border border-white/[0.1] text-black dark:text-white/50 px-4 py-2 rounded-lg text-[14px] font-semibold hover:border-white/20 hover:text-black dark:text-white/70 transition-colors"
              >
                📋 Test Setup
              </button>
            )}
          </div>
        </div>

        {/* ─── Wizard Progress Header ─── */}
        <div className="mb-10 relative">
          <div className="absolute top-7 left-0 right-0 h-0.5 bg-white/[0.05] -z-10 rounded-full" />
          <div className="flex justify-between items-center relative z-10 w-full px-2">
            {[
              { num: 1, label: 'Platform' },
              { num: 2, label: 'Setup' },
              { num: 3, label: 'Plans' },
              { num: 4, label: 'Automations' }
            ].map(step => {
              const isActive = currentStep === step.num
              const isPast = currentStep > step.num
              const isClickable = isEditing || isPast // Can only jump if editing or already completed

              return (
                <div key={step.num} className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => setCurrentStep(step.num)}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold transition-all
                      ${isActive ? 'bg-[#c8f135] text-black shadow-[0_0_15px_rgba(159,255,87,0.3)]'
                        : isPast ? 'bg-[#c8f135]/20 text-[#c8f135] border border-[#c8f135]/30'
                        : 'bg-white dark:bg-[#111] text-black dark:text-white/30 border border-white/[0.1] hover:border-white/20'
                      }
                      ${!isClickable ? 'cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {isPast ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : step.num}
                  </button>
                  <span className={`text-[14px] font-semibold tracking-wide uppercase transition-colors ${isActive ? 'text-black dark:text-white' : isPast ? 'text-[#c8f135]/70' : 'text-black dark:text-white/30'}`}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <form 
          onSubmit={handleSubmit} 
          onKeyDown={(e) => {
            // Prevent Enter from submitting the form on steps 1-3
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
              e.preventDefault()
            }
          }}
          className="space-y-6 overflow-hidden"
        >

          {/* Step 1: Platform Selection */}
          <div className={currentStep === 1 ? 'block animate-in fade-in slide-in-from-right-4 duration-300 space-y-6' : 'hidden'}>
            <div className="bg-white dark:bg-[#111] border border-white/[0.07] rounded-xl p-7 space-y-5">
              <div>
                <h2 className="text-[18px] font-black text-black dark:text-white">Choose your platform</h2>
                <p className="text-[14px] text-black dark:text-white/40 mt-1">Select where your community will be hosted.</p>
              </div>

            {/* ─── n8n-style Platform Picker ─── */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <label className="block text-[14px] font-bold text-black dark:text-white/40 uppercase tracking-widest">Platform *</label>
                {isEditing && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400/80 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
                    <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                    Platform locked
                  </span>
                )}
              </div>
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-7 ${isEditing ? 'pointer-events-none opacity-70' : ''}`}>

                {/* Telegram Card */}
                <button
                  type="button"
                  onClick={() => !isEditing && setPlatform('telegram')}
                  className={`group relative overflow-hidden text-left rounded-2xl border-2 p-7 transition-all duration-300 ${
                    form.platform === 'telegram'
                      ? 'border-[#229ED9] bg-[#229ED9]/[0.07] shadow-[0_0_30px_rgba(34,158,217,0.12)]'
                      : 'border-gray-200 dark:border-white/10 bg-white/[0.02] opacity-60 hover:opacity-80 hover:border-white/[0.12]'
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
                        <p className="text-[14px] font-bold text-black dark:text-white">Telegram</p>
                        {form.platform === 'telegram' && (
                          <span className="text-[10px] font-bold text-[#229ED9] uppercase tracking-widest">Selected</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[14px] text-black dark:text-white/40 leading-relaxed">Bot auto-adds &amp; removes members. Fully automated, no phone number needed.</p>
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
                  onClick={() => !isEditing && setPlatform('whatsapp')}
                  className={`group relative overflow-hidden text-left rounded-2xl border-2 p-7 transition-all duration-300 ${
                    form.platform === 'whatsapp'
                      ? 'border-[#25D366] bg-[#25D366]/[0.07] shadow-[0_0_30px_rgba(37,211,102,0.10)]'
                      : 'border-gray-200 dark:border-white/10 bg-white/[0.02] opacity-60 hover:opacity-80 hover:border-white/[0.12]'
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
                        <p className="text-[14px] font-bold text-black dark:text-white">WhatsApp</p>
                        {form.platform === 'whatsapp' && (
                          <span className="text-[10px] font-bold text-[#25D366] uppercase tracking-widest">Selected</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[14px] text-black dark:text-white/40 leading-relaxed">Via dedicated WhatsApp number. Managed via whatsapp-web.js on your server.</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {['Requires number','Invite-based','Manual setup'].map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[#25D366]/10 text-[#25D366]/80 border border-[#25D366]/15 font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

          {/* Step 2: Configuration */}
          <div className={currentStep === 2 ? 'block animate-in fade-in slide-in-from-right-4 duration-300 space-y-6' : 'hidden'}>
            
            {/* Community Details */}
            <div className="bg-white dark:bg-[#111] border border-white/[0.07] rounded-xl p-7 space-y-5">
              <h2 className="text-[15px] font-bold text-black dark:text-white mb-2">Community Profile</h2>

              <div>
                <label className="block text-[14px] font-bold text-black dark:text-white/45 mb-2 uppercase tracking-widest">Community Name *</label>
                <input
                  type="text" name="name" required={currentStep === 2} value={form.name} onChange={handleFormChange}
                  className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-black dark:text-white placeholder-white/20 focus:outline-none focus:border-[#c8f135]/40 focus:ring-1 focus:ring-[#c8f135]/15 transition-colors"
                  placeholder="e.g. Crypto Inner Circle"
                />
                {form.name && !isEditing && (
                  <p className="text-[14px] text-black dark:text-white/30 mt-2 font-mono">
                    {window.location.origin}/join/{slug}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[14px] font-bold text-black dark:text-white/45 mb-2 uppercase tracking-widest">Description</label>
                <textarea
                  name="description" value={form.description} onChange={handleFormChange} rows={3}
                  className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-black dark:text-white placeholder-white/20 focus:outline-none focus:border-[#c8f135]/40 focus:ring-1 focus:ring-[#c8f135]/15 transition-colors resize-none"
                  placeholder="What will members get access to?"
                />
              </div>
            </div>

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
                  <p className="text-[14px] font-black text-black dark:text-white">Telegram Group Setup</p>
                  <p className="text-[14px] text-[#229ED9]/70">Connect your group in 2 steps</p>
                </div>
              </div>

              <div className="px-7 py-6 space-y-6">

                {/* Step 1 */}
                <div className="flex gap-7">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#229ED9]/20 border border-[#229ED9]/30 flex items-center justify-center text-[#229ED9] text-[14px] font-black">1</div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-black dark:text-white mb-1">Add Membba Bot to your group as Admin</p>
                    <p className="text-[14px] text-black dark:text-white/40 mb-3">Scan the QR or click the button to open Telegram and select your group. The bot will automatically send your Chat ID.</p>
                    <button
                      type="button"
                      onClick={openConnectQr}
                      className="inline-flex items-center gap-2 bg-[#229ED9] text-black dark:text-white text-[14px] font-bold px-5 py-2.5 rounded-xl hover:bg-[#1a8fc4] transition-colors"
                    >
                      <img src={telegramLogo} alt="" className="w-4 h-4 invert brightness-0" />
                      Connect via Bot
                    </button>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-7">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#229ED9]/20 border border-[#229ED9]/30 flex items-center justify-center text-[#229ED9] text-[14px] font-black">2</div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-black dark:text-white mb-1 flex items-center gap-1.5">
                      Paste your Group Chat ID
                      <Tooltip content="This is the numeric ID of your Telegram group. Membba Bot uses it to create invite links and remove expired members." />
                    </p>
                    <p className="text-[14px] text-black dark:text-white/40 mb-3">The bot will post the ID to your group. Copy it here. It will self-destruct in 5 minutes.</p>
                    <input
                      type="text"
                      name="telegram_chat_id"
                      value={form.telegram_chat_id || ''}
                      onChange={handleFormChange}
                      className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-[#229ED9]/20 rounded-xl px-4 py-3 text-[14px] text-black dark:text-white placeholder-white/20 focus:outline-none focus:border-[#229ED9]/50 focus:ring-1 focus:ring-[#229ED9]/15 transition-colors font-mono"
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
                  <p className="text-[14px] font-black text-black dark:text-white">WhatsApp Group Setup</p>
                  <p className="text-[14px] text-[#25D366]/70">Requires a dedicated WhatsApp number</p>
                </div>
              </div>

              <div className="px-7 py-6 space-y-6">

                {/* Requirements notice */}
                <div className="flex gap-3 bg-yellow-400/5 border border-yellow-400/15 rounded-xl p-7">
                  <span className="text-yellow-400 text-[16px] flex-shrink-0">⚠</span>
                  <div className="text-[14px] text-black dark:text-white/50 space-y-1 leading-relaxed">
                    <p className="text-yellow-400 font-bold text-[14px] mb-1.5">Requirements</p>
                    <p>Use a <span className="text-black dark:text-white/80">dedicated WhatsApp number</span> — never your personal number.</p>
                    <p>Authenticate the number at <span className="text-black dark:text-white/60 font-mono text-[14px]">/api/whatsapp/qr</span> before continuing.</p>
                  </div>
                </div>

                {/* Group invite link */}
                <div>
                  <label className="text-[14px] font-bold text-black dark:text-white/40 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                    Group Invite Link *
                    <Tooltip content="Membba uses this link to join/register your WhatsApp group and later deliver invites to paying members." />
                  </label>
                  <input
                    type="url"
                    name="whatsapp_group_invite_link"
                    value={form.whatsapp_group_invite_link}
                    onChange={handleFormChange}
                    className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-[#25D366]/20 rounded-xl px-4 py-3 text-[14px] text-black dark:text-white placeholder-white/20 focus:outline-none focus:border-[#25D366]/50 focus:ring-1 focus:ring-[#25D366]/15 transition-colors"
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
                      className="inline-flex items-center gap-2 bg-[#25D366] text-black dark:text-white text-[14px] font-bold px-5 py-2.5 rounded-xl hover:bg-[#1da851] disabled:opacity-50 transition-colors"
                    >
                      <img src={whatsappLogo} alt="" className="w-4 h-4 invert brightness-0" />
                      {registeringGroup ? 'Joining group...' : 'Register Group'}
                    </button>
                    {waGroupId && <span className="text-[14px] text-[#c8f135] font-semibold">✅ Registered ({waGroupId})</span>}
                    {!waGroupId && <span className="text-[14px] text-yellow-400/70">⚠ Not yet registered</span>}
                  </div>
                ) : (
                  <p className="text-[14px] text-black dark:text-white/30">Save the community first, then return here to register the group.</p>
                )}

              </div>
            </div>
          )}

        </div>

          {/* Step 3: Subscription Plans */}
          <div className={currentStep === 3 ? 'block animate-in fade-in slide-in-from-right-4 duration-300 space-y-6' : 'hidden'}>

            {/* Existing Plans (edit mode) */}
          {isEditing && existingPlans.length > 0 && (
            <div className="bg-white dark:bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_120px_130px_80px] gap-0 border-b border-white/[0.07] px-6 py-3 bg-white/[0.02]">
                <span className="text-[14px] font-bold text-black dark:text-white/30 uppercase tracking-widest">Plan Name</span>
                <span className="text-[14px] font-bold text-black dark:text-white/30 uppercase tracking-widest">Price</span>
                <span className="text-[14px] font-bold text-black dark:text-white/30 uppercase tracking-widest">Duration</span>
                <span></span>
              </div>
              {existingPlans.map((p, idx) => (
                <div
                  key={p.id}
                  className={`grid grid-cols-[1fr_120px_130px_80px] items-center gap-0 px-6 py-4 group transition-colors hover:bg-white/[0.025] ${
                    idx < existingPlans.length - 1 ? 'border-b border-gray-200 dark:border-white/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c8f135]/60 flex-shrink-0" />
                    <span className="font-semibold text-[14px] text-black dark:text-white">{p.name}</span>
                  </div>
                  <span className="text-[14px] text-black dark:text-white/70 font-mono">₦{p.price.toLocaleString()}</span>
                  <span className="text-[14px] text-black dark:text-white/50">{formatDuration(p.duration_minutes)}</span>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingPlan(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-[14px] text-red-400/70 hover:text-red-400 transition-all font-medium px-2 py-1 rounded-lg hover:bg-red-400/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Plan Builder */}
          <div className="bg-white dark:bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-4">
              <div>
                <h2 className="text-[15px] font-bold text-black dark:text-white">{isEditing ? 'Add New Plans' : 'Subscription Plans'}</h2>
                <p className="text-[14px] text-black dark:text-white/35 mt-0.5">Each plan gives members timed access to your community.</p>
              </div>
            </div>

            {/* Plan Cards */}
            <div className="divide-y divide-white/[0.05]">
              {plans.map((plan, i) => {
                const parsedMins = parseDurationToMinutes(plan.duration)
                const durationPresets = [
                  { value: '7 days',   label: '7 days' },
                  { value: '14 days',  label: '14 days' },
                  { value: '30 days',  label: '1 month' },
                  { value: '90 days',  label: '3 months' },
                  { value: '180 days', label: '6 months' },
                  { value: '365 days', label: '1 year' },
                  { value: 'custom',   label: '✏️ Custom…' },
                ]
                const isCustomDuration = plan.duration && !durationPresets.slice(0,-1).some(p => p.value === plan.duration)
                const durationSelectValue = isCustomDuration ? 'custom' : (plan.duration || '')

                return (
                  <div key={i} className="px-7 py-6 group relative hover:bg-white/[0.015] transition-colors">
                    {/* Top row: name + trash */}
                    <div className="flex items-start justify-between gap-7 mb-5">
                      <div className="flex-1">
                        <input
                          type="text"
                          name="name"
                          value={plan.name}
                          onChange={e => handlePlanChange(i, e)}
                          placeholder="Plan name e.g. Monthly Access"
                          className="w-full bg-transparent text-[17px] font-bold text-black dark:text-white placeholder-white/20 outline-none border-0 focus:outline-none"
                        />
                        <div className="h-px bg-white/[0.07] mt-2 group-focus-within:bg-[#c8f135]/30 transition-colors" />
                      </div>
                      {plans.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePlanRow(i)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1.5 rounded-lg hover:bg-red-400/10 text-red-400/50 hover:text-red-400"
                          title="Remove plan"
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Price + Duration grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 mb-4">
                      {/* Price */}
                      <div className="flex items-center gap-0 bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden focus-within:border-white/20 transition-colors">
                        <span className="px-4 py-3.5 text-[15px] font-bold text-black dark:text-white/40 border-r border-gray-200 dark:border-white/10 flex-shrink-0 select-none">₦</span>
                        <input
                          type="number"
                          name="price"
                          min="100"
                          value={plan.price}
                          onChange={e => handlePlanChange(i, e)}
                          placeholder="5,000"
                          className="flex-1 bg-transparent px-3.5 py-3.5 text-[15px] font-semibold text-black dark:text-white placeholder-white/20 outline-none [appearance:textfield]"
                        />
                      </div>

                      {/* Duration */}
                      <div className="space-y-2">
                        <Select
                          value={durationSelectValue}
                          onChange={(val) => {
                            if (val === 'custom') {
                              handlePlanChange(i, { target: { name: 'duration', value: '' } })
                            } else {
                              handlePlanChange(i, { target: { name: 'duration', value: val } })
                            }
                          }}
                          placeholder="Select duration…"
                          options={durationPresets}
                        />
                        {/* Custom duration input appears when 'custom' is selected */}
                        {isCustomDuration || durationSelectValue === 'custom' ? (
                          <input
                            type="text"
                            name="duration"
                            value={plan.duration}
                            onChange={e => handlePlanChange(i, e)}
                            placeholder="e.g. 2 minutes, 45 days"
                            autoFocus
                            className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-black dark:text-white placeholder-white/20 outline-none focus:border-[#c8f135]/40 transition-colors font-mono"
                          />
                        ) : null}
                        {plan.duration && parsedMins && (
                          <p className="text-[14px] text-[#c8f135]/80 flex items-center gap-1.5">
                            <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                            {formatDuration(parsedMins)}
                          </p>
                        )}
                        {plan.duration && !parsedMins && (
                          <p className="text-[14px] text-red-400/80 flex items-center gap-1.5">
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            Invalid format
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mt-5">
                      <label className="block text-[14px] font-semibold text-black dark:text-white/40 uppercase tracking-widest mb-2">
                        Description <span className="text-black dark:text-white/20">(optional)</span>
                      </label>
                      <div className="relative">
                        <textarea
                          name="description"
                          value={plan.description}
                          onChange={e => handlePlanChange(i, e)}
                          placeholder="Describe what members get access to with this plan…"
                          maxLength={200}
                          rows={3}
                          className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-black dark:text-white placeholder-white/30 outline-none focus:border-[#c8f135]/40 focus:ring-1 focus:ring-[#c8f135]/15 transition-colors resize-none"
                        />
                        <div className="flex items-center justify-between mt-1.5 px-1">
                          <p className="text-[14px] text-black dark:text-white/30">Helps members understand what they're subscribing to</p>
                          <span className="text-[14px] text-black dark:text-white/25 font-mono">{plan.description.length}/200</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add a plan row */}
            <button
              type="button"
              onClick={addPlanRow}
              className="w-full flex items-center gap-3 px-7 py-5 border-t border-dashed border-gray-200 dark:border-white/10 text-black dark:text-white/30 hover:text-black dark:text-white/60 hover:bg-white/[0.025] transition-all group"
            >
              <span className="w-5 h-5 rounded-md border border-current flex items-center justify-center text-[14px] leading-none group-hover:border-[#c8f135]/50 group-hover:text-[#c8f135]/70 transition-colors">+</span>
              <span className="text-[14px] font-medium">Add a plan</span>
            </button>
          </div>

          </div>{/* end Step 3 */}

          {/* Step 4: Automations */}
          <div className={currentStep === 4 ? 'block animate-in fade-in slide-in-from-right-4 duration-300 space-y-6' : 'hidden overflow-visible'}>
            <div className="bg-white dark:bg-[#111] border border-white/[0.07] rounded-xl p-7 overflow-visible">
              <div className="flex items-start justify-between mb-5 gap-7">
                <div className="flex-1">
                  <h2 className="text-[15px] font-bold text-black dark:text-white mb-1">Welcome Message</h2>
                  <p className="text-[14px] text-black dark:text-white/40">Send an automated DM to new subscribers when they pay.</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer flex-shrink-0">
                  <span className="text-[14px] font-bold text-black dark:text-white/50">{form.welcome_message_enabled ? 'ON' : 'OFF'}</span>
                  <input type="checkbox" name="welcome_message_enabled" checked={form.welcome_message_enabled} onChange={e => handleFormChange({target: {name: 'welcome_message_enabled', value: e.target.checked}})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-white/[0.05] border border-white/[0.1] rounded-full peer peer-checked:bg-[#c8f135]/20 peer-checked:border-[#c8f135]/50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/40 peer-checked:after:bg-[#c8f135] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-[20px] relative"></div>
                </label>
              </div>

              <div className={form.welcome_message_enabled ? 'mt-6 pt-6 border-t border-white/[0.05]' : 'hidden'}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                  <div>
                    <label className="block text-[14px] font-bold text-black dark:text-white/45 mb-2 uppercase tracking-widest">Message Template</label>
                    <textarea 
                      rows={6} 
                      name="welcome_message" 
                      value={form.welcome_message} 
                      onChange={handleFormChange} 
                      placeholder="Welcome {name}..." 
                      className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-black dark:text-white focus:border-[#c8f135]/40 outline-none resize-none leading-relaxed" 
                    />
                    <p className="text-[14px] text-black dark:text-white/30 mt-3 leading-relaxed">
                      Variables: <code className="bg-white/5 border border-white/[0.05] px-1.5 py-0.5 rounded text-[#c8f135]">{"{name}"}</code> <code className="bg-white/5 border border-white/[0.05] px-1.5 py-0.5 rounded text-[#c8f135]">{"{community}"}</code> <br className="hidden lg:block"/> <code className="bg-white/5 border border-white/[0.05] px-1.5 py-0.5 rounded text-[#c8f135] mt-1 lg:mt-0 inline-block">{"{plan}"}</code> <code className="bg-white/5 border border-white/[0.05] px-1.5 py-0.5 rounded text-[#c8f135]">{"{expires_on}"}</code>
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#0a0a0a] border border-white/[0.05] rounded-xl p-7 shadow-inner">
                    <p className="text-[14px] font-bold text-black dark:text-white/20 mb-3 uppercase tracking-widest">Live Preview</p>
                    <p className="text-[14px] text-black dark:text-white/70 whitespace-pre-wrap leading-relaxed">
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

          {/* Invite Link & Message Automation Settings */}
          <div className="bg-white dark:bg-[#111] border border-white/[0.07] rounded-xl p-7 space-y-6 overflow-visible">
            <div>
              <h2 className="text-[15px] font-bold text-black dark:text-white">Invite Link Settings</h2>
              <p className="text-[14px] text-black dark:text-white/35 mt-1">Control how the bot delivers invite links to paying members.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
              {/* Invite link expiry */}
              <div>
                <label className="text-[14px] font-bold text-black dark:text-white/45 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                  Invite Link Expires After
                  <Tooltip content="Controls how long a generated invite link remains valid. Shorter links reduce sharing abuse." />
                </label>
                <Select
                  value={form.invite_link_ttl_minutes}
                  onChange={val => handleFormChange({ target: { name: 'invite_link_ttl_minutes', value: val } })}
                  options={[
                    { value: 0,    label: 'Never — link lasts forever' },
                    { value: 15,   label: '15 minutes' },
                    { value: 30,   label: '30 minutes' },
                    { value: 60,   label: '1 hour (recommended)' },
                    { value: 360,  label: '6 hours' },
                    { value: 1440, label: '24 hours' },
                    { value: 4320, label: '3 days' },
                  ]}
                />
                <p className="text-[14px] text-black dark:text-white/25 mt-2 leading-relaxed">
                  After this time, the invite link becomes invalid even if unused.
                </p>
              </div>

              {/* Auto-delete DM */}
              <div>
                <label className="text-[14px] font-bold text-black dark:text-white/45 mb-2 uppercase tracking-widest flex items-center gap-1.5">
                  Delete Bot Messages After
                  <Tooltip content="Optional privacy cleanup. Membba can delete invite messages after a delay so links do not stay visible forever." />
                </label>
                <Select
                  value={form.msg_auto_delete_seconds}
                  onChange={val => handleFormChange({ target: { name: 'msg_auto_delete_seconds', value: val } })}
                  options={[
                    { value: 0,    label: 'Never — keep messages' },
                    { value: 60,   label: '1 minute' },
                    { value: 120,  label: '2 minutes (recommended)' },
                    { value: 300,  label: '5 minutes' },
                    { value: 600,  label: '10 minutes' },
                    { value: 1800, label: '30 minutes' },
                    { value: 3600, label: '1 hour' },
                  ]}
                />
                <p className="text-[14px] text-black dark:text-white/25 mt-2 leading-relaxed">
                  The bot will delete its invite DMs after this delay. Keeps things tidy.
                </p>
              </div>
            </div>
          </div>

          </div>{/* end Step 4 */}

          {/* ─── Wizard Bottom Action Bar ─── */}
          <div className="flex items-center justify-between pt-8 pb-4 mt-8 border-t border-white/[0.05]">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 1}
              className={`px-5 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-black dark:text-white/40 hover:text-black dark:text-white/80 hover:bg-white/[0.05]'}`}
            >
              ← Back
            </button>
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/communities')}
                className="px-4 border border-white/[0.1] sm:px-5 py-2.5 rounded-xl text-[14px] font-semibold text-black dark:text-white/40 hover:text-black dark:text-white/80 hover:border-white/20 transition-colors"
               >
                 Cancel
               </button>
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-white/[0.12] text-black dark:text-white px-6 sm:px-8 py-2.5 rounded-xl text-[14px] font-semibold hover:bg-white/20 transition-all"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#c8f135] text-black px-6 sm:px-8 py-2.5 rounded-xl text-[14px] font-bold hover:bg-[#d6ff4f] disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(159,255,87,0.25)]"
                >
                  {loading ? 'Saving...' : isEditing ? 'Save Changes ✓' : 'Create Community ✓'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </>

      {/* TSK-105/TSK-106: Test Setup Modal with sequential fading */}
      {setupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-[#111] border border-white/[0.1] rounded-2xl p-7 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setSetupModal(null)}
              className="absolute top-7 right-4 text-black dark:text-white/40 hover:text-black dark:text-white transition-colors"
              disabled={setupModal.loading && (setupModal.checks || []).length < 2}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h3 className="text-[16px] font-black text-black dark:text-white mb-5">📋 Running Diagnostics...</h3>
            
            <div className="space-y-4 mb-6 min-h-[120px]">
              {/* Render verified checks sequentially */}
              {(setupModal.checks || []).map((c, i) => (
                <div key={c.id} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <span className="flex-shrink-0 mt-0.5 text-[16px]">{c.pass ? '✅' : '❌'}</span>
                  <div>
                    <p className={`text-[14px] font-semibold ${c.pass ? 'text-black dark:text-white/70' : 'text-black dark:text-white'}`}>{c.label}</p>
                    {!c.pass && <p className="text-[14px] text-black dark:text-white/35 mt-0.5 leading-relaxed">{c.hint}</p>}
                  </div>
                </div>
              ))}

              {/* Show simple spinner for pending check */}
              {setupModal.loading && (
                <div className="flex items-center gap-3 opacity-50 animate-pulse">
                   <svg className="animate-spin text-[#c8f135] flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <p className="text-[14px] font-semibold text-black dark:text-white/50">Processing...</p>
                </div>
              )}
            </div>

            {!setupModal.loading && (
              <div className={`rounded-xl px-4 py-3 text-[14px] font-semibold text-center animate-in fade-in zoom-in-95 duration-500 ${setupModal.allPass ? 'bg-[#c8f135]/10 text-[#c8f135] border border-[#c8f135]/20' : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'}`}>
                {setupModal.allPass ? '🚀 All systems go — your community is live!' : '⚠️ Fix the issues above before marketing.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TSK-106: Connect via Telegram Bot Modal */}
      {connectQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-[#111] border border-white/[0.1] rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl relative">
            <button
              onClick={() => setConnectQr(null)}
              className="absolute top-7 right-4 text-black dark:text-white/40 hover:text-black dark:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            
            <div className="mx-auto w-12 h-12 bg-[#229ED9]/10 rounded-full flex items-center justify-center mb-4 text-[#229ED9]">
              <FaTelegram size={24} />
            </div>
            <h3 className="text-[17px] font-black text-black dark:text-white mb-2">Connect Telegram Group</h3>
            <p className="text-[14px] text-black dark:text-white/40 mb-6 leading-relaxed px-2">
              Scan this QR to add Membba Bot as an admin to your Telegram Group. It will reply with your Chat ID.
            </p>
            
            <div className="bg-white p-3 rounded-2xl inline-block mb-6 shadow-lg">
              <img src={connectQr.dataUrl} alt="Connect Telegram Bot" className="w-48 h-48" />
            </div>

            <p className="text-[14px] font-bold text-black dark:text-white/30 uppercase tracking-widest mb-3" >OR CLICK DIRECTLY</p>
            
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
