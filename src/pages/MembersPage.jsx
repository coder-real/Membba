import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import Avatar from '../components/Avatar'
import Skeleton from '../components/ui/Skeleton'
import toast from 'react-hot-toast'

const TABS = ['all', 'active', 'expired', 'cancelled']

export default function MembersPage() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [removing, setRemoving] = useState(null)
  const [resending, setResending] = useState(null)

  useEffect(() => { fetchSubs() }, [user])

  const fetchSubs = async () => {
    const { data: communities } = await supabase.from('communities').select('id').eq('creator_id', user.id)
    const ids = communities?.map(c => c.id) || []
    if (!ids.length) { setLoading(false); return }
    const { data } = await supabase
      .from('subscriptions')
      .select('*, communities(name), plans(name)')
      .in('community_id', ids)
      .order('started_at', { ascending: false })
    setSubscriptions(data || [])
    setLoading(false)
  }

  const handleRemove = async (s) => {
    setRemoving(s.id)
    try {
      const endpoint = s.telegram_user_id ? '/api/telegram/remove-member' : '/api/whatsapp/remove-member'
      await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptionId: s.id }) })
      toast.success('Member removed')
      fetchSubs()
    } catch { toast.error('Failed to remove member') }
    setRemoving(null)
  }

  const handleResend = async (s) => {
    setResending(s.id)
    try {
      await fetch('/api/telegram/resend-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptionId: s.id }) })
      toast.success('Invite resent')
    } catch { toast.error('Failed to resend invite') }
    setResending(null)
  }

  const filtered = tab === 'all' ? subscriptions : subscriptions.filter(s => s.status === tab)

  const counts = {
    all:       subscriptions.length,
    active:    subscriptions.filter(s => s.status === 'active').length,
    expired:   subscriptions.filter(s => s.status === 'expired').length,
    cancelled: subscriptions.filter(s => s.status === 'cancelled').length,
  }

  const Pill = ({ status }) => {
    if (status === 'active') return (
      <span className="inline-flex items-center gap-1.5 bg-[#9FFF57]/10 border border-[#9FFF57]/10 px-2 py-0.5 rounded-[4px] text-[14px] font-bold text-[#9FFF57]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#9FFF57]" /> Active
      </span>
    )
    if (status === 'expired') return (
      <span className="inline-flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/10 px-2 py-0.5 rounded-[4px] text-[14px] font-bold text-yellow-400">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Expired
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.05] px-2 py-0.5 rounded-[4px] text-[14px] font-bold text-[#96989d]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#4f545c]" /> Cancelled
      </span>
    )
  }

  return (
    <DashboardLayout pageTitle="Members">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-black text-[#f2f3f5] tracking-tight">Members</h1>
        <p className="text-[14px] text-[#b5bac1] mt-1">All subscribers across your communities</p>
      </div>

      {/* Pill Tab Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-[4px] text-[14px] font-medium transition-all capitalize ${
              tab === t
                ? 'bg-white/[0.08] text-[#f2f3f5]'
                : 'text-[#96989d] hover:text-[#dbdee1] hover:bg-white/[0.03]'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className={`ml-1.5 text-[14px] ${tab === t ? 'text-[#f2f3f5]/50' : 'text-[#72767d]'}`}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-[#111] rounded-[8px] shadow-sm border border-white/[0.02] overflow-hidden">
        {loading ? (
          <div className="p-7 space-y-4">
            <Skeleton width="w-full" height="h-6" />
            <Skeleton width="w-full" height="h-6" />
            <Skeleton width="w-full" height="h-6" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-[14px] font-semibold text-[#f2f3f5] mb-1">
              No {tab !== 'all' ? tab : ''} members
            </p>
            <p className="text-[14px] text-[#96989d]">
              {tab === 'all' ? 'Members will appear here when they subscribe.' : `No members with "${tab}" status.`}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {['Member', 'Community / Plan', 'Platform ID', 'Started', 'Expires', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-[14px] font-bold text-[#b5bac1] uppercase tracking-[0.8px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map(s => (
                    <tr key={s.id} className={`hover:bg-white/[0.015] transition-colors ${s.status !== 'active' ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.email} size={24} />
                          <span className="text-[14px] font-semibold text-[#f2f3f5] max-w-[150px] truncate">{s.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[14px] text-[#dbdee1]">{s.communities?.name}</span>
                        {s.plans?.name && <span className="text-[#96989d] ml-2 text-[14px]">· {s.plans.name}</span>}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[14px] text-[#96989d]">{s.telegram_user_id || s.whatsapp_phone || '—'}</td>
                      <td className="px-5 py-3.5 text-[14px] text-[#96989d]">{new Date(s.started_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 text-[14px] text-[#96989d]">{new Date(s.expires_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5"><Pill status={s.status} /></td>
                      <td className="px-5 py-3.5">
                        {s.status === 'active' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRemove(s)}
                              disabled={removing === s.id}
                              aria-label={`Remove ${s.email}`}
                              className="text-[14px] px-2.5 py-1 rounded-[4px] font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                            >
                              {removing === s.id ? '…' : 'Remove'}
                            </button>
                            {s.telegram_user_id && !s.whatsapp_phone && (
                              <button
                                onClick={() => handleResend(s)}
                                disabled={resending === s.id}
                                aria-label={`Resend invite to ${s.email}`}
                                className="text-[14px] px-2.5 py-1 rounded-[4px] font-medium text-[#229ED9] hover:bg-[#229ED9]/10 disabled:opacity-40 transition-colors"
                              >
                                {resending === s.id ? '…' : 'Resend'}
                              </button>
                            )}
                          </div>
                        ) : <span className="text-[14px] text-[#72767d]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-white/[0.04]">
              {filtered.map(s => (
                <div key={s.id} className={`px-5 py-4 ${s.status !== 'active' ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={s.email} size={24} />
                      <p className="text-[14px] text-[#f2f3f5] font-semibold truncate">{s.email}</p>
                    </div>
                    <Pill status={s.status} />
                  </div>
                  <p className="text-[14px] text-[#dbdee1] mb-1.5 ml-[34px]">
                    {s.communities?.name}{s.plans?.name && <span className="text-[#96989d]"> · {s.plans.name}</span>}
                  </p>
                  <div className="flex items-center justify-between gap-2 flex-wrap ml-[34px]">
                    <p className="text-[14px] text-[#96989d]">Expires {new Date(s.expires_at).toLocaleDateString()}</p>
                    {s.status === 'active' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRemove(s)}
                          disabled={removing === s.id}
                          className="text-[14px] px-2 py-0.5 rounded-[4px] text-red-400 hover:bg-red-500/10 font-medium transition-colors"
                        >
                          Remove
                        </button>
                        {s.telegram_user_id && !s.whatsapp_phone && (
                          <button
                            onClick={() => handleResend(s)}
                            disabled={resending === s.id}
                            className="text-[14px] px-2 py-0.5 rounded-[4px] text-[#229ED9] hover:bg-[#229ED9]/10 font-medium transition-colors"
                          >
                            Resend
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
