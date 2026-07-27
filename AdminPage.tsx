import { useState, useEffect, useCallback, useRef } from "react";
import { api, USER_TYPE_LABELS, type UserType } from "@/lib/api";
import { GEM_POSTS, GEM_CATEGORIES, type GemPost } from "@/data/gemPosts";
import CsvImportModal, { type ImportedProspect } from "@/components/CsvImportModal";

type AdminView = "dashboard" | "users" | "verifications" | "listings" | "transactions" | "subscriptions" | "support" | "blogs" | "referrals" | "comms" | "featured" | "auctions" | "crm" | "sales_team" | "disputes" | "settings";

const API = "/api";

function adminFetch(path: string, adminId: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", "x-admin-id": adminId },
    ...opts,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data as { error?: string }).error ?? r.statusText);
    return data;
  });
}

type DataRow = Record<string, unknown>;

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    gray: "bg-slate-100 text-slate-600 border-slate-200",
    purple: "bg-violet-50 text-violet-700 border-violet-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${map[color] ?? map.gray}`}>
      {children}
    </span>
  );
}

function StatCard({ label, valueStr, sub, color, icon }: { label: string; valueStr: string; sub?: string; color: string; icon?: string }) {
  const iconBg: Record<string, string> = {
    blue:   "bg-blue-50 text-blue-600",
    green:  "bg-emerald-50 text-emerald-600",
    purple: "bg-violet-50 text-violet-600",
    amber:  "bg-amber-50 text-amber-600",
    red:    "bg-red-50 text-red-600",
    slate:  "bg-slate-100 text-slate-500",
  };
  return (
    <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-2">{label}</p>
          <p className="text-2xl font-bold text-[#1a1a1a] leading-tight">{valueStr}</p>
          {sub && <p className="text-xs text-[#9ca3af] mt-1">{sub}</p>}
        </div>
        {icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${iconBg[color] ?? iconBg.slate}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }}>
      <div ref={ref} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#e5e7eb]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h3 className="font-semibold text-sm text-[#1a1a1a]">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#6b7280] hover:text-[#1a1a1a] flex items-center justify-center text-sm font-bold transition-colors">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }: { onLogin: (id: string, name: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      const data = await fetch(`${API}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? r.statusText);
        return d;
      });
      onLogin(data.id, data.name);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#f5f8fa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-12 h-12 bg-[#FF7A59] rounded-xl mx-auto flex items-center justify-center text-2xl mb-4 shadow-sm">
            💎
          </div>
          <h1 className="text-xl font-bold text-[#1a1a1a]">Log in to your account</h1>
          <p className="text-sm text-[#6b7280] mt-1">LuckyBirthstone Admin Portal</p>
        </div>
        <div className="bg-white border border-[#e5e7eb] rounded-xl shadow-sm p-7">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Email address</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoFocus
                className="w-full border border-[#d1d5db] rounded-lg px-3.5 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#FF7A59]/30 focus:border-[#FF7A59] transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
                className="w-full border border-[#d1d5db] rounded-lg px-3.5 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#FF7A59]/30 focus:border-[#FF7A59] transition" />
            </div>
            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{err}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-[#FF7A59] hover:bg-[#e8603f] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm mt-1">
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-[#9ca3af] mt-4">Restricted access — authorized personnel only</p>
      </div>
    </div>
  );
}

function AdminSidebar({ view, setView, adminName, unread, onLogout }: {
  view: AdminView; setView: (v: AdminView) => void; adminName: string; unread: number; onLogout: () => void;
}) {
  const groups = [
    {
      label: "Overview",
      items: [
        { id: "dashboard" as AdminView, icon: "▣", label: "Dashboard", badge: unread > 0 ? unread : null },
      ],
    },
    {
      label: "Marketplace",
      items: [
        { id: "users" as AdminView, icon: "◎", label: "Users" },
        { id: "verifications" as AdminView, icon: "◈", label: "Verifications" },
        { id: "listings" as AdminView, icon: "◆", label: "Listings" },
        { id: "transactions" as AdminView, icon: "◉", label: "Transactions" },
        { id: "subscriptions" as AdminView, icon: "◐", label: "Plans" },
        { id: "referrals" as AdminView, icon: "◑", label: "Referrals" },
      ],
    },
    {
      label: "Engagement",
      items: [
        { id: "comms" as AdminView, icon: "◈", label: "Broadcast" },
        { id: "crm" as AdminView, icon: "◎", label: "CRM" },
        { id: "sales_team" as AdminView, icon: "◑", label: "Sales Team" },
        { id: "featured" as AdminView, icon: "◆", label: "Featured Listings" },
        { id: "auctions" as AdminView, icon: "◉", label: "Auction Listings" },
        { id: "disputes" as AdminView, icon: "⚑", label: "Disputes" },
        { id: "support" as AdminView, icon: "◐", label: "Support" },
        { id: "blogs" as AdminView, icon: "◑", label: "Blogs" },
      ],
    },
    {
      label: "System",
      items: [
        { id: "settings" as AdminView, icon: "◑", label: "Settings" },
      ],
    },
  ];

  return (
    <aside className="w-56 shrink-0 bg-[#1b1c1e] text-white flex flex-col min-h-screen">
      {/* Logo / Brand */}
      <div className="px-4 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#FF7A59] rounded-lg flex items-center justify-center text-sm shrink-0">
            💎
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-white leading-tight truncate">LuckyBirthstone</p>
            <p className="text-[10px] text-[#8b8d98] font-medium">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="text-[10px] font-semibold text-[#5e6070] uppercase tracking-widest px-2 mb-1">{g.label}</p>
            <div className="space-y-px">
              {g.items.map((s) => {
                const active = view === s.id;
                return (
                  <button key={s.id} onClick={() => setView(s.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all text-left group relative ${
                      active
                        ? "bg-white/10 text-white font-medium"
                        : "text-[#8b8d98] hover:bg-white/6 hover:text-white font-normal"
                    }`}>
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[#FF7A59] rounded-r-sm" />}
                    <span className="flex-1 pl-1">{s.label}</span>
                    {"badge" in s && s.badge != null && (
                      <span className="ml-auto bg-[#FF7A59] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{s.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Admin identity + footer */}
      <div className="px-2 pb-4 border-t border-white/8 pt-3 space-y-px">
        <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
          <div className="w-6 h-6 bg-[#FF7A59] rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{adminName}</p>
            <p className="text-[10px] text-[#5e6070]">Super Admin</p>
          </div>
        </div>
        <a href="/" className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#8b8d98] hover:text-white hover:bg-white/6 transition-colors w-full">
          ↗ View Marketplace
        </a>
        <button onClick={onLogout}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#8b8d98] hover:text-[#FF7A59] hover:bg-white/6 transition-colors w-full">
          ⏻ Sign out
        </button>
      </div>
    </aside>
  );
}

function AdminDashboard({ adminId, onUnreadChange }: { adminId: string; onUnreadChange: (n: number) => void }) {
  const [stats, setStats] = useState<DataRow | null>(null);
  const [notifs, setNotifs] = useState<DataRow[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    adminFetch("/admin/dashboard", adminId).then((d) => {
      setStats(d);
      onUnreadChange((d as DataRow).unread_notifications as number ?? 0);
    }).catch((e) => setErr(e.message));
    adminFetch("/admin/notifications?limit=8", adminId).then(setNotifs).catch(() => {});
  }, [adminId, onUnreadChange]);

  useEffect(() => { load(); }, [load]);

  async function markAllRead() {
    await adminFetch("/admin/notifications/read-all", adminId, { method: "POST" });
    load();
  }

  if (err) return <div className="p-8 text-destructive">{err}</div>;
  if (!stats) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const alerts = (stats.alerts as { type: string; icon: string; message: string }[]) ?? [];

  const notifIcon: Record<string, string> = {
    new_user: "👤", new_listing: "💎", overdue_payment: "💰",
    subscription_expiry: "📋", verification_approved: "✅", verification_rejected: "❌",
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
        <StatCard icon="👥" label="Total Users" valueStr={String(stats.total_users as number)} sub="Registered accounts" color="blue" />
        <StatCard icon="✅" label="Verified" valueStr={String(stats.verified_users as number)} sub="Basic or premium" color="green" />
        <StatCard icon="📋" label="Active Plans" valueStr={String(stats.active_subscriptions as number)} sub="All plan holders" color="purple" />
        <StatCard icon="💎" label="Listings" valueStr={String(stats.total_listings as number)} sub="Active inventory" color="amber" />
        <StatCard icon="💰" label="Overdue" valueStr={`$${((stats.overdue_payments_usd as number) ?? 0).toLocaleString()}`} sub={`${stats.overdue_transactions as number} transactions`} color={(stats.overdue_payments_usd as number) > 0 ? "red" : "slate"} />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
              a.type === "danger" ? "bg-red-50 border-red-200 text-red-700" :
              a.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-700" :
              "bg-indigo-50 border-indigo-200 text-indigo-700"
            }`}>
              <span className="text-lg shrink-0">{a.icon}</span>
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Recent Activity</h3>
          {notifs.some((n) => !(n.read as boolean)) && (
            <button onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">Mark all read</button>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
          {notifs.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">No recent activity</div>
          ) : notifs.map((n) => (
            <div key={n.id as string} className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${!(n.read as boolean) ? "bg-indigo-50/40" : "hover:bg-slate-50/60"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 ${!(n.read as boolean) ? "bg-indigo-100" : "bg-slate-100"}`}>
                {notifIcon[n.type as string] ?? "🔔"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{n.title as string}</p>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{n.message as string}</p>
              </div>
              <span className="text-xs text-slate-400 shrink-0 mt-0.5">{new Date(n.created_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PLAN_OPTIONS = [
  { value: "basic",   label: "Basic",   color: "bg-slate-100 text-slate-700" },
  { value: "pro",     label: "Pro",     color: "bg-blue-100 text-blue-700" },
  { value: "premium", label: "Premium", color: "bg-violet-100 text-violet-700" },
];

const VERIF_OPTIONS = [
  { value: "unverified",     label: "Unverified",      color: "gray" },
  { value: "basic_verified", label: "Basic Verified",   color: "green" },
  { value: "verified",       label: "Verified",         color: "blue" },
  { value: "legacy_verified",label: "Legacy Verified",  color: "purple" },
];

function AdminUsers({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterVerif, setFilterVerif] = useState("");
  const [toast, setToast] = useState("");
  const [profileUser, setProfileUser] = useState<DataRow | null>(null);
  const [modalPlan, setModalPlan] = useState("basic");
  const [modalTier, setModalTier] = useState("basic_verified");
  const [modalCredits, setModalCredits] = useState(5);
  const [modalLoading, setModalLoading] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", contact_number: "", company_name: "", owner_name: "", address: "", city: "", country: "", website: "", company_description: "" });
  const [trustForm, setTrustForm] = useState({ deals_completed: 0, on_time_payments: 0, delayed_payments: 0, disputes_count: 0, response_rate: 0, endorsements_count: 0 });

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filterType) p.set("user_type", filterType);
    if (filterVerif) p.set("verification_status", filterVerif);
    adminFetch(`/admin/users?${p}`, adminId)
      .then((d) => { setUsers(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminId, filterType, filterVerif]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3500); }

  function openProfile(u: DataRow) {
    setProfileUser(u);
    setModalPlan(u.subscription_plan as string || "basic");
    setModalTier(u.verification_status as string === "unverified" ? "basic_verified" : u.verification_status as string || "basic_verified");
    setModalCredits(5);
    setModalLoading(null);
    setProfileForm({
      name: (u.name as string) || "",
      email: (u.email as string) || "",
      contact_number: (u.contact_number as string) || "",
      company_name: (u.company_name as string) || "",
      owner_name: (u.owner_name as string) || "",
      address: (u.address as string) || "",
      city: (u.city as string) || "",
      country: (u.country as string) || "",
      website: (u.website as string) || "",
      company_description: (u.company_description as string) || "",
    });
    setTrustForm({
      deals_completed: (u.deals_completed as number) || 0,
      on_time_payments: (u.on_time_payments as number) || 0,
      delayed_payments: (u.delayed_payments as number) || 0,
      disputes_count: (u.disputes_count as number) || 0,
      response_rate: (u.response_rate as number) || 0,
      endorsements_count: (u.endorsements_count as number) || 0,
    });
  }

  async function upgradePlan(userId: string, plan: string) {
    try {
      await adminFetch(`/admin/users/${userId}/plan`, adminId, { method: "PATCH", body: JSON.stringify({ plan }) });
      showToast(`✅ Plan updated to ${plan}`);
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
  }

  async function updateVerif(userId: string, tier: string) {
    setModalLoading("verif");
    try {
      if (tier === "unverified") {
        await adminFetch(`/admin/users/${userId}/verification`, adminId, { method: "PATCH", body: JSON.stringify({ action: "reject" }) });
        showToast("✓ Verification cleared");
      } else {
        await adminFetch(`/admin/users/${userId}/verification`, adminId, { method: "PATCH", body: JSON.stringify({ action: "approve", tier }) });
        showToast(`✅ Badge set to ${tier.replace(/_/g, " ")}`);
      }
      load();
      setProfileUser((prev) => prev ? { ...prev, verification_status: tier, verification_badge: tier } : null);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
    finally { setModalLoading(null); }
  }

  async function addCredits(userId: string, amount: number) {
    setModalLoading("credits");
    try {
      await adminFetch(`/admin/users/${userId}/credits`, adminId, { method: "POST", body: JSON.stringify({ amount }) });
      showToast(`✅ Added ${amount} listing credit${amount !== 1 ? "s" : ""}`);
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
    finally { setModalLoading(null); }
  }

  async function doBlock(userId: string, action: "block" | "unblock") {
    try {
      await api.adminBlockUser(adminId, userId, action);
      showToast(action === "block" ? "🚫 User blocked" : "🔓 User unblocked");
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
  }

  const verifColor = (s: string) =>
    s === "legacy_verified" ? "purple" : s === "verified" ? "blue" : s === "basic_verified" ? "green" : "gray";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-bold">User Management</h2>
        <div className="flex items-center gap-3">
          {toast && <div className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">{toast}</div>}
          <button
            onClick={async () => {
              try {
                const r = await adminFetch("/admin/trust-scores/recalculate-all", adminId, { method: "POST" });
                showToast(`✅ Recalculated ${(r as { total_users: number }).total_users} users (${(r as { updated: number }).updated} changed)`);
                load();
              } catch { showToast("❌ Recalculation failed"); }
            }}
            className="text-xs px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg font-semibold hover:bg-primary/20 transition-colors"
          >
            🔄 Recalculate All Trust Scores
          </button>
        </div>
      </div>
      <div className="flex gap-3 mb-5 flex-wrap">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="form-select text-sm">
          <option value="">All Types</option>
          {["b2b_trader", "retailer", "miner", "manufacturer", "gems_lab"].map((t) => (
            <option key={t} value={t}>{USER_TYPE_LABELS[t as UserType] ?? t}</option>
          ))}
        </select>
        <select value={filterVerif} onChange={(e) => setFilterVerif(e.target.value)} className="form-select text-sm">
          <option value="">All Statuses</option>
          <option value="unverified">Unverified</option>
          <option value="basic_verified">Basic Verified</option>
          <option value="verified">Verified</option>
          <option value="legacy_verified">Legacy Verified</option>
        </select>
      </div>
      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[780px]">
          <thead className="bg-slate-50 border-b border-border">
            <tr>{["Name / Company", "Mobile", "Type", "Verification", "Trust", "Plan", "Credits", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id as string} className="border-b border-border last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name as string}</div>
                  <div className="text-xs text-muted-foreground">{(u.company_name as string) || (u.email as string)}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">{(u.contact_number as string) || <span className="text-slate-300">—</span>}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge color="blue">{(u.user_type as string).replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge color={verifColor(u.verification_status as string)}>
                    {(u.verification_status as string).replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const score = (u.trust_score as number) ?? 0;
                    const color = score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-red-500";
                    return (
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${score}%` }} />
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${color}`}>{score}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <select value={u.subscription_plan as string}
                    onChange={(e) => upgradePlan(u.id as string, e.target.value)}
                    className="form-select text-xs py-1">
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {(u.extra_listing_credits as number) ?? 0}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => openProfile(u)}
                      className="text-xs px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-border rounded-md font-medium">👁 Manage</button>
                    {(u.is_blocked as boolean) ? (
                      <button onClick={() => doBlock(u.id as string, "unblock")}
                        className="text-xs px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-medium">🔓 Unblock</button>
                    ) : (
                      <button onClick={() => doBlock(u.id as string, "block")}
                        className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md font-medium">🚫 Block</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {profileUser && (
        <Modal title={`Manage: ${profileUser.name as string}`} onClose={() => setProfileUser(null)}>
          {/* ── Profile Info (editable) ── */}
          <div className="bg-slate-50 rounded-xl p-4 border border-border mb-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Profile Information</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["Full Name", "name"],
                ["Email", "email"],
                ["Mobile / WhatsApp", "contact_number"],
                ["Company Name", "company_name"],
                ["Owner / Rep Name", "owner_name"],
                ["Website", "website"],
                ["Address", "address"],
                ["City", "city"],
                ["Country", "country"],
              ] as [string, keyof typeof profileForm][]).map(([label, field]) => (
                <div key={field} className={field === "address" || field === "website" ? "col-span-2" : ""}>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
                  <input
                    value={profileForm[field]}
                    onChange={(e) => setProfileForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-300/40 bg-white"
                    placeholder={label}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground font-medium block mb-1">Company Description</label>
                <textarea
                  value={profileForm.company_description}
                  onChange={(e) => setProfileForm((f) => ({ ...f, company_description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-300/40 bg-white resize-none"
                  placeholder="Short company description…"
                />
              </div>
            </div>
            {(profileUser.trade_license_document_url as string) && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground font-medium">Trade License:</span>
                <a href={profileUser.trade_license_document_url as string} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">📄 View</a>
              </div>
            )}
            {(profileUser.government_id_document_url as string) && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Gov ID:</span>
                <a href={profileUser.government_id_document_url as string} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">📄 View</a>
              </div>
            )}
            <div className="flex items-center gap-3 pt-1 border-t border-border">
              <button
                onClick={async () => {
                  setModalLoading("profile");
                  try {
                    await adminFetch(`/admin/users/${profileUser.id as string}/profile`, adminId, {
                      method: "PATCH",
                      body: JSON.stringify(profileForm),
                    });
                    setProfileUser((prev) => prev ? { ...prev, ...profileForm } : null);
                    setUsers((prev) => prev.map((u) => u.id === profileUser.id ? { ...u, ...profileForm } : u));
                    showToast("✅ Profile updated");
                  } catch {
                    showToast("❌ Failed to update profile");
                  } finally {
                    setModalLoading(null);
                  }
                }}
                disabled={modalLoading === "profile"}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {modalLoading === "profile" ? "Saving…" : "Save Profile"}
              </button>
              <div className="text-xs text-muted-foreground">
                Joined {new Date(profileUser.created_at as string).toLocaleDateString()} · {(profileUser.user_type as string).replace("_", " ")} · ⭐ {(profileUser.rating as number).toFixed(1)} ({profileUser.total_reviews as number} reviews)
              </div>
            </div>
          </div>

          {/* ── Trust Score Management ── */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trust Score</p>
              <span className={`text-lg font-bold ${(profileUser.trust_score as number) >= 70 ? "text-emerald-600" : (profileUser.trust_score as number) >= 40 ? "text-amber-600" : "text-red-500"}`}>
                {(profileUser.trust_score as number) ?? 0}/100
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-3">Adjust trust factor data — score recalculates automatically on save.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ["Deals Completed", "deals_completed", "30% weight"],
                  ["On-Time Payments", "on_time_payments", "30% weight (ratio)"],
                  ["Delayed Payments", "delayed_payments", "−10 pts each"],
                  ["Disputes", "disputes_count", "−20 pts each"],
                  ["Response Rate (%)", "response_rate", "10% weight"],
                  ["Endorsements", "endorsements_count", "20% weight"],
                ] as [string, keyof typeof trustForm, string][]).map(([label, field, hint]) => (
                  <div key={field}>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
                    <input
                      type="number"
                      min="0"
                      max={field === "response_rate" ? 100 : undefined}
                      value={trustForm[field]}
                      onChange={(e) => setTrustForm((f) => ({ ...f, [field]: Number(e.target.value) }))}
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-300/40 bg-white"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={async () => {
                  setModalLoading("trust");
                  try {
                    const result = await adminFetch(`/admin/users/${profileUser.id as string}/trust-stats`, adminId, {
                      method: "PATCH",
                      body: JSON.stringify(trustForm),
                    });
                    const newScore = (result as { trust_score: number }).trust_score;
                    setProfileUser((prev) => prev ? { ...prev, trust_score: newScore, ...trustForm } : null);
                    setUsers((prev) => prev.map((u) => u.id === profileUser.id ? { ...u, trust_score: newScore, ...trustForm } : u));
                    showToast(`✅ Trust score updated → ${newScore}/100`);
                  } catch { showToast("❌ Failed to update trust stats"); }
                  finally { setModalLoading(null); }
                }}
                disabled={modalLoading === "trust"}
                className="mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {modalLoading === "trust" ? "Recalculating…" : "Save & Recalculate"}
              </button>
            </div>
          </div>

          {/* ── Account Management ── */}
          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Management</p>

            {/* Plan */}
            <div className="bg-slate-50 rounded-xl p-4 border border-border">
              <p className="text-xs font-semibold text-foreground mb-2">📋 Subscription Plan</p>
              <div className="text-xs text-muted-foreground mb-3">
                Current: <span className="font-semibold text-foreground capitalize">{profileUser.subscription_plan as string}</span>
              </div>
              <div className="flex gap-2">
                <select value={modalPlan} onChange={(e) => setModalPlan(e.target.value)}
                  className="form-select text-sm flex-1">
                  {PLAN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    setModalLoading("plan");
                    await upgradePlan(profileUser.id as string, modalPlan);
                    setProfileUser((prev) => prev ? { ...prev, subscription_plan: modalPlan } : null);
                    setModalLoading(null);
                  }}
                  disabled={modalLoading === "plan"}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {modalLoading === "plan" ? "…" : "Update Plan"}
                </button>
              </div>
            </div>

            {/* WhatsApp opt-in override */}
            <div className="bg-slate-50 rounded-xl p-4 border border-border">
              <p className="text-xs font-semibold text-foreground mb-2">💬 WhatsApp Opt-In</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Status: <span className={`font-semibold ${(profileUser.whatsapp_opt_in as boolean) !== false ? "text-green-700" : "text-red-600"}`}>
                      {(profileUser.whatsapp_opt_in as boolean) !== false ? "✅ Opted in" : "❌ Not opted in"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Override the user's opt-in status directly.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      setModalLoading("wa_optin");
                      try {
                        await adminFetch(`/admin/users/${profileUser.id as string}/whatsapp-optin`, adminId, {
                          method: "PATCH",
                          body: JSON.stringify({ opt_in: true }),
                        });
                        setProfileUser((prev) => prev ? { ...prev, whatsapp_opt_in: true } : null);
                        setUsers((prev) => prev.map((u) => u.id === profileUser.id ? { ...u, whatsapp_opt_in: true } : u));
                        showToast("✅ WhatsApp opt-in enabled");
                      } catch { showToast("❌ Failed"); }
                      finally { setModalLoading(null); }
                    }}
                    disabled={!!modalLoading || (profileUser.whatsapp_opt_in as boolean) !== false}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-40"
                  >
                    {modalLoading === "wa_optin" ? "…" : "Opt In"}
                  </button>
                  <button
                    onClick={async () => {
                      setModalLoading("wa_optout");
                      try {
                        await adminFetch(`/admin/users/${profileUser.id as string}/whatsapp-optin`, adminId, {
                          method: "PATCH",
                          body: JSON.stringify({ opt_in: false }),
                        });
                        setProfileUser((prev) => prev ? { ...prev, whatsapp_opt_in: false } : null);
                        setUsers((prev) => prev.map((u) => u.id === profileUser.id ? { ...u, whatsapp_opt_in: false } : u));
                        showToast("⚠️ WhatsApp opt-out set");
                      } catch { showToast("❌ Failed"); }
                      finally { setModalLoading(null); }
                    }}
                    disabled={!!modalLoading || (profileUser.whatsapp_opt_in as boolean) === false}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 font-semibold hover:bg-red-100 transition-colors disabled:opacity-40"
                  >
                    {modalLoading === "wa_optout" ? "…" : "Opt Out"}
                  </button>
                </div>
              </div>
            </div>

            {/* Verification */}
            <div className="bg-slate-50 rounded-xl p-4 border border-border">
              <p className="text-xs font-semibold text-foreground mb-2">🔍 Verification Badge</p>
              <div className="text-xs text-muted-foreground mb-3">
                Current: <span className="font-semibold text-foreground">{(profileUser.verification_status as string).replace(/_/g, " ")}</span>
                {(profileUser.verification_badge as string) && (profileUser.verification_badge as string) !== "none" && (
                  <> · Badge: <span className="font-semibold">{(profileUser.verification_badge as string).replace(/_/g, " ")}</span></>
                )}
              </div>
              <div className="flex gap-2">
                <select value={modalTier} onChange={(e) => setModalTier(e.target.value)}
                  className="form-select text-sm flex-1">
                  {VERIF_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => updateVerif(profileUser.id as string, modalTier)}
                  disabled={modalLoading === "verif"}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {modalLoading === "verif" ? "…" : "Set Badge"}
                </button>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <button onClick={() => { setModalTier("basic_verified"); updateVerif(profileUser.id as string, "basic_verified"); }}
                  disabled={!!modalLoading}
                  className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 font-medium hover:bg-green-100 transition-colors disabled:opacity-50">
                  ✓ Basic
                </button>
                <button onClick={() => { setModalTier("verified"); updateVerif(profileUser.id as string, "verified"); }}
                  disabled={!!modalLoading}
                  className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-medium hover:bg-blue-100 transition-colors disabled:opacity-50">
                  ✓ Verified
                </button>
                <button onClick={() => { setModalTier("legacy_verified"); updateVerif(profileUser.id as string, "legacy_verified"); }}
                  disabled={!!modalLoading}
                  className="text-xs px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 font-medium hover:bg-violet-100 transition-colors disabled:opacity-50">
                  ★ Legacy
                </button>
                <button onClick={() => { setModalTier("unverified"); updateVerif(profileUser.id as string, "unverified"); }}
                  disabled={!!modalLoading}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 font-medium hover:bg-red-100 transition-colors disabled:opacity-50">
                  ✕ Clear
                </button>
              </div>
            </div>

            {/* Credits */}
            <div className="bg-slate-50 rounded-xl p-4 border border-border">
              <p className="text-xs font-semibold text-foreground mb-2">🎫 Listing Credits</p>
              <div className="text-xs text-muted-foreground mb-3">
                Current extra credits: <span className="font-semibold text-foreground">{(profileUser.extra_listing_credits as number) ?? 0}</span>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={modalCredits}
                  onChange={(e) => setModalCredits(Math.max(1, parseInt(e.target.value) || 1))}
                  className="border border-border rounded-xl px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground">credits to add</span>
                <button
                  onClick={() => addCredits(profileUser.id as string, modalCredits)}
                  disabled={modalLoading === "credits"}
                  className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 ml-auto"
                >
                  {modalLoading === "credits" ? "…" : "+ Add Credits"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminVerifications({ adminId }: { adminId: string }) {
  const [items, setItems] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("pending");

  const load = useCallback(() => {
    setLoading(true);
    adminFetch(`/admin/verifications?status=${filter}`, adminId)
      .then((d) => { setItems(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminId, filter]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function doVerif(userId: string, action: "approve" | "reject", tier?: string) {
    try {
      await adminFetch(`/admin/users/${userId}/verification`, adminId, {
        method: "PATCH",
        body: JSON.stringify({ action, tier }),
      });
      showToast(action === "approve" ? `✅ Approved as ${tier?.replace("_", " ")}` : "⚠ Verification rejected");
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
  }

  const statusColor = (s: string) => s === "premium_verified" ? "purple" : s === "basic_verified" ? "green" : "gray";

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Verification Review</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Review KYC documents and approve or reject user verification requests</p>
        </div>
        <div className="flex items-center gap-2">
          {toast && <div className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">{toast}</div>}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {[["pending", "⏳ Pending"], ["unverified", "Unverified"], ["", "All"]].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === val ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <span className="text-4xl block mb-3">{filter === "pending" ? "⏳" : "✅"}</span>
          <p className="font-medium">{filter === "pending" ? "No pending verification requests" : "No verifications to review"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((u) => (
            <div key={u.id as string} className={`bg-white border rounded-2xl p-6 ${(u.requested_tier as string) ? "border-amber-200 ring-1 ring-amber-100" : "border-border"}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-base">{u.company_name as string || u.name as string}</h3>
                    <Badge color={statusColor(u.verification_status as string)}>{(u.verification_status as string).replace("_", " ")}</Badge>
                    {!!(u.requested_tier) && <Badge color="orange">⏳ Requested: {(u.requested_tier as string).replace("_", " ")}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{u.name as string} · {(u.user_type as string).replace("_", " ")} · {u.email as string}</p>
                  {(u.address as string) && <p className="text-xs text-muted-foreground mt-0.5">📍 {u.address as string}</p>}
                  {(u.owner_name as string) && <p className="text-xs text-muted-foreground mt-0.5">👤 Owner: {u.owner_name as string}</p>}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  {(u.verification_requested_at as string) && (
                    <div className="text-xs text-muted-foreground">
                      Submitted: {new Date(u.verification_requested_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                  {(u.verification_payment_amount as number) !== null && (u.verification_payment_amount as number) !== undefined && (
                    <div className={`text-sm font-bold ${(u.verification_payment_amount as number) === 0 ? "text-emerald-600" : "text-foreground"}`}>
                      {(u.verification_payment_amount as number) === 0 ? "FREE (Early Access)" : `$${u.verification_payment_amount as number} paid`}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Joined {new Date(u.created_at as string).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Trade License</p>
                  {u.trade_license_number ? (
                    <p className="text-sm font-medium mb-2"># {u.trade_license_number as string}</p>
                  ) : <p className="text-sm text-muted-foreground mb-2 italic">Number not provided</p>}
                  {(u.trade_license_document_url as string) ? (
                    <a href={u.trade_license_document_url as string} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium underline">📄 View Document</a>
                  ) : <span className="text-xs text-amber-600 font-medium">⚠ No document uploaded</span>}
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Government ID</p>
                  {u.government_id_number ? (
                    <p className="text-sm font-medium mb-2"># {u.government_id_number as string}</p>
                  ) : <p className="text-sm text-muted-foreground mb-2 italic">Number not provided</p>}
                  {(u.government_id_document_url as string) ? (
                    <a href={u.government_id_document_url as string} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium underline">📄 View Document</a>
                  ) : <span className="text-xs text-amber-600 font-medium">⚠ No document uploaded</span>}
                </div>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap items-center">
                {(u.verification_status as string) !== "premium_verified" && (
                  <>
                    <button onClick={() => doVerif(u.id as string, "approve", "basic_verified")}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
                      ✓ Approve Basic
                    </button>
                    <button onClick={() => doVerif(u.id as string, "approve", "premium_verified")}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-colors">
                      ★ Approve Premium
                    </button>
                  </>
                )}
                {(u.verification_status as string) !== "unverified" && (
                  <button onClick={() => doVerif(u.id as string, "reject")}
                    className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition-colors">
                    ✕ Reject & Remove Badge
                  </button>
                )}
                {(u.verification_status as string) === "unverified" && !(u.requested_tier) && (
                  <button onClick={() => doVerif(u.id as string, "approve", "basic_verified")}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors">
                    ✓ Grant Basic (Manual)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminListings({ adminId }: { adminId: string }) {
  const [listings, setListings] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [toast, setToast] = useState("");
  const [editListing, setEditListing] = useState<DataRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string,string>>({});
  const [editErr, setEditErr] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const p = filterStatus ? `?status=${filterStatus}` : "";
    adminFetch(`/admin/listings${p}`, adminId)
      .then((d) => { setListings(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminId, filterStatus]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function openEdit(g: DataRow) {
    setEditForm({
      stone_type: String(g.stone_type ?? ""),
      carat: String(g.carat ?? ""),
      origin: String(g.origin ?? ""),
      treatment: String(g.treatment ?? ""),
      color: String(g.color ?? ""),
      clarity: String(g.clarity ?? ""),
      price: String(g.price ?? ""),
      currency: String(g.currency ?? "USD"),
      certificate_number: String(g.certificate_number ?? ""),
    });
    setEditErr("");
    setEditListing(g);
  }

  async function saveEdit() {
    if (!editListing) return;
    setEditErr("");
    try {
      const body: Record<string,unknown> = {
        stone_type: editForm.stone_type,
        carat: parseFloat(editForm.carat),
        origin: editForm.origin,
        treatment: editForm.treatment,
        price: parseFloat(editForm.price),
        currency: editForm.currency,
        certificate_number: editForm.certificate_number,
      };
      if (editForm.color) body.color = editForm.color;
      if (editForm.clarity) body.clarity = editForm.clarity;
      await api.adminEditListing(adminId, editListing.id as string, body);
      showToast("✅ Listing updated");
      setEditListing(null);
      load();
    } catch (e: unknown) { setEditErr(e instanceof Error ? e.message : "Error"); }
  }

  async function doAction(id: string, action: string) {
    try {
      await adminFetch(`/admin/listings/${id}`, adminId, { method: "PUT", body: JSON.stringify({ action }) });
      showToast(`Listing ${action}d`);
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
  }

  async function doDelete(id: string) {
    try {
      await api.adminDeleteListing(adminId, id);
      showToast("✅ Listing permanently deleted");
      setDeleteConfirmId(null);
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Delete failed"); }
  }

  const statusColor = (s?: string) => s === "removed" ? "red" : s === "pending" ? "yellow" : "green";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Listing Moderation</h2>
        {toast && <div className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">{toast}</div>}
      </div>
      <div className="flex gap-3 mb-5">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select text-sm">
          <option value="">All Listings</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="removed">Removed</option>
        </select>
      </div>
      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-slate-50 border-b border-border">
            <tr>{["Gem / Cert", "Seller", "Price", "Status", "Featured", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : listings.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No listings</td></tr>
            ) : listings.map((g) => {
              const status = (g.listing_status as string) ?? "approved";
              return (
                <tr key={g.id as string} className="border-b border-border last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{g.stone_type as string} · {g.carat as number}ct</div>
                    <div className="text-xs text-muted-foreground">{g.origin as string} · #{g.certificate_number as string}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{g.seller_name as string}</div>
                    <div className="text-xs text-muted-foreground">{g.seller_email as string}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{g.currency as string} {(g.price as number).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge color={statusColor(status)}>{status}</Badge></td>
                  <td className="px-4 py-3"><Badge color={(g.is_featured as boolean) ? "amber" : "gray"}>{(g.is_featured as boolean) ? "⭐" : "—"}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => openEdit(g)} className="text-xs px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-border rounded-md font-medium">✏ Edit</button>
                      {status !== "approved" && <button onClick={() => doAction(g.id as string, "approve")} className="text-xs px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-medium">✓ Approve</button>}
                      {!(g.is_featured as boolean) && <button onClick={() => doAction(g.id as string, "feature")} className="text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md font-medium">⭐ Feature</button>}
                      {status !== "removed" && <button onClick={() => doAction(g.id as string, "remove")} className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md font-medium">🗑 Remove</button>}
                      {deleteConfirmId === (g.id as string) ? (
                        <>
                          <button onClick={() => setDeleteConfirmId(null)} className="text-xs px-2 py-1 border border-border rounded-md font-medium text-muted-foreground hover:text-foreground">Cancel</button>
                          <button onClick={() => doDelete(g.id as string)} className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white border border-red-700 rounded-md font-semibold">Confirm Delete</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(g.id as string)} className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded-md font-medium">🗑 Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editListing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditListing(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Edit Listing — Admin</h3>
            <div className="space-y-3">
              {[
                { k: "stone_type", label: "Stone Type" },
                { k: "carat", label: "Carat", type: "number" },
                { k: "origin", label: "Origin" },
                { k: "treatment", label: "Treatment" },
                { k: "color", label: "Color (Diamond)" },
                { k: "clarity", label: "Clarity (Diamond)" },
                { k: "price", label: "Price", type: "number" },
                { k: "certificate_number", label: "Certificate #" },
              ].map(({ k, label, type }) => (
                <div key={k}>
                  <label className="block text-xs font-medium mb-1">{label}</label>
                  <input
                    value={editForm[k] ?? ""}
                    type={type ?? "text"}
                    step={type === "number" ? "0.01" : undefined}
                    onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))}
                    className="form-input"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1">Currency</label>
                <select value={editForm.currency ?? "USD"} onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))} className="form-select">
                  {["USD","INR","AED","THB"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {editErr && <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2 mt-3">{editErr}</div>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditListing(null)} className="flex-1 py-2.5 text-sm border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={saveEdit} className="flex-1 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminTransactions({ adminId }: { adminId: string }) {
  const [txns, setTxns] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [toast, setToast] = useState("");
  const [reminderMsg, setReminderMsg] = useState("Your payment is overdue. Please clear dues.");

  const load = useCallback(() => {
    setLoading(true);
    adminFetch(`/admin/transactions${overdueOnly ? "?overdue=true" : ""}`, adminId)
      .then((d) => { setTxns(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminId, overdueOnly]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function sendReminder(userId: string) {
    try {
      await adminFetch("/admin/send-reminder", adminId, { method: "POST", body: JSON.stringify({ user_id: userId, message: reminderMsg }) });
      showToast("📧 Reminder sent (simulated)");
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
  }

  const statusColor = (s: string, overdue: boolean) => overdue || s === "overdue" ? "red" : s === "completed" ? "green" : "yellow";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Transactions</h2>
        {toast && <div className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">{toast}</div>}
      </div>
      <div className="flex gap-4 mb-5 items-center flex-wrap">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="rounded" />
          Show overdue only
        </label>
        <div className="flex-1 max-w-md">
          <input value={reminderMsg} onChange={(e) => setReminderMsg(e.target.value)}
            className="form-input text-sm w-full" placeholder="Default reminder message…" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-border">
            <tr>{["Buyer → Seller", "Amount", "Advance", "Credit Due", "Due Date", "Status", "Action"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions found</td></tr>
            ) : txns.map((t) => {
              const isOverdue = t.is_overdue as boolean;
              return (
                <tr key={t.id as string} className={`border-b border-border last:border-0 ${isOverdue ? "bg-red-50/40" : "hover:bg-slate-50/50"}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.buyer_name as string}</div>
                    <div className="text-xs text-muted-foreground">→ {t.seller_name as string}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{t.currency as string} {(t.total_amount as number).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{t.currency as string} {(t.advance_paid as number).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{t.currency as string} {(t.credit_amount as number).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{new Date(t.due_date as string).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor(t.status as string, isOverdue)}>{isOverdue ? "Overdue" : t.status as string}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {(t.status as string) !== "completed" && (
                      <button onClick={() => sendReminder(t.buyer_id as string)}
                        className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-medium">📧 Remind</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminSubscriptions({ adminId }: { adminId: string }) {
  const [subs, setSubs] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [creditInputs, setCreditInputs] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    setLoading(true);
    adminFetch("/admin/subscriptions", adminId)
      .then((d) => { setSubs(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3500); }

  async function updateSub(userId: string, patch: { plan?: string; payment_status?: string }) {
    try {
      await adminFetch(`/admin/subscriptions/${userId}`, adminId, { method: "PATCH", body: JSON.stringify(patch) });
      showToast("✅ Subscription updated");
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
  }

  async function extendPlan(userId: string) {
    try {
      await adminFetch(`/admin/subscriptions/${userId}/extend`, adminId, { method: "POST", body: JSON.stringify({ days: 30 }) });
      showToast("📅 Plan extended by 30 days");
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
  }

  async function addCreditsToUser(userId: string) {
    const amount = creditInputs[userId] ?? 5;
    try {
      await adminFetch(`/admin/users/${userId}/credits`, adminId, { method: "POST", body: JSON.stringify({ amount }) });
      showToast(`✅ Added ${amount} credits`);
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
  }

  function expiryStatus(dateStr: string | null): { color: string; label: string } {
    if (!dateStr) return { color: "gray", label: "No expiry" };
    const diff = new Date(dateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return { color: "red", label: "Expired" };
    if (days <= 3) return { color: "red", label: `${days}d left` };
    if (days <= 14) return { color: "yellow", label: `${days}d left` };
    return { color: "green", label: `${days}d left` };
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Subscription Management</h2>
        {toast && <div className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">{toast}</div>}
      </div>
      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-slate-50 border-b border-border">
            <tr>{["User", "Plan", "Expiry", "Payment", "Credits", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : subs.map((s) => {
              const exp = expiryStatus(s.expiry_date as string | null);
              const uid = s.user_id as string;
              return (
                <tr key={uid} className="border-b border-border last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name as string}</div>
                    <div className="text-xs text-muted-foreground">{s.email as string}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select value={s.plan as string}
                      onChange={(e) => updateSub(uid, { plan: e.target.value })}
                      className="form-select text-xs py-1">
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {(s.expiry_date as string) ? (
                      <div>
                        <div className="text-xs">{new Date(s.expiry_date as string).toLocaleDateString()}</div>
                        <Badge color={exp.color}>{exp.label}</Badge>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={(s.payment_status as string) === "paid" ? "green" : "red"}>{s.payment_status as string}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold min-w-[20px]">{(s.extra_listing_credits as number) ?? 0}</span>
                      <input
                        type="number"
                        min={1} max={1000}
                        value={creditInputs[uid] ?? 5}
                        onChange={(e) => setCreditInputs((prev) => ({ ...prev, [uid]: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-14 border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button onClick={() => addCreditsToUser(uid)}
                        className="text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md font-medium whitespace-nowrap">+ Add</button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {(s.payment_status as string) !== "paid" ? (
                        <button onClick={() => updateSub(uid, { payment_status: "paid" })}
                          className="text-xs px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-medium">✓ Paid</button>
                      ) : (
                        <button onClick={() => updateSub(uid, { payment_status: "unpaid" })}
                          className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md font-medium">Unpaid</button>
                      )}
                      <button onClick={() => extendPlan(uid)}
                        className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-medium">📅 +30d</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── AdminComms ───────────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  { id: "custom", label: "✏️ Custom Message", description: "Write your own subject and body", fields: [
    { key: "subject", label: "Subject", type: "text", placeholder: "e.g. Important update from LuckyBirthstone" },
    { key: "body", label: "Body (HTML supported)", type: "textarea", placeholder: "<p>Hi, we wanted to let you know...</p>" },
  ]},
  { id: "listing_reminder", label: "💎 Listing Reminder", description: "Nudge verified sellers with no listings to add their first gem. Name & company auto-filled.", fields: [] },
  { id: "verification_reminder", label: "🏅 Verification Reminder", description: "Encourage unverified users to apply for verification. Name auto-filled.", fields: [] },
  { id: "whatsapp_optin", label: "💬 WhatsApp Opt-In Invite", description: "Email users with a registered phone number, explaining how to opt-in to receive WhatsApp alerts. Best sent to 'Users with phone' audience.", fields: [] },
];

const WA_TEMPLATES = [
  { id: "prospects_outreach", label: "🌟 Prospects Outreach", description: "Introduce LuckyBirthstone to prospects. Recipient name is auto-filled — no other inputs needed.", fields: [], preview: (p: Record<string,string>) => `Hi ${p.name || "{name}"},\n\nMeet Gems Stones Dealers worldwide - manage accounts, trade, auction, chat or just be there..\n\nIt's free!!\n\nluckybirthstone.com` },
  { id: "listing_reminder", label: "💎 Listing Reminder", description: "Remind verified sellers to list their gemstones. Recipient name is auto-filled.", fields: [
    { key: "url", label: "Dashboard URL", type: "text", placeholder: "https://luckybirthstone.com/dashboard" },
  ], preview: (p: Record<string,string>) => `Hi {name} 👋\n\nYour LuckyBirthstone account is verified! Start listing your gems:\n${p.url||"[url]"}\n\nReply STOP to opt out.` },
  { id: "new_listing_alert", label: "🔔 New Listing Alert", description: "Announce a new gem listing to users.", fields: [
    { key: "company", label: "Company Name", type: "text", placeholder: "Bangkok Gems Co." },
    { key: "stone_type", label: "Stone Type", type: "text", placeholder: "Blue Sapphire" },
    { key: "carat", label: "Carat", type: "text", placeholder: "3.25" },
    { key: "origin", label: "Origin", type: "text", placeholder: "Sri Lanka" },
    { key: "url", label: "Listing URL", type: "text", placeholder: "https://luckybirthstone.com/listing/..." },
  ], preview: (p: Record<string,string>) => `💎 New gem by ${p.company||"[company]"}!\n\nStone: ${p.stone_type||"[type]"}\nCarat: ${p.carat||"[ct]"} ct\nOrigin: ${p.origin||"[origin]"}\n\nView: ${p.url||"[url]"}\n\nReply STOP to opt out.` },
  { id: "new_auction_alert", label: "🏆 New Auction Alert", description: "Announce a gem auction to all users.", fields: [
    { key: "stone_type", label: "Stone Type", type: "text", placeholder: "Ruby" },
    { key: "carat", label: "Carat", type: "text", placeholder: "2.10" },
    { key: "starting_bid", label: "Starting Bid (THB)", type: "text", placeholder: "45000" },
    { key: "end_time", label: "End Time", type: "text", placeholder: "Fri, 28 Mar 2026 18:00:00 UTC" },
    { key: "url", label: "Auction URL", type: "text", placeholder: "https://luckybirthstone.com/gem-auctions/..." },
  ], preview: (p: Record<string,string>) => `🔔 Live auction!\n\nStone: ${p.stone_type||"[type]"} (${p.carat||"[ct]"} ct)\nStarting bid: THB ${p.starting_bid||"[bid]"}\nEnds: ${p.end_time||"[time]"}\n\nBid now: ${p.url||"[url]"}\n\nReply STOP to opt out.` },
];

type BroadcastUser = { id: string; name: string; email: string; company_name: string | null; verification_status: string; has_phone: boolean; whatsapp_opt_in: boolean; subscription_plan: string };

function AdminComms({ adminId }: { adminId: string }) {
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [templateId, setTemplateId] = useState("custom");
  const [params, setParams] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState<"all" | "verified" | "unverified" | "with_phone" | "specific">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [allUsers, setAllUsers] = useState<BroadcastUser[]>([]);

  useEffect(() => {
    adminFetch("/admin/broadcast/users", adminId).then((data) => setAllUsers(data as BroadcastUser[])).catch(() => {});
  }, [adminId]);

  const templates = channel === "email" ? EMAIL_TEMPLATES : WA_TEMPLATES;
  const tpl = templates.find((t) => t.id === templateId) ?? templates[0];

  // Reset template when channel changes
  useEffect(() => {
    setTemplateId(channel === "email" ? "custom" : "listing_reminder");
    setParams({});
    setResult(null);
  }, [channel]);

  useEffect(() => { setParams({}); }, [templateId]);

  function filterByAudience(u: BroadcastUser) {
    if (u.verification_status === "unverified" && audience === "verified") return false;
    if (audience === "verified") return ["basic_verified","verified","legacy_verified"].includes(u.verification_status);
    if (audience === "unverified") return u.verification_status === "unverified";
    if (audience === "with_phone") return u.has_phone;
    if (audience === "specific") return selectedIds.includes(u.id);
    return true;
  }

  const targeted = allUsers.filter(filterByAudience);
  const waReachable = targeted.filter((u) => u.has_phone && u.whatsapp_opt_in);
  const displayCount = channel === "whatsapp" ? waReachable.length : targeted.length;
  const skippedCount = channel === "whatsapp" ? targeted.length - waReachable.length : 0;

  const filteredForPicker = allUsers.filter((u) =>
    `${u.name} ${u.email} ${u.company_name ?? ""}`.toLowerCase().includes(userSearch.toLowerCase())
  );

  async function handleSend() {
    if (!templateId) return;
    if (channel === "email" && templateId === "custom" && (!params.subject?.trim() || !params.body?.trim())) {
      setError("Subject and body are required for custom emails."); return;
    }
    if (displayCount === 0) { setError("No users will receive this message."); return; }
    setError(""); setSending(true); setResult(null);
    try {
      const data = await adminFetch("/admin/broadcast", adminId, {
        method: "POST",
        body: JSON.stringify({ channel, template_id: templateId, params, audience, user_ids: selectedIds }),
      });
      setResult(data as { sent: number; failed: number; skipped: number; total: number });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setSending(false); }
  }

  const waPreview = channel === "whatsapp" && "preview" in tpl && typeof tpl.preview === "function" ? tpl.preview(params) : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">📣 Broadcast Message</h2>
        <p className="text-sm text-muted-foreground mt-1">Send targeted emails or WhatsApp messages to your users using pre-approved templates.</p>
      </div>

      {/* Channel */}
      <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">1. Choose Channel</p>
        <div className="flex gap-3">
          {(["email","whatsapp"] as const).map((ch) => (
            <button key={ch} onClick={() => setChannel(ch)}
              className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-sm font-medium transition-all ${channel === ch ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              <span className="text-2xl">{ch === "email" ? "📧" : "💬"}</span>
              {ch === "email" ? "Email" : "WhatsApp"}
            </button>
          ))}
        </div>
      </div>

      {/* Template */}
      <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">2. Select Template</p>
        <div className="space-y-2">
          {templates.map((t) => (
            <label key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${templateId === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <input type="radio" name="template" checked={templateId === t.id} onChange={() => setTemplateId(t.id)} className="mt-0.5 accent-primary" />
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Dynamic param fields */}
        {tpl.fields && tpl.fields.length > 0 && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Template Variables</p>
            {tpl.fields.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1">{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea rows={5} value={params[f.key] ?? ""} onChange={(e) => setParams((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full px-3 py-2 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition font-mono" />
                ) : (
                  <input type="text" value={params[f.key] ?? ""} onChange={(e) => setParams((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full px-3 py-2 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* WhatsApp preview */}
        {waPreview && (
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Message Preview</p>
            <div className="bg-[#dcf8c6] rounded-xl rounded-tl-none px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap max-w-xs shadow-sm font-[system-ui]">{waPreview}</div>
          </div>
        )}
      </div>

      {/* Audience */}
      <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">3. Select Audience</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { id: "all", label: "All Users", icon: "👥" },
            { id: "verified", label: "Verified Sellers", icon: "✅" },
            { id: "unverified", label: "Unverified Users", icon: "⏳" },
            { id: "with_phone", label: "Has Phone", icon: "📱" },
            { id: "specific", label: "Specific Users", icon: "🎯" },
          ] as const).map((a) => (
            <button key={a.id} onClick={() => { setAudience(a.id); setSelectedIds([]); }}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all ${audience === a.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
              <span className="text-lg">{a.icon}</span>{a.label}
            </button>
          ))}
        </div>

        {/* Specific user picker */}
        {audience === "specific" && (
          <div className="border-t border-border pt-4 space-y-2">
            <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name, email or company..."
              className="w-full px-3 py-2 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
            <div className="max-h-52 overflow-y-auto border border-border rounded-xl divide-y divide-border">
              {filteredForPicker.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">No users found</p>}
              {filteredForPicker.map((u) => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="checkbox" checked={selectedIds.includes(u.id)}
                    onChange={(e) => setSelectedIds((ids) => e.target.checked ? [...ids, u.id] : ids.filter((i) => i !== u.id))}
                    className="accent-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name} {u.company_name ? `· ${u.company_name}` : ""}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email} · {u.has_phone ? "📱 Has phone" : "No phone"}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${u.verification_status === "verified" || u.verification_status === "legacy_verified" ? "bg-green-100 text-green-700" : u.verification_status === "basic_verified" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.verification_status.replace(/_/g," ")}
                  </span>
                </label>
              ))}
            </div>
            {selectedIds.length > 0 && <p className="text-xs text-primary font-medium">{selectedIds.length} user{selectedIds.length !== 1 ? "s" : ""} selected</p>}
          </div>
        )}

        {/* Count summary */}
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3 text-sm">
          <span className="text-lg">🎯</span>
          <span className="font-semibold text-foreground">{displayCount} user{displayCount !== 1 ? "s" : ""} will receive this message</span>
          {skippedCount > 0 && <span className="text-muted-foreground">· {skippedCount} skipped (no phone / opted out)</span>}
        </div>
      </div>

      {/* Send */}
      <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">4. Send</p>
        {error && <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">{error}</div>}
        {result && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 space-y-1">
            <p className="text-sm font-semibold text-green-800">✅ Broadcast complete</p>
            <div className="flex gap-4 text-sm text-green-700">
              <span>✉️ Sent: <strong>{result.sent}</strong></span>
              {result.failed > 0 && <span className="text-red-600">❌ Failed: <strong>{result.failed}</strong></span>}
              {result.skipped > 0 && <span className="text-amber-600">⏭️ Skipped: <strong>{result.skipped}</strong></span>}
            </div>
          </div>
        )}
        <button onClick={handleSend} disabled={sending || displayCount === 0}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
          {sending && <span className="spinner !w-4 !h-4" />}
          {sending ? "Sending…" : `🚀 Send to ${displayCount} user${displayCount !== 1 ? "s" : ""}`}
        </button>
        <p className="text-xs text-muted-foreground text-center">Messages are sent immediately. WhatsApp messages use Gupshup pre-approved templates.</p>
      </div>
    </div>
  );
}

function AdminCRM({ adminId }: { adminId: string }) {
  type Prospect = import("@/lib/api").CrmProspect;
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "", notes: "", status: "prospect" as Prospect["status"] });
  const [saving, setSaving] = useState(false);

  // Message modal state
  const [messageProspect, setMessageProspect] = useState<Prospect | null>(null);
  const [msgChannel, setMsgChannel] = useState<"email" | "whatsapp">("email");
  const [msgTemplateId, setMsgTemplateId] = useState("listing_reminder");
  const [msgParams, setMsgParams] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [msgResult, setMsgResult] = useState<"sent" | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);

  // Convert modal state
  const [convertProspect, setConvertProspect] = useState<Prospect | null>(null);
  const [convertForm, setConvertForm] = useState({ user_type: "b2b_trader", address: "", city: "", country: "" });
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<import("@/lib/api").ConvertProspectResult | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Import modal state
  const [showImport, setShowImport] = useState(false);

  const STATUS_COLORS: Record<string, string> = {
    prospect: "bg-slate-100 text-slate-700",
    contacted: "bg-blue-100 text-blue-700",
    demo: "bg-purple-100 text-purple-700",
    onboarded: "bg-green-100 text-green-700",
    declined: "bg-red-100 text-red-700",
    converted: "bg-emerald-100 text-emerald-700",
  };

  const load = useCallback(() => {
    setLoading(true);
    api.getCrmProspects(adminId).then(setProspects).finally(() => setLoading(false));
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setFormError(null);
    setForm({ name: "", company: "", phone: "", email: "", notes: "", status: "prospect" });
    setShowForm(true);
  }

  function openEdit(p: Prospect) {
    setEditing(p);
    setFormError(null);
    setForm({ name: p.name, company: p.company, phone: p.phone ?? "", email: p.email ?? "", notes: p.notes ?? "", status: p.status });
    setShowForm(true);
  }

  async function handleSave() {
    setFormError(null);
    setSaving(true);
    try {
      const data = { name: form.name, company: form.company, phone: form.phone || null, email: form.email || null, notes: form.notes || null, status: form.status };
      if (editing) {
        await api.updateCrmProspect(adminId, editing.id, data);
      } else {
        await api.createCrmProspect(adminId, data);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save prospect");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this prospect?")) return;
    setDeleting(id);
    await api.deleteCrmProspect(adminId, id).finally(() => setDeleting(null));
    load();
  }

  function openMessage(p: Prospect) {
    setMessageProspect(p);
    setMsgChannel("whatsapp");
    setMsgTemplateId("prospects_outreach");
    setMsgParams({});
    setMsgResult(null);
    setMsgError(null);
  }

  async function handleSendMessage() {
    if (!messageProspect) return;
    setSending(true);
    setMsgError(null);
    try {
      await api.messageCrmProspect(adminId, messageProspect.id, { channel: msgChannel, template_id: msgTemplateId, params: msgParams });
      setMsgResult("sent");
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function openConvert(p: Prospect) {
    setConvertProspect(p);
    setConvertForm({ user_type: "b2b_trader", address: "", city: "", country: "" });
    setConvertResult(null);
    setConvertError(null);
  }

  async function handleConvert() {
    if (!convertProspect) return;
    setConverting(true);
    setConvertError(null);
    try {
      const result = await api.convertCrmProspect(adminId, convertProspect.id, convertForm);
      setConvertResult(result);
      load();
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  }

  const inp = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-300/40";

  return (
    <div className="space-y-6">
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onImport={async (rows: ImportedProspect[]) => {
            const res = await api.importCrmProspects(adminId, rows);
            load();
            return res;
          }}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">🎯 CRM — Prospective Dealers</h2>
          <p className="text-sm text-muted-foreground mt-1">Track potential dealers. Convert them into verified company accounts when ready.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="px-4 py-2 text-sm font-semibold border border-border text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5">
            📥 Import CSV / Excel
          </button>
          <button onClick={openNew} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            + Add Prospect
          </button>
        </div>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-base">{editing ? "Edit Prospect" : "New Prospect"}</h3>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">❌ {formError}</div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Name *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inp} placeholder="Contact name" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Company *</label><input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} className={inp} placeholder="Company name" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">WhatsApp Phone</label><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inp} placeholder="+66812345678" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Email</label><input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inp} placeholder="email@company.com" /></div>
            <div className="sm:col-span-2"><label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Notes</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inp} rows={2} placeholder="Source, interest level, follow-up notes…" /></div>
            <div><label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))} className={inp}>
                <option value="prospect">Prospect</option>
                <option value="contacted">Contacted</option>
                <option value="demo">Demo</option>
                <option value="onboarded">Onboarded</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.company.trim()} className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors">
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Prospect"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Message Prospect Modal */}
      {messageProspect && (
        <Modal title={`Message: ${messageProspect.name}`} onClose={() => setMessageProspect(null)}>
          {msgResult === "sent" ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
                <p className="text-3xl mb-2">{msgChannel === "whatsapp" ? "💬" : "📧"}</p>
                <p className="font-bold text-emerald-700 text-base">
                  {msgChannel === "whatsapp" ? "WhatsApp message sent!" : "Email sent successfully!"}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {msgChannel === "whatsapp"
                    ? `Message delivered to ${messageProspect.phone}`
                    : `Email sent to ${messageProspect.email}`}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setMsgResult(null); setMsgParams({}); }} className="px-4 py-2 border border-border text-sm font-semibold rounded-lg hover:bg-slate-50">Send Another</button>
                <button onClick={() => setMessageProspect(null)} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90">Done</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Channel selector */}
              <div className="flex gap-2">
                {(["email", "whatsapp"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => { setMsgChannel(ch); setMsgTemplateId(ch === "whatsapp" ? "prospects_outreach" : "custom"); setMsgParams({}); setMsgError(null); }}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors ${msgChannel === ch ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-slate-50 text-muted-foreground"}`}
                  >
                    {ch === "email" ? "📧 Email" : "💬 WhatsApp"}
                  </button>
                ))}
              </div>

              {/* Contact info bar */}
              <div className="bg-slate-50 border border-border rounded-lg px-4 py-3 text-sm flex flex-wrap gap-4">
                <span className="text-muted-foreground font-medium">{messageProspect.company}</span>
                {messageProspect.email
                  ? <span className="text-foreground">{messageProspect.email}</span>
                  : <span className="text-red-500 text-xs">No email</span>}
                {messageProspect.phone
                  ? <span className="text-foreground">{messageProspect.phone}</span>
                  : <span className="text-amber-500 text-xs">No phone</span>}
              </div>

              {msgError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">❌ {msgError}</div>}

              {msgChannel === "email" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Subject</label>
                    <input
                      value={msgParams["subject"] ?? ""}
                      onChange={(e) => setMsgParams((p) => ({ ...p, subject: e.target.value }))}
                      className={inp}
                      placeholder="Invitation to join LuckyBirthstone Marketplace"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Message Body</label>
                    <textarea
                      value={msgParams["body"] ?? ""}
                      onChange={(e) => setMsgParams((p) => ({ ...p, body: e.target.value }))}
                      className={inp}
                      rows={6}
                      placeholder={`Hi ${messageProspect.name},\n\nWe'd like to invite you to list your gemstones on LuckyBirthstone...\n\nBest,\nLuckyBirthstone Team`}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Template</label>
                    <select
                      value={msgTemplateId}
                      onChange={(e) => { setMsgTemplateId(e.target.value); setMsgParams({}); }}
                      className={inp}
                    >
                      {WA_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">{WA_TEMPLATES.find((t) => t.id === msgTemplateId)?.description}</p>
                  </div>
                  {(() => {
                    const tpl = WA_TEMPLATES.find((t) => t.id === msgTemplateId);
                    if (!tpl) return null;
                    const fields = tpl.fields.filter((f) => {
                      // For listing_reminder, name is auto-filled from prospect
                      return true;
                    });
                    return (
                      <div className="space-y-3">
                        {(msgTemplateId === "listing_reminder" || msgTemplateId === "prospects_outreach") && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                            Recipient name is auto-filled as <strong>{messageProspect.name}</strong>
                          </div>
                        )}
                        {fields.map((f) => (
                          <div key={f.key}>
                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{f.label}</label>
                            <input
                              value={msgParams[f.key] ?? ""}
                              onChange={(e) => setMsgParams((p) => ({ ...p, [f.key]: e.target.value }))}
                              className={inp}
                              placeholder={f.placeholder}
                            />
                          </div>
                        ))}
                        {tpl.preview && (
                          <div className="bg-[#dcf8c6] border border-green-200 rounded-xl px-4 py-3 text-sm font-mono whitespace-pre-wrap text-slate-800">
                            {tpl.preview({ ...msgParams, name: messageProspect.name })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSendMessage}
                  disabled={sending || (msgChannel === "email" && (!msgParams["subject"]?.trim() || !msgParams["body"]?.trim())) || (msgChannel === "whatsapp" && !messageProspect.phone) || (msgChannel === "email" && !messageProspect.email)}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {sending ? "Sending…" : msgChannel === "whatsapp" ? "💬 Send WhatsApp" : "📧 Send Email"}
                </button>
                <button onClick={() => setMessageProspect(null)} className="px-4 py-2.5 border border-border text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Convert to Account Modal */}
      {convertProspect && (
        <Modal title={`Convert to Account: ${convertProspect.name}`} onClose={() => { setConvertProspect(null); setConvertResult(null); }}>
          {convertResult ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <p className="font-bold text-emerald-700 text-base mb-3">✅ Account created successfully!</p>
                <p className="text-sm text-slate-600 mb-4">A welcome email with login credentials has been sent to <strong>{convertResult.email}</strong>.</p>
                <div className="bg-white border border-emerald-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-3 text-sm"><span className="text-slate-500 w-24 font-medium">Email</span><span className="font-mono font-bold text-slate-800">{convertResult.email}</span></div>
                  <div className="flex items-center gap-3 text-sm"><span className="text-slate-500 w-24 font-medium">Password</span><span className="font-mono font-bold text-slate-800 text-base tracking-widest">{convertResult.temp_password}</span></div>
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">⚠️ Share this password securely with the user. They should change it on first login.</p>
              </div>
              <div className="flex justify-end">
                <button onClick={() => { setConvertProspect(null); setConvertResult(null); }} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90">Done</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-border rounded-xl p-4 text-sm">
                <p className="font-semibold text-foreground mb-1">{convertProspect.company}</p>
                <p className="text-muted-foreground">{convertProspect.email ?? <span className="text-red-500">No email — required for conversion</span>}</p>
                {convertProspect.phone && <p className="text-muted-foreground">{convertProspect.phone}</p>}
              </div>
              {convertError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">❌ {convertError}</div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Account Type</label>
                  <select value={convertForm.user_type} onChange={(e) => setConvertForm((f) => ({ ...f, user_type: e.target.value }))} className={inp}>
                    <option value="b2b_trader">Trader</option>
                    <option value="retailer">Retailer</option>
                    <option value="miner">Miner</option>
                    <option value="manufacturer">Manufacturer</option>
                    <option value="gems_lab">Gems Lab</option>
                  </select>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">City</label><input value={convertForm.city} onChange={(e) => setConvertForm((f) => ({ ...f, city: e.target.value }))} className={inp} placeholder="Bangkok" /></div>
                  <div><label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Country</label><input value={convertForm.country} onChange={(e) => setConvertForm((f) => ({ ...f, country: e.target.value }))} className={inp} placeholder="Thailand" /></div>
                  <div><label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Address</label><input value={convertForm.address} onChange={(e) => setConvertForm((f) => ({ ...f, address: e.target.value }))} className={inp} placeholder="Optional" /></div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
                <strong>What happens:</strong> A verified user account is created with the prospect's name, company, phone and email. A temporary password is generated and emailed to them. The prospect is marked as <strong>Converted</strong>.
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleConvert}
                  disabled={converting || !convertProspect.email}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {converting ? "Creating account…" : "✨ Convert to Account"}
                </button>
                <button onClick={() => setConvertProspect(null)} className="px-4 py-2.5 border border-border text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Prospects table */}
      <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : prospects.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No prospects yet. Add your first potential dealer!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Name", "Company", "Phone", "Email", "Status", "Notes", "Added", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {prospects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.company}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${STATUS_COLORS[p.status] ?? "bg-slate-100 text-slate-700"}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{p.notes ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => openMessage(p)}
                          className="text-xs px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-semibold transition-colors"
                        >
                          📨 Message
                        </button>
                        {p.status !== "converted" && (
                          <button
                            onClick={() => openConvert(p)}
                            className="text-xs px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-semibold transition-colors whitespace-nowrap"
                          >
                            ✨ Convert
                          </button>
                        )}
                        {p.status === "converted" && p.converted_user_id && (
                          <span className="text-xs px-2.5 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-md font-medium">✅ Account</span>
                        )}
                        <button onClick={() => openEdit(p)} className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md font-medium transition-colors">Edit</button>
                        <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} className="text-xs px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-md font-medium transition-colors disabled:opacity-50">
                          {deleting === p.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AdminSalesTeam ──────────────────────────────────────────────────────────
function AdminSalesTeam({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getSalesUsers(adminId);
      setUsers(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setErr("Name, email, and password are required"); return;
    }
    setSaving(true); setErr(null);
    try {
      const user = await api.createSalesUser(adminId, { name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, phone: form.phone.trim() || undefined });
      setUsers((prev) => [...prev, user]);
      setForm({ name: "", email: "", password: "", phone: "" });
      setShowCreate(false);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      const updated = await api.toggleSalesUserActive(adminId, id, !current);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    } catch (e: any) { setErr(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sales user? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deleteSalesUser(adminId, id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e: any) { setErr(e.message); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Sales staff can log in at <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">/sales-agent</code> to manage the CRM pipeline.</p>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-[#FF7A59] hover:bg-[#e8603f] text-white text-sm font-semibold transition-colors">
          + New Sales User
        </button>
      </div>

      {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{err}</div>}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-800">Create Sales User</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "name", label: "Full Name", placeholder: "Jane Smith" },
              { key: "email", label: "Email", placeholder: "jane@company.com" },
              { key: "password", label: "Password", placeholder: "Temp password" },
              { key: "phone", label: "Phone (optional)", placeholder: "+66 8x xxx xxxx" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{label}</label>
                <input
                  type={key === "password" ? "password" : "text"}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">👥</div>
          <p className="font-semibold text-slate-600">No sales users yet</p>
          <p className="text-sm mt-1">Create your first sales team member above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Phone</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Created</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">{u.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge color={u.is_active ? "green" : "gray"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${u.is_active ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"}`}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                      >
                        {deletingId === u.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminFeatured({ adminId }: { adminId: string }) {
  const [listings, setListings] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("approved");
  const [searchQ, setSearchQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch(`/admin/listings?status=${statusFilter}`, adminId);
      setListings(Array.isArray(data) ? data : []);
    } catch { setListings([]); } finally { setLoading(false); }
  }, [adminId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function toggleAd(id: string, current: boolean) {
    setToggling(id);
    try {
      await adminFetch(`/admin/listings/${id}/promote`, adminId, {
        method: "PATCH",
        body: JSON.stringify({ is_ad_promoted: !current }),
      });
      setListings((prev) => prev.map((l) => l["id"] === id ? { ...l, is_ad_promoted: !current, ad_promoted_at: !current ? new Date().toISOString() : null } : l));
    } catch { /* ignore */ } finally { setToggling(null); }
  }

  const filtered = listings.filter((l) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return String(l["stone_type"] ?? "").toLowerCase().includes(q) ||
      String(l["seller_name"] ?? "").toLowerCase().includes(q) ||
      String(l["seller_email"] ?? "").toLowerCase().includes(q);
  });

  const promotedCount = listings.filter((l) => l["is_ad_promoted"]).length;

  return (
    <div className="p-6 space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Listings" valueStr={String(listings.length)} color="blue" icon="◆" />
        <StatCard label="Ad Promoted" valueStr={String(promotedCount)} color="amber" icon="⭐" />
        <StatCard label="Not Promoted" valueStr={String(listings.length - promotedCount)} color="slate" icon="○" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-[#6b7280]">Toggle ad promotion to feature individual listings on the marketplace.</p>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-white">
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="all">All</option>
          </select>
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search listings…" className="px-3 py-2 text-sm border border-border rounded-lg bg-white w-44" />
          <button onClick={load} className="px-3 py-2 text-sm border border-border rounded-lg bg-white hover:bg-slate-50">↻</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground"><span className="spinner" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No listings found.</div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Stone</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Seller</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Promoted Since</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Ad Promoted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((l) => (
                  <tr key={String(l["id"])} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{String(l["stone_type"] ?? "")} {Number(l["carat"] ?? 0)}ct</div>
                      <div className="text-xs text-muted-foreground">{String(l["origin"] ?? "")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{String(l["seller_name"] ?? "")}</div>
                      <div className="text-xs text-muted-foreground">{String(l["seller_email"] ?? "")}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">${Number(l["base_price_usd"] ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l["listing_status"] === "approved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {String(l["listing_status"] ?? "approved")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {l["ad_promoted_at"] ? new Date(String(l["ad_promoted_at"])).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        disabled={toggling === String(l["id"])}
                        onClick={() => toggleAd(String(l["id"]), Boolean(l["is_ad_promoted"]))}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${l["is_ad_promoted"] ? "bg-primary" : "bg-muted-foreground/30"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${l["is_ad_promoted"] ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border bg-slate-50">
            {filtered.length} listing{filtered.length !== 1 ? "s" : ""} · {filtered.filter((l) => l["is_ad_promoted"]).length} promoted
          </div>
        </div>
      )}
    </div>
  );
}

// ── AdminAuctions ─────────────────────────────────────────────────────────────
function AdminAuctions({ adminId }: { adminId: string }) {
  type AuctionRow = {
    id: string; inventory_id: string; seller_id: string; auction_type: string;
    starting_price: number; current_highest_bid: number; reserve_price: number | null;
    start_time: string; end_time: string; status: string; winner_id: string | null;
    total_bids: number; is_featured: boolean; created_at: string;
    stone_type?: string; carat?: number; seller_name?: string;
  };
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Record<string, { stone_type: string; carat: number }>>({});
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [auctionData, invData, usersData] = await Promise.all([
        adminFetch("/gem-auctions", adminId),
        adminFetch("/admin/listings?status=all", adminId).catch(() => []),
        adminFetch("/admin/users", adminId).catch(() => []),
      ]);
      const inv: Record<string, { stone_type: string; carat: number }> = {};
      if (Array.isArray(invData)) {
        for (const g of invData as DataRow[]) {
          inv[String(g["id"] ?? "")] = { stone_type: String(g["stone_type"] ?? ""), carat: Number(g["carat"] ?? 0) };
        }
      }
      const umap: Record<string, string> = {};
      if (Array.isArray(usersData)) {
        for (const u of usersData as DataRow[]) {
          umap[String(u["id"] ?? "")] = String(u["name"] ?? u["email"] ?? "");
        }
      }
      setInventory(inv);
      setUserMap(umap);
      const list = Array.isArray(auctionData) ? auctionData : (auctionData as any).auctions ?? [];
      setAuctions(list as AuctionRow[]);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [adminId]);

  useEffect(() => { void load(); }, [load]);

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this auction? This cannot be undone.")) return;
    setCancelling(id);
    try {
      await adminFetch(`/gem-auctions/${id}/cancel`, adminId, { method: "POST", body: JSON.stringify({}) });
      setAuctions((prev) => prev.map((a) => a.id === id ? { ...a, status: "cancelled" } : a));
    } catch (e: any) { setErr(e.message); }
    finally { setCancelling(null); }
  };

  const filtered = auctions.filter((a) => {
    const matchS = statusFilter === "all" || a.status === statusFilter;
    const q = searchQ.toLowerCase();
    const gemName = inventory[a.inventory_id]?.stone_type?.toLowerCase() ?? "";
    const sellerName = userMap[a.seller_id]?.toLowerCase() ?? "";
    const matchQ = !q || gemName.includes(q) || sellerName.includes(q);
    return matchS && matchQ;
  });

  const stats = {
    total: auctions.length,
    active: auctions.filter((a) => a.status === "active").length,
    completed: auctions.filter((a) => a.status === "completed").length,
    cancelled: auctions.filter((a) => a.status === "cancelled").length,
    totalBids: auctions.reduce((s, a) => s + a.total_bids, 0),
  };

  const statusBadge = (s: string) => {
    if (s === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "completed") return "bg-blue-50 text-blue-700 border-blue-200";
    if (s === "cancelled") return "bg-red-50 text-red-700 border-red-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Auctions" valueStr={String(stats.total)} color="blue" icon="🔨" />
        <StatCard label="Active" valueStr={String(stats.active)} color="green" icon="▶" />
        <StatCard label="Completed" valueStr={String(stats.completed)} color="purple" icon="✓" />
        <StatCard label="Cancelled" valueStr={String(stats.cancelled)} color="red" icon="✕" />
        <StatCard label="Total Bids" valueStr={String(stats.totalBids)} color="amber" icon="◈" />
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap items-center">
        <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search gem or seller…"
          className="flex-1 min-w-48 border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A59]/30 focus:border-[#FF7A59]" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A59]/30">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={load} className="px-3 py-2 border border-[#e5e7eb] rounded-lg bg-white hover:bg-[#f9fafb] text-sm transition-colors">↻ Refresh</button>
      </div>

      {err && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{err}</div>}

      {loading ? (
        <div className="text-center py-20 text-[#9ca3af]">Loading auctions…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[#9ca3af]">
          <div className="text-4xl mb-3">🔨</div>
          <p className="font-semibold text-[#6b7280]">No auctions found</p>
          <p className="text-sm mt-1">{auctions.length === 0 ? "No auctions have been created yet." : "Try adjusting your filters."}</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#f9fafb] border-b border-[#e5e7eb]">
              <tr>
                {["Gem", "Seller", "Type", "Starting", "Current Bid", "Reserve", "End Time", "Bids", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#6b7280] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {filtered.map((a) => {
                const gem = inventory[a.inventory_id];
                const sellerName = userMap[a.seller_id] ?? a.seller_id.slice(0, 8);
                const reserveMet = a.reserve_price !== null && a.current_highest_bid >= a.reserve_price;
                return (
                  <tr key={a.id} className="hover:bg-[#f9fafb] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1a1a1a]">{gem ? `${gem.stone_type} ${gem.carat}ct` : a.inventory_id.slice(0, 8)}</div>
                      <div className="text-xs text-[#9ca3af]">{a.auction_type}</div>
                    </td>
                    <td className="px-4 py-3 text-[#374151]">{sellerName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${a.auction_type === "premium" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {a.auction_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#374151] font-medium">${Number(a.starting_price).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#1a1a1a]">${Number(a.current_highest_bid).toLocaleString()}</span>
                      {a.current_highest_bid > a.starting_price && (
                        <span className="ml-1 text-xs text-emerald-600">↑</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {a.reserve_price ? (
                        <span className={reserveMet ? "text-emerald-600 font-medium" : "text-amber-600"}>
                          ${Number(a.reserve_price).toLocaleString()} {reserveMet ? "✓" : ""}
                        </span>
                      ) : <span className="text-[#9ca3af]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6b7280]">
                      {new Date(a.end_time).toLocaleDateString()} {new Date(a.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-[#374151]">{a.total_bids}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge(a.status)}`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {a.status === "active" && (
                        <button
                          onClick={() => handleCancel(a.id)}
                          disabled={cancelling === a.id}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                        >
                          {cancelling === a.id ? "…" : "Cancel"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-[#9ca3af] border-t border-[#f3f4f6] bg-[#f9fafb]">
            {filtered.length} auction{filtered.length !== 1 ? "s" : ""} shown
          </div>
        </div>
      )}
    </div>
  );
}

function AdminSettings({ adminId }: { adminId: string }) {
  const [toast, setToast] = useState("");
  const [notifs, setNotifs] = useState<DataRow[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  const loadNotifs = useCallback(() => {
    setLoadingNotifs(true);
    adminFetch("/admin/notifications?limit=20", adminId)
      .then((d) => { setNotifs(d); setLoadingNotifs(false); })
      .catch(() => setLoadingNotifs(false));
  }, [adminId]);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  async function triggerAutomation() {
    try {
      await adminFetch("/admin/automation/run", adminId, { method: "POST" });
      setToast("✅ Automation cycle completed");
      setTimeout(() => setToast(""), 3000);
      loadNotifs();
    } catch (e: unknown) { setToast(e instanceof Error ? e.message : "Error"); setTimeout(() => setToast(""), 3000); }
  }

  const notifIcon: Record<string, string> = {
    new_user: "👤", new_listing: "💎", overdue_payment: "💰",
    subscription_expiry: "📋", verification_approved: "✅", verification_rejected: "❌",
  };
  const notifColor: Record<string, string> = {
    new_user: "blue", new_listing: "purple", overdue_payment: "red",
    subscription_expiry: "yellow", verification_approved: "green", verification_rejected: "red",
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-2">Automation Settings</h2>
        <p className="text-sm text-muted-foreground">The automation engine runs automatically every 60 seconds in the background.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: "💰", title: "Overdue Payment Reminders", desc: "Logs overdue transactions and notifies admin once per day per transaction." },
          { icon: "📋", title: "Subscription Expiry Alerts", desc: "Alerts when a user's subscription expires within 3 days. One alert per day." },
          { icon: "🟢", title: "Online Status Updates", desc: "Sets users offline after 10 minutes of inactivity. Runs every 60 seconds." },
        ].map((item) => (
          <div key={item.title} className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{item.icon}</span>
              <span className="font-semibold text-sm">{item.title}</span>
              <span className="ml-auto text-xs text-emerald-600 font-medium">Active</span>
            </div>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <button onClick={triggerAutomation}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
          ▶ Run Automation Now
        </button>
        {toast && <span className="text-sm text-emerald-700 font-medium">{toast}</span>}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Full Notification Log</h3>
        <div className="bg-white border border-border rounded-xl divide-y divide-border">
          {loadingNotifs ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">Loading…</div>
          ) : notifs.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">No notifications yet</div>
          ) : notifs.map((n) => (
            <div key={n.id as string} className={`flex items-start gap-3 px-4 py-3 ${!(n.read as boolean) ? "bg-blue-50/30" : ""}`}>
              <span className="text-lg mt-0.5">{notifIcon[n.type as string] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{n.title as string}</p>
                  <Badge color={notifColor[n.type as string] ?? "gray"}>{(n.type as string).replace("_", " ")}</Badge>
                  {!(n.read as boolean) && <Badge color="blue">New</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message as string}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{new Date(n.created_at as string).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TICKET_STATUS_COLORS: Record<string, string> = {
  open: "blue",
  in_progress: "yellow",
  resolved: "green",
};
const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  anonymous: { label: "Public Inquiry", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  free:      { label: "Free User",      cls: "bg-blue-50 text-blue-700 border-blue-200" },
  paid:      { label: "Paid User",      cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

type Ticket = {
  id: string; user_id: string | null;
  ticket_type: "user_support" | "contact_inquiry";
  submitter_name: string; submitter_email: string;
  submitter_plan: "anonymous" | "free" | "paid";
  user_name: string; user_email: string;
  company_name: string | null; subject: string; message: string;
  status: "open" | "in_progress" | "resolved"; created_at: string;
  responses: { id: string; admin_id: string; message: string; timestamp: string }[];
};

function AdminSupportTickets({ adminId }: { adminId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replySuccess, setReplySuccess] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("ticket_type", typeFilter);
    const url = `/admin/tickets${params.toString() ? "?" + params.toString() : ""}`;
    adminFetch(url, adminId).then((d) => { setTickets(d as Ticket[]); setLoading(false); }).catch((e) => { setErr(e.message); setLoading(false); });
  }, [adminId, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setReplyLoading(true); setReplySuccess("");
    try {
      await adminFetch("/admin/tickets/respond", adminId, {
        method: "POST",
        body: JSON.stringify({ ticket_id: selected.id, message: replyText.trim() }),
      });
      setReplyText(""); setReplySuccess("Reply sent — submitter notified by email.");
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to send reply");
    } finally { setReplyLoading(false); }
  }

  async function updateStatus(ticketId: string, status: string) {
    try {
      await adminFetch("/admin/tickets/status", adminId, {
        method: "PUT",
        body: JSON.stringify({ ticket_id: ticketId, status }),
      });
      load();
      if (selected?.id === ticketId) setSelected((t) => t ? { ...t, status: status as Ticket["status"] } : null);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to update status"); }
  }

  const contactCount = tickets.filter((t) => t.ticket_type === "contact_inquiry").length;
  const userCount = tickets.filter((t) => t.ticket_type === "user_support").length;
  const paidCount = tickets.filter((t) => t.submitter_plan === "paid").length;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Support Tickets</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tickets.length} total · {contactCount} public inquiries · {userCount} user tickets ({paidCount} paid)</p>
        </div>
        {selected ? (
          <button onClick={() => { setSelected(null); setReplySuccess(""); load(); }} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-slate-50">← Back to all tickets</button>
        ) : (
          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              {["all", "contact_inquiry", "user_support"].map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${typeFilter === t ? "bg-slate-800 text-white border-slate-800" : "bg-white border-border hover:bg-slate-50"}`}>
                  {t === "all" ? "All Types" : t === "contact_inquiry" ? "Public Inquiries" : "User Support"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {["all", "open", "in_progress", "resolved"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border hover:bg-slate-50"}`}>
                  {s === "all" ? "All Statuses" : TICKET_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {err && <div className="mb-4 text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-4 py-3">{err}</div>}

      {loading ? (
        <div className="flex items-center gap-3 py-16 text-muted-foreground justify-center"><span className="spinner" /> Loading…</div>
      ) : tickets.length === 0 && !selected ? (
        <div className="text-center py-24 text-muted-foreground border border-dashed border-border rounded-2xl">
          <div className="text-4xl mb-3">🎧</div>
          <p className="font-medium">No tickets found</p>
          <p className="text-sm mt-1">User support tickets and public contact inquiries will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(selected ? [selected] : tickets).map((t) => (
            <div key={t.id} className={`bg-white border rounded-2xl p-5 shadow-sm ${selected ? "" : "cursor-pointer hover:border-primary/40 transition-colors"}`}
              onClick={selected ? undefined : () => setSelected(t)}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${t.ticket_type === "contact_inquiry" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                      {t.ticket_type === "contact_inquiry" ? "📬 Public Inquiry" : "🎧 User Support"}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PLAN_BADGE[t.submitter_plan]?.cls ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {PLAN_BADGE[t.submitter_plan]?.label ?? t.submitter_plan}
                    </span>
                  </div>
                  <p className="font-semibold">{t.subject}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t.submitter_name || t.user_name} {t.company_name ? `· ${t.company_name}` : ""} · {t.submitter_email || t.user_email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">#{t.id.slice(0, 8).toUpperCase()} · {new Date(t.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge color={TICKET_STATUS_COLORS[t.status]}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                  {selected && (
                    <select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value)}
                      className="text-xs border border-border rounded-lg px-2 py-1 bg-white" onClick={(e) => e.stopPropagation()}>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  )}
                </div>
              </div>
              <p className="text-sm text-foreground border-t border-border pt-3">{t.message}</p>

              {t.responses.length > 0 && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Responses</p>
                  {t.responses.map((r) => (
                    <div key={r.id} className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3">
                      <p className="text-xs text-primary font-semibold mb-1.5">Admin · {new Date(r.timestamp).toLocaleString()}</p>
                      <p className="text-sm">{r.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {selected && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-sm font-medium mb-2">Reply to user</p>
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    rows={3} placeholder="Type your reply…"
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  {replySuccess && <p className="text-xs text-emerald-600 mt-1.5">{replySuccess}</p>}
                  <div className="flex justify-end mt-3">
                    <button onClick={sendReply} disabled={replyLoading || !replyText.trim()}
                      className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center gap-2 transition-opacity">
                      {replyLoading && <span className="spinner !w-4 !h-4" />}
                      Send Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type PostForm = {
  slug: string; gem: string; category: string; title: string; subtitle: string;
  coverImage: string; seoDescription: string; readingMinutes: string; publishedAt: string; tags: string;
  facts: { label: string; value: string }[];
  sections: { heading: string; body: string }[];
};

const EMPTY_FORM: PostForm = {
  slug: "", gem: "", category: "Industry Insights", title: "", subtitle: "",
  coverImage: "", seoDescription: "", readingMinutes: "5",
  publishedAt: new Date().toISOString().split("T")[0] ?? "",
  tags: "", facts: [], sections: [{ heading: "", body: "" }],
};

function postToForm(p: GemPost): PostForm {
  return {
    slug: p.slug, gem: p.gem, category: p.category, title: p.title,
    subtitle: p.subtitle, coverImage: p.coverImage, seoDescription: p.seoDescription,
    readingMinutes: String(p.readingMinutes), publishedAt: p.publishedAt,
    tags: p.tags.join(", "),
    facts: p.facts.length > 0 ? p.facts.map((f) => ({ ...f })) : [],
    sections: p.sections.length > 0 ? p.sections.map((s) => ({ ...s })) : [{ heading: "", body: "" }],
  };
}

const GEM_SUGGESTIONS = ["Diamond", "Ruby", "Sapphire", "Emerald", "Alexandrite", "Spinel", "Tanzanite", "Tourmaline", "Aquamarine", "Amethyst", "Opal", "Pearl", "Garnet", "Peridot", "Topaz", "Jade", "Morganite", "Other"];

function AdminBlogs({ adminId }: { adminId: string }) {
  const [posts, setPosts] = useState<GemPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [showStatic, setShowStatic] = useState(false);
  const [staticSearch, setStaticSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/posts").then((r) => r.json()).then((d: GemPost[]) => { setPosts(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3500); }

  function openNew() {
    setForm(EMPTY_FORM); setIsNew(true); setEditSlug("__new__"); setFormErr("");
  }

  function openEdit(p: GemPost, newPost = false) {
    setForm(postToForm(p)); setIsNew(newPost); setEditSlug(newPost ? "__new__" : p.slug); setFormErr("");
  }

  function setField(k: keyof PostForm, v: string) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "title" && (f.slug === "" || isNew)) {
        next.slug = v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 80);
      }
      return next;
    });
  }

  function addFact() { setForm((f) => ({ ...f, facts: [...f.facts, { label: "", value: "" }] })); }
  function removeFact(i: number) { setForm((f) => ({ ...f, facts: f.facts.filter((_, idx) => idx !== i) })); }
  function setFact(i: number, k: "label" | "value", v: string) {
    setForm((f) => { const facts = f.facts.map((x, idx) => idx === i ? { ...x, [k]: v } : x); return { ...f, facts }; });
  }

  function addSection() { setForm((f) => ({ ...f, sections: [...f.sections, { heading: "", body: "" }] })); }
  function removeSection(i: number) { setForm((f) => ({ ...f, sections: f.sections.filter((_, idx) => idx !== i) })); }
  function setSection(i: number, k: "heading" | "body", v: string) {
    setForm((f) => { const sections = f.sections.map((x, idx) => idx === i ? { ...x, [k]: v } : x); return { ...f, sections }; });
  }
  function moveSection(i: number, dir: -1 | 1) {
    setForm((f) => {
      const secs = [...f.sections];
      const j = i + dir;
      if (j < 0 || j >= secs.length) return f;
      [secs[i], secs[j]] = [secs[j]!, secs[i]!];
      return { ...f, sections: secs };
    });
  }

  async function save() {
    if (!form.slug.trim() || !form.title.trim()) { setFormErr("Slug and title are required."); return; }
    setSaving(true); setFormErr("");
    const body = {
      slug: form.slug.trim(), gem: form.gem.trim() || "Other", category: form.category,
      title: form.title.trim(), subtitle: form.subtitle.trim(), coverImage: form.coverImage.trim(),
      seoDescription: form.seoDescription.trim(), readingMinutes: parseInt(form.readingMinutes) || 5,
      publishedAt: form.publishedAt || new Date().toISOString().split("T")[0],
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      facts: form.facts.filter((f) => f.label.trim()),
      sections: form.sections.filter((s) => s.heading.trim() || s.body.trim()),
    };
    try {
      const method = isNew ? "POST" : "PUT";
      const url = isNew ? "/api/admin/posts" : `/api/admin/posts/${encodeURIComponent(editSlug!)}`;
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json", "x-admin-id": adminId },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setFormErr((d as { error?: string }).error ?? "Save failed"); setSaving(false); return; }
      showToast(isNew ? "✅ Article created" : "✅ Article updated");
      setEditSlug(null);
      load();
    } catch { setFormErr("Network error"); }
    setSaving(false);
  }

  async function doDelete(slug: string) {
    try {
      const r = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`, {
        method: "DELETE", headers: { "x-admin-id": adminId },
      });
      if (!r.ok) { const d = await r.json(); showToast((d as { error?: string }).error ?? "Delete failed"); return; }
      showToast("✅ Article deleted");
      setDeleteSlug(null);
      load();
    } catch { showToast("Delete failed"); }
  }

  const apiSlugs = new Set(posts.map((p) => p.slug));
  const staticOnly = GEM_POSTS.filter((p) => !apiSlugs.has(p.slug))
    .filter((p) => !staticSearch.trim() || p.title.toLowerCase().includes(staticSearch.toLowerCase()) || p.gem.toLowerCase().includes(staticSearch.toLowerCase()));

  const editorOpen = editSlug !== null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Gem Guide Articles</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{posts.length} API-managed · {GEM_POSTS.length - posts.filter(p => GEM_POSTS.some(g => g.slug === p.slug)).length + posts.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          {toast && <div className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">{toast}</div>}
          <button onClick={openNew} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">+ New Article</button>
        </div>
      </div>

      {/* API-managed posts table */}
      <div className="bg-white rounded-xl border border-border overflow-x-auto mb-8">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 border-b border-border">
            <tr>{["Title", "Gem", "Category", "Updated", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No API-managed articles yet. Import a static article or create a new one.</td></tr>
            ) : posts.map((p) => (
              <tr key={p.slug} className="border-b border-border last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <div className="font-medium line-clamp-1">{p.title}</div>
                  <div className="text-xs text-muted-foreground">/gems/{p.slug}</div>
                </td>
                <td className="px-4 py-3 text-sm">{p.gem}</td>
                <td className="px-4 py-3"><Badge color="blue">{p.category}</Badge></td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{p.publishedAt}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    <a href={`/gems/${p.slug}`} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-border rounded-md font-medium">👁 View</a>
                    <button onClick={() => openEdit(p, false)} className="text-xs px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-border rounded-md font-medium">✏ Edit</button>
                    {deleteSlug === p.slug ? (
                      <>
                        <button onClick={() => setDeleteSlug(null)} className="text-xs px-2 py-1 border border-border rounded-md font-medium text-muted-foreground">Cancel</button>
                        <button onClick={() => doDelete(p.slug)} className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white border border-red-700 rounded-md font-semibold">Confirm Delete</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteSlug(p.slug)} className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded-md font-medium">🗑 Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Static-only posts (expandable) */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowStatic((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-slate-50 transition-colors"
        >
          <span>📚 Static Articles ({GEM_POSTS.filter((p) => !apiSlugs.has(p.slug)).length} articles — edit to customise)</span>
          <span className="text-muted-foreground">{showStatic ? "▲" : "▼"}</span>
        </button>
        {showStatic && (
          <div className="border-t border-border">
            <div className="px-5 py-3">
              <input
                value={staticSearch}
                onChange={(e) => setStaticSearch(e.target.value)}
                placeholder="Search static articles…"
                className="form-input text-sm w-full max-w-sm"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>{["Title", "Gem", "Category", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {staticOnly.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-sm">No matching articles</td></tr>
                  ) : staticOnly.map((p) => (
                    <tr key={p.slug} className="border-b border-border last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium line-clamp-1">{p.title}</div>
                        <div className="text-xs text-muted-foreground">/gems/{p.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{p.gem}</td>
                      <td className="px-4 py-3"><Badge color="gray">{p.category}</Badge></td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(p, true)} className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-medium">Import & Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Full Article Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditSlug(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="font-bold text-base">{isNew ? "New Article" : `Edit: ${form.title || editSlug}`}</h3>
              <button onClick={() => setEditSlug(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-6">

              {/* ── Meta ── */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Article Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">Title *</label>
                    <input value={form.title} onChange={(e) => setField("title", e.target.value)} className="form-input w-full" placeholder="The Sapphire Trade: A Complete Guide" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Slug (URL path) *</label>
                    <input value={form.slug} onChange={(e) => setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="form-input w-full font-mono text-xs" placeholder="sapphire-trade-guide" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">/gems/{form.slug || "your-slug"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Published Date</label>
                    <input type="date" value={form.publishedAt} onChange={(e) => setField("publishedAt", e.target.value)} className="form-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Gem</label>
                    <input list="gem-suggestions" value={form.gem} onChange={(e) => setField("gem", e.target.value)} className="form-input w-full" placeholder="Sapphire" />
                    <datalist id="gem-suggestions">{GEM_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Category</label>
                    <select value={form.category} onChange={(e) => setField("category", e.target.value)} className="form-select w-full">
                      {GEM_CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">Subtitle / Deck</label>
                    <input value={form.subtitle} onChange={(e) => setField("subtitle", e.target.value)} className="form-input w-full" placeholder="A short compelling description shown on the article card" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">Cover Image URL</label>
                    <input value={form.coverImage} onChange={(e) => setField("coverImage", e.target.value)} className="form-input w-full" placeholder="https://upload.wikimedia.org/…" />
                    {form.coverImage && (
                      <img src={form.coverImage} alt="cover preview" className="mt-2 h-24 w-full object-cover rounded-lg border border-border" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">SEO Description</label>
                    <textarea value={form.seoDescription} onChange={(e) => setField("seoDescription", e.target.value)} rows={2} className="form-input w-full resize-none" placeholder="Short meta description for search engines (150–160 characters)" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Reading Time (minutes)</label>
                    <input type="number" min={1} max={60} value={form.readingMinutes} onChange={(e) => setField("readingMinutes", e.target.value)} className="form-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Tags (comma-separated)</label>
                    <input value={form.tags} onChange={(e) => setField("tags", e.target.value)} className="form-input w-full" placeholder="sapphire, corundum, ceylon, grading" />
                  </div>
                </div>
              </div>

              {/* ── Quick Facts ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Quick Facts</p>
                  <button onClick={addFact} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-border rounded-md font-medium">+ Add Fact</button>
                </div>
                {form.facts.length === 0 && <p className="text-xs text-muted-foreground italic">No facts yet. Quick facts appear in the teal box at the top of the article.</p>}
                <div className="space-y-2">
                  {form.facts.map((f, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={f.label} onChange={(e) => setFact(i, "label", e.target.value)} className="form-input flex-1 text-sm" placeholder="Label (e.g. Hardness)" />
                      <input value={f.value} onChange={(e) => setFact(i, "value", e.target.value)} className="form-input flex-1 text-sm" placeholder="Value (e.g. 9 Mohs)" />
                      <button onClick={() => removeFact(i)} className="text-red-500 hover:text-red-700 px-1.5 py-1 shrink-0 text-sm">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Sections ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Article Sections</p>
                  <button onClick={addSection} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-border rounded-md font-medium">+ Add Section</button>
                </div>
                <div className="space-y-4">
                  {form.sections.map((s, i) => (
                    <div key={i} className="border border-border rounded-xl p-4 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">Section {i + 1}</span>
                        <div className="flex gap-1">
                          <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-xs px-1.5 py-0.5 border border-border rounded disabled:opacity-30">↑</button>
                          <button onClick={() => moveSection(i, 1)} disabled={i === form.sections.length - 1} className="text-xs px-1.5 py-0.5 border border-border rounded disabled:opacity-30">↓</button>
                          <button onClick={() => removeSection(i)} className="text-xs px-1.5 py-0.5 text-red-500 hover:text-red-700 border border-red-200 rounded">✕</button>
                        </div>
                      </div>
                      <input value={s.heading} onChange={(e) => setSection(i, "heading", e.target.value)} className="form-input w-full mb-2 font-medium" placeholder="Section heading" />
                      <textarea value={s.body} onChange={(e) => setSection(i, "body", e.target.value)} rows={5} className="form-input w-full resize-y text-sm leading-relaxed" placeholder="Section body text. Write in plain paragraphs — this text appears directly on the article page." />
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {formErr && <div className="mx-6 mb-3 text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">{formErr}</div>}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditSlug(null)} className="flex-1 py-2.5 text-sm border border-border rounded-xl text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-60">
                {saving ? "Saving…" : isNew ? "Create Article" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminReferrals({ adminId }: { adminId: string }) {
  type ReferralStats = {
    total: number;
    pending: number;
    successful: number;
    top_referrers: Array<{ user_id: string; name: string; email: string; pending: number; successful: number; credits_earned: number }>;
    recent_referrals: Array<{ id: string; status: string; created_at: string; completed_at: string | null; referrer_name: string; referrer_email: string; referred_name: string; referred_email: string }>;
  };
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminFetch("/admin/referrals", adminId)
      .then((d) => { setStats(d as ReferralStats); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminId]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading referral stats…</div>;
  if (!stats) return <div className="p-8 text-center text-destructive">Failed to load referral data.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">🎁 Referral Program</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Referrals", value: stats.total, color: "blue" },
          { label: "Pending", value: stats.pending, color: "amber" },
          { label: "Successful", value: stats.successful, color: "green" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-border rounded-2xl p-5">
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Top referrers */}
      {stats.top_referrers.length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Top Referrers</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-center">Pending</th>
                <th className="px-4 py-2 text-center">Successful</th>
                <th className="px-4 py-2 text-center">Credits Earned</th>
              </tr>
            </thead>
            <tbody>
              {stats.top_referrers.map((r) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.email}</td>
                  <td className="px-4 py-2 text-center text-amber-600">{r.pending}</td>
                  <td className="px-4 py-2 text-center text-green-600 font-semibold">{r.successful}</td>
                  <td className="px-4 py-2 text-center font-bold text-primary">{r.credits_earned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent referrals */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Recent Referrals</h2>
        </div>
        {stats.recent_referrals.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted-foreground">No referrals yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Referrer</th>
                <th className="px-4 py-2 text-left">Referred User</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_referrals.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <p className="font-medium">{r.referrer_name}</p>
                    <p className="text-xs text-muted-foreground">{r.referrer_email}</p>
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium">{r.referred_name}</p>
                    <p className="text-xs text-muted-foreground">{r.referred_email}</p>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${r.status === "successful" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {r.status === "successful" ? "✓ Rewarded" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminDisputes({ adminId }: { adminId: string }) {
  type Dispute = import("@/lib/api").Dispute;
  type DisputeStatus = import("@/lib/api").DisputeStatus;
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolveStatus, setResolveStatus] = useState<DisputeStatus>("resolved_buyer");
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);
  const [filter, setFilter] = useState<DisputeStatus | "all">("all");

  const load = useCallback(() => {
    setLoading(true);
    api.fetchAdminDisputes(adminId)
      .then(setDisputes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  async function handleResolve() {
    if (!selected) return;
    setResolving(true);
    try {
      await api.resolveDispute(adminId, selected.id, resolveStatus, resolution.trim() || undefined);
      setSelected(null);
      setResolution("");
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setResolving(false);
    }
  }

  const statusColor: Record<DisputeStatus, string> = {
    open: "red",
    investigating: "yellow",
    resolved_buyer: "green",
    resolved_seller: "blue",
    dismissed: "gray",
  };

  const filtered = filter === "all" ? disputes : disputes.filter((d) => d.status === filter);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">⚑ Trade Disputes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{disputes.length} total dispute{disputes.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={load} className="text-sm px-3 py-1.5 border border-border rounded-lg hover:bg-slate-50">↻ Refresh</button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["all", "open", "investigating", "resolved_buyer", "resolved_seller", "dismissed"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filter === s ? "bg-slate-800 text-white border-slate-800" : "bg-white border-border text-muted-foreground hover:text-foreground"}`}>
            {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading disputes…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">🕊️</div>
          <p className="font-medium">No disputes found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                {["Filed", "Deal ID", "Complainant", "Reason", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.deal_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-xs">{d.complainant_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-xs max-w-[180px] truncate" title={d.reason}>{d.reason}</td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor[d.status]}>{d.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setSelected(d); setResolveStatus("resolved_buyer"); setResolution(d.resolution ?? ""); }}
                      className="text-xs px-2.5 py-1 border border-border rounded-md hover:bg-slate-100 font-medium">
                      {d.status === "open" || d.status === "investigating" ? "Resolve" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolve modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-base mb-1">Dispute Resolution</h2>
            <p className="text-xs text-muted-foreground mb-4">Deal {selected.deal_id.slice(0, 8)}…</p>
            <div className="mb-4">
              <p className="text-xs font-semibold mb-1 text-muted-foreground">REASON</p>
              <p className="text-sm bg-slate-50 border border-border rounded-lg p-3">{selected.reason}</p>
            </div>
            {selected.evidence && (
              <div className="mb-4">
                <p className="text-xs font-semibold mb-1 text-muted-foreground">EVIDENCE</p>
                <p className="text-sm bg-slate-50 border border-border rounded-lg p-3">{selected.evidence}</p>
              </div>
            )}
            <div className="mb-4">
              <label className="text-xs font-semibold text-muted-foreground block mb-1">RESOLUTION STATUS</label>
              <select value={resolveStatus} onChange={(e) => setResolveStatus(e.target.value as DisputeStatus)} className="form-input w-full">
                <option value="resolved_buyer">Resolved — Buyer Favoured</option>
                <option value="resolved_seller">Resolved — Seller Favoured</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground block mb-1">RESOLUTION NOTE (optional)</label>
              <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} className="form-input w-full text-sm resize-none" placeholder="Explain the decision…" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelected(null)} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleResolve} disabled={resolving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {resolving ? "Saving…" : "Confirm Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [adminId, setAdminId] = useState(() => localStorage.getItem("gw_admin_id") ?? "");
  const [adminName, setAdminName] = useState(() => localStorage.getItem("gw_admin_name") ?? "Admin");
  const [view, setView] = useState<AdminView>("dashboard");
  const [unread, setUnread] = useState(0);

  function handleAdminLogin(id: string, name: string) {
    localStorage.setItem("gw_admin_id", id);
    localStorage.setItem("gw_admin_name", name);
    setAdminId(id);
    setAdminName(name);
  }

  function handleAdminLogout() {
    localStorage.removeItem("gw_admin_id");
    localStorage.removeItem("gw_admin_name");
    setAdminId("");
    setAdminName("Admin");
  }

  // Validate the stored session on every mount (catches stale IDs after server restarts)
  useEffect(() => {
    const id = localStorage.getItem("gw_admin_id");
    if (!id) return;
    fetch(`${API}/admin/dashboard`, {
      headers: { "Content-Type": "application/json", "x-admin-id": id },
    }).then((r) => {
      if (r.status === 401 || r.status === 403) {
        handleAdminLogout();
      }
    }).catch(() => {
      // Network error — keep session, will retry on next action
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!adminId) {
    return <AdminLogin onLogin={handleAdminLogin} />;
  }

  const VIEW_LABELS: Record<AdminView, { title: string; subtitle: string }> = {
    dashboard:     { title: "Dashboard",      subtitle: "Platform overview and recent activity" },
    users:         { title: "Users",          subtitle: "Manage registered accounts" },
    verifications: { title: "Verifications",  subtitle: "Review and approve dealer applications" },
    listings:      { title: "Listings",       subtitle: "Browse and moderate gem listings" },
    transactions:  { title: "Transactions",   subtitle: "Payment records and overdue tracking" },
    subscriptions: { title: "Plans",          subtitle: "Subscription and billing management" },
    support:       { title: "Support",        subtitle: "Open tickets and customer requests" },
    blogs:         { title: "Blogs",          subtitle: "Knowledge base and gem guides" },
    referrals:     { title: "Referrals",      subtitle: "Referral codes and rewards" },
    comms:         { title: "Broadcast",      subtitle: "Send emails and WhatsApp messages" },
    featured:      { title: "Featured Listings", subtitle: "Manage ad-promoted and boosted listings" },
    auctions:      { title: "Auction Listings",  subtitle: "Live and completed gem auctions" },
    crm:           { title: "CRM",            subtitle: "Prospective dealer pipeline" },
    sales_team:    { title: "Sales Team",      subtitle: "Internal staff accounts & access" },
    settings:      { title: "Settings",       subtitle: "Platform configuration" },
  };

  const { title, subtitle } = VIEW_LABELS[view];

  return (
    <div className="min-h-screen flex bg-[#f5f8fa]">
      <AdminSidebar
        view={view} setView={setView} adminName={adminName} unread={unread}
        onLogout={handleAdminLogout}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-[#e5e7eb] px-8 py-3.5 flex items-center gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-[#1a1a1a] leading-tight">{title}</h1>
            <p className="text-xs text-[#9ca3af] mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span>Live</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {view === "dashboard" && <AdminDashboard adminId={adminId} onUnreadChange={setUnread} />}
          {view === "users" && <AdminUsers adminId={adminId} />}
          {view === "verifications" && <AdminVerifications adminId={adminId} />}
          {view === "listings" && <AdminListings adminId={adminId} />}
          {view === "transactions" && <AdminTransactions adminId={adminId} />}
          {view === "subscriptions" && <AdminSubscriptions adminId={adminId} />}
          {view === "support" && <AdminSupportTickets adminId={adminId} />}
          {view === "blogs" && <AdminBlogs adminId={adminId} />}
          {view === "referrals" && <AdminReferrals adminId={adminId} />}
          {view === "comms" && <AdminComms adminId={adminId} />}
          {view === "featured" && <AdminFeatured adminId={adminId} />}
          {view === "auctions" && <AdminAuctions adminId={adminId} />}
          {view === "crm" && <AdminCRM adminId={adminId} />}
          {view === "sales_team" && <AdminSalesTeam adminId={adminId} />}
          {view === "disputes" && <AdminDisputes adminId={adminId} />}
          {view === "settings" && <AdminSettings adminId={adminId} />}
        </main>
      </div>
    </div>
  );
}
