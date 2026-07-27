import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  api, fmtCurrency, convertPrice,
  type Currency, type TradeContact, type Gemstone,
  type TradeInvoice, type InvoiceItem, type TradePayment, type TradeAnalytics,
  type SalesRecord, type PayableRecord, type LedgerPayment, type SalesSummary, type PayablesSummary,
  type ApprovalRequest, type AstrobotLead,
} from "@/lib/api";

import { SentOnApproval, ReceivedOnApproval, MyListings } from "@/pages/ApprovalsPage";
import DashboardPage from "@/pages/DashboardPage";

function sumInCurrency(byCurrency: Record<string, number> | undefined, toCurrency: Currency): number {
  if (!byCurrency) return 0;
  return Object.entries(byCurrency).reduce((sum, [from, amount]) => {
    return sum + convertPrice(amount, from as Currency, toCurrency);
  }, 0);
}

// ─── Auth helper ─────────────────────────────────────────────────────────────
function useCurrentUser() {
  const userId = localStorage.getItem("gw_user_id") ?? "";
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });
  if (profile?.email_verified && localStorage.getItem("gw_email_verified") !== "true") {
    localStorage.setItem("gw_email_verified", "true");
  }
  return {
    userId,
    isLoading: !!userId && isLoading,
    plan: profile?.subscription_plan ?? "basic",
    name: profile?.company_name ?? profile?.owner_name ?? "",
    defaultCurrency: (profile?.default_currency ?? "USD") as Currency,
  };
}

const CURRENCIES = ["USD", "INR", "AED", "THB"] as const;

// ─── Plan Gate ───────────────────────────────────────────────────────────────
function PlanGate() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Premium Feature</h2>
        <p className="text-muted-foreground mb-6">My Business is available on Pro and Premium plans. Upgrade to access contacts, deals, invoicing, and analytics.</p>
        <Link href="/plans">
          <button className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-semibold hover:opacity-90 transition">View Plans →</button>
        </Link>
      </div>
    </div>
  );
}

// ─── Status badges ────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  partial: "bg-blue-100 text-blue-700",
  cancelled: "bg-slate-200 text-slate-500",
};
const CONTACT_TYPE_STYLES: Record<string, string> = {
  buyer: "bg-sky-100 text-sky-700",
  supplier: "bg-violet-100 text-violet-700",
  partner: "bg-amber-100 text-amber-700",
};

function Badge({ label, style }: { label: string; style: string }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${style}`}>{label}</span>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
const selectCls = `${inputCls} bg-white`;

// ════════════════════════════════════════════════════════════════════════════
// CONTACTS TAB
// ════════════════════════════════════════════════════════════════════════════

function ContactsTab({ userId, onNewApproval, onViewContact }: { userId: string; onNewApproval?: (contactId: string) => void; onViewContact?: (c: TradeContact) => void }) {
  const qc = useQueryClient();
  const { data: contacts = [], isLoading } = useQuery<TradeContact[]>({
    queryKey: ["trm-contacts", userId],
    queryFn: () => api.trm.getContacts(userId),
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<TradeContact | null>(null);

  const blankForm = { name: "", company_name: "", type: "buyer" as TradeContact["type"], source: "external" as TradeContact["source"], is_platform_user: false, platform_user_id: "", phone: "", email: "", notes: "", tags: "" };
  const [form, setForm] = useState(blankForm);
  const [inviteModal, setInviteModal] = useState<TradeContact | null>(null);
  const [inviteResult, setInviteResult] = useState<{ whatsapp_link: string | null; email_sent: boolean } | null>(null);
  const inviteMut = useMutation({
    mutationFn: (c: TradeContact) => api.trm.invite(userId, { name: c.name, phone: c.phone ?? undefined, email: c.email ?? undefined }),
    onSuccess: (r) => setInviteResult(r),
  });

  const createMut = useMutation({
    mutationFn: (data: Partial<TradeContact>) => api.trm.createContact(userId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trm-contacts", userId] }); setModal(null); setForm(blankForm); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TradeContact> }) => api.trm.updateContact(userId, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trm-contacts", userId] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.trm.deleteContact(userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trm-contacts", userId] }),
  });

  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags)));
  const filtered = contacts.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (tagFilter && !c.tags.includes(tagFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.company_name.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
    }
    return true;
  });

  function openEdit(c: TradeContact) {
    setEditing(c);
    setForm({ name: c.name, company_name: c.company_name, type: c.type, source: c.source ?? "external", is_platform_user: c.is_platform_user ?? false, platform_user_id: c.platform_user_id ?? "", phone: c.phone || "", email: c.email || "", notes: c.notes || "", tags: c.tags.join(", ") });
    setModal("edit");
  }

  function submitForm() {
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = { ...form, tags, is_platform_user: form.is_platform_user, platform_user_id: form.platform_user_id || null };
    if (modal === "add") createMut.mutate(payload);
    else if (modal === "edit" && editing) updateMut.mutate({ id: editing.id, data: payload });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts…" className={`${inputCls} max-w-xs`} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${selectCls} w-auto`}>
          <option value="all">All types</option>
          <option value="buyer">Buyer</option>
          <option value="supplier">Supplier</option>
          <option value="partner">Partner</option>
        </select>
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={`${selectCls} w-auto`}>
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <button onClick={() => { setModal("add"); setForm(blankForm); }} className="ml-auto bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition">+ Add Contact</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-14 text-muted-foreground"><span className="spinner mr-2" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <div className="text-4xl mb-2">📋</div>
          <p className="font-medium">No contacts yet. Add your first contact to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name / Company</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Tags</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={`border-t border-border hover:bg-slate-50 transition ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => onViewContact?.(c)} className="font-semibold text-slate-800 hover:text-primary hover:underline text-left transition-colors">{c.name}</button>
                    <p className="text-xs text-muted-foreground">{c.company_name}</p>
                    <span className={`mt-0.5 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${c.is_platform_user ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                      {c.is_platform_user ? "Platform User" : "External Contact"}
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge label={c.type} style={CONTACT_TYPE_STYLES[c.type] ?? "bg-slate-100 text-slate-700"} /></td>
                  <td className="px-4 py-3">
                    {c.email && <p className="text-xs">{c.email}</p>}
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => <span key={t} className="text-[10px] bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">{t}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => onNewApproval?.(c.id)} className="text-xs text-teal-600 hover:underline mr-2 font-semibold">+ Approval</button>
                    {!c.is_platform_user && (c.phone || c.email) && (
                      <button onClick={() => { setInviteModal(c); setInviteResult(null); }} className="text-xs text-violet-600 hover:underline mr-2">Invite</button>
                    )}
                    <button onClick={() => openEdit(c)} className="text-xs text-primary hover:underline mr-2">Edit</button>
                    <button onClick={() => { if (confirm("Delete contact?")) deleteMut.mutate(c.id); }} className="text-xs text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === "add" ? "Add Contact" : "Edit Contact"} onClose={() => setModal(null)}>
          <FormField label="Name *">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Contact name" />
          </FormField>
          <FormField label="Company">
            <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={inputCls} placeholder="Company name" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TradeContact["type"] })} className={selectCls}>
                <option value="buyer">Buyer</option>
                <option value="supplier">Supplier</option>
                <option value="partner">Partner</option>
              </select>
            </FormField>
            <FormField label="Source">
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as TradeContact["source"], is_platform_user: e.target.value === "platform" })} className={selectCls}>
                <option value="external">External</option>
                <option value="platform">Platform User</option>
              </select>
            </FormField>
          </div>
          {form.source === "platform" && (
            <FormField label="Platform User ID (optional)">
              <input value={form.platform_user_id} onChange={(e) => setForm({ ...form, platform_user_id: e.target.value })} className={inputCls} placeholder="User UUID for auto-linking" />
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="+1 234 567 890" />
            </FormField>
            <FormField label="Email">
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="email@example.com" />
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputCls} resize-none`} rows={2} placeholder="Optional notes…" />
          </FormField>
          <FormField label="Tags (comma separated)">
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={inputCls} placeholder="VIP, high risk, retailer…" />
          </FormField>
          <div className="flex gap-3 mt-2">
            <button onClick={submitForm} disabled={createMut.isPending || updateMut.isPending} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 font-semibold hover:opacity-90 disabled:opacity-50 transition">
              {createMut.isPending || updateMut.isPending ? "Saving…" : modal === "add" ? "Add Contact" : "Save Changes"}
            </button>
            <button onClick={() => setModal(null)} className="flex-1 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Cancel</button>
          </div>
        </Modal>
      )}
      {inviteModal && (
        <Modal title={`Invite ${inviteModal.name} to Platform`} onClose={() => { setInviteModal(null); setInviteResult(null); }}>
          {!inviteResult ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">Send an invitation to <strong>{inviteModal.name}</strong> ({inviteModal.company_name}) to join LuckyBirthstone.</p>
              {inviteModal.phone && (
                <div className="mb-3 p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
                  <p className="text-xs font-semibold text-green-700 mb-1">📱 WhatsApp</p>
                  <p className="text-xs text-slate-600 mb-2">{inviteModal.phone}</p>
                  <button
                    onClick={() => inviteMut.mutate(inviteModal)}
                    disabled={inviteMut.isPending}
                    className="w-full bg-green-600 text-white text-xs rounded-lg py-2 font-semibold hover:bg-green-700 transition"
                  >
                    {inviteMut.isPending ? "Sending…" : "Send WhatsApp Invite"}
                  </button>
                </div>
              )}
              {inviteModal.email && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                  <p className="text-xs font-semibold text-blue-700 mb-1">✉️ Email</p>
                  <p className="text-xs text-slate-600 mb-2">{inviteModal.email}</p>
                  <button
                    onClick={() => inviteMut.mutate(inviteModal)}
                    disabled={inviteMut.isPending}
                    className="w-full bg-blue-600 text-white text-xs rounded-lg py-2 font-semibold hover:bg-blue-700 transition"
                  >
                    {inviteMut.isPending ? "Sending…" : "Send Email Invite"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🎉</div>
              <p className="font-semibold text-slate-800 mb-2">Invitation sent!</p>
              {inviteResult.whatsapp_link && (
                <a href={inviteResult.whatsapp_link} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline block mb-1">Open in WhatsApp ↗</a>
              )}
              {inviteResult.email_sent && <p className="text-xs text-muted-foreground">Email delivered ✓</p>}
              <button onClick={() => { setInviteModal(null); setInviteResult(null); }} className="mt-4 bg-primary text-primary-foreground rounded-lg px-6 py-2 text-sm font-semibold">Done</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// INVOICES TAB
// ════════════════════════════════════════════════════════════════════════════

// ─── PDF generation (print-to-PDF via new window) ────────────────────────────
function printInvoicePdf(invoice: TradeInvoice, ownerName: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Please allow pop-ups to generate PDFs."); return; }
  const itemRows = invoice.items.map((it) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${it.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${it.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${invoice.currency} ${it.unit_price.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${invoice.currency} ${it.total.toFixed(2)}</td>
    </tr>`
  ).join("");
  const balanceDue = invoice.total_amount - invoice.amount_paid;
  const statusClass: Record<string, string> = { pending: "badge-pending", paid: "badge-paid", overdue: "badge-overdue", partial: "badge-partial", cancelled: "badge-cancelled" };
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice ${invoice.invoice_number}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#f8fafc}.page{max-width:800px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}.hdr{background:#1e40af;color:white;padding:32px 40px;display:flex;justify-content:space-between;align-items:flex-start}.body{padding:32px 40px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}.lbl{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:24px}thead tr{background:#f8fafc}th{padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}th:not(:first-child){text-align:right}.totals{margin-left:auto;width:240px}.tr{display:flex;justify-content:space-between;padding:5px 0;font-size:14px}.tr-final{font-weight:700;font-size:16px;padding-top:10px;margin-top:8px;border-top:2px solid #1e40af}.tr-bal{color:#b45309;font-weight:600}.tr-paid{color:#059669}.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;text-transform:uppercase}.badge-pending{background:#fef3c7;color:#92400e}.badge-paid{background:#d1fae5;color:#065f46}.badge-overdue{background:#fee2e2;color:#991b1b}.badge-partial{background:#dbeafe;color:#1e40af}.badge-cancelled{background:#f1f5f9;color:#64748b}.notes{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;white-space:pre-wrap}.footer{text-align:center;margin-top:32px;font-size:11px;color:#9ca3af}@media print{body{background:white}.page{margin:0;box-shadow:none;border-radius:0}}</style>
</head><body>
<div class="page">
  <div class="hdr">
    <div><h1 style="font-size:24px;font-weight:700;letter-spacing:.05em">INVOICE</h1><p style="opacity:.75;font-size:14px;margin-top:4px">${invoice.invoice_number}</p></div>
    <div style="text-align:right"><p style="font-weight:600;font-size:15px">${ownerName}</p><p style="opacity:.75;font-size:12px">via LuckyBirthstone</p></div>
  </div>
  <div class="body">
    <div class="info-grid">
      <div><p class="lbl">Bill To</p><p style="font-weight:600;font-size:15px">${invoice.buyer_name}</p>${invoice.buyer_company ? `<p style="color:#6b7280;font-size:13px">${invoice.buyer_company}</p>` : ""}${invoice.buyer_email ? `<p style="font-size:13px">${invoice.buyer_email}</p>` : ""}${invoice.buyer_phone ? `<p style="font-size:13px">${invoice.buyer_phone}</p>` : ""}${invoice.buyer_address ? `<p style="color:#6b7280;font-size:12px;margin-top:4px;white-space:pre-wrap">${invoice.buyer_address}</p>` : ""}</div>
      <div style="text-align:right"><div style="margin-bottom:12px"><p class="lbl">Invoice Date</p><p style="font-size:14px">${invoice.created_at.slice(0, 10)}</p></div><div style="margin-bottom:12px"><p class="lbl">Due Date</p><p style="font-size:14px;font-weight:600;color:#b45309">${invoice.due_date}</p></div><span class="badge ${statusClass[invoice.status] ?? "badge-pending"}">${invoice.status}</span></div>
    </div>
    <table><thead><tr><th>Description</th><th style="text-align:center">Carats / ct</th><th style="text-align:right">Price per carat</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemRows}</tbody></table>
    <div class="totals">
      <div class="tr"><span style="color:#6b7280">Subtotal</span><span>${invoice.currency} ${invoice.subtotal.toFixed(2)}</span></div>
      ${invoice.tax_rate > 0 ? `<div class="tr"><span style="color:#6b7280">Tax (${invoice.tax_rate}%)</span><span>${invoice.currency} ${invoice.tax_amount.toFixed(2)}</span></div>` : ""}
      <div class="tr tr-final"><span>Total</span><span>${invoice.currency} ${invoice.total_amount.toFixed(2)}</span></div>
      ${invoice.amount_paid > 0 ? `<div class="tr tr-paid"><span>Amount Paid</span><span>${invoice.currency} ${invoice.amount_paid.toFixed(2)}</span></div>` : ""}
      ${balanceDue > 0 && invoice.status !== "cancelled" ? `<div class="tr tr-bal"><span>Balance Due</span><span>${invoice.currency} ${balanceDue.toFixed(2)}</span></div>` : ""}
    </div>
    ${invoice.notes ? `<div class="notes">${invoice.notes}</div>` : ""}
    <div class="footer">Generated by LuckyBirthstone · luckybirthstone.com</div>
  </div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
  win.document.close();
}

function InvoicePreview({ invoice, ownerName, onPdf }: { invoice: TradeInvoice; ownerName: string; onPdf: () => void }) {
  const wa = invoice.buyer_phone
    ? `https://wa.me/${invoice.buyer_phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi ${invoice.buyer_name}, please find invoice ${invoice.invoice_number} for ${invoice.currency} ${invoice.total_amount.toFixed(2)}. Due: ${invoice.due_date}. Sent via LuckyBirthstone.`)}`
    : null;
  const balanceDue = invoice.total_amount - invoice.amount_paid;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-primary text-white px-5 py-4 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-wide">INVOICE</h2>
            <p className="opacity-80 text-sm font-mono mt-0.5">{invoice.invoice_number}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-sm sm:text-base">{ownerName}</p>
            <p className="text-xs opacity-75">via LuckyBirthstone</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 sm:px-8 sm:py-6">
        {/* Bill To + Invoice Info */}
        <div className="flex flex-col sm:flex-row sm:gap-6 gap-4 mb-6">
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Bill To</p>
            <p className="font-semibold text-slate-800">{invoice.buyer_name}</p>
            {invoice.buyer_company && <p className="text-sm text-muted-foreground">{invoice.buyer_company}</p>}
            {invoice.buyer_email && <p className="text-sm">{invoice.buyer_email}</p>}
            {invoice.buyer_phone && <p className="text-sm">{invoice.buyer_phone}</p>}
            {invoice.buyer_address && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{invoice.buyer_address}</p>}
          </div>
          <div className="sm:text-right flex flex-row sm:flex-col gap-4 sm:gap-2 flex-wrap">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Created</p>
              <p className="text-sm">{invoice.created_at.slice(0, 10)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Due Date</p>
              <p className="text-sm font-semibold text-amber-700">{invoice.due_date}</p>
            </div>
            <div><Badge label={invoice.status} style={STATUS_STYLES[invoice.status] ?? ""} /></div>
          </div>
        </div>

        {/* Line items — stacked cards on mobile, table on sm+ */}
        <div className="mb-6">
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {invoice.items.map((item) => (
              <div key={item.id} className="bg-slate-50 rounded-lg p-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 leading-snug">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.quantity} ct × {invoice.currency} {item.unit_price.toFixed(2)}</p>
                </div>
                <p className="text-sm font-semibold text-slate-800 shrink-0">{invoice.currency} {item.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <table className="w-full text-sm hidden sm:table">
            <thead>
              <tr className="bg-slate-50 text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2 text-left rounded-tl-lg">Description</th>
                <th className="px-3 py-2 text-center">Carats / ct</th>
                <th className="px-3 py-2 text-right">Price per carat</th>
                <th className="px-3 py-2 text-right rounded-tr-lg">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="px-3 py-2">{item.description}</td>
                  <td className="px-3 py-2 text-center">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">{invoice.currency} {item.unit_price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-medium">{invoice.currency} {item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <div className="w-full sm:w-56 space-y-1 bg-slate-50 sm:bg-transparent rounded-lg p-3 sm:p-0">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{invoice.currency} {invoice.subtotal.toFixed(2)}</span></div>
            {invoice.tax_rate > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span><span>{invoice.currency} {invoice.tax_amount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-base font-bold border-t border-border pt-1.5"><span>Total</span><span>{invoice.currency} {invoice.total_amount.toFixed(2)}</span></div>
            {invoice.amount_paid > 0 && <div className="flex justify-between text-sm text-green-700"><span>Paid</span><span>{invoice.currency} {invoice.amount_paid.toFixed(2)}</span></div>}
            {balanceDue > 0 && invoice.status !== "cancelled" && <div className="flex justify-between text-sm font-semibold text-amber-700"><span>Balance Due</span><span>{invoice.currency} {balanceDue.toFixed(2)}</span></div>}
          </div>
        </div>

        {invoice.notes && <p className="text-sm text-muted-foreground border-t pt-3 whitespace-pre-wrap">{invoice.notes}</p>}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border/50">
          <button onClick={onPdf} className="flex items-center gap-1.5 text-sm border border-border rounded-lg px-3 py-2 hover:bg-secondary transition font-medium">
            ⬇ Download PDF
          </button>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm bg-green-600 text-white rounded-lg px-3 py-2 hover:opacity-90 transition font-medium">
              📱 WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InvoicesTab({ userId, ownerName }: { userId: string; ownerName: string }) {
  const qc = useQueryClient();
  const { data: invoices = [], isLoading } = useQuery<TradeInvoice[]>({
    queryKey: ["trm-invoices", userId],
    queryFn: () => api.trm.getInvoices(userId),
  });
  const { data: contacts = [] } = useQuery<TradeContact[]>({
    queryKey: ["trm-contacts", userId],
    queryFn: () => api.trm.getContacts(userId),
  });

  const [view, setView] = useState<"list" | "create" | "edit" | "detail">("list");
  const [selectedInvoice, setSelectedInvoice] = useState<TradeInvoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sendEmailModal, setSendEmailModal] = useState<TradeInvoice | null>(null);
  const [emailAddr, setEmailAddr] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const blankItem = (): Partial<InvoiceItem> => ({ description: "", quantity: 1, unit_price: 0 });
  const blankForm = {
    contact_id: "", buyer_name: "", buyer_company: "", buyer_email: "", buyer_phone: "", buyer_address: "",
    currency: "USD", tax_rate: "0", due_date: "", notes: "",
    items: [blankItem()] as Partial<InvoiceItem>[],
  };
  const [form, setForm] = useState(blankForm);

  const createMut = useMutation({
    mutationFn: (data: any) => api.trm.createInvoice(userId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trm-invoices", userId] }); setView("list"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TradeInvoice> }) => api.trm.updateInvoice(userId, id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["trm-invoices", userId] });
      if (view === "edit") {
        setSelectedInvoice(updated);
        setView("detail");
      }
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.trm.deleteInvoice(userId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trm-invoices", userId] }); setView("list"); },
  });

  const filtered = invoices.filter((inv) => statusFilter === "all" || inv.status === statusFilter);

  function addItem() { setForm((f) => ({ ...f, items: [...f.items, blankItem()] })); }
  function removeItem(i: number) { setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); }
  function updateItem(i: number, field: string, value: string) {
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: field === "quantity" || field === "unit_price" ? Number(value) : value };
      return { ...f, items };
    });
  }
  const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const taxAmt = subtotal * (Number(form.tax_rate) || 0) / 100;
  const total = subtotal + taxAmt;

  function pickContact(contactId: string) {
    const c = contacts.find((x) => x.id === contactId);
    if (!c) { setForm((f) => ({ ...f, contact_id: "" })); return; }
    setForm((f) => ({
      ...f,
      contact_id: contactId,
      buyer_name: f.buyer_name || c.name,
      buyer_company: f.buyer_company || (c.company_name ?? ""),
      buyer_email: f.buyer_email || (c.email ?? ""),
      buyer_phone: f.buyer_phone || (c.phone ?? ""),
    }));
  }

  function openCreate() {
    setForm(blankForm);
    setView("create");
  }

  function openEdit(inv: TradeInvoice) {
    setForm({
      contact_id: inv.contact_id ?? "",
      buyer_name: inv.buyer_name,
      buyer_company: inv.buyer_company,
      buyer_email: inv.buyer_email ?? "",
      buyer_phone: inv.buyer_phone ?? "",
      buyer_address: inv.buyer_address ?? "",
      currency: inv.currency,
      tax_rate: String(inv.tax_rate),
      due_date: inv.due_date,
      notes: inv.notes ?? "",
      items: inv.items.map((it) => ({ ...it })),
    });
    setSelectedInvoice(inv);
    setView("edit");
  }

  function submitCreate() {
    createMut.mutate({
      ...form,
      tax_rate: Number(form.tax_rate) || 0,
      items: form.items,
      due_date: form.due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    });
  }

  function submitEdit() {
    if (!selectedInvoice) return;
    updateMut.mutate({
      id: selectedInvoice.id,
      data: {
        ...form,
        tax_rate: Number(form.tax_rate) || 0,
        items: form.items as InvoiceItem[],
        due_date: form.due_date || selectedInvoice.due_date,
      },
    });
  }

  async function handleSendEmail() {
    if (!sendEmailModal) return;
    setSendingEmail(true);
    try {
      await api.trm.sendInvoiceEmail(userId, sendEmailModal.id, emailAddr || undefined);
      setSendEmailModal(null);
      alert("Email sent successfully!");
    } catch { alert("Failed to send email. Please check the email address."); }
    finally { setSendingEmail(false); }
  }

  if (isLoading) return <div className="flex justify-center py-14 text-muted-foreground"><span className="spinner mr-2" /> Loading…</div>;

  // ── DETAIL VIEW ──
  if (view === "detail" && selectedInvoice) {
    const inv = invoices.find((i) => i.id === selectedInvoice.id) ?? selectedInvoice;
    const canEdit = inv.status !== "paid" && inv.status !== "cancelled";
    return (
      <div>
        <button onClick={() => setView("list")} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1">← Back to Invoices</button>
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => { setSendEmailModal(inv); setEmailAddr(inv.buyer_email || ""); }} className="text-sm border border-border rounded-lg px-3 py-2 hover:bg-secondary transition">📧 Email</button>
          {canEdit && (
            <button onClick={() => openEdit(inv)} className="text-sm border border-primary/40 text-primary rounded-lg px-3 py-2 hover:bg-primary/5 transition">✏️ Edit</button>
          )}
          {canEdit && (
            <button onClick={() => updateMut.mutate({ id: inv.id, data: { amount_paid: inv.total_amount } })} className="text-sm bg-green-600 text-white rounded-lg px-3 py-2 hover:opacity-90 transition">✓ Mark Paid</button>
          )}
          {inv.status !== "paid" && inv.status !== "cancelled" && (
            <button onClick={() => { if (confirm("Cancel this invoice? This cannot be undone.")) updateMut.mutate({ id: inv.id, data: { status: "cancelled" as const } }); }} className="text-sm text-amber-700 border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-50 transition">✕ Cancel Invoice</button>
          )}
          {inv.status !== "paid" && (
            <button onClick={() => { if (confirm("Permanently delete this invoice?")) deleteMut.mutate(inv.id); }} className="text-sm text-red-500 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition ml-auto">🗑 Delete</button>
          )}
        </div>
        <InvoicePreview invoice={inv} ownerName={ownerName} onPdf={() => printInvoicePdf(inv, ownerName)} />
        {sendEmailModal && (
          <Modal title="Send Invoice by Email" onClose={() => setSendEmailModal(null)}>
            <p className="text-sm text-muted-foreground mb-4">Send invoice <strong>{sendEmailModal.invoice_number}</strong> to:</p>
            <FormField label="Email Address">
              <input value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)} className={inputCls} placeholder="buyer@example.com" type="email" />
            </FormField>
            <div className="flex gap-3">
              <button onClick={handleSendEmail} disabled={sendingEmail} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 font-semibold hover:opacity-90 disabled:opacity-50 transition">{sendingEmail ? "Sending…" : "Send Email"}</button>
              <button onClick={() => setSendEmailModal(null)} className="flex-1 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Cancel</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ── CREATE / EDIT FORM ──
  if (view === "create" || view === "edit") {
    const isEdit = view === "edit";
    return (
      <div>
        <button onClick={() => isEdit ? setView("detail") : setView("list")} className="text-sm text-primary hover:underline mb-4">← {isEdit ? "Back to Invoice" : "Back to Invoices"}</button>
        <div className="max-w-2xl">
          <h3 className="font-bold text-slate-800 mb-4">{isEdit ? "Edit Invoice" : "Create New Invoice"}</h3>

          {/* Contact picker */}
          {contacts.length > 0 && (
            <FormField label="Link to Contact (optional)">
              <select value={form.contact_id} onChange={(e) => pickContact(e.target.value)} className={selectCls}>
                <option value="">— Select a contact —</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` · ${c.company_name}` : ""}</option>)}
              </select>
            </FormField>
          )}

          {/* Buyer details — 1 col on mobile, 2 on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Buyer Name *">
              <input value={form.buyer_name} onChange={(e) => setForm((f) => ({ ...f, buyer_name: e.target.value }))} className={inputCls} placeholder="Full name" />
            </FormField>
            <FormField label="Company">
              <input value={form.buyer_company} onChange={(e) => setForm((f) => ({ ...f, buyer_company: e.target.value }))} className={inputCls} placeholder="Company name" />
            </FormField>
            <FormField label="Email">
              <input value={form.buyer_email} onChange={(e) => setForm((f) => ({ ...f, buyer_email: e.target.value }))} className={inputCls} placeholder="buyer@company.com" type="email" />
            </FormField>
            <FormField label="Phone / WhatsApp">
              <input value={form.buyer_phone} onChange={(e) => setForm((f) => ({ ...f, buyer_phone: e.target.value }))} className={inputCls} placeholder="+66 12 345 6789" />
            </FormField>
          </div>
          <FormField label="Billing Address">
            <textarea value={form.buyer_address} onChange={(e) => setForm((f) => ({ ...f, buyer_address: e.target.value }))} className={`${inputCls} resize-none`} rows={2} />
          </FormField>

          {/* Line items */}
          <div className="border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm">Line Items</p>
              <button onClick={addItem} className="text-xs text-primary font-medium hover:underline">+ Add Item</button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-2.5 relative">
                  <input
                    value={item.description || ""}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    className={`${inputCls} mb-2`}
                    placeholder="Description (e.g. 2ct Ruby, Burma, Unheated)"
                  />
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Carats / ct</p>
                      <input type="number" value={item.quantity ?? 1} onChange={(e) => updateItem(i, "quantity", e.target.value)} className={inputCls} min={0} step={0.01} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Price per carat</p>
                      <input type="number" value={item.unit_price ?? ""} onChange={(e) => updateItem(i, "unit_price", e.target.value)} className={inputCls} min={0} placeholder="0.00" />
                    </div>
                    <div className="pt-5">
                      <button onClick={() => removeItem(i)} disabled={form.items.length === 1} className="w-8 h-8 flex items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition text-lg">×</button>
                    </div>
                  </div>
                  {(Number(item.quantity) || 0) * (Number(item.unit_price) || 0) > 0 && (
                    <p className="text-xs text-right text-primary font-semibold mt-1.5">{form.currency} {((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border text-right text-sm space-y-1">
              <p className="text-muted-foreground">Subtotal: <strong>{form.currency} {subtotal.toFixed(2)}</strong></p>
              {Number(form.tax_rate) > 0 && <p className="text-muted-foreground">Tax ({form.tax_rate}%): <strong>{form.currency} {taxAmt.toFixed(2)}</strong></p>}
              <p className="font-bold text-base text-slate-800">Total: {form.currency} {total.toFixed(2)}</p>
            </div>
          </div>

          {/* Settings row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <FormField label="Currency">
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={selectCls}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Tax Rate (%)">
              <input type="number" value={form.tax_rate} onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))} className={inputCls} min={0} max={100} step={0.1} />
            </FormField>
            <div className="col-span-2 sm:col-span-1">
              <FormField label="Due Date">
                <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className={inputCls} />
              </FormField>
            </div>
          </div>

          <FormField label="Notes / Payment Terms">
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={`${inputCls} resize-none`} rows={2} placeholder="Bank details, payment instructions, etc." />
          </FormField>

          <div className="flex gap-3 pt-1">
            <button
              onClick={isEdit ? submitEdit : submitCreate}
              disabled={(isEdit ? updateMut.isPending : createMut.isPending) || !form.buyer_name.trim()}
              className="flex-1 bg-primary text-primary-foreground rounded-lg py-3 font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              {(isEdit ? updateMut.isPending : createMut.isPending) ? "Saving…" : isEdit ? "Save Changes" : "Create Invoice"}
            </button>
            <button onClick={() => isEdit ? setView("detail") : setView("list")} className="flex-1 border border-border rounded-lg py-3 text-muted-foreground hover:bg-secondary transition">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${selectCls} w-auto`}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={openCreate} className="ml-auto bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition">+ Create Invoice</button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <div className="text-4xl mb-2">📄</div>
          <p className="font-medium">No invoices yet. Create your first.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map((inv) => {
              const canEdit = inv.status !== "paid" && inv.status !== "cancelled";
              return (
                <div key={inv.id} className="bg-white rounded-xl border border-border p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <button onClick={() => { setSelectedInvoice(inv); setView("detail"); }} className="font-mono text-primary font-semibold text-sm hover:underline">{inv.invoice_number}</button>
                      <p className="font-medium text-slate-800 text-sm mt-0.5">{inv.buyer_name}</p>
                      {inv.buyer_company && <p className="text-xs text-muted-foreground">{inv.buyer_company}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-800">{inv.currency} {inv.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <Badge label={inv.status} style={STATUS_STYLES[inv.status] ?? ""} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>Due {inv.due_date}</span>
                    {inv.amount_paid > 0 && <span className="text-green-700 font-medium">Paid {inv.currency} {inv.amount_paid.toFixed(2)}</span>}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <button onClick={() => { setSelectedInvoice(inv); setView("detail"); }} className="flex-1 text-xs font-medium border border-border rounded-lg py-1.5 hover:bg-secondary transition">View</button>
                    {canEdit && <button onClick={() => openEdit(inv)} className="flex-1 text-xs font-medium border border-primary/30 text-primary rounded-lg py-1.5 hover:bg-primary/5 transition">Edit</button>}
                    {canEdit && <button onClick={() => updateMut.mutate({ id: inv.id, data: { amount_paid: inv.total_amount } })} className="flex-1 text-xs font-medium bg-green-600 text-white rounded-lg py-1.5 hover:opacity-90 transition">Mark Paid</button>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-left">Buyer</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const canEdit = inv.status !== "paid" && inv.status !== "cancelled";
                  return (
                    <tr key={inv.id} className="border-t border-border hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <button onClick={() => { setSelectedInvoice(inv); setView("detail"); }} className="font-mono text-primary hover:underline font-medium">{inv.invoice_number}</button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{inv.buyer_name}</p>
                        {inv.buyer_company && <p className="text-xs text-muted-foreground">{inv.buyer_company}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{inv.currency} {inv.total_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{inv.amount_paid > 0 ? `${inv.currency} ${inv.amount_paid.toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-3 text-sm">{inv.due_date}</td>
                      <td className="px-4 py-3"><Badge label={inv.status} style={STATUS_STYLES[inv.status] ?? ""} /></td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button onClick={() => { setSelectedInvoice(inv); setView("detail"); }} className="text-xs text-primary hover:underline">View</button>
                        {canEdit && <button onClick={() => openEdit(inv)} className="text-xs text-slate-600 hover:underline">Edit</button>}
                        {canEdit && <button onClick={() => updateMut.mutate({ id: inv.id, data: { amount_paid: inv.total_amount } })} className="text-xs text-green-600 hover:underline">Mark Paid</button>}
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <button onClick={() => { if (confirm("Cancel this invoice?")) updateMut.mutate({ id: inv.id, data: { status: "cancelled" as const } }); }} className="text-xs text-amber-600 hover:underline">Cancel</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAYMENTS TAB
// ════════════════════════════════════════════════════════════════════════════

function PaymentsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<TradePayment[]>({
    queryKey: ["trm-payments", userId],
    queryFn: () => api.trm.getPayments(userId),
  });
  const { data: invoices = [] } = useQuery<TradeInvoice[]>({
    queryKey: ["trm-invoices", userId],
    queryFn: () => api.trm.getInvoices(userId),
  });

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ invoice_id: "", amount_paid: "", currency: "USD", payment_date: new Date().toISOString().slice(0, 10), method: "", notes: "" });

  const createMut = useMutation({
    mutationFn: (data: any) => api.trm.recordPayment(userId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trm-payments", userId] });
      qc.invalidateQueries({ queryKey: ["trm-invoices", userId] });
      setModal(false);
      setForm({ invoice_id: "", amount_paid: "", currency: "USD", payment_date: new Date().toISOString().slice(0, 10), method: "", notes: "" });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.trm.deletePayment(userId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trm-payments", userId] });
      qc.invalidateQueries({ queryKey: ["trm-invoices", userId] });
    },
  });

  const openInvoices = invoices.filter((inv) => inv.status !== "paid");

  if (paymentsLoading) return <div className="flex justify-center py-14 text-muted-foreground"><span className="spinner mr-2" /> Loading…</div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setModal(true)} className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition">+ Record Payment</button>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <div className="text-4xl mb-2">💰</div>
          <p className="font-medium">No payments recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((p) => {
                const inv = invoices.find((i) => i.id === p.invoice_id);
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-medium">{inv?.invoice_number || p.invoice_id.slice(0, 8)}</p>
                      {inv && <p className="text-xs text-muted-foreground">{inv.buyer_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{p.currency} {p.amount_paid.toFixed(2)}</td>
                    <td className="px-4 py-3">{p.payment_date}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.method || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { if (confirm("Delete payment record?")) deleteMut.mutate(p.id); }} className="text-xs text-red-500 hover:underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title="Record Payment" onClose={() => setModal(false)}>
          <FormField label="Invoice *">
            <select value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })} className={selectCls}>
              <option value="">Select invoice…</option>
              {openInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.buyer_name} ({inv.currency} {(inv.total_amount - inv.amount_paid).toFixed(2)} due)</option>
              ))}
              {invoices.filter((inv) => inv.status === "paid").map((inv) => (
                <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.buyer_name} (paid)</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount Paid *">
              <input type="number" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} className={inputCls} min={0} placeholder="0.00" />
            </FormField>
            <FormField label="Currency">
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={selectCls}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Payment Date">
              <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} className={inputCls} />
            </FormField>
            <FormField label="Method">
              <input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={inputCls} placeholder="Bank transfer, cash, etc." />
            </FormField>
          </div>
          <FormField label="Notes">
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} placeholder="Optional notes…" />
          </FormField>
          <div className="flex gap-3">
            <button onClick={() => createMut.mutate({ ...form, amount_paid: Number(form.amount_paid) })} disabled={createMut.isPending || !form.invoice_id || !form.amount_paid} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 font-semibold hover:opacity-90 disabled:opacity-50 transition">
              {createMut.isPending ? "Saving…" : "Record Payment"}
            </button>
            <button onClick={() => setModal(false)} className="flex-1 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SALES TAB (RECEIVABLES)
// ════════════════════════════════════════════════════════════════════════════

const PAYMENT_MODES = ["cash", "bank", "online", "other"] as const;
const LEDGER_STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  partial: "bg-blue-100 text-blue-700",
};

function SalesTab({ userId, defaultCurrency }: { userId: string; defaultCurrency: Currency }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<"add" | "edit" | "payments" | "remind" | null>(null);
  const [selected, setSelected] = useState<SalesRecord | null>(null);
  const [reminderResult, setReminderResult] = useState<{ whatsapp_link: string | null; email_sent: boolean; message: string } | null>(null);

  const { data: records = [], isLoading } = useQuery<SalesRecord[]>({
    queryKey: ["sales-ledger", userId, filter],
    queryFn: () => api.sl.list(userId, filter),
  });
  const { data: payments = [] } = useQuery<LedgerPayment[]>({
    queryKey: ["sale-payments", selected?.id],
    queryFn: () => selected ? api.sl.getPayments(userId, selected.id) : Promise.resolve([]),
    enabled: !!selected && modal === "payments",
  });

  type SaleForm = { buyer_name: string; buyer_company: string; buyer_phone: string; buyer_email: string; gemstone_name: string; quantity: number; total_amount: number; currency: string; sale_type: "direct" | "approval"; due_date: string; notes: string };
  type PayForm = { amount_paid: number; currency: string; payment_date: string; payment_mode: "cash" | "bank" | "online" | "other"; notes: string };
  const blankSale: SaleForm = { buyer_name: "", buyer_company: "", buyer_phone: "", buyer_email: "", gemstone_name: "", quantity: 1, total_amount: 0, currency: "USD", sale_type: "direct", due_date: "", notes: "" };
  const [saleForm, setSaleForm] = useState<SaleForm>(blankSale);
  const [editForm, setEditForm] = useState<SaleForm>(blankSale);
  const blankPay: PayForm = { amount_paid: 0, currency: "USD", payment_date: new Date().toISOString().slice(0,10), payment_mode: "cash", notes: "" };
  const [payForm, setPayForm] = useState<PayForm>(blankPay);

  const createMut = useMutation({
    mutationFn: (data: Partial<SalesRecord>) => api.sl.create(userId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-ledger", userId] }); setModal(null); setSaleForm(blankSale); },
  });
  const updateMut = useMutation({
    mutationFn: (data: Partial<SalesRecord>) => api.sl.update(userId, selected!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-ledger", userId] }); qc.invalidateQueries({ queryKey: ["sl-records", userId] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.sl.remove(userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales-ledger", userId] }),
  });
  const payMut = useMutation({
    mutationFn: (data: Partial<LedgerPayment>) => api.sl.addPayment(userId, selected!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-ledger", userId] }); qc.invalidateQueries({ queryKey: ["sale-payments", selected?.id] }); qc.invalidateQueries({ queryKey: ["sl-records", userId] }); setPayForm(blankPay); },
  });
  const remindMut = useMutation({
    mutationFn: (id: string) => api.sl.remind(userId, id),
    onSuccess: (r) => setReminderResult(r),
  });

  function openEdit(r: SalesRecord) {
    setSelected(r);
    setEditForm({
      buyer_name: r.buyer_name, buyer_company: r.buyer_company ?? "", buyer_phone: r.buyer_phone ?? "", buyer_email: r.buyer_email ?? "",
      gemstone_name: r.gemstone_name, quantity: r.quantity, total_amount: r.total_amount, currency: r.currency,
      sale_type: r.sale_type as "direct" | "approval", due_date: r.due_date ? r.due_date.slice(0, 10) : "", notes: r.notes ?? "",
    });
    setModal("edit");
  }

  const totalReceivable = records.reduce((s, r) => s + convertPrice(r.outstanding_amount ?? 0, r.currency as Currency, defaultCurrency), 0);
  const overdueCount = records.filter((r) => r.status === "overdue").length;


  return (
    <div>
      {/* Summary row */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: `Total Receivable (${defaultCurrency})`, value: fmtCurrency(Math.round(totalReceivable), defaultCurrency), color: "bg-green-50 border-green-200 text-green-700" },
          { label: "Overdue Records", value: String(overdueCount), color: "bg-red-50 border-red-200 text-red-700" },
          { label: "Total Records", value: String(records.length), color: "bg-blue-50 border-blue-200 text-blue-700" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 min-w-[130px] ${s.color}`}>
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[11px] mt-0.5 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + Add */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {["all","pending","partial","paid","overdue"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{f}</button>
        ))}
        <button onClick={() => { setModal("add"); setSaleForm(blankSale); }} className="ml-auto bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition">+ Add Sale</button>
      </div>

      {isLoading ? <div className="text-center py-10 text-muted-foreground">Loading…</div> : records.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <div className="text-4xl mb-2">📊</div>
          <p className="font-medium">No sales records yet. Add your first sale to start tracking receivables.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Buyer</th>
                <th className="px-4 py-3 text-left">Gemstone</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-slate-50 transition cursor-pointer" onClick={() => openEdit(r)}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.buyer_name}</p>
                    <p className="text-xs text-muted-foreground">{r.buyer_company}</p>
                    {r.buyer_phone && <p className="text-[10px] text-muted-foreground">{r.buyer_phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p>💎 {r.gemstone_name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {r.quantity}</p>
                    {r.due_date && <p className={`text-[10px] ${r.status === "overdue" ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>Due: {new Date(r.due_date).toLocaleDateString()}{r.days_overdue ? ` (${r.days_overdue}d overdue)` : ""}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{r.currency} {r.total_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-700">{r.currency} {r.amount_received.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{r.currency} {(r.outstanding_amount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge label={r.status} style={LEDGER_STATUS_STYLES[r.status]} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(r)} className="text-xs text-primary hover:underline mr-2">Edit</button>
                    <button onClick={() => { setSelected(r); setModal("payments"); }} className="text-xs text-green-700 hover:underline mr-2">Payments</button>
                    <button onClick={() => { setSelected(r); setModal("remind"); setReminderResult(null); remindMut.mutate(r.id); }} className="text-xs text-amber-600 hover:underline mr-2">Remind</button>
                    <button onClick={() => { if (confirm("Delete this sale record?")) deleteMut.mutate(r.id); }} className="text-xs text-red-500 hover:underline">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Sale Modal */}
      {modal === "add" && (
        <Modal title="Add Sale Record" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Buyer Name *"><input value={saleForm.buyer_name} onChange={(e) => setSaleForm((f) => ({...f, buyer_name: e.target.value}))} className={inputCls} placeholder="Raj Gems" /></FormField>
            <FormField label="Company"><input value={saleForm.buyer_company} onChange={(e) => setSaleForm((f) => ({...f, buyer_company: e.target.value}))} className={inputCls} placeholder="Raj Gems Ltd" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Phone"><input value={saleForm.buyer_phone} onChange={(e) => setSaleForm((f) => ({...f, buyer_phone: e.target.value}))} className={inputCls} placeholder="+91 98765 43210" /></FormField>
            <FormField label="Email"><input value={saleForm.buyer_email} onChange={(e) => setSaleForm((f) => ({...f, buyer_email: e.target.value}))} className={inputCls} placeholder="buyer@email.com" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Gemstone *"><input value={saleForm.gemstone_name} onChange={(e) => setSaleForm((f) => ({...f, gemstone_name: e.target.value}))} className={inputCls} placeholder="Ruby" /></FormField>
            <FormField label="Quantity"><input type="number" min={1} value={saleForm.quantity} onChange={(e) => setSaleForm((f) => ({...f, quantity: Number(e.target.value)}))} className={inputCls} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Total Amount *"><input type="number" min={0} value={saleForm.total_amount || ""} onChange={(e) => setSaleForm((f) => ({...f, total_amount: Number(e.target.value)}))} className={inputCls} placeholder="5000" /></FormField>
            <FormField label="Currency">
              <select value={saleForm.currency} onChange={(e) => setSaleForm((f) => ({...f, currency: e.target.value}))} className={selectCls}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sale Type">
              <select value={saleForm.sale_type} onChange={(e) => setSaleForm((f) => ({...f, sale_type: e.target.value as "direct"|"approval"}))} className={selectCls}>
                <option value="direct">Direct</option>
                <option value="approval">Approval-Based</option>
              </select>
            </FormField>
            <FormField label="Payment Due Date"><input type="date" value={saleForm.due_date} onChange={(e) => setSaleForm((f) => ({...f, due_date: e.target.value}))} className={inputCls} /></FormField>
          </div>
          <FormField label="Notes"><textarea value={saleForm.notes} onChange={(e) => setSaleForm((f) => ({...f, notes: e.target.value}))} className={`${inputCls} resize-none`} rows={2} /></FormField>
          <div className="flex gap-3">
            <button onClick={() => createMut.mutate(saleForm)} disabled={createMut.isPending || !saleForm.buyer_name || !saleForm.gemstone_name || !saleForm.total_amount} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 font-semibold hover:opacity-90 disabled:opacity-50 transition">{createMut.isPending ? "Saving…" : "Add Sale"}</button>
            <button onClick={() => setModal(null)} className="flex-1 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Edit Sale Modal */}
      {modal === "edit" && selected && (
        <Modal title={`Edit Sale — ${selected.buyer_name}`} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Buyer Name *"><input value={editForm.buyer_name} onChange={(e) => setEditForm((f) => ({...f, buyer_name: e.target.value}))} className={inputCls} placeholder="Raj Gems" /></FormField>
            <FormField label="Company"><input value={editForm.buyer_company} onChange={(e) => setEditForm((f) => ({...f, buyer_company: e.target.value}))} className={inputCls} placeholder="Raj Gems Ltd" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Phone"><input value={editForm.buyer_phone} onChange={(e) => setEditForm((f) => ({...f, buyer_phone: e.target.value}))} className={inputCls} placeholder="+91 98765 43210" /></FormField>
            <FormField label="Email"><input value={editForm.buyer_email} onChange={(e) => setEditForm((f) => ({...f, buyer_email: e.target.value}))} className={inputCls} placeholder="buyer@email.com" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Gemstone *"><input value={editForm.gemstone_name} onChange={(e) => setEditForm((f) => ({...f, gemstone_name: e.target.value}))} className={inputCls} placeholder="Ruby" /></FormField>
            <FormField label="Quantity"><input type="number" min={1} value={editForm.quantity} onChange={(e) => setEditForm((f) => ({...f, quantity: Number(e.target.value)}))} className={inputCls} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Total Amount *"><input type="number" min={0} value={editForm.total_amount || ""} onChange={(e) => setEditForm((f) => ({...f, total_amount: Number(e.target.value)}))} className={inputCls} placeholder="5000" /></FormField>
            <FormField label="Currency">
              <select value={editForm.currency} onChange={(e) => setEditForm((f) => ({...f, currency: e.target.value}))} className={selectCls}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sale Type">
              <select value={editForm.sale_type} onChange={(e) => setEditForm((f) => ({...f, sale_type: e.target.value as "direct"|"approval"}))} className={selectCls}>
                <option value="direct">Direct</option>
                <option value="approval">Approval-Based</option>
              </select>
            </FormField>
            <FormField label="Payment Due Date"><input type="date" value={editForm.due_date} onChange={(e) => setEditForm((f) => ({...f, due_date: e.target.value}))} className={inputCls} /></FormField>
          </div>
          <FormField label="Notes"><textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({...f, notes: e.target.value}))} className={`${inputCls} resize-none`} rows={2} /></FormField>
          <div className="flex gap-3">
            <button onClick={() => updateMut.mutate(editForm)} disabled={updateMut.isPending || !editForm.buyer_name || !editForm.gemstone_name || !editForm.total_amount} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 font-semibold hover:opacity-90 disabled:opacity-50 transition">{updateMut.isPending ? "Saving…" : "Save Changes"}</button>
            <button onClick={() => { setModal("payments"); }} className="px-4 border border-green-600 text-green-700 rounded-lg py-2 text-sm font-semibold hover:bg-green-50 transition">+ Payment</button>
            <button onClick={() => setModal(null)} className="px-4 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Payments Modal */}
      {modal === "payments" && selected && (
        <Modal title={`Payments — ${selected.buyer_name} (${selected.gemstone_name})`} onClose={() => setModal(null)}>
          <div className="text-sm mb-4 p-3 bg-slate-50 rounded-lg">
            <div className="flex justify-between mb-1"><span>Total:</span><span className="font-semibold">{selected.currency} {selected.total_amount.toLocaleString()}</span></div>
            <div className="flex justify-between mb-1 text-green-700"><span>Received:</span><span className="font-semibold">{selected.currency} {selected.amount_received.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold text-red-600"><span>Outstanding:</span><span>{selected.currency} {(selected.outstanding_amount ?? 0).toLocaleString()}</span></div>
            {selected.due_date && <div className="flex justify-between mt-1 text-amber-700 text-xs"><span>Due Date:</span><span>{new Date(selected.due_date).toLocaleDateString()}</span></div>}
          </div>
          {payments.length > 0 && (
            <div className="mb-4 space-y-1">
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between text-xs bg-green-50 rounded p-2">
                  <span className="font-semibold">{p.currency} {p.amount_paid.toLocaleString()}</span>
                  <span className="text-muted-foreground">{new Date(p.payment_date).toLocaleDateString()} · {p.payment_mode}</span>
                  {p.notes && <span className="text-muted-foreground italic">{p.notes}</span>}
                </div>
              ))}
            </div>
          )}
          <hr className="my-3" />
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Record New Payment</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount *"><input type="number" min={0} value={payForm.amount_paid || ""} onChange={(e) => setPayForm({...payForm, amount_paid: Number(e.target.value)})} className={inputCls} /></FormField>
            <FormField label="Date"><input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({...payForm, payment_date: e.target.value})} className={inputCls} /></FormField>
          </div>
          <FormField label="Mode">
            <select value={payForm.payment_mode} onChange={(e) => setPayForm({...payForm, payment_mode: e.target.value as LedgerPayment["payment_mode"]})} className={selectCls}>
              {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </FormField>
          <FormField label="Notes"><input value={payForm.notes} onChange={(e) => setPayForm({...payForm, notes: e.target.value})} className={inputCls} /></FormField>
          <div className="flex gap-3">
            <button onClick={() => payMut.mutate(payForm)} disabled={payMut.isPending || !payForm.amount_paid} className="flex-1 bg-green-600 text-white rounded-lg py-2 font-semibold hover:bg-green-700 disabled:opacity-50 transition">{payMut.isPending ? "Saving…" : "Record Payment"}</button>
            <button onClick={() => setModal(null)} className="flex-1 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Close</button>
          </div>
        </Modal>
      )}

      {/* Reminder Result Modal */}
      {modal === "remind" && selected && (
        <Modal title="Payment Reminder" onClose={() => setModal(null)}>
          {remindMut.isPending ? <div className="text-center py-6 text-muted-foreground">Sending reminder…</div> : reminderResult ? (
            <div>
              <div className="bg-slate-50 rounded-lg p-4 text-sm mb-4 border">
                <p className="text-xs text-muted-foreground mb-1">Message template:</p>
                <p className="italic">"{reminderResult.message}"</p>
              </div>
              {reminderResult.whatsapp_link && (
                <a href={reminderResult.whatsapp_link} target="_blank" rel="noopener noreferrer" className="block w-full bg-green-600 text-white text-center rounded-lg py-2.5 font-semibold hover:bg-green-700 transition mb-3">📱 Open WhatsApp to Send</a>
              )}
              {reminderResult.email_sent && <p className="text-sm text-center text-green-700 mb-3">✉️ Email reminder sent</p>}
              <button onClick={() => setModal(null)} className="w-full border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Close</button>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RECEIVABLES TAB
// ════════════════════════════════════════════════════════════════════════════

function ReceivablesTab({ userId, defaultCurrency }: { userId: string; defaultCurrency: Currency }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"edit" | "payments" | "remind" | null>(null);
  const [selected, setSelected] = useState<SalesRecord | null>(null);
  const [reminderResult, setReminderResult] = useState<{ whatsapp_link: string | null; email_sent: boolean; message: string } | null>(null);

  const { data: allRecords = [], isLoading } = useQuery<SalesRecord[]>({
    queryKey: ["sales-ledger", userId, "all"],
    queryFn: () => api.sl.list(userId, "all"),
  });
  const { data: contacts = [] } = useQuery<TradeContact[]>({
    queryKey: ["trm-contacts", userId],
    queryFn: () => api.trm.getContacts(userId),
    enabled: !!userId,
  });
  const { data: payments = [] } = useQuery<LedgerPayment[]>({
    queryKey: ["sale-payments", selected?.id],
    queryFn: () => selected ? api.sl.getPayments(userId, selected.id) : Promise.resolve([]),
    enabled: !!selected && modal === "payments",
  });

  const records = allRecords.filter((r) => (r.outstanding_amount ?? 0) > 0);
  const totalReceivableConverted = records.reduce((s, r) => s + convertPrice(r.outstanding_amount ?? 0, r.currency as Currency, defaultCurrency), 0);
  type RcvEditForm = { buyer_name: string; buyer_company: string; buyer_phone: string; buyer_email: string; gemstone_name: string; quantity: number; total_amount: number; currency: string; sale_type: "direct" | "approval"; due_date: string; notes: string };
  type RcvPayForm = { amount_paid: number; currency: string; payment_date: string; payment_mode: "cash" | "bank" | "online" | "other"; notes: string };
  const blankEdit: RcvEditForm = { buyer_name: "", buyer_company: "", buyer_phone: "", buyer_email: "", gemstone_name: "", quantity: 1, total_amount: 0, currency: "USD", sale_type: "direct", due_date: "", notes: "" };
  const [editForm, setEditForm] = useState<RcvEditForm>(blankEdit);
  const blankPay: RcvPayForm = { amount_paid: 0, currency: "USD", payment_date: new Date().toISOString().slice(0,10), payment_mode: "cash", notes: "" };
  const [payForm, setPayForm] = useState<RcvPayForm>(blankPay);

  const updateMut = useMutation({
    mutationFn: (data: Partial<SalesRecord>) => api.sl.update(userId, selected!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-ledger", userId] }); qc.invalidateQueries({ queryKey: ["sl-records", userId] }); setModal(null); },
  });
  const payMut = useMutation({
    mutationFn: (data: Partial<LedgerPayment>) => api.sl.addPayment(userId, selected!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-ledger", userId] }); qc.invalidateQueries({ queryKey: ["sale-payments", selected?.id] }); qc.invalidateQueries({ queryKey: ["sl-records", userId] }); setPayForm(blankPay); },
  });
  const remindMut = useMutation({
    mutationFn: (id: string) => api.sl.remind(userId, id),
    onSuccess: (r) => setReminderResult(r),
  });

  const normName = (s: string) => s.trim().toLowerCase();
  function findContact(r: SalesRecord): TradeContact | undefined {
    return contacts.find((c) =>
      (r.buyer_contact_id && r.buyer_contact_id === c.id) ||
      normName(r.buyer_name) === normName(c.name) ||
      (r.buyer_phone && c.phone && r.buyer_phone.replace(/\D/g,"") === c.phone.replace(/\D/g,"")) ||
      (r.buyer_email && c.email && normName(r.buyer_email) === normName(c.email))
    );
  }

  function openEdit(r: SalesRecord) {
    setSelected(r);
    setEditForm({
      buyer_name: r.buyer_name, buyer_company: r.buyer_company ?? "", buyer_phone: r.buyer_phone ?? "", buyer_email: r.buyer_email ?? "",
      gemstone_name: r.gemstone_name, quantity: r.quantity, total_amount: r.total_amount, currency: r.currency,
      sale_type: r.sale_type as "direct" | "approval", due_date: r.due_date ? r.due_date.slice(0, 10) : "", notes: r.notes ?? "",
    });
    setModal("edit");
  }

  const totalOutstanding = records.reduce((s, r) => s + (r.outstanding_amount ?? 0), 0);
  const overdueCount = records.filter((r) => r.status === "overdue").length;
  const STATUS_CLR: Record<string, string> = { pending: "bg-amber-100 text-amber-700", partial: "bg-blue-100 text-blue-700", paid: "bg-emerald-100 text-emerald-700", overdue: "bg-red-100 text-red-700 font-bold" };

  return (
    <div>
      {/* Summary */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: `Total Outstanding (${defaultCurrency})`, value: fmtCurrency(Math.round(totalReceivableConverted), defaultCurrency), color: "bg-green-50 border-green-200 text-green-700" },
          { label: "Overdue", value: String(overdueCount), color: "bg-red-50 border-red-200 text-red-700" },
          { label: "Records Pending", value: String(records.length), color: "bg-blue-50 border-blue-200 text-blue-700" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 min-w-[130px] ${s.color}`}>
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[11px] mt-0.5 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading…</div>
      ) : records.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <div className="text-4xl mb-2">✅</div>
          <p className="font-medium">No outstanding receivables. All payments are settled!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const contact = findContact(r);
            const isOverdue = r.status === "overdue";
            return (
              <div
                key={r.id}
                onClick={() => openEdit(r)}
                className={`rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${isOverdue ? "border-red-200 bg-red-50" : "border-border bg-white hover:bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isOverdue ? "bg-red-200 text-red-800" : "bg-primary/10 text-primary"}`}>
                      {r.buyer_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 text-sm">{r.buyer_name}</p>
                        {contact && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Contact ✓</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_CLR[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                      </div>
                      {r.buyer_company && <p className="text-xs text-muted-foreground">{r.buyer_company}</p>}
                      <p className="text-xs text-slate-600 mt-0.5">💎 {r.gemstone_name}{r.quantity > 1 ? ` × ${r.quantity}` : ""}</p>
                      {r.due_date && (
                        <p className={`text-[10px] mt-0.5 font-semibold ${isOverdue ? "text-red-600" : "text-amber-600"}`}>
                          Due: {new Date(r.due_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          {r.days_overdue ? ` — ${r.days_overdue}d overdue` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-red-600">{r.currency} {(r.outstanding_amount ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">of {r.currency} {r.total_amount.toLocaleString()}</p>
                    {r.amount_received > 0 && <p className="text-[10px] text-green-700">Rcvd: {r.currency} {r.amount_received.toLocaleString()}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(r)} className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition">Edit</button>
                  <button onClick={() => { setSelected(r); setPayForm(blankPay); setModal("payments"); }} className="text-xs px-3 py-1 rounded-lg bg-green-100 text-green-700 font-semibold hover:bg-green-200 transition">+ Payment</button>
                  <button onClick={() => { setSelected(r); setModal("remind"); setReminderResult(null); remindMut.mutate(r.id); }} className="text-xs px-3 py-1 rounded-lg bg-amber-100 text-amber-700 font-semibold hover:bg-amber-200 transition">Remind</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {modal === "edit" && selected && (
        <Modal title={`Edit — ${selected.buyer_name}`} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Buyer Name *"><input value={editForm.buyer_name} onChange={(e) => setEditForm({...editForm, buyer_name: e.target.value})} className={inputCls} /></FormField>
            <FormField label="Company"><input value={editForm.buyer_company} onChange={(e) => setEditForm({...editForm, buyer_company: e.target.value})} className={inputCls} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Phone"><input value={editForm.buyer_phone} onChange={(e) => setEditForm({...editForm, buyer_phone: e.target.value})} className={inputCls} /></FormField>
            <FormField label="Email"><input value={editForm.buyer_email} onChange={(e) => setEditForm({...editForm, buyer_email: e.target.value})} className={inputCls} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Gemstone *"><input value={editForm.gemstone_name} onChange={(e) => setEditForm({...editForm, gemstone_name: e.target.value})} className={inputCls} /></FormField>
            <FormField label="Quantity"><input type="number" min={1} value={editForm.quantity} onChange={(e) => setEditForm({...editForm, quantity: Number(e.target.value)})} className={inputCls} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Total Amount *"><input type="number" min={0} value={editForm.total_amount || ""} onChange={(e) => setEditForm({...editForm, total_amount: Number(e.target.value)})} className={inputCls} /></FormField>
            <FormField label="Currency">
              <select value={editForm.currency} onChange={(e) => setEditForm({...editForm, currency: e.target.value})} className={selectCls}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sale Type">
              <select value={editForm.sale_type} onChange={(e) => setEditForm({...editForm, sale_type: e.target.value as "direct"|"approval"})} className={selectCls}>
                <option value="direct">Direct</option>
                <option value="approval">Approval-Based</option>
              </select>
            </FormField>
            <FormField label="Payment Due Date"><input type="date" value={editForm.due_date} onChange={(e) => setEditForm({...editForm, due_date: e.target.value})} className={inputCls} /></FormField>
          </div>
          <FormField label="Notes"><textarea value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} className={`${inputCls} resize-none`} rows={2} /></FormField>
          <div className="text-xs text-muted-foreground p-3 bg-slate-50 rounded-lg mb-1">
            <div className="flex justify-between"><span>Received so far:</span><span className="font-semibold text-green-700">{selected.currency} {selected.amount_received.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Outstanding:</span><span className="font-semibold text-red-600">{selected.currency} {(selected.outstanding_amount ?? 0).toLocaleString()}</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => updateMut.mutate(editForm)} disabled={updateMut.isPending} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 font-semibold hover:opacity-90 disabled:opacity-50 transition">{updateMut.isPending ? "Saving…" : "Save Changes"}</button>
            <button onClick={() => { setPayForm(blankPay); setModal("payments"); }} className="px-4 border border-green-600 text-green-700 rounded-lg py-2 text-sm font-semibold hover:bg-green-50 transition">+ Payment</button>
            <button onClick={() => setModal(null)} className="px-4 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Payments Modal */}
      {modal === "payments" && selected && (
        <Modal title={`Payments — ${selected.buyer_name}`} onClose={() => setModal(null)}>
          <div className="text-sm mb-4 p-3 bg-slate-50 rounded-lg">
            <div className="flex justify-between mb-1"><span>Total:</span><span className="font-semibold">{selected.currency} {selected.total_amount.toLocaleString()}</span></div>
            <div className="flex justify-between mb-1 text-green-700"><span>Received:</span><span className="font-semibold">{selected.currency} {selected.amount_received.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold text-red-600"><span>Outstanding:</span><span>{selected.currency} {(selected.outstanding_amount ?? 0).toLocaleString()}</span></div>
            {selected.due_date && <div className="flex justify-between mt-1 text-amber-700 text-xs"><span>Due Date:</span><span>{new Date(selected.due_date).toLocaleDateString()}</span></div>}
          </div>
          {payments.length > 0 && (
            <div className="mb-4 space-y-1 max-h-48 overflow-y-auto">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs bg-green-50 rounded p-2">
                  <span className="font-semibold text-green-800">{p.currency} {p.amount_paid.toLocaleString()}</span>
                  <span className="text-muted-foreground">{new Date(p.payment_date).toLocaleDateString()} · {p.payment_mode}</span>
                  {p.notes && <span className="text-muted-foreground italic truncate max-w-[100px]">{p.notes}</span>}
                </div>
              ))}
            </div>
          )}
          <hr className="my-3" />
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Record New Payment</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount *"><input type="number" min={0} value={payForm.amount_paid || ""} onChange={(e) => setPayForm({...payForm, amount_paid: Number(e.target.value)})} className={inputCls} /></FormField>
            <FormField label="Date"><input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({...payForm, payment_date: e.target.value})} className={inputCls} /></FormField>
          </div>
          <FormField label="Mode">
            <select value={payForm.payment_mode} onChange={(e) => setPayForm({...payForm, payment_mode: e.target.value as LedgerPayment["payment_mode"]})} className={selectCls}>
              {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </FormField>
          <FormField label="Notes"><input value={payForm.notes} onChange={(e) => setPayForm({...payForm, notes: e.target.value})} className={inputCls} /></FormField>
          <div className="flex gap-3">
            <button onClick={() => payMut.mutate(payForm)} disabled={payMut.isPending || !payForm.amount_paid} className="flex-1 bg-green-600 text-white rounded-lg py-2 font-semibold hover:bg-green-700 disabled:opacity-50 transition">{payMut.isPending ? "Saving…" : "Record Payment"}</button>
            <button onClick={() => setModal(null)} className="flex-1 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Close</button>
          </div>
        </Modal>
      )}

      {/* Remind Modal */}
      {modal === "remind" && selected && (
        <Modal title="Payment Reminder" onClose={() => setModal(null)}>
          {remindMut.isPending ? <div className="text-center py-6 text-muted-foreground">Sending reminder…</div> : reminderResult ? (
            <div>
              <div className="bg-slate-50 rounded-lg p-4 text-sm mb-4 border">
                <p className="text-xs text-muted-foreground mb-1">Message:</p>
                <p className="italic">"{reminderResult.message}"</p>
              </div>
              {reminderResult.whatsapp_link && <a href={reminderResult.whatsapp_link} target="_blank" rel="noopener noreferrer" className="block w-full bg-green-600 text-white text-center rounded-lg py-2.5 font-semibold hover:bg-green-700 transition mb-3">📱 Open WhatsApp to Send</a>}
              {reminderResult.email_sent && <p className="text-sm text-center text-green-700 mb-3">✉️ Email reminder sent</p>}
              <button onClick={() => setModal(null)} className="w-full border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Close</button>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAYABLES TAB
// ════════════════════════════════════════════════════════════════════════════

function PayablesTab({ userId, defaultCurrency }: { userId: string; defaultCurrency: Currency }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<"add" | "payments" | "remind" | null>(null);
  const [selected, setSelected] = useState<PayableRecord | null>(null);
  const [reminderResult, setReminderResult] = useState<{ whatsapp_link: string | null; email_sent: boolean; message: string } | null>(null);

  const { data: records = [], isLoading } = useQuery<PayableRecord[]>({
    queryKey: ["payables-ledger", userId, filter],
    queryFn: () => api.pl.list(userId, filter),
  });
  const { data: payments = [] } = useQuery<LedgerPayment[]>({
    queryKey: ["payable-payments", selected?.id],
    queryFn: () => selected ? api.pl.getPayments(userId, selected.id) : Promise.resolve([]),
    enabled: !!selected && modal === "payments",
  });

  const blankPayable = { supplier_name: "", supplier_company: "", supplier_phone: "", supplier_email: "", gemstone_name: "", quantity: 1, total_cost: 0, currency: "USD", purchase_type: "direct" as const, due_date: "", notes: "" };
  const [payableForm, setPayableForm] = useState(blankPayable);
  const blankPay = { amount_paid: 0, currency: "USD", payment_date: new Date().toISOString().slice(0,10), payment_mode: "cash" as const, notes: "" };
  const [payForm, setPayForm] = useState(blankPay);

  const createMut = useMutation({
    mutationFn: (data: Partial<PayableRecord>) => api.pl.create(userId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payables-ledger", userId] }); setModal(null); setPayableForm(blankPayable); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.pl.remove(userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payables-ledger", userId] }),
  });
  const payMut = useMutation({
    mutationFn: (data: Partial<LedgerPayment>) => api.pl.addPayment(userId, selected!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payables-ledger", userId] }); qc.invalidateQueries({ queryKey: ["payable-payments", selected?.id] }); setPayForm(blankPay); },
  });
  const remindMut = useMutation({
    mutationFn: (id: string) => api.pl.remind(userId, id),
    onSuccess: (r) => setReminderResult(r),
  });

  const totalPayable = records.reduce((s, r) => s + convertPrice(r.outstanding_amount ?? 0, r.currency as Currency, defaultCurrency), 0);
  const overdueCount = records.filter((r) => r.status === "overdue").length;

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: `Total Payable (${defaultCurrency})`, value: fmtCurrency(Math.round(totalPayable), defaultCurrency), color: "bg-red-50 border-red-200 text-red-700" },
          { label: "Overdue Records", value: String(overdueCount), color: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "Total Records", value: String(records.length), color: "bg-blue-50 border-blue-200 text-blue-700" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 min-w-[130px] ${s.color}`}>
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[11px] mt-0.5 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {["all","pending","partial","paid","overdue"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{f}</button>
        ))}
        <button onClick={() => { setModal("add"); setPayableForm(blankPayable); }} className="ml-auto bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition">+ Add Payable</button>
      </div>

      {isLoading ? <div className="text-center py-10 text-muted-foreground">Loading…</div> : records.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <div className="text-4xl mb-2">💳</div>
          <p className="font-medium">No payables yet. Add supplier transactions to track what you owe.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Gemstone</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.supplier_name}</p>
                    <p className="text-xs text-muted-foreground">{r.supplier_company}</p>
                    {r.supplier_phone && <p className="text-[10px] text-muted-foreground">{r.supplier_phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p>💎 {r.gemstone_name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {r.quantity}</p>
                    {r.due_date && <p className={`text-[10px] ${r.status === "overdue" ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>Due: {new Date(r.due_date).toLocaleDateString()}{r.days_overdue ? ` (${r.days_overdue}d overdue)` : ""}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{r.currency} {r.total_cost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-700">{r.currency} {r.amount_paid.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{r.currency} {(r.outstanding_amount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge label={r.status} style={LEDGER_STATUS_STYLES[r.status]} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => { setSelected(r); setModal("payments"); }} className="text-xs text-primary hover:underline mr-2">Payments</button>
                    <button onClick={() => { setSelected(r); setModal("remind"); setReminderResult(null); remindMut.mutate(r.id); }} className="text-xs text-amber-600 hover:underline mr-2">Notify</button>
                    <button onClick={() => { if (confirm("Delete?")) deleteMut.mutate(r.id); }} className="text-xs text-red-500 hover:underline">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "add" && (
        <Modal title="Add Payable Record" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Supplier Name *"><input value={payableForm.supplier_name} onChange={(e) => setPayableForm({...payableForm, supplier_name: e.target.value})} className={inputCls} placeholder="Mohan Lal" /></FormField>
            <FormField label="Company"><input value={payableForm.supplier_company} onChange={(e) => setPayableForm({...payableForm, supplier_company: e.target.value})} className={inputCls} placeholder="Mohan Gems" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Phone"><input value={payableForm.supplier_phone} onChange={(e) => setPayableForm({...payableForm, supplier_phone: e.target.value})} className={inputCls} placeholder="+91 …" /></FormField>
            <FormField label="Email"><input value={payableForm.supplier_email} onChange={(e) => setPayableForm({...payableForm, supplier_email: e.target.value})} className={inputCls} placeholder="supplier@email.com" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Gemstone *"><input value={payableForm.gemstone_name} onChange={(e) => setPayableForm({...payableForm, gemstone_name: e.target.value})} className={inputCls} placeholder="Emerald" /></FormField>
            <FormField label="Quantity"><input type="number" min={1} value={payableForm.quantity} onChange={(e) => setPayableForm({...payableForm, quantity: Number(e.target.value)})} className={inputCls} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Total Cost *"><input type="number" min={0} value={payableForm.total_cost || ""} onChange={(e) => setPayableForm({...payableForm, total_cost: Number(e.target.value)})} className={inputCls} placeholder="3000" /></FormField>
            <FormField label="Currency"><select value={payableForm.currency} onChange={(e) => setPayableForm({...payableForm, currency: e.target.value})} className={selectCls}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Purchase Type">
              <select value={payableForm.purchase_type} onChange={(e) => setPayableForm({...payableForm, purchase_type: e.target.value as "direct"|"approval"})} className={selectCls}>
                <option value="direct">Direct</option>
                <option value="approval">Approval-Based</option>
              </select>
            </FormField>
            <FormField label="Due Date"><input type="date" value={payableForm.due_date} onChange={(e) => setPayableForm({...payableForm, due_date: e.target.value})} className={inputCls} /></FormField>
          </div>
          <FormField label="Notes"><textarea value={payableForm.notes} onChange={(e) => setPayableForm({...payableForm, notes: e.target.value})} className={`${inputCls} resize-none`} rows={2} /></FormField>
          <div className="flex gap-3">
            <button onClick={() => createMut.mutate(payableForm)} disabled={createMut.isPending || !payableForm.supplier_name || !payableForm.gemstone_name || !payableForm.total_cost} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 font-semibold hover:opacity-90 disabled:opacity-50 transition">{createMut.isPending ? "Saving…" : "Add Payable"}</button>
            <button onClick={() => setModal(null)} className="flex-1 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Cancel</button>
          </div>
        </Modal>
      )}

      {modal === "payments" && selected && (
        <Modal title={`Payments — ${selected.supplier_name} (${selected.gemstone_name})`} onClose={() => setModal(null)}>
          <div className="text-sm mb-4 p-3 bg-slate-50 rounded-lg">
            <div className="flex justify-between mb-1"><span>Total Cost:</span><span className="font-semibold">{selected.currency} {selected.total_cost.toLocaleString()}</span></div>
            <div className="flex justify-between mb-1 text-green-700"><span>Paid:</span><span className="font-semibold">{selected.currency} {selected.amount_paid.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold text-red-600"><span>Outstanding:</span><span>{selected.currency} {(selected.outstanding_amount ?? 0).toLocaleString()}</span></div>
          </div>
          {payments.length > 0 && (
            <div className="mb-4 space-y-1">
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between text-xs bg-green-50 rounded p-2">
                  <span className="font-semibold">{p.currency} {p.amount_paid.toLocaleString()}</span>
                  <span className="text-muted-foreground">{new Date(p.payment_date).toLocaleDateString()} · {p.payment_mode}</span>
                </div>
              ))}
            </div>
          )}
          <hr className="my-3" />
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Record New Payment</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount *"><input type="number" min={0} value={payForm.amount_paid || ""} onChange={(e) => setPayForm({...payForm, amount_paid: Number(e.target.value)})} className={inputCls} /></FormField>
            <FormField label="Date"><input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({...payForm, payment_date: e.target.value})} className={inputCls} /></FormField>
          </div>
          <FormField label="Mode"><select value={payForm.payment_mode} onChange={(e) => setPayForm({...payForm, payment_mode: e.target.value as LedgerPayment["payment_mode"]})} className={selectCls}>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select></FormField>
          <FormField label="Notes"><input value={payForm.notes} onChange={(e) => setPayForm({...payForm, notes: e.target.value})} className={inputCls} /></FormField>
          <div className="flex gap-3">
            <button onClick={() => payMut.mutate(payForm)} disabled={payMut.isPending || !payForm.amount_paid} className="flex-1 bg-green-600 text-white rounded-lg py-2 font-semibold hover:bg-green-700 disabled:opacity-50 transition">{payMut.isPending ? "Saving…" : "Record Payment"}</button>
            <button onClick={() => setModal(null)} className="flex-1 border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Close</button>
          </div>
        </Modal>
      )}

      {modal === "remind" && selected && (
        <Modal title="Supplier Notification" onClose={() => setModal(null)}>
          {remindMut.isPending ? <div className="text-center py-6 text-muted-foreground">Sending…</div> : reminderResult ? (
            <div>
              <div className="bg-slate-50 rounded-lg p-4 text-sm mb-4 border">
                <p className="text-xs text-muted-foreground mb-1">Message template:</p>
                <p className="italic">"{reminderResult.message}"</p>
              </div>
              {reminderResult.whatsapp_link && (
                <a href={reminderResult.whatsapp_link} target="_blank" rel="noopener noreferrer" className="block w-full bg-green-600 text-white text-center rounded-lg py-2.5 font-semibold hover:bg-green-700 transition mb-3">📱 Open WhatsApp</a>
              )}
              {reminderResult.email_sent && <p className="text-sm text-center text-green-700 mb-3">✉️ Email sent</p>}
              <button onClick={() => setModal(null)} className="w-full border border-border rounded-lg py-2 text-muted-foreground hover:bg-secondary transition">Close</button>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ════════════════════════════════════════════════════════════════════════════

// ─── Analytics Drill-Down Modal ────────────────────────────────────────────

type DrillKey = "revenue" | "pending" | "overdue" | "invoices" | "contacts" | "receivable" | "payable";

const DRILL_TITLES: Record<DrillKey, string> = {
  revenue:    "Total Revenue — Sales Breakdown",
  pending:    "Pending Payments",
  overdue:    "Overdue Payments",
  invoices:   "All Invoices",
  contacts:   "CRM Contacts",
  receivable: "Outstanding Receivables",
  payable:    "Outstanding Payables",
};

function AnalyticsDrillModal({
  drill, userId, onClose, onViewContact,
}: { drill: DrillKey; userId: string; onClose: () => void; onViewContact?: (c: TradeContact) => void }) {
  const { data: salesAll = [] } = useQuery<SalesRecord[]>({
    queryKey: ["sl-records", userId],
    queryFn: () => api.sl.getAll(userId),
  });
  const { data: payablesAll = [] } = useQuery<PayableRecord[]>({
    queryKey: ["pl-records", userId],
    queryFn: () => api.pl.getAll(userId),
  });
  const { data: invoices = [] } = useQuery<TradeInvoice[]>({
    queryKey: ["trm-invoices", userId],
    queryFn: () => api.trm.getInvoices(userId),
  });
  const { data: contacts = [] } = useQuery<TradeContact[]>({
    queryKey: ["trm-contacts", userId],
    queryFn: () => api.trm.getContacts(userId),
  });

  function renderRows() {
    if (drill === "revenue") {
      const rows = salesAll.filter((r) => r.amount_received > 0).sort((a, b) => b.amount_received - a.amount_received);
      if (!rows.length) return <p className="text-sm text-muted-foreground py-4 text-center">No revenue recorded yet.</p>;
      return rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{r.gemstone_name}</p>
            <p className="text-xs text-muted-foreground">{r.buyer_name}{r.buyer_company ? ` · ${r.buyer_company}` : ""}</p>
            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-green-700">{r.currency} {r.amount_received.toLocaleString()}</p>
            {r.listing_id && (
              <Link href={`/listing/${r.listing_id}`} onClick={onClose}>
                <span className="text-[10px] text-primary hover:underline cursor-pointer">View listing →</span>
              </Link>
            )}
          </div>
        </div>
      ));
    }

    if (drill === "pending") {
      const sales = salesAll.filter((r) => r.status === "pending" || r.status === "partial");
      const payables = payablesAll.filter((r) => r.status === "pending" || r.status === "partial");
      if (!sales.length && !payables.length) return <p className="text-sm text-muted-foreground py-4 text-center">No pending payments.</p>;
      return (
        <>
          {sales.length > 0 && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Receivable (owed to you)</p>}
          {sales.map((r) => (
            <div key={r.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{r.gemstone_name}</p>
                <p className="text-xs text-muted-foreground">{r.buyer_name}{r.buyer_company ? ` · ${r.buyer_company}` : ""}</p>
                {r.due_date && <p className="text-xs text-amber-600">Due: {new Date(r.due_date).toLocaleDateString()}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-amber-700">{r.currency} {r.outstanding_amount.toLocaleString()}</p>
                {r.listing_id && <Link href={`/listing/${r.listing_id}`} onClick={onClose}><span className="text-[10px] text-primary hover:underline cursor-pointer">View listing →</span></Link>}
              </div>
            </div>
          ))}
          {payables.length > 0 && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-3 mb-1">Payable (you owe)</p>}
          {payables.map((r) => (
            <div key={r.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{r.gemstone_name}</p>
                <p className="text-xs text-muted-foreground">{r.supplier_name}{r.supplier_company ? ` · ${r.supplier_company}` : ""}</p>
                {r.due_date && <p className="text-xs text-amber-600">Due: {new Date(r.due_date).toLocaleDateString()}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-slate-700">{r.currency} {r.outstanding_amount.toLocaleString()}</p>
                {r.listing_id && <Link href={`/listing/${r.listing_id}`} onClick={onClose}><span className="text-[10px] text-primary hover:underline cursor-pointer">View listing →</span></Link>}
              </div>
            </div>
          ))}
        </>
      );
    }

    if (drill === "overdue") {
      const sales = salesAll.filter((r) => r.status === "overdue");
      const payables = payablesAll.filter((r) => r.status === "overdue");
      if (!sales.length && !payables.length) return <p className="text-sm text-muted-foreground py-4 text-center">No overdue payments.</p>;
      return (
        <>
          {sales.length > 0 && <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Overdue Receivables</p>}
          {sales.map((r) => (
            <div key={r.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{r.gemstone_name}</p>
                <p className="text-xs text-muted-foreground">{r.buyer_name}{r.buyer_company ? ` · ${r.buyer_company}` : ""}</p>
                {r.days_overdue != null && <p className="text-xs text-red-600 font-medium">{r.days_overdue}d overdue</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-red-700">{r.currency} {r.outstanding_amount.toLocaleString()}</p>
                {r.listing_id && <Link href={`/listing/${r.listing_id}`} onClick={onClose}><span className="text-[10px] text-primary hover:underline cursor-pointer">View listing →</span></Link>}
              </div>
            </div>
          ))}
          {payables.length > 0 && <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mt-3 mb-1">Overdue Payables</p>}
          {payables.map((r) => (
            <div key={r.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{r.gemstone_name}</p>
                <p className="text-xs text-muted-foreground">{r.supplier_name}{r.supplier_company ? ` · ${r.supplier_company}` : ""}</p>
                {r.days_overdue != null && <p className="text-xs text-red-600 font-medium">{r.days_overdue}d overdue</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-red-700">{r.currency} {r.outstanding_amount.toLocaleString()}</p>
                {r.listing_id && <Link href={`/listing/${r.listing_id}`} onClick={onClose}><span className="text-[10px] text-primary hover:underline cursor-pointer">View listing →</span></Link>}
              </div>
            </div>
          ))}
        </>
      );
    }

    if (drill === "invoices") {
      if (!invoices.length) return <p className="text-sm text-muted-foreground py-4 text-center">No invoices yet.</p>;
      const STATUS_CLR: Record<string, string> = { pending: "bg-amber-100 text-amber-700", sent: "bg-blue-100 text-blue-700", paid: "bg-emerald-100 text-emerald-700", overdue: "bg-red-100 text-red-700", partial: "bg-blue-50 text-blue-600" };
      return invoices.map((inv) => (
        <div key={inv.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{inv.invoice_number}</p>
            <p className="text-xs text-muted-foreground">{inv.buyer_name}{inv.buyer_company ? ` · ${inv.buyer_company}` : ""}</p>
            {inv.due_date && <p className="text-xs text-muted-foreground">Due: {new Date(inv.due_date).toLocaleDateString()}</p>}
          </div>
          <div className="text-right shrink-0 space-y-1">
            <p className="text-sm font-bold text-slate-800">{inv.currency} {inv.total_amount.toLocaleString()}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_CLR[inv.status] ?? "bg-slate-100 text-slate-600"}`}>{inv.status}</span>
          </div>
        </div>
      ));
    }

    if (drill === "contacts") {
      if (!contacts.length) return <p className="text-sm text-muted-foreground py-4 text-center">No contacts yet.</p>;
      const TYPE_CLR: Record<string, string> = { buyer: "bg-blue-100 text-blue-700", supplier: "bg-amber-100 text-amber-700", partner: "bg-violet-100 text-violet-700" };
      return contacts.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-slate-50 -mx-5 px-5 transition-colors rounded-xl"
          onClick={() => { onClose(); onViewContact?.(c); }}
        >
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{c.name}</p>
            {c.company_name && <p className="text-xs text-muted-foreground">{c.company_name}</p>}
            {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${TYPE_CLR[c.type] ?? "bg-slate-100 text-slate-600"}`}>{c.type}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
      ));
    }

    if (drill === "receivable") {
      const rows = salesAll.filter((r) => r.outstanding_amount > 0).sort((a, b) => b.outstanding_amount - a.outstanding_amount);
      if (!rows.length) return <p className="text-sm text-muted-foreground py-4 text-center">No outstanding receivables.</p>;
      return rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{r.gemstone_name}</p>
            <p className="text-xs text-muted-foreground">{r.buyer_name}{r.buyer_company ? ` · ${r.buyer_company}` : ""}</p>
            {r.due_date && <p className={`text-xs font-medium ${r.status === "overdue" ? "text-red-600" : "text-muted-foreground"}`}>Due: {new Date(r.due_date).toLocaleDateString()}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-green-700">{r.currency} {r.outstanding_amount.toLocaleString()}</p>
            {r.listing_id && <Link href={`/listing/${r.listing_id}`} onClick={onClose}><span className="text-[10px] text-primary hover:underline cursor-pointer">View listing →</span></Link>}
          </div>
        </div>
      ));
    }

    if (drill === "payable") {
      const rows = payablesAll.filter((r) => r.outstanding_amount > 0).sort((a, b) => b.outstanding_amount - a.outstanding_amount);
      if (!rows.length) return <p className="text-sm text-muted-foreground py-4 text-center">No outstanding payables.</p>;
      return rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{r.gemstone_name}</p>
            <p className="text-xs text-muted-foreground">{r.supplier_name}{r.supplier_company ? ` · ${r.supplier_company}` : ""}</p>
            {r.due_date && <p className={`text-xs font-medium ${r.status === "overdue" ? "text-red-600" : "text-muted-foreground"}`}>Due: {new Date(r.due_date).toLocaleDateString()}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-red-700">{r.currency} {r.outstanding_amount.toLocaleString()}</p>
            {r.listing_id && <Link href={`/listing/${r.listing_id}`} onClick={onClose}><span className="text-[10px] text-primary hover:underline cursor-pointer">View listing →</span></Link>}
          </div>
        </div>
      ));
    }

    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-bold text-slate-800 text-base">{DRILL_TITLES[drill]}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-slate-700 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary transition-colors">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-2">
          {renderRows()}
        </div>
      </div>
    </div>
  );
}

function AnalyticsTab({ userId, defaultCurrency, onViewContact }: { userId: string; defaultCurrency: Currency; onViewContact?: (c: TradeContact) => void }) {
  const [activeDrill, setActiveDrill] = useState<DrillKey | null>(null);

  const { data: analytics, isLoading } = useQuery<TradeAnalytics>({
    queryKey: ["trm-analytics", userId],
    queryFn: () => api.trm.getAnalytics(userId),
    refetchInterval: 30000,
  });
  const { data: slSummary } = useQuery<SalesSummary>({
    queryKey: ["sl-summary", userId],
    queryFn: () => api.sl.summary(userId),
  });
  const { data: plSummary } = useQuery<PayablesSummary>({
    queryKey: ["pl-summary", userId],
    queryFn: () => api.pl.summary(userId),
  });

  if (isLoading) return <div className="flex justify-center py-14 text-muted-foreground"><span className="spinner mr-2" /> Loading…</div>;
  if (!analytics) return null;

  const totalReceivable = sumInCurrency(slSummary?.byCurrency, defaultCurrency);
  const totalPayable = sumInCurrency(plSummary?.byCurrency, defaultCurrency);
  const netPosition = totalReceivable - totalPayable;

  const totalRevenue = sumInCurrency(analytics.revenueByCurrency, defaultCurrency);
  const pendingPayments = sumInCurrency(analytics.pendingByCurrency, defaultCurrency);
  const overduePayments = sumInCurrency(analytics.overdueByCurrency, defaultCurrency);

  const statCards: { key: DrillKey; label: string; value: string; color: string; textColor: string; arrowColor: string }[] = [
    { key: "revenue",   label: `Total Revenue (${defaultCurrency})`,   value: fmtCurrency(Math.round(totalRevenue), defaultCurrency),   color: "bg-green-50 border-green-200",  textColor: "text-green-700",  arrowColor: "text-green-400" },
    { key: "pending",   label: `Pending Payments (${defaultCurrency})`, value: fmtCurrency(Math.round(pendingPayments), defaultCurrency), color: "bg-amber-50 border-amber-200",  textColor: "text-amber-700",  arrowColor: "text-amber-400" },
    { key: "overdue",   label: `Overdue Payments (${defaultCurrency})`, value: fmtCurrency(Math.round(overduePayments), defaultCurrency), color: "bg-red-50 border-red-200",     textColor: "text-red-700",    arrowColor: "text-red-400"   },
    { key: "invoices",  label: "Total Invoices",    value: String(analytics.invoiceCount),  color: "bg-slate-50 border-slate-200",  textColor: "text-slate-700",  arrowColor: "text-slate-400" },
    { key: "contacts",  label: "Contacts",          value: String(analytics.contactCount),  color: "bg-violet-50 border-violet-200", textColor: "text-violet-700", arrowColor: "text-violet-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Net Position Card — each column is clickable */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-5">
        <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 sm:mb-4">Net Position ({defaultCurrency})</h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <button onClick={() => setActiveDrill("receivable")} className="text-left hover:bg-white/5 rounded-xl p-1.5 sm:p-2 -m-1.5 sm:-m-2 transition-colors group">
            <p className="text-[10px] sm:text-xs text-slate-400 mb-1">Receivable</p>
            <p className="text-base sm:text-2xl font-bold text-green-400 truncate">{fmtCurrency(Math.round(totalReceivable), defaultCurrency)}</p>
            <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 group-hover:text-slate-300 transition-colors">Tap to view →</p>
          </button>
          <button onClick={() => setActiveDrill("payable")} className="text-left hover:bg-white/5 rounded-xl p-1.5 sm:p-2 -m-1.5 sm:-m-2 transition-colors group">
            <p className="text-[10px] sm:text-xs text-slate-400 mb-1">Payable</p>
            <p className="text-base sm:text-2xl font-bold text-red-400 truncate">{fmtCurrency(Math.round(totalPayable), defaultCurrency)}</p>
            <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 group-hover:text-slate-300 transition-colors">Tap to view →</p>
          </button>
          <div>
            <p className="text-[10px] sm:text-xs text-slate-400 mb-1">Net Balance</p>
            <p className={`text-base sm:text-2xl font-bold truncate ${netPosition >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {netPosition >= 0 ? "+" : ""}{fmtCurrency(Math.abs(Math.round(netPosition)), defaultCurrency)}
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards — all clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {statCards.map((card) => (
          <button
            key={card.key}
            onClick={() => setActiveDrill(card.key)}
            className={`rounded-xl border p-3 sm:p-4 text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] group ${card.color}`}
          >
            <p className={`text-lg sm:text-xl font-bold ${card.textColor}`}>{card.value}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{card.label}</p>
            <p className={`text-[10px] mt-2 opacity-0 group-hover:opacity-100 transition-opacity ${card.arrowColor}`}>Tap to view →</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {/* Top Buyers */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-bold text-slate-800 mb-4">Top Buyers</h3>
          {analytics.topBuyers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment data yet</p>
          ) : (
            <div className="space-y-3">
              {analytics.topBuyers.map((buyer, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{buyer.name}</p>
                    <p className="text-xs text-muted-foreground">{buyer.company}</p>
                  </div>
                  <p className="text-sm font-bold text-green-700">${buyer.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Gemstones */}
      {analytics.topGems.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-bold text-slate-800 mb-4">Top Gemstones by Revenue</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase">
                  <th className="text-left pb-2">Item</th>
                  <th className="text-right pb-2">Units Sold</th>
                  <th className="text-right pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topGems.map((gem, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-2">{gem.description}</td>
                    <td className="py-2 text-right">{gem.count}</td>
                    <td className="py-2 text-right font-semibold">${gem.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drill-down modal */}
      {activeDrill && (
        <AnalyticsDrillModal drill={activeDrill} userId={userId} onClose={() => setActiveDrill(null)} onViewContact={onViewContact} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CONTACT DETAIL PANEL
// ════════════════════════════════════════════════════════════════════════════

function ContactDetailPanel({ contact, userId, defaultCurrency, onClose }: {
  contact: TradeContact; userId: string; defaultCurrency: Currency; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [activeForm, setActiveForm] = useState<"sale" | "payable" | "invoice" | "approval" | null>(null);

  // Quick-action form states
  const [saleForm, setSaleForm] = useState({ gemstone_name: "", total_amount: "", currency: "USD", sale_type: "direct" as "direct" | "approval", due_date: "", notes: "" });
  const [payForm, setPayForm] = useState({ gemstone_name: "", total_cost: "", currency: "USD", purchase_type: "direct" as "direct" | "approval", due_date: "", notes: "" });
  const [invoiceForm, setInvoiceForm] = useState({ item_desc: "", item_amount: "", currency: "USD", due_date: "", notes: "" });
  const [approvalForm, setApprovalForm] = useState({ stone_type: "", carat: "", price: "", currency: "USD", direction: "sent" as "sent" | "received", collected_date: "", notes: "" });

  const { data: salesAll = [] } = useQuery<SalesRecord[]>({
    queryKey: ["sl-records", userId],
    queryFn: () => api.sl.list(userId),
  });
  const { data: payablesAll = [] } = useQuery<PayableRecord[]>({
    queryKey: ["pl-records", userId],
    queryFn: () => api.pl.list(userId),
  });
  const { data: incomingApprovals = [] } = useQuery<ApprovalRequest[]>({
    queryKey: ["incoming-approvals", userId],
    queryFn: () => api.getIncomingApprovals(userId),
  });
  const { data: receivedApprovals = [] } = useQuery<ApprovalRequest[]>({
    queryKey: ["my-approvals", userId],
    queryFn: () => api.getMyApprovals(userId),
  });
  const { data: allInvoices = [] } = useQuery<TradeInvoice[]>({
    queryKey: ["trm-invoices", userId],
    queryFn: () => api.trm.getInvoices(userId),
  });

  const normName = (s: string) => s.trim().toLowerCase();
  const contactSales = salesAll.filter((r) =>
    r.buyer_contact_id === contact.id ||
    (r.buyer_name && normName(r.buyer_name) === normName(contact.name)) ||
    (contact.phone && r.buyer_phone && r.buyer_phone.replace(/\D/g, "") === contact.phone.replace(/\D/g, "") && r.buyer_phone.length > 5) ||
    (contact.email && r.buyer_email && normName(r.buyer_email) === normName(contact.email))
  );
  const contactPayables = payablesAll.filter((r) =>
    r.supplier_contact_id === contact.id ||
    (r.supplier_name && normName(r.supplier_name) === normName(contact.name)) ||
    (contact.phone && r.supplier_phone && r.supplier_phone.replace(/\D/g, "") === contact.phone.replace(/\D/g, "") && r.supplier_phone.length > 5) ||
    (contact.email && r.supplier_email && normName(r.supplier_email) === normName(contact.email))
  );
  const contactInvoices = allInvoices.filter((inv) =>
    inv.contact_id === contact.id ||
    (inv.buyer_name && normName(inv.buyer_name) === normName(contact.name)) ||
    (contact.phone && inv.buyer_phone && inv.buyer_phone.replace(/\D/g, "") === contact.phone.replace(/\D/g, "") && inv.buyer_phone.length > 5) ||
    (contact.email && inv.buyer_email && normName(inv.buyer_email) === normName(contact.email))
  );

  // Match approvals: platform user by requester_id, manual entries by counterparty_name
  const nameMatch = (n?: string | null) =>
    !!n && (
      n.toLowerCase() === contact.name.toLowerCase() ||
      n.toLowerCase().startsWith(contact.name.toLowerCase() + " (")
    );
  const contactSentApprovals = incomingApprovals.filter((r) =>
    (contact.is_platform_user && contact.platform_user_id && r.requester_id === contact.platform_user_id) ||
    (r.is_manual && nameMatch(r.counterparty_name))
  );
  const contactReceivedApprovals = receivedApprovals.filter((r) =>
    r.is_manual && nameMatch(r.counterparty_name)
  );
  const allContactApprovals = [
    ...contactSentApprovals.map((r) => ({ ...r, _side: "sent" as const })),
    ...contactReceivedApprovals.map((r) => ({ ...r, _side: "received" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalReceivable  = contactSales.reduce((s, r) => s + convertPrice(r.outstanding_amount ?? 0, r.currency as Currency, defaultCurrency), 0);
  const totalPayable     = contactPayables.reduce((s, r) => s + convertPrice(r.outstanding_amount ?? 0, r.currency as Currency, defaultCurrency), 0);

  const TYPE_CLR: Record<string, string> = { buyer: "bg-blue-100 text-blue-700", supplier: "bg-amber-100 text-amber-700", partner: "bg-violet-100 text-violet-700" };
  const STATUS_CLR: Record<string, string> = { pending: "bg-amber-100 text-amber-700", partial: "bg-blue-100 text-blue-700", paid: "bg-emerald-100 text-emerald-700", overdue: "bg-red-100 text-red-700", cancelled: "bg-slate-200 text-slate-500" };

  // ── Quick action mutations ───────────────────────────────────────────────────
  const saleMut = useMutation({
    mutationFn: (data: Partial<SalesRecord>) => api.sl.create(userId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sl-records", userId] }); qc.invalidateQueries({ queryKey: ["sales-ledger", userId] }); setActiveForm(null); setSaleForm({ gemstone_name: "", total_amount: "", currency: "USD", sale_type: "direct", due_date: "", notes: "" }); },
  });
  const payableMut = useMutation({
    mutationFn: (data: Partial<PayableRecord>) => api.pl.create(userId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pl-records", userId] }); qc.invalidateQueries({ queryKey: ["payables-ledger", userId] }); setActiveForm(null); setPayForm({ gemstone_name: "", total_cost: "", currency: "USD", purchase_type: "direct", due_date: "", notes: "" }); },
  });
  const invoiceMut = useMutation({
    mutationFn: (data: Partial<TradeInvoice>) => api.trm.createInvoice(userId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trm-invoices", userId] }); setActiveForm(null); setInvoiceForm({ item_desc: "", item_amount: "", currency: "USD", due_date: "", notes: "" }); },
  });
  const approvalMut = useMutation({
    mutationFn: (data: Parameters<typeof api.createManualApproval>[0]) => api.createManualApproval(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incoming-approvals", userId] }); qc.invalidateQueries({ queryKey: ["my-approvals", userId] }); setActiveForm(null); setApprovalForm({ stone_type: "", carat: "", price: "", currency: "USD", direction: "sent", collected_date: "", notes: "" }); },
  });

  function submitSale() {
    if (!saleForm.gemstone_name.trim() || !saleForm.total_amount) { alert("Gemstone name and amount are required"); return; }
    saleMut.mutate({ gemstone_name: saleForm.gemstone_name.trim(), total_amount: Number(saleForm.total_amount), currency: saleForm.currency, sale_type: saleForm.sale_type, due_date: saleForm.due_date || undefined, notes: saleForm.notes.trim() || undefined, buyer_contact_id: contact.id, buyer_name: contact.name, buyer_company: contact.company_name ?? "" });
  }
  function submitPayable() {
    if (!payForm.gemstone_name.trim() || !payForm.total_cost) { alert("Gemstone name and amount are required"); return; }
    payableMut.mutate({ gemstone_name: payForm.gemstone_name.trim(), total_cost: Number(payForm.total_cost), currency: payForm.currency, purchase_type: payForm.purchase_type, due_date: payForm.due_date || undefined, notes: payForm.notes.trim() || undefined, supplier_contact_id: contact.id, supplier_name: contact.name, supplier_company: contact.company_name ?? "" });
  }
  function submitInvoice() {
    if (!invoiceForm.item_desc.trim() || !invoiceForm.item_amount) { alert("Item description and amount are required"); return; }
    const amount = Number(invoiceForm.item_amount);
    const item: InvoiceItem = { description: invoiceForm.item_desc.trim(), quantity: 1, unit_price: amount, total: amount };
    invoiceMut.mutate({ contact_id: contact.id, buyer_name: contact.name, buyer_company: contact.company_name ?? "", currency: invoiceForm.currency as "USD"|"INR"|"AED"|"THB", items: [item], total_amount: amount, due_date: invoiceForm.due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10), notes: invoiceForm.notes.trim() || undefined });
  }
  function submitApproval() {
    approvalMut.mutate({ user_id: userId, direction: approvalForm.direction, counterparty_name: contact.name + (contact.company_name ? ` (${contact.company_name})` : ""), stone_type_manual: approvalForm.stone_type.trim() || undefined, stone_carat_manual: approvalForm.carat ? Number(approvalForm.carat) : undefined, stone_price_manual: approvalForm.price ? Number(approvalForm.price) : undefined, stone_currency_manual: approvalForm.currency || undefined, collected_date: approvalForm.collected_date || undefined, notes: approvalForm.notes.trim() || undefined });
  }

  const inputCls = "w-full border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white";
  const selectCls = "border border-border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none";
  const labelCls = "block text-[11px] font-semibold text-slate-500 mb-0.5";
  const CURRENCIES = ["USD", "INR", "AED", "THB"];

  const ACTIONS = [
    { key: "sale", label: "Sale", color: "bg-emerald-600 hover:bg-emerald-700" },
    { key: "payable", label: "Payable", color: "bg-amber-600 hover:bg-amber-700" },
    { key: "invoice", label: "Invoice", color: "bg-violet-600 hover:bg-violet-700" },
    { key: "approval", label: "Approval", color: "bg-primary hover:opacity-90" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-xl h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
            {contact.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-800 leading-tight">{contact.name}</h2>
            {contact.company_name && <p className="text-sm text-muted-foreground">{contact.company_name}</p>}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${TYPE_CLR[contact.type] ?? "bg-slate-100 text-slate-600"}`}>{contact.type}</span>
              {contact.is_platform_user && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Platform User</span>}
              {contact.tags.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{t}</span>)}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-slate-700 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary shrink-0">✕</button>
        </div>

        {/* Contact methods */}
        {(contact.phone || contact.email) && (
          <div className="flex flex-wrap gap-4 px-5 py-3 bg-slate-50 border-b border-border shrink-0">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-primary transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.7 19.79 19.79 0 0 1 1.61 5.07 2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.9a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 18.92z"/></svg>
                {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-primary transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            )}
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 border-b border-border shrink-0">
          <div className="px-4 py-3 text-center border-r border-border">
            <p className="text-xl font-bold text-green-700">{fmtCurrency(Math.round(totalReceivable), defaultCurrency)}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Due to You ({defaultCurrency})</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xl font-bold text-red-600">{fmtCurrency(Math.round(totalPayable), defaultCurrency)}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">You Owe ({defaultCurrency})</p>
          </div>
        </div>

        {/* Quick Actions bar */}
        <div className="flex gap-2 px-4 py-3 border-b border-border bg-slate-50 shrink-0 overflow-x-auto">
          <span className="text-[11px] text-slate-500 font-semibold self-center shrink-0 mr-1">+ Add:</span>
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={() => setActiveForm(activeForm === a.key ? null : a.key)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all ${activeForm === a.key ? "ring-2 ring-offset-1 ring-current opacity-90" : ""} ${a.color}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Inline quick-action forms */}
          {activeForm === "sale" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-emerald-800">New Sale to {contact.name}</p>
                <button onClick={() => setActiveForm(null)} className="text-emerald-400 hover:text-emerald-600 text-lg leading-none">✕</button>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className={labelCls}>Gemstone / Item</label>
                  <input value={saleForm.gemstone_name} onChange={(e) => setSaleForm({ ...saleForm, gemstone_name: e.target.value })} className={inputCls} placeholder="e.g. 2ct Ruby" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Amount</label>
                    <input type="number" value={saleForm.total_amount} onChange={(e) => setSaleForm({ ...saleForm, total_amount: e.target.value })} className={inputCls} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Currency</label>
                    <select value={saleForm.currency} onChange={(e) => setSaleForm({ ...saleForm, currency: e.target.value })} className={`${selectCls} w-full`}>
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Type</label>
                    <select value={saleForm.sale_type} onChange={(e) => setSaleForm({ ...saleForm, sale_type: e.target.value as "direct" | "approval" })} className={`${selectCls} w-full`}>
                      <option value="direct">Direct Sale</option>
                      <option value="approval">Via Approval</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Due Date</label>
                    <input type="date" value={saleForm.due_date} onChange={(e) => setSaleForm({ ...saleForm, due_date: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes (optional)</label>
                  <input value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} className={inputCls} placeholder="Any remarks…" />
                </div>
              </div>
              <button onClick={submitSale} disabled={saleMut.isPending} className="w-full py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
                {saleMut.isPending ? "Saving…" : "Record Sale"}
              </button>
            </div>
          )}

          {activeForm === "payable" && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-amber-800">New Payable to {contact.name}</p>
                <button onClick={() => setActiveForm(null)} className="text-amber-400 hover:text-amber-600 text-lg leading-none">✕</button>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className={labelCls}>Gemstone / Item</label>
                  <input value={payForm.gemstone_name} onChange={(e) => setPayForm({ ...payForm, gemstone_name: e.target.value })} className={inputCls} placeholder="e.g. 3ct Sapphire" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Amount Owed</label>
                    <input type="number" value={payForm.total_cost} onChange={(e) => setPayForm({ ...payForm, total_cost: e.target.value })} className={inputCls} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Currency</label>
                    <select value={payForm.currency} onChange={(e) => setPayForm({ ...payForm, currency: e.target.value })} className={`${selectCls} w-full`}>
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Type</label>
                    <select value={payForm.purchase_type} onChange={(e) => setPayForm({ ...payForm, purchase_type: e.target.value as "direct" | "approval" })} className={`${selectCls} w-full`}>
                      <option value="direct">Direct Purchase</option>
                      <option value="approval">Via Approval</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Due Date</label>
                    <input type="date" value={payForm.due_date} onChange={(e) => setPayForm({ ...payForm, due_date: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes (optional)</label>
                  <input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className={inputCls} placeholder="Any remarks…" />
                </div>
              </div>
              <button onClick={submitPayable} disabled={payableMut.isPending} className="w-full py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-60">
                {payableMut.isPending ? "Saving…" : "Record Payable"}
              </button>
            </div>
          )}

          {activeForm === "invoice" && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-violet-800">New Invoice for {contact.name}</p>
                <button onClick={() => setActiveForm(null)} className="text-violet-400 hover:text-violet-600 text-lg leading-none">✕</button>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className={labelCls}>Item Description</label>
                  <input value={invoiceForm.item_desc} onChange={(e) => setInvoiceForm({ ...invoiceForm, item_desc: e.target.value })} className={inputCls} placeholder="e.g. 2ct Ruby — Sale" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Amount</label>
                    <input type="number" value={invoiceForm.item_amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, item_amount: e.target.value })} className={inputCls} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Currency</label>
                    <select value={invoiceForm.currency} onChange={(e) => setInvoiceForm({ ...invoiceForm, currency: e.target.value })} className={`${selectCls} w-full`}>
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Due Date</label>
                  <input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Notes (optional)</label>
                  <input value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} className={inputCls} placeholder="Payment terms, notes…" />
                </div>
              </div>
              <button onClick={submitInvoice} disabled={invoiceMut.isPending} className="w-full py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-60">
                {invoiceMut.isPending ? "Saving…" : "Generate Invoice"}
              </button>
            </div>
          )}

          {activeForm === "approval" && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Log Approval with {contact.name}</p>
                <button onClick={() => setActiveForm(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className={labelCls}>Direction</label>
                  <select value={approvalForm.direction} onChange={(e) => setApprovalForm({ ...approvalForm, direction: e.target.value as "sent" | "received" })} className={`${selectCls} w-full`}>
                    <option value="sent">I sent stone to {contact.name}</option>
                    <option value="received">I received stone from {contact.name}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Stone Type</label>
                    <input value={approvalForm.stone_type} onChange={(e) => setApprovalForm({ ...approvalForm, stone_type: e.target.value })} className={inputCls} placeholder="e.g. Ruby" />
                  </div>
                  <div>
                    <label className={labelCls}>Carat</label>
                    <input type="number" step="0.01" value={approvalForm.carat} onChange={(e) => setApprovalForm({ ...approvalForm, carat: e.target.value })} className={inputCls} placeholder="e.g. 2.35" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Price</label>
                    <input type="number" value={approvalForm.price} onChange={(e) => setApprovalForm({ ...approvalForm, price: e.target.value })} className={inputCls} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Currency</label>
                    <select value={approvalForm.currency} onChange={(e) => setApprovalForm({ ...approvalForm, currency: e.target.value })} className={`${selectCls} w-full`}>
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Date Collected / Handed Over</label>
                  <input type="date" value={approvalForm.collected_date} onChange={(e) => setApprovalForm({ ...approvalForm, collected_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Notes (optional)</label>
                  <input value={approvalForm.notes} onChange={(e) => setApprovalForm({ ...approvalForm, notes: e.target.value })} className={inputCls} placeholder="Certificate, condition, etc." />
                </div>
              </div>
              <button onClick={submitApproval} disabled={approvalMut.isPending} className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                {approvalMut.isPending ? "Saving…" : "Log Approval Entry"}
              </button>
            </div>
          )}
          {/* Approvals (sent & received) */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Approvals ({allContactApprovals.length})</h3>
            {allContactApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No approval entries linked to this contact.</p>
            ) : (
              <div className="space-y-2">
                {allContactApprovals.map((r) => {
                  const ls = r.listing_snapshot;
                  const stoneLabel = r.is_manual
                    ? [r.stone_carat_manual ? `${r.stone_carat_manual}ct` : null, r.stone_type_manual].filter(Boolean).join(" ") || "Stone"
                    : ls ? `${ls.carat}ct ${ls.stone_type}` : "Stone";
                  const price = r.is_manual && r.stone_price_manual != null
                    ? `${r.stone_currency_manual ?? "USD"} ${r.stone_price_manual.toLocaleString()}`
                    : ls?.price ? `${ls.currency ?? "USD"} ${ls.price.toLocaleString()}` : null;
                  const APPR_CLR: Record<string, string> = {
                    pending: "bg-amber-100 text-amber-700", in_approval: "bg-yellow-100 text-yellow-800",
                    approved: "bg-blue-100 text-blue-700", sold: "bg-emerald-100 text-emerald-700",
                    returned: "bg-slate-100 text-slate-600", expired: "bg-red-50 text-red-500",
                    recalled: "bg-red-100 text-red-700", rejected: "bg-red-100 text-red-700",
                  };
                  const APPR_LBL: Record<string, string> = {
                    pending: "Pending", in_approval: "In Approval", approved: "Approved",
                    sold: "Sold", returned: "Returned", expired: "Expired",
                    recalled: "Recalled", rejected: "Rejected",
                  };
                  const sideColor = r._side === "sent" ? "text-blue-600" : "text-violet-600";
                  const sideLabel = r._side === "sent" ? "📤 Sent" : "📥 Received";
                  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                  return (
                    <div key={`${r._side}-${r.id}`} className="p-3 bg-slate-50 rounded-xl border border-border/50 space-y-1">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800">{stoneLabel}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${APPR_CLR[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                              {APPR_LBL[r.status] ?? r.status}
                            </span>
                            {r.is_manual && <span className="text-[10px] px-1 py-0.5 rounded bg-slate-200 text-slate-500 font-semibold">Manual</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-[11px] font-semibold ${sideColor}`}>{sideLabel}</span>
                            {r.collected_date && <span className="text-[11px] text-muted-foreground">· {fmt(r.collected_date)}</span>}
                            {r.returned_date && <span className="text-[11px] text-slate-400">· Returned {fmt(r.returned_date)}</span>}
                          </div>
                        </div>
                        {price && <p className="text-sm font-bold text-primary shrink-0">{price}</p>}
                      </div>
                      {r.notes && <p className="text-xs text-muted-foreground italic truncate">"{r.notes}"</p>}
                      {!r.is_manual && r.expiry_date && (
                        <p className="text-xs text-muted-foreground">Expires {new Date(r.expiry_date).toLocaleDateString()}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sales / Receivables */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Sales & Receivables ({contactSales.length})</h3>
            {contactSales.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No sales records for this contact.</p>
            ) : (
              <div className="space-y-2">
                {contactSales.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-border/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.gemstone_name}</p>
                      {r.due_date && <p className={`text-xs font-medium ${r.status === "overdue" ? "text-red-600" : "text-muted-foreground"}`}>Due {new Date(r.due_date).toLocaleDateString()}{r.days_overdue ? ` · ${r.days_overdue}d overdue` : ""}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-sm font-bold text-slate-800">{r.currency} {r.total_amount.toLocaleString()}</p>
                      {r.outstanding_amount > 0 && <p className="text-xs font-semibold text-red-600">Due: {r.currency} {r.outstanding_amount.toLocaleString()}</p>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold block ${STATUS_CLR[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Payables */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Payables ({contactPayables.length})</h3>
            {contactPayables.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No payable records for this contact.</p>
            ) : (
              <div className="space-y-2">
                {contactPayables.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-border/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.gemstone_name}</p>
                      {r.due_date && <p className={`text-xs font-medium ${r.status === "overdue" ? "text-red-600" : "text-muted-foreground"}`}>Due {new Date(r.due_date).toLocaleDateString()}{r.days_overdue ? ` · ${r.days_overdue}d overdue` : ""}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-sm font-bold text-slate-800">{r.currency} {r.total_cost.toLocaleString()}</p>
                      {r.outstanding_amount > 0 && <p className="text-xs font-semibold text-red-600">Due: {r.currency} {r.outstanding_amount.toLocaleString()}</p>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold block ${STATUS_CLR[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Invoices */}
          {contactInvoices.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Invoices ({contactInvoices.length})</h3>
              <div className="space-y-2">
                {contactInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-border/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-primary font-semibold">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Due {inv.due_date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800">{inv.currency} {inv.total_amount.toFixed(2)}</p>
                      {inv.amount_paid > 0 && inv.status !== "paid" && <p className="text-xs text-green-700">Paid {inv.currency} {inv.amount_paid.toFixed(2)}</p>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold block mt-0.5 ${STATUS_CLR[inv.status] ?? "bg-slate-100 text-slate-600"}`}>{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notes */}
          {contact.notes && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Notes</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl border border-border/50 p-3">{contact.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SEND ON APPROVAL MODAL (from Contacts tab)
// ════════════════════════════════════════════════════════════════════════════

function SendApprovalFromContactModal({
  contactId, userId, contacts, onClose,
}: { contactId: string; userId: string; contacts: TradeContact[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: gems = [] } = useQuery<Gemstone[]>({
    queryKey: ["my-inventory", userId],
    queryFn: () => api.getMyInventory(userId),
  });

  const [selectedContactId, setSelectedContactId] = useState(contactId);
  const [gemId, setGemId] = useState("");
  const [handedOverDate, setHandedOverDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [returnedDate, setReturnedDate] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [error, setError] = useState("");

  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const selectedGem = gems.find((g) => g.id === gemId);

  useEffect(() => {
    if (selectedGem && selectedContact) {
      setMessage(`Hi! I'd like to send you this ${selectedGem.stone_type} (${selectedGem.carat}ct) on approval for your review.`);
    }
  }, [gemId, selectedContactId]);

  async function handleSubmit() {
    if (!selectedContactId) { setError("Please select a contact."); return; }
    if (!gemId) { setError("Please select a listing."); return; }
    if (!handedOverDate) { setError("Please enter the hand-over date."); return; }
    setLoading(true);
    setError("");
    try {
      await api.updateInventory(gemId, { approval_enabled: true, seller_id: userId });
      const noteParts = [`[HANDED_OVER:${handedOverDate}]`];
      if (returnedDate) noteParts.push(`[RETURNED:${returnedDate}]`);
      if (message.trim()) noteParts.push(message.trim());
      await api.trm.createDeal(userId, {
        title: `${selectedGem?.stone_type} ${selectedGem?.carat}ct — Approval (${selectedContact?.name})`,
        deal_value: selectedGem?.price ?? selectedGem?.base_price_usd ?? 0,
        currency: selectedGem?.currency || "USD",
        stage: "stone_picked_up",
        contact_id: selectedContactId,
        listing_id: gemId,
        notes: noteParts.join(" "),
      });
      if (selectedContact?.phone) {
        const clean = selectedContact.phone.replace(/\D/g, "");
        const url = `${window.location.origin}/listing/${gemId}`;
        setWaLink(`https://wa.me/${clean}?text=${encodeURIComponent(`${message}\n\nView listing: ${url}`)}`);
      } else {
        setWaLink("no_phone");
      }
      qc.invalidateQueries({ queryKey: ["my-inventory", userId] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Send on Approval</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Select a listing and send it to your contact for approval</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-slate-700 text-xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}

        {waLink ? (
          <div className="space-y-3 text-center">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-teal-800 mb-1">Approval deal created in CRM!</p>
              <p className="text-xs text-teal-700">The listing is marked for approval and a deal has been added to your pipeline.</p>
            </div>
            {waLink !== "no_phone" && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="block w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl text-sm transition-colors">
                Open WhatsApp
              </a>
            )}
            <button onClick={onClose} className="block w-full py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Contact</label>
                <select value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)} className={selectCls}>
                  <option value="">Select contact…</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` · ${c.company_name}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Listing (your gem)</label>
                <select value={gemId} onChange={(e) => setGemId(e.target.value)} className={selectCls}>
                  <option value="">Select listing…</option>
                  {gems.filter((g) => !g.is_sold).map((g) => (
                    <option key={g.id} value={g.id}>{g.stone_type} · {g.carat}ct{g.origin ? ` · ${g.origin}` : ""} — {g.currency} {g.price?.toLocaleString()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Date Handed Over *</label>
                <input type="date" value={handedOverDate} onChange={(e) => setHandedOverDate(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Date Returned <span className="font-normal text-muted-foreground">(leave blank if not yet returned)</span></label>
                <input type="date" value={returnedDate} onChange={(e) => setReturnedDate(e.target.value)} min={handedOverDate || undefined} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Add a personal note…" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60">
                {loading ? "Sending…" : "Send on Approval"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APPROVALS TAB
// ════════════════════════════════════════════════════════════════════════════

type ApprovalSubTab = "sent" | "received" | "listings";

const APPROVAL_SUBTABS: { id: ApprovalSubTab; label: string; subtext: string }[] = [
  { id: "sent",     label: "Sent on Approval",     subtext: "Stones you've shared with partners" },
  { id: "received", label: "Received on Approval", subtext: "Stones you've taken to sell" },
  { id: "listings", label: "My Listings",           subtext: "Your partner inventory" },
];

function ApprovalsTab({ userId }: { userId: string }) {
  const [sub, setSub] = useState<ApprovalSubTab>("sent");
  return (
    <div className="space-y-4">
      {/* Sub-tab pills */}
      <div className="flex flex-col sm:flex-row gap-2">
        {APPROVAL_SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex-1 text-left px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
              sub === t.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-white text-foreground border-border hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <p className="text-sm font-semibold leading-tight">{t.label}</p>
            <p className={`text-xs mt-0.5 ${sub === t.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{t.subtext}</p>
          </button>
        ))}
      </div>

      {/* Content */}
      {sub === "sent"     && <SentOnApproval userId={userId} />}
      {sub === "received" && <ReceivedOnApproval userId={userId} />}
      {sub === "listings" && <MyListings userId={userId} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ASTROBOT LEADS TAB
// ════════════════════════════════════════════════════════════════════════════

const LEAD_STATUS_LABELS: Record<AstrobotLead["status"], string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
};
const LEAD_STATUS_COLORS: Record<AstrobotLead["status"], string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  converted: "bg-green-100 text-green-700",
};

function AstrobotLeadsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const shareLink = `${window.location.origin}${import.meta.env.BASE_URL}astrobot?ref=${userId}`;

  const { data: leads = [], isLoading } = useQuery<AstrobotLead[]>({
    queryKey: ["astrobot-leads", userId],
    queryFn: () => api.astro.getLeads(userId),
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  const updateLead = useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: { status?: AstrobotLead["status"]; notes?: string } }) =>
      api.astro.updateLead(leadId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["astrobot-leads", userId] }),
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const newCount = leads.filter((l) => l.status === "new").length;

  return (
    <div className="space-y-6">
      {/* Share link banner */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-700 rounded-xl p-5 text-white">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl shrink-0">🔮</span>
          <div>
            <h3 className="font-bold text-base mb-0.5">AstroBot — Your Lead Generator</h3>
            <p className="text-indigo-200 text-sm leading-relaxed">
              Share this link with customers. They'll receive a personalised gemstone recommendation and can submit their contact details directly to you.
            </p>
          </div>
        </div>
        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 flex items-center gap-3">
          <span className="text-xs text-indigo-200 truncate flex-1 font-mono">{shareLink}</span>
          <button
            onClick={copyLink}
            className="shrink-0 text-xs font-semibold bg-white text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="mt-3 flex gap-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`✨ Discover your lucky gemstone with AstroBot! Find out which gemstone is perfect for your zodiac sign and life goals.\n\n${shareLink}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>💬</span> Share on WhatsApp
          </a>
          <a
            href={shareLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>👁</span> Preview
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(["new", "contacted", "converted"] as AstrobotLead["status"][]).map((s) => {
          const count = leads.filter((l) => l.status === s).length;
          return (
            <div key={s} className="bg-white border border-border rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{LEAD_STATUS_LABELS[s]}</div>
            </div>
          );
        })}
      </div>

      {/* Lead list */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>📋</span> Leads
          {newCount > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{newCount} new</span>
          )}
        </h3>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="bg-white border border-dashed border-border rounded-xl p-8 text-center">
            <div className="text-3xl mb-2">🌟</div>
            <p className="text-sm font-medium text-foreground mb-1">No leads yet</p>
            <p className="text-xs text-muted-foreground">Share your AstroBot link with customers to start receiving leads.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => {
              const isExpanded = expandedId === lead.id;
              const waLink = `https://wa.me/${lead.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Hi ${lead.customer_name}! This is regarding your AstroBot gemstone recommendation for ${lead.recommended_gemstone}. I'd love to help you find the perfect stone. Are you available for a quick chat?`
              )}`;
              return (
                <div key={lead.id} className="bg-white border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                      {lead.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{lead.customer_name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${LEAD_STATUS_COLORS[lead.status]}`}>
                          {LEAD_STATUS_LABELS[lead.status]}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {lead.recommended_gemstone} · {lead.zodiac} · {lead.customer_phone}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors"
                      >
                        WA
                      </a>
                      <span className="text-muted-foreground text-xs">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-5 pt-4 space-y-4">
                      {/* Contact info */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Phone</div>
                          <a href={`tel:${lead.customer_phone}`} className="text-sm text-primary hover:underline">{lead.customer_phone}</a>
                        </div>
                        {lead.customer_email && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Email</div>
                            <a href={`mailto:${lead.customer_email}`} className="text-sm text-primary hover:underline truncate block">{lead.customer_email}</a>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Gemstone</div>
                          <div className="text-sm font-medium">{lead.recommended_gemstone}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Zodiac</div>
                          <div className="text-sm">{lead.zodiac}</div>
                        </div>
                        {lead.concern && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Goal</div>
                            <div className="text-sm capitalize">{lead.concern}</div>
                          </div>
                        )}
                        {lead.budget && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Budget</div>
                            <div className="text-sm capitalize">{lead.budget}</div>
                          </div>
                        )}
                        <div className="col-span-2">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Received</div>
                          <div className="text-sm">{new Date(lead.created_at).toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Astro reason */}
                      {lead.astro_reason && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-indigo-500 font-semibold mb-1">AstroBot Reason</div>
                          <p className="text-xs text-indigo-800 leading-relaxed">{lead.astro_reason.slice(0, 200)}{lead.astro_reason.length > 200 ? "…" : ""}</p>
                        </div>
                      )}

                      {/* Status update */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-semibold">Update status:</span>
                        {(["new", "contacted", "converted"] as AstrobotLead["status"][]).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateLead.mutate({ leadId: lead.id, data: { status: s } })}
                            className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
                              lead.status === s
                                ? LEAD_STATUS_COLORS[s] + " border-transparent"
                                : "border-border text-muted-foreground hover:bg-secondary"
                            }`}
                          >
                            {LEAD_STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>

                      {/* Notes */}
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notes</div>
                        <textarea
                          rows={2}
                          value={notesDraft[lead.id] ?? (lead.notes ?? "")}
                          onChange={(e) => setNotesDraft((d) => ({ ...d, [lead.id]: e.target.value }))}
                          placeholder="Add a note about this lead…"
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {notesDraft[lead.id] !== undefined && notesDraft[lead.id] !== (lead.notes ?? "") && (
                          <button
                            onClick={() => {
                              updateLead.mutate({ leadId: lead.id, data: { notes: notesDraft[lead.id] } });
                              setNotesDraft((d) => { const n = { ...d }; delete n[lead.id]; return n; });
                            }}
                            className="mt-1.5 text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            Save Note
                          </button>
                        )}
                      </div>

                      {/* WhatsApp CTA */}
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                      >
                        <span>💬</span> Message on WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: "store",      label: "My Store"    },
  { id: "analytics",  label: "Analytics"   },
  { id: "contacts",   label: "Contacts"    },
  { id: "approvals",  label: "Approvals"   },
  { id: "sales",      label: "Sales"        },
  { id: "receivables", label: "Receivables" },
  { id: "payables",   label: "Payables"    },
  { id: "invoices",   label: "Invoices"    },
  { id: "payments",   label: "Payments"    },
  { id: "astrobot",   label: "🔮 AstroBot Leads" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function TradeManagerPage() {
  const { userId, isLoading, plan, name, defaultCurrency } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<TabId>("store");
  const [approvalContactId, setApprovalContactId] = useState<string | null>(null);
  const [viewContact, setViewContact] = useState<TradeContact | null>(null);

  const { data: allContacts = [] } = useQuery<TradeContact[]>({
    queryKey: ["trm-contacts", userId],
    queryFn: () => api.trm.getContacts(userId),
    enabled: !!userId,
  });

  function handleNewApprovalFromContact(contactId: string) {
    setApprovalContactId(contactId);
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="font-semibold mb-3">Sign in required</p>
          <Link href="/"><button className="bg-primary text-primary-foreground rounded-lg px-6 py-2">Go to Sign In</button></Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground"><span className="spinner mr-2" /> Loading…</div>;
  }

  if (plan === "basic") return <PlanGate />;

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6 no-print">
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">My Business</h1>
            <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${plan === "premium" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
              {plan}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage your store, contacts, receivables, payables, invoices, and payments in one place.</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden no-print">
          <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-none px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={activeTab === "store" ? "" : "p-3 sm:p-6"}>
            {activeTab === "store"     && <DashboardPage />}
            {activeTab === "analytics" && <AnalyticsTab userId={userId} defaultCurrency={defaultCurrency} onViewContact={setViewContact} />}
            {activeTab === "contacts"      && <ContactsTab userId={userId} onNewApproval={handleNewApprovalFromContact} onViewContact={setViewContact} />}
            {activeTab === "approvals"     && <ApprovalsTab userId={userId} />}
            {activeTab === "sales"         && <SalesTab userId={userId} defaultCurrency={defaultCurrency} />}
            {activeTab === "receivables"   && <ReceivablesTab userId={userId} defaultCurrency={defaultCurrency} />}
            {activeTab === "payables"  && <PayablesTab userId={userId} defaultCurrency={defaultCurrency} />}
            {activeTab === "invoices"  && <InvoicesTab userId={userId} ownerName={name} />}
            {activeTab === "payments"  && <PaymentsTab userId={userId} />}
            {activeTab === "astrobot"  && <AstrobotLeadsTab userId={userId} />}
          </div>
        </div>
      </main>

      {/* Send on Approval modal from Contacts */}
      {approvalContactId && (
        <SendApprovalFromContactModal
          contactId={approvalContactId}
          userId={userId}
          contacts={allContacts}
          onClose={() => setApprovalContactId(null)}
        />
      )}

      {/* Contact detail panel */}
      {viewContact && (
        <ContactDetailPanel
          contact={viewContact}
          userId={userId}
          defaultCurrency={defaultCurrency}
          onClose={() => setViewContact(null)}
        />
      )}

    </div>
  );
}
