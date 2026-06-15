import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [loading, setLoading] = useState(false);

  // WhatsApp Status
  const [waStatus, setWaStatus] = useState("initializing");
  const [waQR, setWaQR] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const fetchWaStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      setWaStatus(data.status);
    } catch {
      setWaStatus("error");
    }
  };

  const fetchQR = async () => {
    try {
      const res = await fetch("/api/whatsapp/qr-data");
      const data = await res.json();
      setWaQR(data.qr || null);
      setWaStatus(data.status);
      if (data.status === "authenticated") {
        setShowQRModal(false);
        clearInterval(pollRef.current);
        toast.success("WhatsApp connected! ✅");
      }
    } catch {}
  };

  const openQRModal = () => {
    setShowQRModal(true);
    fetchQR();
    pollRef.current = setInterval(fetchQR, 4000);
  };

  const closeQRModal = () => {
    setShowQRModal(false);
    clearInterval(pollRef.current);
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await fetch("/api/whatsapp/restart", { method: "POST" });
      toast.success("Restart signal sent");
      await fetchWaStatus();
    } catch {
      toast.error("Restart failed");
    }
    setRestarting(false);
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

  const waBadge =
    waStatus === "authenticated"
      ? { dot: "bg-[#9FFF57]", label: "Connected", color: "text-[#9FFF57]" }
      : waStatus === "awaiting_qr"
        ? {
            dot: "bg-yellow-400",
            label: "Needs QR Scan",
            color: "text-yellow-400",
          }
        : { dot: "bg-red-500", label: "Offline", color: "text-red-400" };

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
          <h2 className="text-[15px] font-bold text-white mb-2">
            Telegram Bot
          </h2>
          <p className="text-[13.5px] text-white/45 mb-5 leading-relaxed">
            Add{" "}
            <span className="font-mono bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-md text-white/70">
              @membba_bot
            </span>{" "}
            to your Telegram group and make it an admin. Then paste your group
            ID when creating a community.
          </p>
          <a
            href="https://t.me/membba_bot"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 border border-[#229ED9]/30 text-[#229ED9] px-5 py-2.5 rounded-lg text-[13.5px] font-semibold hover:bg-[#229ED9]/5 transition-colors"
          >
            Open @membba_bot →
          </a>
        </div>

        {/* WhatsApp Bot */}
        <div className="bg-[#111] border border-white/[0.07] rounded-xl p-7">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[15px] font-bold text-white">WhatsApp Bot</h2>
            <span
              className={`flex items-center gap-1.5 text-[12px] font-semibold ${waBadge.color}`}
            >
              <span className={`w-2 h-2 rounded-full ${waBadge.dot}`}></span>
              {waBadge.label}
            </span>
          </div>
          <p className="text-[13.5px] text-white/45 mb-5 leading-relaxed">
            The WhatsApp client runs on a dedicated number linked to this
            server. Scan the QR code below to authenticate it.
          </p>
          <div className="flex flex-wrap gap-3">
            {waStatus !== "authenticated" && (
              <button
                onClick={openQRModal}
                className="inline-flex items-center gap-2 border border-[#25D366]/30 text-[#25D366] px-5 py-2.5 rounded-lg text-[13.5px] font-semibold hover:bg-[#25D366]/5 transition-colors"
              >
                Connect WhatsApp
              </button>
            )}
            {waStatus === "authenticated" && (
              <button
                onClick={openQRModal}
                className="inline-flex items-center gap-2 border border-white/[0.1] text-white/50 px-5 py-2.5 rounded-lg text-[13.5px] font-semibold hover:border-white/20 hover:text-white/70 transition-colors"
              >
                View QR Code
              </button>
            )}
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="inline-flex items-center gap-2 border border-white/[0.08] text-white/40 px-5 py-2.5 rounded-lg text-[13.5px] font-semibold hover:border-white/15 hover:text-white/60 disabled:opacity-40 transition-colors"
            >
              {restarting ? "Restarting..." : "↺ Restart Client"}
            </button>
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#111] border border-white/[0.1] rounded-2xl p-8 pt-10 w-full max-w-sm text-center shadow-2xl relative">
            <button
              onClick={closeQRModal}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h3 className="text-[17px] font-black text-white mb-1">
              Connect WhatsApp
            </h3>
            <p className="text-[12.5px] text-white/40 mb-6">
              Open WhatsApp → Linked Devices → Link a Device → scan this QR
            </p>
            {waStatus === "authenticated" ? (
              <div className="py-8">
                <p className="text-[32px] mb-2">✅</p>
                <p className="text-[15px] font-bold text-[#9FFF57]">
                  Connected!
                </p>
              </div>
            ) : waQR ? (
              <img
                src={waQR}
                alt="WhatsApp QR"
                className="w-56 h-56 mx-auto rounded-xl border border-white/[0.06] mb-2"
              />
            ) : (
              <div className="py-10 flex flex-col items-center gap-3">
                <svg
                  className="animate-spin text-[#25D366]"
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
                <p className="text-white/30 text-[12px]">Generating QR code…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
