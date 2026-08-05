import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CreditCard,
  Inbox,
  LockKeyhole,
  Megaphone,
  Orbit,
  ShieldCheck,
  Sparkles,
  TimerReset,
  WalletCards,
  Workflow,
  Zap,
} from 'lucide-react'
import { FaTelegram, FaWhatsapp } from 'react-icons/fa'

function Badge({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
      {children}
    </span>
  )
}

function FeatureCard({ icon: Icon, title, children }) {
  return (
    <div className="ds-card p-5">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]">
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <h3 className="text-[16px] font-semibold leading-6 text-[var(--color-text-primary)]">{title}</h3>
      <p className="mt-2 text-[13px] leading-[18px] text-[var(--color-text-secondary)]">{children}</p>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] font-mono text-[12px] font-semibold text-[var(--color-brand)]">
        {n}
      </div>
      <div>
        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</h3>
        <p className="mt-1 text-[13px] leading-[18px] text-[var(--color-text-secondary)]">{children}</p>
      </div>
    </div>
  )
}

function MiniDashboard() {
  return (
    <div className="ds-card relative overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand)] text-[var(--color-text-on-brand)]">
            <Bot size={17} strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Creator OS</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Live community operations</p>
          </div>
        </div>
        <span className="badge badge-active">Online</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Revenue', '₦284K'],
          ['Members', '2,847'],
          ['Open AI', '6'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-1 text-[18px] font-bold leading-none text-[var(--color-text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">Recent automation</p>
          <span className="text-[11px] text-[var(--color-text-muted)]">now</span>
        </div>
        <div className="space-y-2">
          {[
            ['Payment verified', '₦5,000 from alex@gmail.com'],
            ['Invite sent', 'Telegram access delivered'],
            ['AI follow-up', 'Payment issue moved to inbox'],
          ].map(([title, sub]) => (
            <div key={title} className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.02)] px-2 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-[var(--color-text-primary)]">{title}</p>
                <p className="truncate text-[11px] text-[var(--color-text-muted)]">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] text-[var(--color-text-primary)] font-sans">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border-subtle)] bg-[rgba(10,10,10,0.86)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2">
            <img src="/green.svg" alt="Membba" className="h-8" />
            <span className="text-[16px] font-bold tracking-tight">Membba</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-[var(--color-text-secondary)] md:flex">
            <a href="#features" className="hover:text-[var(--color-text-primary)]">Features</a>
            <a href="#workflow" className="hover:text-[var(--color-text-primary)]">Workflow</a>
            <a href="#platforms" className="hover:text-[var(--color-text-primary)]">Platforms</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="btn-primary">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost hidden sm:inline-flex">Login</Link>
                <Link to="/register" className="btn-primary">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[var(--color-brand-muted)] blur-[120px]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Badge>AI-first community operating system</Badge>
              <h1 className="mt-6 max-w-3xl text-[44px] font-bold leading-[46px] tracking-[-0.05em] text-[var(--color-text-primary)] sm:text-[64px] sm:leading-[66px]">
                Run paid communities without chasing payments or access.
              </h1>
              <p className="mt-6 max-w-xl text-[16px] leading-7 text-[var(--color-text-secondary)]">
                Membba helps creators monetize Telegram and WhatsApp groups with subscriptions, access control, AI replies, payment support, and operations tools.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register" className="btn-primary px-5 py-3 text-[14px]">
                  Start building <ArrowRight size={16} />
                </Link>
                <a href="#features" className="btn-secondary px-5 py-3 text-[14px]">See features</a>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 text-[12px] text-[var(--color-text-muted)]">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} /> Paystack-ready</span>
                <span className="inline-flex items-center gap-1.5"><FaTelegram /> Telegram</span>
                <span className="inline-flex items-center gap-1.5"><FaWhatsapp /> WhatsApp</span>
              </div>
            </div>
            <MiniDashboard />
          </div>
        </section>

        <section id="features" className="border-y border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">Built for operators</p>
              <h2 className="mt-3 text-[34px] font-semibold leading-[38px] tracking-[-0.03em]">Everything a paid community needs after the sale.</h2>
              <p className="mt-3 text-[14px] leading-6 text-[var(--color-text-secondary)]">Payments are just the start. Membba connects billing, access, member support, AI, and internal operations.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard icon={WalletCards} title="Subscription payments">Create plans, collect via Paystack, verify pending payments, and repair missing subscriptions from one dashboard.</FeatureCard>
              <FeatureCard icon={LockKeyhole} title="Access control">Invite members after payment, queue access delivery, and remove expired members when subscriptions end.</FeatureCard>
              <FeatureCard icon={Sparkles} title="AI first responder">Reply to member DMs with subscription context and escalate payment, refund, or invite issues to the AI Inbox.</FeatureCard>
              <FeatureCard icon={Inbox} title="AI Inbox">Review AI escalations, jump into member drawers, resolve issues, and resend invites for active members.</FeatureCard>
              <FeatureCard icon={Megaphone} title="Scheduled broadcasts">Queue announcements to communities and use AI to personalize the tone per group.</FeatureCard>
              <FeatureCard icon={Bot} title="Membba Ops">Internal staff tools for creator support, payment lookup, subscription repair, and operational notes.</FeatureCard>
            </div>
          </div>
        </section>

        <section id="workflow" className="px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
            <div>
              <Badge>Creator workflow</Badge>
              <h2 className="mt-5 text-[34px] font-semibold leading-[38px] tracking-[-0.03em]">Launch, charge, grant access, and follow up.</h2>
            </div>
            <div className="space-y-7">
              <Step n="01" title="Create your community">Choose Telegram or WhatsApp, add pricing plans, and publish a join link.</Step>
              <Step n="02" title="Member pays">The subscriber selects a plan and pays securely through Paystack.</Step>
              <Step n="03" title="Membba grants access">The bot sends or queues an invite, creates a subscription, and tracks expiry.</Step>
              <Step n="04" title="AI handles follow-ups">Renewals, invite issues, refunds, and unknown members are routed into AI Inbox or Ops.</Step>
            </div>
          </div>
        </section>

        <section id="platforms" className="border-y border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <Badge>Enhancement, not migration</Badge>
                <h2 className="mt-5 text-[34px] font-semibold leading-[38px] tracking-[-0.03em]">Keep your group. Add the operating layer.</h2>
                <p className="mt-4 text-[14px] leading-6 text-[var(--color-text-secondary)]">Membba plugs into the platforms creators already use. No community migration. No new app for subscribers.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="ds-card p-6">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-[rgba(34,158,217,0.25)] bg-[rgba(34,158,217,0.10)] text-[#229ED9]">
                    <FaTelegram size={28} />
                  </div>
                  <h3 className="font-semibold">Telegram communities</h3>
                  <p className="mt-2 text-[13px] leading-[18px] text-[var(--color-text-secondary)]">Automated invite delivery, expiry handling, and member access tied to paid plans.</p>
                </div>
                <div className="ds-card p-6">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-[rgba(37,211,102,0.25)] bg-[rgba(37,211,102,0.10)] text-[#25D366]">
                    <FaWhatsapp size={28} />
                  </div>
                  <h3 className="font-semibold">WhatsApp communities</h3>
                  <p className="mt-2 text-[13px] leading-[18px] text-[var(--color-text-secondary)]">Queue invites, track access, and use AI replies once your WhatsApp bot connection is active.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-24 text-center sm:px-8">
          <div className="mx-auto max-w-2xl">
            <Badge>Get started</Badge>
            <h2 className="mt-5 text-[40px] font-bold leading-[44px] tracking-[-0.04em]">Turn community access into a managed business.</h2>
            <p className="mx-auto mt-4 max-w-md text-[14px] leading-6 text-[var(--color-text-secondary)]">Start with one group, one plan, and one join link. Membba handles the operations around it.</p>
            <div className="mt-8 flex justify-center">
              <Link to="/register" className="btn-primary px-6 py-3 text-[14px]">Create your account <ArrowRight size={16} /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <img src="/green.svg" alt="Membba" className="h-7" />
            <span className="font-bold">Membba</span>
          </div>
          <p className="text-[12px] text-[var(--color-text-muted)]">© {new Date().getFullYear()} Membba. Built for creator communities.</p>
        </div>
      </footer>
    </div>
  )
}
