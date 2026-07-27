import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useRef } from "react";
import { api, fmtCurrency, convertPrice, type Gemstone, type Currency, type ApprovalRequest } from "@/lib/api";

const CURRENCIES: Currency[] = ["USD", "INR", "AED", "THB"];

const LABEL_MAP: Record<string, string> = {
  front: "Front", side: "Side", back: "Back", inclusion: "Inclusion",
  certificate: "Certificate", macro: "Macro", uv: "UV", other: "Other",
};

const CONF_STYLES: Record<string, string> = {
  high:   "text-emerald-700 bg-emerald-50 border border-emerald-200",
  medium: "text-amber-700 bg-amber-50 border border-amber-200",
  low:    "text-slate-500 bg-slate-100 border border-slate-200",
};

function VideoThumbnail({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        muted
        preload="metadata"
        playsInline
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center shadow">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-slate-700 ml-0.5">
            <polygon points="2,1 9,5 2,9" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function ImageViewer({ gem }: { gem: Gemstone }) {
  const [idx, setIdx] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const images = gem.images;
  const active = images[idx] ?? images[0];

  function handleIdxChange(i: number) {
    setIdx(i);
    setVideoError(false);
  }

  if (!active) {
    return (
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center text-6xl">💎</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] bg-slate-50 rounded-2xl overflow-hidden border border-border">
        {active.media_type === "video" ? (
          videoError ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <span className="text-4xl">🎬</span>
              <p className="text-sm">Video unavailable</p>
              <a href={active.image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Open directly</a>
            </div>
          ) : (
            <video
              key={active.image_url}
              src={active.image_url}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
              onError={() => setVideoError(true)}
            />
          )
        ) : (
          <img src={active.image_url} alt={`${gem.stone_type} — ${LABEL_MAP[active.label ?? ""] ?? active.label ?? "image"}`} className="w-full h-full object-contain" />
        )}
        {active.label && (
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {LABEL_MAP[active.label] ?? active.label}
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
          {idx + 1}/{images.length}
        </div>
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => handleIdxChange(i)}
              className={`shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden transition-colors ${i === idx ? "border-primary" : "border-transparent hover:border-slate-300"}`}
            >
              {img.media_type === "video" ? (
                <VideoThumbnail src={img.image_url} />
              ) : (
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShareButton({ url, title, text }: { url: string; title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {}
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
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      {copied ? (
        <>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-emerald-600">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-emerald-600">Link copied!</span>
        </>
      ) : (
        <>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </>
      )}
    </button>
  );
}

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalSuccess, setApprovalSuccess] = useState(false);

  const userId = localStorage.getItem("gw_user_id");
  const emailVerified = localStorage.getItem("gw_email_verified") === "true";
  const qc = useQueryClient();

  const { data: gem, isLoading, error } = useQuery<Gemstone>({
    queryKey: ["listing", id],
    queryFn: () => api.getListing(id!),
    enabled: !!id,
  });

  const { data: myApprovals } = useQuery<ApprovalRequest[]>({
    queryKey: ["my-approvals", userId],
    queryFn: () => api.getMyApprovals(userId!),
    enabled: !!userId,
  });

  const existingApproval = myApprovals?.find((r) => r.listing_id === id);

  const requestMutation = useMutation({
    mutationFn: () => api.requestApproval({ listing_id: id!, requester_id: userId!, notes: approvalNotes || undefined }),
    onSuccess: () => {
      setApprovalSuccess(true);
      setApprovalError(null);
      setShowApprovalModal(false);
      void qc.invalidateQueries({ queryKey: ["my-approvals", userId] });
    },
    onError: (e: Error) => setApprovalError(e.message),
  });

  function handleContact() {
    if (!userId) { navigate("/"); return; }
    if (!emailVerified) { navigate("/verify-email"); return; }
    navigate(`/messages?with=${gem!.seller_id}&listing=${gem!.id}`);
  }

  const listingUrl = typeof window !== "undefined"
    ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/listing/${id}`
    : "";

  if (isLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center gap-2 text-muted-foreground">
        <span className="spinner" /> Loading listing…
      </main>
    );
  }

  if (error || !gem) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center text-muted-foreground">
        <div className="text-5xl mb-4">🔍</div>
        <p className="font-semibold text-foreground mb-1">Listing not found</p>
        <p className="text-sm mb-6">This listing may have been removed or the link is incorrect.</p>
        <button onClick={() => navigate("/marketplace")} className="px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90">
          Browse Marketplace
        </button>
      </main>
    );
  }

  const snap = gem.company_snapshot;
  const displayPrice = convertPrice(gem.base_price_usd, "USD", currency);
  const estMin = convertPrice(gem.estimated_price_min, "USD", currency);
  const estMax = convertPrice(gem.estimated_price_max, "USD", currency);
  const rapVal = gem.total_rap_value ? convertPrice(gem.total_rap_value, "USD", currency) : null;
  const isDiamond = gem.stone_type.toLowerCase() === "diamond";

  const shareTitle = `${gem.carat}ct ${gem.stone_type} from ${gem.origin} — LuckyBirthstone`;
  const shareText = `${gem.carat}ct ${gem.stone_type} (${gem.origin}, ${gem.treatment}) — ${fmtCurrency(displayPrice, currency)} on LuckyBirthstone Marketplace`;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Back breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate("/marketplace")} className="hover:text-foreground transition-colors">Marketplace</button>
        {snap && (
          <>
            <span>/</span>
            <Link href={`/company/${gem.seller_id}`}>
              <span className="hover:text-foreground transition-colors cursor-pointer">{snap.company_name || snap.name}</span>
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground font-medium">{gem.stone_type} {gem.carat}ct</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: image viewer */}
        <ImageViewer gem={gem} />

        {/* Right: details */}
        <div className="space-y-5">
          {/* Title + badges */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {gem.is_featured && (
                <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">⭐ Featured</span>
              )}
              {isDiamond && (
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">💎 Diamond</span>
              )}
            </div>
            <h1 className="text-2xl font-bold">
              {gem.stone_type}
              {isDiamond && gem.color && gem.clarity && (
                <span className="text-muted-foreground font-normal text-xl ml-2">{gem.color}/{gem.clarity}</span>
              )}
            </h1>
            <p className="text-muted-foreground mt-0.5">Cert: {gem.certificate_number}</p>
          </div>

          {/* Properties */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Carat Weight", value: `${gem.carat} ct` },
              { label: "Per Carat", value: fmtCurrency(convertPrice(gem.base_price_usd / gem.carat, "USD", currency), currency) },
              { label: "Origin", value: gem.origin },
              { label: "Treatment", value: gem.treatment },
              ...(gem.num_pieces ? [{ label: "Pieces", value: `${gem.num_pieces} pcs` }] : []),
              ...(gem.color ? [{ label: "Color", value: gem.color }] : []),
              ...(gem.clarity ? [{ label: "Clarity", value: gem.clarity }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="font-semibold text-sm mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          {/* Price + currency switcher */}
          <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-primary">{fmtCurrency(displayPrice, currency)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Est. range: {fmtCurrency(estMin, currency)} – {fmtCurrency(estMax, currency)}
                  {" "}
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CONF_STYLES[gem.pricing_confidence] ?? CONF_STYLES.low}`}>
                    {gem.pricing_confidence} confidence
                  </span>
                </div>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-border text-xs shrink-0">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-2.5 py-1.5 font-medium transition-colors ${currency === c ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* All currencies quick view */}
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-border/40">
              {CURRENCIES.map((c) => (
                <div key={c} className="text-center">
                  <div className="text-[10px] text-muted-foreground">{c}</div>
                  <div className="text-xs font-semibold tabular-nums">{fmtCurrency(convertPrice(gem.base_price_usd, "USD", c), c)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rapaport benchmark */}
          {isDiamond && rapVal != null && gem.rap_price_per_carat && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Rapaport Benchmark</div>
              <div className="flex justify-between text-blue-800">
                <span>Per carat</span>
                <span className="font-medium">{fmtCurrency(convertPrice(gem.rap_price_per_carat, "USD", currency), currency)}</span>
              </div>
              <div className="flex justify-between text-blue-800 mt-1">
                <span>Total rap value</span>
                <span className="font-medium">{fmtCurrency(rapVal, currency)}</span>
              </div>
            </div>
          )}

          {/* Seller card */}
          {snap && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-border">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Seller</span>
              </div>
              <div className="p-3 flex items-center gap-3">
                {snap.logo_url ? (
                  <img src={snap.logo_url} alt={snap.company_name || snap.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                    {(snap.company_name || snap.name)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/company/${gem.seller_id}`}>
                    <span className="font-semibold text-sm hover:text-primary transition-colors cursor-pointer">{snap.company_name || snap.name}</span>
                  </Link>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {snap.verification_badge !== "none" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${snap.verification_badge === "premium_verified" ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-green-100 text-green-700 border border-green-200"}`}>
                        {snap.verification_badge === "premium_verified" ? "★ Premium" : "✓ Basic"}
                      </span>
                    )}
                    {snap.city && <span className="text-[10px] text-muted-foreground">📍 {snap.city}</span>}
                    <span className={`text-[10px] font-medium ${snap.is_online ? "text-emerald-600" : "text-slate-400"}`}>
                      {snap.is_online ? "● Online" : "○ Offline"}
                    </span>
                  </div>
                </div>
              </div>
              {/* Social links */}
              {(snap.instagram_url || snap.facebook_page_url) && (
                <div className="flex flex-wrap gap-2 px-3 pb-2">
                  {snap.instagram_url && (
                    <a
                      href={snap.instagram_url.startsWith("http") ? snap.instagram_url : `https://instagram.com/${snap.instagram_url.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-pink-600 hover:border-pink-300 transition-colors"
                    >
                      📸 Instagram
                    </a>
                  )}
                  {snap.facebook_page_url && (
                    <a
                      href={snap.facebook_page_url.startsWith("http") ? snap.facebook_page_url : `https://facebook.com/${snap.facebook_page_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-blue-600 hover:border-blue-300 transition-colors"
                    >
                      👍 Facebook
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {gem.seller_id !== userId ? (
              <button
                onClick={handleContact}
                className="flex-1 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                ✉️ Contact Seller
              </button>
            ) : (
              <div className="flex-1 py-3 text-center text-sm text-muted-foreground bg-slate-50 rounded-xl border border-border">
                This is your listing
              </div>
            )}
            <ShareButton url={listingUrl} title={shareTitle} text={shareText} />
          </div>

          {/* Request on Approval */}
          {gem.approval_enabled && gem.seller_id !== userId && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤝</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-800">Request on Approval</p>
                  <p className="text-xs text-emerald-700">
                    {`Get this gem on approval for up to ${gem.approval_duration_days ?? 30} days.`}
                    {gem.min_price ? ` Min. price: ${fmtCurrency(gem.min_price, gem.currency as Currency)}.` : ""}
                  </p>
                </div>
              </div>
              {!userId ? (
                <button onClick={() => navigate("/")} className="w-full py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
                  Sign in to request approval
                </button>
              ) : existingApproval ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-emerald-800 font-medium">
                    Your request: <span className="capitalize font-bold">{existingApproval.status.replace("_", " ")}</span>
                    {existingApproval.expiry_date && existingApproval.status === "in_approval" && (
                      <> · Expires {new Date(existingApproval.expiry_date).toLocaleDateString()}</>
                    )}
                  </span>
                  <button onClick={() => navigate("/business-manager")} className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold">
                    Manage
                  </button>
                </div>
              ) : approvalSuccess ? (
                <div className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                  <span>✅</span> Request sent!
                </div>
              ) : showApprovalModal ? (
                <div className="space-y-2">
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Optional message to the seller (e.g. market you serve, why you'd like this stone)…"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border resize-none h-20 outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  {approvalError && <p className="text-xs text-red-600">{approvalError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowApprovalModal(false); setApprovalError(null); }}
                      className="flex-1 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => requestMutation.mutate()}
                      disabled={requestMutation.isPending}
                      className="flex-1 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60"
                    >
                      {requestMutation.isPending ? "Sending…" : "Send Request"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowApprovalModal(true)} className="w-full py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
                  🤝 Request on Approval
                </button>
              )}
            </div>
          )}

          {/* Profile link */}
          {snap && (
            <Link href={`/company/${gem.seller_id}`}>
              <span className="block text-center text-sm text-primary hover:underline cursor-pointer">
                View all listings by {snap.company_name || snap.name} →
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        {gem.pricing_disclaimer}
      </p>
    </main>
  );
}
