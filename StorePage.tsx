import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { api, fmtCurrency, convertPrice, type Gemstone, type PublicProfile, type Currency } from "@/lib/api";
import { useState } from "react";

const CURRENCIES: Currency[] = ["USD", "INR", "AED", "THB"];

const BADGE_STYLES: Record<string, { label: string; color: string; icon: string }> = {
  none:             { label: "Unverified",        color: "text-slate-500 bg-slate-100",                           icon: "" },
  basic_verified:   { label: "Basic Verified",    color: "text-green-700 bg-green-100 border border-green-200",   icon: "✓" },
  premium_verified: { label: "Premium Verified",  color: "text-amber-700 bg-amber-100 border border-amber-200",   icon: "★" },
  verified:         { label: "Verified",          color: "text-sky-700 bg-sky-100 border border-sky-200",         icon: "✓" },
};

function LogoAvatar({ logo_url, name, size = "md" }: { logo_url: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-24 h-24 text-4xl" : size === "sm" ? "w-8 h-8 text-sm" : "w-12 h-12 text-xl";
  if (logo_url) {
    return (
      <img
        src={logo_url}
        alt={name}
        className={`${sizeClass} rounded-2xl object-cover shrink-0 border border-border bg-white shadow-sm`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 shadow-sm`}>
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center p-4 bg-slate-50 rounded-xl">
      <div className="text-xl font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (navigator.share) {
      try { await navigator.share({ title: "LuckyBirthstone Store", url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-medium"
    >
      {copied ? (
        <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-600"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="text-emerald-600">Copied!</span></>
      ) : (
        <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>Share Store</>
      )}
    </button>
  );
}

function GemShareButton({ gemId, stoneType, carat }: { gemId: string; stoneType: string; carat: number }) {
  const [copied, setCopied] = useState(false);
  const base = typeof window !== "undefined" ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}` : "";
  const url = `${base}/listing/${gemId}`;
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: `${carat}ct ${stoneType} — LuckyBirthstone`, url }); return; } catch {} }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <button onClick={share} title="Share listing" className="px-2 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
      {copied ? (
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-emerald-600"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : (
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
      )}
    </button>
  );
}

function GemCard({ gem, currency, onContact }: { gem: Gemstone; currency: Currency; onContact: () => void }) {
  const displayPrice = convertPrice(gem.base_price_usd, "USD", currency);
  const estMin = convertPrice(gem.estimated_price_min, "USD", currency);
  const estMax = convertPrice(gem.estimated_price_max, "USD", currency);
  const thumb = gem.images[0]?.image_url;

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {thumb ? (
        <div className="aspect-[4/3] bg-slate-50 overflow-hidden">
          <img src={thumb} alt={gem.stone_type} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-4xl">💎</div>
      )}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{gem.stone_type}</p>
            <p className="text-xs text-muted-foreground">{gem.carat} ct · {gem.origin} · {gem.treatment}</p>
          </div>
          {gem.is_featured && (
            <span className="shrink-0 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">⭐ Featured</span>
          )}
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
            <GemShareButton gemId={gem.id} stoneType={gem.stone_type} carat={gem.carat} />
            <button
              onClick={onContact}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Contact
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [currency, setCurrency] = useState<Currency>("USD");

  const userId = localStorage.getItem("gw_user_id");
  const emailVerified = localStorage.getItem("gw_email_verified") === "true";
  const base = typeof window !== "undefined" ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}` : "";
  const storeUrl = `${base}/store/${slug}`;

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<PublicProfile>({
    queryKey: ["store", slug],
    queryFn: () => api.getProfileBySlug(slug!),
    enabled: !!slug,
  });

  const { data: allGems = [], isLoading: gemsLoading } = useQuery<Gemstone[]>({
    queryKey: ["inventory"],
    queryFn: api.getInventory,
  });

  const storeGems = allGems.filter((g) => g.seller_id === profile?.id && g.seller_distance_km !== -1);

  function handleContact() {
    if (!userId) { navigate("/"); return; }
    if (!emailVerified) { navigate("/verify-email"); return; }
    navigate(`/messages?with=${profile?.id}`);
  }

  if (profileLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 flex items-center justify-center gap-2 text-muted-foreground">
        <span className="spinner" /> Loading store…
      </main>
    );
  }

  if (profileError || !profile) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="font-semibold text-lg mb-1">Store not found</p>
        <p className="text-sm text-muted-foreground mb-6">This store link may be invalid or the seller may have changed their URL.</p>
        <button onClick={() => navigate("/marketplace")} className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90">
          Browse Marketplace
        </button>
      </main>
    );
  }

  const badge = BADGE_STYLES[profile.verification_badge] ?? BADGE_STYLES["none"];
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const isOwner = userId === profile.id;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate("/marketplace")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Marketplace
      </button>

      {/* Store header */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Banner strip */}
        <div className="h-24 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />

        <div className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
            <div className="shrink-0">
              <LogoAvatar logo_url={profile.logo_url} name={profile.company_name ?? profile.name} size="lg" />
            </div>
            <div className="flex-1 min-w-0 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <h1 className="text-2xl font-bold tracking-tight">{profile.company_name ?? profile.name}</h1>
                {badge.icon && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                    {badge.icon} {badge.label}
                  </span>
                )}
                {profile.is_founding_seller && (
                  <span className="text-[11px] bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-medium">🏅 Founding Member</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{profile.user_type_label}</p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${profile.is_online ? "bg-green-400" : "bg-slate-300"}`} />
              {profile.is_online ? "Online now" : "Offline"}
            </div>
          </div>

          {/* Info row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
            {location && <span>📍 {location}</span>}
            {profile.owner_name && <span>👤 {profile.owner_name}</span>}
            {profile.website && (
              <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                🌐 {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {profile.instagram_url && (
              <a href={profile.instagram_url.startsWith("http") ? profile.instagram_url : `https://instagram.com/${profile.instagram_url.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="hover:text-pink-600 transition-colors">
                📸 Instagram
              </a>
            )}
            {profile.facebook_page_url && (
              <a href={profile.facebook_page_url.startsWith("http") ? profile.facebook_page_url : `https://facebook.com/${profile.facebook_page_url}`} target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors">
                👍 Facebook
              </a>
            )}
          </div>

          {/* Description */}
          {profile.company_description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-2xl">{profile.company_description}</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatBox label="Rating" value={profile.rating > 0 ? `⭐ ${profile.rating.toFixed(1)}` : "—"} />
            <StatBox label="Reviews" value={profile.total_reviews} />
            <StatBox label="Active Listings" value={gemsLoading ? "…" : storeGems.length} />
            <StatBox label="Member Since" value={new Date(profile.created_at).getFullYear()} />
          </div>

          {/* Store URL + actions */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/60">
            {/* Store URL chip */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-border text-xs font-mono text-muted-foreground min-w-0 overflow-hidden">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 1 0 20M2 12h20" /></svg>
              <span className="truncate">luckybirthstone.com/store/<strong className="text-foreground">{slug}</strong></span>
            </div>
            <CopyLinkButton url={storeUrl} />
            {!isOwner && (
              <button
                onClick={handleContact}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                ✉️ Contact Seller
              </button>
            )}
            {isOwner && (
              <Link href="/profile">
                <span className="px-4 py-2 text-sm font-medium border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors">
                  ✏️ Edit Store
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Listings */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-semibold text-base">
            Gems for Sale
            {!gemsLoading && <span className="text-muted-foreground font-normal ml-1.5">({storeGems.length})</span>}
          </h2>
          <div className="flex rounded-xl overflow-hidden border border-border text-sm">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 font-medium transition-colors ${currency === c ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {gemsLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <span className="spinner" /> Loading listings…
          </div>
        )}

        {!gemsLoading && storeGems.length === 0 && (
          <div className="text-center py-16 text-muted-foreground bg-white border border-border rounded-2xl">
            <div className="text-4xl mb-3">📦</div>
            <p className="font-medium">No active listings yet</p>
            <p className="text-sm mt-1">Check back soon — new gems may be added.</p>
          </div>
        )}

        {storeGems.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {storeGems.map((g) => (
              <GemCard key={g.id} gem={g} currency={currency} onContact={handleContact} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
