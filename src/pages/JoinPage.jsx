import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'

const formatDuration = (minutes) => {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`
  if (minutes < 10080) return `${Math.round(minutes / 1440)} day${Math.round(minutes / 1440) !== 1 ? 's' : ''}`
  if (minutes < 43200) return `${Math.round(minutes / 10080)} week${Math.round(minutes / 10080) !== 1 ? 's' : ''}`
  return `${Math.round(minutes / 43200)} month${Math.round(minutes / 43200) !== 1 ? 's' : ''}`
}

export default function JoinPage() {
  const { slug } = useParams()
  const [community, setCommunity] = useState(null)
  const [plans, setPlans] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [form, setForm] = useState({ email: '', telegram_user_id: '', whatsapp_phone: '' })

  useEffect(() => { fetchCommunity() }, [slug])

  const fetchCommunity = async () => {
    const { data: comm, error } = await supabase
      .from('communities')
      .select('id, name, description, slug, platform')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !comm) { setCommunity(null); setLoading(false); return }
    setCommunity(comm)

    const { data: planData } = await supabase
      .from('plans')
      .select('id, name, price, duration_minutes, description')
      .eq('community_id', comm.id)
      .eq('is_active', true)
      .order('price', { ascending: true })

    setPlans(planData || [])
    if (planData?.length === 1) setSelectedPlan(planData[0])
    setLoading(false)
  }

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const isWhatsApp = community?.platform === 'whatsapp'

  const validate = () => {
    if (!selectedPlan) { toast.error('Please select a plan'); return false }

    if (isWhatsApp) {
      const phone = form.whatsapp_phone.trim()
      if (!phone) { toast.error('WhatsApp phone number is required'); return false }
      if (!/^\d{10,15}$/.test(phone)) {
        toast.error('Enter number with country code, no + or spaces (e.g. 2348012345678)')
        return false
      }
    } else {
      if (!form.telegram_user_id.trim()) { toast.error('Telegram User ID is required'); return false }
      if (!/^\d+$/.test(form.telegram_user_id.trim())) {
        toast.error('Telegram User ID must be a number (not a username)')
        return false
      }
    }
    return true
  }

  const handlePay = async e => {
    e.preventDefault()
    if (!validate()) return

    setPaying(true)
    try {
      const body = {
        plan_id: selectedPlan.id,
        email: form.email,
      }

      if (isWhatsApp) {
        body.whatsapp_phone = form.whatsapp_phone.trim()
      } else {
        body.telegram_user_id = form.telegram_user_id.trim()
      }

      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        toast.error(data.message || 'Payment initialization failed')
        setPaying(false)
      }
    } catch {
      toast.error('Could not connect to payment server')
      setPaying(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )

  if (!community) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold mb-2">Community not found</h1>
        <p className="text-gray-500 text-sm">This link may be invalid or the community is no longer active.</p>
      </div>
    </div>
  )

  const PlatformIcon = isWhatsApp ? FaWhatsapp : FaTelegram
  const platformColor = isWhatsApp ? 'text-green-500' : 'text-blue-500'
  const platformName = isWhatsApp ? 'WhatsApp' : 'Telegram'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-4">

        {/* Community header */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Join Community</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              isWhatsApp ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <PlatformIcon size={11} /> {platformName}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-1">{community.name}</h1>
          {community.description && (
            <p className="text-gray-500 text-sm">{community.description}</p>
          )}
        </div>

        {/* Plan selection */}
        {plans.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="font-semibold mb-3">Choose a Plan</h2>
            <div className="space-y-2">
              {plans.map(plan => (
                <button
                  key={plan.id} type="button" onClick={() => setSelectedPlan(plan)}
                  className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all ${
                    selectedPlan?.id === plan.id
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{plan.name}</p>
                      {plan.description && (
                        <p className={`text-xs mt-0.5 ${selectedPlan?.id === plan.id ? 'text-gray-300' : 'text-gray-400'}`}>
                          {plan.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="font-bold">₦{plan.price.toLocaleString()}</p>
                      <p className={`text-xs ${selectedPlan?.id === plan.id ? 'text-gray-300' : 'text-gray-400'}`}>
                        {formatDuration(plan.duration_minutes)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            No active plans available yet. Check back soon.
          </div>
        )}

        {/* Payment form */}
        {plans.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="font-semibold mb-4">Your Details</h2>
            <form onSubmit={handlePay} className="space-y-4">

              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email" name="email" required value={form.email} onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="you@example.com"
                />
              </div>

              {/* Platform-specific identity field */}
              {isWhatsApp ? (
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                    <FaWhatsapp className="text-green-500" size={14} /> WhatsApp Number *
                  </label>
                  <input
                    type="tel" name="whatsapp_phone" value={form.whatsapp_phone} onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="e.g. 2348012345678"
                  />
                  <div className="mt-2 bg-green-50 border border-green-100 rounded p-2.5 text-xs text-green-700">
                    <span className="font-semibold">Format:</span> Country code + number, no spaces or +<br />
                    <span className="font-mono">Nigeria: 2348012345678 · UK: 447911123456</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1.5">
                    <FaTelegram className="text-blue-500" size={14} /> Telegram User ID *
                  </label>
                  <input
                    type="text" name="telegram_user_id" value={form.telegram_user_id} onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="e.g. 123456789"
                  />
                  <div className="mt-2 bg-blue-50 border border-blue-100 rounded p-2.5 text-xs text-blue-700">
                    <span className="font-semibold">How to get your ID:</span>{' '}
                    <a href="https://t.me/membba_bot" target="_blank" rel="noreferrer" className="underline font-semibold font-mono">
                      Open @membba_bot
                    </a>{' '}
                    on Telegram and tap <span className="font-mono font-bold">Start</span> — it replies instantly with your numeric ID.
                  </div>
                </div>
              )}

              {/* Pre-payment notice */}
              <div className={`rounded-lg p-3 text-xs space-y-1.5 ${
                isWhatsApp
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
              }`}>
                <p className="font-semibold">
                  {isWhatsApp ? '💬 After payment:' : '⚠️ Before you pay — do this first:'}
                </p>
                {isWhatsApp ? (
                  <p>You'll receive a WhatsApp message with your group invite link at the number above.</p>
                ) : (
                  <>
                    <p>1.{' '}
                      <a href="https://t.me/membba_bot" target="_blank" rel="noreferrer" className="underline font-semibold">
                        Open @membba_bot on Telegram
                      </a>{' '}
                      and tap <span className="font-mono font-bold">Start</span>
                    </p>
                    <p>2. Come back here and complete your payment</p>
                    <p className="text-amber-600">Without this step, the bot cannot DM your invite link.</p>
                  </>
                )}
              </div>

              <button
                type="submit" disabled={paying || !selectedPlan}
                className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {paying ? 'Redirecting to payment...' : selectedPlan ? `Pay ₦${selectedPlan.price.toLocaleString()} →` : 'Select a plan above'}
              </button>
            </form>

            <p className="text-xs text-center text-gray-400 mt-4">
              Secured by Paystack · Powered by Membba
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
