import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { inventory } from "./inventory.js";
import { users } from "./users.js";
import { tradeContacts, tradeDeals } from "./trader-crm.js";
import { sendAstrobotInquiryToPremiumUser } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { loadAstrobotLeads, saveAstrobotLeads } from "../lib/persist.js";
import { saveTradeContacts } from "../lib/persist.js";

const router: IRouter = Router();

// ─── Lead Store ───────────────────────────────────────────────────────────────
export interface AstrobotLead {
  id: string;
  trader_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  recommended_gemstone: string;
  zodiac: string;
  concern: string | null;
  budget: string | null;
  astro_reason: string;
  status: "new" | "contacted" | "converted";
  created_at: string;
  notes: string | null;
}

export const astrobotLeads: AstrobotLead[] = [];

export async function loadLeads(): Promise<void> {
  const saved = await loadAstrobotLeads();
  if (saved.length > 0) astrobotLeads.push(...(saved as AstrobotLead[]));
  logger.info({ count: astrobotLeads.length }, "astrobot: loaded leads");
}

function saveLeads() { saveAstrobotLeads(astrobotLeads); }

// ─── Astrology Engine ─────────────────────────────────────────────────────────

type ZodiacSign =
  | "Aries" | "Taurus" | "Gemini" | "Cancer" | "Leo" | "Virgo"
  | "Libra" | "Scorpio" | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";

type Concern = "career" | "wealth" | "health" | "marriage" | "protection";
type Budget = "low" | "medium" | "premium";

const ZODIAC_DATES: { sign: ZodiacSign; month: number; day: number }[] = [
  { sign: "Capricorn",   month: 1,  day: 19 },
  { sign: "Aquarius",    month: 2,  day: 18 },
  { sign: "Pisces",      month: 3,  day: 20 },
  { sign: "Aries",       month: 4,  day: 19 },
  { sign: "Taurus",      month: 5,  day: 20 },
  { sign: "Gemini",      month: 6,  day: 20 },
  { sign: "Cancer",      month: 7,  day: 22 },
  { sign: "Leo",         month: 8,  day: 22 },
  { sign: "Virgo",       month: 9,  day: 22 },
  { sign: "Libra",       month: 10, day: 22 },
  { sign: "Scorpio",     month: 11, day: 21 },
  { sign: "Sagittarius", month: 12, day: 21 },
  { sign: "Capricorn",   month: 12, day: 31 },
];

function getZodiac(dob: string): ZodiacSign | null {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  for (const entry of ZODIAC_DATES) {
    if (month < entry.month || (month === entry.month && day <= entry.day)) {
      return entry.sign;
    }
  }
  return "Capricorn";
}

const ZODIAC_GEMSTONE: Record<ZodiacSign, string> = {
  Aries:       "Red Coral",
  Taurus:      "Emerald",
  Gemini:      "Emerald",
  Cancer:      "Pearl",
  Leo:         "Ruby",
  Virgo:       "Emerald",
  Libra:       "Diamond",
  Scorpio:     "Red Coral",
  Sagittarius: "Yellow Sapphire",
  Capricorn:   "Blue Sapphire",
  Aquarius:    "Blue Sapphire",
  Pisces:      "Yellow Sapphire",
};

const CONCERN_GEMSTONE: Record<Concern, string> = {
  wealth:     "Yellow Sapphire",
  protection: "Turquoise",
  health:     "Emerald",
  marriage:   "Diamond",
  career:     "Ruby",
};

const ZODIAC_PLANET: Record<ZodiacSign, string> = {
  Aries:       "Mars",
  Taurus:      "Venus",
  Gemini:      "Mercury",
  Cancer:      "Moon",
  Leo:         "Sun",
  Virgo:       "Mercury",
  Libra:       "Venus",
  Scorpio:     "Mars",
  Sagittarius: "Jupiter",
  Capricorn:   "Saturn",
  Aquarius:    "Saturn",
  Pisces:      "Jupiter",
};

const ZODIAC_ELEMENT: Record<ZodiacSign, string> = {
  Aries: "Fire", Taurus: "Earth", Gemini: "Air", Cancer: "Water",
  Leo: "Fire", Virgo: "Earth", Libra: "Air", Scorpio: "Water",
  Sagittarius: "Fire", Capricorn: "Earth", Aquarius: "Air", Pisces: "Water",
};

const GEMSTONE_REASON: Record<string, string> = {
  "Red Coral":       "Red Coral strengthens Mars energy, boosting courage, vitality, and drive. It is the primary birthstone for Aries and Scorpio, ruled by Mars.",
  "Emerald":         "Emerald channels Mercury's intellectual power, enhancing communication, business acumen, and clarity of thought — ideal for Mercury-ruled signs.",
  "Pearl":           "Pearl resonates with the Moon's calming energy, nurturing emotional balance, intuition, and inner peace for Cancer natives.",
  "Ruby":            "Ruby amplifies the Sun's radiant energy, promoting leadership, confidence, and vitality for Leo — the Sun's own sign.",
  "Diamond":         "Diamond connects to Venus's harmonious vibration, attracting love, luxury, and aesthetic beauty for Libra natives.",
  "Yellow Sapphire": "Yellow Sapphire harnesses Jupiter's expansive wisdom, bringing abundance, good fortune, and spiritual growth for Jupiter-ruled signs.",
  "Blue Sapphire":   "Blue Sapphire channels Saturn's disciplined energy, offering focus, perseverance, and protection for Saturn-ruled signs.",
  "Turquoise":       "Turquoise is a powerful protective stone, warding off negative energies and bringing peace and good fortune to the wearer.",
};

const CONCERN_REASON_SUFFIX: Record<Concern, string> = {
  wealth:     "For wealth and prosperity, this stone is especially potent — Jupiter's energy amplifies financial abundance and opportunity.",
  protection: "For protection, this stone creates a powerful shield against negative energies and harmful influences.",
  health:     "For health and healing, this stone's Mercury vibration supports the nervous system and promotes overall well-being.",
  marriage:   "For love and marriage, this stone's Venus energy harmonizes relationships, deepens bonds, and attracts lasting partnership.",
  career:     "For career growth, this stone's solar energy amplifies ambition, authority, and recognition in professional life.",
};

const QUALITY_BY_BUDGET: Record<Budget, { label: string; description: string }> = {
  low:     { label: "Natural",                   description: "Genuine natural gemstone, unenhanced — an excellent starting point." },
  medium:  { label: "Natural, Untreated",        description: "Natural with no heat or chemical treatment — superior clarity and value." },
  premium: { label: "Natural, Untreated, Certified", description: "Top-grade natural stone with GIA/GRS/AGL certification — the gold standard for investment." },
};

const BUDGET_LABELS: Record<string, string> = {
  low: "Starter (natural stones)",
  medium: "Premium (natural, untreated)",
  premium: "Luxury (certified, investment-grade)",
};

const CONCERN_LABELS: Record<string, string> = {
  career: "Career & Professional Growth",
  wealth: "Wealth & Financial Abundance",
  health: "Health & Healing",
  marriage: "Love & Marriage",
  protection: "Protection & Spiritual Shield",
};

// ─── POST /astrobot/recommend ─────────────────────────────────────────────────
router.post("/astrobot/recommend", (req, res) => {
  const { date_of_birth, concern, budget_preference, ref_trader_id } = req.body as {
    date_of_birth?: string;
    concern?: string;
    budget_preference?: string;
    ref_trader_id?: string;
  };

  if (!date_of_birth) {
    res.status(400).json({ error: "date_of_birth is required" });
    return;
  }

  const zodiac = getZodiac(date_of_birth);
  if (!zodiac) {
    res.status(400).json({ error: "Invalid date_of_birth format. Use YYYY-MM-DD." });
    return;
  }

  const validConcern = concern && Object.keys(CONCERN_GEMSTONE).includes(concern)
    ? (concern as Concern)
    : null;
  const validBudget = budget_preference && Object.keys(QUALITY_BY_BUDGET).includes(budget_preference)
    ? (budget_preference as Budget)
    : "medium";

  const zodiacGem = ZODIAC_GEMSTONE[zodiac];
  const concernGem = validConcern ? CONCERN_GEMSTONE[validConcern] : null;
  const recommended_gemstone = concernGem ?? zodiacGem;

  const baseReason = GEMSTONE_REASON[recommended_gemstone] ?? `${recommended_gemstone} is a powerful stone for your sign.`;
  const concernSuffix = validConcern ? " " + CONCERN_REASON_SUFFIX[validConcern] : "";
  const reason = baseReason + concernSuffix;

  const quality = QUALITY_BY_BUDGET[validBudget];
  const searchTerm = recommended_gemstone.toLowerCase();

  // If a trader ref is provided, filter to only that trader's gems
  const allMatching = inventory.filter(
    (g) => g.listing_status === "approved" && g.stone_type.toLowerCase().includes(searchTerm)
  );

  const traderListings = ref_trader_id
    ? allMatching.filter((g) => g.seller_id === ref_trader_id).slice(0, 6)
    : [];

  const globalListings = ref_trader_id
    ? [] // Don't show global if trader ref present (use fallback flow instead)
    : allMatching.slice(0, 6);

  const listings = (traderListings.length > 0 ? traderListings : (ref_trader_id ? [] : globalListings))
    .map((g) => ({
      id: g.id,
      stone_type: g.stone_type,
      carat: g.carat,
      origin: g.origin,
      treatment: g.treatment,
      price: g.price,
      currency: g.currency,
      images: g.images.slice(0, 1),
      is_featured: g.is_featured,
      seller_id: g.seller_id,
    }));

  // Trader info for the banner
  let trader_info: { name: string; company: string | null; phone: string | null } | null = null;
  if (ref_trader_id) {
    const trader = users.find((u) => u.id === ref_trader_id);
    if (trader) {
      trader_info = {
        name: trader.name,
        company: trader.company_name ?? null,
        phone: trader.phone ?? null,
      };
    }
  }

  res.json({
    zodiac,
    planet: ZODIAC_PLANET[zodiac],
    element: ZODIAC_ELEMENT[zodiac],
    zodiac_gemstone: zodiacGem,
    concern_override: concernGem,
    recommended_gemstone,
    reason,
    suggested_quality: quality.label,
    quality_description: quality.description,
    listings,
    trader_has_stock: traderListings.length > 0,
    trader_info,
  });
});

// ─── POST /astrobot/lead ──────────────────────────────────────────────────────
router.post("/astrobot/lead", (req, res) => {
  const { trader_id, customer_name, customer_phone, customer_email, recommended_gemstone, zodiac, concern, budget, astro_reason } = req.body as {
    trader_id?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    recommended_gemstone?: string;
    zodiac?: string;
    concern?: string;
    budget?: string;
    astro_reason?: string;
  };

  if (!trader_id?.trim() || !customer_name?.trim() || !customer_phone?.trim() || !recommended_gemstone?.trim()) {
    res.status(400).json({ error: "trader_id, customer_name, customer_phone, and recommended_gemstone are required" });
    return;
  }

  // Auto-create a CRM contact tagged "AstroBot Lead" for this trader
  const existingContact = tradeContacts.find(
    (c) => c.user_id === trader_id && c.phone === customer_phone.trim()
  );
  if (!existingContact) {
    const newContact = {
      id: randomUUID(),
      user_id: trader_id,
      name: customer_name.trim(),
      company_name: null,
      type: "buyer" as const,
      phone: customer_phone.trim(),
      email: customer_email?.trim() ?? null,
      notes: `AstroBot Lead — interested in ${recommended_gemstone}`,
      tags: ["AstroBot Lead"],
      source: "astrobot",
      is_platform_user: false,
      platform_user_id: null,
      created_at: new Date().toISOString(),
    };
    tradeContacts.push(newContact);
    saveTradeContacts(tradeContacts);
  }

  const lead: AstrobotLead = {
    id: randomUUID(),
    trader_id: trader_id.trim(),
    customer_name: customer_name.trim(),
    customer_phone: customer_phone.trim(),
    customer_email: customer_email?.trim() ?? null,
    recommended_gemstone: recommended_gemstone.trim(),
    zodiac: zodiac ?? "Unknown",
    concern: concern ?? null,
    budget: budget ?? null,
    astro_reason: astro_reason ?? "",
    status: "new",
    created_at: new Date().toISOString(),
    notes: null,
  };

  astrobotLeads.push(lead);
  saveLeads();

  // Build WhatsApp message to trader
  const trader = users.find((u) => u.id === trader_id);
  let whatsapp_trader_link: string | null = null;
  if (trader?.phone) {
    const cleanPhone = trader.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `🚀 New AstroBot Lead!\n\nCustomer: ${customer_name.trim()}\nPhone: ${customer_phone.trim()}${customer_email ? `\nEmail: ${customer_email.trim()}` : ""}\nRecommended Stone: ${recommended_gemstone}${zodiac ? `\nZodiac: ${zodiac}` : ""}${concern ? `\nGoal: ${CONCERN_LABELS[concern] ?? concern}` : ""}\n\nPlease contact and assist this customer.`
    );
    whatsapp_trader_link = `https://wa.me/${cleanPhone}?text=${msg}`;
  }

  // Build WhatsApp message to customer
  const cleanCustomerPhone = customer_phone.trim().replace(/\D/g, "");
  const customerMsg = encodeURIComponent(
    `Thank you for using AstroBot on LuckyBirthstone! ✨\n\nYour gemstone recommendation (${recommended_gemstone}) has been shared with a verified trader. They will contact you shortly to help you find the perfect stone.\n\nHave a wonderful day! 💎`
  );
  const whatsapp_customer_link = `https://wa.me/${cleanCustomerPhone}?text=${customerMsg}`;

  logger.info({ lead_id: lead.id, trader_id, gemstone: recommended_gemstone }, "astrobot: new lead captured");

  res.status(201).json({
    success: true,
    lead,
    whatsapp_trader_link,
    whatsapp_customer_link,
    message: "Your request has been submitted. The trader will contact you shortly.",
  });
});

// ─── GET /astrobot/leads/:traderId ────────────────────────────────────────────
router.get("/astrobot/leads/:traderId", (req, res) => {
  const { traderId } = req.params;
  const leads = astrobotLeads
    .filter((l) => l.trader_id === traderId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(leads);
});

// ─── PATCH /astrobot/leads/:leadId ────────────────────────────────────────────
router.patch("/astrobot/leads/:leadId", (req, res) => {
  const { leadId } = req.params;
  const { status, notes } = req.body as { status?: AstrobotLead["status"]; notes?: string };
  const lead = astrobotLeads.find((l) => l.id === leadId);
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  if (status) lead.status = status;
  if (notes !== undefined) lead.notes = notes;
  saveLeads();
  res.json(lead);
});

// ─── POST /astrobot/inquiry (legacy — keep for backward compat) ───────────────
router.post("/astrobot/inquiry", async (req, res) => {
  const { name, email, phone, gemstone, zodiac, concern, budget } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    gemstone?: string;
    zodiac?: string;
    concern?: string;
    budget?: string;
  };

  if (!name?.trim() || !email?.trim() || !phone?.trim() || !gemstone?.trim()) {
    res.status(400).json({ error: "name, email, phone, and gemstone are required" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const premiumUsers = users.filter(
    (u) => u.subscription_plan === "premium" && u.email_verified
  );

  const inquiryData = {
    buyerName: name.trim(),
    buyerEmail: email.trim(),
    buyerPhone: phone.trim(),
    gemstone: gemstone.trim(),
    zodiac: zodiac ?? "Unknown",
    concern: concern ? (CONCERN_LABELS[concern] ?? concern) : "Not specified",
    budget: budget ? (BUDGET_LABELS[budget] ?? budget) : "Not specified",
  };

  const results = await Promise.allSettled(
    premiumUsers.map((u) =>
      sendAstrobotInquiryToPremiumUser(u.email, u.name, inquiryData)
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  if (failed > 0) {
    logger.warn({ sent, failed, gemstone }, "Some AstroBot inquiry emails failed");
  }

  logger.info({ sent, failed, gemstone, buyerEmail: email }, "AstroBot inquiry dispatched");

  res.json({
    success: true,
    message: "Your inquiry has been submitted. A dealer will contact you shortly.",
    dealers_notified: sent,
  });
});

export default router;
