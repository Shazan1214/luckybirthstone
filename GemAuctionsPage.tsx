import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, type Auction } from "@/lib/api";
import CountdownTimer from "@/components/CountdownTimer";

const STONE_FILTERS = ["All", "Ruby", "Sapphire", "Emerald", "Diamond", "Spinel", "Alexandrite", "Tanzanite", "Pearl", "Opal"];

function VerifyBadge({ badge }: { badge: string }) {
  if (badge === "legacy_verified") return <span className="text-amber-500 text-xs font-bold">★ Legacy</span>;
  if (badge === "verified") return <span className="text-sky-500 text-xs font-bold">✓ Verified</span>;
  if (badge === "basic_verified") return <span className="text-emerald-500 text-xs font-bold">✓ Basic</span>;
  return null;
}

function AuctionCard({ auction, onClick }: { auction: Auction; onClick: () => void }) {
  const gem = auction.gem;
  const firstImg = gem?.images?.find(i => i.media_type !== "video") ?? gem?.images?.[0];
  const imgUrl = firstImg?.image_url;
  const isVideo = firstImg?.media_type === "video";

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border cursor-pointer hover:shadow-lg transition-all group overflow-hidden ${
        auction.is_featured ? "border-violet-300 shadow-violet-50 shadow-md" : "border-border shadow-sm"
      }`}
    >
      {/* Image */}
      <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
        {imgUrl ? (
          isVideo ? (
            <div className="relative w-full h-full">
              <video src={imgUrl} muted preload="metadata" playsInline className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md">
                  <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor" className="ml-0.5 text-slate-700"><polygon points="2,1 9,5 2,9" /></svg>
                </div>
              </div>
            </div>
          ) : (
            <img src={imgUrl} alt={gem?.stone_type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">💎</div>
        )}
        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          {auction.is_featured && (
            <span className="bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">⭐ Premium</span>
          )}
          {auction.is_ending_soon && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">🔥 Ending Soon</span>
          )}
          {auction.is_trending && !auction.is_ending_soon && (
            <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">🔥 Trending</span>
          )}
        </div>
        {/* Bid count */}
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
          {auction.total_bids} bid{auction.total_bids !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="font-bold text-foreground text-base truncate">
          {gem ? `${gem.stone_type} — ${gem.carat}ct` : "Gemstone Auction"}
        </div>
        {gem && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{gem.origin} · {gem.treatment}</div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Current bid</div>
            <div className="text-lg font-extrabold text-primary">${auction.current_highest_bid.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Ends in</div>
            <CountdownTimer endTime={auction.end_time} compact className="text-sm" />
          </div>
        </div>

        {auction.seller && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-violet-200 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {auction.seller.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{auction.seller.company_name ?? auction.seller.name}</div>
            </div>
            <VerifyBadge badge={auction.seller.verification_badge} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function GemAuctionsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [stoneFilter, setStoneFilter] = useState("All");
  const [endingSoon, setEndingSoon] = useState(false);
  const [trending, setTrending] = useState(false);
  const [search, setSearch] = useState("");

  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ["auctions", stoneFilter, endingSoon, trending],
    queryFn: () =>
      api.getAuctions({
        status: "active",
        stone_type: stoneFilter !== "All" ? stoneFilter : undefined,
        ending_soon: endingSoon || undefined,
        trending: trending || undefined,
      }),
    refetchInterval: 8000,
  });

  const handleExpired = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["auctions"] });
  }, [queryClient]);

  const filtered = search.trim()
    ? auctions.filter((a) =>
        a.gem?.stone_type?.toLowerCase().includes(search.toLowerCase()) ||
        a.gem?.origin?.toLowerCase().includes(search.toLowerCase()) ||
        a.seller?.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.seller?.company_name?.toLowerCase().includes(search.toLowerCase())
      )
    : auctions;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-14 px-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full text-xs font-semibold mb-4">
          💎 Live Gem Auctions
        </div>
        <h1 className="text-4xl font-extrabold mb-3 tracking-tight">Gem Auctions</h1>
        <p className="text-violet-100 max-w-xl mx-auto text-sm">
          Bid on rare certified gemstones from verified dealers. Real-time competitive bidding — no reserve surprises.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search gemstone, origin, or seller…"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-foreground bg-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/60"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          {STONE_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStoneFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                stoneFilter === s
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-muted-foreground border-border hover:border-violet-300 hover:text-violet-600"
              }`}
            >
              {s}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setEndingSoon((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                endingSoon ? "bg-red-500 text-white border-red-500" : "bg-white text-muted-foreground border-border hover:text-red-500"
              }`}
            >
              🔥 Ending Soon
            </button>
            <button
              onClick={() => setTrending((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                trending ? "bg-orange-500 text-white border-orange-500" : "bg-white text-muted-foreground border-border hover:text-orange-500"
              }`}
            >
              📈 Trending
            </button>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="spinner mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Loading auctions…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <div className="text-5xl mb-4">🔔</div>
            <p className="font-semibold text-lg mb-1">No active auctions right now</p>
            <p className="text-sm">Check back soon — new auctions are added regularly by verified dealers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                onClick={() => navigate(`/gem-auctions/${auction.id}`)}
              />
            ))}
          </div>
        )}

        {/* Plan CTA */}
        <div className="mt-16 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-3">🏆</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Want to host your own auction?</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-5">
            Pro users get <strong>5 free standard auctions/month</strong>. Premium users get <strong>5 free featured auctions/month</strong> — displayed prominently to more buyers.
          </p>
          <button
            onClick={() => navigate("/plans")}
            className="px-6 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors"
          >
            View Plans →
          </button>
        </div>
      </div>
    </div>
  );
}
