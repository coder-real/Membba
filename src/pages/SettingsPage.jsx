import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";

const TABS = [
  { id: 'account', label: 'My account' },
  { id: 'billing', label: 'Billing' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'danger', label: 'Danger zone', isDanger: true }
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
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
    "w-full bg-[#1e1f22] border border-transparent rounded-[4px] px-3.5 py-2.5 text-[14px] text-[#dbdee1] placeholder-[#72767d] focus:outline-none focus:border-white/[0.05] focus:bg-[#111] transition-all";
  const labelCls =
    "block text-[14px] font-bold text-[#b5bac1] mb-2 uppercase tracking-wide";

  return (
    <DashboardLayout pageTitle="Settings">
      <div className="mb-6">
        <h1 className="text-[24px] font-black text-[#f2f3f5] tracking-tight">
          Settings
        </h1>
        <p className="text-[14px] text-[#b5bac1] mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-8">
        
        {/* Left Sub-nav */}
        <div className="w-full md:w-48 flex-shrink-0 flex flex-col space-y-0.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-left px-3 py-2 rounded-[4px] text-[14px] font-medium transition-colors ${
                activeTab === tab.id
                  ? (tab.isDanger ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.06] text-[#dbdee1]')
                  : (tab.isDanger ? 'text-red-400 hover:bg-red-500/5' : 'text-[#96989d] hover:bg-white/[0.02] hover:text-[#dbdee1]')
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Content */}
        <div className="flex-1 w-full max-w-2xl">
          {activeTab === 'account' && (
            <div className="bg-[#111] rounded-[8px] p-7 shadow-sm border border-white/[0.02]">
              <h2 className="text-[15px] font-bold text-[#f2f3f5] mb-6 border-b border-white/[0.06] pb-3">Profile</h2>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className={labelCls}>DISPLAY NAME</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    placeholder="Tony Oche"
                  />
                </div>
                <div>
                  <label className={labelCls}>EMAIL</label>
                  <input
                    type="email"
                    value={user?.email}
                    disabled
                    className="w-full bg-[#1e1f22] border border-transparent opacity-60 rounded-[4px] px-3.5 py-2.5 text-[14px] text-[#dbdee1] cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className={labelCls}>BUSINESS NAME</label>
                  <input
                    type="text"
                    placeholder="e.g. REACH Initiative"
                    className={inputCls}
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#2da059] hover:bg-[#208b49] text-white px-4 py-2 rounded-[4px] text-[14px] font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="bg-[#111] rounded-[8px] p-7 shadow-sm border border-red-500/20">
              <h2 className="text-[15px] font-bold text-red-400 mb-2">Danger zone</h2>
              <p className="text-[14px] text-[#96989d] mb-5">
                Deleting your account is permanent and cannot be undone. All communities, members, and payment data will be lost.
              </p>
              <button
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-[4px] text-[14px] font-medium transition-colors"
                onClick={() => toast.error('This action is disabled in the prototype')}
              >
                Delete my account
              </button>
            </div>
          )}

          {(activeTab === 'billing' || activeTab === 'notifications') && (
            <div className="text-[#96989d] text-[14px] py-10 px-4 text-center bg-[#111] rounded-[8px] border border-white/[0.02]">
              Settings for {TABS.find(t=>t.id===activeTab)?.label.toLowerCase()} are coming soon.
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* Paystack */}
              <div className="bg-[#111] border border-white/[0.02] rounded-[8px] p-7 shadow-sm">
                <h2 className="text-[15px] font-bold text-[#f2f3f5] mb-2">
                  Paystack Integration
                </h2>
                <p className="text-[14px] text-[#96989d] mb-4">
                  Your Paystack secret key is managed server-side via environment variables.
                </p>
                <div className="bg-[#1e1f22] rounded-[4px] px-3.5 py-2.5 text-[14px] font-mono text-[#72767d] tracking-wider">
                  sk_live_••••••••••••••••••••••••
                </div>
              </div>

              {/* Telegram Bot */}
              <div className="bg-[#111] border border-white/[0.02] rounded-[8px] p-7 shadow-sm">
                <h2 className="text-[15px] font-bold text-[#f2f3f5] mb-2">
                  Telegram Bot
                </h2>
                <p className="text-[14px] text-[#96989d] mb-4">
                  Add <span className="font-mono bg-white/[0.06] px-1.5 py-0.5 rounded text-[#dbdee1]">@membba_bot</span> to your Telegram group and make it an admin.
                </p>
                <a
                  href="https://t.me/membba_bot"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-[#229ED9]/50 text-[#229ED9] px-4 py-2 rounded-[4px] text-[14px] font-medium hover:bg-[#229ED9]/5 transition-colors"
                >
                  Open @membba_bot →
                </a>
              </div>

              {/* WhatsApp Bot */}
              <div className="bg-[#111] border border-white/[0.02] rounded-[8px] p-7 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[15px] font-bold text-[#f2f3f5]">WhatsApp Bot</h2>
                  <span className={`flex items-center gap-1.5 text-[14px] font-semibold ${waStatus === 'authenticated' ? 'text-[#9FFF57]' : waStatus === 'awaiting_qr' ? 'text-yellow-400' : 'text-red-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${waStatus === 'authenticated' ? 'bg-[#9FFF57]' : waStatus === 'awaiting_qr' ? 'bg-yellow-400' : 'bg-red-400'}`}></span>
                    {waStatus === 'authenticated' ? 'Connected' : waStatus === 'awaiting_qr' ? 'Needs Scan' : 'Offline'}
                  </span>
                </div>
                <p className="text-[14px] text-[#96989d] mb-4">
                  The WhatsApp client runs on a dedicated number linked to this server. Scan the QR code below to authenticate it.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {waStatus !== "authenticated" && (
                    <button
                      onClick={openQRModal}
                      className="inline-flex items-center gap-2 border border-[#25D366]/50 text-[#25D366] px-4 py-2 rounded-[4px] text-[14px] font-medium hover:bg-[#25D366]/5 transition-colors"
                    >
                      Connect WhatsApp
                    </button>
                  )}
                  {waStatus === "authenticated" && (
                    <button
                      onClick={openQRModal}
                      className="inline-flex items-center gap-2 border border-white/[0.1] text-[#b5bac1] px-4 py-2 rounded-[4px] text-[14px] font-medium hover:bg-white/[0.02] transition-colors"
                    >
                      View QR Code
                    </button>
                  )}
                  <button
                    onClick={handleRestart}
                    disabled={restarting}
                    className="inline-flex items-center gap-2 border border-white/[0.1] text-[#b5bac1] px-4 py-2 rounded-[4px] text-[14px] font-medium hover:bg-white/[0.02] disabled:opacity-50 transition-colors"
                  >
                    {restarting ? "Restarting..." : "↺ Restart Client"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#0a0a0a] border border-white/[0.1] rounded-[8px] p-8 pt-10 w-full max-w-sm text-center shadow-2xl relative">
            <button
              onClick={closeQRModal}
              className="absolute top-7 right-4 text-[#96989d] hover:text-[#dbdee1] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h3 className="text-[18px] font-bold text-[#f2f3f5] mb-1">
              Connect WhatsApp
            </h3>
            <p className="text-[14px] text-[#96989d] mb-6">
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
                className="w-56 h-56 mx-auto rounded-[8px] border border-white/[0.06] mb-2"
              />
            ) : (
              <div className="py-10 flex flex-col items-center gap-3">
                <svg className="animate-spin text-[#25D366]" xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <p className="text-[#96989d] text-[14px]">Generating QR code…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
