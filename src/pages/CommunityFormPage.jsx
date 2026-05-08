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
        <h1 className="text-2xl font-bold mb-6">
          {isEditing ? 'Edit Community' : 'Create Community'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Community Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-base">Community Details</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Community Name *</label>
              <input
                type="text" name="name" required value={form.name} onChange={handleFormChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="e.g. Crypto Inner Circle"
              />
              {form.name && !isEditing && (
                <p className="text-xs text-gray-400 mt-1">
                  Join URL: <span className="font-mono">{window.location.origin}/join/{slug}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                name="description" value={form.description} onChange={handleFormChange} rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="What will members get access to?"
              />
            </div>

            {/* Platform Picker */}
            <div>
              <label className="block text-sm font-medium mb-2">Platform *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'telegram', label: 'Telegram', Icon: FaTelegram, sub: 'Bot adds/removes members automatically', color: 'text-blue-400' },
                  { value: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp, sub: 'Via whatsapp-web.js (dedicated number required)', color: 'text-green-400' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlatform(opt.value)}
                    className={`text-left rounded-lg border-2 px-4 py-3 transition-all ${
                      form.platform === opt.value
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <opt.Icon size={16} className={form.platform === opt.value ? 'text-white' : opt.color} />
                      {opt.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${form.platform === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>
                      {opt.sub}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Telegram Config */}
            {form.platform === 'telegram' && (
              <div>
                <label className="block text-sm font-medium mb-1">Telegram Chat ID *</label>
                <input
                  type="text" name="telegram_chat_id" value={form.telegram_chat_id} onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="-1001234567890"
                />
                <div className="mt-2 bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700 space-y-1">
                  <p className="font-semibold">How to get your Telegram Chat ID:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Add <span className="font-mono">@userinfobot</span> to your group → it replies with the numeric ID</li>
                    <li>The ID starts with <span className="font-mono">-100…</span> — paste it above</li>
                    <li>Add <span className="font-mono">@membba_bot</span> as Admin with <em>Add/Remove Members</em> permissions</li>
                  </ol>
                </div>
              </div>
            )}

            {/* WhatsApp Config */}
            {form.platform === 'whatsapp' && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                  <p className="font-semibold mb-1">⚠️ WhatsApp requirements:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Use a <strong>dedicated WhatsApp number</strong> — never your personal number</li>
                    <li>Add that number to your WhatsApp group as <strong>Admin</strong></li>
                    <li>The bot must be authenticated — visit <span className="font-mono">/api/whatsapp/qr</span> to scan the QR code</li>
                    <li>Paste your group invite link below and click <strong>Register Group</strong></li>
                  </ol>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">WhatsApp Group Invite Link *</label>
                  <input
                    type="url" name="whatsapp_group_invite_link"
                    value={form.whatsapp_group_invite_link} onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="https://chat.whatsapp.com/xxxxxxxxxx"
                  />
                </div>

                {isEditing && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRegisterWhatsAppGroup}
                      disabled={registeringGroup}
                      className="text-sm border border-green-300 bg-green-50 text-green-700 px-4 py-2 rounded hover:bg-green-100 disabled:opacity-50 transition-colors"
                    >
                      {registeringGroup ? 'Joining group...' : 'Register Group →'}
                    </button>
                    {waGroupId && (
                      <span className="text-xs text-green-600 font-medium">
                        ✅ Group registered ({waGroupId})
                      </span>
                    )}
                    {!waGroupId && (
                      <span className="text-xs text-amber-600">⚠ Group not yet registered</span>
                    )}
                  </div>
                )}
                {!isEditing && (
                  <p className="text-xs text-gray-400">
                    Save the community first, then come back to register the WhatsApp group.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Existing Plans (edit mode) */}
          {isEditing && existingPlans.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="font-semibold text-base mb-3">Existing Plans</h2>
              <div className="space-y-2">
                {existingPlans.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-400 ml-2">₦{p.price.toLocaleString()} · {formatDuration(p.duration_minutes)}</span>
                    </div>
                    <button type="button" onClick={() => handleDeleteExistingPlan(p.id)} className="text-xs text-red-500 hover:underline">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Builder */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-base">{isEditing ? 'Add New Plans' : 'Subscription Plans'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Duration examples: <span className="font-mono">2 minutes</span>, <span className="font-mono">7 days</span>, <span className="font-mono">30 days</span>, <span className="font-mono">1 month</span>
                </p>
              </div>
              <button type="button" onClick={addPlanRow} className="text-xs border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50">
                + Add Plan
              </button>
            </div>

            {plans.map((plan, i) => (
              <div key={i} className="border border-gray-100 rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Plan {i + 1}</p>
                  {plans.length > 1 && (
                    <button type="button" onClick={() => removePlanRow(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Plan Name *</label>
                    <input type="text" name="name" value={plan.name} onChange={e => handlePlanChange(i, e)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="e.g. Monthly Plan" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Price (₦) *</label>
                    <input type="number" name="price" min="100" value={plan.price} onChange={e => handlePlanChange(i, e)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="2000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Duration *</label>
                    <input type="text" name="duration" value={plan.duration} onChange={e => handlePlanChange(i, e)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="e.g. 30 days" />
                    {plan.duration && (() => {
                      const mins = parseDurationToMinutes(plan.duration)
                      return mins
                        ? <p className="text-xs text-green-600 mt-1">✓ {formatDuration(mins)}</p>
                        : <p className="text-xs text-red-500 mt-1">Invalid format</p>
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                    <input type="text" name="description" value={plan.description} onChange={e => handlePlanChange(i, e)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="What's included" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="bg-black text-white px-6 py-2 rounded font-medium hover:bg-gray-800 disabled:opacity-50">
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Community'}
            </button>
            <button type="button" onClick={() => navigate('/dashboard/communities')}
              className="border border-gray-300 px-6 py-2 rounded font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
