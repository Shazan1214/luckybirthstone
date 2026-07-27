import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { inventory } from "./inventory.js";
import { users } from "./users.js";
import { saveApprovals, savePartnerListings, loadPersistedApprovals, loadPersistedPartnerListings, saveTradeContacts } from "../lib/persist.js";
import { logger } from "../lib/logger.js";
import { tradeContacts } from "./trader-crm.js";

const router: IRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "in_approval"
  | "sold"
  | "returned"
  | "expired"
  | "recalled";

export interface ApprovalRequest {
  id: string;
  listing_id: string;
  requester_id: string;
  status: ApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  expiry_date?: string;
  duration_days?: number;
  notes?: string;
  selling_price?: number;
  final_price?: number;
  extension_requested?: boolean;
  extension_days?: number;
  // Manual / off-platform approvals
  is_manual?: boolean;
  direction?: "sent" | "received"; // "sent" = owner sent out; "received" = user holds someone else's stone
  counterparty_name?: string | null;
  stone_type_manual?: string | null;
  stone_carat_manual?: number | null;
  stone_price_manual?: number | null;
  stone_currency_manual?: string | null;
  collected_date?: string | null;  // date stone was collected / handed over
  returned_date?: string | null;   // date stone was returned
  created_at: string;
  updated_at: string;
}

export interface PartnerListing {
  id: string;
  original_listing_id: string;
  owner_id: string;
  partner_id: string;
  approval_request_id: string;
  selling_price: number;
  selling_currency: string;
  is_active: boolean;
  created_at: string;
}

// ─── In-memory stores ─────────────────────────────────────────────────────────

export const approvalRequests: ApprovalRequest[] = [];
export const partnerListings: PartnerListing[] = [];

export async function loadApprovals(): Promise<void> {
  const saved = await loadPersistedApprovals();
  if (saved.length > 0) approvalRequests.push(...(saved as ApprovalRequest[]));
  logger.info({ count: approvalRequests.length }, "approvals: loaded");
}

export async function loadPartnerListings(): Promise<void> {
  const saved = await loadPersistedPartnerListings();
  if (saved.length > 0) partnerListings.push(...(saved as PartnerListing[]));
  logger.info({ count: partnerListings.length }, "partnerListings: loaded");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expireStale(): void {
  const now = new Date();
  for (const req of approvalRequests) {
    if (
      req.status === "in_approval" &&
      req.expiry_date &&
      new Date(req.expiry_date) < now
    ) {
      req.status = "expired";
      req.updated_at = now.toISOString();
    }
  }
}

function activePartnersForListing(listingId: string): number {
  return approvalRequests.filter(
    (r) => r.listing_id === listingId && r.status === "in_approval"
  ).length;
}

function allocatedQuantity(listingId: string): number {
  return approvalRequests.filter(
    (r) => r.listing_id === listingId && r.status === "in_approval"
  ).length;
}

function snapUser(id: string) {
  const u = users.find((u) => u.id === id);
  if (!u) return null;
  return { id: u.id, name: u.name, company_name: u.company_name ?? u.name, logo_url: u.logo_url ?? null };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /approvals/incoming — owner sees requests on their listings + manual "sent" entries
router.get("/approvals/incoming", (req, res) => {
  const { owner_id } = req.query as { owner_id?: string };
  if (!owner_id) {
    res.status(400).json({ error: "owner_id is required" });
    return;
  }
  expireStale();

  const ownerListingIds = new Set(inventory.filter((g) => g.seller_id === owner_id).map((g) => g.id));
  const results = approvalRequests
    .filter((r) => ownerListingIds.has(r.listing_id) || (r.is_manual && r.direction === "sent" && r.approved_by === owner_id))
    .map((r) => {
      if (r.is_manual) return { ...r, requester: null, listing_snapshot: null };
      const gem = inventory.find((g) => g.id === r.listing_id);
      return {
        ...r,
        requester: snapUser(r.requester_id),
        listing_snapshot: gem
          ? { id: gem.id, stone_type: gem.stone_type, carat: gem.carat, price: gem.price, currency: gem.currency, images: gem.images.slice(0, 1) }
          : null,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  res.json(results);
});

// GET /approvals/mine — partner sees their own approval requests + manual "received" entries
router.get("/approvals/mine", (req, res) => {
  const { user_id } = req.query as { user_id?: string };
  if (!user_id) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }
  expireStale();

  const results = approvalRequests
    .filter((r) => r.requester_id === user_id || (r.is_manual && r.direction === "received" && r.requester_id === user_id))
    .map((r) => {
      if (r.is_manual) return { ...r, owner: null, listing_snapshot: null };
      const gem = inventory.find((g) => g.id === r.listing_id);
      const owner = gem ? snapUser(gem.seller_id) : null;
      return {
        ...r,
        owner,
        listing_snapshot: gem
          ? {
              id: gem.id,
              stone_type: gem.stone_type,
              carat: gem.carat,
              price: gem.price,
              currency: gem.currency,
              images: gem.images.slice(0, 1),
              min_price: gem.min_price ?? null,
              approval_duration_days: gem.approval_duration_days ?? 30,
            }
          : null,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  res.json(results);
});

// GET /approvals/listing/:listing_id — see all requests for a specific listing (owner only)
router.get("/approvals/listing/:listing_id", (req, res) => {
  const { owner_id } = req.query as { owner_id?: string };
  const listingId = req.params["listing_id"]!;
  const gem = inventory.find((g) => g.id === listingId);
  if (!gem) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (owner_id && gem.seller_id !== owner_id) {
    res.status(403).json({ error: "Not your listing" });
    return;
  }
  expireStale();

  const results = approvalRequests
    .filter((r) => r.listing_id === listingId)
    .map((r) => ({ ...r, requester: snapUser(r.requester_id) }));
  res.json({ requests: results, active_partners: activePartnersForListing(listingId) });
});

// POST /approvals/request — partner requests item on approval
router.post("/approvals/request", (req, res) => {
  const { listing_id, requester_id, notes, duration_days } = req.body as Partial<{
    listing_id: string;
    requester_id: string;
    notes: string;
    duration_days: number;
  }>;

  if (!listing_id || !requester_id) {
    res.status(400).json({ error: "listing_id and requester_id are required" });
    return;
  }

  const gem = inventory.find((g) => g.id === listing_id);
  if (!gem || gem.listing_status === "removed") {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (!gem.approval_enabled) {
    res.status(400).json({ error: "This listing is not available on approval basis" });
    return;
  }
  if (gem.seller_id === requester_id) {
    res.status(400).json({ error: "You cannot request your own listing on approval" });
    return;
  }

  expireStale();

  // Check existing pending/active request
  const existing = approvalRequests.find(
    (r) => r.listing_id === listing_id && r.requester_id === requester_id && ["pending", "in_approval"].includes(r.status)
  );
  if (existing) {
    res.status(400).json({ error: "You already have a pending or active approval request for this listing" });
    return;
  }

  // Check max_partners capacity
  const maxPartners = gem.max_partners ?? 1;
  if (activePartnersForListing(listing_id) >= maxPartners) {
    res.status(400).json({ error: "This listing has reached its maximum number of active approvals" });
    return;
  }

  // Check quantity capacity
  if (gem.quantity != null) {
    if (allocatedQuantity(listing_id) >= gem.quantity) {
      res.status(400).json({ error: "All quantity is currently allocated to other partners" });
      return;
    }
  }

  const now = new Date().toISOString();
  const newRequest: ApprovalRequest = {
    id: randomUUID(),
    listing_id,
    requester_id,
    status: "pending",
    duration_days: duration_days ?? gem.approval_duration_days ?? 30,
    notes: notes ?? undefined,
    created_at: now,
    updated_at: now,
  };

  approvalRequests.push(newRequest);
  saveApprovals(approvalRequests);

  res.status(201).json({ ...newRequest, listing_snapshot: { stone_type: gem.stone_type, carat: gem.carat } });
});

// PUT /approvals/:id/approve — owner approves a request
router.put("/approvals/:id/approve", (req, res) => {
  const { owner_id } = req.body as Partial<{ owner_id: string }>;
  const request = approvalRequests.find((r) => r.id === req.params["id"]);
  if (!request) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }
  const gem = inventory.find((g) => g.id === request.listing_id);
  if (!gem || gem.seller_id !== owner_id) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  if (request.status !== "pending") {
    res.status(400).json({ error: `Cannot approve a request with status '${request.status}'` });
    return;
  }

  expireStale();

  const durationDays = request.duration_days ?? gem.approval_duration_days ?? 30;
  const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  request.status = "in_approval";
  request.approved_by = owner_id;
  request.approved_at = now;
  request.expiry_date = expiryDate;
  request.updated_at = now;

  saveApprovals(approvalRequests);
  res.json(request);
});

// PUT /approvals/:id/reject — owner rejects a request
router.put("/approvals/:id/reject", (req, res) => {
  const { owner_id } = req.body as Partial<{ owner_id: string }>;
  const request = approvalRequests.find((r) => r.id === req.params["id"]);
  if (!request) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }
  const gem = inventory.find((g) => g.id === request.listing_id);
  if (!gem || gem.seller_id !== owner_id) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  if (!["pending"].includes(request.status)) {
    res.status(400).json({ error: `Cannot reject a request with status '${request.status}'` });
    return;
  }

  request.status = "rejected";
  request.updated_at = new Date().toISOString();
  saveApprovals(approvalRequests);
  res.json(request);
});

// PUT /approvals/:id/return — partner returns item
router.put("/approvals/:id/return", (req, res) => {
  const { user_id } = req.body as Partial<{ user_id: string }>;
  const request = approvalRequests.find((r) => r.id === req.params["id"]);
  if (!request) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }
  if (request.requester_id !== user_id) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  if (request.status !== "in_approval") {
    res.status(400).json({ error: `Cannot return an item with status '${request.status}'` });
    return;
  }

  request.status = "returned";
  request.updated_at = new Date().toISOString();

  // Deactivate any partner listings for this approval
  for (const pl of partnerListings) {
    if (pl.approval_request_id === request.id) {
      pl.is_active = false;
    }
  }

  saveApprovals(approvalRequests);
  savePartnerListings(partnerListings);
  res.json(request);
});

// PUT /approvals/:id/sell — partner marks item as sold
router.put("/approvals/:id/sell", (req, res) => {
  const { user_id, final_price } = req.body as Partial<{ user_id: string; final_price: number }>;
  const request = approvalRequests.find((r) => r.id === req.params["id"]);
  if (!request) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }
  if (request.requester_id !== user_id) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  if (request.status !== "in_approval") {
    res.status(400).json({ error: `Cannot mark as sold — current status is '${request.status}'` });
    return;
  }

  const gem = inventory.find((g) => g.id === request.listing_id);
  if (!gem) {
    res.status(404).json({ error: "Original listing not found" });
    return;
  }

  request.status = "sold";
  request.final_price = final_price ?? undefined;
  request.updated_at = new Date().toISOString();

  // Update original listing status
  gem.listing_status = "removed";

  // Deactivate all partner listings for this item (prevent double sale)
  for (const pl of partnerListings) {
    if (pl.original_listing_id === gem.id) {
      pl.is_active = false;
    }
  }
  // Cascade-reject any other pending/active approvals for same listing
  for (const r of approvalRequests) {
    if (r.listing_id === gem.id && r.id !== request.id && ["pending", "in_approval"].includes(r.status)) {
      r.status = "recalled";
      r.updated_at = new Date().toISOString();
    }
  }

  saveApprovals(approvalRequests);
  savePartnerListings(partnerListings);
  res.json(request);
});

// PUT /approvals/:id/recall — owner recalls an approved item
router.put("/approvals/:id/recall", (req, res) => {
  const { owner_id } = req.body as Partial<{ owner_id: string }>;
  const request = approvalRequests.find((r) => r.id === req.params["id"]);
  if (!request) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }
  const gem = inventory.find((g) => g.id === request.listing_id);
  if (!gem || gem.seller_id !== owner_id) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  if (!["pending", "in_approval"].includes(request.status)) {
    res.status(400).json({ error: `Cannot recall item with status '${request.status}'` });
    return;
  }

  request.status = "recalled";
  request.updated_at = new Date().toISOString();

  for (const pl of partnerListings) {
    if (pl.approval_request_id === request.id) {
      pl.is_active = false;
    }
  }

  saveApprovals(approvalRequests);
  savePartnerListings(partnerListings);
  res.json(request);
});

// PUT /approvals/:id/extend — request or grant extension
router.put("/approvals/:id/extend", (req, res) => {
  const { user_id, owner_id, extension_days } = req.body as Partial<{
    user_id: string;
    owner_id: string;
    extension_days: number;
  }>;
  const request = approvalRequests.find((r) => r.id === req.params["id"]);
  if (!request) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }
  if (request.status !== "in_approval") {
    res.status(400).json({ error: "Can only extend active approvals" });
    return;
  }

  const gem = inventory.find((g) => g.id === request.listing_id);
  if (!gem) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  // Partner requests extension
  if (user_id && request.requester_id === user_id) {
    request.extension_requested = true;
    request.extension_days = extension_days ?? 7;
    request.updated_at = new Date().toISOString();
    saveApprovals(approvalRequests);
    res.json({ ...request, message: "Extension requested — awaiting owner approval" });
    return;
  }

  // Owner grants extension
  if (owner_id && gem.seller_id === owner_id) {
    const days = extension_days ?? request.extension_days ?? 7;
    const currentExpiry = request.expiry_date ? new Date(request.expiry_date) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + days);
    request.expiry_date = currentExpiry.toISOString();
    request.extension_requested = false;
    request.updated_at = new Date().toISOString();
    saveApprovals(approvalRequests);
    res.json({ ...request, message: `Extended by ${days} days` });
    return;
  }

  res.status(403).json({ error: "Not authorized" });
});

// POST /approvals/:id/add-to-store — partner adds approved item to their store
router.post("/approvals/:id/add-to-store", (req, res) => {
  const { user_id, selling_price, selling_currency } = req.body as Partial<{
    user_id: string;
    selling_price: number;
    selling_currency: string;
  }>;

  const request = approvalRequests.find((r) => r.id === req.params["id"]);
  if (!request) {
    res.status(404).json({ error: "Approval request not found" });
    return;
  }
  if (request.requester_id !== user_id) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  if (request.status !== "in_approval") {
    res.status(400).json({ error: "You can only add approved items to your store" });
    return;
  }

  const gem = inventory.find((g) => g.id === request.listing_id);
  if (!gem) {
    res.status(404).json({ error: "Original listing not found" });
    return;
  }

  if (typeof selling_price !== "number" || selling_price <= 0) {
    res.status(400).json({ error: "selling_price must be a positive number" });
    return;
  }

  // Enforce minimum price
  const minPrice = gem.min_price ?? gem.price;
  const sellCurrency = selling_currency ?? gem.currency;
  if (sellCurrency === gem.currency && selling_price < minPrice) {
    res.status(400).json({ error: `selling_price must be at least ${minPrice} ${gem.currency} (owner's minimum)` });
    return;
  }

  // Check if already added to store
  const alreadyAdded = partnerListings.find(
    (pl) => pl.approval_request_id === request.id && pl.is_active
  );
  if (alreadyAdded) {
    res.json({ ...alreadyAdded, message: "Already in your store" });
    return;
  }

  const now = new Date().toISOString();
  const pl: PartnerListing = {
    id: randomUUID(),
    original_listing_id: gem.id,
    owner_id: gem.seller_id,
    partner_id: user_id!,
    approval_request_id: request.id,
    selling_price,
    selling_currency: sellCurrency,
    is_active: true,
    created_at: now,
  };

  partnerListings.push(pl);
  savePartnerListings(partnerListings);
  res.status(201).json(pl);
});

// GET /approvals/partner-listings — get partner's distributed listings (their "store")
router.get("/approvals/partner-listings", (req, res) => {
  const { user_id } = req.query as { user_id?: string };
  if (!user_id) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }
  expireStale();

  const results = partnerListings
    .filter((pl) => pl.partner_id === user_id && pl.is_active)
    .map((pl) => {
      const gem = inventory.find((g) => g.id === pl.original_listing_id);
      const owner = gem ? snapUser(gem.seller_id) : null;
      const approval = approvalRequests.find((r) => r.id === pl.approval_request_id);
      return {
        ...pl,
        original_gem: gem
          ? {
              id: gem.id,
              stone_type: gem.stone_type,
              carat: gem.carat,
              origin: gem.origin,
              treatment: gem.treatment,
              certificate_number: gem.certificate_number,
              images: gem.images,
              description: gem.stone_type,
            }
          : null,
        owner,
        expiry_date: approval?.expiry_date ?? null,
        days_remaining: approval?.expiry_date
          ? Math.max(0, Math.ceil((new Date(approval.expiry_date).getTime() - Date.now()) / 86400000))
          : null,
      };
    });

  res.json(results);
});

// GET /approvals/partner-listings/public — public marketplace partner listings with badge info
router.get("/approvals/partner-listings/public", (req, res) => {
  expireStale();
  const results = partnerListings
    .filter((pl) => pl.is_active)
    .map((pl) => {
      const gem = inventory.find((g) => g.id === pl.original_listing_id);
      const owner = gem ? snapUser(gem.seller_id) : null;
      const partner = snapUser(pl.partner_id);
      if (!gem || gem.listing_status === "removed") return null;
      return {
        id: pl.id,
        original_listing_id: pl.original_listing_id,
        partner_id: pl.partner_id,
        owner_id: pl.owner_id,
        selling_price: pl.selling_price,
        selling_currency: pl.selling_currency,
        is_approval_listing: true,
        partner,
        owner,
        stone_type: gem.stone_type,
        carat: gem.carat,
        origin: gem.origin,
        treatment: gem.treatment,
        certificate_number: gem.certificate_number,
        images: gem.images,
        created_at: pl.created_at,
      };
    })
    .filter(Boolean);

  res.json(results);
});

// GET /approvals/partner-listings/for-company/:company_id — partner listings shown on a company page
router.get("/approvals/partner-listings/for-company/:company_id", (req, res) => {
  const companyId = req.params["company_id"]!;
  expireStale();

  const results = partnerListings
    .filter((pl) => pl.partner_id === companyId && pl.is_active)
    .map((pl) => {
      const gem = inventory.find((g) => g.id === pl.original_listing_id);
      const owner = gem ? snapUser(gem.seller_id) : null;
      const approval = approvalRequests.find((r) => r.id === pl.approval_request_id);
      if (!gem || gem.listing_status === "removed") return null;
      return {
        id: pl.id,
        original_listing_id: pl.original_listing_id,
        is_approval_listing: true,
        selling_price: pl.selling_price,
        selling_currency: pl.selling_currency,
        owner,
        stone_type: gem.stone_type,
        carat: gem.carat,
        origin: gem.origin,
        treatment: gem.treatment,
        certificate_number: gem.certificate_number,
        images: gem.images,
        expiry_date: approval?.expiry_date ?? null,
        created_at: pl.created_at,
      };
    })
    .filter(Boolean);

  res.json(results);
});

// ────────────────────────────────────────────────────────────────────────────
// POST /approvals/manual — create a manual (off-platform) approval entry
// ────────────────────────────────────────────────────────────────────────────
router.post("/approvals/manual", (req, res) => {
  const {
    user_id,
    direction,
    counterparty_name,
    stone_type_manual,
    stone_carat_manual,
    stone_price_manual,
    stone_currency_manual,
    collected_date,
    returned_date,
    notes,
    duration_days,
  } = req.body as Partial<{
    user_id: string;
    direction: "sent" | "received";
    counterparty_name: string;
    stone_type_manual: string;
    stone_carat_manual: number;
    stone_price_manual: number;
    stone_currency_manual: string;
    collected_date: string;
    returned_date: string;
    notes: string;
    duration_days: number;
  }>;

  if (!user_id) { res.status(400).json({ error: "user_id is required" }); return; }
  if (!direction || !["sent", "received"].includes(direction)) { res.status(400).json({ error: "direction must be 'sent' or 'received'" }); return; }

  const now = new Date().toISOString();
  const newRequest: ApprovalRequest = {
    id: randomUUID(),
    listing_id: "",
    // For "sent": current user is the owner. For "received": current user is the requester.
    requester_id: direction === "received" ? user_id : "",
    status: returned_date ? "returned" : "in_approval",
    is_manual: true,
    direction,
    counterparty_name: counterparty_name?.trim() || null,
    stone_type_manual: stone_type_manual?.trim() || null,
    stone_carat_manual: stone_carat_manual != null ? Number(stone_carat_manual) : null,
    stone_price_manual: stone_price_manual != null ? Number(stone_price_manual) : null,
    stone_currency_manual: stone_currency_manual || null,
    collected_date: collected_date || null,
    returned_date: returned_date || null,
    notes: notes?.trim() || undefined,
    duration_days: duration_days ? Number(duration_days) : undefined,
    // For "sent" direction, store owner as the requester via a synthetic field we track:
    approved_by: direction === "sent" ? user_id : undefined,
    created_at: now,
    updated_at: now,
  };

  approvalRequests.push(newRequest);
  saveApprovals(approvalRequests);

  // Auto-create a CRM contact for the counterparty if not already present
  if (counterparty_name?.trim()) {
    const name = counterparty_name.trim();
    const exists = tradeContacts.some(
      (c) => c.owner_id === user_id && c.name.toLowerCase() === name.toLowerCase()
    );
    if (!exists) {
      const contactType = direction === "sent" ? "buyer" : "supplier";
      const now2 = new Date().toISOString();
      tradeContacts.push({
        id: randomUUID(),
        owner_id: user_id,
        name,
        company_name: name,
        type: contactType,
        source: "external",
        is_platform_user: false,
        platform_user_id: null,
        phone: null,
        email: null,
        notes: `Auto-created from manual approval (${direction})`,
        tags: ["approval"],
        created_at: now2,
        updated_at: now2,
      });
      saveTradeContacts(tradeContacts);
      logger.info(`Auto-created CRM contact "${name}" for user ${user_id}`);
    }
  }

  res.status(201).json(newRequest);
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /approvals/:id/details — update stone details, dates, counterparty
// ────────────────────────────────────────────────────────────────────────────
router.patch("/approvals/:id/details", (req, res) => {
  const { user_id } = req.body as { user_id?: string };
  if (!user_id) { res.status(400).json({ error: "user_id is required" }); return; }

  const request = approvalRequests.find(
    (r) => r.id === req.params.id &&
      (r.requester_id === user_id || r.approved_by === user_id ||
       (r.is_manual && (r.requester_id === user_id || r.approved_by === user_id)))
  );
  if (!request) { res.status(404).json({ error: "Approval not found" }); return; }

  const {
    counterparty_name,
    stone_type_manual,
    stone_carat_manual,
    stone_price_manual,
    stone_currency_manual,
    collected_date,
    returned_date,
    notes,
    status,
  } = req.body as Partial<ApprovalRequest>;

  if (counterparty_name !== undefined) request.counterparty_name = counterparty_name?.trim() || null;
  if (stone_type_manual !== undefined) request.stone_type_manual = stone_type_manual?.trim() || null;
  if (stone_carat_manual !== undefined) request.stone_carat_manual = stone_carat_manual != null ? Number(stone_carat_manual) : null;
  if (stone_price_manual !== undefined) request.stone_price_manual = stone_price_manual != null ? Number(stone_price_manual) : null;
  if (stone_currency_manual !== undefined) request.stone_currency_manual = stone_currency_manual || null;
  if (collected_date !== undefined) request.collected_date = collected_date || null;
  if (returned_date !== undefined) {
    request.returned_date = returned_date || null;
    if (returned_date && request.status === "in_approval") request.status = "returned";
    if (!returned_date && request.status === "returned" && request.is_manual) request.status = "in_approval";
  }
  if (notes !== undefined) request.notes = notes?.trim() || undefined;
  if (status && ["in_approval", "returned", "sold", "recalled"].includes(status)) request.status = status;

  request.updated_at = new Date().toISOString();
  saveApprovals(approvalRequests);
  res.json(request);
});

// DELETE /approvals/manual/:id
router.delete("/approvals/manual/:id", (req, res) => {
  const userId = String(req.query["user_id"] ?? "");
  if (!userId) { res.status(400).json({ error: "user_id is required" }); return; }
  const idx = approvalRequests.findIndex(
    (r) => r.id === req.params.id && r.is_manual &&
      (r.approved_by === userId || r.requester_id === userId)
  );
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  approvalRequests.splice(idx, 1);
  saveApprovals(approvalRequests);
  res.json({ ok: true });
});

// GET /approvals/manual
router.get("/approvals/manual", (req, res) => {
  const userId = String(req.query["user_id"] ?? "");
  const direction = String(req.query["direction"] ?? "");
  if (!userId) { res.status(400).json({ error: "user_id is required" }); return; }

  const results = approvalRequests.filter((r) => {
    if (!r.is_manual) return false;
    if (direction === "sent") return r.approved_by === userId;
    if (direction === "received") return r.requester_id === userId;
    return r.approved_by === userId || r.requester_id === userId;
  });

  res.json(results);
});

export default router;
