import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference')
  const [status, setStatus] = useState('verifying') // verifying | success | failed
  const [subscription, setSubscription] = useState(null)
  const [inviteLink, setInviteLink] = useState(null)
  const [platform, setPlatform] = useState('telegram')

  useEffect(() => {
    if (reference) verifyPayment()
    else setStatus('failed')
  }, [reference])

  const verifyPayment = async () => {
    try {
      const res = await fetch(`/api/payments/verify/${reference}`)
      const data = await res.json()
      if (data.success) {
        setStatus('success')
        setSubscription(data.subscription || null)
        setInviteLink(data.invite_link || null)
        setPlatform(data.platform || 'telegram')
      } else {
        setStatus('failed')
      }
    } catch {
      setStatus('failed')
    }
  }

  const isWhatsApp = platform === 'whatsapp'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white border border-gray-200 rounded-lg p-10 max-w-md w-full text-center">

        {status === 'verifying' && (
          <>
            <div className="text-4xl mb-4 animate-pulse">⏳</div>
            <p className="text-lg font-semibold mb-2">Verifying your payment...</p>
            <p className="text-sm text-gray-500">Please wait — this usually takes a few seconds.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-2">Payment Confirmed!</h1>

            {inviteLink ? (
              <>
                <p className="text-gray-600 text-sm mb-4">
                  {isWhatsApp
                    ? 'Your WhatsApp group invite link is ready. Tap to join!'
                    : 'Your invite link is ready. Click below to join — expires in 15 minutes.'}
                </p>
                <a
                  href={inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-white mb-3 hover:opacity-90 transition-opacity ${
                    isWhatsApp ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                >
                  {isWhatsApp
                    ? <><FaWhatsapp size={18} /> Join WhatsApp Group</>
                    : <><FaTelegram size={18} /> Join Telegram Group</>}
                </a>
                {!isWhatsApp && (
                  <p className="text-xs text-gray-400 mb-4">
                    The bot may also have sent you a DM with the same link.
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-600 text-sm mb-4">
                {isWhatsApp ? (
                  <>
                    Check your <strong>WhatsApp</strong> — we'll send you a message with your group invite link shortly.
                  </>
                ) : (
                  <>
                    Check your <strong>Telegram</strong> — the bot will send you a join link shortly.
                    <br />
                    <span className="text-xs text-gray-400 mt-1 block">
                      If you don't receive it, make sure you've sent <span className="font-mono">/start</span> to the bot first.
                    </span>
                  </>
                )}
              </p>
            )}

            {subscription?.communities?.name && (
              <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4 text-sm">
                <p className="font-medium">{subscription.communities.name}</p>
                {subscription.expires_at && (
                  <p className="text-gray-400 text-xs mt-0.5">
                    Access expires: {new Date(subscription.expires_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400">Ref: {reference}</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
            <p className="text-gray-600 text-sm mb-4">
              We couldn't confirm your payment. Contact support with:
            </p>
            <p className="font-mono text-sm bg-gray-100 rounded px-3 py-2 mb-6">{reference || 'N/A'}</p>
            <Link to="/" className="text-sm underline text-gray-500">Go back home</Link>
          </>
        )}
      </div>
    </div>
  )
}
