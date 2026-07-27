import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { inventory, type Gemstone } from "./inventory.js";
import { messages } from "./messages.js";
import { saveAuctions, saveBids, saveMessages, saveInventory, loadPersistedAuctions, loadPersistedBids } from "../lib/persist.js";
import { logger } from "../lib/logger.js";
import { addNotification } from "../lib/notifications.js";
import { notifyAllUsersNewAuction } from "../lib/whatsapp.js";
import { crmProspects } from "./crm.js";

const router: IRouter = Router();

// ─── Data model ─────────────────────────────────────────────────────────────

export interface Auction {
  id: string;
  inventory_id: string;
  seller_id: string;
  auction_type: "standard" | "premium";
  starting_price: number;
  current_highest_bid: number;
  reserve_price: number | null;
  min_increment: number;
  start_time: string;
  end_time: string;
  status: "active" | "completed" | "cancelled";
  winner_id: string | null;
  total_bids: number;
  share_count: number;
  is_featured: boolean;
  created_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  user_id: string;
  bid_amount: number;
  created_at: string;
}

export const auctions: Auction[] = [];
export const bids: Bid[] = [];

// ─── Init from persistence ───────────────────────────────────────────────────

export async function initAuctions(): Promise<void> {
  const [persistedAuctions, persistedBids] = await Promise.all([
    loadPersistedAuctions(),
    loadPersistedBids(),
  ]);
  if (persistedAuctions.length > 0) {
    auctions.length = 0;
    auctions.push(...(persistedAuctions as Auction[]));
    logger.info({ count: auctions.length }, "auctions: loaded from persistence");
  }
  if (persistedBids.length > 0) {
    bids.length = 0;
    bids.push(...(persistedBids as Bid[]));
    logger.info({ count: bids.length }, "bids: loaded from persistence");
  }

  // Reconcile inventory: clear is_in_auction for gems whose auction no longer exists
  // (can happen if the server crashed before the auction was persisted to GCS)
  let staleCount = 0;
  for (const gem of inventory) {
    if (gem.is_in_auction) {
      const hasActiveAuction = auctions.some(
        (a) => a.inventory_id === gem.id && a.status === "active"
      );
      if (!hasActiveAuction) {
        gem.is_in_auction = false;
        gem.auction_id = null;
        staleCount++;
      }
    }
  }
  if (staleCount > 0) {
    saveInventory(inventory);
    logger.warn({ count: staleCount }, "auctions: cleared stale is_in_auction flags from inventory");
  }
}

// ─── Plan limits ─────────────────────────────────────────────────────────────

const PLAN_AUCTION_ALLOWANCE: Record<string, { type: "standard" | "premium"; limit: number } | null> = {
  basic: null,
  pro: { type: "standard", limit: 5 },
  premium: { type: "premium", limit: 5 },
};

function getMonthlyAuctionCount(sellerId: string, type: "standard" | "premium"): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return auctions.filter(
    (a) =>
      a.seller_id === sellerId &&
      a.auction_type === type &&
      a.created_at >= monthStart
  ).length;
}

// ─── Auto-end helper ─────────────────────────────────────────────────────────

function autoEndExpired(): void {
  const now = new Date().toISOString();
  for (const auction of auctions) {
    if (auction.status !== "active") continue;
    if (auction.end_time > now) continue;

    auction.status = "completed";
    const auctionBids = bids.filter((b) => b.auction_id === auction.id);
    const winner = auctionBids.reduce<Bid | null>((best, b) => {
      if (!best || b.bid_amount > best.bid_amount) return b;
      return best;
    }, null);
    auction.winner_id = winner?.user_id ?? null;

    if (winner) {
      const seller = users.find((u) => u.id === auction.seller_id);
      const gem = inventory.find((g) => g.id === auction.inventory_id);
      const gemName = gem?.stone_type ?? "Gemstone";
      const winnerUser = users.find((u) => u.id === winner.user_id);

      const systemMsg = {
        id: randomUUID(),
        sender_id: auction.seller_id,
        receiver_id: winner.user_id,
        message_text: `🎉 Congratulations! You won the Gem Auction for ${gemName} (${gem?.carat ?? "?"}ct) with a bid of $${winner.bid_amount.toLocaleString()}. Please message the seller to arrange payment and delivery.`,
        created_at: new Date().toISOString(),
        is_read: false,
        listing_id: auction.inventory_id,
      };
      messages.push(systemMsg);
      saveMessages(messages);

      addNotification(
        "new_user",
        "Auction Ended — Winner Selected",
        `${gemName} auction ended. Winner: ${winnerUser?.name ?? winner.user_id} with bid $${winner.bid_amount.toLocaleString()}.`,
        { entity_id: auction.id }
      );
    }

    const gem = inventory.find((g) => g.id === auction.inventory_id);
    if (gem) {
      gem.is_in_auction = false;
      gem.auction_id = null;
    }

    saveAuctions(auctions);
    logger.info({ auction_id: auction.id, winner_id: auction.winner_id }, "Auction auto-ended");
  }
}

// ─── Build response ──────────────────────────────────────────────────────────

function buildAuctionResponse(auction: Auction, includeGem = true) {
  const gem = includeGem ? inventory.find((g) => g.id === auction.inventory_id) : null;
  const seller = users.find((u) => u.id === auction.seller_id);
  const now = new Date();
  const endTime = new Date(auction.end_time);
  const msLeft = Math.max(0, endTime.getTime() - now.getTime());
  const isEndingSoon = msLeft > 0 && msLeft < 60 * 60 * 1000;
  const isTrending = auction.total_bids >= 5;

  return {
    ...auction,
    gem: gem
      ? {
          id: gem.id,
          stone_type: gem.stone_type,
          carat: gem.carat,
          origin: gem.origin,
          treatment: gem.treatment,
          color: gem.color,
          clarity: gem.clarity,
          images: gem.images,
          certificate_number: gem.certificate_number,
        }
      : null,
    seller: seller
      ? {
          id: seller.id,
          name: seller.name,
          company_name: seller.company_name ?? null,
          verification_badge: seller.verification_badge ?? "none",
          verification_status: seller.verification_status,
          logo_url: seller.logo_url,
          is_online: seller.is_online,
          city: seller.city ?? null,
          country: seller.country ?? null,
        }
      : null,
    ms_remaining: msLeft,
    is_ending_soon: isEndingSoon,
    is_trending: isTrending,
  };
}

// ─── GET /gem-auctions ───────────────────────────────────────────────────────

router.get("/gem-auctions", (req, res) => {
  autoEndExpired();
  const { status = "active", stone_type, min_price, max_price, ending_soon, trending, featured, limit } = req.query as Record<string, string | undefined>;

  let result = auctions.filter((a) => (status === "all" ? true : a.status === status));

  if (stone_type) {
    result = result.filter((a) => {
      const gem = inventory.find((g) => g.id === a.inventory_id);
      return gem?.stone_type?.toLowerCase().includes(stone_type.toLowerCase());
    });
  }

  if (min_price) {
    const min = parseFloat(min_price);
    result = result.filter((a) => a.current_highest_bid >= min || a.starting_price >= min);
  }

  if (max_price) {
    const max = parseFloat(max_price);
    result = result.filter((a) => a.current_highest_bid <= max || a.starting_price <= max);
  }

  const now = new Date();
  if (ending_soon === "true") {
    result = result.filter((a) => {
      const ms = new Date(a.end_time).getTime() - now.getTime();
      return ms > 0 && ms < 60 * 60 * 1000;
    });
  }
  if (trending === "true") {
    result = result.filter((a) => a.total_bids >= 5);
  }
  if (featured === "true") {
    result = result.filter((a) => a.is_featured);
  }

  result.sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    return new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
  });

  const limitNum = limit ? Math.min(parseInt(limit), 100) : 50;
  result = result.slice(0, limitNum);

  res.json(result.map((a) => buildAuctionResponse(a)));
});

// ─── GET /gem-auctions/:id ───────────────────────────────────────────────────

router.get("/gem-auctions/:id", (req, res) => {
  autoEndExpired();
  const auction = auctions.find((a) => a.id === req.params["id"]);
  if (!auction) {
    res.status(404).json({ error: "Auction not found" });
    return;
  }
  const auctionBids = bids
    .filter((b) => b.auction_id === auction.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((b) => {
      const bidder = users.find((u) => u.id === b.user_id);
      return {
        ...b,
        bidder_name: bidder?.name ?? "Anonymous",
        bidder_company: bidder?.company_name ?? null,
      };
    });

  res.json({ ...buildAuctionResponse(auction), bids: auctionBids });
});

// ─── POST /gem-auctions/create ───────────────────────────────────────────────

router.post("/gem-auctions/create", (req, res) => {
  autoEndExpired();
  const { seller_id, inventory_id, starting_price, reserve_price, min_increment = 50, duration_hours = 72 } = req.body as {
    seller_id?: string;
    inventory_id?: string;
    starting_price?: number;
    reserve_price?: number;
    min_increment?: number;
    duration_hours?: number;
  };

  if (!seller_id || !inventory_id || typeof starting_price !== "number") {
    res.status(400).json({ error: "seller_id, inventory_id, and starting_price are required" });
    return;
  }

  const seller = users.find((u) => u.id === seller_id);
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  if (seller.is_blocked) {
    res.status(403).json({ error: "Account is blocked" });
    return;
  }

  const verifiedStatuses = ["basic_verified", "verified", "legacy_verified"];
  if (!verifiedStatuses.includes(seller.verification_status)) {
    res.status(403).json({ error: "Only verified users can create auctions" });
    return;
  }

  const plan = seller.subscription_plan ?? "basic";
  const allowance = PLAN_AUCTION_ALLOWANCE[plan];
  if (!allowance) {
    res.status(403).json({ error: "Your plan does not include auctions. Upgrade to Pro or Premium." });
    return;
  }

  const currentMonthCount = getMonthlyAuctionCount(seller_id, allowance.type);
  if (currentMonthCount >= allowance.limit) {
    res.status(403).json({
      error: `You have used all ${allowance.limit} ${allowance.type} auctions for this month. Monthly limit resets on the 1st.`,
      monthly_limit: allowance.limit,
      used: currentMonthCount,
    });
    return;
  }

  const gem = inventory.find((g) => g.id === inventory_id);
  if (!gem) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (gem.seller_id !== seller_id) {
    res.status(403).json({ error: "You can only auction your own listings" });
    return;
  }
  if (gem.is_in_auction) {
    res.status(409).json({ error: "This listing is already in an active auction" });
    return;
  }
  if (gem.listing_status === "removed") {
    res.status(400).json({ error: "Cannot auction a removed listing" });
    return;
  }

  if (starting_price <= 0) {
    res.status(400).json({ error: "starting_price must be greater than 0" });
    return;
  }

  const hours = Math.min(Math.max(duration_hours, 1), 720);
  const now = new Date();
  const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const auction: Auction = {
    id: randomUUID(),
    inventory_id,
    seller_id,
    auction_type: allowance.type,
    starting_price,
    current_highest_bid: starting_price,
    reserve_price: typeof reserve_price === "number" && reserve_price > 0 ? reserve_price : null,
    min_increment: typeof min_increment === "number" && min_increment > 0 ? min_increment : 50,
    start_time: now.toISOString(),
    end_time: endTime.toISOString(),
    status: "active",
    winner_id: null,
    total_bids: 0,
    share_count: 0,
    is_featured: allowance.type === "premium",
    created_at: now.toISOString(),
  };

  auctions.push(auction);

  gem.is_in_auction = true;
  gem.auction_id = auction.id;

  saveAuctions(auctions);

  addNotification(
    "new_user",
    "New Auction Created",
    `${seller.name} started a ${allowance.type} auction for ${gem.stone_type} (${gem.carat}ct). Ends ${endTime.toDateString()}.`,
    { entity_id: auction.id, user_id: seller_id }
  );

  const siteBase = process.env.SITE_URL ?? "https://luckybirthstone.com";
  notifyAllUsersNewAuction(
    gem.stone_type, gem.carat, starting_price, endTime.toISOString(),
    `${siteBase}/gem-auctions/${auction.id}`,
    users,
    crmProspects
  ).catch((err) => logger.error({ err }, "[WhatsApp] Failed to broadcast new auction"));

  logger.info({ auction_id: auction.id, seller_id, inventory_id, type: allowance.type }, "Auction created");
  res.status(201).json(buildAuctionResponse(auction));
});

// ─── POST /gem-auctions/bid ───────────────────────────────────────────────────

router.post("/gem-auctions/bid", (req, res) => {
  autoEndExpired();
  const { auction_id, user_id, bid_amount } = req.body as {
    auction_id?: string;
    user_id?: string;
    bid_amount?: number;
  };

  if (!auction_id || !user_id || typeof bid_amount !== "number") {
    res.status(400).json({ error: "auction_id, user_id, and bid_amount are required" });
    return;
  }

  const auction = auctions.find((a) => a.id === auction_id);
  if (!auction) {
    res.status(404).json({ error: "Auction not found" });
    return;
  }
  if (auction.status !== "active") {
    res.status(400).json({ error: "Auction is no longer active" });
    return;
  }
  if (new Date(auction.end_time) <= new Date()) {
    autoEndExpired();
    res.status(400).json({ error: "Auction has ended" });
    return;
  }
  if (auction.seller_id === user_id) {
    res.status(403).json({ error: "Sellers cannot bid on their own auction" });
    return;
  }

  const bidder = users.find((u) => u.id === user_id);
  if (!bidder) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (bidder.is_blocked) {
    res.status(403).json({ error: "Account is blocked" });
    return;
  }
  const verifiedStatuses = ["basic_verified", "verified", "legacy_verified"];
  if (!verifiedStatuses.includes(bidder.verification_status)) {
    res.status(403).json({ error: "Only verified users can bid" });
    return;
  }

  const minBid = auction.current_highest_bid + auction.min_increment;
  if (bid_amount < minBid) {
    res.status(400).json({
      error: `Bid must be at least $${minBid.toLocaleString()} (current bid + $${auction.min_increment} increment)`,
      min_bid: minBid,
    });
    return;
  }

  const bid: Bid = {
    id: randomUUID(),
    auction_id,
    user_id,
    bid_amount,
    created_at: new Date().toISOString(),
  };
  bids.push(bid);
  auction.current_highest_bid = bid_amount;
  auction.total_bids += 1;

  saveAuctions(auctions);
  saveBids(bids);

  const gem = inventory.find((g) => g.id === auction.inventory_id);
  addNotification(
    "new_user",
    "New Bid Placed",
    `${bidder.name} bid $${bid_amount.toLocaleString()} on ${gem?.stone_type ?? "gemstone"} auction.`,
    { entity_id: auction_id, user_id: auction.seller_id }
  );

  logger.info({ auction_id, user_id, bid_amount }, "Bid placed");
  res.status(201).json({ bid, current_highest_bid: auction.current_highest_bid, total_bids: auction.total_bids });
});

// ─── POST /gem-auctions/:id/share ────────────────────────────────────────────

router.post("/gem-auctions/:id/share", (req, res) => {
  const auction = auctions.find((a) => a.id === req.params["id"]);
  if (!auction) {
    res.status(404).json({ error: "Auction not found" });
    return;
  }
  auction.share_count += 1;
  saveAuctions(auctions);
  res.json({ success: true, share_count: auction.share_count });
});

// ─── POST /gem-auctions/:id/cancel ───────────────────────────────────────────

router.post("/gem-auctions/:id/cancel", (req, res) => {
  const { seller_id } = req.body as { seller_id?: string };
  const auction = auctions.find((a) => a.id === req.params["id"]);
  if (!auction) {
    res.status(404).json({ error: "Auction not found" });
    return;
  }
  if (auction.seller_id !== seller_id) {
    res.status(403).json({ error: "Only the seller can cancel this auction" });
    return;
  }
  if (auction.status !== "active") {
    res.status(400).json({ error: "Only active auctions can be cancelled" });
    return;
  }
  if (auction.total_bids > 0) {
    res.status(400).json({ error: "Cannot cancel an auction that has received bids" });
    return;
  }

  auction.status = "cancelled";
  const gem = inventory.find((g) => g.id === auction.inventory_id);
  if (gem) {
    gem.is_in_auction = false;
    gem.auction_id = null;
  }
  saveAuctions(auctions);
  logger.info({ auction_id: auction.id }, "Auction cancelled");
  res.json({ success: true });
});

export default router;
