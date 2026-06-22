import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import API_BASE from "../lib/api";

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
  const [waPairingCode, setWaPairingCode] = useState(null);
  const [connectMethod, setConnectMethod] = useState("qr");  // 'qr' | 'pairing_code'
  const [phoneInput, setPhoneInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const pollRef = useRef(null);
  const statusIntervalRef = useRef(null);
  const statusBackoffRef = useRef(6000);
  const qrBackoffRef = useRef(4000);

  // ── Background status poll with exponential backoff on failure ────────
  // Normal cadence: every 6 s. On network error: backs off up to 30 s.
  // Resets to 6 s as soon as the backend responds again.
  const scheduleStatusPoll = (intervalMs) => {
    clearInterval(statusIntervalRef.current);
    statusIntervalRef.current = setInterval(fetchWaStatus, intervalMs);
  };

  useEffect(() => {
    fetchWaStatus();
    scheduleStatusPoll(6000);
    return () => clearInterval(statusIntervalRef.current);
  }, []);

  const fetchWaStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      const data = await res.json();
      setWaStatus(data.status);
      // Backend is reachable — reset cadence to 6 s
      if (statusBackoffRef.current !== 6000) {
        statusBackoffRef.current = 6000;
        scheduleStatusPoll(6000);
      }
    } catch {
      setWaStatus("error");
      // Backend unreachable (restarting) — back off, cap at 30 s
      const next = Math.min(statusBackoffRef.current * 2, 30000);
      statusBackoffRef.current = next;
      scheduleStatusPoll(next);
    }
  };

  // ── QR modal poll with exponential backoff on failure ────────────────
  const scheduleQRPoll = (intervalMs) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchQR, intervalMs);
  };

  const fetchQR = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/qr-data`);
      const data = await res.json();
      setWaQR(data.qr || null);
      setWaPairingCode(data.pairingCode || null);
      setWaStatus(data.status);
      // Backend reachable — reset QR poll cadence to 4 s
      if (qrBackoffRef.current !== 4000) {
        qrBackoffRef.current = 4000;
        scheduleQRPoll(4000);
      }
      if (data.status === "connected") {
        setShowQRModal(false);
        clearInterval(pollRef.current);
        toast.success("WhatsApp connected! ✅");
      }
    } catch {
      // Backend restarting — back off exponentially, cap at 32 s
      const next = Math.min(qrBackoffRef.current * 2, 32000);
      qrBackoffRef.current = next;
      scheduleQRPoll(next);
    }
  };

  const openQRModal = () => {
    qrBackoffRef.current = 4000;
    setShowQRModal(true);
    fetchQR();
    scheduleQRPoll(4000);
  };

  const closeQRModal = () => {
    setShowQRModal(false);
    clearInterval(pollRef.current);
    qrBackoffRef.current = 4000;
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await fetch(`${API_BASE}/api/whatsapp/restart`, { method: "POST" });
      toast.success("Restart signal sent");
      statusBackoffRef.current = 12000;
      scheduleStatusPoll(12000);
    } catch {
      toast.error("Restart failed");
    }
    setRestarting(false);
  };

  const handleConnect = async () => {
    if (connectMethod === 'pairing_code' && !phoneInput.trim()) {
      toast.error('Enter your WhatsApp phone number first');
      return;
    }
    setConnecting(true);
    try {
      await fetch(`${API_BASE}/api/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: connectMethod,
          phoneNumber: phoneInput.replace(/\D/g, ''),
        }),
      });
      // Start polling for result
      openQRModal();
    } catch {
      toast.error('Failed to start WhatsApp connection');
    }
    setConnecting(false);
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
                {/* Header with status badge */}
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[15px] font-bold text-[#f2f3f5]">WhatsApp Bot</h2>
                  <span className={`flex items-center gap-1.5 text-[13px] font-semibold capitalize ${
                    waStatus === 'connected'     ? 'text-[#9FFF57]' :
                    waStatus === 'syncing'       ? 'text-[#229ED9]' :
                    waStatus === 'reconnecting'  ? 'text-yellow-400' :
                    waStatus === 'needs_scan' || waStatus === 'needs_pairing_code'
                                                ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      waStatus === 'connected'     ? 'bg-[#9FFF57] animate-pulse' :
                      waStatus === 'syncing'       ? 'bg-[#229ED9]' :
                      waStatus === 'reconnecting'  ? 'bg-yellow-400 animate-pulse' :
                      waStatus === 'needs_scan' || waStatus === 'needs_pairing_code'
                                                  ? 'bg-yellow-400' : 'bg-red-400'
                    }`} />
                    {waStatus === 'connected'    ? 'Connected' :
                     waStatus === 'syncing'      ? 'Syncing…' :
                     waStatus === 'reconnecting' ? 'Reconnecting…' :
                     waStatus === 'needs_scan'   ? 'Needs Scan' :
                     waStatus === 'needs_pairing_code' ? 'Enter Pairing Code' : 'Offline'}
                  </span>
                </div>

                <p className="text-[14px] text-[#96989d] mb-5">
                  The WhatsApp client runs on a dedicated number. Choose how to authenticate:
                </p>

                {/* Method Toggle */}
                {waStatus !== 'connected' && (
                  <div className="mb-5">
                    <div className="flex gap-2 mb-4">
                      {['qr', 'pairing_code'].map(m => (
                        <button
                          key={m}
                          onClick={() => setConnectMethod(m)}
                          className={`px-3 py-1.5 rounded-[4px] text-[13px] font-semibold transition-colors ${
                            connectMethod === m
                              ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40'
                              : 'bg-white/[0.04] text-[#96989d] border border-white/[0.07] hover:text-[#dbdee1]'
                          }`}
                        >
                          {m === 'qr' ? '📷 Scan QR' : '📱 Phone Number'}
                        </button>
                      ))}
                    </div>

                    {connectMethod === 'pairing_code' && (
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={e => setPhoneInput(e.target.value)}
                        placeholder="e.g. 2348012345678 (with country code, no +)"
                        className="w-full bg-[#1e1f22] border border-white/[0.08] rounded-[4px] px-3.5 py-2.5 text-[14px] text-[#dbdee1] placeholder-[#72767d] focus:outline-none focus:border-white/20 mb-3"
                      />
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2.5">
                  {waStatus !== 'connected' && (
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="inline-flex items-center gap-2 border border-[#25D366]/50 text-[#25D366] px-4 py-2 rounded-[4px] text-[14px] font-medium hover:bg-[#25D366]/5 disabled:opacity-50 transition-colors"
                    >
                      {connecting ? 'Starting…' : connectMethod === 'qr' ? 'Connect via QR' : 'Get Pairing Code'}
                    </button>
                  )}
                  {waStatus === 'connected' && (
                    <button
                      onClick={openQRModal}
                      className="inline-flex items-center gap-2 border border-white/[0.1] text-[#b5bac1] px-4 py-2 rounded-[4px] text-[14px] font-medium hover:bg-white/[0.02] transition-colors"
                    >
                      View Status
                    </button>
                  )}
                  <button
                    onClick={handleRestart}
                    disabled={restarting}
                    className="inline-flex items-center gap-2 border border-white/[0.1] text-[#b5bac1] px-4 py-2 rounded-[4px] text-[14px] font-medium hover:bg-white/[0.02] disabled:opacity-50 transition-colors"
                  >
                    {restarting ? 'Restarting...' : '↺ Restart Client'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connect Modal — shows QR or pairing code depending on method and status */}
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

            <h3 className="text-[18px] font-bold text-[#f2f3f5] mb-1">Connect WhatsApp</h3>

            {waStatus === 'connected' ? (
              <div className="py-8">
                <p className="text-[40px] mb-3">✅</p>
                <p className="text-[16px] font-bold text-[#9FFF57]">Connected!</p>
                <p className="text-[14px] text-[#96989d] mt-1">The bot is online and ready.</p>
              </div>
            ) : waStatus === 'syncing' ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <svg className="animate-spin text-[#229ED9]" xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <p className="text-[#dbdee1] font-semibold">Syncing…</p>
                <p className="text-[14px] text-[#96989d]">Keep WhatsApp open on your phone.</p>
              </div>
            ) : waStatus === 'needs_pairing_code' && waPairingCode ? (
              <div className="py-6">
                <p className="text-[14px] text-[#96989d] mb-4">
                  Open WhatsApp → Linked Devices → Link a Device → Enter this code:
                </p>
                <p className="text-[38px] font-black tracking-[0.15em] text-white mb-4">{waPairingCode}</p>
                <p className="text-[13px] text-[#72767d]">Code refreshes automatically if unused.</p>
              </div>
            ) : waQR ? (
              <>
                <p className="text-[14px] text-[#96989d] mb-4">Open WhatsApp → Linked Devices → Link a Device → scan this QR</p>
                <img
                  src={waQR}
                  alt="WhatsApp QR"
                  className="w-56 h-56 mx-auto rounded-[8px] border border-white/[0.06] mb-2"
                />
              </>
            ) : (
              <div className="py-10 flex flex-col items-center gap-3">
                <svg className="animate-spin text-[#25D366]" xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <p className="text-[#96989d] text-[14px]">Starting connection…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
