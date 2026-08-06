import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
import { FaTelegram, FaWhatsapp } from "react-icons/fa";

const TABS = [
  { id: "account",       label: "My Account",     icon: HiOutlineUser },
  { id: "billing",       label: "Billing",         icon: HiOutlineCreditCard },
  { id: "notifications", label: "Notifications",   icon: HiOutlineBell },
  { id: "integrations",  label: "Integrations",    icon: HiOutlineCog8Tooth },
  { id: "danger",        label: "Danger Zone",     icon: HiOutlineExclamationTriangle, isDanger: true },
];

const inputCls =
  "w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-[10px] px-4 py-2.5 text-[14px] text-gray-900 dark:text-[#dbdee1] placeholder-gray-400 dark:placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#c8f135]/40 transition-all";
const labelCls =
  "block text-[12px] font-bold text-gray-500 dark:text-white/40 uppercase tracking-widest mb-1.5";

// ── Small reusable section wrapper ────────────────────────────────────
function Section({ title, description, children, eyebrow }) {
  return (
    <div className="bg-white dark:bg-[#111] rounded-[14px] border border-gray-200 dark:border-white/10 overflow-hidden">
      {(title || description) && (
        <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5">
          {eyebrow && <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#c8f135]">{eyebrow}</p>}
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
          ${checked ? "bg-[#c8f135]" : "bg-gray-200 dark:bg-white/10"}`}
      >
        <span className={`inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-[22px]" : "translate-x-[4px]"}`} />
      </button>
    </div>
  );
}

function StatusChip({ status = 'idle', children }) {
  const tone = status === 'ready'
    ? 'border-[#c8f135]/20 bg-[#c8f135]/10 text-[#c8f135]'
    : status === 'warning'
      ? 'border-amber-400/20 bg-amber-400/10 text-amber-600 dark:text-amber-300'
      : status === 'danger'
        ? 'border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-300'
        : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45'
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-black ${tone}`}>{children}</span>
}

function IntegrationNav({ active, onSelect }) {
  const items = [
    { id: 'overview', label: 'Overview', description: 'What is connected' },
    { id: 'official', label: 'Official WhatsApp', description: 'Meta Cloud API' },
    { id: 'advanced', label: 'Advanced WhatsApp', description: 'Baileys group automation' },
    { id: 'telegram', label: 'Telegram', description: 'Bot setup' },
    { id: 'payments', label: 'Payments', description: 'Paystack' },
  ]

  return (
    <div className="mb-4 overflow-x-auto">
      <div className="flex min-w-max gap-2">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            title={item.description}
            className={`rounded-[var(--radius-md)] border px-3 py-2 text-[13px] font-medium transition ${
              active === item.id
                ? 'border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                : 'border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, updateUserMetadata, updatePassword } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState(searchParams.get("tab") || "account");

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setSearchParams(tab === "account" ? {} : { tab });
  };

  useEffect(() => {
    const tab = searchParams.get("tab") || "account";
    if (tab !== activeTab) setActiveTabState(tab);
    const billing = searchParams.get("billing") || "plan";
    if (billing !== billingTab) setBillingTab(billing);
  }, [searchParams]);

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
  const [billingTab, setBillingTab] = useState(searchParams.get("billing") || "plan");
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [addingCard, setAddingCard] = useState(false);

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
  const [tgStatus, setTgStatus] = useState({ configured: false, online: false });
  const [metaStatus, setMetaStatus] = useState({ configured: false });
  const [metaTest, setMetaTest] = useState({ to: '2348080970430', text: 'Hello from Membba official WhatsApp API.' });
  const [sendingMetaTest, setSendingMetaTest] = useState(false);
  const [integrationTab, setIntegrationTab] = useState('overview');
  const [waTest, setWaTest] = useState({ to: '2348080970430', text: 'Hello from Membba Advanced WhatsApp automation.' });
  const [sendingWaTest, setSendingWaTest] = useState(false);
  const [inviteTestLink, setInviteTestLink] = useState('');
  const [inviteTestResult, setInviteTestResult] = useState(null);
  const [testingInvite, setTestingInvite] = useState(false);
  const [waQR, setWaQR]         = useState(null);
  const [waPairingCode, setWaPairingCode] = useState(null);
  const [waError, setWaError] = useState(null);
  const [waDebug, setWaDebug] = useState(null);
  const isMobileDevice = searchParams.get("mobile") === "true" || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const [connectMethod, setConnectMethod] = useState(isMobileDevice ? "pairing_code" : "qr");
  const [phoneInput, setPhoneInput]       = useState("");
  const [connecting, setConnecting]       = useState(false);
  const [showQRModal, setShowQRModal]     = useState(false);
  const [restarting, setRestarting]       = useState(false);
  const [copiedPairing, setCopiedPairing] = useState(false);
  const pollRef            = useRef(null);
  const statusIntervalRef  = useRef(null);
  const statusBackoffRef   = useRef(6000);
  const qrBackoffRef       = useRef(4000);
  const avatarInputRef     = useRef(null);

  useEffect(() => {
    if (isMobileDevice && waStatus !== "connected") setConnectMethod("pairing_code");
  }, [isMobileDevice, waStatus]);

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  }


  async function sendMetaTestMessage() {
    if (!metaTest.to.trim() || !metaTest.text.trim()) return toast.error('Enter phone and message')
    setSendingMetaTest(true)
    try {
      const res = await fetch(`${API_BASE}/api/meta/send-test`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ to: metaTest.to.replace(/\D/g, ''), text: metaTest.text.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.message || 'Could not send test message')
      toast.success('Meta WhatsApp test sent')
    } catch (err) {
      toast.error(err.message || 'Could not send test message')
    } finally {
      setSendingMetaTest(false)
    }
  }

  async function sendBaileysTestMessage() {
    if (!waTest.to.trim() || !waTest.text.trim()) return toast.error('Enter phone and message')
    setSendingWaTest(true)
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/send-test`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ to: waTest.to.replace(/\D/g, ''), text: waTest.text.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.message || 'Could not send Baileys test message')
      toast.success('Baileys WhatsApp test sent')
    } catch (err) {
      toast.error(err.message || 'Could not send Baileys test message')
    } finally {
      setSendingWaTest(false)
    }
  }

  async function testInviteLink() {
    if (!inviteTestLink.trim()) return toast.error('Paste a WhatsApp group invite link')
    setTestingInvite(true)
    setInviteTestResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/resolve-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_link: inviteTestLink.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.message || 'Could not inspect invite link')
      setInviteTestResult(data)
      toast.success(data.group_name ? 'Group link inspected' : 'Invite link looks valid')
    } catch (err) {
      setInviteTestResult({ ok: false, message: err.message })
      toast.error(err.message || 'Could not inspect invite link')
    } finally {
      setTestingInvite(false)
    }
  }

  async function loadCards() {
    setLoadingCards(true)
    try {
      const res = await fetch(`${API_BASE}/api/billing/cards`, { headers: await getAuthHeaders() })
      const data = await res.json().catch(() => [])
      if (!res.ok) throw new Error(data.message || 'Could not load cards')
      setCards(data || [])
    } catch (err) {
      toast.error(err.message || 'Could not load cards')
    } finally {
      setLoadingCards(false)
    }
  }

  async function addCard() {
    setAddingCard(true)
    try {
      const res = await fetch(`${API_BASE}/api/billing/cards/initialize`, { method: 'POST', headers: await getAuthHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not start card setup')
      window.location.href = data.authorization_url
    } catch (err) {
      toast.error(err.message || 'Could not start card setup')
      setAddingCard(false)
    }
  }

  async function verifyBillingCard(reference) {
    if (!reference) return
    setLoadingCards(true)
    try {
      const res = await fetch(`${API_BASE}/api/billing/cards/verify/${reference}`, { headers: await getAuthHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.message || 'Card setup was not successful')
      toast.success(data.already_saved ? 'Card already saved' : 'Card saved')
      await loadCards()
      const next = new URLSearchParams(searchParams)
      next.delete('reference')
      setSearchParams(next)
    } catch (err) {
      toast.error(err.message || 'Could not verify card')
    } finally {
      setLoadingCards(false)
    }
  }

  async function removeCard(id) {
    try {
      const res = await fetch(`${API_BASE}/api/billing/cards/${id}`, { method: 'DELETE', headers: await getAuthHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not remove card')
      setCards(prev => prev.filter(c => c.id !== id))
      toast.success('Card removed')
    } catch (err) {
      toast.error(err.message || 'Could not remove card')
    }
  }

  // ── WA polling setup ───────────────────────────────────────────────
  const scheduleStatusPoll = (ms) => {
    clearInterval(statusIntervalRef.current);
    statusIntervalRef.current = setInterval(fetchWaStatus, ms);
  };
  useEffect(() => {
    fetchWaStatus();
    fetchTelegramStatus();
    fetchMetaStatus();
    scheduleStatusPoll(6000);
    return () => clearInterval(statusIntervalRef.current);
  }, []);

  useEffect(() => {
    if (activeTab === "billing" && billingTab === "payment") loadCards();
  }, [activeTab, billingTab]);

  useEffect(() => {
    const ref = searchParams.get("reference");
    if (activeTab === "billing" && billingTab === "payment" && ref) verifyBillingCard(ref);
  }, [activeTab, billingTab, searchParams]);

  const fetchMetaStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/meta/status`);
      const data = await res.json();
      setMetaStatus(data);
    } catch {
      setMetaStatus({ configured: false });
    }
  };

  const fetchTelegramStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/telegram/status`);
      const data = await res.json();
      setTgStatus(data);
    } catch {
      setTgStatus({ configured: false, online: false });
    }
  };

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
      setWaError(data.error || null);
      setWaDebug(data.debug || null);
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


  async function copyPairingCode() {
    if (!waPairingCode) return
    try {
      await navigator.clipboard.writeText(waPairingCode)
      setCopiedPairing(true)
      toast.success('Pairing code copied')
      setTimeout(() => setCopiedPairing(false), 1500)
    } catch {
      toast.error('Could not copy code')
    }
  }

  function openWhatsAppApp() {
    window.location.href = 'whatsapp://app'
  }

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
        body: JSON.stringify({ method: connectMethod, phoneNumber: phoneInput.replace(/\D/g, ""), resetSession: true }),
      });
      openQRModal();
    } catch { toast.error("Failed to start WhatsApp connection"); }
    setConnecting(false);
  };


  const handleResetWhatsAppSession = async () => {
    setRestarting(true)
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/reset-session`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Reset failed')
      setWaStatus(data.status || 'initializing')
      setWaDebug(data.debug || null)
      setWaPairingCode(null)
      setWaQR(null)
      setWaError(null)
      toast.success('WhatsApp session reset. Try connecting again.')
    } catch (err) {
      toast.error(err.message || 'Reset failed')
    } finally {
      setRestarting(false)
    }
  }


  const handleResetAndReconnectWhatsApp = async () => {
    setRestarting(true)
    try {
      await handleResetWhatsAppSession()
      if (connectMethod === "pairing_code" && !phoneInput.trim()) {
        toast.error("Enter your WhatsApp number first")
        return
      }
      await fetch(`${API_BASE}/api/whatsapp/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: connectMethod, phoneNumber: phoneInput.replace(/\D/g, ""), resetSession: true }),
      })
      setShowQRModal(true)
      qrBackoffRef.current = 4000
      fetchQR()
      scheduleQRPoll(4000)
      toast.success("Requested a fresh connection code")
    } catch (err) {
      toast.error(err.message || "Could not request new code")
    } finally {
      setRestarting(false)
    }
  }

  // ── Avatar upload ──────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2MB");
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: metaErr } = await updateUserMetadata({ avatar_url: publicUrl });
      if (metaErr) throw metaErr;
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
    const { error } = await updateUserMetadata({ name, bio, phone });
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
    const { error } = await updatePassword(newPass);
    setSavingPass(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated!"); setCurrentPass(""); setNewPass(""); setConfirmPass(""); }
  };

  return (
    <>
      <div>
        {/* Header */}
        <div className="mb-8 mt-2">
          <h1 className="text-[24px] font-black text-[var(--color-text-primary)] tracking-tight">Settings</h1>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-1">Manage your account and platform preferences</p>
        </div>

        <div className="lg:hidden mb-5 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-[13px] font-medium ${
                    isActive ? "border-[var(--color-brand)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]" : "border-[var(--color-border-default)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  <Icon size={15} /> {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="w-full min-w-0 space-y-4">

          {/* ── ACCOUNT TAB ── */}
          {activeTab === "account" && (
            <>
              {/* Profile photo + name */}
              <Section title="Profile" description="Your public-facing identity on Membba">
                <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#c8f135] to-[#45c400] flex items-center justify-center overflow-hidden border-2 border-gray-100 dark:border-white/10">
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
                      className="bg-[#c8f135] hover:bg-[#d6ff4f] text-[#111] font-black px-6 py-2.5 rounded-[10px] text-[14px] transition disabled:opacity-60 flex items-center gap-2">
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
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { id: 'plan', label: 'Plan / Upgrade' },
                  { id: 'payment', label: 'Payment Method' },
                  { id: 'history', label: 'Billing History' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setBillingTab(item.id); setSearchParams({ tab: "billing", billing: item.id }) }}
                    className={`rounded-[var(--radius-md)] border px-3 py-2 text-[13px] font-medium ${billingTab === item.id ? 'border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]' : 'border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {billingTab === 'plan' && (
                <Section title="Plan / Upgrade" description="Your Membba subscription and upgrade options">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-[22px] font-black text-gray-900 dark:text-white">Free Plan</p>
                      <p className="text-[13px] text-gray-400 dark:text-white/30 mt-0.5">Up to 1 community · 50 members · basic automations</p>
                    </div>
                    <span className="bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] text-[12px] font-bold px-3 py-1 rounded-full border border-[var(--color-border-default)]">Active</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-[#dbdee1] mb-3">Upgrade for more:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { name: "Starter", price: "₦5,000/mo", features: "3 communities · 200 members · all AI features" },
                        { name: "Growth",  price: "₦12,000/mo", features: "10 communities · unlimited members · priority support" },
                        { name: "Scale",   price: "₦25,000/mo", features: "Unlimited · white-label · API access" },
                      ].map(plan => (
                        <div key={plan.name} className="rounded-[12px] border border-gray-200 dark:border-white/10 p-4 hover:border-[var(--color-border-strong)] transition cursor-pointer">
                          <p className="text-[14px] font-black text-gray-900 dark:text-white">{plan.name}</p>
                          <p className="text-[13px] font-bold text-[var(--color-brand)] mt-0.5">{plan.price}</p>
                          <p className="text-[12px] text-gray-500 dark:text-white/30 mt-1">{plan.features}</p>
                        </div>
                      ))}
                    </div>
                    <button className="btn-primary mt-4" onClick={() => toast("Billing upgrades coming soon!", { icon: "🚀" })}>
                      Upgrade Plan
                    </button>
                  </div>
                </Section>
              )}

              {billingTab === 'payment' && (
                <Section title="Payment Method" description="Save a card for future Membba subscription billing">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-[13px] text-amber-700 dark:text-amber-300">
                      Adding a card uses Paystack to create a reusable authorization. Paystack may charge a small authorization amount during setup.
                    </div>
                    {loadingCards ? (
                      <p className="text-[14px] text-gray-500">Loading cards…</p>
                    ) : cards.length ? (
                      <div className="space-y-2">
                        {cards.map(card => (
                          <div key={card.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/5">
                                <HiOutlineCreditCard size={20} className="text-[var(--color-brand)]" />
                              </div>
                              <div>
                                <p className="text-[14px] font-bold text-gray-900 dark:text-white">{card.brand || 'Card'} •••• {card.last4 || '----'}</p>
                                <p className="text-[12px] text-gray-400">{card.bank || 'Paystack'} · Expires {card.exp_month || '--'}/{card.exp_year || '--'} {card.is_default ? '· Default' : ''}</p>
                              </div>
                            </div>
                            <button onClick={() => removeCard(card.id)} className="btn-ghost text-[var(--color-danger)]">Remove</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 py-2">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-[8px] flex items-center justify-center">
                          <HiOutlineCreditCard size={20} className="text-gray-400 dark:text-white/25" />
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-gray-900 dark:text-white">No payment method on file</p>
                          <p className="text-[12px] text-gray-400 dark:text-white/30">Add a card to enable future Membba billing.</p>
                        </div>
                      </div>
                    )}
                    <button onClick={addCard} disabled={addingCard} className="btn-primary">
                      {addingCard ? 'Redirecting…' : 'Add Card'}
                    </button>
                  </div>
                </Section>
              )}

              {billingTab === 'history' && (
                <Section title="Billing History" description="Your past invoices and receipts">
                  <div className="py-8 text-center">
                    <p className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">No invoices yet</p>
                    <p className="text-[13px] text-gray-400 dark:text-white/30">Invoices will appear here after your first payment.</p>
                  </div>
                </Section>
              )}
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
                  className="bg-[#c8f135] hover:bg-[#d6ff4f] text-[#111] font-black px-6 py-2.5 rounded-[10px] text-[14px] transition flex items-center gap-2"
                >
                  <HiOutlineCheckCircle size={15} /> Save Preferences
                </button>
              </div>
            </>
          )}

          {/* ── INTEGRATIONS TAB ── */}
          {activeTab === "integrations" && (
            <div className="space-y-4">
              <IntegrationNav active={integrationTab} onSelect={setIntegrationTab} />

              {integrationTab === 'overview' && (
                <Section title="Connected channels" description="A simple view of what Membba can use right now. Open a specific setup area when you need to change something.">
                {(() => {
                  const waOnline = waStatus === "connected"
                  const tgOnline = Boolean(tgStatus.online)
                  const metaOnline = Boolean(metaStatus.configured)
                  const anyOnline = waOnline || tgOnline || metaOnline
                  return (
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]">
                          <span
                            className={`h-7 w-7 ${anyOnline ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`}
                            style={{ WebkitMask: "url('/bot-icon.svg') center / contain no-repeat", mask: "url('/bot-icon.svg') center / contain no-repeat" }}
                          />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Bot</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${waOnline ? 'border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]' : 'border-white/10 bg-white/5 text-gray-500'}`}>
                          <FaWhatsapp size={25} />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">WhatsApp</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${tgOnline ? 'border-[#229ED9]/30 bg-[#229ED9]/10 text-[#229ED9]' : 'border-white/10 bg-white/5 text-gray-500'}`}>
                          <FaTelegram size={25} />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Telegram</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${metaOnline ? 'border-[var(--color-success)]/30 bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'border-white/10 bg-white/5 text-gray-500'}`}>
                          <span className="font-black text-[13px]">API</span>
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Official API</span>
                      </div>
                    </div>
                  )
                })()}
              </Section>
              )}

              {/* Paystack */}
              {integrationTab === 'payments' && (
              <Section title="Paystack" description="Your payment processor — managed via Render environment variables">
                <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-[10px] px-4 py-3 text-[14px] font-mono text-gray-500 dark:text-white/25 tracking-widest border border-gray-100 dark:border-white/5">
                  sk_live_••••••••••••••••••••••••
                </div>
                <p className="text-[12px] text-gray-400 dark:text-white/25 mt-2">Change your key in Render → Environment Variables → PAYSTACK_SECRET_KEY</p>
              </Section>
              )}

              {/* Official WhatsApp API */}
              {integrationTab === 'official' && (
              <Section title="Official WhatsApp API" description="Meta Cloud API for reliable 1:1 WhatsApp messages, AI replies, invites, and reminders">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[14px] font-bold text-gray-900 dark:text-white">{metaStatus.configured ? 'Configured' : 'Not configured'}</p>
                    <p className="mt-1 text-[12px] text-gray-400 dark:text-white/30">
                      Provider mode: <span className="font-mono">{metaStatus.configured ? 'Meta available' : 'Baileys only'}</span>
                    </p>
                    {metaStatus.phone_number_id && <p className="mt-1 text-[12px] text-gray-400 dark:text-white/30 font-mono">Phone ID: {metaStatus.phone_number_id}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[12px] font-black ${metaStatus.configured ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-white/5 text-gray-400'}`}>
                    {metaStatus.configured ? 'Ready' : 'Missing env'}
                  </span>
                </div>
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-[12px] leading-relaxed text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45">
                  Webhook URL: <span className="font-mono">{window.location.origin.replace('5173', '3001')}/api/meta/webhook</span>. In production, use your Render backend URL.
                </div>
                <div className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-white/10">
                  <p className="text-[13px] font-black text-gray-900 dark:text-white">Send test message</p>
                  <p className="mt-1 text-[12px] text-gray-400 dark:text-white/35">Use this to confirm Meta Cloud API can send from Membba.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                    <input value={metaTest.to} onChange={e => setMetaTest(t => ({ ...t, to: e.target.value }))} placeholder="2348012345678" className={inputCls} />
                    <input value={metaTest.text} onChange={e => setMetaTest(t => ({ ...t, text: e.target.value }))} placeholder="Test message" className={inputCls} />
                    <button onClick={sendMetaTestMessage} disabled={!metaStatus.configured || sendingMetaTest} className="btn-primary justify-center disabled:opacity-50">
                      {sendingMetaTest ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              </Section>
              )}

              {/* Telegram */}
              {integrationTab === 'telegram' && (
              <Section title="Telegram Bot" description="Add @membba_bot to your group and make it an admin">
                <a href="https://t.me/membba_bot" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-[#229ED9]/40 text-[#229ED9] px-5 py-2.5 rounded-[10px] text-[14px] font-bold hover:bg-[#229ED9]/5 transition">
                  Open @membba_bot →
                </a>
              </Section>
              )}

              {/* WhatsApp */}
              {integrationTab === 'advanced' && (
              <Section
                title="WhatsApp advanced automation"
                description="Optional Baileys connection for group add/remove, group metadata, and invite rotation. Basic WhatsApp delivery still runs through the official Meta API."
                eyebrow="Beta channel"
              >
                <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[14px] font-black text-gray-950 dark:text-white">Baileys linked device</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-white/40">
                        QR scanning is now the recommended path when you have a second screen. Pairing code remains available for mobile-only setup.
                      </p>
                    </div>
                    <StatusChip status={waStatus === 'connected' ? 'ready' : waStatus === 'pairing_failed' || waStatus === 'logged_out' ? 'danger' : 'idle'}>
                      {waStatus === 'connected' ? 'Connected' : waStatus.replace(/_/g, ' ')}
                    </StatusChip>
                  </div>
                </div>

                {waStatus !== "connected" && (
                  <div className="mb-5">
                    {isMobileDevice && (
                      <div className="mb-3 rounded-2xl border border-[#25D366]/20 bg-[#25D366]/10 p-3 text-[13px] leading-relaxed text-gray-700 dark:text-white/70">
                        Mobile detected — pairing code is selected because you can’t scan a QR code shown on the same phone. If you have another device available, QR is more reliable.
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { id: "qr", title: "Scan QR", note: "Recommended on desktop or when another phone can scan." },
                        { id: "pairing_code", title: "Pairing code", note: "Backup for mobile-only setup. Use digits with country code." },
                      ].map(m => (
                        <button key={m.id} onClick={() => setConnectMethod(m.id)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            connectMethod === m.id
                              ? "border-[#25D366]/40 bg-[#25D366]/10 shadow-sm"
                              : "border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-black/10 dark:hover:border-white/20"
                          }`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className={`text-[14px] font-black ${connectMethod === m.id ? 'text-[#25D366]' : 'text-gray-900 dark:text-white'}`}>{m.title}</p>
                            {m.id === 'qr' && <span className="rounded-full bg-[#c8f135]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#c8f135]">Recommended</span>}
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-white/35">{m.note}</p>
                        </button>
                      ))}
                    </div>
                    {connectMethod === "pairing_code" && (
                      <div className="mt-4 space-y-3">
                        <input type="tel" value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                          placeholder="e.g. 2348012345678 (country code, no +)"
                          className={`${inputCls}`} />
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[12px] leading-relaxed text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45">
                          After getting the code: WhatsApp → Linked Devices → Link with phone number → paste the code. If WhatsApp rejects it, reset and use QR.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {waStatus === "connected" && (
                  <div className="mb-5 rounded-2xl border border-[#25D366]/20 bg-[#25D366]/5 p-4">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-black text-gray-950 dark:text-white">Advanced test center</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-white/40">Confirm the QR-linked device can send messages and inspect group invite links before relying on automation.</p>
                      </div>
                      <StatusChip status="ready">QR linked</StatusChip>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-black/20">
                        <p className="text-[12px] font-black uppercase tracking-widest text-gray-400">Test DM</p>
                        <div className="mt-3 space-y-2">
                          <input value={waTest.to} onChange={e => setWaTest(t => ({ ...t, to: e.target.value }))} placeholder="2348012345678" className={inputCls} />
                          <input value={waTest.text} onChange={e => setWaTest(t => ({ ...t, text: e.target.value }))} placeholder="Test message" className={inputCls} />
                          <button onClick={sendBaileysTestMessage} disabled={sendingWaTest} className="btn-primary w-full justify-center disabled:opacity-50">
                            {sendingWaTest ? 'Sending…' : 'Send Baileys test'}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-black/20">
                        <p className="text-[12px] font-black uppercase tracking-widest text-gray-400">Inspect group invite</p>
                        <div className="mt-3 space-y-2">
                          <input value={inviteTestLink} onChange={e => setInviteTestLink(e.target.value)} placeholder="https://chat.whatsapp.com/..." className={inputCls} />
                          <button onClick={testInviteLink} disabled={testingInvite} className="btn-secondary w-full justify-center disabled:opacity-50">
                            {testingInvite ? 'Checking…' : 'Check invite link'}
                          </button>
                          {inviteTestResult && (
                            <div className={`rounded-xl border p-3 text-[12px] leading-relaxed ${inviteTestResult.ok ? 'border-[#c8f135]/20 bg-[#c8f135]/10 text-gray-700 dark:text-white/70' : 'border-red-500/20 bg-red-500/10 text-red-500'}`}>
                              {inviteTestResult.ok ? (
                                <>
                                  <p><span className="font-black">Group:</span> {inviteTestResult.group_name || 'Valid invite link'}</p>
                                  {inviteTestResult.group_id && <p className="font-mono break-all">{inviteTestResult.group_id}</p>}
                                  {inviteTestResult.participants_count && <p>{inviteTestResult.participants_count} participants</p>}
                                  {inviteTestResult.inspect_error && <p className="text-amber-500">Inspection note: {inviteTestResult.inspect_error}</p>}
                                </>
                              ) : inviteTestResult.message}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
                    {restarting ? "Restarting…" : "↺ Restart current session"}
                  </button>
                </div>
              </Section>
              )}
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
              <div className="py-8"><p className="text-[40px] mb-3">✅</p><p className="text-[16px] font-bold text-[#c8f135]">Connected!</p></div>
            ) : waPairingCode ? (
              <div className="py-4">
                <p className="text-[13px] text-gray-500 dark:text-white/40 mb-4">WhatsApp → Linked Devices → Link with phone number → enter code:</p>
                <p className="text-[40px] font-black tracking-[0.15em] text-black dark:text-white">{waPairingCode}</p>
                {waStatus !== "needs_pairing_code" && (
                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                    Connection is refreshing in the background. Keep this code open and try it in WhatsApp. If it fails, reset and request a new code.
                  </div>
                )}
                <div className="mt-5 grid grid-cols-1 gap-2">
                  <button onClick={copyPairingCode} className="btn-primary w-full justify-center">{copiedPairing ? 'Copied' : 'Copy Code'}</button>
                  <button onClick={openWhatsAppApp} className="btn-secondary w-full justify-center">Open WhatsApp</button>
                  <button onClick={handleResetAndReconnectWhatsApp} disabled={restarting} className="btn-secondary w-full justify-center">{restarting ? 'Requesting…' : 'Reset and get new code'}</button>
                </div>
                <p className="mt-4 text-[12px] leading-relaxed text-gray-500 dark:text-white/35">If WhatsApp does not open directly, open it manually and go to Linked Devices.</p>
              </div>
            ) : (waStatus === "pairing_failed" || waStatus === "logged_out") ? (
              <div className="py-6">
                <p className="text-[34px] mb-3">⚠️</p>
                <p className="text-[16px] font-bold text-red-400">WhatsApp connection needs reset</p>
                <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-white/45">{waError || 'The saved WhatsApp session is stale or logged out. Reset it, then request a new pairing code.'}</p>
                <div className="mt-5 grid gap-2">
                  <button onClick={handleResetAndReconnectWhatsApp} disabled={restarting} className="btn-primary w-full justify-center">{restarting ? 'Requesting…' : 'Reset and get new code'}</button>
                  <button onClick={closeQRModal} className="btn-secondary w-full justify-center">Close</button>
                </div>
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
                <p className="mt-1 max-w-xs text-center text-[12px] text-gray-500 dark:text-white/25">If this takes more than 20 seconds, close this and use Reset WhatsApp session before trying again.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
