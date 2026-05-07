import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function JoinPage() {
  const { slug } = useParams()
  const [community, setCommunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', telegram_username: '' })

  useEffect(() => {
    fetchCommunity()
  }, [slug])

  const fetchCommunity = async () => {
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error) setCommunity(null)
    else setCommunity(data)
    setLoading(false)
  }

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handlePay = async e => {
    e.preventDefault()
    setPaying(true)

    try {
      // Call backend to initialize Paystack payment
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          telegram_username: form.telegram_username,
          community_id: community.id,
          amount: community.price,
        }),
      })

      const data = await res.json()

      if (data.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        toast.error(data.message || 'Payment initialization failed')
      }
    } catch (err) {
      toast.error('Could not connect to payment server')
    }

    setPaying(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Community not found</h1>
          <p className="text-gray-500">This link may be invalid or the community is no longer active.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Community card */}
        <div className="bg-white border border-gray-200 rounded p-6 mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Join Community</p>
          <h1 className="text-2xl font-bold mb-2">{community.name}</h1>
          {community.description && (
            <p className="text-gray-600 text-sm mb-4">{community.description}</p>
          )}
          <div className="bg-gray-50 rounded px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">Subscription</span>
            <span className="font-bold text-lg">
              ₦{community.price?.toLocaleString()} / {community.billing_cycle}
            </span>
          </div>
        </div>

        {/* Payment form */}
        <div className="bg-white border border-gray-200 rounded p-6">
          <h2 className="font-semibold mb-4">Your Details</h2>
          <form onSubmit={handlePay} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telegram Username *</label>
              <div className="flex">
                <span className="border border-r-0 border-gray-300 rounded-l px-3 py-2 text-sm bg-gray-50 text-gray-500">@</span>
                <input
                  type="text"
                  name="telegram_username"
                  required
                  value={form.telegram_username}
                  onChange={handleChange}
                  className="flex-1 border border-gray-300 rounded-r px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="yourusername"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">We'll use this to add you to the Telegram group.</p>
            </div>
            <button
              type="submit"
              disabled={paying}
              className="w-full bg-black text-white py-3 rounded font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {paying ? 'Redirecting to payment...' : `Pay ₦${community.price?.toLocaleString()} →`}
            </button>
          </form>
          <p className="text-xs text-center text-gray-400 mt-4">
            Powered by Paystack · Secured by Membba
          </p>
        </div>
      </div>
    </div>
  )
}
