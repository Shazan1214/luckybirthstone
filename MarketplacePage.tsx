import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { api, fmtCurrency, convertPrice, type Gemstone, type Currency, type GemImage, type CompanySnapshot, type Auction } from "@/lib/api";
import { STONE_FAMILIES, searchMatchesGem, getCategoryForName } from "@/lib/gemstones";
import CountdownTimer from "@/components/CountdownTimer";

const CURRENCIES: Currency[] = ["USD", "INR", "AED"];
const RADIUS_OPTIONS = [
  { label: "50 km", value: 50 },
  { label: "200 km", value: 200 },
  { label: "500 km", value: 500 },
  { label: "1 000 km", value: 1000 },
  { label: "5 000 km", value: 5000 },
];

function ConfBadge({ level }: { level: string }) {
  const label = level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
  return (
    <span className={`conf-${level} text-xs font-medium px-2 py-0.5 rounded-full`}>
      {label} confidence
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
      {children}
    </span>
  );
}

function VerificationBadge({ badge }: { badge: string }) {
  if (badge === "premium_verified")
    return <span title="Premium Verified" className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium shrink-0">★ PRO</span>;
  if (badge === "basic_verified")
    return <span title="Basic Verified" className="text-xs bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-medium shrink-0">✓</span>;
  return null;
}

const LABEL_ICONS: Record<string, string> = {
  front: "📷",
  side: "↔",
  certificate: "📋",
  inclusion: "🔬",
  other: "📌",
};

function ImageGallery({ images, alt }: { images: GemImage[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  const active = images[idx] ?? images[0];
  if (!active) return <div className="w-full h-44 bg-slate-100 flex items-center justify-center text-4xl opacity-30">💎</div>;
  return (
    <div>
      <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
        {active.media_type === "video" ? (
          <video
            key={active.image_url}
            src={active.image_url}
            className="w-full h-full object-cover"
            autoPlay muted loop playsInline
          />
        ) : (
          <img
            key={active.image_url}
            src={active.image_url}
            alt={alt}
            className="w-full h-full object-cover transition-opacity duration-200"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <span className="text-6xl">💎</span>
        </div>
        {active.label && (
          <span className="absolute bottom-2 left-2 text-[10px] bg-black/55 text-white px-1.5 py-0.5 rounded-md capitalize flex items-center gap-0.5">
            {LABEL_ICONS[active.label] ?? "📌"} {active.label}
          </span>
        )}
        {images.length > 1 && (
          <span className="absolute bottom-2 right-2 text-[10px] bg-black/55 text-white px-1.5 py-0.5 rounded-md">
            {idx + 1}/{images.length}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-1 px-2 py-1.5 bg-slate-50 border-t border-border overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              title={img.label ?? `Image ${i + 1}`}
              className={`shrink-0 w-9 h-9 rounded border-2 overflow-hidden transition-colors relative ${i === idx ? "border-primary" : "border-transparent hover:border-slate-300"}`}
            >
              {img.media_type === "video" ? (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white text-xs">▶</div>
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

function ContactModal({ onClose, onSignup }: { onClose: () => void; onSignup: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-bold mb-2">Sign up to connect</h2>
          <p className="text-muted-foreground text-sm mb-6">Sign up to connect with verified traders, miners, and manufacturers globally.</p>
          <button
            onClick={onSignup}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity mb-3"
          >
            Create Free Account
          </button>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

function DistanceBadge({ km }: { km: number | null }) {
  if (km === null) return null;
  const display = km < 1 ? "<1 km" : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  return (
    <span className="inline-flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap">
      📍 {display} away
    </span>
  );
}

function CompanySnapshotCard({ snap, distanceKm }: { snap: CompanySnapshot; distanceKm: number | null }) {
  const location = [snap.city, snap.country].filter(Boolean).join(", ");
  return (
    <div className="rounded-xl border border-border/70 overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-50 border-b border-border/50 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Seller</span>
        {snap.is_online && (
          <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Online
          </span>
        )}
      </div>
      <div className="p-3 flex items-start gap-3 bg-white">
        {/* Logo */}
        <div className="shrink-0">
          {snap.logo_url ? (
            <img
              src={snap.logo_url}
              alt={snap.company_name}
              className="w-11 h-11 rounded-full object-cover border border-border bg-white"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
              {snap.company_name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <Link href={`/company/${snap.id}`}>
              <span className="font-semibold text-sm text-foreground hover:text-primary cursor-pointer transition-colors leading-tight">
                {snap.company_name}
              </span>
            </Link>
            <VerificationBadge badge={snap.verification_badge} />
          </div>
          <p className="text-xs text-muted-foreground leading-tight">
            {snap.user_type_label}{location ? ` · ${location}` : ""}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {snap.rating > 0 && (
              <span className="text-xs font-medium text-amber-600">
                ⭐ {snap.rating.toFixed(1)}
                <span className="text-muted-foreground font-normal ml-0.5">({snap.total_reviews})</span>
              </span>
            )}
            {distanceKm !== null && <DistanceBadge km={distanceKm} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareListingButton({ gemId, stoneType, carat }: { gemId: string; stoneType: string; carat: number }) {
  const [copied, setCopied] = useState(false);
  const base = typeof window !== "undefined" ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}` : "";
  const url = `${base}/listing/${gemId}`;
  const title = `${carat}ct ${stoneType} — LuckyBirthstone`;

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch {}
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
      title="Share this listing"
      className="px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
    >
      {copied ? (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-600">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )}
    </button>
  );
}

function GemCard({
  gem,
  currency,
  onContact,
}: {
  gem: Gemstone;
  currency: Currency;
  onContact: (sellerId: string, gemId: string) => void;
}) {
  const displayPrice = convertPrice(gem.base_price_usd, "USD", currency);
  const estMin = convertPrice(gem.estimated_price_min, "USD", currency);
  const estMax = convertPrice(gem.estimated_price_max, "USD", currency);
  const rapVal = gem.total_rap_value ? convertPrice(gem.total_rap_value, "USD", currency) : null;
  const isDiamond = gem.stone_type.toLowerCase() === "diamond";
  const snap = gem.company_snapshot;

  return (
    <div className={`bg-white rounded-2xl border border-border overflow-hidden flex flex-col transition-shadow hover:shadow-md ${gem.is_featured ? "featured-card" : ""}`}>
      {/* Image gallery */}
      <div className="relative">
        <ImageGallery images={gem.images} alt={gem.stone_type} />
        {gem.is_featured && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full shadow z-10">
            ⭐ Featured
          </div>
        )}
        {isDiamond && (
          <div className="absolute top-2 right-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full z-10">
            💠 Diamond
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Title + price */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base leading-tight">
              <Link href={`/listing/${gem.id}`} className="hover:text-primary hover:underline transition-colors">
                {gem.stone_type}
              </Link>
              {isDiamond && gem.color && gem.clarity && (
                <span className="text-muted-foreground font-normal ml-1 text-sm">{gem.color}/{gem.clarity}</span>
              )}
            </h3>
            <span className="text-lg font-bold text-primary whitespace-nowrap">{fmtCurrency(displayPrice, currency)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <Tag>{gem.carat} ct</Tag>
            <Tag>{fmtCurrency(convertPrice(gem.base_price_usd / gem.carat, "USD", currency), currency)}/ct</Tag>
            <Tag>{gem.origin}</Tag>
            <Tag>{gem.treatment}</Tag>
            {gem.num_pieces && <Tag>{gem.num_pieces} pcs</Tag>}
          </div>
        </div>

        {/* Est. range — compact row under stone info */}
        <div className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Est.</span>
            <span className="font-medium text-foreground">{fmtCurrency(estMin, currency)} – {fmtCurrency(estMax, currency)}</span>
          </div>
          <ConfBadge level={gem.pricing_confidence} />
        </div>

        {/* Company Snapshot */}
        {snap && <CompanySnapshotCard snap={snap} distanceKm={gem.seller_distance_km} />}

        {/* Rapaport (diamond only) */}
        {isDiamond && rapVal != null && gem.rap_price_per_carat && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm space-y-1">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Rapaport Benchmark</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rap/ct</span>
              <span className="font-medium">{fmtCurrency(convertPrice(gem.rap_price_per_carat, "USD", currency), currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Rap</span>
              <span className="font-semibold">{fmtCurrency(rapVal, currency)}</span>
            </div>
          </div>
        )}

        {/* Multi-currency */}
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          {CURRENCIES.map((c) => (
            <div key={c} className={`rounded-lg px-2 py-1.5 text-center ${c === currency ? "bg-primary/8 text-primary font-semibold" : "bg-secondary text-muted-foreground"}`}>
              <div className="text-[10px] font-medium mb-0.5">{c}</div>
              <div className="font-semibold tabular-nums">{fmtCurrency(convertPrice(gem.base_price_usd, "USD", c), c)}</div>
            </div>
          ))}
        </div>

        {/* Contact + Share */}
        <div className="mt-auto pt-1 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => onContact(gem.seller_id, gem.id)}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              ✉️ Contact Seller
            </button>
            <ShareListingButton gemId={gem.id} stoneType={gem.stone_type} carat={gem.carat} />
          </div>
          <p className="text-[10px] text-center text-muted-foreground">Cert: {gem.certificate_number}</p>
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [currency, setCurrency] = useState<Currency>("USD");
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [, navigate] = useLocation();

  const [nearbyMode, setNearbyMode] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(500);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");

  const userId = localStorage.getItem("gw_user_id");
  const emailVerified = localStorage.getItem("gw_email_verified") === "true";

  const { data: allGems = [], isLoading: allLoading, error: allError } = useQuery({
    queryKey: ["inventory"],
    queryFn: api.getInventory,
    refetchInterval: 30_000,
    enabled: !nearbyMode || userLat === null,
  });

  const nearbySearchFn = useCallback(() => {
    if (userLat === null || userLng === null) return Promise.resolve([]);
    return api.searchNearbyInventory({
      lat: userLat,
      lng: userLng,
      radius_km: radius,
      stone_type: search || undefined,
    });
  }, [userLat, userLng, radius, search]);

  const { data: liveAuctions = [] } = useQuery({
    queryKey: ["auctions-home"],
    queryFn: () => api.getAuctions({ status: "active", limit: 6 }),
    refetchInterval: 15_000,
  });

  const { data: nearbyGems = [], isLoading: nearbyLoading, error: nearbyError, refetch: refetchNearby } = useQuery({
    queryKey: ["inventory-nearby", userLat, userLng, radius, search],
    queryFn: nearbySearchFn,
    enabled: nearbyMode && userLat !== null && userLng !== null,
  });

  const gems = nearbyMode && userLat !== null ? nearbyGems : allGems;
  const isLoading = nearbyMode && userLat !== null ? nearbyLoading : allLoading;
  const error = nearbyMode && userLat !== null ? nearbyError : allError;

  function enableNearby() {
    if (nearbyMode) {
      setNearbyMode(false);
      setUserLat(null);
      setUserLng(null);
      setLocError("");
      return;
    }
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    setLocLoading(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setNearbyMode(true);
        setLocLoading(false);
        setTimeout(() => refetchNearby(), 100);
      },
      (err) => {
        setLocLoading(false);
        if (err.code === 1) {
          setLocError("Location access denied. Please allow location in your browser settings.");
        } else {
          setLocError("Could not detect your location. Try again.");
        }
      },
      { timeout: 10000 }
    );
  }

  const filtered = nearbyMode && userLat !== null
    ? gems.filter((g) =>
        (family === "" || getCategoryForName(g.stone_type) === family || g.stone_type === family) &&
        (search === "" || searchMatchesGem(g, search) || g.origin.toLowerCase().includes(search.toLowerCase()))
      )
    : gems.filter((g) =>
        (family === "" || getCategoryForName(g.stone_type) === family || g.stone_type === family) &&
        (search === "" || searchMatchesGem(g, search) || g.origin.toLowerCase().includes(search.toLowerCase()))
      );

  const featured = filtered.filter((g) => g.is_featured);
  const rest = filtered.filter((g) => !g.is_featured);

  function handleContact(sellerId: string, gemId?: string) {
    if (!userId) {
      setShowModal(true);
      return;
    }
    if (!emailVerified) {
      navigate("/verify-email");
      return;
    }
    const url = gemId
      ? `/messages?with=${sellerId}&listing=${gemId}`
      : `/messages?with=${sellerId}`;
    navigate(url);
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gemstone Marketplace</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {nearbyMode && userLat !== null
              ? `${filtered.length} trader${filtered.length !== 1 ? "s" : ""} within ${radius.toLocaleString()} km · Sorted by distance`
              : filtered.length < gems.length
              ? `${filtered.length} of ${gems.length} listings · Zero commission direct trade`
              : `${gems.length} listings · Zero commission direct trade`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!nearbyMode && (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search gems, trade names, origins…"
                className="px-3 py-2 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 w-52"
              />
              <select
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                className="px-2 py-2 rounded-lg border border-border text-sm bg-white outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="">All families</option>
                {STONE_FAMILIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              {(search || family) && (
                <button
                  onClick={() => { setSearch(""); setFamily(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-2 rounded-lg border border-border bg-white transition-colors"
                  title="Clear filters"
                >
                  ✕ Clear
                </button>
              )}
            </>
          )}
          <button
            onClick={enableNearby}
            disabled={locLoading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${nearbyMode ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700" : "bg-white text-muted-foreground border-border hover:bg-slate-50 hover:text-foreground"}`}
          >
            {locLoading
              ? <><span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Detecting…</>
              : <>{nearbyMode ? "📍 Nearby ON" : "📍 Find Nearby"}</>
            }
          </button>
          {nearbyMode && userLat !== null && (
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="px-2 py-2 rounded-lg border border-border text-sm bg-white outline-none focus:ring-2 focus:ring-ring/30"
            >
              {RADIUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <div className="flex rounded-lg overflow-hidden border border-border text-sm">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-2 font-medium transition-colors ${currency === c ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Nearby banner */}
      {nearbyMode && userLat !== null && (
        <div className="mb-5 flex items-center justify-between gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
          <div>
            <p className="font-semibold text-emerald-900 text-sm">📍 Showing traders within {radius.toLocaleString()} km</p>
            <p className="text-emerald-700 text-xs mt-0.5">Sorted nearest first. Only sellers who have added their location are shown.</p>
          </div>
          <button onClick={enableNearby} className="shrink-0 text-xs text-emerald-700 hover:text-emerald-900 font-medium underline underline-offset-2">
            Turn off
          </button>
        </div>
      )}

      {/* Location error */}
      {locError && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-3 text-sm text-red-800">
          ⚠️ {locError}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
          <span className="spinner" /> Loading listings…
        </div>
      )}

      {error && (
        <div className="text-center py-16 text-destructive">
          Failed to load inventory. Make sure the API server is running.
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="text-center py-24 text-muted-foreground">
          <div className="text-5xl mb-4">{nearbyMode ? "📍" : "🔍"}</div>
          <p className="font-medium">{nearbyMode ? "No traders found nearby" : "No listings found"}</p>
          <p className="text-sm mt-1">
            {nearbyMode
              ? `No sellers within ${radius.toLocaleString()} km.`
              : "Try a different search term or check back later."}
          </p>
          {nearbyMode && (
            <button
              onClick={() => setRadius(5000)}
              className="mt-4 px-4 py-2 text-sm bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Search all 5 000 km
            </button>
          )}
        </div>
      )}

      {/* ── LIVE GEM AUCTIONS ── */}
      {liveAuctions.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-violet-600 text-lg">🏆</span>
              <h2 className="text-lg font-bold text-foreground">Live Auctions</h2>
              <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-full animate-pulse">
                {liveAuctions.length} live
              </span>
            </div>
            <button
              onClick={() => navigate("/gem-auctions")}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              View all auctions →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveAuctions.map((auction: Auction) => {
              const gem = auction.gem;
              const firstImg = gem?.images?.find(i => i.media_type !== "video") ?? gem?.images?.[0];
              const imgUrl = firstImg?.image_url;
              const isVideo = firstImg?.media_type === "video";
              return (
                <div
                  key={auction.id}
                  onClick={() => navigate(`/gem-auctions/${auction.id}`)}
                  className={`bg-white rounded-xl border cursor-pointer hover:shadow-md transition-all overflow-hidden ${
                    auction.is_featured ? "border-violet-300" : "border-border"
                  }`}
                >
                  <div className="flex gap-3 p-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 relative">
                      {imgUrl ? (
                        isVideo ? (
                          <>
                            <video src={imgUrl} muted preload="metadata" playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <div className="w-5 h-5 bg-white/90 rounded-full flex items-center justify-center">
                                <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" className="ml-0.5 text-slate-700"><polygon points="2,1 9,5 2,9" /></svg>
                              </div>
                            </div>
                          </>
                        ) : (
                          <img src={imgUrl} alt={gem?.stone_type} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">💎</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">
                        {gem ? `${gem.stone_type} ${gem.carat}ct` : "Gemstone"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{gem?.origin}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div>
                          <div className="text-xs text-muted-foreground">Bid</div>
                          <div className="font-bold text-primary text-sm">${auction.current_highest_bid.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Ends</div>
                          <CountdownTimer endTime={auction.end_time} compact className="text-xs" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 pb-2 flex gap-1.5">
                    {auction.is_ending_soon && <span className="text-[10px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">🔥 Ending soon</span>}
                    {auction.is_trending && <span className="text-[10px] bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded-full">📈 {auction.total_bids} bids</span>}
                    {!auction.is_ending_soon && !auction.is_trending && <span className="text-[10px] text-muted-foreground">{auction.total_bids} bid{auction.total_bids !== 1 ? "s" : ""}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── FEATURED SECTION ── */}
      {featured.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-500 text-lg">⭐</span>
            <h2 className="font-semibold text-base">Featured Listings</h2>
            <span className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Boosted</span>
          </div>
          {!userId ? (
            (() => {
              const preview = featured.slice(0, 4);
              const locked = featured.slice(4);
              return (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {preview.map((g) => <GemCard key={g.id} gem={g} currency={currency} onContact={handleContact} />)}
                  </div>
                  {locked.length > 0 && (
                    <div className="relative mt-5">
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 select-none pointer-events-none" style={{ filter: "blur(6px)", opacity: 0.45 }}>
                        {locked.map((g) => <GemCard key={g.id} gem={g} currency={currency} onContact={handleContact} />)}
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featured.map((g) => <GemCard key={g.id} gem={g} currency={currency} onContact={handleContact} />)}
            </div>
          )}
        </section>
      )}

      {/* ── ALL LISTINGS SECTION ── */}
      {rest.length > 0 && (
        <section>
          {featured.length > 0 && <h2 className="font-semibold text-base mb-4 text-muted-foreground">All Listings</h2>}

          {!userId ? (
            (() => {
              const PREVIEW_COUNT = 2;
              const preview = rest.slice(0, PREVIEW_COUNT);
              const locked = rest.slice(PREVIEW_COUNT);
              return (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {preview.map((g) => <GemCard key={g.id} gem={g} currency={currency} onContact={handleContact} />)}
                  </div>
                  {locked.length > 0 && (
                    <div className="relative mt-5">
                      {/* Blurred locked listings */}
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 select-none pointer-events-none" style={{ filter: "blur(7px)", opacity: 0.4 }}>
                        {locked.slice(0, 8).map((g) => <GemCard key={g.id} gem={g} currency={currency} onContact={handleContact} />)}
                      </div>
                      {/* Sign-up overlay */}
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-white/95 backdrop-blur-sm border border-border rounded-2xl shadow-2xl px-8 py-8 max-w-sm w-full mx-4 text-center">
                          <div className="text-4xl mb-3">💎</div>
                          <h3 className="text-xl font-bold text-foreground mb-1">
                            More listings await
                          </h3>
                          <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                            Create a free account to view all gems, contact sellers and start direct B2B trade — zero commission.
                          </p>
                          <div className="flex flex-col gap-3">
                            <button
                              onClick={() => navigate("/?mode=signup")}
                              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
                            >
                              Create Free Account
                            </button>
                            <button
                              onClick={() => navigate("/?mode=login")}
                              className="w-full py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                            >
                              Already have an account? Log in
                            </button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-4">
                            No credit card · No commission · Global B2B network
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rest.map((g) => <GemCard key={g.id} gem={g} currency={currency} onContact={handleContact} />)}
            </div>
          )}
        </section>
      )}

      {showModal && (
        <ContactModal
          onClose={() => setShowModal(false)}
          onSignup={() => { setShowModal(false); navigate("/?mode=signup"); }}
        />
      )}
    </main>
  );
}
