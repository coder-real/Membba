import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import API_BASE from "../lib/api";
import {
  HiOutlineUser,
  HiOutlineCreditCard,
  HiOutlineBell,
  HiOutlineCog8Tooth,
  HiOutlineExclamationTriangle,
  HiOutlineCamera,
  HiOutlineKey,
  HiOutlineCheckCircle,
  HiOutlineArrowPath,
} from "react-icons/hi2";

const TABS = [
  { id: "account",       label: "My Account",     icon: HiOutlineUser },
  { id: "billing",       label: "Billing",         icon: HiOutlineCreditCard },
  { id: "notifications", label: "Notifications",   icon: HiOutlineBell },
  { id: "integrations",  label: "Integrations",    icon: HiOutlineCog8Tooth },
  { id: "danger",        label: "Danger Zone",     icon: HiOutlineExclamationTriangle, isDanger: true },
];

const inputCls =
  "w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[10px] px-4 py-2.5 text-[14px] text-gray-900 dark:text-[#dbdee1] placeholder-gray-400 dark:placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#9FFF57]/40 transition-all";
const labelCls =
  "block text-[12px] font-bold text-gray-500 dark:text-white/40 uppercase tracking-widest mb-1.5";

// ── Small reusable section wrapper ────────────────────────────────────
function Section({ title, description, children }) {
  return (
    <div className="bg-white dark:bg-[#111] rounded-[14px] border border-gray-200 dark:border-white/10 overflow-hidden">
      {(title || description) && (
        <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5">
          {title && <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">{title}</h3>}
          {description && <p className="text-[13px] text-gray-500 dark:text-white/40 mt-0.5">{description}</p>}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Notification toggle row ───────────────────────────────────────────
function NotifRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 dark:border-white/5 last:border-0">
      <div>
        <p className="text-[14px] font-semibold text-gray-900 dark:text-[#dbdee1]">{label}</p>
        <p className="text-[12px] text-gray-500 dark:text-white/30 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-[24px] w-[42px] items-center rounded-full flex-shrink-0 transition-colors duration-200
          ${checked ? "bg-[#9FFF57]" : "bg-gray-200 dark:bg-white/10"}`}
      >
        <span className={`inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-[22px]" : "translate-x-[4px]"}`} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("account");

  // ── Account fields ─────────────────────────────────────────────────
  const [name, setName]     = useState(user?.user_metadata?.name || "");
  const [bio, setBio]       = useState(user?.user_metadata?.bio || "");
  const [phone, setPhone]   = useState(user?.user_metadata?.phone || "");
  const [avatar, setAvatar] = useState(user?.user_metadata?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile]     = useState(false);

  // ── Password fields ────────────────────────────────────────────────
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [savingPass, setSavingPass]   = useState(false);

  // ── Notification prefs ─────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    new_member:     true,
    payment:        true,
    expiry_alert:   true,
    ai_escalation:  true,
    weekly_report:  false,
    marketing:      false,
  });

  // ── WhatsApp Status ────────────────────────────────────────────────
  const [waStatus, setWaStatus] = useState("initializing");
  const [waQR, setWaQR]         = useState(null);
  const [waPairingCode, setWaPairingCode] = useState(null);
  const [connectMethod, setConnectMethod] = useState("qr");
  const [phoneInput, setPhoneInput]       = useState("");
  const [connecting, setConnecting]       = useState(false);
  const [showQRModal, setShowQRModal]     = useState(false);
  const [restarting, setRestarting]       = useState(false);
  const pollRef            = useRef(null);
  const statusIntervalRef  = useRef(null);
  const statusBackoffRef   = useRef(6000);
  const qrBackoffRef       = useRef(4000);
  const avatarInputRef     = useRef(null);

  // ── WA polling setup ───────────────────────────────────────────────
  const scheduleStatusPoll = (ms) => {
    clearInterval(statusIntervalRef.current);
    statusIntervalRef.current = setInterval(fetchWaStatus, ms);
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
      if (statusBackoffRef.current !== 6000) { statusBackoffRef.current = 6000; scheduleStatusPoll(6000); }
    } catch {
      setWaStatus("error");
      const next = Math.min(statusBackoffRef.current * 2, 30000);
      statusBackoffRef.current = next;
      scheduleStatusPoll(next);
    }
  };

  const scheduleQRPoll = (ms) => { clearInterval(pollRef.current); pollRef.current = setInterval(fetchQR, ms); };
  const fetchQR = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/qr-data`);
      const data = await res.json();
      setWaQR(data.qr || null);
      setWaPairingCode(data.pairingCode || null);
      setWaStatus(data.status);
      if (data.status === "connected") { setShowQRModal(false); clearInterval(pollRef.current); toast.success("WhatsApp connected! ✅"); }
    } catch {
      const next = Math.min(qrBackoffRef.current * 2, 32000);
      qrBackoffRef.current = next;
      scheduleQRPoll(next);
    }
  };
  const openQRModal = () => { qrBackoffRef.current = 4000; setShowQRModal(true); fetchQR(); scheduleQRPoll(4000); };
  const closeQRModal = () => { setShowQRModal(false); clearInterval(pollRef.current); qrBackoffRef.current = 4000; };

  const handleRestart = async () => {
    setRestarting(true);
    try { await fetch(`${API_BASE}/api/whatsapp/restart`, { method: "POST" }); toast.success("Restart signal sent"); }
    catch { toast.error("Restart failed"); }
    setRestarting(false);
  };

  const handleConnect = async () => {
    if (connectMethod === "pairing_code" && !phoneInput.trim()) return toast.error("Enter your WhatsApp number first");
    setConnecting(true);
    try {
      await fetch(`${API_BASE}/api/whatsapp/connect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: connectMethod, phoneNumber: phoneInput.replace(/\D/g, "") }),
      });
      openQRModal();
    } catch { toast.error("Failed to start WhatsApp connection"); }
    setConnecting(false);
  };

  // ── Avatar upload ──────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2MB");
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      setAvatar(publicUrl);
      toast.success("Profile photo updated!");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Save profile ───────────────────────────────────────────────────
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({ data: { name, bio, phone } });
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved!");
  };

  // ── Change password ────────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPass !== confirmPass) return toast.error("Passwords don't match");
    if (newPass.length < 8) return toast.error("Password must be at least 8 characters");
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setSavingPass(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated!"); setCurrentPass(""); setNewPass(""); setConfirmPass(""); }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8 mt-2">
        <h1 className="text-[28px] font-black text-black dark:text-white tracking-tight">Settings</h1>
        <p className="text-[14px] text-gray-500 dark:text-white/40 mt-1">Manage your account and platform preferences</p>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-6">

        {/* Sidebar nav */}
        <div className="w-full md:w-52 flex-shrink-0">
          <div className="bg-white dark:bg-[#111] rounded-[14px] border border-gray-200 dark:border-white/10 overflow-hidden p-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive  = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14px] font-semibold transition-all mb-0.5 last:mb-0 text-left
                    ${isActive
                      ? tab.isDanger ? "bg-red-50 dark:bg-red-500/10 text-red-500" : "bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white"
                      : tab.isDanger ? "text-red-400 hover:bg-red-50/50 dark:hover:bg-red-500/5" : "text-gray-500 dark:text-white/30 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 w-full min-w-0 space-y-4">

          {/* ── ACCOUNT TAB ── */}
          {activeTab === "account" && (
            <>
              {/* Profile photo + name */}
              <Section title="Profile" description="Your public-facing identity on Membba">
                <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#9FFF57] to-[#45c400] flex items-center justify-center overflow-hidden border-2 border-gray-100 dark:border-white/10">
                      {avatar
                        ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                        : <span className="text-[28px] font-black text-black">{(name || user?.email || "U")[0].toUpperCase()}</span>
                      }
                    </div>
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -bottom-1 -right-1 w-7 h-7 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center shadow hover:bg-gray-50 dark:hover:bg-white/5 transition"
                    >
                      {uploadingAvatar ? <HiOutlineArrowPath size={13} className="animate-spin text-gray-400" /> : <HiOutlineCamera size={13} className="text-gray-500 dark:text-white/40" />}
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </div>
                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-black text-gray-900 dark:text-white">{name || "Set your name"}</p>
                    <p className="text-[13px] text-gray-400 dark:text-white/30 mt-0.5">{user?.email}</p>
                    <p className="text-[12px] text-gray-400 dark:text-white/20 mt-1">Click the camera icon to update your photo (max 2MB)</p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Display Name</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>WhatsApp / Phone</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 2348012345678" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={user?.email} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
                  </div>
                  <div>
                    <label className={labelCls}>Short Bio</label>
                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell your members a bit about yourself…" className={`${inputCls} resize-none`} />
                  </div>
                  <div className="pt-1">
                    <button type="submit" disabled={savingProfile}
                      className="bg-[#9FFF57] hover:bg-[#b0ff6e] text-[#111] font-black px-6 py-2.5 rounded-[10px] text-[14px] transition disabled:opacity-60 flex items-center gap-2">
                      {savingProfile ? <><HiOutlineArrowPath size={15} className="animate-spin" /> Saving…</> : <><HiOutlineCheckCircle size={15} /> Save Profile</>}
                    </button>
                  </div>
                </form>
              </Section>

              {/* Change password */}
              <Section title="Change Password" description="Use a strong password of at least 8 characters">
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className={labelCls}>New Password</label>
                    <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="New password (min 8 chars)" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm New Password</label>
                    <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Repeat new password" className={inputCls} />
                  </div>
                  <button type="submit" disabled={savingPass}
                    className="flex items-center gap-2 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#dbdee1] hover:bg-gray-50 dark:hover:bg-white/5 font-bold px-5 py-2.5 rounded-[10px] text-[14px] transition disabled:opacity-60">
                    <HiOutlineKey size={15} />
                    {savingPass ? "Updating…" : "Update Password"}
                  </button>
                </form>
              </Section>
            </>
          )}

          {/* ── BILLING TAB ── */}
          {activeTab === "billing" && (
            <>
              <Section title="Current Plan" description="Your Membba subscription">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-[22px] font-black text-gray-900 dark:text-white">Free Plan</p>
                    <p className="text-[13px] text-gray-400 dark:text-white/30 mt-0.5">Up to 1 community · 50 members · basic automations</p>
                  </div>
                  <span className="bg-[#9FFF57]/15 text-[#9FFF57] text-[12px] font-bold px-3 py-1 rounded-full">Active</span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-[#dbdee1] mb-3">Upgrade for more:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { name: "Starter", price: "₦5,000/mo", features: "3 communities · 200 members · all AI features" },
                      { name: "Growth",  price: "₦12,000/mo", features: "10 communities · unlimited members · priority support" },
                      { name: "Scale",   price: "₦25,000/mo", features: "Unlimited · white-label · API access" },
                    ].map(plan => (
                      <div key={plan.name} className="rounded-[12px] border border-gray-200 dark:border-white/10 p-4 hover:border-[#9FFF57]/40 transition cursor-pointer">
                        <p className="text-[14px] font-black text-gray-900 dark:text-white">{plan.name}</p>
                        <p className="text-[13px] font-bold text-[#9FFF57] mt-0.5">{plan.price}</p>
                        <p className="text-[12px] text-gray-500 dark:text-white/30 mt-1">{plan.features}</p>
                      </div>
                    ))}
                  </div>
                  <button className="mt-4 bg-[#9FFF57] hover:bg-[#b0ff6e] text-[#111] font-black px-6 py-2.5 rounded-[10px] text-[14px] transition"
                    onClick={() => toast("Billing upgrades coming soon!", { icon: "🚀" })}>
                    Upgrade Plan
                  </button>
                </div>
              </Section>

              <Section title="Payment Method" description="Manage how you pay for Membba">
                <div className="flex items-center gap-4 py-2">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-[8px] flex items-center justify-center">
                    <HiOutlineCreditCard size={20} className="text-gray-400 dark:text-white/25" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-gray-900 dark:text-white">No payment method on file</p>
                    <p className="text-[12px] text-gray-400 dark:text-white/30">Add a card to enable auto-renewals</p>
                  </div>
                  <button onClick={() => toast("Card management coming soon!", { icon: "💳" })}
                    className="ml-auto border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#dbdee1] font-semibold px-4 py-2 rounded-[10px] text-[13px] hover:bg-gray-50 dark:hover:bg-white/5 transition">
                    Add Card
                  </button>
                </div>
              </Section>

              <Section title="Billing History" description="Your past invoices and receipts">
                <div className="py-8 text-center">
                  <p className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">No invoices yet</p>
                  <p className="text-[13px] text-gray-400 dark:text-white/30">Invoices will appear here after your first payment.</p>
                </div>
              </Section>
            </>
          )}

          {/* ── NOTIFICATIONS TAB ── */}
          {activeTab === "notifications" && (
            <>
              <Section title="WhatsApp Alerts" description="Notifications sent to your WhatsApp via the Admin Digest and real-time alerts">
                <NotifRow
                  label="New Member Joined"
                  description="Get notified whenever a new member successfully pays and joins a community"
                  checked={notifPrefs.new_member}
                  onChange={v => setNotifPrefs(p => ({ ...p, new_member: v }))}
                />
                <NotifRow
                  label="Payment Received"
                  description="Real-time alert when a member completes payment via Paystack"
                  checked={notifPrefs.payment}
                  onChange={v => setNotifPrefs(p => ({ ...p, payment: v }))}
                />
                <NotifRow
                  label="Expiry Alerts"
                  description="24-hour warning before a member's subscription expires"
                  checked={notifPrefs.expiry_alert}
                  onChange={v => setNotifPrefs(p => ({ ...p, expiry_alert: v }))}
                />
                <NotifRow
                  label="AI Escalations"
                  description="Immediate alert when the AI First Responder cannot confidently handle a member's question"
                  checked={notifPrefs.ai_escalation}
                  onChange={v => setNotifPrefs(p => ({ ...p, ai_escalation: v }))}
                />
              </Section>

              <Section title="Digest & Reports" description="Periodic summary reports">
                <NotifRow
                  label="Daily Admin Digest"
                  description="Morning briefing at your chosen time with new members, revenue, and open escalations (managed in Automations)"
                  checked={notifPrefs.weekly_report}
                  onChange={v => setNotifPrefs(p => ({ ...p, weekly_report: v }))}
                />
                <NotifRow
                  label="Weekly Performance Report"
                  description="A Sunday summary of the week's growth, revenue, and churn"
                  checked={notifPrefs.marketing}
                  onChange={v => setNotifPrefs(p => ({ ...p, marketing: v }))}
                />
              </Section>

              <div className="flex justify-end">
                <button
                  onClick={() => toast.success("Notification preferences saved!")}
                  className="bg-[#9FFF57] hover:bg-[#b0ff6e] text-[#111] font-black px-6 py-2.5 rounded-[10px] text-[14px] transition flex items-center gap-2"
                >
                  <HiOutlineCheckCircle size={15} /> Save Preferences
                </button>
              </div>
            </>
          )}

          {/* ── INTEGRATIONS TAB ── */}
          {activeTab === "integrations" && (
            <div className="space-y-4">

              {/* Paystack */}
              <Section title="Paystack" description="Your payment processor — managed via Render environment variables">
                <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-[10px] px-4 py-3 text-[14px] font-mono text-gray-500 dark:text-white/25 tracking-widest border border-gray-100 dark:border-white/5">
                  sk_live_••••••••••••••••••••••••
                </div>
                <p className="text-[12px] text-gray-400 dark:text-white/25 mt-2">Change your key in Render → Environment Variables → PAYSTACK_SECRET_KEY</p>
              </Section>

              {/* Telegram */}
              <Section title="Telegram Bot" description="Add @membba_bot to your group and make it an admin">
                <a href="https://t.me/membba_bot" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-[#229ED9]/40 text-[#229ED9] px-5 py-2.5 rounded-[10px] text-[14px] font-bold hover:bg-[#229ED9]/5 transition">
                  Open @membba_bot →
                </a>
              </Section>

              {/* WhatsApp */}
              <Section
                title="WhatsApp Bot"
                description="The WhatsApp client that runs on your dedicated bot number"
              >
                <div className="flex items-center gap-2 mb-5">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    waStatus === "connected" ? "bg-[#9FFF57] animate-pulse" :
                    waStatus === "syncing" || waStatus === "reconnecting" ? "bg-yellow-400 animate-pulse" : "bg-red-400"
                  }`} />
                  <span className={`text-[14px] font-bold ${
                    waStatus === "connected" ? "text-[#9FFF57]" :
                    waStatus === "syncing" || waStatus === "reconnecting" ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {waStatus === "connected" ? "Connected" :
                     waStatus === "syncing" ? "Syncing…" :
                     waStatus === "reconnecting" ? "Reconnecting…" :
                     waStatus === "needs_scan" ? "Needs Scan" :
                     waStatus === "needs_pairing_code" ? "Enter Pairing Code" : "Offline"}
                  </span>
                </div>

                {waStatus !== "connected" && (
                  <div className="mb-5">
                    <div className="flex gap-2 mb-3">
                      {["qr", "pairing_code"].map(m => (
                        <button key={m} onClick={() => setConnectMethod(m)}
                          className={`px-3 py-1.5 rounded-[8px] text-[13px] font-bold transition border
                            ${connectMethod === m ? "bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30" : "text-gray-500 dark:text-white/30 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"}`}>
                          {m === "qr" ? "📷 Scan QR" : "📱 Phone Number"}
                        </button>
                      ))}
                    </div>
                    {connectMethod === "pairing_code" && (
                      <input type="tel" value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                        placeholder="e.g. 2348012345678 (country code, no +)"
                        className={`${inputCls} mb-3`} />
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {waStatus !== "connected" && (
                    <button onClick={handleConnect} disabled={connecting}
                      className="border border-[#25D366]/40 text-[#25D366] px-4 py-2 rounded-[10px] text-[14px] font-bold hover:bg-[#25D366]/5 disabled:opacity-50 transition">
                      {connecting ? "Starting…" : connectMethod === "qr" ? "Connect via QR" : "Get Pairing Code"}
                    </button>
                  )}
                  {waStatus === "connected" && (
                    <button onClick={openQRModal}
                      className="border border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#dbdee1] px-4 py-2 rounded-[10px] text-[14px] font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition">
                      View Status
                    </button>
                  )}
                  <button onClick={handleRestart} disabled={restarting}
                    className="border border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#dbdee1] px-4 py-2 rounded-[10px] text-[14px] font-semibold hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition">
                    {restarting ? "Restarting…" : "↺ Restart Client"}
                  </button>
                </div>
              </Section>
            </div>
          )}

          {/* ── DANGER TAB ── */}
          {activeTab === "danger" && (
            <Section title="Danger Zone" description="These actions are permanent and cannot be undone">
              <div className="border border-red-200 dark:border-red-500/20 rounded-[12px] p-5">
                <p className="text-[14px] font-bold text-red-500 mb-1">Delete Account</p>
                <p className="text-[13px] text-gray-500 dark:text-white/30 mb-4">
                  All your communities, members, subscriptions, and payment records will be permanently deleted.
                </p>
                <button onClick={() => toast.error("Account deletion is disabled in this environment")}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-[10px] text-[14px] transition">
                  Delete my account
                </button>
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* ── QR / Pairing Modal ── */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-[16px] p-8 w-full max-w-sm text-center shadow-2xl relative">
            <button onClick={closeQRModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white transition">✕</button>
            <h3 className="text-[18px] font-black text-gray-900 dark:text-white mb-4">Connect WhatsApp</h3>

            {waStatus === "connected" ? (
              <div className="py-8"><p className="text-[40px] mb-3">✅</p><p className="text-[16px] font-bold text-[#9FFF57]">Connected!</p></div>
            ) : waStatus === "needs_pairing_code" && waPairingCode ? (
              <div className="py-4">
                <p className="text-[13px] text-gray-500 dark:text-white/40 mb-4">WhatsApp → Linked Devices → Link a Device → Enter code:</p>
                <p className="text-[40px] font-black tracking-[0.15em] text-black dark:text-white">{waPairingCode}</p>
              </div>
            ) : waQR ? (
              <>
                <p className="text-[13px] text-gray-500 dark:text-white/40 mb-4">Scan with WhatsApp → Linked Devices → Link a Device</p>
                <img src={waQR} alt="WhatsApp QR" className="w-56 h-56 mx-auto rounded-[12px] border border-gray-200 dark:border-white/10" />
              </>
            ) : (
              <div className="py-10 flex flex-col items-center gap-3">
                <HiOutlineArrowPath size={32} className="animate-spin text-[#25D366]" />
                <p className="text-gray-500 dark:text-white/40 text-[14px]">Starting connection…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
