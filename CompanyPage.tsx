import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useRef } from "react";
import {
  api, fmtCurrency, convertPrice,
  type Gemstone, type PublicProfile, type Currency,
  type Endorsement, type Connection, type Auction, type Activity, type PartnerListing,
  sendConnectionRequest, fetchAcceptedConnections, fetchSentConnections,
  fetchActivities, USER_TYPE_LABELS,
} from "@/lib/api";

const CURRENCIES: Currency[] = ["USD", "INR", "AED", "THB"];

const BADGE_STYLES: Record<string, { label: string; color: string; icon: string }> = {
  none:             { label: "Unverified",       color: "text-slate-500 bg-slate-100",                          icon: "" },
  basic_verified:   { label: "Basic Verified",   color: "text-green-700 bg-green-100 border border-green-200",  icon: "✓" },
  verified:         { label: "Verified",         color: "text-sky-700 bg-sky-100 border border-sky-200",        icon: "✓" },
  legacy_verified:  { label: "Legacy Verified",  color: "text-amber-700 bg-amber-100 border border-amber-200",  icon: "★" },
  premium_verified: { label: "Premium Verified", color: "text-purple-700 bg-purple-100 border border-purple-200", icon: "★" },
};

const ACTIVITY_ICONS: Record<string, string> = {
  listing_added: "💎",
  auction_created: "🔨",
  deal_completed: "✅",
  deal_proposed: "🤝",
  endorsed: "⭐",
  connection_accepted: "🔗",
  default: "📋",
};

const COUNTRY_CODES: Record<string, string> = {
  "india": "IN", "thailand": "TH", "china": "CN", "japan": "JP",
  "usa": "US", "united states": "US", "united states of america": "US",
  "uae": "AE", "united arab emirates": "AE", "dubai": "AE",
  "russia": "RU", "iran": "IR", "pakistan": "PK", "sri lanka": "LK",
  "myanmar": "MM", "colombia": "CO", "brazil": "BR", "zambia": "ZM",
  "mozambique": "MZ", "tanzania": "TZ", "madagascar": "MG",
  "australia": "AU", "uk": "GB", "united kingdom": "GB",
  "germany": "DE", "france": "FR", "italy": "IT", "spain": "ES",
  "canada": "CA", "mexico": "MX", "turkey": "TR", "israel": "IL",
  "hong kong": "HK", "singapore": "SG", "vietnam": "VN",
  "cambodia": "KH", "indonesia": "ID", "malaysia": "MY",
  "afghanistan": "AF", "nigeria": "NG", "kenya": "KE",
};

function countryFlag(country: string | null): string {
  if (!country) return "";
  const code = COUNTRY_CODES[country.toLowerCase().trim()];
  if (!code) return "🌐";
  return code.split("").map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
}

const WA_CALLING_CODES: Record<string, string> = {
  "thailand": "66", "india": "91", "china": "86", "myanmar": "95",
  "vietnam": "84", "pakistan": "92", "bangladesh": "880", "indonesia": "62",
  "malaysia": "60", "philippines": "63", "sri lanka": "94", "cambodia": "855",
  "laos": "856", "iran": "98", "afghanistan": "93", "russia": "7",
  "nigeria": "234", "kenya": "254", "ghana": "233", "egypt": "20",
};
function formatWaNumber(raw: string | null | undefined, country?: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (!digits.startsWith("0")) return digits;
  const code = WA_CALLING_CODES[(country ?? "").toLowerCase().trim()];
  return code ? code + digits.slice(1) : digits;
}

function LogoAvatar({ logo_url, name, size = "md" }: { logo_url: string | null; name: string; size?: "sm" | "md" | "lg" | "xl" | "xxl" }) {
  const sizeClass =
    size === "xxl" ? "w-28 h-28 text-5xl" :
    size === "xl"  ? "w-24 h-24 text-4xl" :
    size === "lg"  ? "w-16 h-16 text-2xl" :
    size === "sm"  ? "w-9 h-9 text-sm"    : "w-12 h-12 text-xl";
  if (logo_url) {
    return (
      <img src={logo_url} alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0 border-2 border-white shadow-md bg-white`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 border-2 border-white shadow-md`}>
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function VerificationBadge({ badge }: { badge: string }) {
  const b = BADGE_STYLES[badge] ?? BADGE_STYLES["none"];
  if (!b.icon) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${b.color}`}>
      {b.icon} {b.label}
    </span>
  );
}

function ShareButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: label, url }); return; } catch {} }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <button onClick={share}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
      {copied ? <><span className="text-emerald-600">✓</span><span className="text-emerald-600">Copied!</span></> : <>
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {label}
      </>}
    </button>
  );
}


function GemCard({ gem, currency, onContact }: { gem: Gemstone; currency: Currency; onContact: () => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = gem.images.filter((i) => i.media_type !== "video");
  const thumb = images[imgIdx]?.image_url;
  const displayPrice = convertPrice(gem.base_price_usd, "USD", currency);
  const estMin = convertPrice(gem.estimated_price_min, "USD", currency);
  const estMax = convertPrice(gem.estimated_price_max, "USD", currency);
  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden group">
        {thumb ? (
          <img src={thumb} alt={gem.stone_type} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-4xl">💎</div>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {images.map((_, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === imgIdx ? "bg-white scale-125" : "bg-white/50"}`} />
            ))}
          </div>
        )}
        {gem.is_featured && (
          <div className="absolute top-2 left-2">
            <span className="text-[10px] bg-amber-100/90 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold backdrop-blur-sm">⭐ Featured</span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div>
          <p className="font-semibold text-sm">{gem.stone_type}</p>
          <p className="text-xs text-muted-foreground">{gem.carat} ct · {gem.origin} · {gem.treatment}</p>
          {gem.certificate_number && <p className="text-xs text-sky-600 mt-0.5">🏅 {gem.certificate_number}</p>}
        </div>
        <div className="flex items-end justify-between gap-2 mt-auto pt-2 border-t border-border/40">
          <div>
            <p className="text-base font-bold text-primary">{fmtCurrency(displayPrice, currency)}</p>
            <p className="text-[11px] text-muted-foreground">Est: {fmtCurrency(estMin, currency)} – {fmtCurrency(estMax, currency)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link href={`/listing/${gem.id}`}>
              <span className="px-2.5 py-1.5 text-xs font-semibold border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors">View</span>
            </Link>
            <button onClick={onContact}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity">
              Contact
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuctionCard({ auction, currency }: { auction: Auction; currency: Currency }) {
  const now = Date.now();
  const end = new Date(auction.end_time).getTime();
  const msLeft = end - now;
  const hoursLeft = Math.max(0, Math.floor(msLeft / 3_600_000));
  const minLeft = Math.max(0, Math.floor((msLeft % 3_600_000) / 60_000));
  const isEnded = msLeft <= 0;
  const price = convertPrice(auction.current_highest_bid ?? auction.starting_price, "USD", currency);
  return (
    <Link href={`/auctions/${auction.id}`}>
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-4xl">🔨</div>
        <div className="p-4">
          <p className="font-semibold text-sm mb-1">{auction.gem?.stone_type ?? "Gemstone"}</p>
          <p className="text-xs text-muted-foreground mb-2">{auction.gem?.carat} ct · {auction.gem?.origin}</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Current Bid</p>
              <p className="font-bold text-primary">{fmtCurrency(price, currency)}</p>
            </div>
            <div className={`text-xs font-semibold px-2 py-1 rounded-full ${isEnded ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-600"}`}>
              {isEnded ? "Ended" : `${hoursLeft}h ${minLeft}m`}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-14 text-muted-foreground">
        <div className="text-4xl mb-3">📋</div>
        <p className="font-medium text-sm">No public activity yet</p>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-5">
        {activities.filter((a) => a.is_public).map((a) => (
          <div key={a.id} className="flex gap-4 relative">
            <div className="w-8 h-8 rounded-full bg-white border-2 border-border flex items-center justify-center text-sm shrink-0 z-10">
              {ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.default}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm text-foreground">{a.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(a.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Tab = "listings" | "auctions" | "activity";
type GalleryTab = "all" | "shop" | "certificates" | "inventory";

export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [activeTab, setActiveTab] = useState<Tab>("listings");
  const tabsRef = useRef<HTMLDivElement>(null);

  function jumpToTab(tab: Tab) {
    setActiveTab(tab);
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
  const [galleryTab, setGalleryTab] = useState<GalleryTab>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const qc = useQueryClient();
  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [endorseMessage, setEndorseMessage] = useState("");
  const [endorseYears, setEndorseYears] = useState<string>("");
  const [endorseLoading, setEndorseLoading] = useState(false);
  const [endorseError, setEndorseError] = useState<string | null>(null);
  const [endorseSuccess, setEndorseSuccess] = useState(false);
  const [connectStatus, setConnectStatus] = useState<"idle" | "sending" | "sent" | "connected" | "error">("idle");

  const userId = localStorage.getItem("gw_user_id");
  const emailVerified = localStorage.getItem("gw_email_verified") === "true";
  const base = typeof window !== "undefined" ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}` : "";

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<PublicProfile>({
    queryKey: ["profile", id],
    queryFn: () => api.getProfile(id!),
    enabled: !!id,
  });

  const { data: allGems = [], isLoading: gemsLoading } = useQuery<Gemstone[]>({
    queryKey: ["inventory"],
    queryFn: api.getInventory,
  });

  const { data: allAuctions = [] } = useQuery<Auction[]>({
    queryKey: ["auctions"],
    queryFn: () => api.getAuctions({ limit: 100 }),
  });

  const { data: partnerListings = [] } = useQuery<PartnerListing[]>({
    queryKey: ["companyPartnerListings", id],
    queryFn: () => api.getCompanyPartnerListings(id!),
    enabled: !!id,
  });

  const { data: endorsementList = [] } = useQuery<Endorsement[]>({
    queryKey: ["endorsements", "received", id],
    queryFn: () => api.getReceivedEndorsements(id!),
    enabled: !!id,
  });

  const { data: profileConns = [] } = useQuery<Connection[]>({
    queryKey: ["connections", "accepted", id],
    queryFn: () => fetchAcceptedConnections(id!),
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["activities", id],
    queryFn: () => fetchActivities(id!, 30),
    enabled: !!id,
  });

  const { data: acceptedConns = [] } = useQuery<Connection[]>({
    queryKey: ["connections", "accepted", userId],
    queryFn: () => fetchAcceptedConnections(userId!),
    enabled: !!userId && !!id && userId !== id,
  });
  const { data: sentConns = [] } = useQuery<Connection[]>({
    queryKey: ["connections", "sent", userId],
    queryFn: () => fetchSentConnections(userId!),
    enabled: !!userId && !!id && userId !== id,
  });

  const isConnected = acceptedConns.some((c) => c.other_id === id);
  const hasSentRequest = sentConns.some((c) => c.to_user_id === id && c.status === "pending");

  const companyGems = allGems.filter((g) => g.seller_id === id && g.seller_distance_km !== -1);
  const companyAuctions = allAuctions.filter((a) => a.seller_id === id);

  async function handleConnect() {
    if (!userId || !id) return;
    setConnectStatus("sending");
    try {
      await sendConnectionRequest(userId, id);
      setConnectStatus("sent");
      void qc.invalidateQueries({ queryKey: ["connections", "sent", userId] });
    } catch {
      setConnectStatus("error");
    }
  }

  async function submitEndorsement() {
    if (!userId || !id) return;
    if (!endorseMessage.trim()) { setEndorseError("Please write a message."); return; }
    setEndorseLoading(true);
    setEndorseError(null);
    try {
      await api.createEndorsement({ from_user_id: userId, to_user_id: id, message: endorseMessage.trim(), years_known: endorseYears ? Number(endorseYears) : null });
      setEndorseSuccess(true);
      setEndorseMessage("");
      setEndorseYears("");
      void qc.invalidateQueries({ queryKey: ["profile", id] });
    } catch (err: unknown) {
      setEndorseError(err instanceof Error ? err.message : "Failed to send endorsement");
    } finally {
      setEndorseLoading(false);
    }
  }

  function handleContact() {
    if (!userId) { navigate("/"); return; }
    if (!emailVerified) { navigate("/verify-email"); return; }
    navigate(`/messages?with=${id}`);
  }

  const profileUrl = `${base}/company/${id}`;

  if (profileLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center gap-2 text-muted-foreground">
        <span className="spinner" /> Loading profile…
      </main>
    );
  }

  if (profileError || !profile) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center text-muted-foreground">
        <div className="text-5xl mb-4">🔍</div>
        <p className="font-medium">Company not found</p>
        <button onClick={() => navigate("/marketplace")} className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90">
          Back to Marketplace
        </button>
      </main>
    );
  }

  const gallery = profile.gallery_urls ?? [];
  const displayName = profile.company_name ?? profile.name;
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const flag = countryFlag(profile.country);
  const isOwnProfile = id === userId;
  const whatsappNum = formatWaNumber(profile.contact_number, profile.country);
  const publicActivities = activities.filter((a) => a.is_public);

  return (
    <>
      {/* ── MAIN CONTENT ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-28 sm:pb-8 pt-4 space-y-5">

        {/* Top bar: back + lang switcher */}
        <div className="flex items-center">
          <button onClick={() => navigate("/marketplace")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </button>
        </div>

        {/* ── SECTION 1: HEADER CARD ── */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Banner */}
          <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-violet-100 relative">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='0.12'%3E%3Cpath d='M16 0l16 16-16 16L0 16z'/%3E%3C/g%3E%3C/svg%3E\")" }} />
            {/* Founding / Legacy badges on banner */}
            <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
              {profile.is_founding_seller && (
                <span className="text-[10px] bg-amber-100/90 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-semibold backdrop-blur-sm">🏅 Founding Member</span>
              )}
              {profile.verification_badge === "legacy_verified" && (
                <span className="text-[10px] bg-amber-50/90 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">🏆 Legacy Member</span>
              )}
            </div>
          </div>

          <div className="px-5 pb-5">
            {/* Logo + trust ring row */}
            <div className="flex items-end justify-between -mt-14 mb-4">
              <div className="ring-4 ring-white rounded-full shadow-lg">
                <LogoAvatar logo_url={profile.logo_url} name={displayName} size="xxl" />
              </div>
              <div className="flex flex-col items-end gap-2 mt-4">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${profile.is_online ? "bg-green-400 animate-pulse" : "bg-slate-300"}`} />
                  <span className="text-xs text-muted-foreground">{profile.is_online ? "Online now" : "Offline"}</span>
                </div>
              </div>
            </div>

            {/* Name + badges */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold">{displayName}</h1>
              <VerificationBadge badge={profile.verification_badge} />
            </div>

            {/* Type + specialization */}
            <p className="text-sm text-muted-foreground mb-2">
              {USER_TYPE_LABELS[profile.user_type] ?? profile.user_type_label}
              {profile.specialization && <> · {profile.specialization}</>}
            </p>

            {/* Meta chips */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-4">
              {location && (
                <span className="flex items-center gap-1">
                  {flag && <span>{flag}</span>}
                  📍 {location}
                </span>
              )}
              {profile.owner_name && <span>👤 {profile.owner_name}</span>}
              {profile.years_in_business != null && <span>🗓 {profile.years_in_business} yrs</span>}
              {profile.website && (
                <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  🌐 {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>

            {/* Description */}
            {profile.company_description && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 border-l-2 border-primary/30 pl-3 italic">
                {profile.company_description}
              </p>
            )}

            {/* Desktop action buttons — hidden on mobile (sticky bar handles mobile) */}
            <div className="hidden sm:flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
              {!isOwnProfile && (
                <button onClick={handleContact}
                  className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5">
                  ✉️ Messages
                </button>
              )}
              {!isOwnProfile && (
                whatsappNum ? (
                  <a href={`https://wa.me/${whatsappNum}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 transition-colors">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.098.543 4.063 1.492 5.775L.057 24l6.36-1.66A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.959 0-3.786-.574-5.322-1.562l-.381-.226-3.944 1.029 1.052-3.847-.248-.396A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    WhatsApp
                  </a>
                ) : (
                  <span
                    title="This company hasn't added a phone number yet"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-400 text-sm rounded-xl cursor-not-allowed select-none"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="opacity-40"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.098.543 4.063 1.492 5.775L.057 24l6.36-1.66A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.959 0-3.786-.574-5.322-1.562l-.381-.226-3.944 1.029 1.052-3.847-.248-.396A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    WhatsApp
                  </span>
                )
              )}
              {userId && !isOwnProfile && (
                isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 text-sm text-emerald-700 bg-emerald-50 font-medium">
                    ✓ Connected
                  </span>
                ) : hasSentRequest || connectStatus === "sent" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground bg-secondary">
                    Request Sent
                  </span>
                ) : (
                  <button onClick={() => void handleConnect()} disabled={connectStatus === "sending"}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary text-sm text-primary font-semibold hover:bg-primary/5 disabled:opacity-60 transition-colors">
                    {connectStatus === "sending" ? "…" : "🤝 Connect"}
                  </button>
                )
              )}
              {userId && !isOwnProfile && !endorseSuccess && (
                <button onClick={() => { setShowEndorseModal(true); setEndorseError(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  ✦ Endorse
                </button>
              )}
              <ShareButton url={profileUrl} label="Share" />
              {profile.instagram_url && (
                <a href={profile.instagram_url.startsWith("http") ? profile.instagram_url : `https://instagram.com/${profile.instagram_url.replace(/^@/, "")}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-pink-600 hover:border-pink-300 transition-colors">
                  📸
                </a>
              )}
              {profile.facebook_page_url && (
                <a href={profile.facebook_page_url.startsWith("http") ? profile.facebook_page_url : `https://facebook.com/${profile.facebook_page_url}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-blue-600 hover:border-blue-300 transition-colors">
                  👍
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 2: STATS ROW ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Listings — clickable */}
          <button
            onClick={() => jumpToTab("listings")}
            className="bg-white border border-border rounded-xl p-3 text-center shadow-sm hover:border-primary/50 hover:bg-primary/5 transition-colors group"
          >
            <div className="text-lg">💎</div>
            <div className="text-lg font-bold text-primary leading-none group-hover:underline underline-offset-2">
              {gemsLoading ? "…" : companyGems.length + partnerListings.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Listings</div>
          </button>
          {/* Auctions — clickable */}
          <button
            onClick={() => jumpToTab("auctions")}
            className="bg-white border border-border rounded-xl p-3 text-center shadow-sm hover:border-primary/50 hover:bg-primary/5 transition-colors group"
          >
            <div className="text-lg">🔨</div>
            <div className="text-lg font-bold text-primary leading-none group-hover:underline underline-offset-2">
              {companyAuctions.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Auctions</div>
          </button>
          {/* Years in business — static */}
          <div className="bg-white border border-border rounded-xl p-3 text-center shadow-sm">
            <div className="text-lg">📅</div>
            <div className="text-lg font-bold text-primary leading-none">
              {profile.years_in_business ?? "—"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Yrs. in Biz</div>
          </div>
        </div>

        {/* ── SECTION 3: MEDIA GALLERY ── */}
        {gallery.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">Media Gallery</h2>
              <div className="flex gap-1">
                {(["all", "shop", "certificates", "inventory"] as GalleryTab[]).map((t) => (
                  <button key={t} onClick={() => setGalleryTab(t)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors capitalize ${galleryTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {gallery.map((url, i) => (
                <button key={i} onClick={() => setLightboxIndex(i)}
                  className="aspect-square rounded-xl overflow-hidden border border-border hover:opacity-90 transition-all hover:scale-[1.02]">
                  <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 4: CONNECTIONS ROW ── */}
        {profileConns.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-base mb-3">
              My Network
              <span className="ml-2 text-xs text-muted-foreground font-normal">{profileConns.length} connected</span>
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {profileConns.map((conn) => (
                <Link key={conn.id} href={`/company/${conn.other_id}`}>
                  <div className="flex flex-col items-center gap-1.5 min-w-[64px] cursor-pointer group">
                    <div className="ring-2 ring-border group-hover:ring-primary rounded-full transition-all">
                      <LogoAvatar logo_url={conn.other_logo} name={conn.other_name} size="lg" />
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground group-hover:text-foreground transition-colors max-w-[64px] truncate">
                      {conn.other_name}
                    </p>
                    {conn.other_verification_badge && conn.other_verification_badge !== "none" && (
                      <span className="text-[8px] text-sky-600">✓</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 5: ENDORSEMENTS ── */}
        <div>
          {/* Endorsements */}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base flex items-center gap-2">
                Endorsements
                {endorsementList.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{endorsementList.length}</span>
                )}
              </h2>
              {userId && !isOwnProfile && !endorseSuccess && (
                <button onClick={() => { setShowEndorseModal(true); setEndorseError(null); }}
                  className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                  ✦ Endorse
                </button>
              )}
              {endorseSuccess && <span className="text-xs text-emerald-600 font-medium">✓ Sent</span>}
            </div>

            {endorsementList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No endorsements yet. Be the first!</p>
            ) : (
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {endorsementList.map((e) => (
                  <div key={e.id} className="flex gap-3 py-3 border-b border-border/50 last:border-0">
                    <div className="shrink-0">
                      {e.from_logo ? (
                        <img src={e.from_logo} alt={e.from_name} className="w-9 h-9 rounded-full object-cover border border-border bg-white" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                          {(e.from_name ?? "?")[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-sm">{e.from_name}</span>
                        {e.from_verification_badge && e.from_verification_badge !== "none" && (
                          <span className="text-[10px] text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">✓ Verified</span>
                        )}
                        {e.years_known && (
                          <span className="text-xs text-muted-foreground">· {e.years_known}+ yr{e.years_known > 1 ? "s" : ""}</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{e.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(e.accepted_at ?? e.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION 6: TABS — Listings / Auctions / Activity ── */}
        <div ref={tabsRef} className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-border">
            {(["listings", "auctions", "activity"] as Tab[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {tab === "listings"
                  ? `💎 Listings${!gemsLoading ? ` (${companyGems.length + partnerListings.length})` : ""}`
                  : tab === "auctions"
                  ? `🔨 Auctions${companyAuctions.length > 0 ? ` (${companyAuctions.length})` : ""}`
                  : `📋 Activity${publicActivities.length > 0 ? ` (${publicActivities.length})` : ""}`}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* ── Listings ── */}
            {activeTab === "listings" && (
              <>
                {(companyGems.length > 0 || partnerListings.length > 0) && (
                  <div className="flex justify-end mb-4">
                    <div className="flex rounded-lg overflow-hidden border border-border text-xs">
                      {CURRENCIES.map((c) => (
                        <button key={c} onClick={() => setCurrency(c)}
                          className={`px-2.5 py-1.5 font-medium transition-colors ${currency === c ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary"}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {gemsLoading ? (
                  <div className="flex items-center justify-center py-14 gap-2 text-muted-foreground">
                    <span className="spinner" /> Loading…
                  </div>
                ) : companyGems.length === 0 && partnerListings.length === 0 ? (
                  <div className="text-center py-14 text-muted-foreground">
                    <div className="text-4xl mb-3">📦</div>
                    <p className="font-medium text-sm">No active listings</p>
                  </div>
                ) : (
                  <>
                    {companyGems.length > 0 && (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                        {companyGems.map((g) => (
                          <GemCard key={g.id} gem={g} currency={currency} onContact={handleContact} />
                        ))}
                      </div>
                    )}
                    {partnerListings.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">On Approval</span>
                          <span className="text-xs text-muted-foreground">({partnerListings.length})</span>
                          <div className="flex-1 border-t border-amber-200" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {partnerListings.map((pl) => {
                            const gem = pl.original_gem;
                            if (!gem) return null;
                            const thumb = gem.images?.[0]?.url ?? "";
                            const ownerName = pl.owner?.company_name || pl.owner?.name || "Original Owner";
                            return (
                              <Link key={pl.id} href={`/listing/${gem.id}`}>
                                <div className="relative rounded-xl border border-amber-300 bg-amber-50 overflow-hidden shadow-sm hover:shadow-md hover:border-amber-400 transition-all cursor-pointer group">
                                  <div className="relative h-36 bg-muted overflow-hidden">
                                    {thumb ? (
                                      <img src={thumb} alt={gem.stone_type} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-3xl">💎</div>
                                    )}
                                    <div className="absolute top-2 left-2 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                                      🤝 On Approval
                                    </div>
                                  </div>
                                  <div className="p-3">
                                    <p className="font-semibold text-sm">{gem.stone_type}</p>
                                    <p className="text-xs text-muted-foreground">{gem.carat} ct · {gem.origin} · {gem.treatment}</p>
                                    {gem.certificate_number && (
                                      <p className="text-xs text-sky-600 mt-0.5">🏅 {gem.certificate_number}</p>
                                    )}
                                    <p className="text-[11px] text-amber-700 mt-1.5 font-medium">
                                      from <span className="font-semibold">{ownerName}</span>
                                    </p>
                                    <p className="text-sm font-bold text-primary mt-1">
                                      {fmtCurrency(pl.selling_price, pl.selling_currency as Currency)}
                                    </p>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── Auctions ── */}
            {activeTab === "auctions" && (
              companyAuctions.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground">
                  <div className="text-4xl mb-3">🔨</div>
                  <p className="font-medium text-sm">No auctions from this seller</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {companyAuctions.map((a) => (
                    <AuctionCard key={a.id} auction={a} currency={currency} />
                  ))}
                </div>
              )
            )}

            {/* ── Activity ── */}
            {activeTab === "activity" && <ActivityTimeline activities={activities} />}
          </div>
        </div>
      </main>

      {/* ── STICKY MOBILE ACTION BAR ── */}
      {!isOwnProfile && (
        <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white/95 backdrop-blur-sm border-t border-border shadow-lg px-4 py-3 safe-area-inset-bottom">
          <div className="flex gap-2 max-w-lg mx-auto">
            <button onClick={handleContact}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity">
              <span className="text-base">✉️</span>
              Chat
            </button>
            {!isOwnProfile && (
              whatsappNum ? (
                <a href={`https://wa.me/${whatsappNum}`} target="_blank" rel="noreferrer"
                  className="flex-1 flex flex-col items-center gap-0.5 py-2 bg-green-500 text-white rounded-xl text-xs font-semibold hover:bg-green-600 transition-colors">
                  <span className="text-base">📱</span>
                  WhatsApp
                </a>
              ) : (
                <div
                  title="This company hasn't added a phone number yet"
                  className="flex-1 flex flex-col items-center gap-0.5 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs cursor-not-allowed"
                >
                  <span className="text-base opacity-40">📱</span>
                  <span>WhatsApp</span>
                  <span className="text-[9px] leading-tight text-center px-1">No number</span>
                </div>
              )
            )}
            {userId && (
              isConnected ? (
                <div className="flex-1 flex flex-col items-center gap-0.5 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium border border-emerald-200">
                  <span className="text-base">✓</span>
                  Connected
                </div>
              ) : hasSentRequest || connectStatus === "sent" ? (
                <div className="flex-1 flex flex-col items-center gap-0.5 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs">
                  <span className="text-base">⏳</span>
                  Pending
                </div>
              ) : (
                <button onClick={() => void handleConnect()} disabled={connectStatus === "sending"}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2 border border-primary text-primary rounded-xl text-xs font-semibold hover:bg-primary/5 disabled:opacity-60 transition-colors">
                  <span className="text-base">🤝</span>
                  Connect
                </button>
              )
            )}
            {userId && !endorseSuccess && (
              <button onClick={() => { setShowEndorseModal(true); setEndorseError(null); }}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 border border-border text-muted-foreground rounded-xl text-xs hover:bg-secondary transition-colors">
                <span className="text-base">✦</span>
                Endorse
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightboxIndex !== null && gallery[lightboxIndex] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxIndex(null)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={gallery[lightboxIndex]} alt="" className="w-full rounded-2xl max-h-[85vh] object-contain" />
            <div className="absolute top-3 right-3 flex gap-2">
              {lightboxIndex > 0 && (
                <button onClick={() => setLightboxIndex(lightboxIndex - 1)} className="bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm hover:bg-black/70">‹</button>
              )}
              {lightboxIndex < gallery.length - 1 && (
                <button onClick={() => setLightboxIndex(lightboxIndex + 1)} className="bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm hover:bg-black/70">›</button>
              )}
              <button onClick={() => setLightboxIndex(null)} className="bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm hover:bg-black/70">✕</button>
            </div>
            <p className="text-center text-white/60 text-xs mt-2">{lightboxIndex + 1} / {gallery.length}</p>
          </div>
        </div>
      )}

      {/* ── ENDORSE MODAL ── */}
      {showEndorseModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 sm:rounded-2xl rounded-t-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Endorse {displayName}</h3>
              <button onClick={() => setShowEndorseModal(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Your endorsement boosts their trust score and appears on their profile after they accept it.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Your Message <span className="text-red-500">*</span></label>
                <textarea value={endorseMessage} onChange={(e) => setEndorseMessage(e.target.value)} rows={4}
                  placeholder="Describe your experience working with this trader…"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Years Known (optional)</label>
                <input type="number" min="0" max="50" value={endorseYears} onChange={(e) => setEndorseYears(e.target.value)} placeholder="e.g. 3"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {endorseError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{endorseError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowEndorseModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-secondary transition-colors">
                  Cancel
                </button>
                <button onClick={async () => { await submitEndorsement(); if (!endorseError) setShowEndorseModal(false); }}
                  disabled={endorseLoading || !endorseMessage.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {endorseLoading ? "Sending…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
