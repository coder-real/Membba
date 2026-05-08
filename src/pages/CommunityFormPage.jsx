import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'

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
  })
  const [plans, setPlans] = useState([{ ...emptyPlan }])
  const [existingPlans, setExistingPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [registeringGroup, setRegisteringGroup] = useState(false)
  const [waGroupId, setWaGroupId] = useState(null)

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
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-white tracking-tight">
            {isEditing ? 'Edit Community' : 'Create Community'}
          </h1>
          <p className="text-[14px] text-white/50 mt-1.5">Set up your paid community in a few steps</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

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

            {/* Platform Picker */}
            <div>
              <label className="block text-[11px] font-bold text-white/45 mb-2.5 uppercase tracking-widest">Platform *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'telegram', label: 'Telegram', Icon: FaTelegram, sub: 'Bot adds/removes members automatically', activeColor: 'border-[#229ED9]/50 bg-[#229ED9]/5', activeIcon: 'text-[#229ED9]' },
                  { value: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp, sub: 'Via whatsapp-web.js (dedicated number required)', activeColor: 'border-[#25D366]/50 bg-[#25D366]/5', activeIcon: 'text-[#25D366]' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlatform(opt.value)}
                    className={`text-left rounded-xl border px-4 py-3.5 transition-all ${
                      form.platform === opt.value
                        ? `${opt.activeColor} text-white`
                        : 'border-white/[0.08] bg-white/[0.02] text-white/40 hover:border-white/15 hover:text-white/60'
                    }`}
                  >
                    <p className="font-semibold text-[13.5px] flex items-center gap-2">
                      <opt.Icon size={15} className={form.platform === opt.value ? opt.activeIcon : 'text-white/30'} />
                      {opt.label}
                    </p>
                    <p className="text-[11.5px] mt-1 text-white/30 leading-relaxed">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Telegram Config */}
            {form.platform === 'telegram' && (
              <div>
                <label className="block text-[11px] font-bold text-white/45 mb-2 uppercase tracking-widest">Telegram Chat ID *</label>
                <input
                  type="text" name="telegram_chat_id" value={form.telegram_chat_id} onChange={handleFormChange}
                  className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#229ED9]/40 focus:ring-1 focus:ring-[#229ED9]/15 transition-colors"
                  placeholder="-1001234567890"
                />
                <div className="mt-3 bg-[#229ED9]/5 border border-[#229ED9]/15 rounded-xl p-4 text-[12px]">
                  <p className="font-bold text-[#229ED9] mb-2">How to get your Telegram Chat ID:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-white/40">
                    <li>Add <span className="font-mono text-white/60">@userinfobot</span> to your group — it replies with the numeric ID</li>
                    <li>The ID starts with <span className="font-mono text-white/60">-100…</span> — paste it above</li>
                    <li>Add <span className="font-mono text-white/60">@membba_bot</span> as Admin with <em>Add/Remove Members</em> permissions</li>
                  </ol>
                </div>
              </div>
            )}

            {/* WhatsApp Config */}
            {form.platform === 'whatsapp' && (
              <div className="space-y-4">
                <div className="bg-yellow-400/5 border border-yellow-400/15 rounded-xl p-4 text-[12px]">
                  <p className="font-bold mb-2 text-yellow-400">⚠ WhatsApp Requirements</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-white/40">
                    <li>Use a <span className="text-white/70">dedicated WhatsApp number</span> — never your personal number</li>
                    <li>Add that number to your WhatsApp group as <span className="text-white/70">Admin</span></li>
                    <li>Bot must be authenticated — visit <span className="font-mono text-white/60">/api/whatsapp/qr</span> to scan QR</li>
                    <li>Paste your group invite link below and click <span className="text-white/70">Register Group</span></li>
                  </ol>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/45 mb-2 uppercase tracking-widest">WhatsApp Group Invite Link *</label>
                  <input
                    type="url" name="whatsapp_group_invite_link"
                    value={form.whatsapp_group_invite_link} onChange={handleFormChange}
                    className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#25D366]/40 focus:ring-1 focus:ring-[#25D366]/15 transition-colors"
                    placeholder="https://chat.whatsapp.com/xxxxxxxxxx"
                  />
                </div>

                {isEditing && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRegisterWhatsAppGroup}
                      disabled={registeringGroup}
                      className="text-[13px] border border-[#25D366]/30 text-[#25D366] px-4 py-2.5 rounded-lg hover:bg-[#25D366]/5 disabled:opacity-50 transition-colors font-semibold"
                    >
                      {registeringGroup ? 'Joining group...' : 'Register Group →'}
                    </button>
                    {waGroupId && (
                      <span className="text-[12.5px] text-[#9FFF57] font-semibold">✅ Group registered ({waGroupId})</span>
                    )}
                    {!waGroupId && (
                      <span className="text-[12.5px] text-yellow-400/70">⚠ Group not yet registered</span>
                    )}
                  </div>
                )}
                {!isEditing && (
                  <p className="text-[12.5px] text-white/30">
                    Save the community first, then come back to register the WhatsApp group.
                  </p>
                )}
              </div>
            )}
          </div>

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
  )
}
