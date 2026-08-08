import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'
import toast from 'react-hot-toast'
import API_BASE from '../lib/api'
import WhatsAppModeBadge from '../components/WhatsAppModeBadge'

function Spinner() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
    </div>
  )
}

function CopyButton({ value, label = 'Copy' }) {
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value || ''); toast.success('Copied') }}
      className="rounded-none border border-gray-200 px-3 py-1.5 text-[12px] font-bold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5"
    >
      {label}
    </button>
  )
}

function PaymentSuccessIcon() {
  const [imageFailed, setImageFailed] = useState(false)
  return (
    <div className="relative mb-7 flex h-20 w-20 items-center justify-center">
      <span className="success-ripple absolute inset-0 rounded-full border border-[#c8f135]/30 bg-[#c8f135]/15" />
      <span className="success-ripple success-ripple-delay absolute inset-0 rounded-full border border-[#c8f135]/20 bg-[#c8f135]/10" />
      <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-[#c8f135]/25 bg-[#c8f135]/10 shadow-[0_0_34px_rgba(200,241,53,0.18)]">
        {!imageFailed && (
          <img
            src="/success_green.svg"
            alt="Payment successful"
            className="h-9 w-9 object-contain"
            onError={() => setImageFailed(true)}
          />
        )}
        {imageFailed && (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#c8f135" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference')
  const [status, setStatus]             = useState('verifying')
  const [subscription, setSubscription] = useState(null)
  const [inviteLink, setInviteLink]     = useState(null)
  const [inviteDelivery, setInviteDelivery] = useState(null)
  const [platform, setPlatform]         = useState('telegram')
  const [alreadyProcessed, setAlreadyProcessed] = useState(false)
  const [message, setMessage]           = useState('')
  const [showHelp, setShowHelp]         = useState(false)
  const [retrying, setRetrying]         = useState(false)
  const [pendingVerification, setPendingVerification] = useState(false)
  const [verifyAttempts, setVerifyAttempts] = useState(0)

  useEffect(() => { if (reference) verifyPayment(); else setStatus('failed') }, [reference])

  useEffect(() => {
    if (status !== 'success' || platform !== 'whatsapp' || !inviteLink) return
    const timer = setTimeout(() => {
      try { window.location.assign(inviteLink) } catch { /* user can still tap the join button */ }
    }, 2200)
    return () => clearTimeout(timer)
  }, [status, platform, inviteLink])


  useEffect(() => {
    if (!pendingVerification || !reference || status !== 'verifying') return
    if (verifyAttempts >= 8) {
      setStatus('failed')
      setPendingVerification(false)
      setMessage('Payment is taking longer than expected to confirm. If you were debited, keep this reference and try verification again shortly.')
      return
    }
    const delay = Math.min(3000 + verifyAttempts * 1500, 12000)
    const timer = setTimeout(() => verifyPayment({ silent: true }), delay)
    return () => clearTimeout(timer)
  }, [pendingVerification, verifyAttempts, reference, status])

  useEffect(() => {
    if (status !== 'success') return
    const exitTarget = inviteLink || '/'
    try { window.history.pushState({ membbaPaymentSuccess: true }, '', window.location.href) } catch { return }
    const onPopState = () => window.location.replace(exitTarget)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [status, inviteLink])

  const verifyPayment = async ({ silent = false } = {}) => {
    if (!reference) return setStatus('failed')
    if (!silent) setStatus('verifying')
    setRetrying(true)
    try {
      const res  = await fetch(`${API_BASE}/api/payments/verify/${reference}`)
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        setStatus('success')
        setSubscription(data.subscription || null)
        setInviteLink(data.invite_link || null)
        setInviteDelivery(data.invite_delivery || data.subscription?.inviteDelivery || null)
        setPlatform(data.platform || data.subscription?.communities?.platform || 'telegram')
        setAlreadyProcessed(Boolean(data.already_processed))
        setMessage(data.message || '')
        if (silent) toast.success(data.already_processed ? 'Already processed' : 'Payment verified')
      } else if (data.pending) {
        setStatus('verifying')
        setPendingVerification(true)
        setMessage(data.message || 'Payment is still being confirmed by Paystack.')
        setVerifyAttempts(a => a + 1)
        if (silent) toast('Payment is still being confirmed. Checking again…')
      } else {
        setStatus('failed')
        setPendingVerification(false)
        setMessage(data.message || 'Payment could not be verified yet.')
        if (silent) toast.error(data.message || 'Payment could not be verified yet')
      }
    } catch {
      setStatus('failed')
      setMessage('Could not connect to the payment server.')
      if (silent) toast.error('Could not connect to the payment server')
    } finally {
      setRetrying(false)
    }
  }

  const isWA        = platform === 'whatsapp'
  const whatsappSetupMode = isWA
    ? (subscription?.communities?.whatsapp_setup_mode || inviteDelivery?.setupMode || 'basic')
    : null
  const isAdvancedWhatsApp = whatsappSetupMode === 'advanced'
  const PlatIcon    = isWA ? FaWhatsapp : FaTelegram
  const platColor   = isWA ? '#25D366' : '#229ED9'
  const platLabel   = isWA ? 'WhatsApp' : 'Telegram'
  const supportHref = `mailto:support@membba.com?subject=Payment%20Issue%20${reference || ''}&body=Payment%20reference:%20${reference || ''}`

  if (status === 'verifying') return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center px-6" style={{ fontFamily: "var(--font-manrope)" }}>
      <div className="text-center max-w-sm w-full">
        <div className="w-14 h-14 mx-auto mb-8 relative">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[#c8f135] border-gray-200 dark:border-white/10 animate-spin" />
        </div>
        <p className="text-[14px] font-bold tracking-[0.15em] uppercase text-black dark:text-white/25 mb-3">Processing</p>
        <h1 className="text-[22px] font-black text-black dark:text-white mb-3">Verifying your payment</h1>
        <p className="text-[14px] text-black dark:text-white/40 leading-relaxed">{message || 'This usually takes just a moment. Please don’t close this page.'}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]" style={{ fontFamily: "var(--font-manrope)" }}>
      <div className="border-b border-white/[0.05] px-6 py-4 flex items-center justify-between max-w-xl mx-auto">
        <span className="text-[14px] font-black tracking-wider text-black dark:text-white/30 uppercase">Membba</span>
        <div className="flex items-center gap-1.5 text-black dark:text-white/25">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-[14px] font-semibold">Secured by Paystack</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-8 sm:px-6 sm:py-14">
        {status === 'success' && (
          <div>
            <PaymentSuccessIcon />

            <p className="text-[14px] font-bold tracking-[0.15em] uppercase text-[#c8f135]/60 mb-2">Payment Confirmed</p>
            <h1 className="text-[24px] sm:text-[28px] font-black text-black dark:text-white leading-tight mb-3">
              {subscription?.communities?.name
                ? `You're in, ${subscription.communities.name}!`
                : "You're all set!"}
            </h1>
            <p className="text-[14px] text-black dark:text-white/45 leading-relaxed mb-5">
              Your payment has been verified and your membership has been created.
            </p>

            {alreadyProcessed && (
              <div className="mb-5 rounded-none border border-blue-400/20 bg-blue-400/10 px-5 py-4 text-[14px] text-blue-700 dark:text-blue-300">
                This payment had already been processed, so we didn’t create a duplicate subscription.
              </div>
            )}

            {subscription && (
              <div className="border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-[#111] rounded-none px-4 sm:px-5 py-4 mb-7 mt-5 overflow-hidden">
                <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2">
                  {subscription.communities?.name && (
                    <>
                      <span className="text-[14px] text-black dark:text-white/35 font-semibold uppercase tracking-wider">Community</span>
                      <span className="text-[14px] text-black dark:text-white font-semibold sm:text-right">{subscription.communities.name}</span>
                    </>
                  )}
                  {subscription.expires_at && (
                    <>
                      <span className="text-[14px] text-black dark:text-white/35 font-semibold uppercase tracking-wider">Access until</span>
                      <span className="text-[14px] text-black dark:text-white font-semibold sm:text-right">
                        {new Date(subscription.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  )}
                  <span className="text-[14px] text-black dark:text-white/35 font-semibold uppercase tracking-wider">Platform</span>
                  <span className="text-[14px] font-semibold sm:text-right" style={{ color: platColor }}>{platLabel}</span>
                  {isWA && (
                    <>
                      <span className="text-[14px] text-black dark:text-white/35 font-semibold uppercase tracking-wider">WhatsApp mode</span>
                      <span className="sm:text-right"><WhatsAppModeBadge mode={whatsappSetupMode} label="full" /></span>
                    </>
                  )}
                </div>
              </div>
            )}

            {inviteLink ? (
              <div className="space-y-3 mb-6">
                <a
                  href={inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-3 w-full py-3.5 sm:py-4 rounded-none font-black text-[15px] text-black dark:text-white transition-all active:scale-[0.99]"
                  style={{ backgroundColor: platColor }}
                >
                  <PlatIcon size={20} />
                  Join {platLabel} Group
                </a>
                <p className="text-center text-[14px] text-black dark:text-white/30">
                  {isWA
                    ? (isAdvancedWhatsApp
                      ? 'This community uses Advanced group automation beta. If automation is unavailable, your invite still works manually.'
                      : 'This community uses Basic access: your invite is delivered through official WhatsApp messaging.')
                    : `We may also send this invite through ${platLabel} if the bot can reach you.`}
                </p>
              </div>
            ) : (
              <>
                <div className="border rounded-none px-5 py-4 mb-6 text-[14px] leading-relaxed"
                  style={{ borderColor: `${platColor}30`, backgroundColor: `${platColor}08` }}>
                  <p className="font-bold mb-1.5" style={{ color: platColor }}>
                    Next step: check your {platLabel}
                  </p>
                  {isWA ? (
                    <div className="text-black dark:text-white/50 space-y-2">
<WhatsAppModeBadge mode={whatsappSetupMode} label="full" />
                      {inviteDelivery?.status === 'sent' ? (
                        <p>Your invite has been sent to the WhatsApp number you provided.</p>
                      ) : inviteDelivery?.status === 'queued' ? (
                        <p>Your invite has been queued and will be sent when WhatsApp delivery is available. Keep this reference if you need support.</p>
                      ) : (
                        <p>Your invite will be sent to the WhatsApp number you provided. If delivery is offline, the admin can resend it.</p>
                      )}
                      <p className="text-[14px] text-black dark:text-white/30">
                        {isAdvancedWhatsApp
                          ? 'Advanced mode can attempt group add/remove automation, but it is still beta and may fall back to invite-link delivery.'
                          : 'Basic mode uses Meta’s official WhatsApp Cloud API for reliable 1:1 invite delivery. Group add/remove automation is not required.'}
                      </p>
                      {inviteDelivery?.method && (
                        <p className="text-[14px] text-black dark:text-white/30">Delivery: <span className="font-mono">{inviteDelivery.method}</span></p>
                      )}
                    </div>
                  ) : (
                    <div className="text-black dark:text-white/50 space-y-1">
                      <p>The bot will send you a join link on Telegram.</p>
                      <p className="text-[14px] text-black dark:text-white/30">
                        Haven't received it? Make sure you've sent <span className="font-mono">/start</span> to <span className="font-mono">@membba_bot</span> first.
                      </p>
                    </div>
                  )}
                </div>

                {!isWA && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowHelp(h => !h)}
                      className="w-full flex items-center justify-between text-[14px] text-black dark:text-white/35 hover:text-black dark:text-white/55 transition-colors py-2"
                    >
                      <span>Didn't receive a link?</span>
                      <span>{showHelp ? '▲' : '▼'}</span>
                    </button>
                    {showHelp && (
                      <div className="mt-2 bg-white dark:bg-[#111] border border-white/[0.07] rounded-none p-7 text-[14px] text-black dark:text-white/50 space-y-2 leading-relaxed">
                        <p>1. Open Telegram and search for <span className="font-mono text-black dark:text-white/70">@membba_bot</span></p>
                        <p>2. Send the command <span className="font-mono text-black dark:text-white/70">/start</span></p>
                        <p>3. Wait a moment — the bot will automatically send you the invite link.</p>
                        <p className="text-black dark:text-white/30">If it still doesn't arrive, contact your community admin with your payment reference.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="border-t border-white/[0.05] pt-5 flex items-center justify-between gap-3">
              <p className="text-[14px] text-black dark:text-white/25 min-w-0">
                Reference: <span className="font-mono text-black dark:text-white/35 break-all">{reference}</span>
              </p>
              <CopyButton value={reference} />
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-7">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>

            <p className="text-[14px] font-bold tracking-[0.15em] uppercase text-red-400/60 mb-2">Payment Issue</p>
            <h1 className="text-[26px] font-black text-black dark:text-white leading-tight mb-3">We couldn't verify your payment</h1>
            <p className="text-[14px] text-black dark:text-white/45 leading-relaxed mb-5">
              {message || "Don't worry — if your card was charged, your money is safe. Try verifying again or contact support with your reference."}
            </p>

            {reference && (
              <div className="bg-white dark:bg-[#111] border border-white/[0.07] rounded-none px-5 py-3.5 mb-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] text-black dark:text-white/30 uppercase tracking-wider font-semibold mb-1">Reference</p>
                  <p className="font-mono text-[14px] text-black dark:text-white/70 break-all">{reference}</p>
                </div>
                <CopyButton value={reference} />
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => verifyPayment({ silent: true })}
                disabled={retrying}
                className="w-full py-3.5 rounded-none font-black text-[14px] bg-[#c8f135] text-black hover:bg-[#d6ff4f] disabled:opacity-50 transition-colors"
              >
                {retrying ? 'Checking again…' : 'Retry verification'}
              </button>
              <a href={supportHref}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-none font-bold text-[14px] bg-white/[0.06] text-black dark:text-white/70 hover:bg-white/[0.09] transition-colors border border-white/[0.07]">
                Contact Support
              </a>
              <Link to="/"
                className="text-center text-[14px] text-black dark:text-white/30 hover:text-black dark:text-white/50 transition-colors py-2">
                Go back home
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
