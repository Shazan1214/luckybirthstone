import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import CountdownTimer from "@/components/CountdownTimer";

function VerifyBadge({ badge }: { badge: string }) {
  if (badge === "legacy_verified") return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">★ Legacy Verified</span>;
  if (badge === "verified") return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-700 text-xs font-bold rounded-full">✓ Verified</span>;
  if (badge === "basic_verified") return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">✓ Basic Verified</span>;
  return null;
}

interface Props {
  params: { id: string };
}

export default function GemAuctionDetailPage({ params }: Props) {
  const auctionId = params.id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const userId = localStorage.getItem("gw_user_id") ?? "";

  const [activeImg, setActiveImg] = useState(0);
  const [bidAmount, setBidAmount] = useState("");
  const [bidError, setBidError] = useState("");
  const [bidSuccess, setBidSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: auction, isLoading, error } = useQuery({
    queryKey: ["auction", auctionId],
    queryFn: () => api.getAuction(auctionId),
    refetchInterval: 8000,
  });

  const bidMutation = useMutation({
    mutationFn: (amount: number) =>
      api.placeBid({ auction_id: auctionId, user_id: userId, bid_amount: amount }),
    onSuccess: () => {
      setBidAmount("");
      setBidError("");
      setBidSuccess(true);
      setTimeout(() => setBidSuccess(false), 3000);
      void queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
    },
    onError: (err: Error) => {
      setBidError(err.message ?? "Failed to place bid");
    },
  });

  const shareMutation = useMutation({
    mutationFn: () => api.shareAuction(auctionId),
  });

  function handleBid() {
    setBidError("");
    const amount = parseFloat(bidAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setBidError("Please enter a valid bid amount");
      return;
    }
    bidMutation.mutate(amount);
  }

  function generateShareText() {
    if (!auction?.gem) return "";
    const gem = auction.gem;
    const msLeft = Math.max(0, new Date(auction.end_time).getTime() - Date.now());
    const sLeft = Math.floor(msLeft / 1000);
    const h = Math.floor(sLeft / 3600);
    const m = Math.floor((sLeft % 3600) / 60);
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
    const url = `${window.location.origin}/gem-auctions/${auctionId}`;
    return `💎 Live Gem Auction!\n\n${gem.stone_type} | ${gem.carat}ct\nCurrent Bid: $${auction.current_highest_bid.toLocaleString()}\nEnds in: ${timeStr}\n\nBid now: ${url}`;
  }

  function handleShare(channel: "whatsapp" | "email" | "copy") {
    const text = generateShareText();
    shareMutation.mutate();
    if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } else if (channel === "email") {
      window.open(
        `mailto:?subject=${encodeURIComponent("💎 Live Gem Auction!")}&body=${encodeURIComponent(text)}`,
        "_blank"
      );
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/gem-auctions/${auctionId}`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <div>
          <div className="text-5xl mb-4">💎</div>
          <p className="font-semibold text-lg mb-2">Auction not found</p>
          <button onClick={() => navigate("/gem-auctions")} className="text-sm text-primary hover:underline">
            ← Back to auctions
          </button>
        </div>
      </div>
    );
  }

  const gem = auction.gem;
  const seller = auction.seller;
  const isActive = auction.status === "active";
  const isOwner = userId === auction.seller_id;
  const minBid = auction.current_highest_bid + auction.min_increment;
  const images = gem?.images ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => navigate("/gem-auctions")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          ← Back to Auctions
        </button>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left — Images */}
          <div>
            <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 aspect-square mb-3">
              {images.length > 0 ? (
                images[activeImg]?.media_type === "video" ? (
                  <video
                    key={images[activeImg]?.image_url}
                    src={images[activeImg]?.image_url}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={images[activeImg]?.image_url}
                    alt={gem?.stone_type}
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">💎</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors relative ${
                      activeImg === i ? "border-primary" : "border-border"
                    }`}
                  >
                    {img.media_type === "video" ? (
                      <>
                        <video src={img.image_url} muted preload="metadata" playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="w-5 h-5 bg-white/80 rounded-full flex items-center justify-center">
                            <svg width="7" height="7" viewBox="0 0 10 10" fill="currentColor" className="ml-0.5 text-slate-700"><polygon points="2,1 9,5 2,9" /></svg>
                          </div>
                        </div>
                      </>
                    ) : (
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Social Sharing */}
            <div className="mt-5 bg-white border border-border rounded-2xl p-4">
              <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                📤 Share this Auction
                <span className="text-xs text-muted-foreground font-normal">({auction.share_count} shares)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleShare("whatsapp")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500 text-white rounded-xl text-xs font-semibold hover:bg-green-600 transition-colors"
                >
                  <span>📱</span> WhatsApp
                </button>
                <button
                  onClick={() => handleShare("email")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500 text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-colors"
                >
                  <span>✉️</span> Email
                </button>
                <button
                  onClick={() => handleShare("copy")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-secondary text-foreground rounded-xl text-xs font-semibold hover:bg-secondary/80 transition-colors"
                >
                  {copied ? "✓ Copied!" : "🔗 Copy Link"}
                </button>
              </div>
            </div>
          </div>

          {/* Right — Details */}
          <div className="flex flex-col gap-5">
            {/* Status */}
            {auction.is_featured && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-full self-start">
                ⭐ Premium Auction
              </div>
            )}
            {!isActive && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full self-start ${
                auction.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}>
                {auction.status === "completed" ? "✓ Auction Ended" : "✕ Cancelled"}
              </div>
            )}

            <div>
              <h1 className="text-3xl font-extrabold text-foreground mb-1">
                {gem ? `${gem.stone_type}` : "Gemstone Auction"}
              </h1>
              {gem && (
                <p className="text-muted-foreground">
                  {gem.carat}ct · {gem.origin} · {gem.treatment} treatment
                  {gem.color && ` · Color: ${gem.color}`}
                  {gem.clarity && ` · Clarity: ${gem.clarity}`}
                </p>
              )}
              {gem && (
                <p className="text-xs text-muted-foreground mt-1">Certificate: {gem.certificate_number}</p>
              )}
            </div>

            {/* Bid status */}
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Starting Price</div>
                  <div className="font-bold text-foreground">${auction.starting_price.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Current Bid</div>
                  <div className="text-xl font-extrabold text-primary">${auction.current_highest_bid.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Bids</div>
                  <div className="font-bold text-foreground">{auction.total_bids}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-muted-foreground">Time left: </span>
                  {isActive ? (
                    <CountdownTimer
                      endTime={auction.end_time}
                      onExpired={() => queryClient.invalidateQueries({ queryKey: ["auction", auctionId] })}
                      className="text-sm font-bold"
                    />
                  ) : (
                    <span className="font-semibold text-muted-foreground">Ended</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {auction.is_ending_soon && isActive && (
                    <span className="text-red-600 text-xs font-bold animate-pulse">🔥 Ending Soon!</span>
                  )}
                  {auction.is_trending && (
                    <span className="text-orange-500 text-xs font-bold">📈 Trending</span>
                  )}
                </div>
              </div>
              {auction.reserve_price && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Reserve price: ${auction.reserve_price.toLocaleString()}
                </div>
              )}
            </div>

            {/* Place Bid */}
            {isActive && !isOwner && userId && (
              <div className="bg-white border border-border rounded-2xl p-5">
                <h3 className="font-bold text-foreground mb-3">Place Your Bid</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Minimum bid: <strong>${minBid.toLocaleString()}</strong> (current + ${auction.min_increment} increment)
                </p>
                {bidSuccess && (
                  <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-semibold">
                    🎉 Bid placed successfully! You're currently the highest bidder.
                  </div>
                )}
                {bidError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {bidError}
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={String(minBid)}
                      min={minBid}
                      step="1"
                      className="w-full pl-7 pr-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <button
                    onClick={handleBid}
                    disabled={bidMutation.isPending}
                    className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
                  >
                    {bidMutation.isPending ? "Placing…" : "Place Bid"}
                  </button>
                </div>
              </div>
            )}

            {isActive && !userId && (
              <div className="bg-slate-50 border border-border rounded-2xl p-5 text-center">
                <p className="text-muted-foreground text-sm mb-3">Sign in to place a bid</p>
                <button
                  onClick={() => navigate("/")}
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90"
                >
                  Sign In to Bid →
                </button>
              </div>
            )}

            {isActive && isOwner && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
                You are the seller for this auction. Sellers cannot bid on their own auction.
              </div>
            )}

            {/* Winner */}
            {auction.status === "completed" && auction.winner_id && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <div className="font-bold text-emerald-800 mb-1">🎉 Auction Completed</div>
                <p className="text-sm text-emerald-700">
                  Winning bid: <strong>${auction.current_highest_bid.toLocaleString()}</strong>
                  {userId === auction.winner_id && " — Congratulations, you won! Check your messages to connect with the seller."}
                  {isOwner && " — Check your messages to connect with the winner."}
                </p>
              </div>
            )}

            {/* Seller */}
            {seller && (
              <div
                className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate(`/company/${seller.id}`)}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-violet-200 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                  {seller.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-sm truncate">{seller.company_name ?? seller.name}</div>
                  {seller.city && (
                    <div className="text-xs text-muted-foreground">{[seller.city, seller.country].filter(Boolean).join(", ")}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <VerifyBadge badge={seller.verification_badge} />
                    {seller.is_online && <span className="text-xs text-emerald-600 font-medium">● Online</span>}
                  </div>
                </div>
                <span className="text-muted-foreground text-sm">→</span>
              </div>
            )}
          </div>
        </div>

        {/* Bid History */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-foreground mb-4">Bid History ({auction.bids.length})</h2>
          {auction.bids.length === 0 ? (
            <div className="bg-white border border-border rounded-2xl p-8 text-center text-muted-foreground text-sm">
              No bids yet. Be the first to bid!
            </div>
          ) : (
            <div className="bg-white border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {auction.bids.map((bid, i) => (
                <div key={bid.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-violet-600 text-white" : "bg-secondary text-muted-foreground"}`}>
                      {i === 0 ? "★" : i + 1}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-foreground">{bid.bidder_name}</div>
                      {bid.bidder_company && <div className="text-xs text-muted-foreground">{bid.bidder_company}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${i === 0 ? "text-violet-600" : "text-foreground"}`}>
                      ${bid.bid_amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(bid.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
