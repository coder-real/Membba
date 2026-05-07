import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference')
  const [status, setStatus] = useState('verifying') // verifying | success | failed

  useEffect(() => {
    if (reference) verifyPayment()
  }, [reference])

  const verifyPayment = async () => {
    try {
      const res = await fetch(`/api/payments/verify?reference=${reference}`)
      const data = await res.json()
      setStatus(data.success ? 'success' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white border border-gray-200 rounded p-10 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <p className="text-lg font-semibold mb-2">Verifying your payment...</p>
            <p className="text-sm text-gray-500">Please wait a moment.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-gray-600 text-sm mb-6">
              You'll receive a Telegram invite link shortly via email. Welcome to the community!
            </p>
            <p className="text-xs text-gray-400">Reference: {reference}</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-2">Payment Failed</h1>
            <p className="text-gray-600 text-sm mb-6">
              Something went wrong. If you were charged, please contact support with reference: <span className="font-mono">{reference}</span>
            </p>
            <Link to="/" className="text-sm underline text-gray-500">Go back home</Link>
          </>
        )}
      </div>
    </div>
  )
}
