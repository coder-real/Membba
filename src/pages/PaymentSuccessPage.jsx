import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'

function Spinner() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
    </div>
  )
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference')
  const [status, setStatus]             = useState('verifying')
  const [subscription, setSubscription] = useState(null)
  const [inviteLink, setInviteLink]     = useState(null)
  const [platform, setPlatform]         = useState('telegram')
  const [showHelp, setShowHelp]         = useState(false)

  useEffect(() => { if (reference) verifyPayment(); else setStatus('failed') }, [reference])

  const verifyPayment = async () => {
    try {
      const res  = await fetch(`/api/payments/verify/${reference}`)
      const data = await res.json()
      if (data.success) {
        setStatus('success')
        setSubscription(data.subscription || null)
        setInviteLink(data.invite_link || null)
        setPlatform(data.platform || 'telegram')
      } else {
        setStatus('failed')
      }
    } catch { setStatus('failed') }
  }

  const isWA        = platform === 'whatsapp'
  const PlatIcon    = isWA ? FaWhatsapp : FaTelegram
  const platColor   = isWA ? '#25D366' : '#229ED9'
  const platLabel   = isWA ? 'WhatsApp' : 'Telegram'

  if (status === 'verifying') return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="text-center max-w-sm w-full">
        <div className="w-14 h-14 mx-auto mb-8 relative">
          <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-[#9FFF57] border-white/[0.06] animate-spin" />
        </div>
        <p className="text-[14px] font-bold tracking-[0.15em] uppercase text-white/25 mb-3">Processing</p>
        <h1 className="text-[22px] font-black text-white mb-3">Verifying your payment</h1>
        <p className="text-[14px] text-white/40 leading-relaxed">This usually takes just a moment.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Top bar */}
      <div className="border-b border-white/[0.05] px-6 py-4 flex items-center justify-between max-w-xl mx-auto">
        <span className="text-[14px] font-black tracking-wider text-white/30 uppercase">Membba</span>
        <div className="flex items-center gap-1.5 text-white/25">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-[14px] font-semibold">Secured by Paystack</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-14">

        {/* ── Success ───────────────────────────────────────── */}
        {status === 'success' && (
          <div>
            {/* Status mark */}
            <div className="w-16 h-16 rounded-2xl bg-[#9FFF57]/10 border border-[#9FFF57]/20 flex items-center justify-center mb-7">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9FFF57" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <p className="text-[14px] font-bold tracking-[0.15em] uppercase text-[#9FFF57]/60 mb-2">Payment Confirmed</p>
            <h1 className="text-[28px] font-black text-white leading-tight mb-3">
              {subscription?.communities?.name
                ? `You're in, ${subscription.communities.name}!`
                : "You're all set!"}
            </h1>

            {/* Subscription summary */}
            {subscription && (
              <div className="border border-white/[0.07] bg-[#111] rounded-xl px-5 py-4 mb-7 mt-5">
                <div className="grid grid-cols-2 gap-y-3">
                  {subscription.communities?.name && (
                    <>
                      <span className="text-[14px] text-white/35 font-semibold uppercase tracking-wider">Community</span>
                      <span className="text-[14px] text-white font-semibold text-right">{subscription.communities.name}</span>
                    </>
                  )}
                  {subscription.expires_at && (
                    <>
                      <span className="text-[14px] text-white/35 font-semibold uppercase tracking-wider">Access until</span>
                      <span className="text-[14px] text-white font-semibold text-right">
                        {new Date(subscription.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  )}
                  <span className="text-[14px] text-white/35 font-semibold uppercase tracking-wider">Platform</span>
                  <span className="text-[14px] font-semibold text-right" style={{ color: platColor }}>
                    {platLabel}
                  </span>
                </div>
              </div>
            )}

            {/* Invite link CTA */}
            {inviteLink ? (
              <div className="space-y-3 mb-6">
                <a
                  href={inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-3 w-full py-4 rounded-xl font-black text-[15px] text-white transition-all active:scale-[0.99]"
                  style={{ backgroundColor: platColor }}
                >
                  <PlatIcon size={20} />
                  Join {platLabel} Group
                </a>
                {!isWA && (
                  <p className="text-center text-[14px] text-white/30">
                    Link expires in 15 minutes. The bot may also DM you the same link.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="border rounded-xl px-5 py-4 mb-6 text-[14px] leading-relaxed"
                  style={{ borderColor: `${platColor}30`, backgroundColor: `${platColor}08` }}>
                  <p className="font-bold mb-1.5" style={{ color: platColor }}>
                    Next step: check your {platLabel}
                  </p>
                  {isWA ? (
                    <p className="text-white/50">
                      We're sending your group invite link to the WhatsApp number you provided.
                    </p>
                  ) : (
                    <div className="text-white/50 space-y-1">
                      <p>The bot will send you a join link on Telegram.</p>
                      <p className="text-[14px] text-white/30">
                        Haven't received it? Make sure you've sent <span className="font-mono">/start</span> to <span className="font-mono">@membba_bot</span> first.
                      </p>
                    </div>
                  )}
                </div>

                {/* TSK-102: Expandable help for Telegram */}
                {!isWA && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowHelp(h => !h)}
                      className="w-full flex items-center justify-between text-[14px] text-white/35 hover:text-white/55 transition-colors py-2"
                    >
                      <span>Didn't receive a link?</span>
                      <span>{showHelp ? '▲' : '▼'}</span>
                    </button>
                    {showHelp && (
                      <div className="mt-2 bg-[#111] border border-white/[0.07] rounded-xl p-7 text-[14px] text-white/50 space-y-2 leading-relaxed">
                        <p>1. Open Telegram and search for <span className="font-mono text-white/70">@membba_bot</span></p>
                        <p>2. Send the command <span className="font-mono text-white/70">/start</span></p>
                        <p>3. Wait a moment — the bot will automatically send you the invite link.</p>
                        <p className="text-white/30">If it still doesn't arrive, contact your community admin.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Reference */}
            <div className="border-t border-white/[0.05] pt-5">
              <p className="text-[14px] text-white/25">
                Reference: <span className="font-mono text-white/35">{reference}</span>
              </p>
            </div>
          </div>
        )}

        {/* ── Failed ─────────────────────────────────────────── */}
        {status === 'failed' && (
          <div>
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-7">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>

            <p className="text-[14px] font-bold tracking-[0.15em] uppercase text-red-400/60 mb-2">Payment Issue</p>
            <h1 className="text-[26px] font-black text-white leading-tight mb-3">We couldn't verify your payment</h1>
            <p className="text-[14px] text-white/45 leading-relaxed mb-7">
              Don't worry — if your card was charged, your money is safe. Contact support with the reference below and we'll resolve it promptly.
            </p>

            {reference && (
              <div className="bg-[#111] border border-white/[0.07] rounded-xl px-5 py-3.5 mb-7 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] text-white/30 uppercase tracking-wider font-semibold mb-1">Reference</p>
                  <p className="font-mono text-[14px] text-white/70 break-all">{reference}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <a href={`mailto:support@membba.com?subject=Payment%20Issue&body=Reference:%20${reference}`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-[14px] bg-white/[0.06] text-white/70 hover:bg-white/[0.09] transition-colors border border-white/[0.07]">
                Contact Support
              </a>
              <Link to="/"
                className="text-center text-[14px] text-white/30 hover:text-white/50 transition-colors py-2">
                Go back home
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
