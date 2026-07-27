import { useState, useEffect, useCallback } from "react";
import { api, type CrmProspect, type SalesUserPublic, type SalesDashboard } from "@/lib/api";
import CsvImportModal, { type ImportedProspect } from "@/components/CsvImportModal";

// ── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    gray:   "bg-slate-100 text-slate-600 border-slate-200",
    purple: "bg-violet-50 text-violet-700 border-violet-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${map[color] ?? map.gray}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: string }) {
  const accent: Record<string, string> = {
    blue:   "from-blue-500 to-blue-600",
    green:  "from-emerald-500 to-emerald-600",
    purple: "from-violet-500 to-violet-600",
    amber:  "from-amber-500 to-orange-500",
    slate:  "from-slate-400 to-slate-500",
  };
  const text: Record<string, string> = { blue: "text-blue-600", green: "text-emerald-600", purple: "text-violet-600", amber: "text-amber-600", slate: "text-slate-600" };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${accent[color] ?? accent.slate}`} />
      <div className="p-5 flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent[color] ?? accent.slate} flex items-center justify-center text-lg shrink-0 shadow-sm`}>{icon}</div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-2xl font-bold ${text[color] ?? text.slate}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function statusColor(s: string) {
  const map: Record<string, string> = { prospect: "blue", contacted: "yellow", demo: "purple", onboarded: "green", declined: "red", converted: "green" };
  return map[s] ?? "gray";
}

// ── Login ────────────────────────────────────────────────────────────────────

function SalesLogin({ onLogin }: { onLogin: (user: SalesUserPublic) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const user = await api.salesAgentLogin(email.trim().toLowerCase(), password);
      localStorage.setItem("sales_user", JSON.stringify(user));
      onLogin(user);
    } catch (e: any) {
      setErr(e.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-xl">💼</div>
          <h1 className="text-2xl font-bold text-white">Sales Portal</h1>
          <p className="text-slate-400 text-sm mt-1">LuckyBirthstone Internal Staff</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-6 space-y-4">
          {err && <div className="text-red-300 bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-sm">{err}</div>}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">Email</label>
            <input
              type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm shadow-lg hover:shadow-indigo-500/30 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50 transition-all"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200/80">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 rounded-t-2xl">
          <h3 className="font-bold text-sm text-white tracking-wide">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-sm font-bold transition-colors">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── WA Templates (for CRM messaging) ─────────────────────────────────────────

const CRM_WA_TEMPLATES = [
  { id: "prospects_outreach", label: "🌟 Prospects Outreach", description: "Introduce LuckyBirthstone to prospects. Recipient name is auto-filled — no other inputs needed.", fields: [] as { key: string; label: string; placeholder: string }[], preview: (p: Record<string,string>) => `Hi ${p.name || "{name}"},\n\nMeet Gems Stones Dealers worldwide - manage accounts, trade, auction, chat or just be there..\n\nIt's free!!\n\nluckybirthstone.com` },
  { id: "listing_reminder", label: "💎 Listing Reminder", description: "Remind verified sellers to list their gemstones. Recipient name is auto-filled.", fields: [{ key: "url", label: "Dashboard URL", placeholder: "https://luckybirthstone.com/dashboard" }], preview: (p: Record<string,string>) => `Hi ${p.name || "{name}"} 👋\n\nYour LuckyBirthstone account is verified! Start listing your gems:\n${p.url||"[url]"}\n\nReply STOP to opt out.` },
];

const inp = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

// ── Add/Edit Prospect Modal ──────────────────────────────────────────────────

type ProspectForm = { name: string; company: string; phone: string; email: string; notes: string; status: CrmProspect["status"] };
const STATUS_OPTIONS: CrmProspect["status"][] = ["prospect", "contacted", "demo", "onboarded", "declined", "converted"];

function ProspectModal({ prospect, salesId, onSave, onClose }: { prospect?: CrmProspect; salesId: string; onSave: (p: CrmProspect) => void; onClose: () => void }) {
  const [form, setForm] = useState<ProspectForm>({
    name: prospect?.name ?? "",
    company: prospect?.company ?? "",
    phone: prospect?.phone ?? "",
    email: prospect?.email ?? "",
    notes: prospect?.notes ?? "",
    status: prospect?.status ?? "prospect",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.name.trim() || !form.company.trim()) { setErr("Name and company are required"); return; }
    setSaving(true); setErr(null);
    try {
      let saved: CrmProspect;
      if (prospect) {
        saved = await api.updateSalesCrmProspect(salesId, prospect.id, { ...form, phone: form.phone || null, email: form.email || null, notes: form.notes || null });
      } else {
        saved = await api.createSalesCrmProspect(salesId, { ...form, phone: form.phone || null, email: form.email || null, notes: form.notes || null });
      }
      onSave(saved);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={prospect ? "Edit Prospect" : "Add Prospect"} onClose={onClose}>
      {err && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{err}</div>}
      <div className="space-y-3">
        {([["name","Contact Name","John Doe"],["company","Company","Gem Palace Co."],["phone","Phone",""],["email","Email",""]] as [keyof ProspectForm, string, string][]).map(([key, label, ph]) => (
          <div key={key}>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{label}</label>
            <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={ph}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        ))}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Status</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CrmProspect["status"] }))}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </div>
      </div>
      <div className="flex gap-3 justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Saving…" : prospect ? "Update" : "Create"}
        </button>
      </div>
    </Modal>
  );
}

// ── Convert Modal ────────────────────────────────────────────────────────────

function ConvertModal({ prospect, salesId, onDone, onClose }: { prospect: CrmProspect; salesId: string; onDone: (p: CrmProspect) => void; onClose: () => void }) {
  const [form, setForm] = useState({ user_type: "buyer", address: "", city: "", country: "Thailand" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; temp_password: string } | null>(null);

  const handleConvert = async () => {
    setSaving(true); setErr(null);
    try {
      const res = await api.convertSalesCrmProspect(salesId, prospect.id, form);
      setResult({ email: res.email, temp_password: res.temp_password });
      onDone({ ...prospect, status: "converted", converted_user_id: res.user_id });
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Convert: ${prospect.name}`} onClose={onClose}>
      {result ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="font-semibold text-emerald-700 mb-2">Account created successfully!</p>
            <p className="text-sm text-slate-600"><span className="font-semibold">Email:</span> {result.email}</p>
            <p className="text-sm text-slate-600"><span className="font-semibold">Temp Password:</span> <code className="bg-white px-2 py-0.5 rounded border text-slate-800">{result.temp_password}</code></p>
          </div>
          <button onClick={onClose} className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Close</button>
        </div>
      ) : (
        <>
          {err && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{err}</div>}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Account Type</label>
              <select value={form.user_type} onChange={(e) => setForm((f) => ({ ...f, user_type: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="both">Buyer & Seller</option>
              </select>
            </div>
            {[["address","Address"],["city","City"],["country","Country"]] .map(([k,l]) => (
              <div key={k}>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{l}</label>
                <input value={(form as any)[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleConvert} disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Converting…" : "Convert to Account"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── CRM Table ────────────────────────────────────────────────────────────────

function SalesCRM({ salesId }: { salesId: string }) {
  const [prospects, setProspects] = useState<CrmProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editProspect, setEditProspect] = useState<CrmProspect | "new" | null>(null);
  const [convertProspect, setConvertProspect] = useState<CrmProspect | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Messaging
  const [messageProspect, setMessageProspect] = useState<CrmProspect | null>(null);
  const [msgChannel, setMsgChannel] = useState<"email" | "whatsapp">("whatsapp");
  const [msgTemplateId, setMsgTemplateId] = useState("prospects_outreach");
  const [msgParams, setMsgParams] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [msgResult, setMsgResult] = useState<"sent" | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await api.getSalesCrmProspects(salesId); setProspects(data); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [salesId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = prospects.filter((p) => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q) || (p.phone ?? "").includes(q) || (p.email ?? "").toLowerCase().includes(q);
    const matchS = filterStatus === "all" || p.status === filterStatus;
    return matchQ && matchS;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this prospect?")) return;
    setDeletingId(id);
    try { await api.deleteSalesCrmProspect(salesId, id); setProspects((prev) => prev.filter((p) => p.id !== id)); }
    catch (e: any) { setErr(e.message); }
    finally { setDeletingId(null); }
  };

  const handleSave = (saved: CrmProspect) => {
    setProspects((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      return idx >= 0 ? prev.map((p, i) => (i === idx ? saved : p)) : [saved, ...prev];
    });
    setEditProspect(null);
  };

  const handleConverted = (updated: CrmProspect) => {
    setProspects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setConvertProspect(null);
  };

  function openMessage(p: CrmProspect) {
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
      await api.messageSalesCrmProspect(salesId, messageProspect.id, { channel: msgChannel, template_id: msgTemplateId, params: msgParams });
      setMsgResult("sent");
    } catch (e: any) {
      setMsgError(e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onImport={async (rows: ImportedProspect[]) => {
            const res = await api.importSalesCrmProspects(salesId, rows);
            void load();
            return res;
          }}
        />
      )}
      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, company, phone…"
          className="flex-1 min-w-48 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button onClick={() => setShowImport(true)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5">
          📥 Import
        </button>
        <button onClick={() => setEditProspect("new")} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow hover:shadow-md transition-all">
          + Add Prospect
        </button>
      </div>

      {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{err}</div>}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">🎯</div>
          <p className="font-semibold text-slate-600">No prospects found</p>
          <p className="text-sm mt-1">{prospects.length === 0 ? "Add your first prospect." : "Try adjusting your search."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                {["Name", "Company", "Contact", "Status", "Notes", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.company}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {p.phone && <div>{p.phone}</div>}
                    {p.email && <div className="text-indigo-600">{p.email}</div>}
                    {!p.phone && !p.email && "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{p.notes || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => setEditProspect(p)} className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200">Edit</button>
                      <button onClick={() => openMessage(p)} className="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200">Send</button>
                      {p.status !== "converted" && (
                        <button onClick={() => setConvertProspect(p)} className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">Convert</button>
                      )}
                      <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                        className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50">
                        {deletingId === p.id ? "…" : "Del"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editProspect !== null && (
        <ProspectModal
          prospect={editProspect === "new" ? undefined : editProspect}
          salesId={salesId}
          onSave={handleSave}
          onClose={() => setEditProspect(null)}
        />
      )}
      {convertProspect && (
        <ConvertModal prospect={convertProspect} salesId={salesId} onDone={handleConverted} onClose={() => setConvertProspect(null)} />
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
                <button onClick={() => { setMsgResult(null); setMsgParams({}); }} className="px-4 py-2 border border-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-50">Send Another</button>
                <button onClick={() => setMessageProspect(null)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">Done</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Channel selector */}
              <div className="flex gap-2">
                {(["whatsapp", "email"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => { setMsgChannel(ch); setMsgTemplateId(ch === "whatsapp" ? "prospects_outreach" : "email"); setMsgParams({}); setMsgError(null); }}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors ${msgChannel === ch ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:bg-slate-50 text-slate-500"}`}
                  >
                    {ch === "whatsapp" ? "💬 WhatsApp" : "📧 Email"}
                  </button>
                ))}
              </div>

              {/* Contact info bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm flex flex-wrap gap-4">
                <span className="text-slate-500 font-medium">{messageProspect.company}</span>
                {messageProspect.email
                  ? <span className="text-slate-700">{messageProspect.email}</span>
                  : <span className="text-red-500 text-xs">No email</span>}
                {messageProspect.phone
                  ? <span className="text-slate-700">{messageProspect.phone}</span>
                  : <span className="text-amber-500 text-xs">No phone</span>}
              </div>

              {msgError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">❌ {msgError}</div>}

              {msgChannel === "email" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Subject</label>
                    <input value={msgParams["subject"] ?? ""} onChange={(e) => setMsgParams((p) => ({ ...p, subject: e.target.value }))} className={inp} placeholder="Invitation to join LuckyBirthstone Marketplace" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Message Body</label>
                    <textarea
                      value={msgParams["body"] ?? ""}
                      onChange={(e) => setMsgParams((p) => ({ ...p, body: e.target.value }))}
                      className={inp}
                      rows={6}
                      placeholder={`Hi ${messageProspect.name},\n\nWe'd like to invite you to join LuckyBirthstone...\n\nBest,\nLuckyBirthstone Team`}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Template</label>
                    <select value={msgTemplateId} onChange={(e) => { setMsgTemplateId(e.target.value); setMsgParams({}); }} className={inp}>
                      {CRM_WA_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">{CRM_WA_TEMPLATES.find((t) => t.id === msgTemplateId)?.description}</p>
                  </div>
                  {(() => {
                    const tpl = CRM_WA_TEMPLATES.find((t) => t.id === msgTemplateId);
                    if (!tpl) return null;
                    return (
                      <div className="space-y-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                          Recipient name is auto-filled as <strong>{messageProspect.name}</strong>
                        </div>
                        {tpl.fields.map((f) => (
                          <div key={f.key}>
                            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">{f.label}</label>
                            <input value={msgParams[f.key] ?? ""} onChange={(e) => setMsgParams((p) => ({ ...p, [f.key]: e.target.value }))} className={inp} placeholder={f.placeholder} />
                          </div>
                        ))}
                        <div className="bg-[#dcf8c6] border border-green-200 rounded-xl px-4 py-3 text-sm font-mono whitespace-pre-wrap text-slate-800">
                          {tpl.preview({ ...msgParams, name: messageProspect.name })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSendMessage}
                  disabled={sending || (msgChannel === "whatsapp" && !messageProspect.phone) || (msgChannel === "email" && (!msgParams["subject"]?.trim() || !msgParams["body"]?.trim() || !messageProspect.email))}
                  className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {sending ? "Sending…" : msgChannel === "whatsapp" ? "💬 Send WhatsApp" : "📧 Send Email"}
                </button>
                <button onClick={() => setMessageProspect(null)} className="px-4 py-2.5 border border-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function SalesDashboardView({ salesId, salesName }: { salesId: string; salesName: string }) {
  const [dash, setDash] = useState<SalesDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"dashboard" | "crm">("dashboard");

  useEffect(() => {
    api.salesAgentDashboard(salesId).then(setDash).catch((e) => setErr(e.message));
  }, [salesId]);

  const NAV = [
    { id: "dashboard" as const, icon: "▣", label: "Dashboard" },
    { id: "crm" as const, icon: "◎", label: "CRM Pipeline" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 flex flex-col min-h-screen">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-sm">💼</div>
            <span className="font-bold text-white text-sm">Sales Portal</span>
          </div>
          <p className="text-slate-400 text-xs pl-10">LuckyBirthstone</p>
        </div>
        <div className="px-3 py-4 flex-1">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2 px-2">Navigation</p>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium mb-0.5 transition-all text-left ${
                view === item.id
                  ? "bg-white/15 text-white border-l-2 border-indigo-400 pl-2.5"
                  : "text-slate-400 hover:text-white hover:bg-white/8"
              }`}
            >
              <span className="text-base opacity-80">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-slate-300 text-xs font-semibold">{salesName}</p>
          <button
            onClick={() => { localStorage.removeItem("sales_user"); window.location.reload(); }}
            className="text-slate-500 text-xs hover:text-white mt-0.5 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-900">{view === "dashboard" ? "Dashboard" : "CRM Pipeline"}</h1>
            <p className="text-slate-400 text-xs mt-0.5">{view === "dashboard" ? "Your performance overview" : "Manage prospective dealer accounts"}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-500">Live</span>
          </div>
        </header>

        <main className="flex-1 p-8">
          {view === "dashboard" && (
            <div className="space-y-6">
              {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{err}</div>}
              {!dash ? (
                <div className="text-center py-16 text-slate-400">Loading dashboard…</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Prospects" value={dash.total_prospects} icon="◎" color="blue" />
                    <StatCard label="Demo Stage" value={dash.by_status.demo ?? 0} icon="◆" color="purple" />
                    <StatCard label="Onboarded" value={dash.by_status.onboarded ?? 0} icon="◉" color="green" />
                    <StatCard label="Converted" value={dash.by_status.converted ?? 0} icon="◈" color="amber" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Verified Sellers" value={dash.platform.verified_sellers} icon="✓" color="green" sub="Platform total" />
                    <StatCard label="Active Listings" value={dash.platform.active_listings} icon="◆" color="slate" sub="Platform total" />
                  </div>

                  {/* Pipeline summary */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <h2 className="font-bold text-slate-800 mb-4 text-sm">Pipeline Breakdown</h2>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {STATUS_OPTIONS.map((s) => (
                        <div key={s} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <p className="text-xl font-bold text-slate-800">{dash.by_status[s] ?? 0}</p>
                          <Badge color={statusColor(s)}>{s}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent prospects */}
                  {dash.recent_prospects.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-800 text-sm">Recent Prospects</h2>
                        <button onClick={() => setView("crm")} className="text-indigo-600 text-xs font-semibold hover:underline">View all →</button>
                      </div>
                      <div className="space-y-2">
                        {dash.recent_prospects.map((p) => (
                          <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                              <p className="text-slate-500 text-xs">{p.company}</p>
                            </div>
                            <Badge color={statusColor(p.status)}>{p.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {view === "crm" && <SalesCRM salesId={salesId} />}
        </main>
      </div>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const [user, setUser] = useState<SalesUserPublic | null>(() => {
    try {
      const stored = localStorage.getItem("sales_user");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  if (!user) return <SalesLogin onLogin={setUser} />;
  return <SalesDashboardView salesId={user.id} salesName={user.name} />;
}
