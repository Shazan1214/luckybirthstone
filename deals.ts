import { Router } from "express";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { applyTrustScore } from "../lib/trustScore.js";
import { addCredits } from "./credits.js";
import { emitActivity } from "./activities.js";
import { saveDeals, loadPersistedDeals } from "../lib/persist.js";
import { saveUsers } from "../lib/persist.js";
import { logger } from "../lib/logger.js";

const router = Router();

export interface Deal {
  id: string;
  buyer_id: string;
  seller_id: string;
  gem_id: string | null;
  amount_usd: number;
  description: string;
  status: "proposed" | "confirmed" | "completed" | "cancelled" | "disputed";
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
}

export const deals: Deal[] = [];

export async function loadDeals(): Promise<void> {
  const saved = await loadPersistedDeals();
  if (saved.length > 0) deals.push(...(saved as Deal[]));
  logger.info({ count: deals.length }, "deals: loaded");
}

function save() { saveDeals(deals); }

function enrichDeal(d: Deal) {
  const buyer = users.find((u) => u.id === d.buyer_id);
  const seller = users.find((u) => u.id === d.seller_id);
  return {
    ...d,
    buyer_name: buyer?.company_name ?? buyer?.name ?? "Unknown",
    seller_name: seller?.company_name ?? seller?.name ?? "Unknown",
  };
}

// POST /deals — buyer proposes a deal
router.post("/deals", (req, res) => {
  const { buyer_id, seller_id, gem_id, amount_usd, description } = req.body as {
    buyer_id?: string; seller_id?: string; gem_id?: string | null;
    amount_usd?: number; description?: string;
  };
  if (!buyer_id || !seller_id || !amount_usd || !description?.trim()) {
    return res.status(400).json({ error: "buyer_id, seller_id, amount_usd, and description are required" });
  }
  if (buyer_id === seller_id) return res.status(400).json({ error: "Buyer and seller must be different users" });
  if (!users.find((u) => u.id === buyer_id)) return res.status(404).json({ error: "Buyer not found" });
  if (!users.find((u) => u.id === seller_id)) return res.status(404).json({ error: "Seller not found" });

  const deal: Deal = {
    id: randomUUID(),
    buyer_id,
    seller_id,
    gem_id: gem_id ?? null,
    amount_usd,
    description: description.trim(),
    status: "proposed",
    notes: null,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    completed_at: null,
  };
  deals.push(deal);
  save();
  logger.info({ id: deal.id, buyer: buyer_id, seller: seller_id }, "deal: proposed");
  return res.status(201).json(enrichDeal(deal));
});

// GET /deals/my/:userId — all deals for a user
router.get("/deals/my/:userId", (req, res) => {
  const uid = req.params.userId;
  const list = deals
    .filter((d) => d.buyer_id === uid || d.seller_id === uid)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(enrichDeal);
  return res.json(list);
});

// PATCH /deals/:id/confirm — seller confirms deal
router.patch("/deals/:id/confirm", (req, res) => {
  const deal = deals.find((d) => d.id === req.params.id);
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  const { user_id } = req.body as { user_id?: string };
  if (deal.seller_id !== user_id) return res.status(403).json({ error: "Only the seller can confirm" });
  if (deal.status !== "proposed") return res.status(400).json({ error: `Cannot confirm a deal with status: ${deal.status}` });
  deal.status = "confirmed";
  deal.confirmed_at = new Date().toISOString();
  save();
  return res.json(enrichDeal(deal));
});

// PATCH /deals/:id/complete — buyer marks deal as completed
router.patch("/deals/:id/complete", (req, res) => {
  const deal = deals.find((d) => d.id === req.params.id);
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  const { user_id } = req.body as { user_id?: string };
  if (deal.buyer_id !== user_id) return res.status(403).json({ error: "Only the buyer can mark as complete" });
  if (deal.status !== "confirmed") return res.status(400).json({ error: "Deal must be confirmed before completing" });

  deal.status = "completed";
  deal.completed_at = new Date().toISOString();

  // Update both users' stats
  const buyer = users.find((u) => u.id === deal.buyer_id);
  const seller = users.find((u) => u.id === deal.seller_id);
  if (buyer) {
    buyer.deals_completed = (buyer.deals_completed ?? 0) + 1;
    buyer.on_time_payments = (buyer.on_time_payments ?? 0) + 1;
    applyTrustScore(buyer);
    addCredits(buyer.id, 10, "Deal completed", deal.id);
    void emitActivity(buyer.id, "deal_completed", { deal_id: deal.id, amount_usd: deal.amount_usd, counterparty: deal.seller_id });
  }
  if (seller) {
    seller.deals_completed = (seller.deals_completed ?? 0) + 1;
    applyTrustScore(seller);
    addCredits(seller.id, 10, "Deal completed", deal.id);
    void emitActivity(seller.id, "deal_completed", { deal_id: deal.id, amount_usd: deal.amount_usd, counterparty: deal.buyer_id });
  }
  saveUsers(users);
  save();
  logger.info({ id: deal.id }, "deal: completed");
  return res.json(enrichDeal(deal));
});

// PATCH /deals/:id/cancel — either party can cancel
router.patch("/deals/:id/cancel", (req, res) => {
  const deal = deals.find((d) => d.id === req.params.id);
  if (!deal) return res.status(404).json({ error: "Deal not found" });
  const { user_id, notes } = req.body as { user_id?: string; notes?: string };
  if (deal.buyer_id !== user_id && deal.seller_id !== user_id) return res.status(403).json({ error: "Not your deal" });
  if (["completed", "cancelled"].includes(deal.status)) return res.status(400).json({ error: `Cannot cancel a ${deal.status} deal` });
  deal.status = "cancelled";
  if (notes) deal.notes = notes;
  save();
  return res.json(enrichDeal(deal));
});

export default router;
