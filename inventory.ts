import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { users, SUBSCRIPTION_PLANS, USER_TYPE_LABELS } from "./users.js";
import { saveInventory } from "../lib/persist.js";
import {
  SINGLE_BOOST_COST_USD,
  BOOST_DURATION_DAYS,
} from "../lib/launch.js";
import { estimatePrice, type PricingResult } from "../lib/pricing.js";
import { lookupRapaport } from "../lib/rapaport.js";
import { addNotification } from "../lib/notifications.js";
import { haversineKm } from "../lib/geo.js";
import { sendListingLiveEmail } from "../lib/email.js";
import { crmProspects } from "./crm.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

type Currency = "USD" | "INR" | "AED" | "THB";

export interface GemImage {
  image_url: string;
  width: number;
  height: number;
  label?: string;
  media_type?: "image" | "video";
}

const IMAGE_LABELS = ["front", "side", "certificate", "inclusion", "other"];
const MEDIA_TYPES = ["image", "video"];

function isValidMediaUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/api/storage/objects/")
  );
}

function validateImages(raw: unknown): raw is GemImage[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) return false;
  return raw.every((img) => {
    if (!img || typeof img !== "object") return false;
    const { image_url, width, height, label, media_type } = img as Record<string, unknown>;
    if (!isValidMediaUrl(image_url)) return false;
    if (typeof width !== "number" || width <= 0) return false;
    if (typeof height !== "number" || height <= 0) return false;
    if (label !== undefined && label !== null && !IMAGE_LABELS.includes(label as string)) return false;
    if (media_type !== undefined && media_type !== null && !MEDIA_TYPES.includes(media_type as string)) return false;
    return true;
  });
}

export interface Gemstone extends PricingResult {
  id: string;
  seller_id: string;
  stone_type: string;
  carat: number;
  origin: string;
  treatment: string;
  color: string | null;
  clarity: string | null;
  rap_price_per_carat: number | null;
  total_rap_value: number | null;
  num_pieces: number | null;
  price: number;
  currency: Currency;
  base_price_usd: number;
  certificate_number: string;
  images: GemImage[];
  is_featured: boolean;
  boost_expiry_date: string | null;
  created_at: string;
  listing_status?: "approved" | "pending" | "removed" | "review";
  goes_live_at?: string;
  is_in_auction?: boolean;
  auction_id?: string | null;
  is_ad_promoted?: boolean;
  ad_promoted_at?: string | null;
  // Approval trading fields
  approval_enabled?: boolean;
  approval_duration_days?: number;
  max_partners?: number;
  margin_type?: "flexible" | "fixed";
  approval_visibility?: "private" | "trusted" | "public";
  min_price?: number;
  quantity?: number;
}

const USD_RATES: Record<Currency, number> = {
  USD: 1.0,
  INR: 0.012,
  AED: 0.272,
  THB: 0.028,
};

function toUSD(amount: number, currency: Currency): number {
  return Math.round(amount * USD_RATES[currency] * 100) / 100;
}

const VALID_CURRENCIES: Currency[] = ["USD", "INR", "AED", "THB"];

export const inventory: Gemstone[] = [];

function isBoostActive(gem: Gemstone): boolean {
  if (!gem.is_featured || !gem.boost_expiry_date) return false;
  return new Date(gem.boost_expiry_date) > new Date();
}

type UserRecord = (typeof users)[0];

function buildSellerFields(seller: UserRecord | undefined, distanceKm: number | null) {
  if (!seller) return { seller: null, company_snapshot: null };
  const snap = {
    id: seller.id,
    company_name: seller.company_name ?? seller.name,
    user_type: seller.user_type,
    user_type_label: USER_TYPE_LABELS[seller.user_type],
    city: seller.city,
    country: seller.country,
    distance_km: distanceKm,
    rating: seller.rating,
    total_reviews: seller.total_reviews,
    verification_status: seller.verification_status,
    verification_badge: seller.verification_badge,
    logo_url: seller.logo_url,
    is_online: seller.is_online,
    name: seller.name,
    instagram_url: seller.instagram_url ?? null,
    facebook_page_url: seller.facebook_page_url ?? null,
  };
  return { seller: snap, company_snapshot: snap };
}

function expireBoosts(): void {
  const now = new Date();
  for (const gem of inventory) {
    if (gem.is_featured && gem.boost_expiry_date && new Date(gem.boost_expiry_date) <= now) {
      gem.is_featured = false;
    }
  }
}

export function activatePendingListings(): void {
  const now = new Date();
  for (const gem of inventory) {
    if (gem.listing_status === "review" && gem.goes_live_at && new Date(gem.goes_live_at) <= now) {
      gem.listing_status = "approved";
      const seller = users.find((u) => u.id === gem.seller_id);
      if (seller) {
        sendListingLiveEmail(seller.email, seller.name, gem.stone_type, gem.id).catch((err) =>
          logger.error({ listingId: gem.id, err }, "Failed to send listing live email")
        );
      }
    }
  }
}

setInterval(activatePendingListings, 10_000);

router.get("/inventory", (_req, res) => {
  expireBoosts();
  activatePendingListings();
  const sorted = [...inventory]
    .filter((g) => g.listing_status !== "removed" && g.listing_status !== "review")
    .sort((a, b) => {
      const aFeatured = isBoostActive(a) ? 1 : 0;
      const bFeatured = isBoostActive(b) ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const withSeller = sorted.map((gem) => {
    const seller = users.find((u) => u.id === gem.seller_id);
    const { seller: sellerFields, company_snapshot } = buildSellerFields(seller, null);
    return { ...gem, seller: sellerFields, company_snapshot, seller_distance_km: null as number | null };
  });

  res.json(withSeller);
});

// ─── GET /inventory/search — location-aware search ──────────────────────────
router.get("/inventory/search", (req, res) => {
  expireBoosts();

  const { stone_type, lat, lng, radius_km } = req.query as {
    stone_type?: string;
    lat?: string;
    lng?: string;
    radius_km?: string;
  };

  const userLat = lat !== undefined && lat !== "" ? parseFloat(lat) : null;
  const userLng = lng !== undefined && lng !== "" ? parseFloat(lng) : null;
  const radius = radius_km ? parseFloat(radius_km) : 500;
  const hasLocation = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);

  let results = [...inventory].filter((g) => g.listing_status !== "removed" && g.listing_status !== "review");

  if (stone_type?.trim()) {
    const q = stone_type.trim().toLowerCase();
    results = results.filter((g) => g.stone_type.toLowerCase().includes(q));
  }

  const withSellerAndDistance = results
    .map((gem) => {
      const seller = users.find((u) => u.id === gem.seller_id);
      const distance =
        hasLocation && seller?.latitude != null && seller?.longitude != null
          ? haversineKm(userLat!, userLng!, seller.latitude, seller.longitude)
          : null;

      if (hasLocation && (distance === null || distance > radius)) return null;

      const distKm = distance !== null ? Math.round(distance * 10) / 10 : null;
      const { seller: sellerFields, company_snapshot } = buildSellerFields(seller, distKm);
      return { ...gem, seller: sellerFields, company_snapshot, seller_distance_km: distKm };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  withSellerAndDistance.sort((a, b) => {
    if (hasLocation) {
      const aFeat = isBoostActive(a as Gemstone) ? 0 : 1;
      const bFeat = isBoostActive(b as Gemstone) ? 0 : 1;
      if (aFeat !== bFeat) return aFeat - bFeat;
      const distDiff = (a.seller_distance_km ?? 99999) - (b.seller_distance_km ?? 99999);
      if (distDiff !== 0) return distDiff;
    } else {
      const aFeatured = isBoostActive(a as Gemstone) ? 1 : 0;
      const bFeatured = isBoostActive(b as Gemstone) ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  res.json(withSellerAndDistance);
});

router.get("/inventory/mine", (req, res) => {
  const { seller_id } = req.query as { seller_id?: string };
  if (!seller_id) {
    res.status(400).json({ error: "seller_id is required" });
    return;
  }
  activatePendingListings();
  const sellerGems = inventory
    .filter((g) => g.seller_id === seller_id && g.listing_status !== "removed")
    .map((gem) => {
      const seller = users.find((u) => u.id === gem.seller_id);
      const { seller: sellerFields, company_snapshot } = buildSellerFields(seller, null);
      return { ...gem, seller: sellerFields, company_snapshot, seller_distance_km: null };
    });
  res.json(sellerGems);
});

router.post("/inventory", (req, res) => {
  const {
    seller_id,
    stone_type,
    carat,
    origin,
    treatment,
    color,
    clarity,
    price,
    currency,
    certificate_number,
    images,
    num_pieces,
  } = req.body as Partial<{
    seller_id: string;
    stone_type: string;
    carat: number;
    origin: string;
    treatment: string;
    color: string;
    clarity: string;
    price: number;
    currency: Currency;
    certificate_number: string;
    images: GemImage[];
    num_pieces: number;
  }>;

  if (
    !seller_id ||
    !stone_type ||
    carat == null ||
    !origin ||
    !treatment ||
    price == null ||
    !currency ||
    !certificate_number
  ) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!validateImages(images)) {
    res.status(400).json({
      error: "images is required: 1–10 entries, each with a valid image_url (http/https), positive width, and positive height",
      valid_labels: IMAGE_LABELS,
    });
    return;
  }

  const isDiamond = stone_type.toLowerCase().trim() === "diamond";
  if (isDiamond && (!color || !clarity)) {
    res.status(400).json({
      error: "color and clarity are required for diamond listings",
      example: { color: "G", clarity: "VS1" },
      valid_colors: ["D","E","F","G","H","I","J","K","L","M"],
      valid_clarities: ["IF","VVS1","VVS2","VS1","VS2","SI1","SI2","I1","I2","I3"],
    });
    return;
  }

  const seller = users.find((u) => u.id === seller_id);
  if (!seller) {
    res.status(401).json({ error: "Session expired. Please sign in again." });
    return;
  }

  const planMeta = SUBSCRIPTION_PLANS[seller.subscription_plan];
  if (planMeta.max_listings !== null) {
    const effectiveLimit = planMeta.max_listings + (seller.extra_listing_credits ?? 0);
    const currentCount = inventory.filter((g) => g.seller_id === seller_id).length;
    if (currentCount >= effectiveLimit) {
      res.status(403).json({
        error: `Listing limit reached (max ${effectiveLimit} for your plan + add-ons). Upgrade your plan or purchase listing credits.`,
        current_listings: currentCount,
        max_listings: effectiveLimit,
        subscription_plan: seller.subscription_plan,
        extra_listing_credits: seller.extra_listing_credits ?? 0,
      });
      return;
    }
  }

  if (!VALID_CURRENCIES.includes(currency)) {
    res.status(400).json({ error: "currency must be one of USD, INR, AED, THB" });
    return;
  }

  if (typeof carat !== "number" || carat < 0) {
    res.status(400).json({ error: "carat must be a non-negative number" });
    return;
  }

  if (typeof price !== "number" || price < 0) {
    res.status(400).json({ error: "price must be a non-negative number" });
    return;
  }

  // Diamond → Rapaport pricing; everything else → rule-based generic pricing
  let rapPerCarat: number | null = null;
  let totalRap: number | null = null;
  let pricing: ReturnType<typeof estimatePrice>;

  if (isDiamond && color && clarity) {
    const rapResult = lookupRapaport(carat, color, clarity);
    if (rapResult) {
      rapPerCarat = rapResult.rap_price_per_carat;
      totalRap    = rapResult.total_rap_value;
      pricing = {
        estimated_price_min:  rapResult.estimated_price_min,
        estimated_price_max:  rapResult.estimated_price_max,
        pricing_confidence:   rapResult.pricing_confidence,
        pricing_disclaimer:   rapResult.pricing_disclaimer,
      };
    } else {
      // Unknown grade combination — fall back to generic
      pricing = estimatePrice(stone_type, carat, origin, treatment);
    }
  } else {
    pricing = estimatePrice(stone_type, carat, origin, treatment);
  }

  const goesLiveAt = new Date(Date.now() + 30 * 1000).toISOString();

  const gemstone: Gemstone = {
    id: randomUUID(),
    seller_id,
    stone_type,
    carat,
    origin,
    treatment,
    color:               color ?? null,
    clarity:             clarity ?? null,
    rap_price_per_carat: rapPerCarat,
    total_rap_value:     totalRap,
    num_pieces:          (num_pieces != null && num_pieces > 0) ? num_pieces : null,
    price,
    currency,
    base_price_usd: toUSD(price, currency),
    certificate_number,
    images,
    is_featured: false,
    boost_expiry_date: null,
    ...pricing,
    created_at: new Date().toISOString(),
    listing_status: "review",
    goes_live_at: goesLiveAt,
  };

  inventory.push(gemstone);
  saveInventory(inventory);
  addNotification(
    "new_listing",
    "New Listing Pending Approval",
    `${seller.name} added a ${stone_type} (${carat}ct) from ${origin} — pending review.`,
    { user_id: seller_id, entity_id: gemstone.id }
  );

  // WhatsApp broadcast fires when the listing is approved by admin, not at submission

  const used = inventory.filter((g) => g.seller_id === seller_id).length;

  res.status(201).json({
    ...gemstone,
    _quota: {
      plan: seller.subscription_plan,
      used,
      extra_listing_credits: seller.extra_listing_credits ?? 0,
      max: planMeta.max_listings !== null ? planMeta.max_listings + (seller.extra_listing_credits ?? 0) : "unlimited",
      remaining: planMeta.max_listings !== null ? planMeta.max_listings + (seller.extra_listing_credits ?? 0) - used : "unlimited",
    },
  });
});

// ─── GET /inventory/:id — public single listing ─────────────────────────────
router.get("/inventory/:id", (req, res) => {
  const gem = inventory.find((g) => g.id === req.params.id);
  if (!gem || gem.listing_status === "removed") {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const seller = users.find((u) => u.id === gem.seller_id);
  const { seller: sellerFields, company_snapshot } = buildSellerFields(seller, null);
  res.json({ ...gem, seller: sellerFields, company_snapshot, seller_distance_km: null });
});

router.put("/inventory/:id", (req, res) => {
  const gemstone = inventory.find((g) => g.id === req.params["id"]);
  if (!gemstone) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const {
    seller_id,
    images,
    price,
    currency,
    certificate_number,
    stone_type,
    carat,
    origin,
    treatment,
    color,
    clarity,
    num_pieces,
  } = req.body as Partial<{
    seller_id: string;
    images: GemImage[];
    price: number;
    currency: Currency;
    certificate_number: string;
    stone_type: string;
    carat: number;
    origin: string;
    treatment: string;
    color: string;
    clarity: string;
    num_pieces: number | null;
  }>;

  if (!seller_id || gemstone.seller_id !== seller_id) {
    res.status(403).json({ error: "You can only edit your own listings" });
    return;
  }

  if (stone_type !== undefined) gemstone.stone_type = stone_type;
  if (carat !== undefined) {
    if (typeof carat !== "number" || carat < 0) {
      res.status(400).json({ error: "carat must be a non-negative number" });
      return;
    }
    gemstone.carat = carat;
  }
  if (origin !== undefined) gemstone.origin = origin;
  if (treatment !== undefined) gemstone.treatment = treatment;
  if (color !== undefined) gemstone.color = color;
  if (clarity !== undefined) gemstone.clarity = clarity;

  if (images !== undefined) {
    if (!validateImages(images)) {
      res.status(400).json({
        error: "images: 1–10 entries required, each with a valid image_url (http/https), positive width, and positive height",
        valid_labels: IMAGE_LABELS,
      });
      return;
    }
    gemstone.images = images;
  }

  if (price !== undefined) {
    if (typeof price !== "number" || price < 0) {
      res.status(400).json({ error: "price must be a non-negative number" });
      return;
    }
    gemstone.price = price;
    const cur = currency ?? gemstone.currency;
    gemstone.base_price_usd = toUSD(price, cur);
  }

  if (currency !== undefined) {
    if (!VALID_CURRENCIES.includes(currency)) {
      res.status(400).json({ error: "currency must be one of USD, INR, AED, THB" });
      return;
    }
    gemstone.currency = currency;
    gemstone.base_price_usd = toUSD(gemstone.price, currency);
  }

  if (certificate_number !== undefined) {
    gemstone.certificate_number = certificate_number;
  }

  if (num_pieces !== undefined) {
    gemstone.num_pieces = (num_pieces != null && num_pieces > 0) ? num_pieces : null;
  }

  // Approval configuration fields
  const body = req.body as Record<string, unknown>;
  if ("approval_enabled" in body) gemstone.approval_enabled = Boolean(body["approval_enabled"]);
  if ("approval_duration_days" in body && typeof body["approval_duration_days"] === "number")
    gemstone.approval_duration_days = body["approval_duration_days"] as number;
  if ("max_partners" in body && typeof body["max_partners"] === "number")
    gemstone.max_partners = body["max_partners"] as number;
  if ("margin_type" in body && (body["margin_type"] === "flexible" || body["margin_type"] === "fixed"))
    gemstone.margin_type = body["margin_type"] as "flexible" | "fixed";
  if ("approval_visibility" in body && ["private", "trusted", "public"].includes(body["approval_visibility"] as string))
    gemstone.approval_visibility = body["approval_visibility"] as "private" | "trusted" | "public";
  if ("min_price" in body && typeof body["min_price"] === "number")
    gemstone.min_price = body["min_price"] as number;
  if ("quantity" in body && typeof body["quantity"] === "number")
    gemstone.quantity = body["quantity"] as number;

  saveInventory(inventory);
  res.json(gemstone);
});

router.delete("/inventory/:id", (req, res) => {
  const { seller_id } = req.query as { seller_id?: string };
  if (!seller_id) {
    res.status(400).json({ error: "seller_id is required" });
    return;
  }
  const idx = inventory.findIndex((g) => g.id === req.params["id"]);
  if (idx === -1) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const gem = inventory[idx];
  if (gem.seller_id !== seller_id) {
    res.status(403).json({ error: "You can only delete your own listings" });
    return;
  }
  inventory.splice(idx, 1);
  saveInventory(inventory);
  res.json({ success: true, deleted_id: req.params["id"] });
});

router.post("/inventory/:id/boost-pay", (req, res) => {
  const gemstone = inventory.find((g) => g.id === req.params["id"]);
  if (!gemstone) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const { seller_id } = req.body as Partial<{ seller_id: string }>;
  if (!seller_id) {
    res.status(400).json({ error: "seller_id is required" });
    return;
  }

  const seller = users.find((u) => u.id === seller_id);
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  if (gemstone.seller_id !== seller_id) {
    res.status(403).json({ error: "You can only boost your own listings" });
    return;
  }

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + BOOST_DURATION_DAYS);

  gemstone.is_featured = true;
  gemstone.boost_expiry_date = expiryDate.toISOString();
  saveInventory(inventory);

  res.json({
    gemstone_id: gemstone.id,
    is_featured: true,
    boost_expiry_date: gemstone.boost_expiry_date,
    amount_charged_usd: SINGLE_BOOST_COST_USD,
    expires_in_days: BOOST_DURATION_DAYS,
  });
});

router.post("/inventory/:id/boost", (req, res) => {
  const gemstone = inventory.find((g) => g.id === req.params["id"]);
  if (!gemstone) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const { seller_id } = req.body as Partial<{ seller_id: string }>;
  if (!seller_id) {
    res.status(400).json({ error: "seller_id is required" });
    return;
  }

  const seller = users.find((u) => u.id === seller_id);
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  if (gemstone.seller_id !== seller_id) {
    res.status(403).json({ error: "You can only boost your own listings" });
    return;
  }

  if (seller.free_boosts <= 0) {
    res.status(400).json({
      error: "No boosts available. Purchase a boost pack to continue.",
      boosts_available: 0,
      boost_packs: {
        boosts_5:  { boosts: 5,  price_usd: 200 },
        boosts_10: { boosts: 10, price_usd: 350 },
      },
      single_boost_cost_usd: SINGLE_BOOST_COST_USD,
    });
    return;
  }

  seller.free_boosts -= 1;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + BOOST_DURATION_DAYS);

  gemstone.is_featured = true;
  gemstone.boost_expiry_date = expiryDate.toISOString();
  saveInventory(inventory);

  res.json({
    gemstone_id: gemstone.id,
    is_featured: gemstone.is_featured,
    boost_expiry_date: gemstone.boost_expiry_date,
    boosts_remaining: seller.free_boosts,
    boost_cost_usd: SINGLE_BOOST_COST_USD,
    expires_in_days: BOOST_DURATION_DAYS,
  });
});

export default router;
