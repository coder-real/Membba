import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(form.email, form.password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back!");
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#9FFF57]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#9FFF57]/3 rounded-full blur-[160px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <Link to="/" className="flex items-center gap-2">
          {/* LOGO PLACEHOLDER — replace with <img src="/logo.svg" alt="Membba" className="h-7" /> */}
          <img src="/public/green.svg" alt="Membba" className="h-7" />
          <span className="font-bold tracking-tight">Membba</span>
        </Link>
        <p className="text-sm text-gray-500">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-[#9FFF57] hover:underline font-medium"
          >
            Sign up free
          </Link>
        </p>
      </nav>

      {/* Form */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 text-xs text-[#9FFF57] border border-[#9FFF57]/25 bg-[#9FFF57]/5 rounded-full px-3 py-1 mb-5 tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9FFF57] animate-pulse inline-block" />
                Creator Dashboard
              </div>
              <h1 className="text-2xl font-black mb-1">Welcome back</h1>
              <p className="text-sm text-gray-500">
                Login to manage your communities
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#9FFF57]/50 focus:ring-1 focus:ring-[#9FFF57]/25 transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#9FFF57]/50 focus:ring-1 focus:ring-[#9FFF57]/25 transition-colors"
                  placeholder="Your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#9FFF57] text-black py-3 rounded-xl font-black text-sm hover:bg-[#8aed47] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {loading ? "Signing in..." : "Login to Dashboard →"}
              </button>
            </form>

            <p className="text-xs text-center text-gray-600 mt-6">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-[#9FFF57] hover:underline font-medium"
              >
                Create one free
              </Link>
            </p>
          </div>

          {/* Trust note */}
          <p className="text-center text-xs text-gray-700 mt-5">
            Secured by Supabase · Payments by Paystack
          </p>
        </div>
      </div>
    </div>
  );
}
