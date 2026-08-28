import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Check,
  CreditCard,
  KeyRound,
  LockKeyhole,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UserX,
  Zap,
} from 'lucide-react'
import { FaTelegram, FaWhatsapp, FaXTwitter, FaInstagram } from 'react-icons/fa6'

/* ─────────────────────────────── shared bits ─────────────────────────────── */

const NAV_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Milo AI', href: '#milo' },
  { label: 'Automations', href: '#automations' },
]

function Eyebrow({ children }) {
  return (
    <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c8f135]">
      {children}
    </p>
  )
}

function Chip({ children, href }) {
  const cls =
    'inline-flex items-center gap-2 rounded-full border border-[#2c3320] bg-[#12160a] px-3.5 py-1.5 text-[12px] font-medium text-[#c8f135] transition-colors hover:border-[#3d4629]'
  return href ? (
    <Link to={href} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  )
}

function SectionHeading({ eyebrow, title, sub, align = 'center' }) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left'
  return (
    <div className={`max-w-2xl ${alignCls}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="text-[28px] font-extrabold leading-[1.15] tracking-tight text-white sm:text-[36px]">
        {title}
      </h2>
      {sub ? <p className="mt-4 text-[15px] leading-relaxed text-[#9c9c9c]">{sub}</p> : null}
    </div>
  )
}

/* ─────────────────────────────────── nav ─────────────────────────────────── */

function LandingNav() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1f1f1f] bg-[#0a0a0a]/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center" aria-label="Membba home">
            <img src="/green.svg" alt="Membba" className="h-7" />
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[13.5px] font-medium text-[#b5b5b5] transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-5 md:flex">
          {user ? (
            <Link
              to="/dashboard"
              className="text-[13.5px] font-medium text-[#b5b5b5] transition-colors hover:text-white"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-[13.5px] font-medium text-[#b5b5b5] transition-colors hover:text-white"
            >
              Sign in
            </Link>
          )}
          <Link
            to={user ? '/dashboard' : '/register'}
            className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#c8f135] px-4 py-2 text-[13.5px] font-bold text-[#0a0a0a] transition-colors hover:bg-[#d7fa5e]"
          >
            {user ? 'Open dashboard' : 'Get started'}
            <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#303030] text-[#b5b5b5] md:hidden"
          aria-label="Toggle menu"
        >
          <div className="space-y-1">
            <span className={`block h-0.5 w-4 bg-current transition-transform ${open ? 'translate-y-[3px] rotate-45' : ''}`} />
            <span className={`block h-0.5 w-4 bg-current transition-transform ${open ? '-translate-y-[3px] -rotate-45' : ''}`} />
          </div>
        </button>
      </nav>

      {open ? (
        <div className="border-t border-[#1f1f1f] bg-[#0a0a0a] px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-[4px] px-2 py-2.5 text-[14px] font-medium text-[#b5b5b5] hover:bg-[#141414] hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="mt-3 flex gap-3 border-t border-[#1f1f1f] pt-4">
            <Link
              to={user ? '/dashboard' : '/login'}
              className="flex-1 rounded-[4px] border border-[#303030] px-4 py-2.5 text-center text-[13.5px] font-semibold text-white"
            >
              {user ? 'Dashboard' : 'Sign in'}
            </Link>
            <Link
              to={user ? '/dashboard' : '/register'}
              className="flex-1 rounded-[4px] bg-[#c8f135] px-4 py-2.5 text-center text-[13.5px] font-bold text-[#0a0a0a]"
            >
              {user ? 'Open dashboard' : 'Get started'}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  )
}

/* ─────────────────────────────────── hero ─────────────────────────────────── */

function HeroForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  const submit = (e) => {
    e.preventDefault()
    navigate(email ? `/register?email=${encodeURIComponent(email)}` : '/register')
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="h-11 flex-1 rounded-[4px] border border-[#303030] bg-[#141414] px-3.5 text-[14px] text-white placeholder-[#6b6b6b] outline-none focus:border-[#c8f135]"
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-[4px] bg-[#c8f135] px-5 text-[14px] font-bold text-[#0a0a0a] transition-colors hover:bg-[#d7fa5e]"
      >
        Get started free
      </button>
    </form>
  )
}

function DashboardMock() {
  return (
    <div className="overflow-hidden border border-[#2a2a2a] bg-[#0d0d0d]">
      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-[#222] bg-[#101010] px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-[#2e2e2e]" />
        <span className="h-2 w-2 rounded-full bg-[#2e2e2e]" />
        <span className="h-2 w-2 rounded-full bg-[#2e2e2e]" />
        <span className="ml-3 font-mono text-[10px] text-[#5b5b5b]">app.membba.com/dashboard</span>
      </div>

      <div className="flex">
        {/* sidebar */}
        <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-[#222] bg-[#0f0f0f] p-3 sm:flex">
          {['Overview', 'Communities', 'Members', 'Payments', 'AI Inbox', 'Automations', 'Settings'].map(
            (item, i) => (
              <div
                key={item}
                className={`rounded-[3px] px-2.5 py-1.5 text-[11px] font-medium ${
                  i === 1 ? 'bg-[#1a1f0e] text-[#c8f135]' : 'text-[#6f6f6f]'
                }`}
              >
                {item}
              </div>
            ),
          )}
        </div>

        {/* main */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-white">Tech Naija Community</p>
              <p className="mt-0.5 font-mono text-[10px] text-[#6f6f6f]">WhatsApp · Weekly plan</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#12210f] px-2.5 py-1 text-[10px] font-semibold text-[#7ee05d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7ee05d]" />
              Active
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              { label: 'Members', value: '312' },
              { label: 'This month', value: '₦1.24m' },
              { label: 'Renewals', value: '94%' },
            ].map((s) => (
              <div key={s.label} className="border border-[#222] bg-[#111] p-3">
                <p className="text-[10px] text-[#6f6f6f]">{s.label}</p>
                <p className="mt-1 font-mono text-[15px] font-bold text-white sm:text-[18px]">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden space-y-1.5 sm:block">
            {[
              { name: '@tony.sax', plan: 'Weekly', amt: '₦5,000', ok: true },
              { name: '@ada.dev', plan: 'Monthly', amt: '₦15,000', ok: true },
              { name: '@chuka', plan: 'Weekly', amt: '₦5,000', ok: true },
            ].map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between border border-[#1f1f1f] bg-[#101010] px-3 py-2"
              >
                <span className="font-mono text-[11px] text-[#c9c9c9]">{r.name}</span>
                <span className="text-[11px] text-[#6f6f6f]">{r.plan}</span>
                <span className="font-mono text-[11px] font-semibold text-white">{r.amt}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#c8f135]">
                  <Check size={11} strokeWidth={3} /> paid
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-32 sm:px-8 sm:pt-40">
      {/* backdrop */}
      <div className="landing-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(200,241,53,0.13),transparent)] blur-2xl milo-glow" />

      <div className="relative mx-auto max-w-4xl text-center">
        <Chip href="#milo">
          <Sparkles size={13} />
          New — Milo AI answers your members 24/7
        </Chip>

        <h1 className="mt-6 text-[40px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-[64px]">
          Paid communities,
          <br />
          <span className="text-[#c8f135]">on autopilot.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-[#9c9c9c]">
          Membba turns your Telegram or WhatsApp group into a membership business —
          payments collected, the gate opened, renewals chased.{' '}
          <span className="font-semibold text-[#d6d6d6]">Milo</span>, your AI co-host,
          handles the conversations.
        </p>

        <HeroForm />

        <p className="mt-4 font-mono text-[11px] tracking-wide text-[#5f5f5f]">
          Free to set up · Powered by Paystack · No code needed
        </p>
      </div>

      {/* hero visual */}
      <div className="relative mx-auto mt-14 max-w-5xl sm:mt-20">
        <div className="pointer-events-none absolute -inset-8 rounded-[24px] bg-[radial-gradient(closest-side,rgba(200,241,53,0.10),transparent)] blur-xl milo-glow" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_260px] lg:gap-0">
          <div className="relative z-10 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <DashboardMock />
          </div>

          {/* Milo — floating beside the product on desktop, below on mobile */}
          <div className="relative flex items-center justify-center lg:-mr-4 lg:-mt-6 lg:pl-6">
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 -m-6 rounded-full bg-[radial-gradient(closest-side,rgba(200,241,53,0.22),transparent)] blur-lg" />
              <img
                src="/milo-3d.jpg"
                alt="Milo, the Membba mascot"
                className="milo-float milo-orb-mask relative h-44 w-44 object-cover sm:h-56 sm:w-56 lg:h-72 lg:w-72"
              />
              <div className="absolute -left-16 top-3 hidden animate-none items-center gap-1.5 rounded-[4px] border border-[#2c3320] bg-[#0f140a]/95 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-[#c8f135] backdrop-blur sm:flex">
                <Check size={11} strokeWidth={3} /> Payment received · ₦5,000
              </div>
              <div className="absolute -right-20 bottom-8 hidden items-center gap-1.5 rounded-[4px] border border-[#2a2a2a] bg-[#101010]/95 px-2.5 py-1.5 font-mono text-[10px] text-[#9c9c9c] backdrop-blur sm:flex">
                Renewal reminder sent → @ada.dev
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────── works-with strip ─────────────────────────────── */

function PaystackMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-3-9h6l-6 6v-4H5l6-6v4h4l-6 6z" />
    </svg>
  )
}

function WorksWith() {
  const items = [
    { label: 'Telegram', icon: <FaTelegram size={16} /> },
    { label: 'WhatsApp', icon: <FaWhatsapp size={16} /> },
    { label: 'Paystack', icon: <PaystackMark /> },
    { label: 'Meta Cloud API', icon: <Megaphone size={15} /> },
  ]
  return (
    <section className="border-y border-[#1a1a1a] bg-[#0d0d0d] px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#5f5f5f]">
          Works with the tools you already use
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {items.map((it) => (
            <span
              key={it.label}
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#7a7a7a] transition-colors hover:text-white"
            >
              {it.icon}
              {it.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────── how ─────────────────────────────────── */

function How() {
  const steps = [
    {
      icon: Megaphone,
      title: 'Share your join link',
      body: 'Create a community in minutes. You get one link for Telegram or WhatsApp — post it anywhere.',
    },
    {
      icon: CreditCard,
      title: 'A fan pays to get in',
      body: 'Paystack collects cards, transfers and USSD in naira. No manual “send proof of payment” again.',
    },
    {
      icon: KeyRound,
      title: 'The gate opens itself',
      body: 'Invite link sent instantly, welcome message delivered, access revoked the day a plan expires.',
    },
  ]

  return (
    <section id="how" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="How it works"
          title="From link to member in three steps"
          sub="You do the community. Membba does the gatekeeping — from the first naira to every renewal."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative border border-[#242424] bg-[#111] p-6">
              <span className="absolute right-5 top-5 font-mono text-[12px] font-bold text-[#3a3a3a]">
                0{i + 1}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-[4px] border border-[#2c3320] bg-[#12160a] text-[#c8f135]">
                <s.icon size={18} strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 text-[16px] font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#9c9c9c]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────────────── features ───────────────────────────────── */

function Features() {
  const cards = [
    {
      icon: KeyRound,
      title: 'Instant, private access',
      body: 'Every paying member gets a fresh invite link. Non-payers never see the door.',
    },
    {
      icon: BellRing,
      title: 'Renewals on cruise control',
      body: 'Milo reminds members on WhatsApp before their plan expires — politely, and on schedule.',
    },
    {
      icon: UserX,
      title: 'Expired? Out automatically',
      body: 'When a plan lapses, access is revoked without you lifting a finger. Grace periods included.',
    },
    {
      icon: CreditCard,
      title: 'Every naira accounted for',
      body: 'Payments reconcile themselves against members, with references you can search in seconds.',
    },
    {
      icon: BadgeCheck,
      title: 'One member directory',
      body: 'Who joined, who renewed, who expired — across every community, in one searchable place.',
    },
    {
      icon: Zap,
      title: 'Broadcasts that land',
      body: 'Announce drops and events to every member’s DM, without leaving your dashboard.',
    },
  ]

  return (
    <section id="features" className="scroll-mt-24 border-t border-[#1a1a1a] px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Features"
          title="Everything after “pay” is automatic"
          sub="The boring, repeatable work of running a paid group — handled while you sleep."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="group border border-[#242424] bg-[#111] p-6 transition-colors hover:border-[#3a3a3a]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#2a2a2a] bg-[#161616] text-[#c9c9c9] transition-colors group-hover:border-[#2c3320] group-hover:bg-[#12160a] group-hover:text-[#c8f135]">
                <c.icon size={17} strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-white">{c.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#9c9c9c]">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────── milo ─────────────────────────────────── */

function MiloTyping() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="milo-typing-dot h-1.5 w-1.5 rounded-full bg-[#8a8a8a]" />
      ))}
    </span>
  )
}

function MiloChatMock() {
  return (
    <div className="overflow-hidden border border-[#2a2a2a] bg-[#0d0d0d] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-3 border-b border-[#222] bg-[#101010] px-4 py-3">
        <img
          src="/milo-flat.png"
          alt=""
          className="h-9 w-9 rounded-full border border-[#2c3320] object-cover"
        />
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-white">Milo</p>
          <p className="font-mono text-[10px] text-[#7ee05d]">online · replies in seconds</p>
        </div>
        <span className="ml-auto font-mono text-[10px] text-[#5f5f5f]">WhatsApp</span>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <div className="max-w-[80%] rounded-[4px] border border-[#242424] bg-[#161616] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#d6d6d6]">
          Did my payment go through? I sent it 10 minutes ago 🙏
        </div>

        <div className="flex max-w-[60%] items-center rounded-[4px] border border-[#242424] bg-[#141414] px-3.5 py-2">
          <MiloTyping />
        </div>

        <div className="ml-auto max-w-[85%] rounded-[4px] bg-[#c8f135] px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-[#0f140a]">
          Confirmed ✓ ₦5,000 received, Tony. Your invite link is here — welcome back in! 🚪
        </div>

        <p className="pt-1 text-center font-mono text-[10px] text-[#5f5f5f]">
          Escalates to your AI Inbox when a human is needed
        </p>
      </div>
    </div>
  )
}

function Milo() {
  const points = [
    'Answers member questions on WhatsApp and Telegram, 24/7',
    'Knows each member’s subscription status before it replies',
    'Matches payments to people — even when they pay from another number',
    'Hands over to your AI Inbox the moment a human matters',
  ]

  return (
    <section id="milo" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 border border-[#242424] bg-gradient-to-br from-[#12160a] via-[#101010] to-[#0d0d0d] p-7 sm:p-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <Eyebrow>Meet Milo</Eyebrow>
            <h2 className="text-[28px] font-extrabold leading-[1.15] tracking-tight text-white sm:text-[36px]">
              An AI co-host
              <br />
              that never sleeps
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#9c9c9c]">
              Milo lives in your group chats. He confirms payments, chases renewals and
              answers the same twenty questions every night — so mornings start with
              money in, not messages pending.
            </p>
            <ul className="mt-6 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[13.5px] leading-relaxed text-[#c9c9c9]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c8f135] p-1 text-[#0a0a0a]">
                    <Check size={11} strokeWidth={3.5} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-6 rounded-[24px] bg-[radial-gradient(closest-side,rgba(200,241,53,0.10),transparent)] blur-lg milo-glow" />
            <div className="relative">
              <MiloChatMock />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────── automations ─────────────────────────────── */

function Automations() {
  const rows = [
    { t: '09:02', job: 'renewal_reminder', detail: '@tony.sax · expires in 2 days', ok: 'sent ✓' },
    { t: '09:14', job: 'payment_received', detail: '₦5,000 · weekly plan', ok: '✓✓' },
    { t: '09:14', job: 'gate_opened', detail: 'fresh invite link issued', ok: '✓' },
    { t: '09:15', job: 'welcome_message', detail: 'delivered to WhatsApp', ok: '✓' },
    { t: '23:00', job: 'plan_expired', detail: '@chuka · grace period ended', ok: 'removed' },
  ]

  return (
    <section
      id="automations"
      className="scroll-mt-24 border-t border-[#1a1a1a] px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Automations"
            title="Set it. Forget it. Get paid."
            sub="Every membership runs on rails you configure once — reminders, access, expiries and welcomes fire on schedule, in the background, forever."
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-[4px] border border-[#242424] bg-[#111] px-3 py-1.5 font-mono text-[11px] text-[#9c9c9c]">
              renewal_reminders
            </span>
            <span className="rounded-[4px] border border-[#242424] bg-[#111] px-3 py-1.5 font-mono text-[11px] text-[#9c9c9c]">
              auto_remove_expired
            </span>
            <span className="rounded-[4px] border border-[#242424] bg-[#111] px-3 py-1.5 font-mono text-[11px] text-[#9c9c9c]">
              welcome_messages
            </span>
            <span className="rounded-[4px] border border-[#242424] bg-[#111] px-3 py-1.5 font-mono text-[11px] text-[#9c9c9c]">
              daily_digest
            </span>
          </div>
        </div>

        <div className="overflow-hidden border border-[#2a2a2a] bg-[#0d0d0d]">
          <div className="border-b border-[#222] bg-[#101010] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#5f5f5f]">
            automation_runs · today
          </div>
          <div className="divide-y divide-[#1c1c1c]">
            {rows.map((r) => (
              <div
                key={r.job + r.t}
                className="flex items-center gap-3 px-4 py-2.5 font-mono text-[11px] sm:text-[11.5px]"
              >
                <span className="text-[#5f5f5f]">{r.t}</span>
                <span className="w-[150px] shrink-0 font-semibold text-[#c8f135]">{r.job}</span>
                <span className="min-w-0 flex-1 truncate text-[#9c9c9c]">{r.detail}</span>
                <span className="shrink-0 text-[#d6d6d6]">{r.ok}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────────────── trust band ───────────────────────────────── */

function TrustBand() {
  const items = [
    { icon: ShieldCheck, title: 'Paystack-secured', body: 'Cards, transfers and USSD — PCI-compliant from day one.' },
    { icon: LockKeyhole, title: 'Private by default', body: 'Your group stays gated. Links are single-use and expiring.' },
    { icon: BadgeCheck, title: 'Built for Nigeria', body: 'Naira pricing, local payment methods, WhatsApp-first support.' },
  ]
  return (
    <section className="border-t border-[#1a1a1a] px-5 py-16 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[#2c3320] bg-[#12160a] text-[#c8f135]">
              <it.icon size={16} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-white">{it.title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#9c9c9c]">{it.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─────────────────────────────────── CTA ─────────────────────────────────── */

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-[#1a1a1a] px-5 py-24 text-center sm:px-8 sm:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(200,241,53,0.10),transparent)] blur-2xl milo-glow" />
      <div className="relative mx-auto max-w-2xl">
        <img
          src="/milo-3d.jpg"
          alt="Milo"
          className="milo-float milo-orb-mask mx-auto h-28 w-28 object-cover"
        />
        <h2 className="mt-8 text-[32px] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[48px]">
          Your community is waiting.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-[#9c9c9c]">
          Set up your gate in minutes. Let Milo hold the door. You just keep creating.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-[#c8f135] px-6 text-[14px] font-bold text-[#0a0a0a] transition-colors hover:bg-[#d7fa5e]"
          >
            Start for free
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
          <Link
            to="/login"
            className="inline-flex h-11 items-center rounded-[4px] border border-[#303030] px-6 text-[14px] font-semibold text-white transition-colors hover:border-[#4a4a4a]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────── footer ─────────────────────────────────── */

function Footer() {
  const cols = [
    {
      title: 'Product',
      links: [
        { label: 'How it works', href: '#how' },
        { label: 'Features', href: '#features' },
        { label: 'Milo AI', href: '#milo' },
        { label: 'Automations', href: '#automations' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#' },
        { label: 'Contact', href: '#' },
        { label: 'X (Twitter)', href: '#' },
        { label: 'Instagram', href: '#' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '#' },
        { label: 'Terms', href: '#' },
        { label: 'Security', href: '#' },
      ],
    },
  ]

  return (
    <footer className="border-t border-[#1a1a1a] bg-[#0d0d0d] px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <img src="/green.svg" alt="Membba" className="h-7" />
            <p className="mt-4 max-w-[240px] text-[13px] leading-relaxed text-[#7a7a7a]">
              Membership infrastructure for Telegram and WhatsApp communities.
            </p>
            <div className="mt-5 flex gap-3 text-[#7a7a7a]">
              <a href="#" aria-label="X" className="transition-colors hover:text-white">
                <FaXTwitter size={16} />
              </a>
              <a href="#" aria-label="Instagram" className="transition-colors hover:text-white">
                <FaInstagram size={16} />
              </a>
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5f5f5f]">
                {c.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[13px] text-[#9c9c9c] transition-colors hover:text-white"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#1a1a1a] pt-6 sm:flex-row">
          <p className="font-mono text-[11px] text-[#5f5f5f]">© 2026 Membba. All rights reserved.</p>
          <p className="font-mono text-[11px] text-[#5f5f5f]">Made in Nigeria 🇳🇬</p>
        </div>
      </div>
    </footer>
  )
}

/* ─────────────────────────────────── page ─────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased">
      <LandingNav />
      <main>
        <Hero />
        <WorksWith />
        <How />
        <Features />
        <Milo />
        <Automations />
        <TrustBand />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
