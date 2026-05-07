import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function SettingsPage() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.user_metadata?.name || '')
  const [loading, setLoading] = useState(false)

  const handleUpdateProfile = async e => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ data: { name } })
    setLoading(false)
    if (error) toast.error(error.message)
    else toast.success('Profile updated')
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="max-w-lg space-y-6">
        {/* Profile */}
        <div className="bg-white border border-gray-200 rounded p-6">
          <h2 className="font-semibold mb-4">Profile</h2>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={user?.email}
                disabled
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Paystack */}
        <div className="bg-white border border-gray-200 rounded p-6">
          <h2 className="font-semibold mb-1">Paystack Integration</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your Paystack secret key is managed server-side via environment variables. Contact support to update it.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-400">
            sk_live_••••••••••••••••••••••••
          </div>
        </div>

        {/* Telegram */}
        <div className="bg-white border border-gray-200 rounded p-6">
          <h2 className="font-semibold mb-1">Telegram Bot</h2>
          <p className="text-sm text-gray-500 mb-3">
            Add <span className="font-mono bg-gray-100 px-1 rounded">@MembbaBot</span> to your Telegram group and make it an admin. Then paste your group ID when creating a community.
          </p>
          <a
            href="https://t.me/MembbaBot"
            target="_blank"
            rel="noreferrer"
            className="inline-block border border-gray-300 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50"
          >
            Open @MembbaBot →
          </a>
        </div>
      </div>
    </DashboardLayout>
  )
}
