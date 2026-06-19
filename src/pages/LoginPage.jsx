import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import toast from "react-hot-toast";

// Translate Supabase raw errors to friendly messages
function friendlyError(message) {
  if (!message) return "Something went wrong. Please try again."
  const m = message.toLowerCase()
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "Incorrect email or password. Please check and try again."
  if (m.includes("email not confirmed"))
    return "Please confirm your email address first. Check your inbox."
  if (m.includes("user not found"))
    return "No account found with that email. Would you like to register?"
  if (m.includes("too many requests") || m.includes("rate limit"))
    return "Too many attempts. Please wait a minute before trying again."
  return message
}

// Google "G" SVG icon
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const bg = dark ? "bg-[#0a0a0a]" : "bg-gray-50";
  const card = dark ? "bg-[#111] border-[#1e1e1e]" : "bg-white border-gray-200";
  const inputCls = dark
    ? "bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-gray-600 focus:border-[#9FFF57]/50 focus:ring-[#9FFF57]/25"
    : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#7de040]/60 focus:ring-[#7de040]/20";
  const labelCls = dark ? "text-gray-400" : "text-gray-500";
  const textMuted = dark ? "text-gray-500" : "text-gray-500";
  const navBorder = dark ? "border-[#1a1a1a]" : "border-gray-200";
  const googleBtn = dark
    ? "bg-[#1a1a1a] border-[#2a2a2a] text-white hover:bg-[#222] hover:border-[#333]"
    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400";

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(form.email, form.password);
    setLoading(false);
    if (error) {
      toast.error(friendlyError(error.message));
    } else {
      toast.success("Welcome back!");
      navigate("/dashboard");
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleLoading(false);
      toast.error(friendlyError(error.message));
    }
    // On success Supabase redirects — no need to navigate manually
  };

  return (
    <div className={`min-h-screen ${bg} text-${dark ? "white" : "gray-900"} flex flex-col transition-colors duration-300`}>
      {/* Background glow (dark only) */}
      {dark && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#9FFF57]/5 rounded-full blur-[120px]" />
        </div>
      )}

      {/* Navbar */}
      <nav className={`relative z-10 flex items-center justify-between px-6 py-4 border-b ${navBorder}`}>
        <Link to="/" className="flex items-center gap-2">
          <img src="/green.svg" alt="Membba" className="h-7" />
          <span className={`font-bold tracking-tight ${dark ? "text-white" : "text-gray-900"}`}>Membba</span>
        </Link>
        <div className="flex items-center gap-7">
          <p className={`text-sm ${textMuted}`}>
            Don't have an account?{" "}
            <Link to="/register" className="text-[#9FFF57] hover:underline font-medium">
              Sign up free
            </Link>
          </p>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              dark ? "bg-white/[0.07] hover:bg-white/[0.12] text-white/60" : "bg-gray-100 hover:bg-gray-200 text-gray-500"
            }`}
          >
            {dark ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </nav>

      {/* Form */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className={`border rounded-2xl p-8 ${card}`}>
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 text-xs text-[#9FFF57] border border-[#9FFF57]/25 bg-[#9FFF57]/5 rounded-full px-3 py-1 mb-5 tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9FFF57] animate-pulse inline-block" />
                Creator Dashboard
              </div>
              <h1 className={`text-2xl font-black mb-1 ${dark ? "text-white" : "text-gray-900"}`}>Welcome back</h1>
              <p className={`text-sm ${textMuted}`}>Login to manage your communities</p>
            </div>

            {/* Google button */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className={`w-full flex items-center justify-center gap-3 border rounded-xl py-3 text-sm font-semibold transition-all mb-5 disabled:opacity-60 disabled:cursor-not-allowed ${googleBtn}`}
            >
              <GoogleIcon />
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`flex-1 h-px ${dark ? "bg-[#2a2a2a]" : "bg-gray-200"}`} />
              <span className={`text-xs ${dark ? "text-gray-600" : "text-gray-400"}`}>or with email</span>
              <div className={`flex-1 h-px ${dark ? "bg-[#2a2a2a]" : "bg-gray-200"}`} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={`block text-xs font-semibold mb-2 uppercase tracking-wider ${labelCls}`}>Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-colors ${inputCls}`}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-2 uppercase tracking-wider ${labelCls}`}>Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-colors ${inputCls}`}
                  placeholder="Your password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#9FFF57] text-black py-3 rounded-xl font-black text-sm hover:bg-[#8aed47] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {loading ? "Signing in…" : "Login to Dashboard →"}
              </button>
            </form>

            <p className={`text-xs text-center mt-6 ${textMuted}`}>
              Don't have an account?{" "}
              <Link to="/register" className="text-[#9FFF57] hover:underline font-medium">Create one free</Link>
            </p>
          </div>
          <p className={`text-center text-xs mt-5 ${dark ? "text-gray-700" : "text-gray-400"}`}>
            Secured by Supabase · Payments by Paystack
          </p>
        </div>
      </div>
    </div>
  );
}
