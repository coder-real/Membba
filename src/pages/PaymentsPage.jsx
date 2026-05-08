import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import toast from 'react-hot-toast'

export default function PaymentsPage() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)

  useEffect(() => { fetchPayments() }, [user])

  const fetchPayments = async () => {
    const { data: communities } = await supabase
      .from('communities').select('id').eq('creator_id', user.id)
    const communityIds = communities?.map(c => c.id) || []
    if (communityIds.length === 0) { setPayments([]); setLoading(false); return }

    const { data, error } = await supabase
      .from('payments')
      .select('*, communities(name), plans(name)')
      .in('community_id', communityIds)
      .order('created_at', { ascending: false })

    if (error) toast.error(error.message)
    else {
      setPayments(data || [])
      const total = data?.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0) || 0
      setTotalRevenue(total)
    }
    setLoading(false)
  }

  const statusStyle = (s) => {
    if (s === 'success') return 'bg-[#9FFF57]/10 text-[#9FFF57] border border-[#9FFF57]/20'
    if (s === 'failed')  return 'bg-red-500/10 text-red-400 border border-red-500/20'
    return 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Payments</h1>
          <p className="text-[14px] text-white/50 mt-1.5">All transactions across your communities</p>
        </div>

        {/* Revenue pill */}
        <div className="flex-shrink-0 bg-[#111] border border-white/[0.07] rounded-xl px-6 py-4 text-right">
          <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-1">Total Revenue</p>
          <p className="text-[26px] font-black text-[#9FFF57] leading-none">₦{totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-[#111] border border-white/[0.07] rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[13px] text-white/30">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-white/35">No payments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {['Reference', 'Subscriber', 'Community', 'Amount', 'Date', 'Status'].map(h => (
                    <th key={h} className="px-6 py-4 text-left text-[11px] font-semibold text-white/35 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono text-[11.5px] text-white/30">{p.paystack_reference}</td>
                    <td className="px-6 py-4 text-[13.5px] text-white/70">{p.email}</td>
                    <td className="px-6 py-4">
                      <span className="text-[13.5px] text-white/80">{p.communities?.name}</span>
                      {p.plans?.name && <span className="text-white/30 ml-2 text-[12px]">· {p.plans.name}</span>}
                    </td>
                    <td className="px-6 py-4 text-[14px] font-bold text-white">₦{p.amount?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-[12.5px] text-white/40">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block text-[11px] px-2.5 py-1 rounded-full font-semibold ${statusStyle(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
