import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [loading, setLoading] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(true);

  useEffect(() => {
    fetchWebhookInfo();
  }, []);

  const fetchWebhookInfo = async () => {
    try {
      setWebhookLoading(true);
      const res = await fetch("/api/bot/webhook-info");
      const data = await res.json();
      setWebhookInfo(data.result);
    } catch {
      // ignore
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleRegisterWebhook = async () => {
    try {
      setWebhookLoading(true);
      const res = await fetch("/api/bot/set-webhook");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Webhook successfully registered!");
      fetchWebhookInfo();
    } catch (err) {
      toast.error(err.message || "Failed to register webhook");
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ data: { name } });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  const inputCls =
    "w-full bg-[#0a0a0a] border border-white/[0.1] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#9FFF57]/40 focus:ring-1 focus:ring-[#9FFF57]/15 transition-colors";
  const labelCls =
    "block text-[11px] font-bold text-white/45 mb-2 uppercase tracking-widest";

  return (
    <DashboardLayout>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white tracking-tight">
          Settings
        </h1>
        <p className="text-[14px] text-white/50 mt-1.5">
          Manage your account and integrations
        </p>
      </div>

      <div className="max-w-xl space-y-5">
        {/* Profile */}
        <div className="bg-[#111] border border-white/[0.07] rounded-xl p-7">
          <h2 className="text-[15px] font-bold text-white mb-6">Profile</h2>
          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <div>
              <label className={labelCls}>Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={user?.email}
                disabled
                className="w-full bg-[#0a0a0a] border border-white/[0.05] rounded-xl px-4 py-3 text-[14px] text-white/25 cursor-not-allowed"
              />
              <p className="text-[11.5px] text-white/25 mt-2">
                Email cannot be changed
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#9FFF57] text-black px-6 py-2.5 rounded-lg text-[14px] font-bold hover:bg-[#b0ff6e] disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>

        {/* Paystack */}
        <div className="bg-[#111] border border-white/[0.07] rounded-xl p-7">
          <h2 className="text-[15px] font-bold text-white mb-2">
            Paystack Integration
          </h2>
          <p className="text-[13.5px] text-white/45 mb-5 leading-relaxed">
            Your Paystack secret key is managed server-side via environment
            variables. Contact support to update it.
          </p>
          <div className="bg-[#0a0a0a] border border-white/[0.07] rounded-xl px-4 py-3 text-[13px] font-mono text-white/25 tracking-wider">
            sk_live_••••••••••••••••••••••••
          </div>
        </div>

        {/* Telegram Bot */}
        <div className="bg-[#111] border border-white/[0.07] rounded-xl p-7">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-[15px] font-bold text-white">
              Telegram Bot
            </h2>
            {webhookLoading ? (
              <span className="text-[12px] text-white/30 font-semibold uppercase tracking-wider">Checking...</span>
            ) : webhookInfo?.url ? (
              <span className="text-[11.5px] font-bold text-[#9FFF57] px-2.5 py-1 rounded-full bg-[#9FFF57]/10 border border-[#9FFF57]/20 uppercase tracking-wider">
                🟢 Webhook Active
              </span>
            ) : (
              <span className="text-[11.5px] font-bold text-[#fbbf24] px-2.5 py-1 rounded-full bg-[#fbbf24]/10 border border-[#fbbf24]/20 uppercase tracking-wider">
                🟡 Polling Active
              </span>
            )}
          </div>
          <p className="text-[13.5px] text-white/45 mb-5 leading-relaxed">
            Add{" "}
            <span className="font-mono bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-md text-white/70">
              @membba_bot
            </span>{" "}
            to your Telegram group and make it an admin. Then paste your group
            ID when creating a community.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/membba_bot"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-[#229ED9]/30 text-[#229ED9] px-5 py-2.5 rounded-lg text-[13.5px] font-semibold hover:bg-[#229ED9]/5 transition-colors"
            >
              Open @membba_bot →
            </a>
            <button
              onClick={handleRegisterWebhook}
              disabled={webhookLoading}
              className="inline-flex items-center gap-2 border border-white/10 text-white/70 px-5 py-2.5 rounded-lg text-[13.5px] font-semibold hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
            >
              Re-register Webhook
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
