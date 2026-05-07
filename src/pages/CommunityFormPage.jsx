import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'

const generateSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const emptyForm = {
  name: '',
  description: '',
  price: '',
  billing_cycle: 'monthly',
  telegram_group_id: '',
  telegram_invite_link: '',
}

export default function CommunityFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams() // if editing
  const isEditing = Boolean(id)

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isEditing) fetchCommunity()
  }, [id])

  const fetchCommunity = async () => {
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .single()

    if (error) toast.error(error.message)
    else setForm(data)
  }

  const handleChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)

    const payload = {
      ...form,
      price: parseFloat(form.price),
      slug: isEditing ? form.slug : generateSlug(form.name),
      creator_id: user.id,
      is_active: true,
    }

    let error

    if (isEditing) {
      const res = await supabase.from('communities').update(payload).eq('id', id)
      error = res.error
    } else {
      const res = await supabase.from('communities').insert(payload)
      error = res.error
    }

    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(isEditing ? 'Community updated' : 'Community created!')
      navigate('/dashboard/communities')
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold mb-6">
          {isEditing ? 'Edit Community' : 'Create Community'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded p-6">
          <div>
            <label className="block text-sm font-medium mb-1">Community Name *</label>
            <input
              type="text"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="e.g. Crypto Inner Circle"
            />
            {form.name && !isEditing && (
              <p className="text-xs text-gray-400 mt-1">
                Slug: <span className="font-mono">{generateSlug(form.name)}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="What will members get access to?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Price (₦) *</label>
              <input
                type="number"
                name="price"
                required
                min="100"
                value={form.price}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Billing Cycle *</label>
              <select
                name="billing_cycle"
                value={form.billing_cycle}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Telegram Group ID</label>
            <input
              type="text"
              name="telegram_group_id"
              value={form.telegram_group_id}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="-1001234567890"
            />
            <p className="text-xs text-gray-400 mt-1">
              Add @MembbaBot to your group and make it admin to get the group ID.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Telegram Invite Link (optional)</label>
            <input
              type="text"
              name="telegram_invite_link"
              value={form.telegram_invite_link}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="https://t.me/+xxxxx"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white px-6 py-2 rounded font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Community'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/communities')}
              className="border border-gray-300 px-6 py-2 rounded font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
