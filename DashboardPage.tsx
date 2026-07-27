import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { api, computeProfileCompletion, fmtCurrency, type Gemstone, type Currency, type PublicProfile, type GemImage, type SupportTicketWithResponses, type Sale, type ListingCreditPackType, type TradeContact } from "@/lib/api";
import { useUpload } from "@workspace/object-storage-web";
import SearchableSelect from "@/components/SearchableSelect";
import { STONE_TYPES, getAliasesForName } from "@/lib/gemstones";
import PaymentModal from "@/components/PaymentModal";

const STONE_ALIAS_MAP: Record<string, string[]> = Object.fromEntries(
  STONE_TYPES.map((n) => [n, getAliasesForName(n)])
);
const CURRENCIES: Currency[] = ["USD", "INR", "AED", "THB"];
const TREATMENTS = ["None", "Heat", "Minor Heat", "Oiling", "Fracture Filled", "Irradiated", "Beryllium", "Clarity Enhanced"];
const GIA_COLORS = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const GIA_CLARITIES = ["IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"];

const BADGE_LABELS: Record<string, string> = {
  none: "Unverified",
  basic_verified: "✓ Basic Verified",
  verified: "✓ Verified",
  legacy_verified: "★ Legacy Verified",
};

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic (5 listings)",
  pro: "Pro (50 listings)",
  premium: "Premium (Unlimited)",
};

const PLAN_LIMITS: Record<string, number | null> = {
  basic: 5,
  pro: 50,
  premium: null,
};

const CREDIT_PACKS: { key: ListingCreditPackType; credits: number; price: number; label: string }[] = [
  { key: "credits_10", credits: 10, price: 19, label: "10 Credits" },
  { key: "credits_25", credits: 25, price: 39, label: "25 Credits" },
  { key: "credits_50", credits: 50, price: 69, label: "50 Credits" },
];

function ShareListingButton({ gem }: { gem: Gemstone }) {
  const [copied, setCopied] = useState(false);
  const base = typeof window !== "undefined" ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}` : "";
  const url = `${base}/listing/${gem.id}`;
  const title = `${gem.carat}ct ${gem.stone_type} — LuckyBirthstone`;
  const text = `Check out this ${gem.carat}ct ${gem.stone_type} from ${gem.origin} on LuckyBirthstone`;

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <button
      onClick={share}
      title="Share listing"
      className="flex items-center gap-1.5 text-xs font-semibold py-2 px-2.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
    >
      {copied ? (
        <>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-600">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </>
      )}
    </button>
  );
}

function ListingCard({
  gem,
  onPromote,
  onConfirmSale,
  onEdit,
  onDelete,
  onStartAuction,
  onSendApproval,
  onUpdateCurrency,
  soldGemIds,
}: {
  gem: Gemstone;
  onPromote: (gem: Gemstone) => void;
  onConfirmSale: (gem: Gemstone) => void;
  onEdit: (gem: Gemstone) => void;
  onDelete: (gem: Gemstone) => void;
  onStartAuction: (gem: Gemstone) => void;
  onSendApproval: (gem: Gemstone) => void;
  onUpdateCurrency: (gem: Gemstone, currency: Currency) => void;
  soldGemIds: Set<string>;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isDiamond = gem.stone_type.toLowerCase() === "diamond";
  const isSold = soldGemIds.has(gem.id);
  const boostExpiry = gem.boost_expiry_date ? new Date(gem.boost_expiry_date) : null;
  const boostActive = boostExpiry && boostExpiry > new Date();
  const daysLeft = boostActive ? Math.ceil((boostExpiry.getTime() - Date.now()) / 86400000) : 0;
  const isUnderReview = gem.listing_status === "review";
  const goesLiveAt = gem.goes_live_at ? new Date(gem.goes_live_at) : null;
  const secsLeft = goesLiveAt ? Math.max(0, Math.ceil((goesLiveAt.getTime() - Date.now()) / 1000)) : 0;

  return (
    <div className={`bg-white border rounded-xl p-4 flex flex-col gap-2.5 ${
      isUnderReview ? "border-blue-200 shadow-blue-50 shadow-sm" :
      gem.is_featured ? "border-amber-300 shadow-amber-100 shadow-md" : "border-border"
    } ${isSold ? "opacity-60" : ""}`}>
      {isUnderReview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium flex items-center gap-2">
          <span className="spinner !w-3 !h-3 !border-blue-400 !border-t-transparent" />
          Under review{secsLeft > 0 ? ` · goes live in ${secsLeft}s` : " · going live soon…"}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
            <Link href={`/listing/${gem.id}`} className="hover:text-primary hover:underline transition-colors">
              {gem.stone_type}
            </Link>
            {isDiamond && gem.color && <span className="text-xs font-normal text-muted-foreground">{gem.color}/{gem.clarity}</span>}
            {gem.is_featured && boostActive && (
              <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-semibold">Featured · {daysLeft}d left</span>
            )}
            {gem.approval_enabled && !isSold && (
              <span className="text-[10px] bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full font-semibold">Co-sell Enabled</span>
            )}
            {isSold && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-300 px-1.5 py-0.5 rounded-full font-semibold">Sold</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{gem.carat} ct · {gem.origin} · {gem.treatment}{gem.num_pieces ? ` · ${gem.num_pieces} pcs` : ""}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold text-sm">{fmtCurrency(gem.price, gem.currency)}</div>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <select
              value={gem.currency}
              disabled={isSold}
              onChange={(e) => onUpdateCurrency(gem, e.target.value as Currency)}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-muted-foreground bg-transparent border-0 cursor-pointer hover:text-primary p-0 focus:ring-0 focus:outline-none disabled:opacity-40"
              title="Change listing currency"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-2.5 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Est. Range</span>
          <span className="font-medium">${gem.estimated_price_min.toLocaleString()} – ${gem.estimated_price_max.toLocaleString()}</span>
        </div>
        {isDiamond && gem.rap_price_per_carat && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rap/ct</span>
            <span className="font-medium">${gem.rap_price_per_carat.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Confidence</span>
          <span className={`conf-${gem.pricing_confidence} text-[10px] px-1.5 py-0.5 rounded-full font-medium`}>
            {gem.pricing_confidence}
          </span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">Cert: {gem.certificate_number}</div>

      <div className="flex gap-2 pt-1 border-t border-border flex-wrap">
        <button
          onClick={() => onEdit(gem)}
          className="flex-1 text-xs font-semibold py-2 px-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
        >
          ✏ Edit
        </button>
        <button
          onClick={() => onPromote(gem)}
          disabled={isSold || isUnderReview || (gem.is_featured && !!boostActive)}
          className="flex-1 text-xs font-semibold py-2 px-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={boostActive ? `Featured until ${boostExpiry?.toLocaleDateString()}` : "Promote to Featured for $10"}
        >
          {gem.is_featured && boostActive ? "⭐ Featured" : "⭐ Promote · $10"}
        </button>
        <button
          onClick={() => onConfirmSale(gem)}
          disabled={isSold || isUnderReview}
          className="flex-1 text-xs font-semibold py-2 px-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isSold ? "✅ Sold" : "✅ Confirm Sale"}
        </button>
      </div>

      <div className="pt-1 border-t border-border">
        <button
          onClick={() => onStartAuction(gem)}
          disabled={isSold || isUnderReview || !!gem.is_in_auction}
          className="w-full text-xs font-semibold py-2 rounded-lg border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={gem.is_in_auction ? "Already in auction" : "Start a live auction for this gem"}
        >
          {gem.is_in_auction ? "🏆 In Auction" : "🏆 Start Gem Auction"}
        </button>
      </div>

      <div className="pt-1 border-t border-border">
        <button
          onClick={() => onSendApproval(gem)}
          disabled={isSold || isUnderReview}
          className="w-full text-xs font-semibold py-2 rounded-lg border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Send this gem to a contact on approval"
        >
          {gem.approval_enabled ? "🤝 Approval Sent" : "🤝 Send on Approval"}
        </button>
      </div>

      <div className="pt-1 border-t border-border flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {isUnderReview ? "Under review" : gem.listing_status === "approved" ? "Live" : gem.listing_status}
        </span>
        <ShareListingButton gem={gem} />
      </div>

      {deleteConfirm ? (
        <div className="flex gap-2 pt-1 border-t border-red-100">
          <span className="flex-1 text-xs text-red-700 font-medium flex items-center">Delete permanently?</span>
          <button
            onClick={() => setDeleteConfirm(false)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { setDeleteConfirm(false); onDelete(gem); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-semibold transition-colors"
          >
            Yes, Delete
          </button>
        </div>
      ) : (
        <div className="pt-1 border-t border-border">
          <button
            onClick={() => setDeleteConfirm(true)}
            className="w-full text-xs py-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors font-medium"
          >
            🗑 Delete Listing
          </button>
        </div>
      )}
    </div>
  );
}

function PromoteModal({
  gem,
  sellerId,
  onClose,
  onSuccess,
}: {
  gem: Gemstone;
  sellerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  return (
    <PaymentModal
      userId={sellerId}
      paymentType="boost"
      meta={{ boost_type: "single", gemstone_id: gem.id }}
      amount={10}
      description={`Feature: ${gem.stone_type} ${gem.carat}ct · 7 days`}
      onSuccess={() => { onSuccess(); onClose(); }}
      onClose={onClose}
    />
  );
}

function ConfirmSaleModal({
  gem,
  sellerId,
  onClose,
  onSuccess,
}: {
  gem: Gemstone;
  sellerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [buyerEmail, setBuyerEmail] = useState("");
  const [salePriceUsd, setSalePriceUsd] = useState(String(gem.base_price_usd || ""));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      api.recordSale({
        gem_id: gem.id,
        seller_id: sellerId,
        buyer_email: buyerEmail.trim(),
        sale_price_usd: parseFloat(salePriceUsd),
        note: note.trim() || undefined,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: Error) => setErr(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!buyerEmail.trim()) { setErr("Buyer email is required"); return; }
    const price = parseFloat(salePriceUsd);
    if (!price || price <= 0) { setErr("Enter a valid sale price in USD"); return; }
    mut.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-1">Confirm Sale</h3>
        <p className="text-sm text-muted-foreground mb-4">Record this sale to track your revenue. The buyer can be a platform member or an external contact.</p>

        <div className="bg-slate-50 border border-border rounded-xl p-3 mb-4 text-sm">
          <span className="font-medium">{gem.stone_type}</span>
          <span className="text-muted-foreground"> · {gem.carat} ct · {gem.origin}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Buyer Email <span className="text-destructive">*</span></label>
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="buyer@example.com"
              required
              className="form-input"
            />
            <p className="text-xs text-muted-foreground mt-1">Can be a platform member or any external email address</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Final Sale Price (USD) <span className="text-destructive">*</span></label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={salePriceUsd}
              onChange={(e) => setSalePriceUsd(e.target.value)}
              placeholder="e.g. 15000"
              required
              className="form-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid via bank transfer, delivered to Bangkok"
              className="form-input"
            />
          </div>
          {err && <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="flex-1 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
            >
              {mut.isPending && <span className="spinner !w-4 !h-4 !border-white !border-t-transparent" />}
              ✅ Confirm Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditListingModal({
  gem,
  sellerId,
  onClose,
  onSuccess,
}: {
  gem: Gemstone;
  sellerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [f, setF] = useState({
    stone_type: gem.stone_type,
    carat: String(gem.carat),
    origin: gem.origin,
    treatment: gem.treatment,
    color: gem.color ?? "",
    clarity: gem.clarity ?? "",
    price: String(gem.price),
    currency: gem.currency as Currency,
    certificate_number: gem.certificate_number,
    num_pieces: gem.num_pieces != null ? String(gem.num_pieces) : "",
  });
  const [err, setErr] = useState("");
  const isDiamond = f.stone_type.toLowerCase() === "diamond";

  const mut = useMutation({
    mutationFn: () => api.updateInventory(gem.id, {
      seller_id: sellerId,
      stone_type: f.stone_type,
      carat: parseFloat(f.carat),
      origin: f.origin,
      treatment: f.treatment,
      ...(isDiamond ? { color: f.color, clarity: f.clarity } : {}),
      price: parseFloat(f.price),
      currency: f.currency,
      certificate_number: f.certificate_number,
      num_pieces: f.num_pieces && parseInt(f.num_pieces) > 0 ? parseInt(f.num_pieces) : null,
    }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: Error) => setErr(e.message),
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">Edit Listing</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Stone Type</label>
            <SearchableSelect
              options={STONE_TYPES}
              value={f.stone_type}
              onChange={(v) => setF((p) => ({ ...p, stone_type: v }))}
              placeholder="Search stone type…"
              aliasMap={STONE_ALIAS_MAP}
              allowCustom
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Carat</label>
              <input value={f.carat} onChange={set("carat")} type="number" step="0.01" className="form-input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Treatment</label>
              <select value={f.treatment} onChange={set("treatment")} className="form-select">
                {TREATMENTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Origin</label>
            <input value={f.origin} onChange={set("origin")} className="form-input" placeholder="e.g. Myanmar, Colombia, Kashmir" />
          </div>
          {isDiamond && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Color</label>
                <select value={f.color} onChange={set("color")} className="form-select">
                  {GIA_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Clarity</label>
                <select value={f.clarity} onChange={set("clarity")} className="form-select">
                  {GIA_CLARITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Price</label>
              <input value={f.price} onChange={set("price")} type="number" step="0.01" className="form-input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Currency</label>
              <select value={f.currency} onChange={set("currency")} className="form-select">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">No. of Pieces</label>
              <input value={f.num_pieces} onChange={set("num_pieces")} type="number" min="1" step="1" placeholder="e.g. 5" className="form-input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Certificate Number</label>
            <input value={f.certificate_number} onChange={set("certificate_number")} className="form-input" />
          </div>
        </div>

        {err && <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2 mt-3">{err}</div>}

        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { setErr(""); mut.mutate(); }}
            disabled={mut.isPending}
            className="flex-1 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
          >
            {mut.isPending && <span className="spinner !w-4 !h-4 !border-white !border-t-transparent" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

const IMAGE_LABELS = ["front", "side", "certificate", "inclusion", "other"] as const;
const ACCEPTED_FILES = "image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/avi,video/x-msvideo";

type ImageEntry = { image_url: string; width: string; height: string; label: string; media_type: string };

type FormState = {
  stone_type: string; carat: string; origin: string; treatment: string;
  color: string; clarity: string; price: string; currency: Currency;
  num_pieces: string; certificate_number: string; images: ImageEntry[];
};

const defaultForm: FormState = {
  stone_type: "Ruby", carat: "", origin: "", treatment: "None",
  color: "G", clarity: "VS1", price: "", currency: "USD",
  num_pieces: "", certificate_number: "", images: [{ image_url: "", width: "800", height: "600", label: "front", media_type: "image" }],
};

function ImageUploadRow({
  img, onUpdate, onRemove, canRemove,
}: {
  img: ImageEntry;
  onUpdate: (field: keyof ImageEntry, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res: { objectPath: string }) => {
      onUpdate("image_url", `/api/storage${res.objectPath}`);
    },
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    onUpdate("media_type", isVideo ? "video" : "image");
    if (!isVideo) {
      const objUrl = URL.createObjectURL(file);
      const probe = new Image();
      probe.onload = () => {
        onUpdate("width", String(probe.naturalWidth));
        onUpdate("height", String(probe.naturalHeight));
        URL.revokeObjectURL(objUrl);
      };
      probe.src = objUrl;
    }
    await uploadFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  const hasMedia = img.image_url.startsWith("http") || img.image_url.startsWith("/api/storage");

  return (
    <div className="flex items-start gap-2 bg-slate-50 border border-border rounded-xl p-2.5">
      <div className="w-12 h-12 rounded-lg overflow-hidden border border-border shrink-0 bg-slate-100 flex items-center justify-center text-muted-foreground">
        {isUploading ? (
          <div className="text-[10px] font-semibold text-primary text-center leading-tight px-1">
            {progress}%<br /><span className="spinner !w-3 !h-3 mt-0.5 inline-block" />
          </div>
        ) : hasMedia && img.media_type === "video" ? (
          <video src={img.image_url} className="w-full h-full object-cover" muted />
        ) : hasMedia ? (
          <img src={img.image_url} alt="" className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span className="text-xl opacity-40">🖼</span>
        )}
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex gap-1">
          <input
            value={img.image_url}
            onChange={(e) => onUpdate("image_url", e.target.value)}
            placeholder="Paste URL or upload a file →"
            className="form-input text-xs flex-1 min-w-0"
          />
          <button
            type="button" onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 border border-border rounded-lg font-medium disabled:opacity-60 shrink-0 transition-colors"
          >
            {isUploading ? `${progress}%` : "📁 Upload"}
          </button>
          <input ref={fileRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={handleFile} />
        </div>
        <div className="flex gap-1.5">
          <input type="number" min="1" value={img.width}
            onChange={(e) => onUpdate("width", e.target.value)}
            placeholder="Width px" className="form-input text-xs w-1/3" />
          <input type="number" min="1" value={img.height}
            onChange={(e) => onUpdate("height", e.target.value)}
            placeholder="Height px" className="form-input text-xs w-1/3" />
          <select value={img.label} onChange={(e) => onUpdate("label", e.target.value)}
            className="form-select text-xs w-1/3">
            {IMAGE_LABELS.map((l) => (
              <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      {canRemove && (
        <button type="button" onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0.5 mt-0.5">
          ✕
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

function SupportSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const { data: tickets = [], isLoading } = useQuery<SupportTicketWithResponses[]>({
    queryKey: ["support-tickets", userId],
    queryFn: () => api.getMyTickets(userId),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createSupportTicket({ user_id: userId, subject: subject.trim(), message: message.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets", userId] });
      setSubject(""); setMessage(""); setShowForm(false);
      setSuccess("Ticket submitted. We'll reply by email.");
      setTimeout(() => setSuccess(""), 4000);
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="mt-10 border-t border-border pt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Support</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Get help from the LuckyBirthstone team</p>
        </div>
        <button
          onClick={() => { setShowForm((s) => !s); setErr(""); }}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          {showForm ? "✕ Cancel" : "+ New Ticket"}
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-sm text-green-800">✅ {success}</div>
      )}

      {showForm && (
        <div className="bg-white border border-border rounded-2xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold mb-4">New Support Ticket</h3>
          <form onSubmit={(e) => { e.preventDefault(); setErr(""); createMutation.mutate(); }} className="space-y-4">
            <Field label="Subject">
              <input required value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Briefly describe your issue" className="form-input" />
            </Field>
            <Field label="Message">
              <textarea required value={message} onChange={(e) => setMessage(e.target.value)}
                rows={4} placeholder="Provide details about your issue…"
                className="form-input w-full resize-none" />
            </Field>
            {err && <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">{err}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors">Cancel</button>
              <button type="submit" disabled={createMutation.isPending}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center gap-2 transition-opacity">
                {createMutation.isPending && <span className="spinner !w-4 !h-4" />}
                Submit Ticket
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3 py-8 text-muted-foreground text-sm"><span className="spinner" /> Loading tickets…</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
          <div className="text-3xl mb-2">🎧</div>
          <p className="font-medium">No support tickets</p>
          <p className="text-sm mt-1">Click "New Ticket" if you need help.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-medium text-sm">{t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">#{t.id.slice(0, 8).toUpperCase()} · {new Date(t.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded border font-medium shrink-0 ${STATUS_COLORS[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground border-t border-border pt-2 mt-2">{t.message}</p>
              {t.responses.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Replies</p>
                  {t.responses.map((r) => (
                    <div key={r.id} className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2.5">
                      <p className="text-xs text-primary font-semibold mb-1">LuckyBirthstone Support · {new Date(r.timestamp).toLocaleDateString()}</p>
                      <p className="text-sm">{r.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StartAuctionModal({
  gem,
  sellerId,
  onClose,
  onSuccess,
}: {
  gem: Gemstone;
  sellerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [startingPrice, setStartingPrice] = useState(String(Math.round(gem.base_price_usd * 0.8)));
  const [reservePrice, setReservePrice] = useState("");
  const [minIncrement, setMinIncrement] = useState("50");
  const [durationHours, setDurationHours] = useState("24");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const sp = parseFloat(startingPrice);
    const rp = reservePrice ? parseFloat(reservePrice) : undefined;
    if (!sp || sp <= 0) { setError("Starting price must be a positive number."); return; }
    if (rp && rp < sp) { setError("Reserve price must be >= starting price."); return; }
    setLoading(true);
    try {
      await api.createAuction({
        seller_id: sellerId,
        inventory_id: gem.id,
        starting_price: sp,
        reserve_price: rp,
        min_increment: parseFloat(minIncrement) || 50,
        duration_hours: parseInt(durationHours) || 24,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create auction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold">🏆 Start Gem Auction</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{gem.stone_type} · {gem.carat}ct · {gem.origin}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-800">
          <strong>Note:</strong> This listing will be locked during the auction. Only verified users can bid.
          Standard auctions are free for Pro/Premium plans.
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Starting Price (USD) *</label>
            <input
              type="number"
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
              min="1"
              step="1"
              required
              className="w-full px-3 py-2 rounded-xl border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30"
              placeholder="e.g. 500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reserve Price (USD) <span className="text-muted-foreground font-normal">— optional</span></label>
            <input
              type="number"
              value={reservePrice}
              onChange={(e) => setReservePrice(e.target.value)}
              min="1"
              step="1"
              className="w-full px-3 py-2 rounded-xl border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30"
              placeholder="Minimum to sell (hidden from bidders)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Min. Increment (USD)</label>
              <input
                type="number"
                value={minIncrement}
                onChange={(e) => setMinIncrement(e.target.value)}
                min="1"
                step="1"
                className="w-full px-3 py-2 rounded-xl border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duration</label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-white outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="6">6 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-60 flex items-center gap-2 transition-colors"
            >
              {loading && <span className="spinner !w-4 !h-4" />}
              🏆 Start Auction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEND ON APPROVAL MODAL
// ═══════════════════════════════════════════════════════════════

function SendApprovalModal({ gem, userId, onClose, onSuccess }: { gem: Gemstone; userId: string; onClose: () => void; onSuccess: () => void }) {
  const qc = useQueryClient();
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<TradeContact[]>({
    queryKey: ["trm-contacts", userId],
    queryFn: () => api.trm.getContacts(userId),
  });

  const [contactId, setContactId] = useState("");
  const [handedOverDate, setHandedOverDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [returnedDate, setReturnedDate] = useState("");
  const [message, setMessage] = useState(`Hi! I'd like to send you this ${gem.stone_type} (${gem.carat}ct, ${gem.origin}) on approval for your review.`);
  const [loading, setLoading] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [error, setError] = useState("");

  const selectedContact = contacts.find((c) => c.id === contactId);

  async function handleSubmit() {
    if (!contactId) { setError("Please select a contact."); return; }
    if (!handedOverDate) { setError("Please enter the hand-over date."); return; }
    setLoading(true);
    setError("");
    try {
      // 1. Enable approval on the listing (pass seller_id to pass ownership check)
      await api.updateInventory(gem.id, { approval_enabled: true, seller_id: userId });
      // 2. Build structured notes with dates
      const noteParts = [`[HANDED_OVER:${handedOverDate}]`];
      if (returnedDate) noteParts.push(`[RETURNED:${returnedDate}]`);
      if (message.trim()) noteParts.push(message.trim());
      // 3. Create a CRM deal in "Approval" stage
      await api.trm.createDeal(userId, {
        title: `${gem.stone_type} ${gem.carat}ct — Approval (${selectedContact?.name})`,
        deal_value: gem.price ?? gem.base_price_usd ?? 0,
        currency: gem.currency || "USD",
        stage: "stone_picked_up",
        contact_id: contactId,
        listing_id: gem.id,
        notes: noteParts.join(" "),
      });
      // 3. Generate WhatsApp link if contact has phone
      if (selectedContact?.phone) {
        const cleanPhone = selectedContact.phone.replace(/\D/g, "");
        const listingUrl = `${window.location.origin}/listing/${gem.id}`;
        const waMsg = encodeURIComponent(`${message}\n\nView listing: ${listingUrl}`);
        setWaLink(`https://wa.me/${cleanPhone}?text=${waMsg}`);
      }
      // 4. Refresh inventory
      qc.invalidateQueries({ queryKey: ["my-inventory", userId] });
      qc.invalidateQueries({ queryKey: ["trm-deals", userId] });
      onSuccess();
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
            <h2 className="text-lg font-bold text-slate-800">🤝 Send on Approval</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{gem.stone_type} · {gem.carat}ct · {gem.origin}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-slate-700 text-xl leading-none">✕</button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}

        {waLink ? (
          <div className="space-y-3 text-center">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-teal-800 mb-1">✅ Approval deal created in CRM!</p>
              <p className="text-xs text-teal-700">The listing is now marked for approval and a deal has been added to your pipeline.</p>
            </div>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-xl transition-colors">
              📱 Open WhatsApp to Notify Contact
            </a>
            <button onClick={onClose} className="w-full py-2 border border-border rounded-xl text-sm text-muted-foreground hover:bg-secondary transition">Close</button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Send to Contact *</label>
                {contactsLoading ? (
                  <div className="text-xs text-muted-foreground">Loading contacts…</div>
                ) : contacts.length === 0 ? (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">No contacts yet. Add contacts in Trade Manager → Contacts.</div>
                ) : (
                  <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">— Select contact —</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` · ${c.company_name}` : ""}{c.phone ? ` · ${c.phone}` : ""}</option>
                    ))}
                  </select>
                )}
              </div>
              {selectedContact && !selectedContact.phone && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">This contact has no phone number. WhatsApp link won't be generated, but the CRM deal will still be created.</p>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Date Handed Over *</label>
                <input type="date" value={handedOverDate} onChange={(e) => setHandedOverDate(e.target.value)} required className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Date Returned <span className="font-normal text-muted-foreground">(leave blank if not yet returned)</span></label>
                <input type="date" value={returnedDate} onChange={(e) => setReturnedDate(e.target.value)} min={handedOverDate || undefined} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Message to Contact</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={handleSubmit} disabled={loading || !contactId} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {loading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loading ? "Sending…" : "🤝 Send on Approval"}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-secondary transition">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const userId = localStorage.getItem("gw_user_id");
  const emailVerified = localStorage.getItem("gw_email_verified") === "true";
  if (!userId) { navigate("/"); return null; }
  if (!emailVerified) { navigate("/verify-email"); return null; }

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [promoteGem, setPromoteGem] = useState<Gemstone | null>(null);
  const [confirmSaleGem, setConfirmSaleGem] = useState<Gemstone | null>(null);
  const [editGem, setEditGem] = useState<Gemstone | null>(null);
  const [deleteErr, setDeleteErr] = useState("");
  const [showCreditPacks, setShowCreditPacks] = useState(false);
  const [selectedCreditPack, setSelectedCreditPack] = useState<(typeof CREDIT_PACKS)[number] | null>(null);
  const [startAuctionGem, setStartAuctionGem] = useState<Gemstone | null>(null);
  const [sendApprovalGem, setSendApprovalGem] = useState<Gemstone | null>(null);
  const [showReferrals, setShowReferrals] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  const { data: profile } = useQuery<PublicProfile>({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile(userId),
    retry: false,
    throwOnError: (err: Error) => {
      if (err.message.toLowerCase().includes("not found") || err.message.toLowerCase().includes("session")) {
        handleSessionExpired();
      }
      return false;
    },
  });

  const { data: allGems = [], isLoading, refetch: refetchMyGems } = useQuery({
    queryKey: ["my-inventory", userId],
    queryFn: () => api.getMyInventory(userId!),
    refetchInterval: 5000,
  });

  const { data: salesData, refetch: refetchSales } = useQuery({
    queryKey: ["seller-sales", userId],
    queryFn: () => api.getSellerSales(userId!),
    enabled: !!userId,
  });

  const { data: inquiryData } = useQuery({
    queryKey: ["inquiry-count", userId],
    queryFn: () => api.getInquiryCount(userId!),
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const { data: referralData } = useQuery({
    queryKey: ["my-referrals", userId],
    queryFn: () => api.getMyReferrals(userId!),
    enabled: !!userId && showReferrals,
    refetchInterval: showReferrals ? 30000 : false,
  });

  const myGems = allGems;
  const soldGemIds = new Set((salesData?.sales ?? []).map((s: Sale) => s.gem_id));
  const isDiamond = form.stone_type.toLowerCase() === "diamond";

  function addImage() {
    setForm((f) => ({
      ...f,
      images: [...f.images, { image_url: "", width: "800", height: "600", label: "front", media_type: "image" }],
    }));
  }

  function removeImage(i: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));
  }

  function updateImage(i: number, field: keyof ImageEntry, value: string) {
    setForm((f) => {
      const images = [...f.images];
      images[i] = { ...images[i], [field]: value };
      return { ...f, images };
    });
  }

  function handleSessionExpired() {
    localStorage.removeItem("gw_user_id");
    localStorage.removeItem("gw_email_verified");
    localStorage.removeItem("gw_verify_email");
    navigate("/");
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      const validImages: GemImage[] = form.images
        .filter((img) => {
          const url = img.image_url.trim();
          return url.startsWith("http") || url.startsWith("/api/storage");
        })
        .map((img) => ({
          image_url: img.image_url.trim(),
          width: Math.max(1, parseInt(img.width) || 800),
          height: Math.max(1, parseInt(img.height) || 600),
          label: img.label || undefined,
          media_type: (img.media_type as "image" | "video") || "image",
        }));
      if (validImages.length === 0) throw new Error("At least 1 uploaded file or valid URL is required");
      const body: Record<string, unknown> = {
        seller_id: userId,
        stone_type: form.stone_type,
        carat: parseFloat(form.carat),
        origin: form.origin,
        treatment: form.treatment,
        price: parseFloat(form.price),
        currency: form.currency,
        certificate_number: form.certificate_number,
        images: validImages,
      };
      if (isDiamond) { body.color = form.color; body.clarity = form.clarity; }
      if (form.num_pieces && parseInt(form.num_pieces) > 0) body.num_pieces = parseInt(form.num_pieces);
      return api.addInventory(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-inventory", userId] });
      setForm(defaultForm);
      setShowForm(false);
      setFormSuccess("Listing submitted! It will go live in about 30 seconds and you'll receive a confirmation email.");
      setTimeout(() => setFormSuccess(""), 6000);
    },
    onError: (err: Error) => {
      if (err.message.toLowerCase().includes("session expired") || err.message.toLowerCase().includes("not found")) {
        handleSessionExpired();
        return;
      }
      setFormError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (gem: Gemstone) => api.deleteInventory(gem.id, userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-inventory", userId] });
      setFormSuccess("Listing deleted successfully.");
      setTimeout(() => setFormSuccess(""), 4000);
      setDeleteErr("");
    },
    onError: (err: Error) => setDeleteErr(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    addMutation.mutate();
  }

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const trialBanner = (() => {
    if (!profile?.trial_ends_at || profile.subscription_payment_status === "paid") return null;
    const end = new Date(profile.trial_ends_at);
    const now = new Date();
    if (end <= now) return null;
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const pct = Math.round((daysLeft / 30) * 100);
    const isUrgent = daysLeft <= 3;
    return { daysLeft, pct, isUrgent, formatted: end.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) };
  })();

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Premium Trial Banner */}
      {trialBanner && (
        <div className={`mb-5 rounded-2xl border px-5 py-4 ${trialBanner.isUrgent ? "bg-amber-50 border-amber-300" : "bg-violet-50 border-violet-200"}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">💎</span>
                <span className={`font-semibold text-sm ${trialBanner.isUrgent ? "text-amber-800" : "text-violet-800"}`}>
                  {trialBanner.isUrgent
                    ? `⏳ Only ${trialBanner.daysLeft} day${trialBanner.daysLeft !== 1 ? "s" : ""} left on your Premium trial!`
                    : `Premium Trial Active — ${trialBanner.daysLeft} days remaining`}
                </span>
              </div>
              <p className={`text-xs mb-2 ${trialBanner.isUrgent ? "text-amber-700" : "text-violet-700"}`}>
                Full Premium access until <strong>{trialBanner.formatted}</strong>. Upgrade to keep unlimited listings, Trade Manager &amp; more.
              </p>
              <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${trialBanner.isUrgent ? "bg-amber-500" : "bg-violet-500"}`}
                  style={{ width: `${trialBanner.pct}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => navigate("/upgrade-plan")}
              className={`shrink-0 text-sm font-semibold px-5 py-2 rounded-xl transition-colors ${trialBanner.isUrgent ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"}`}
            >
              Upgrade →
            </button>
          </div>
        </div>
      )}
      {/* Profile header */}
      {profile && (
        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
                {profile.name[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2 flex-wrap">
                  {profile.company_name ?? profile.name}
                  {profile.is_founding_seller && (
                    <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-medium">
                      🏅 Founding Member
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                  <span>{profile.user_type_label}</span>
                  <span>·</span>
                  <span className="font-medium text-foreground">{BADGE_LABELS[profile.verification_badge] ?? profile.verification_badge}</span>
                  <span>·</span>
                  <span className="font-medium text-foreground">{PLAN_LABELS[profile.subscription_plan] ?? profile.subscription_plan}</span>
                  {profile.subscription_plan !== "premium" && (
                    <button
                      onClick={() => navigate("/upgrade-plan")}
                      className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full font-semibold hover:bg-primary/20 transition-colors"
                    >
                      Upgrade ↑
                    </button>
                  )}
                  {profile.free_boosts > 0 && (
                    <><span>·</span><span className="text-amber-600">⚡ {profile.free_boosts} boosts</span></>
                  )}
                </div>
                {/* Social links */}
                <div className="flex flex-wrap gap-2 mt-2">
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noreferrer" className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-primary transition-colors">
                        🌐 Website
                      </a>
                    )}
                    {profile.instagram_url && (
                      <a
                        href={profile.instagram_url.startsWith("http") ? profile.instagram_url : `https://instagram.com/${profile.instagram_url.replace(/^@/, "")}`}
                        target="_blank" rel="noreferrer"
                        className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-pink-600 transition-colors"
                      >
                        📸 Instagram
                      </a>
                    )}
                    {profile.facebook_page_url && (
                      <a
                        href={profile.facebook_page_url.startsWith("http") ? profile.facebook_page_url : `https://facebook.com/${profile.facebook_page_url}`}
                        target="_blank" rel="noreferrer"
                        className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-blue-600 transition-colors"
                      >
                        👍 Facebook
                      </a>
                    )}
                    {profile.store_slug ? (
                      <Link href={`/store/${profile.store_slug}`}>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer font-medium">
                          🏪 My Store →
                        </span>
                      </Link>
                    ) : (
                      <Link href="/profile">
                        <span className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer">+ Set up your store URL in Profile →</span>
                      </Link>
                    )}
                  </div>
                {profile.store_slug && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                    <span>🔗</span>
                    <span className="truncate max-w-xs">luckybirthstone.com/store/<strong className="text-foreground">{profile.store_slug}</strong></span>
                  </div>
                )}
                {profile.company_description && (
                  <p className="text-xs text-muted-foreground mt-2 max-w-md leading-relaxed">{profile.company_description}</p>
                )}
              </div>
            </div>
          <div className="flex items-center gap-4 text-sm shrink-0">
            <div className="text-center">
              <div className="font-bold text-xl">{myGems.length}</div>
              <div className="text-muted-foreground text-xs">Listings</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-xl text-amber-600">{myGems.filter((g) => g.is_featured).length}</div>
              <div className="text-muted-foreground text-xs">Featured</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-xl text-blue-600">{inquiryData?.total_inquiries ?? 0}</div>
              <div className="text-muted-foreground text-xs">Inquiries</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-xl text-emerald-600">{salesData?.total_sales ?? 0}</div>
              <div className="text-muted-foreground text-xs">Sales</div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ── Profile Completion Banner ── */}
      {profile && (() => {
        const completion = computeProfileCompletion(profile);
        if (completion.percentage >= 100) return null;
        const missing = completion.fields.filter((f) => !f.done);
        return (
          <div className="bg-white border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Complete Your Profile</p>
                <p className="text-xs text-muted-foreground mt-0.5">Verified traders get more buyer trust and higher response rates</p>
              </div>
              <Link href="/profile">
                <span className="shrink-0 text-xs font-semibold text-primary hover:underline cursor-pointer">Complete Profile →</span>
              </Link>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    completion.percentage >= 80 ? "bg-emerald-500" :
                    completion.percentage >= 50 ? "bg-amber-500" : "bg-red-400"
                  }`}
                  style={{ width: `${completion.percentage}%` }}
                />
              </div>
              <span className={`text-xs font-bold tabular-nums ${
                completion.percentage >= 80 ? "text-emerald-600" :
                completion.percentage >= 50 ? "text-amber-600" : "text-red-500"
              }`}>{completion.percentage}%</span>
            </div>
            {/* Badge label */}
            <p className="text-[11px] text-muted-foreground mb-3">{completion.badge} · {missing.length} field{missing.length !== 1 ? "s" : ""} remaining</p>
            {/* Missing fields (first 4) */}
            <div className="flex flex-wrap gap-1.5">
              {missing.slice(0, 4).map((f) => (
                <Link key={f.key} href="/profile">
                  <span className="text-[11px] px-2 py-1 bg-slate-50 border border-border rounded-lg text-slate-600 hover:border-primary hover:text-primary transition-colors cursor-pointer">
                    + {f.label}
                  </span>
                </Link>
              ))}
              {missing.length > 4 && (
                <Link href="/profile">
                  <span className="text-[11px] px-2 py-1 bg-slate-50 border border-border rounded-lg text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                    +{missing.length - 4} more
                  </span>
                </Link>
              )}
            </div>
          </div>
        );
      })()}

      {/* Analytics section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{myGems.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Active Listings</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{myGems.filter((g) => g.is_featured).length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Featured</div>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{inquiryData?.total_inquiries ?? 0}</div>
          {inquiryData && inquiryData.unread > 0 && (
            <div className="text-[10px] text-blue-500 font-medium">{inquiryData.unread} unread</div>
          )}
          <div className="text-xs text-muted-foreground mt-0.5">Inquiries Received</div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{salesData?.total_sales ?? 0}</div>
          {salesData && salesData.total_revenue_usd > 0 && (
            <div className="text-[10px] text-emerald-600 font-medium">${salesData.total_revenue_usd.toLocaleString()} confirmed</div>
          )}
          <div className="text-xs text-muted-foreground mt-0.5">Sales Confirmed</div>
        </div>
      </div>

      {/* Listing Credits Tracker */}
      {profile && (() => {
        const planLimit = PLAN_LIMITS[profile.subscription_plan];
        const extra = profile.extra_listing_credits ?? 0;
        const effectiveLimit = planLimit !== null ? planLimit + extra : null;
        const used = myGems.length;
        const pct = effectiveLimit !== null ? Math.min(100, (used / effectiveLimit) * 100) : 0;
        const isUnlimited = effectiveLimit === null;
        const nearLimit = !isUnlimited && effectiveLimit !== null && used >= effectiveLimit * 0.8;
        return (
          <div className={`bg-white border rounded-2xl p-4 mb-6 ${nearLimit ? "border-amber-300" : "border-border"}`}>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div>
                <span className="font-semibold text-sm">📦 Listing Credits</span>
                {extra > 0 && (
                  <span className="ml-2 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                    +{extra} add-on credits
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {isUnlimited ? `${used} used · Unlimited` : `${used} / ${effectiveLimit} used`}
                </span>
                <button
                  onClick={() => setShowCreditPacks(true)}
                  className="text-xs px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-semibold hover:bg-primary/20 transition-colors"
                >
                  + Buy Credits
                </button>
              </div>
            </div>
            {!isUnlimited && effectiveLimit !== null && (
              <div className="space-y-1">
                <div className="h-2.5 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Plan: {profile.subscription_plan} ({planLimit} slots){extra > 0 ? ` + ${extra} add-on` : ""}</span>
                  {pct >= 80 && <span className={`font-semibold ${pct >= 100 ? "text-red-600" : "text-amber-600"}`}>{pct >= 100 ? "Limit reached!" : "Almost full"}</span>}
                  <span>{effectiveLimit - used} remaining</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* My Referrals */}
      {profile && (
        <div className="bg-white border border-border rounded-2xl mb-6 overflow-hidden">
          <button
            onClick={() => setShowReferrals(!showReferrals)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🎁</span>
              <div className="text-left">
                <span className="font-semibold text-sm">My Referrals</span>
                <p className="text-xs text-muted-foreground mt-0.5">Earn +5 credits per verified referral · Share your code</p>
              </div>
            </div>
            <span className="text-muted-foreground text-sm">{showReferrals ? "▲" : "▼"}</span>
          </button>
          {showReferrals && (
            <div className="px-5 pb-5 border-t border-border">
              {!referralData ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading referral data…</p>
              ) : (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mt-4 mb-5">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{referralData.total_referrals}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600">{referralData.pending_referrals}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{referralData.successful_referrals}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Rewarded</p>
                    </div>
                  </div>

                  {/* Referral link */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Your Referral Code</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 font-mono text-sm font-bold text-primary tracking-wider">
                        {referralData.referral_code || "—"}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(referralData.referral_link || referralData.referral_code);
                          setReferralCopied(true);
                          setTimeout(() => setReferralCopied(false), 2000);
                        }}
                        className="px-3 py-2.5 text-xs bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
                      >
                        {referralCopied ? "✓ Copied!" : "Copy Link"}
                      </button>
                    </div>
                    {referralData.referral_link && (
                      <div className="mt-2 flex gap-2">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`💎 Sell globally & manage your entire gem business\n\nI'm using LuckyBirthstone to trade globally, manage stones on approval, and manage payments, sales, and co-sell partners in one system.\n\nLet's connect, join me: ${referralData.referral_link}`)}`}
                          target="_blank" rel="noreferrer"
                          className="flex-1 text-center text-xs py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
                        >
                          📱 Share on WhatsApp
                        </a>
                        <a
                          href={`mailto:?subject=💎 Sell globally & manage your entire gem business&body=${encodeURIComponent(`Hi,\n\nI'm using LuckyBirthstone to trade globally, manage stones on approval, and manage payments, sales, and co-sell partners in one system.\n\nLet's connect — join me here: ${referralData.referral_link}\n\nLuckyBirthstone · B2B Gemstone Marketplace`)}`}
                          className="flex-1 text-center text-xs py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                        >
                          ✉️ Share via Email
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Reward summary */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-sm">
                    <p className="font-semibold text-emerald-800">Credits earned from referrals: <span className="text-emerald-600">{referralData.total_credits_earned}</span></p>
                    <p className="text-xs text-emerald-700 mt-0.5">Rewards unlock when your referral is email-verified AND gets a business verification badge</p>
                  </div>

                  {/* Referral list */}
                  {referralData.referrals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">No referrals yet — share your code to start earning!</p>
                  ) : (
                    <div className="space-y-2">
                      {referralData.referrals.map((r) => (
                        <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="text-sm font-medium">{r.referred_name}</p>
                            <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            r.status === "successful" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {r.status === "successful" ? "✓ +5 credits" : "Pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sales history */}
      {salesData && salesData.sales.length > 0 && (
        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">✅ Confirmed Sales <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{salesData.total_sales}</span></h2>
          <div className="space-y-2">
            {salesData.sales.slice(0, 5).map((s: Sale) => {
              const matchedGem = myGems.find((g) => g.id === s.gem_id);
              return (
                <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <div>
                    <span className="font-medium">{matchedGem ? `${matchedGem.stone_type} ${matchedGem.carat}ct` : "Gem"}</span>
                    <span className="text-muted-foreground ml-2 text-xs">→ {s.buyer_email}</span>
                    {s.note && <div className="text-xs text-muted-foreground mt-0.5">{s.note}</div>}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="font-semibold text-emerald-700">${s.sale_price_usd.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.confirmed_at).toLocaleDateString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Onboarding banners — sequential, show first applicable step */}
      {profile && !profile.email_verified && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl shrink-0">📧</div>
            <div>
              <div className="font-semibold text-blue-900">Verify your email</div>
              <div className="text-sm text-blue-700 mt-0.5">Unlock messaging, transactions, and listing creation.</div>
            </div>
          </div>
          <button onClick={() => navigate("/verify-email")}
            className="shrink-0 px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
            Verify Email →
          </button>
        </div>
      )}

      {profile && profile.email_verified && profile.verification_status === "unverified" && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl shrink-0">🛡️</div>
            <div>
              <div className="font-semibold text-amber-900">Get verified to list your gems</div>
              <div className="text-sm text-amber-700 mt-0.5">Verified sellers build trust with buyers and get priority placement. Early access verification is <strong>free</strong> for the first 50 members.</div>
            </div>
          </div>
          <button onClick={() => navigate("/profile")}
            className="shrink-0 px-5 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap">
            Complete Verification →
          </button>
        </div>
      )}

      {profile && profile.email_verified && profile.verification_status !== "unverified" && myGems.length === 0 && !isLoading && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl shrink-0">💎</div>
            <div>
              <div className="font-semibold text-emerald-900">Create your first listing</div>
              <div className="text-sm text-emerald-700 mt-0.5">You're all set! Post your gems to reach B2B buyers globally — no commission on sales, ever.</div>
            </div>
          </div>
          <button onClick={() => setShowForm(true)}
            className="shrink-0 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap">
            + Create First Listing
          </button>
        </div>
      )}

      {profile && profile.email_verified && profile.verification_status !== "unverified" && myGems.length > 0 && profile.subscription_plan === "basic" && (
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-xl shrink-0">🚀</div>
            <div>
              <div className="font-semibold text-violet-900">Upgrade to reach more buyers</div>
              <div className="text-sm text-violet-700 mt-0.5">Unlock unlimited listings, priority placement, and featured boosts. Upgrade from your profile page.</div>
            </div>
          </div>
          <button onClick={() => navigate("/plans")}
            className="shrink-0 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap">
            View Plans →
          </button>
        </div>
      )}

      {formSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-sm text-green-800">
          ✅ {formSuccess}
        </div>
      )}

      {/* Listings header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">My Listings</h2>
        <button
          onClick={() => {
            setShowForm((s) => {
              if (!s && profile?.default_currency) {
                setForm((f) => ({ ...f, currency: profile.default_currency as Currency }));
              }
              return !s;
            });
            setFormError("");
          }}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          {showForm ? "✕ Cancel" : "+ Add Listing"}
        </button>
      </div>

      {/* Add listing form */}
      {showForm && (
        <div className="bg-white border border-border rounded-2xl p-6 mb-6 shadow-sm">
          <h3 className="font-semibold mb-4">New Listing</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Stone">
                <SearchableSelect
                  value={form.stone_type}
                  onChange={(v) => setForm((f) => ({ ...f, stone_type: v }))}
                  options={STONE_TYPES}
                  placeholder="Search stone type or trade name…"
                  aliasMap={STONE_ALIAS_MAP}
                  allowCustom
                />
              </Field>
              <Field label="Carat Weight">
                <input required type="number" step="0.01" min="0" value={form.carat} onChange={set("carat")} placeholder="e.g. 1.25" className="form-input" />
              </Field>
              <Field label="Origin">
                <input required value={form.origin} onChange={set("origin")} placeholder="e.g. Burma" className="form-input" />
              </Field>
              <Field label="Treatment">
                <SearchableSelect
                  value={form.treatment}
                  onChange={(v) => setForm((f) => ({ ...f, treatment: v }))}
                  options={TREATMENTS}
                  placeholder="Search treatment…"
                />
              </Field>
              <Field label="Price">
                <input required type="number" min="0" value={form.price} onChange={set("price")} placeholder="e.g. 5000" className="form-input" />
              </Field>
              <Field label="Currency">
                <select value={form.currency} onChange={set("currency")} className="form-select">
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="No. of Pieces">
                <input type="number" min="1" step="1" value={form.num_pieces} onChange={set("num_pieces")} placeholder="e.g. 5 (for lots/parcels)" className="form-input" />
              </Field>
            </div>

            {isDiamond && (
              <div className="grid sm:grid-cols-2 gap-4 bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="sm:col-span-2 text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  💠 Diamond grading (required)
                </div>
                <Field label="GIA Colour Grade">
                  <select value={form.color} onChange={set("color")} className="form-select">
                    {GIA_COLORS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="GIA Clarity Grade">
                  <select value={form.clarity} onChange={set("clarity")} className="form-select">
                    {GIA_CLARITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
            )}

            <Field label="Certificate Number">
              <input required value={form.certificate_number} onChange={set("certificate_number")} placeholder="e.g. GIA1234567" className="form-input" />
            </Field>

            {/* Multi-image section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Images <span className="text-destructive">*</span>
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">
                    ({form.images.length}/10) · min 1 required
                  </span>
                </label>
                {form.images.length < 10 && (
                  <button type="button" onClick={addImage}
                    className="text-xs text-primary hover:underline font-medium">
                    + Add image
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {form.images.map((img, i) => (
                  <ImageUploadRow
                    key={i}
                    img={img}
                    onUpdate={(field, value) => updateImage(i, field, value)}
                    onRemove={() => removeImage(i)}
                    canRemove={form.images.length > 1}
                  />
                ))}
              </div>
            </div>

            {formError && (
              <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">{formError}</div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={addMutation.isPending}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center gap-2 transition-opacity">
                {addMutation.isPending && <span className="spinner !w-4 !h-4" />}
                Add Listing
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <span className="spinner" /> Loading…
        </div>
      ) : myGems.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/60">
          <div className="text-5xl mb-4">💎</div>
          <p className="font-semibold text-lg text-foreground mb-1">No listings yet</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">Post your first gem and reach B2B buyers across the globe — zero commission, ever.</p>
          <button
            onClick={() => { setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            + Create Your First Listing
          </button>
        </div>
      ) : (
        <>
          {deleteErr && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3">
              <span>⚠ {deleteErr}</span>
              <button onClick={() => setDeleteErr("")} className="text-red-500 hover:text-red-700 text-xs">✕</button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myGems.map((g) => (
              <ListingCard
                key={g.id}
                gem={g}
                onPromote={setPromoteGem}
                onConfirmSale={setConfirmSaleGem}
                onEdit={setEditGem}
                onDelete={(gem) => deleteMutation.mutate(gem)}
                onStartAuction={setStartAuctionGem}
                onSendApproval={setSendApprovalGem}
                onUpdateCurrency={(gem, currency) => {
                  api.updateInventory(gem.id, { currency, seller_id: userId }).then(() => {
                    refetchMyGems();
                  });
                }}
                soldGemIds={soldGemIds}
              />
            ))}
          </div>
        </>
      )}

      <SupportSection userId={userId} />

      {promoteGem && (
        <PromoteModal
          gem={promoteGem}
          sellerId={userId}
          onClose={() => setPromoteGem(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["my-inventory", userId] });
            setFormSuccess("Listing is now featured for 7 days!");
            setTimeout(() => setFormSuccess(""), 4000);
          }}
        />
      )}

      {confirmSaleGem && (
        <ConfirmSaleModal
          gem={confirmSaleGem}
          sellerId={userId}
          onClose={() => setConfirmSaleGem(null)}
          onSuccess={() => {
            refetchSales();
            setFormSuccess("Sale confirmed and recorded!");
            setTimeout(() => setFormSuccess(""), 4000);
          }}
        />
      )}

      {editGem && (
        <EditListingModal
          gem={editGem}
          sellerId={userId}
          onClose={() => setEditGem(null)}
          onSuccess={() => {
            refetchMyGems();
            setEditGem(null);
            setFormSuccess("Listing updated successfully!");
            setTimeout(() => setFormSuccess(""), 4000);
          }}
        />
      )}

      {startAuctionGem && (
        <StartAuctionModal
          gem={startAuctionGem}
          sellerId={userId}
          onClose={() => setStartAuctionGem(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["my-inventory", userId] });
            qc.invalidateQueries({ queryKey: ["auctions"] });
            setFormSuccess("Auction started! Bidders can now bid on your gem.");
            setTimeout(() => setFormSuccess(""), 6000);
          }}
        />
      )}

      {sendApprovalGem && (
        <SendApprovalModal
          gem={sendApprovalGem}
          userId={userId}
          onClose={() => setSendApprovalGem(null)}
          onSuccess={() => {
            setFormSuccess("Sent on approval! Deal created in CRM.");
            setTimeout(() => setFormSuccess(""), 5000);
          }}
        />
      )}

      {/* Credit Pack Selection Modal */}
      {showCreditPacks && !selectedCreditPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Buy Listing Credits</h2>
              <button onClick={() => setShowCreditPacks(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Credits are permanent and stack on top of your plan's quota — they never expire.</p>
            <div className="space-y-3">
              {CREDIT_PACKS.map((pack) => (
                <button
                  key={pack.key}
                  onClick={() => setSelectedCreditPack(pack)}
                  className="w-full flex items-center justify-between p-4 border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left group"
                >
                  <div>
                    <div className="font-semibold text-base">{pack.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">+{pack.credits} extra listing slots · permanent</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">${pack.price}</div>
                    <div className="text-[11px] text-muted-foreground">${(pack.price / pack.credits).toFixed(2)}/credit</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment for credit pack */}
      {selectedCreditPack && (
        <PaymentModal
          userId={userId}
          paymentType="listing_credits"
          meta={{ pack: selectedCreditPack.key }}
          amount={selectedCreditPack.price}
          description={`${selectedCreditPack.label} — ${selectedCreditPack.credits} permanent listing slots`}
          onSuccess={() => {
            setSelectedCreditPack(null);
            setShowCreditPacks(false);
            qc.invalidateQueries({ queryKey: ["profile", userId] });
            setFormSuccess(`${selectedCreditPack.credits} listing credits added to your account!`);
            setTimeout(() => setFormSuccess(""), 5000);
          }}
          onClose={() => { setSelectedCreditPack(null); setShowCreditPacks(true); }}
        />
      )}
    </main>
  );
}
