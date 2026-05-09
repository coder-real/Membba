import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FaTelegram, FaWhatsapp, FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
)
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
)

export default function LandingPage() {
  const { user } = useAuth();
  const { dark, toggleTheme } = useTheme();

  /* ─── Feature card mockups (built inside component so JSX is compiled correctly) */

  const engineeredFeatures = [
    {
      id: "access",
      emoji: "⚡",
      title: "Automated Access Control",
      desc: "Members join your group automatically after payment and are removed the instant their subscription expires — no manual work, ever.",
      mockup: (
        <div className="mt-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] p-3 text-xs font-mono">
          <div className="flex items-center justify-between mb-2 text-[#666]">
            <span>Members</span>
            <span className="text-[#9FFF57]">● Live</span>
          </div>
          {[
            { name: "@alex_trader", status: "Active", color: "text-[#9FFF57]" },
            {
              name: "@market_queen",
              status: "Active",
              color: "text-[#9FFF57]",
            },
            { name: "@forex_king99", status: "Expired", color: "text-red-400" },
          ].map((m) => (
            <div
              key={m.name}
              className="flex items-center justify-between py-1.5 border-b border-[#222] last:border-0"
            >
              <span className="text-gray-400">{m.name}</span>
              <span className={`${m.color} font-semibold`}>{m.status}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "payment",
      emoji: "💳",
      title: "Smart Payment Links",
      desc: "One link — membba.com/join/your-community — handles plan selection, payment via Paystack, and instant group access.",
      mockup: (
        <div className="mt-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] p-3 text-xs font-mono">
          <div className="text-[#666] mb-2">Payment link</div>
          <div className="bg-[#111] rounded px-2 py-1.5 text-[#9FFF57] truncate">
            membba.com/join/forex-inner-circle
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Monthly", price: "₦5,000" },
              { label: "Quarterly", price: "₦12,000" },
            ].map((p) => (
              <div
                key={p.label}
                className="bg-[#111] rounded p-2 text-center border border-[#2a2a2a]"
              >
                <p className="text-gray-500 text-[10px]">{p.label}</p>
                <p className="text-white font-bold">{p.price}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "subs",
      emoji: "🔄",
      title: "Flexible Subscriptions",
      desc: "Set daily, weekly, monthly, or custom billing cycles. Run multiple plans for the same community.",
      mockup: (
        <div className="mt-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] overflow-hidden text-xs">
          <div className="grid grid-cols-3 bg-[#111] text-[#555] px-3 py-1.5">
            <span>Plan</span>
            <span>Duration</span>
            <span>Status</span>
          </div>
          {[
            { plan: "Monthly", dur: "30 days", status: "Active", active: true },
            { plan: "Weekly", dur: "7 days", status: "Active", active: true },
            { plan: "Annual", dur: "365 days", status: "Draft", active: false },
          ].map((r) => (
            <div
              key={r.plan}
              className="grid grid-cols-3 px-3 py-1.5 border-t border-[#222] font-mono"
            >
              <span className="text-gray-300">{r.plan}</span>
              <span className="text-gray-500">{r.dur}</span>
              <span className={r.active ? "text-[#9FFF57]" : "text-gray-600"}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const forCreators = [
    {
      n: "01",
      title: "Connect Group",
      desc: "Link your Telegram or WhatsApp group in minutes — no code required.",
    },
    {
      n: "02",
      title: "Set Pricing",
      desc: "Choose plans, durations, and prices that work for your audience.",
    },
    {
      n: "03",
      title: "Grow & Scale",
      desc: "Watch payments and memberships grow — fully on autopilot.",
    },
  ];

  const forSubscribers = [
    {
      n: "01",
      title: "Click Link",
      desc: "Open the creator's Membba link and pick a plan.",
    },
    {
      n: "02",
      title: "Seamless Checkout",
      desc: "Pay securely via Paystack — card or bank transfer.",
    },
    {
      n: "03",
      title: "Instant Access",
      desc: "Join the group instantly after payment. No waiting.",
    },
  ];

  const bg        = dark ? "bg-[#0a0a0a]" : "bg-gray-50";
  const text       = dark ? "text-white" : "text-gray-900";
  const textMuted  = dark ? "text-gray-500" : "text-gray-500";
  const navBg      = dark ? "bg-[#0a0a0a]/95" : "bg-gray-50/95";
  const navBorder  = dark ? "border-[#1a1a1a]" : "border-gray-200";
  const cardBg     = dark ? "bg-[#111] border-[#1e1e1e]" : "bg-white border-gray-200";
  const sectionBg  = dark ? "bg-[#0d0d0d]" : "bg-gray-100";
  const footerBorder = dark ? "border-[#1a1a1a]" : "border-gray-200";
  const toggleBtn  = dark
    ? "bg-white/[0.07] hover:bg-white/[0.12] text-white/60"
    : "bg-gray-100 hover:bg-gray-200 text-gray-500";

  return (
    <div
      className={`min-h-screen ${bg} ${text} transition-colors duration-300`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Navbar ──────────────────────────────────────── */}
      <nav className={`sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 ${navBg} backdrop-blur border-b ${navBorder}`}>
        <div className="flex items-center gap-2">
          {/*
            LOGO PLACEHOLDER — Replace with:
            <img src="/logo.svg" alt="Membba" className="h-8" />
          */}
          <img src="/green.svg" alt="Membba" className="h-8" />

          <span className="text-white font-bold text-lg tracking-tight">
            Membba
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
          <a href="#features" className={`hover:${text} transition-colors`}>Features</a>
          <a href="#pricing" className={`hover:${text} transition-colors`}>Pricing</a>
          <a href="#how-it-works" className={`hover:${text} transition-colors`}>Learn More</a>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${toggleBtn}`}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          {user ? (
            <Link to="/dashboard" className="text-sm bg-[#9FFF57] text-black px-4 py-2 rounded-lg font-bold hover:bg-[#8aed47] transition-colors">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className={`text-sm ${textMuted} hover:${text} transition-colors`}>Login</Link>
              <Link to="/register" className="text-sm bg-[#9FFF57] text-black px-4 py-2 rounded-lg font-bold hover:bg-[#8aed47] transition-colors">
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-0 px-6 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#9FFF57]/5 rounded-full blur-[140px]" />
        </div>


        <h1 className="text-4xl md:text-6xl font-black max-w-3xl mx-auto leading-tight mb-6">
          Monetize and Automate Your{" "}
          <span className="text-[#9FFF57]">Messaging Communities.</span>
        </h1>

        <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Turn your Telegram or WhatsApp group into a recurring revenue stream.
          Membba handles payments, access, and removals — fully automated.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-[#9FFF57] text-black px-6 py-3 rounded-xl font-bold hover:bg-[#8aed47] transition-colors text-sm"
          >
            Get Started →
          </Link>
          <a
            href="#how-it-works"
            className="text-sm text-gray-500 hover:text-white transition-colors underline underline-offset-4"
          >
            See How It Works
          </a>
        </div>

        {/* Dashboard Mockup Widget */}
        <div className="relative max-w-sm mx-auto">
          <div className="bg-[#111] border border-[#1e1e1e] rounded-3xl overflow-hidden shadow-2xl shadow-black/60">
            {/* Traffic lights */}
            <div className="bg-[#161616] px-4 py-2.5 flex items-center gap-1.5 border-b border-[#222]">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[10px] text-gray-600 font-mono">
                membba · dashboard
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-600">Active Members</p>
                <span className="text-[#9FFF57] text-xs">● Live</span>
              </div>
              <p className="text-4xl font-black text-white mb-4">2,847</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Revenue", val: "₦284K" },
                  { label: "Joined", val: "+142" },
                  { label: "Expired", val: "23" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-[#1a1a1a] rounded-xl p-2.5 text-center border border-[#222]"
                  >
                    <p className="text-[9px] text-gray-600 mb-1">{s.label}</p>
                    <p className="text-white text-sm font-bold">{s.val}</p>
                  </div>
                ))}
              </div>
              {/* Bar chart */}
              <div className="flex items-end gap-1 h-14">
                {[30, 50, 40, 70, 60, 90, 75, 95, 85, 100, 88, 92].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t transition-all"
                      style={{
                        height: `${h}%`,
                        background: i === 11 ? "#9FFF57" : "#1e1e1e",
                      }}
                    />
                  ),
                )}
              </div>
              <p className="text-[9px] text-gray-600 text-center mt-1">
                Revenue — Last 12 Months
              </p>
            </div>
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-48 h-6 bg-[#9FFF57]/20 blur-xl rounded-full" />
        </div>
      </section>

      {/* ── Engineered for Scale ─────────────────────────── */}
      <section id="features" className="py-28 px-6 md:px-12">
        <div className="max-w-5xl mx-auto"> 
          <p className="text-xs text-[#9FFF57] tracking-widest uppercase mb-3">
            Built to scale
          </p>
          <h2 className="text-3xl md:text-4xl font-black mb-2">
            Engineered for Scale
          </h2>
          <p className="text-gray-600 mb-12 text-sm">
            Everything you need to run a paid community — nothing you don't.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {engineeredFeatures.map((f) => (
              <div
                key={f.id}
                className={`border rounded-2xl p-5 hover:border-[#9FFF57]/25 transition-all duration-300 ${cardBg}`}
              >
                <div className="w-9 h-9 rounded-lg bg-[#9FFF57]/10 border border-[#9FFF57]/15 flex items-center justify-center mb-4 text-base">
                  {f.emoji}
                </div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {f.desc}
                </p>
                {f.mockup}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Frictionless Execution ───────────────────────── */}
      <section id="how-it-works" className={`py-24 px-6 md:px-12 ${sectionBg}`}>
        <div className="max-w-5xl mx-auto text-center mb-14">
          <p className="text-xs text-[#9FFF57] tracking-widest uppercase mb-3">
            Zero friction
          </p>
          <h2 className="text-3xl md:text-4xl font-black mb-3">
            Frictionless Execution
          </h2>
          <p className="text-gray-600 max-w-md mx-auto text-sm">
            Simple for creators to manage. Seamless for subscribers to join.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <p className="text-[#9FFF57] text-sm font-bold mb-7">
              👤 For Creators
            </p>
            <div className="space-y-7">
              {forCreators.map((item) => (
                <div key={item.n} className="flex gap-4">
                  <span className="text-[#9FFF57] font-black text-xl leading-none w-8 flex-shrink-0 mt-0.5">
                    {item.n}
                  </span>
                  <div>
                    <p className="font-bold text-sm mb-1">{item.title}</p>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[#9FFF57] text-sm font-bold mb-7">
              🔗 For Subscribers
            </p>
            <div className="space-y-7">
              {forSubscribers.map((item) => (
                <div key={item.n} className="flex gap-4">
                  <span className="text-[#9FFF57] font-black text-xl leading-none w-8 flex-shrink-0 mt-0.5">
                    {item.n}
                  </span>
                  <div>
                    <p className="font-bold text-sm mb-1">{item.title}</p>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Enhancement, Not Migration ───────────────────── */}
      <section className="py-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <div className={`border rounded-3xl p-10 md:p-14 grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative overflow-hidden ${cardBg}`}>
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#9FFF57]/4 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10">
              <p className="text-xs text-[#9FFF57] tracking-widest uppercase mb-3">
                Works with what you have
              </p>
              <h2 className="text-3xl md:text-4xl font-black mb-5 leading-tight">
                Enhancement,
                <br />
                Not Migration.
              </h2>
              <p className="text-gray-500 mb-7 leading-relaxed text-sm">
                Membba plugs into your existing Telegram or WhatsApp group. No
                need to move your community — just connect the bot and start
                earning.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link
                  to="/register"
                  className="text-sm bg-[#9FFF57] text-black px-5 py-2.5 rounded-lg font-bold hover:bg-[#8aed47] transition-colors"
                >
                  Try it Free
                </Link>
                <a
                  href="#features"
                  className="text-sm border border-[#2a2a2a] text-gray-400 px-5 py-2.5 rounded-lg hover:border-[#9FFF57]/30 hover:text-white transition-colors"
                >
                  Learn More
                </a>
              </div>
            </div>

            <div className="relative z-10">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-6 text-center">
                Works with
              </p>
              <div className="flex items-center justify-center gap-6">
                {/*
                  PLATFORM LOGO PLACEHOLDERS
                  Replace inner content with actual logos once you have them:
                  <img src="/telegram-logo.png" alt="Telegram" className="w-10 h-10" />
                  <img src="/whatsapp-logo.png" alt="WhatsApp" className="w-10 h-10" />
                */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-18 h-18 w-[72px] h-[72px] rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/25 flex items-center justify-center">
                    <FaTelegram size={38} className="text-[#229ED9]" />
                  </div>
                  <span className="text-xs text-gray-500">Telegram</span>
                </div>
                <div className="text-[#333] text-2xl font-light">+</div>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-[72px] h-[72px] rounded-2xl bg-[#25D366]/10 border border-[#25D366]/25 flex items-center justify-center">
                    <FaWhatsapp size={38} className="text-[#25D366]" />
                  </div>
                  <span className="text-xs text-gray-500">WhatsApp</span>
                </div>
              </div>
              <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-4 py-2 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-[#9FFF57] animate-pulse inline-block" />
                  Bot connects in under 2 minutes
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="py-28 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#9FFF57]/4 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <p className="text-xs text-[#9FFF57] tracking-widest uppercase mb-4">
            Get started today
          </p>
          <h2 className="text-4xl md:text-5xl font-black mb-5 leading-tight">
            Join the Future of
            <br />
            Chat Commerce.
          </h2>
          <p className="text-gray-500 mb-10 text-sm leading-relaxed max-w-md mx-auto">
            Stop chasing payments. Stop manually adding members. Start earning
            on autopilot.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-[#9FFF57] text-black px-8 py-4 rounded-xl font-black text-base hover:bg-[#8aed47] transition-colors"
          >
            Get Started Now →
          </Link>
          <p className="text-xs text-gray-700 mt-4">
            No credit card required · Free to start
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className={`border-t ${footerBorder} py-12 px-6 md:px-12`}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              {/*
                FOOTER LOGO PLACEHOLDER
                Replace with: <img src="/logo.svg" alt="Membba" className="h-7" />
              */}
              <img src="/green.svg" alt="Membba" className="h-7" />

              <span className="font-bold tracking-tight">Membba</span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed max-w-xs mb-5">
              Monetize and automate your messaging communities with zero
              friction.
            </p>
            <div className="flex gap-4">
              <a href="#" aria-label="X (Twitter)" className="text-gray-500 hover:text-[#9FFF57] transition-colors">
                <FaXTwitter size={16} />
              </a>
              <a href="#" aria-label="Instagram" className="text-gray-500 hover:text-[#9FFF57] transition-colors">
                <FaInstagram size={16} />
              </a>
              <a href="#" aria-label="WhatsApp" className="text-gray-500 hover:text-[#25D366] transition-colors">
                <FaWhatsapp size={16} />
              </a>
              <a href="#" aria-label="Telegram" className="text-gray-500 hover:text-[#229ED9] transition-colors">
                <FaTelegram size={16} />
              </a>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">
              Product
            </p>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>
                <a
                  href="#features"
                  className="hover:text-white transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="hover:text-white transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <Link
                  to="/register"
                  className="hover:text-white transition-colors"
                >
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">
              Account
            </p>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>
                <Link
                  to="/login"
                  className="hover:text-white transition-colors"
                >
                  Login
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="hover:text-white transition-colors"
                >
                  Register
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className={`max-w-5xl mx-auto pt-6 border-t ${footerBorder} flex flex-col md:flex-row items-center justify-between gap-3`}>
          <p className={`text-xs ${dark ? "text-gray-700" : "text-gray-400"}`}>
            © {new Date().getFullYear()} Membba. All rights reserved.
          </p>
          <div className={`flex gap-5 text-xs ${dark ? "text-gray-700" : "text-gray-400"}`}>
            <a href="#" className="hover:text-gray-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
