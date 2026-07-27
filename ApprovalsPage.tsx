import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  api, fmtCurrency,
  type ApprovalRequest, type PartnerListing, type Currency, type SalesRecord, type PayableRecord, type Gemstone
} from "@/lib/api";

const CURRENCIES: Currency[] = ["USD", "INR", "AED", "THB"];

// ─── Status badge colours (spec-aligned) ────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-amber-100 text-amber-800 border-amber-200",
  in_approval: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved:    "bg-blue-100 text-blue-800 border-blue-200",
  sold:        "bg-emerald-100 text-emerald-700 border-emerald-200",
  returned:    "bg-slate-100 text-slate-600 border-slate-200",
  expired:     "bg-red-100 text-red-600 border-red-200",
  recalled:    "bg-red-100 text-red-600 border-red-200",
  rejected:    "bg-red-100 text-red-600 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending:     "Pending",
  in_approval: "In Approval",
  approved:    "Approved",
  sold:        "Sold",
  returned:    "Returned",
  expired:     "Expired",
  recalled:    "Recalled",
  rejected:    "Rejected",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DaysRemaining({ expiryDate }: { expiryDate?: string | null }) {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return <span className="text-xs text-red-500 font-medium">Expired</span>;
  return (
    <span className={`text-xs font-medium ${days <= 3 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-slate-500"}`}>
      {days}d remaining
    </span>
  );
}

function GemThumb({ images }: { images?: Array<{ image_url: string; media_type?: string }> }) {
  const img = images?.[0];
  if (!img) return (
    <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
        <line x1="12" y1="2" x2="12" y2="22" /><line x1="2" y1="8.5" x2="22" y2="8.5" />
      </svg>
    </div>
  );
  return (
    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0">
      {img.media_type === "video"
        ? <video src={img.image_url} className="w-full h-full object-cover" muted />
        : <img src={img.image_url} className="w-full h-full object-cover" alt="" />
      }
    </div>
  );
}

// ─── Gemstone Combobox ────────────────────────────────────────────────────────

const COMMON_STONE_TYPES = ["Ruby", "Sapphire", "Blue Sapphire", "Pink Sapphire", "Yellow Sapphire", "Emerald", "Diamond", "Alexandrite", "Spinel", "Red Spinel", "Tourmaline", "Paraiba Tourmaline", "Tanzanite", "Aquamarine", "Opal", "Pearl", "Garnet", "Tsavorite Garnet", "Demantoid Garnet", "Amethyst", "Citrine", "Peridot", "Padparadscha", "Cat's Eye Chrysoberyl", "Jadeite", "Moonstone", "Zircon"];

function GemstoneCombobox({
  value,
  onChange,
  userId,
  inputCls,
}: {
  value: string;
  onChange: (v: string) => void;
  userId: string;
  inputCls: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  const { data: inventory = [] } = useQuery<Gemstone[]>({
    queryKey: ["my-inventory-combobox", userId],
    queryFn: () => api.getMyInventory(userId),
    staleTime: 120000,
  });

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const inventoryLabels = inventory.map((g) =>
    [g.carat ? `${g.carat}ct` : null, g.stone_type].filter(Boolean).join(" ")
  );
  const all = [...new Set([...COMMON_STONE_TYPES, ...inventoryLabels])];
  const q = query.trim().toLowerCase();
  const suggestions = q.length === 0 ? all.slice(0, 10) : all.filter((s) => s.toLowerCase().includes(q)).slice(0, 10);

  return (
    <div ref={ref} className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className={inputCls}
        placeholder="Type or search stone name…"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setQuery(s); setOpen(false); }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-primary/5 transition-colors ${s === value ? "font-semibold text-primary" : ""}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Manual Approval Modal (create or edit stone details) ────────────────────

function ManualApprovalModal({
  userId,
  direction,
  existing,
  onClose,
  onSaved,
}: {
  userId: string;
  direction: "sent" | "received";
  existing?: ApprovalRequest | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!existing;

  const [form, setForm] = useState({
    counterparty_name: existing?.counterparty_name ?? "",
    stone_type_manual: existing?.stone_type_manual ?? "",
    stone_carat_manual: existing?.stone_carat_manual != null ? String(existing.stone_carat_manual) : "",
    stone_price_manual: existing?.stone_price_manual != null ? String(existing.stone_price_manual) : "",
    stone_currency_manual: (existing?.stone_currency_manual as Currency) ?? "USD",
    collected_date: existing?.collected_date ?? "",
    returned_date: existing?.returned_date ?? "",
    notes: existing?.notes ?? "",
    status: existing?.status ?? "in_approval",
  });
  const [error, setError] = useState("");

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const createMut = useMutation({
    mutationFn: (data: Parameters<typeof api.createManualApproval>[0]) => api.createManualApproval(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: direction === "sent" ? ["incoming-approvals", userId] : ["my-approvals", userId] });
      void qc.invalidateQueries({ queryKey: ["trm-contacts", userId] });
      onSaved();
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof api.updateApprovalDetails>[2]) => api.updateApprovalDetails(existing!.id, userId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: direction === "sent" ? ["incoming-approvals", userId] : ["my-approvals", userId] });
      onSaved();
    },
  });

  async function handleSave() {
    setError("");
    const payload = {
      counterparty_name: form.counterparty_name.trim() || undefined,
      stone_type_manual: form.stone_type_manual.trim() || undefined,
      stone_carat_manual: form.stone_carat_manual !== "" ? Number(form.stone_carat_manual) : undefined,
      stone_price_manual: form.stone_price_manual !== "" ? Number(form.stone_price_manual) : undefined,
      stone_currency_manual: form.stone_currency_manual || undefined,
      collected_date: form.collected_date || undefined,
      returned_date: form.returned_date || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (isEdit) {
      updateMut.mutate({ ...payload, status: form.status as ApprovalRequest["status"] });
    } else {
      createMut.mutate({ user_id: userId, direction, ...payload });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white";
  const labelCls = "block text-xs font-semibold text-slate-600 mb-1";
  const counterpartyLabel = direction === "sent" ? "Given To (Counterparty)" : "Received From";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh]">
        <div className={`px-5 py-4 rounded-t-2xl text-white ${direction === "sent" ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-gradient-to-r from-violet-600 to-purple-600"}`}>
          <h2 className="text-base font-bold">{isEdit ? "Edit Details" : direction === "sent" ? "Log Stone Sent on Approval" : "Log Stone Received on Approval"}</h2>
          <p className="text-xs opacity-80 mt-0.5">{direction === "sent" ? "Track a stone you gave to someone to sell" : "Track a stone you received from someone to sell"}</p>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Counterparty */}
          <div>
            <label className={labelCls}>{counterpartyLabel}</label>
            <input value={form.counterparty_name} onChange={(e) => setField("counterparty_name", e.target.value)} className={inputCls} placeholder={direction === "sent" ? "e.g. Ahmed Trading Co." : "e.g. Burma Gem House"} />
          </div>

          {/* Stone Type */}
          <div>
            <label className={labelCls}>Stone Type</label>
            <GemstoneCombobox
              value={form.stone_type_manual}
              onChange={(v) => setField("stone_type_manual", v)}
              userId={userId}
              inputCls={inputCls}
            />
          </div>

          {/* Carat + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Carat Weight</label>
              <input type="number" step="0.01" min="0" value={form.stone_carat_manual} onChange={(e) => setField("stone_carat_manual", e.target.value)} className={inputCls} placeholder="e.g. 2.35" />
            </div>
            <div>
              <label className={labelCls}>Price</label>
              <div className="flex gap-1">
                <select value={form.stone_currency_manual} onChange={(e) => setField("stone_currency_manual", e.target.value)} className="border border-border rounded-lg px-2 py-2 text-sm bg-white focus:outline-none">
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input type="number" min="0" value={form.stone_price_manual} onChange={(e) => setField("stone_price_manual", e.target.value)} className={`${inputCls} flex-1`} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Collected Date */}
          <div>
            <label className={labelCls}>{direction === "sent" ? "Date Sent Out (Collected)" : "Date Received (Collected)"}</label>
            <input type="date" value={form.collected_date} onChange={(e) => setField("collected_date", e.target.value)} className={inputCls} />
          </div>

          {/* Returned Date */}
          <div>
            <label className={labelCls}>Date Returned</label>
            <input type="date" value={form.returned_date} onChange={(e) => setField("returned_date", e.target.value)} className={inputCls} />
            <p className="text-[11px] text-slate-400 mt-1">Leave blank if stone hasn't been returned yet.</p>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => setField("status", e.target.value)} className={inputCls}>
                <option value="in_approval">In Approval</option>
                <option value="returned">Returned</option>
                <option value="sold">Sold</option>
                <option value="recalled">Recalled</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Any remarks, certificate info, etc." />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 pt-0 border-t border-border/60 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Log Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to display stone details and dates on an approval card
function StoneDetailsRow({ r }: { r: ApprovalRequest }) {
  const ls = r.listing_snapshot;
  const stoneLabel = r.is_manual
    ? [r.stone_carat_manual ? `${r.stone_carat_manual}ct` : null, r.stone_type_manual].filter(Boolean).join(" ")
    : ls ? `${ls.carat}ct ${ls.stone_type}` : null;
  const price = r.is_manual && r.stone_price_manual != null
    ? fmtCurrency(r.stone_price_manual, (r.stone_currency_manual as Currency) ?? "USD")
    : ls?.price ? fmtCurrency(ls.price, (ls.currency as Currency) ?? "USD") : null;
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return (
    <>
      {stoneLabel && <span className="font-semibold text-sm">{stoneLabel}</span>}
      {price && <span className="text-xs text-muted-foreground"> · {price}</span>}
      {r.collected_date && (
        <p className="text-xs text-teal-700 mt-0.5">📤 Collected: {fmt(r.collected_date)}</p>
      )}
      {r.returned_date && (
        <p className="text-xs text-slate-500 mt-0.5">📥 Returned: {fmt(r.returned_date)}</p>
      )}
    </>
  );
}

// ─── Sent on Approval (Owner: outgoing / incoming requests) ─────────────────

export function SentOnApproval({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [extensionDays, setExtensionDays] = useState(7);
  const [manualModal, setManualModal] = useState<"create" | ApprovalRequest | null>(null);
  const [convertSaleId, setConvertSaleId] = useState<string | null>(null);
  const [convertBuyer, setConvertBuyer] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [convertCurrency, setConvertCurrency] = useState<Currency>("USD");

  const { data: requests = [], isLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ["incoming-approvals", userId],
    queryFn: () => api.getIncomingApprovals(userId),
    refetchInterval: 30000,
  });

  const { data: allSales = [] } = useQuery<SalesRecord[]>({
    queryKey: ["sales-ledger", userId, "all"],
    queryFn: () => api.sl.list(userId, "all"),
    refetchInterval: 60000,
  });

  const approvalSales = allSales.filter((s) => s.sale_type === "approval");

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteManualApproval(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incoming-approvals", userId] }),
  });

  const convertSaleMut = useMutation({
    mutationFn: async ({ r, buyer, amount, currency }: { r: ApprovalRequest; buyer: string; amount: number; currency: Currency }) => {
      const ls = r.listing_snapshot;
      const stoneLabel = r.is_manual
        ? [r.stone_carat_manual ? `${r.stone_carat_manual}ct` : null, r.stone_type_manual].filter(Boolean).join(" ") || "Stone"
        : ls ? `${ls.carat}ct ${ls.stone_type}` : "Stone";
      await api.sl.create(userId, {
        gemstone_name: stoneLabel,
        buyer_name: buyer,
        total_amount: amount,
        currency,
        sale_type: "approval",
        status: "pending",
      });
      await api.updateApprovalDetails(r.id, userId, { status: "sold" });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["incoming-approvals", userId] });
      void qc.invalidateQueries({ queryKey: ["sales-ledger", userId] });
      setConvertSaleId(null);
    },
    onError: (e) => alert((e as Error).message),
  });

  async function doAction(id: string, action: () => Promise<unknown>) {
    setActionLoading(id);
    try {
      await action();
      void qc.invalidateQueries({ queryKey: ["incoming-approvals", userId] });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  const totalEntries = requests.length + approvalSales.length;

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-3">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{totalEntries} {totalEntries === 1 ? "entry" : "entries"}</p>
        <button
          onClick={() => setManualModal("create")}
          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
        >
          + Add Manually
        </button>
      </div>

      {totalEntries === 0 && (
        <div className="py-10 text-center space-y-2 border-2 border-dashed border-border/50 rounded-2xl">
          <p className="font-semibold text-foreground">No approvals sent yet</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Enable approval on your listings, or add an off-platform entry manually.
          </p>
        </div>
      )}

      {requests.map((r) => {
        const ls = r.listing_snapshot;
        const busy = actionLoading === r.id;
        const stoneTitle = r.is_manual
          ? [r.stone_carat_manual ? `${r.stone_carat_manual}ct` : null, r.stone_type_manual].filter(Boolean).join(" ") || "Manual Entry"
          : ls ? `${ls.carat}ct ${ls.stone_type}` : "Unknown Stone";
        const counterparty = r.is_manual
          ? r.counterparty_name ?? "—"
          : r.requester?.company_name ?? r.requester?.name ?? "Unknown";

        return (
          <div key={r.id} className={`border rounded-2xl p-4 space-y-3 bg-white hover:shadow-sm transition-shadow ${r.is_manual ? "border-blue-200" : "border-border"}`}>
            <div className="flex gap-3 items-start">
              {r.is_manual
                ? <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 text-blue-400 text-xl">💎</div>
                : <GemThumb images={ls?.images} />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{stoneTitle}</span>
                  <StatusBadge status={r.status} />
                  {r.is_manual && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide border border-blue-200">Manual</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Partner: <span className="font-medium text-foreground">{counterparty}</span>
                </p>
                {r.is_manual && r.stone_price_manual != null && (
                  <p className="text-xs text-primary font-semibold mt-0.5">{fmtCurrency(r.stone_price_manual, (r.stone_currency_manual as Currency) ?? "USD")}</p>
                )}
                {r.collected_date && (
                  <p className="text-xs text-teal-700 mt-0.5">📤 Sent out: {new Date(r.collected_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                )}
                {r.returned_date && (
                  <p className="text-xs text-slate-500 mt-0.5">📥 Returned: {new Date(r.returned_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                )}
                {!r.is_manual && r.notes && <p className="text-xs text-slate-600 mt-1 italic">"{r.notes}"</p>}
                {!r.is_manual && r.expiry_date && (
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <DaysRemaining expiryDate={r.expiry_date} />
                    <span className="text-xs text-muted-foreground">· expires {new Date(r.expiry_date).toLocaleDateString()}</span>
                    {r.extension_requested && (
                      <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">
                        Extension requested ({r.extension_days ?? 7}d)
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.is_manual ? "Added" : "Requested"} {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
              {/* Edit details button (all entries) */}
              <button
                onClick={() => setManualModal(r)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-slate-600 hover:bg-slate-50 transition-colors font-medium"
              >
                ✏️ Edit Details
              </button>

              {/* Convert to Sale — shown when not already sold / returned / recalled */}
              {!["sold", "returned", "recalled", "rejected", "expired"].includes(r.status) && convertSaleId !== r.id && (
                <button
                  onClick={() => {
                    const counterparty = r.is_manual ? (r.counterparty_name ?? "") : (r.requester?.company_name ?? r.requester?.name ?? "");
                    setConvertBuyer(counterparty);
                    setConvertAmount(r.is_manual && r.stone_price_manual != null ? String(r.stone_price_manual) : "");
                    setConvertCurrency((r.stone_currency_manual as Currency) ?? "USD");
                    setConvertSaleId(r.id);
                  }}
                  className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors font-semibold"
                >
                  💰 Convert to Sale
                </button>
              )}

              {/* Convert to Sale inline form */}
              {convertSaleId === r.id && (
                <div className="w-full space-y-2 mt-1 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-800">Record Sale from Approval</p>
                  <div>
                    <p className="text-[11px] text-emerald-700 mb-1">Buyer Name</p>
                    <input
                      value={convertBuyer}
                      onChange={(e) => setConvertBuyer(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-border outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                      placeholder="e.g. Ahmed Trading Co."
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[11px] text-emerald-700 mb-1">Sale Amount</p>
                      <input
                        type="number"
                        min="0"
                        value={convertAmount}
                        onChange={(e) => setConvertAmount(e.target.value)}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-border outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-emerald-700 mb-1">Currency</p>
                      <select value={convertCurrency} onChange={(e) => setConvertCurrency(e.target.value as Currency)} className="h-[38px] text-sm px-2 rounded-lg border border-border outline-none bg-white">
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setConvertSaleId(null)} className="flex-1 text-xs py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-secondary">Cancel</button>
                    <button
                      disabled={convertSaleMut.isPending}
                      onClick={() => {
                        const amount = parseFloat(convertAmount);
                        if (!convertBuyer.trim()) { alert("Enter a buyer name"); return; }
                        if (!amount || isNaN(amount)) { alert("Enter a valid sale amount"); return; }
                        convertSaleMut.mutate({ r, buyer: convertBuyer.trim(), amount, currency: convertCurrency });
                      }}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {convertSaleMut.isPending ? "Saving…" : "Confirm Sale"}
                    </button>
                  </div>
                </div>
              )}

              {/* Marketplace listing link */}
              {!r.is_manual && ls?.id && (
                <Link href={`/listing/${ls.id}`}>
                  <span className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
                    View Listing
                  </span>
                </Link>
              )}

              {/* Non-manual actions */}
              {!r.is_manual && r.status === "pending" && (
                <>
                  <button onClick={() => doAction(r.id, () => api.approveRequest(r.id, userId))} disabled={busy} className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-60">
                    {busy ? "…" : "Approve"}
                  </button>
                  <button onClick={() => doAction(r.id, () => api.rejectRequest(r.id, userId))} disabled={busy} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-semibold disabled:opacity-60">
                    Reject
                  </button>
                </>
              )}
              {!r.is_manual && r.status === "in_approval" && (
                <>
                  <button onClick={() => doAction(r.id, () => api.recallItem(r.id, userId))} disabled={busy} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-semibold disabled:opacity-60">
                    Recall
                  </button>
                  {r.extension_requested && (
                    extensionId === r.id ? (
                      <div className="flex items-center gap-2">
                        <input type="number" value={extensionDays} min={1} max={90} onChange={(e) => setExtensionDays(Number(e.target.value))} className="w-16 text-xs border border-border rounded-lg px-2 py-1 outline-none" />
                        <span className="text-xs text-muted-foreground">days</span>
                        <button onClick={() => doAction(r.id, () => api.grantExtension(r.id, userId, extensionDays)).then(() => setExtensionId(null))} className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">Grant</button>
                      </div>
                    ) : (
                      <button onClick={() => setExtensionId(r.id)} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors font-semibold">
                        Grant Extension
                      </button>
                    )
                  )}
                </>
              )}

              {/* Delete (manual only) */}
              {r.is_manual && (
                <button
                  onClick={() => { if (confirm("Delete this entry?")) deleteMut.mutate(r.id); }}
                  className="text-xs px-3 py-1.5 text-red-600 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Sales Ledger "approval" entries — stones sold via consignment */}
      {approvalSales.map((s) => {
        const statusColor = s.status === "paid" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
          : s.status === "overdue" ? "bg-red-100 text-red-800 border-red-200"
          : s.status === "partial" ? "bg-amber-100 text-amber-800 border-amber-200"
          : "bg-slate-100 text-slate-700 border-slate-200";
        const statusLabel = s.status === "paid" ? "Sold · Paid" : s.status === "partial" ? "Sold · Partial" : s.status === "overdue" ? "Sold · Overdue" : "Sold · Pending";
        return (
          <div key={s.id} className="border border-emerald-200 rounded-2xl p-4 space-y-3 bg-emerald-50/40 hover:shadow-sm transition-shadow">
            <div className="flex gap-3 items-start">
              <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-500 text-xl">💎</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{s.gemstone_name}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${statusColor}`}>{statusLabel}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide border border-emerald-200">Sales Record</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  To: <span className="font-medium text-foreground">{s.buyer_company || s.buyer_name}</span>
                </p>
                <p className="text-xs text-primary font-semibold mt-0.5">{fmtCurrency(s.total_amount, s.currency as Currency)}</p>
                {s.amount_received > 0 && s.amount_received < s.total_amount && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    Received: {fmtCurrency(s.amount_received, s.currency as Currency)} · Outstanding: {fmtCurrency(s.outstanding_amount ?? s.total_amount - s.amount_received, s.currency as Currency)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">Sold on {new Date(s.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                {s.notes && <p className="text-xs text-slate-500 mt-1 italic">"{s.notes}"</p>}
              </div>
            </div>
            <div className="pt-1 border-t border-emerald-200/60">
              <p className="text-xs text-emerald-700">This record is from your <strong>Sales</strong> tab. Full details and payment tracking available there.</p>
            </div>
          </div>
        );
      })}

      {manualModal && (
        <ManualApprovalModal
          userId={userId}
          direction="sent"
          existing={manualModal === "create" ? null : manualModal}
          onClose={() => setManualModal(null)}
          onSaved={() => setManualModal(null)}
        />
      )}
    </div>
  );
}

// ─── Received on Approval (Partner: items you're holding to sell) ─────────────

export function ReceivedOnApproval({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sellModal, setSellModal] = useState<string | null>(null);
  const [finalPrice, setFinalPrice] = useState("");
  const [addStoreModal, setAddStoreModal] = useState<string | null>(null);
  const [storePrice, setStorePrice] = useState("");
  const [storeCurrency, setStoreCurrency] = useState<Currency>("USD");
  const [manualModal, setManualModal] = useState<"create" | ApprovalRequest | null>(null);
  const [convertPayableId, setConvertPayableId] = useState<string | null>(null);
  const [convertOwed, setConvertOwed] = useState("");
  const [convertOwedCurrency, setConvertOwedCurrency] = useState<Currency>("USD");

  const { data: requests = [], isLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ["my-approvals", userId],
    queryFn: () => api.getMyApprovals(userId),
    refetchInterval: 30000,
  });

  const { data: allPayables = [] } = useQuery<PayableRecord[]>({
    queryKey: ["payables-ledger", userId, "all"],
    queryFn: () => api.pl.list(userId, "all"),
    refetchInterval: 60000,
  });

  const approvalPayables = allPayables.filter((p) => p.purchase_type === "approval");

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteManualApproval(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-approvals", userId] }),
  });

  const convertPayableMut = useMutation({
    mutationFn: async ({ r, owed, currency }: { r: ApprovalRequest; owed: number; currency: Currency }) => {
      const ls = r.listing_snapshot;
      const stoneLabel = r.is_manual
        ? [r.stone_carat_manual ? `${r.stone_carat_manual}ct` : null, r.stone_type_manual].filter(Boolean).join(" ") || "Stone"
        : ls ? `${ls.carat}ct ${ls.stone_type}` : "Stone";
      const ownerName = r.is_manual
        ? (r.counterparty_name ?? "Supplier")
        : (r.owner?.company_name ?? r.owner?.name ?? "Supplier");
      await api.pl.create(userId, {
        gemstone_name: stoneLabel,
        supplier_name: ownerName,
        total_cost: owed,
        currency,
        purchase_type: "approval",
        status: "pending",
      });
      await api.updateApprovalDetails(r.id, userId, { status: "sold" });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-approvals", userId] });
      void qc.invalidateQueries({ queryKey: ["payables-ledger", userId] });
      setConvertPayableId(null);
    },
    onError: (e) => alert((e as Error).message),
  });

  async function doAction(id: string, action: () => Promise<unknown>) {
    setActionLoading(id);
    try {
      await action();
      void qc.invalidateQueries({ queryKey: ["my-approvals", userId] });
      void qc.invalidateQueries({ queryKey: ["my-partner-listings", userId] });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  const totalEntries = requests.length + approvalPayables.length;

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-3">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{totalEntries} {totalEntries === 1 ? "entry" : "entries"}</p>
        <button
          onClick={() => setManualModal("create")}
          className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-semibold transition-colors"
        >
          + Add Manually
        </button>
      </div>

      {totalEntries === 0 && (
        <div className="py-10 text-center space-y-2 border-2 border-dashed border-border/50 rounded-2xl">
          <p className="font-semibold text-foreground">No stones received yet</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Browse listings and request items on approval, or add an off-platform entry manually.
          </p>
        </div>
      )}

      {requests.map((r) => {
        const ls = r.listing_snapshot;
        const busy = actionLoading === r.id;
        const canAct = !r.is_manual && r.status === "in_approval";
        const stoneTitle = r.is_manual
          ? [r.stone_carat_manual ? `${r.stone_carat_manual}ct` : null, r.stone_type_manual].filter(Boolean).join(" ") || "Manual Entry"
          : ls ? `${ls.carat}ct ${ls.stone_type}` : "Unknown Stone";
        const counterparty = r.is_manual
          ? r.counterparty_name ?? "—"
          : r.owner?.company_name ?? r.owner?.name ?? "Unknown";

        return (
          <div key={r.id} className={`border rounded-2xl p-4 space-y-3 bg-white hover:shadow-sm transition-shadow ${r.is_manual ? "border-violet-200" : "border-border"}`}>
            <div className="flex gap-3 items-start">
              {r.is_manual
                ? <div className="w-14 h-14 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 text-violet-400 text-xl">💎</div>
                : <GemThumb images={ls?.images} />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{stoneTitle}</span>
                  <StatusBadge status={r.status} />
                  {r.is_manual && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide border border-violet-200">Manual</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  From: <span className="font-medium text-foreground">{counterparty}</span>
                </p>
                {r.is_manual && r.stone_price_manual != null && (
                  <p className="text-xs text-primary font-semibold mt-0.5">{fmtCurrency(r.stone_price_manual, (r.stone_currency_manual as Currency) ?? "USD")}</p>
                )}
                {!r.is_manual && ls?.price && ls.currency && (
                  <p className="text-xs text-muted-foreground">
                    Base: {fmtCurrency(ls.price, ls.currency as Currency)}
                    {ls.min_price ? ` · Min. selling: ${fmtCurrency(ls.min_price, ls.currency as Currency)}` : ""}
                  </p>
                )}
                {r.collected_date && (
                  <p className="text-xs text-teal-700 mt-0.5">📤 Collected: {new Date(r.collected_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                )}
                {r.returned_date && (
                  <p className="text-xs text-slate-500 mt-0.5">📥 Returned: {new Date(r.returned_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                )}
                {canAct && (
                  <div className="mt-1 flex items-center gap-2">
                    <DaysRemaining expiryDate={r.expiry_date} />
                    {r.expiry_date && <span className="text-xs text-muted-foreground">· until {new Date(r.expiry_date).toLocaleDateString()}</span>}
                  </div>
                )}
                {r.extension_requested && <span className="text-xs text-amber-700 font-medium">Extension request sent</span>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
              {/* Edit details button (all entries) */}
              <button
                onClick={() => setManualModal(r)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-slate-600 hover:bg-slate-50 transition-colors font-medium"
              >
                ✏️ Edit Details
              </button>

              {/* Convert to Sale (creates payable to owner + marks sold) */}
              {!["sold", "returned", "recalled", "rejected", "expired"].includes(r.status) && convertPayableId !== r.id && (
                <button
                  onClick={() => {
                    const price = r.is_manual && r.stone_price_manual != null
                      ? String(r.stone_price_manual)
                      : r.listing_snapshot?.price ? String(r.listing_snapshot.price) : "";
                    setConvertOwed(price);
                    setConvertOwedCurrency((r.stone_currency_manual as Currency) ?? (r.listing_snapshot?.currency as Currency) ?? "USD");
                    setConvertPayableId(r.id);
                  }}
                  className="text-xs px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors font-semibold"
                >
                  💰 Convert to Sale
                </button>
              )}

              {/* Convert to Sale inline form for ReceivedOnApproval */}
              {convertPayableId === r.id && (
                <div className="w-full space-y-2 mt-1 p-3 bg-violet-50 rounded-xl border border-violet-200">
                  <p className="text-xs font-semibold text-violet-800">Record Sale — Amount Owed to Owner</p>
                  <p className="text-[11px] text-violet-600">Enter what you owe to <strong>{r.is_manual ? (r.counterparty_name ?? "Supplier") : (r.owner?.company_name ?? r.owner?.name ?? "Supplier")}</strong> for this stone.</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[11px] text-violet-700 mb-1">Amount Owed</p>
                      <input
                        type="number"
                        min="0"
                        value={convertOwed}
                        onChange={(e) => setConvertOwed(e.target.value)}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-border outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-violet-700 mb-1">Currency</p>
                      <select value={convertOwedCurrency} onChange={(e) => setConvertOwedCurrency(e.target.value as Currency)} className="h-[38px] text-sm px-2 rounded-lg border border-border outline-none bg-white">
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setConvertPayableId(null)} className="flex-1 text-xs py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-secondary">Cancel</button>
                    <button
                      disabled={convertPayableMut.isPending}
                      onClick={() => {
                        const owed = parseFloat(convertOwed);
                        if (!owed || isNaN(owed)) { alert("Enter the amount owed to the owner"); return; }
                        convertPayableMut.mutate({ r, owed, currency: convertOwedCurrency });
                      }}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-60"
                    >
                      {convertPayableMut.isPending ? "Saving…" : "Confirm Sale"}
                    </button>
                  </div>
                </div>
              )}

              {canAct && ls?.id && (
                <Link href={`/listing/${ls.id}`}>
                  <span className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer">View Original</span>
                </Link>
              )}

              {canAct && (
                <>
                  {addStoreModal === r.id ? (
                    <div className="w-full space-y-2 mt-1">
                      <p className="text-xs font-semibold text-foreground">Set your selling price</p>
                      <div className="flex gap-2">
                        <input type="number" value={storePrice} onChange={(e) => setStorePrice(e.target.value)} placeholder={`Min. ${ls?.min_price ?? ls?.price ?? 0}`} className="flex-1 text-sm px-3 py-2 rounded-lg border border-border outline-none focus:ring-2 focus:ring-ring/30" />
                        <select value={storeCurrency} onChange={(e) => setStoreCurrency(e.target.value as Currency)} className="text-sm px-2 py-2 rounded-lg border border-border outline-none bg-white">
                          {(["USD", "INR", "AED", "THB"] as Currency[]).map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setAddStoreModal(null)} className="flex-1 text-xs py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-secondary">Cancel</button>
                        <button onClick={() => { const price = parseFloat(storePrice); if (!price || isNaN(price)) { alert("Enter a valid price"); return; } void doAction(r.id, () => api.addToStore(r.id, userId, price, storeCurrency)).then(() => setAddStoreModal(null)); }} disabled={busy} className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60">{busy ? "…" : "Add to My Listings"}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setAddStoreModal(r.id); setStorePrice(""); }} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-semibold">+ Add to My Listings</button>
                  )}

                  {sellModal === r.id ? (
                    <div className="w-full space-y-2 mt-1">
                      <p className="text-xs font-semibold text-foreground">Final selling price (optional)</p>
                      <div className="flex gap-2">
                        <input type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} placeholder="e.g. 5500" className="flex-1 text-sm px-3 py-2 rounded-lg border border-border outline-none focus:ring-2 focus:ring-ring/30" />
                        <button onClick={() => void doAction(r.id, () => api.markAsSold(r.id, userId, finalPrice ? parseFloat(finalPrice) : undefined)).then(() => setSellModal(null))} disabled={busy} className="px-4 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60">{busy ? "…" : "Confirm Sale"}</button>
                      </div>
                      <button onClick={() => setSellModal(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setSellModal(r.id); setFinalPrice(""); }} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors font-semibold">Mark as Sold</button>
                  )}

                  <button onClick={() => doAction(r.id, () => api.returnItem(r.id, userId))} disabled={busy} className="text-xs px-3 py-1.5 text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60">Return</button>

                  {!r.extension_requested && (
                    <button onClick={() => doAction(r.id, () => api.requestExtension(r.id, userId))} disabled={busy} className="text-xs px-3 py-1.5 border border-border text-muted-foreground rounded-lg hover:bg-secondary transition-colors">Request Extension</button>
                  )}
                </>
              )}

              {/* Delete (manual only) */}
              {r.is_manual && (
                <button
                  onClick={() => { if (confirm("Delete this entry?")) deleteMut.mutate(r.id); }}
                  className="text-xs px-3 py-1.5 text-red-600 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Payables Ledger "approval" entries — stones you took from someone to sell */}
      {approvalPayables.map((p) => {
        const statusColor = p.status === "paid" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
          : p.status === "overdue" ? "bg-red-100 text-red-800 border-red-200"
          : p.status === "partial" ? "bg-amber-100 text-amber-800 border-amber-200"
          : "bg-slate-100 text-slate-700 border-slate-200";
        const statusLabel = p.status === "paid" ? "Paid in Full" : p.status === "partial" ? "Partially Paid" : p.status === "overdue" ? "Payment Overdue" : "Payment Pending";
        return (
          <div key={p.id} className="border border-violet-200 rounded-2xl p-4 space-y-3 bg-violet-50/40 hover:shadow-sm transition-shadow">
            <div className="flex gap-3 items-start">
              <div className="w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 text-violet-500 text-xl">💎</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{p.gemstone_name}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${statusColor}`}>{statusLabel}</span>
                  <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide border border-violet-200">Payable Record</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  From: <span className="font-medium text-foreground">{p.supplier_company || p.supplier_name}</span>
                </p>
                <p className="text-xs text-primary font-semibold mt-0.5">{fmtCurrency(p.total_cost, p.currency as Currency)}</p>
                {p.amount_paid > 0 && p.amount_paid < p.total_cost && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    Paid: {fmtCurrency(p.amount_paid, p.currency as Currency)} · Outstanding: {fmtCurrency(p.outstanding_amount ?? p.total_cost - p.amount_paid, p.currency as Currency)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">Added {new Date(p.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
                {p.notes && <p className="text-xs text-slate-500 mt-1 italic">"{p.notes}"</p>}
              </div>
            </div>
            <div className="pt-1 border-t border-violet-200/60">
              <p className="text-xs text-violet-700">This record is from your <strong>Payables</strong> tab. Full details and payment tracking available there.</p>
            </div>
          </div>
        );
      })}

      {manualModal && (
        <ManualApprovalModal
          userId={userId}
          direction="received"
          existing={manualModal === "create" ? null : manualModal}
          onClose={() => setManualModal(null)}
          onSaved={() => setManualModal(null)}
        />
      )}
    </div>
  );
}

// ─── My Listings (Distributed Partner Listings) ────────────────────────────

export function MyListings({ userId }: { userId: string }) {
  const { data: listings = [], isLoading } = useQuery<PartnerListing[]>({
    queryKey: ["my-partner-listings", userId],
    queryFn: () => api.getMyPartnerListings(userId),
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>;

  if (!listings.length) return (
    <div className="py-12 text-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>
      <p className="font-semibold text-foreground">No listings yet</p>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
        Once you hold a stone on approval, tap "Add to My Listings" to list it for your buyers.
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {listings.map((pl) => {
        const gem = pl.original_gem;
        return (
          <div key={pl.id} className="border border-border rounded-2xl p-4 space-y-3 bg-white hover:shadow-sm transition-shadow">
            <div className="flex gap-3 items-start">
              <GemThumb images={gem?.images} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">
                    {gem ? `${gem.carat}ct ${gem.stone_type}` : "Unknown Stone"}
                  </span>
                  <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-semibold">
                    Co-sell Enabled
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  From: <span className="font-medium text-foreground">{pl.owner?.company_name ?? pl.owner?.name ?? "Owner"}</span>
                </p>
                <p className="text-sm font-semibold text-primary mt-1">
                  {fmtCurrency(pl.selling_price, pl.selling_currency as Currency)}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <DaysRemaining expiryDate={pl.expiry_date} />
                  {pl.expiry_date && <span className="text-xs text-muted-foreground">· until {new Date(pl.expiry_date).toLocaleDateString()}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
              {gem?.id && (
                <Link href={`/listing/${pl.original_listing_id}`}>
                  <span className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    View Original
                  </span>
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "incoming" | "mine" | "store";

const TABS: { id: Tab; label: string; subtext: string; icon: React.ReactNode }[] = [
  {
    id: "incoming",
    label: "Sent on Approval",
    subtext: "Stones you've shared with partners",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    id: "mine",
    label: "Received on Approval",
    subtext: "Stones you've taken to sell",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    id: "store",
    label: "My Listings",
    subtext: "Your inventory for direct and partner sales",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export default function ApprovalsPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("incoming");

  const userId = localStorage.getItem("gw_user_id");

  if (!userId) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="font-semibold text-foreground mb-2">Sign in required</p>
        <p className="text-sm text-muted-foreground mb-6">You need to be signed in to manage approval requests.</p>
        <button onClick={() => navigate("/")} className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90">
          Go to Sign In
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Approval (Memo) Trading</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send stones on approval, manage partner requests, and let your network sell for you.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 text-left px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
              activeTab === t.id
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-border/80 hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={activeTab === t.id ? "text-primary" : "text-muted-foreground"}>
                {t.icon}
              </span>
              <div>
                <p className={`text-sm font-semibold ${activeTab === t.id ? "text-primary" : "text-foreground"}`}>
                  {t.label}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block mt-0.5">{t.subtext}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "incoming" && <SentOnApproval userId={userId} />}
      {activeTab === "mine"     && <ReceivedOnApproval userId={userId} />}
      {activeTab === "store"    && <MyListings userId={userId} />}
    </main>
  );
}
