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

  useEffect(() => {
    fetchPayments()
  }, [user])

  const fetchPayments = async () => {
    const { data: communities } = await supabase
      .from('communities')
      .select('id')
      .eq('creator_id', user.id)

    const communityIds = communities?.map(c => c.id) || []

    if (communityIds.length === 0) {
      setPayments([])
      setLoading(false)
      return
    }

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

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">All transactions across your communities</p>
        </div>
        <div className="bg-white border border-gray-200 rounded px-4 py-3 text-right">
          <p className="text-xs text-gray-500">Total Revenue</p>
          <p className="text-xl font-bold">₦{totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No payments yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-left">Reference</th>
                <th className="px-4 py-2 text-left">Subscriber</th>
                <th className="px-4 py-2 text-left">Community</th>
                <th className="px-4 py-2 text-left">Amount</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.paystack_reference}</td>
                  <td className="px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3">
                    <span>{p.communities?.name}</span>
                    {p.plans?.name && <span className="text-gray-400 ml-1 text-xs">· {p.plans.name}</span>}
                  </td>
                  <td className="px-4 py-3 font-medium">₦{p.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  )
}
