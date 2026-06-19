import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import API_BASE from '../lib/api'
import toast from 'react-hot-toast'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'

const formatDuration = (minutes) => {
  if (!minutes) return ''
  if (minutes < 60)    return `${minutes} min`
  if (minutes < 1440)  return `${Math.round(minutes / 60)} hr`
  if (minutes < 10080) return `${Math.round(minutes / 1440)}d`
  if (minutes < 43200) return `${Math.round(minutes / 10080)}w`
  return `${Math.round(minutes / 43200)} mo`
}

/* ─── Small, reusable sub-components ──────────────────── */

function Spinner() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-[#9FFF57] animate-spin" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-[14px] font-bold tracking-[0.15em] text-white/25 uppercase mb-4">404 — Not Found</p>
        <h1 className="text-2xl font-black text-white mb-3">This community doesn't exist</h1>
        <p className="text-[14px] text-white/40 leading-relaxed">
          The link may be invalid or this community is no longer accepting members.
        </p>
      </div>
    </div>
  )
}

/* ─── Main page ─────────────────────────────────────────── */

export default function JoinPage() {
  const { slug } = useParams()
  const [community, setCommunity]   = useState(null)
  const [plans, setPlans]           = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [paying, setPaying]         = useState(false)
  const [form, setForm]             = useState({ email: '', telegram_user_id: '', whatsapp_phone: '' })
  
  // TSK-106: Telegram Auto-Fill State
  const [uidToken, setUidToken]     = useState(null)
  const [uidPolling, setUidPolling] = useState(false)
  const [uidStatus, setUidStatus]   = useState('idle') // 'idle' | 'polling' | 'success'

  const handleConnectTelegram = async () => {
    try {
      setUidStatus('polling')
      setUidPolling(true)
      const res = await fetch(`${API_BASE}/api/telegram/uid-token`, { method: 'POST' })
      const data = await res.json()
      if (!data.token) throw new Error('No token')

      // Open telegram
      window.open(data.deepLink, '_blank')
      
      // Poll
      let attempts = 0
      const maxAttempts = 60 // 2 minutes (every 2s)
      const intervalId = setInterval(async () => {
        attempts++
        if (attempts >= maxAttempts) {
          clearInterval(intervalId)
          setUidPolling(false)
          setUidStatus('idle')
          toast.error('Connection timed out. Please try again.')
          return
        }

        try {
          const checkRes = await fetch(`${API_BASE}/api/telegram/uid-from-token?token=${data.token}`)
          const checkData = await checkRes.json()
          if (checkData.uid) {
            clearInterval(intervalId)
            setForm(f => ({ ...f, telegram_user_id: String(checkData.uid) }))
            setUidPolling(false)
            setUidStatus('success')
            toast.success('Telegram Connected!')
          }
        } catch (e) {
          // ignore network errors during poll
        }
      }, 2000)

      setUidToken(data.token) // save in case we need it
    } catch {
      toast.error('Could not initialize Telegram connection')
      setUidStatus('idle')
      setUidPolling(false)
    }
  }

  useEffect(() => { fetchCommunity() }, [slug])

  const fetchCommunity = async () => {
    const { data: comm, error } = await supabase
      .from('communities')
      .select('id, name, description, slug, platform')
      .eq('slug', slug).eq('is_active', true).single()
    if (error || !comm) { setCommunity(null); setLoading(false); return }
    setCommunity(comm)
    const { data: planData } = await supabase
      .from('plans').select('id, name, price, duration_minutes, description')
      .eq('community_id', comm.id).eq('is_active', true).order('price', { ascending: true })
    setPlans(planData || [])
    if (planData?.length === 1) setSelectedPlan(planData[0])
    setLoading(false)
  }

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const isWhatsApp = community?.platform === 'whatsapp'

  const validate = () => {
    if (!selectedPlan) { toast.error('Please select a plan'); return false }
    if (isWhatsApp) {
      const p = form.whatsapp_phone.trim()
      if (!p) { toast.error('WhatsApp phone number is required'); return false }
      if (!/^\d{10,15}$/.test(p)) { toast.error('Include country code, no + or spaces. e.g. 2348012345678'); return false }
    } else {
      if (!form.telegram_user_id.trim()) { toast.error('Telegram User ID is required'); return false }
      if (!/^\d+$/.test(form.telegram_user_id.trim())) { toast.error('Telegram User ID must be a number (not a @username)'); return false }
    }
    return true
  }

  const handlePay = async e => {
    e.preventDefault()
    if (!validate()) return
    setPaying(true)
    try {
      const body = { plan_id: selectedPlan.id, email: form.email }
      if (isWhatsApp) body.whatsapp_phone = form.whatsapp_phone.trim()
      else body.telegram_user_id = form.telegram_user_id.trim()
      const res  = await fetch(`${API_BASE}/api/payments/initialize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.authorization_url) { window.location.href = data.authorization_url }
      else { toast.error(data.message || 'Payment failed to initialize'); setPaying(false) }
    } catch { toast.error('Could not connect to the payment server'); setPaying(false) }
  }

  if (loading)     return <Spinner />
  if (!community)  return <NotFound />

  const isWA       = isWhatsApp
  const plColor    = isWA ? '#25D366' : '#229ED9'
  const plBg       = isWA ? 'bg-[#25D366]/8 border-[#25D366]/20' : 'bg-[#229ED9]/8 border-[#229ED9]/20'
  const plText     = isWA ? 'text-[#25D366]' : 'text-[#229ED9]'
  const PlatIcon   = isWA ? FaWhatsapp : FaTelegram
  const platLabel  = isWA ? 'WhatsApp' : 'Telegram'

  const inputCls = [
    'w-full bg-[#0d0d0d] border rounded-xl px-4 py-3 text-[14px] text-white',
    'placeholder-white/20 focus:outline-none transition-all duration-200',
    'border-white/[0.08] focus:border-[#9FFF57]/40 focus:ring-2 focus:ring-[#9FFF57]/10',
  ].join(' ')

  const labelCls = 'block text-[14px] font-bold tracking-widest uppercase text-white/40 mb-2'

  return (
    <div className="min-h-screen bg-[#0a0a0a]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Top bar */}
      <div className="border-b border-white/[0.05] px-6 py-4 flex items-center justify-between max-w-xl mx-auto">
        <span className="text-[14px] font-black tracking-wider text-white/30 uppercase">Membba</span>
        <div className="flex items-center gap-1.5 text-white/25">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-[14px] font-semibold">Secured by Paystack</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-10">

        {/* Community identity */}
        <div className="mb-8">
          <div className={`inline-flex items-center gap-1.5 text-[14px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border mb-4 ${plBg} ${plText}`}>
            <PlatIcon size={10} />
            {platLabel} Community
          </div>
          <h1 className="text-[28px] font-black text-white leading-tight mb-2">{community.name}</h1>
          {community.description && (
            <p className="text-[14px] text-white/50 leading-relaxed">{community.description}</p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.05] mb-8" />

        {/* Plans */}
        {plans.length === 0 ? (
          <div className="border border-yellow-400/20 bg-yellow-400/5 rounded-xl px-5 py-4 text-[14px] text-yellow-400 mb-8">
            No active plans available at the moment — check back soon.
          </div>
        ) : (
          <div className="mb-8">
            <p className={labelCls}>Select a subscription plan</p>
            <div className="space-y-2.5">
              {plans.map(plan => {
                const active = selectedPlan?.id === plan.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={[
                      'w-full text-left rounded-xl border px-5 py-4 transition-all duration-200 group',
                      active
                        ? 'border-[#9FFF57]/35 bg-[#9FFF57]/[0.04]'
                        : 'border-white/[0.07] hover:border-white/[0.13] bg-[#111]',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-7">
                      {/* Radio indicator */}
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        active ? 'border-[#9FFF57]' : 'border-white/20 group-hover:border-white/35'
                      }`}>
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-[#9FFF57]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-[14.5px] leading-tight ${active ? 'text-white' : 'text-white/80'}`}>
                          {plan.name}
                        </p>
                        {plan.description && (
                          <p className="text-[14px] text-white/35 mt-0.5 truncate">{plan.description}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-black text-[17px] leading-tight ${active ? 'text-[#9FFF57]' : 'text-white'}`}>
                          ₦{plan.price.toLocaleString()}
                        </p>
                        <p className="text-[14px] text-white/30 font-medium mt-0.5">
                          {formatDuration(plan.duration_minutes)}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Form */}
        {plans.length > 0 && (
          <form onSubmit={handlePay} className="space-y-5">

            <div>
              <label className={labelCls}>Email address</label>
              <input type="email" name="email" required value={form.email}
                onChange={handleChange} className={inputCls}
                placeholder="you@example.com" />
            </div>

            {isWA ? (
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <FaWhatsapp size={10} style={{ color: plColor }} />
                    WhatsApp Phone Number
                  </span>
                </label>
                <input type="tel" name="whatsapp_phone" required value={form.whatsapp_phone}
                  onChange={handleChange} className={inputCls}
                  placeholder="2348012345678" />
                <p className="text-[14px] text-white/30 mt-2">
                  Country code + number, no spaces or + sign
                  <span className="font-mono text-white/45 ml-1">(e.g. 2348012345678)</span>
                </p>
              </div>
            ) : (
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <FaTelegram size={10} style={{ color: plColor }} />
                    Telegram Account
                  </span>
                </label>

                {uidStatus === 'success' ? (
                  <div className="flex items-center justify-between bg-[#229ED9]/[0.08] border border-[#229ED9]/30 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#229ED9]/20 flex items-center justify-center text-[#229ED9]">
                        <FaTelegram size={16} />
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-white">Connected</p>
                        <p className="text-[14px] text-[#229ED9] font-mono">ID: {form.telegram_user_id}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setUidStatus('idle'); setForm(f => ({...f, telegram_user_id: ''})) }} className="text-[14px] text-white/40 hover:text-white transition-colors underline underline-offset-2">
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={handleConnectTelegram}
                      disabled={uidPolling}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 transition-all outline-none font-bold text-[14px] ${
                        uidPolling 
                          ? 'bg-[#229ED9]/10 text-[#229ED9] border border-[#229ED9]/20 cursor-wait' 
                          : 'bg-[#229ED9] text-white hover:bg-[#1a8fc4]'
                      }`}
                    >
                      {uidPolling ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-[#229ED9]/30 border-t-[#229ED9] animate-spin" />
                          Waiting for you in Telegram...
                        </>
                      ) : (
                        <>
                          <FaTelegram size={18} className={uidPolling ? '' : 'invert brightness-0'} />
                          Connect Telegram
                        </>
                      )}
                    </button>
                    {!uidPolling && (
                      <p className="text-[14px] text-white/30 mt-3 text-center leading-relaxed">
                        Click the button to open Telegram and tap Start. We will automatically grab your account ID.
                      </p>
                    )}
                    {uidPolling && (
                      <p className="text-[14px] text-white/30 mt-3 text-center leading-relaxed animate-pulse">
                        Please open Telegram, tap <b>Start</b>, and then return here.
                      </p>
                    )}
                  </div>
                )}
                
                {/* Fallback hidden input so it still submits */}
                <input type="hidden" name="telegram_user_id" value={form.telegram_user_id} />
              </div>
            )}

            {/* Notice */}
            {!isWA && uidStatus === 'idle' && (
              <div className="border border-yellow-400/15 bg-yellow-400/[0.04] rounded-xl px-5 py-4 text-[14px] mt-4">
                <p className="font-bold text-yellow-400 mb-1.5 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  Required Step
                </p>
                <p className="text-white/45 leading-relaxed">
                  You must connect your Telegram above before paying, otherwise the bot cannot invite you to the private group.
                </p>
              </div>
            )}
            {isWA && (
              <div className="border border-[#25D366]/15 bg-[#25D366]/[0.04] rounded-xl px-5 py-4 text-[14px] text-white/45">
                <p className="font-bold text-[#25D366] mb-1">After payment</p>
                <p>You'll receive a WhatsApp message with your group invite link at the number you entered above.</p>
              </div>
            )}

            {/* CTA */}
            <button
              type="submit"
              disabled={paying || !selectedPlan}
              className={[
                'w-full py-4 rounded-xl font-black text-[15px] tracking-wide transition-all duration-200',
                paying || !selectedPlan
                  ? 'bg-white/[0.06] text-white/25 cursor-not-allowed'
                  : 'bg-[#9FFF57] text-[#0a0a0a] hover:bg-[#aaff62] active:scale-[0.99]',
              ].join(' ')}
            >
              {paying
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin inline-block" />
                    Redirecting to Paystack...
                  </span>
                : selectedPlan
                  ? `Pay ₦${selectedPlan.price.toLocaleString()} · ${formatDuration(selectedPlan.duration_minutes)}`
                  : 'Select a plan to continue'}
            </button>

            <p className="text-center text-[14px] text-white/20 leading-relaxed">
              By continuing you agree to Membba's terms. Payments processed securely by Paystack.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
