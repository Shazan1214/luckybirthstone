import { randomUUID } from "crypto";
import { users, type User } from "../routes/users.js";
import { inventory, type GemImage } from "../routes/inventory.js";
import { messages } from "../routes/messages.js";
import { supportTickets, ticketResponses } from "../routes/support.js";
import { transactions } from "../routes/transactions.js";
import { sales } from "../routes/sales.js";
import { platformPayments } from "../routes/payments.js";
import { initPosts } from "../routes/posts.js";
import { initAuctions, auctions, bids } from "../routes/auctions.js";
import { referrals, type Referral, ensureUniqueReferralCode } from "../routes/referrals.js";
import { loadCrmProspects } from "../routes/crm.js";
import { loadSalesUsers } from "./salesUserStore.js";
import { loadEndorsements, endorsements } from "../routes/endorsements.js";
import { loadConnections, connections } from "../routes/connections.js";
import { loadCredits, creditTransactions, addCredits } from "../routes/credits.js";
import { loadDeals, deals } from "../routes/deals.js";
import { loadDisputes, disputes } from "../routes/disputes.js";
import { loadActivities, activities, emitActivity } from "../routes/activities.js";
import { loadApprovals, loadPartnerListings, approvalRequests, partnerListings } from "../routes/approvals.js";
import { loadTraderCRM, tradeContacts, tradeDeals, tradeInvoices, tradePayments } from "../routes/trader-crm.js";
import { loadSalesLedgerData, salesLedger, ledgerPayments } from "../routes/sales-ledger.js";
import { loadPayablesLedgerData, payablesLedger } from "../routes/payables-ledger.js";
import { loadLeads, astrobotLeads } from "../routes/astrobot.js";
import { applyTrustScore } from "./trustScore.js";
import { estimatePrice } from "./pricing.js";
import { lookupRapaport } from "./rapaport.js";
import { logger } from "./logger.js";
import {
  loadPersistedUsers,
  loadPersistedInventory,
  loadPersistedMessages,
  loadPersistedSupportTickets,
  loadPersistedTicketResponses,
  loadPersistedTransactions,
  loadPersistedSales,
  loadPersistedPlatformPayments,
  loadPersistedReferrals,
  saveUsers,
  saveInventory,
  saveReferrals,
  startPeriodicBackup,
} from "./persist.js";

const USD_RATES: Record<string, number> = { USD: 1, INR: 0.012, AED: 0.272 };

function toUSD(amount: number, currency: string): number {
  return Math.round(amount * (USD_RATES[currency] ?? 1) * 100) / 100;
}

function seedGem(params: {
  seller_id: string;
  stone_type: string;
  carat: number;
  origin: string;
  treatment: string;
  color?: string;
  clarity?: string;
  price: number;
  currency: string;
  certificate_number: string;
  images: GemImage[];
  is_featured?: boolean;
}) {
  const { stone_type, carat, origin, treatment, color, clarity, price, currency } = params;

  const pricing = estimatePrice(stone_type, carat, origin, treatment);
  const rapResult = color && clarity ? lookupRapaport(carat, color, clarity) : null;

  const boostExpiry = params.is_featured
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  inventory.push({
    id: randomUUID(),
    seller_id: params.seller_id,
    stone_type,
    carat,
    origin,
    treatment,
    color: color ?? null,
    clarity: clarity ?? null,
    rap_price_per_carat: rapResult?.rap_price_per_carat ?? null,
    total_rap_value: rapResult?.total_rap_value ?? null,
    num_pieces: null,
    price,
    currency: currency as "USD" | "INR" | "AED",
    base_price_usd: toUSD(price, currency),
    certificate_number: params.certificate_number,
    images: params.images,
    is_featured: params.is_featured ?? false,
    boost_expiry_date: boostExpiry,
    created_at: new Date().toISOString(),
    estimated_price_min: rapResult?.estimated_price_min ?? pricing.estimated_price_min,
    estimated_price_max: rapResult?.estimated_price_max ?? pricing.estimated_price_max,
    pricing_confidence: rapResult?.pricing_confidence ?? pricing.pricing_confidence,
    pricing_disclaimer: rapResult?.pricing_disclaimer ?? pricing.pricing_disclaimer,
  });
}

async function initReferrals(): Promise<void> {
  const saved = await loadPersistedReferrals();
  if (saved.length > 0) {
    referrals.push(...(saved as Referral[]));
    logger.info({ count: referrals.length }, "Referrals loaded from storage");
  }
}

export async function seedDemoData(): Promise<void> {
  // Load all persisted data in parallel
  const [
    savedUsers,
    savedInventory,
    savedMessages,
    savedTickets,
    savedTicketResponses,
    savedTransactions,
    savedSales,
    savedPlatformPayments,
  ] = await Promise.all([
    loadPersistedUsers(),
    loadPersistedInventory(),
    loadPersistedMessages(),
    loadPersistedSupportTickets(),
    loadPersistedTicketResponses(),
    loadPersistedTransactions(),
    loadPersistedSales(),
    loadPersistedPlatformPayments(),
  ]);

  if (savedUsers.length > 0) {
    const migratedUsers = (savedUsers as User[]).map((u) => {
      const verificationMap: Record<string, string> = {
        premium_verified: "verified",
      };
      const planMap: Record<string, string> = {
        starter: "basic",
        growth: "pro",
      };
      if (u.verification_status && verificationMap[u.verification_status]) {
        u.verification_status = verificationMap[u.verification_status] as User["verification_status"];
      }
      if (u.verification_badge && verificationMap[u.verification_badge]) {
        u.verification_badge = verificationMap[u.verification_badge] as User["verification_badge"];
      }
      if (u.requested_tier && verificationMap[u.requested_tier]) {
        u.requested_tier = verificationMap[u.requested_tier] as User["requested_tier"];
      }
      if (u.subscription_plan && planMap[u.subscription_plan]) {
        u.subscription_plan = planMap[u.subscription_plan] as User["subscription_plan"];
      }
      if (!u.referral_code && !u.is_admin) {
        u.referral_code = ensureUniqueReferralCode(u.name);
      }
      if (u.whatsapp_opt_in === undefined) {
        u.whatsapp_opt_in = true;
      }
      // Phase 2 — Trust Score field backfill
      if (u.trust_score === undefined) u.trust_score = 0;
      if (u.deals_completed === undefined) u.deals_completed = 0;
      if (u.on_time_payments === undefined) u.on_time_payments = 0;
      if (u.delayed_payments === undefined) u.delayed_payments = 0;
      if (u.disputes_count === undefined) u.disputes_count = 0;
      if (u.response_rate === undefined) u.response_rate = 0;
      if (u.endorsements_count === undefined) u.endorsements_count = 0;
      if (u.gallery_urls === undefined) u.gallery_urls = [];
      // Phase 1 — extended profile field backfill
      if (u.years_in_business === undefined) u.years_in_business = null;
      if (u.specialization === undefined) u.specialization = null;
      if (!u.preferred_language) u.preferred_language = "en";
      applyTrustScore(u);
      return u;
    });
    users.push(...migratedUsers);

    const usedSlugs = new Set(users.filter((u) => u.store_slug).map((u) => u.store_slug as string));
    let slugSaveNeeded = false;
    for (const u of users) {
      if (!u.store_slug) {
        const base = (u.company_name ?? u.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 40) || "store";
        let slug = base;
        let i = 2;
        while (usedSlugs.has(slug)) { slug = `${base}-${i++}`; }
        u.store_slug = slug;
        usedSlugs.add(slug);
        slugSaveNeeded = true;
      }
    }
    if (slugSaveNeeded) saveUsers(users);
    if (savedInventory.length > 0) {
      inventory.push(...(savedInventory as Parameters<typeof inventory.push>[0][]));
    }
    if (savedMessages.length > 0) {
      messages.push(...(savedMessages as Parameters<typeof messages.push>[0][]));
    }
    if (savedTickets.length > 0) {
      supportTickets.push(...(savedTickets as Parameters<typeof supportTickets.push>[0][]));
    }
    if (savedTicketResponses.length > 0) {
      ticketResponses.push(...(savedTicketResponses as Parameters<typeof ticketResponses.push>[0][]));
    }
    if (savedTransactions.length > 0) {
      transactions.push(...(savedTransactions as Parameters<typeof transactions.push>[0][]));
    }
    if (savedSales.length > 0) {
      sales.push(...(savedSales as Parameters<typeof sales.push>[0][]));
    }
    if (savedPlatformPayments.length > 0) {
      platformPayments.push(...(savedPlatformPayments as Parameters<typeof platformPayments.push>[0][]));
    }
    logger.info(
      {
        users: users.length,
        gems: inventory.length,
        messages: messages.length,
        tickets: supportTickets.length,
        transactions: transactions.length,
        sales: sales.length,
      },
      "Restored data from storage"
    );

    // Load auctions, bids, referrals, CRM, endorsements — always needed even with real data
    await initAuctions();
    await initReferrals();
    await loadCrmProspects();
    await loadSalesUsers();
    await loadEndorsements();
    await loadConnections();
    await loadActivities();
    await loadCredits();
    await loadDeals();
    await loadDisputes();
    await loadApprovals();
    await loadPartnerListings();
    await loadTraderCRM();
    await loadSalesLedgerData();
    await loadPayablesLedgerData();
    await loadLeads();

    // Backfill credits for existing users who don't have it set
    let creditsMigrated = 0;
    for (const u of users) {
      if (u.credits === undefined || u.credits === null) {
        u.credits = 50; // starter credits
        creditsMigrated++;
      }
    }
    if (creditsMigrated > 0) {
      saveUsers(users);
      logger.info({ creditsMigrated }, "credits: backfilled starter credits for existing users");
    }

    startPeriodicBackup({
      users: () => users,
      inventory: () => inventory,
      messages: () => messages,
      supportTickets: () => supportTickets,
      ticketResponses: () => ticketResponses,
      transactions: () => transactions,
      sales: () => sales,
      auctions: () => auctions,
      bids: () => bids,
      referrals: () => referrals,
      endorsements: () => endorsements,
      connections: () => connections,
      credits: () => creditTransactions,
      deals: () => deals,
      activities: () => activities,
      disputes: () => disputes,
      approvals: () => approvalRequests,
      partnerListings: () => partnerListings,
      tradeContacts: () => tradeContacts,
      tradeDeals: () => tradeDeals,
      tradeInvoices: () => tradeInvoices,
      tradePayments: () => tradePayments,
      salesLedger: () => salesLedger,
      payablesLedger: () => payablesLedger,
      ledgerPayments: () => ledgerPayments,
      astrobotLeads: () => astrobotLeads,
    });
    return;
  }

  if (users.length > 0 || inventory.length > 0) return;

  const now = new Date().toISOString();
  // Use fixed UUIDs for seed users so admin sessions survive server restarts
  const adminId = "a0000000-0000-4000-8000-000000000001";
  const sellerId = randomUUID();
  const buyerId = randomUUID();
  const minerId = randomUUID();

  users.push({
    id: adminId,
    name: "LuckyBirthstone Admin",
    email: "admin@gemworld.io",
    password: "admin2024",
    user_type: "b2b_trader",
    company_name: "LuckyBirthstone Platform",
    address: null,
    city: null,
    state: null,
    country: null,
    latitude: null,
    longitude: null,
    contact_number: null,
    trade_license_number: null,
    trade_license_document_url: null,
    owner_name: null,
    government_id_number: null,
    government_id_document_url: null,
    website: null,
    logo_url: null,
    years_in_business: null,
    specialization: null,
    preferred_language: "en",
    trust_score: 100,
    deals_completed: 0,
    on_time_payments: 0,
    delayed_payments: 0,
    disputes_count: 0,
    response_rate: 100,
    endorsements_count: 0,
    gallery_urls: [],
    rating: 5,
    total_reviews: 0,
    verification_status: "legacy_verified",
    verification_fee_paid: true,
    verification_badge: "legacy_verified",
    email_verified: true,
    email_verification_code: null,
    password_reset_code: null,
    password_reset_expires: null,
    subscription_plan: "premium",
    subscription_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_payment_status: "paid",
    free_boosts: 0,
    extra_listing_credits: 0,
    is_founding_seller: false,
    is_online: true,
    last_active_at: now,
    created_at: now,
    is_admin: true,
  });

  users.push({
    id: buyerId,
    name: "Alice Chen",
    email: "alice@gemworld.io",
    password: "demo1234",
    user_type: "b2b_trader",
    company_name: "Chen Trading Co.",
    address: "Hong Kong",
    city: "Hong Kong",
    state: null,
    country: "Hong Kong SAR",
    latitude: 22.3193,
    longitude: 114.1694,
    contact_number: null,
    trade_license_number: null,
    trade_license_document_url: null,
    owner_name: "Alice Chen",
    government_id_number: null,
    government_id_document_url: null,
    website: null,
    logo_url: null,
    years_in_business: 8,
    specialization: "Diamonds, Sapphires",
    preferred_language: "hi",
    trust_score: 72,
    deals_completed: 14,
    on_time_payments: 12,
    delayed_payments: 2,
    disputes_count: 0,
    response_rate: 88,
    endorsements_count: 3,
    gallery_urls: [],
    rating: 4.2,
    total_reviews: 6,
    verification_status: "basic_verified",
    verification_fee_paid: true,
    verification_badge: "basic_verified",
    email_verified: true,
    email_verification_code: null,
    password_reset_code: null,
    password_reset_expires: null,
    subscription_plan: "basic",
    subscription_expires_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_payment_status: "paid",
    free_boosts: 0,
    extra_listing_credits: 0,
    is_founding_seller: false,
    is_online: true,
    last_active_at: now,
    created_at: now,
  });

  users.push({
    id: sellerId,
    name: "Ravi Diamonds",
    email: "ravi@gemworld.io",
    password: "demo1234",
    user_type: "b2b_trader",
    company_name: "Ravi Diamonds International",
    address: "Surat, India",
    city: "Surat",
    state: "Gujarat",
    country: "India",
    latitude: 21.1702,
    longitude: 72.8311,
    contact_number: null,
    trade_license_number: "IND-GEM-2024-0082",
    trade_license_document_url: null,
    owner_name: "Ravi Mehta",
    government_id_number: null,
    government_id_document_url: null,
    website: "https://ravidiamonds.example.com",
    logo_url: null,
    years_in_business: 22,
    specialization: "Diamonds, Rubies",
    preferred_language: "en",
    trust_score: 88,
    deals_completed: 47,
    on_time_payments: 45,
    delayed_payments: 2,
    disputes_count: 0,
    response_rate: 95,
    endorsements_count: 7,
    gallery_urls: [],
    rating: 4.8,
    total_reviews: 23,
    verification_status: "verified",
    verification_fee_paid: true,
    verification_badge: "verified",
    email_verified: true,
    email_verification_code: null,
    password_reset_code: null,
    password_reset_expires: null,
    subscription_plan: "pro",
    subscription_expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_payment_status: "paid",
    free_boosts: 3,
    extra_listing_credits: 0,
    is_founding_seller: true,
    is_online: false,
    last_active_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: now,
  });

  users.push({
    id: minerId,
    name: "Burma Gemstones Ltd",
    email: "info@burmagem.example.com",
    password: "demo1234",
    user_type: "miner",
    company_name: "Burma Gemstones Ltd",
    address: "Mogok, Myanmar",
    city: "Mogok",
    state: "Mandalay Region",
    country: "Myanmar",
    latitude: 22.9163,
    longitude: 96.5106,
    contact_number: null,
    trade_license_number: "MM-GEM-2023-005",
    trade_license_document_url: null,
    owner_name: "Ko Aung Myint",
    government_id_number: null,
    government_id_document_url: null,
    website: null,
    logo_url: null,
    years_in_business: 30,
    specialization: "Rubies, Jade",
    preferred_language: "en",
    trust_score: 81,
    deals_completed: 29,
    on_time_payments: 27,
    delayed_payments: 2,
    disputes_count: 1,
    response_rate: 78,
    endorsements_count: 5,
    gallery_urls: [],
    rating: 4.5,
    total_reviews: 11,
    verification_status: "basic_verified",
    verification_fee_paid: true,
    verification_badge: "basic_verified",
    email_verified: true,
    email_verification_code: null,
    password_reset_code: null,
    password_reset_expires: null,
    subscription_plan: "pro",
    subscription_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_payment_status: "paid",
    free_boosts: 2,
    extra_listing_credits: 0,
    is_founding_seller: true,
    is_online: true,
    last_active_at: new Date().toISOString(),
    created_at: now,
  });

  seedGem({
    seller_id: sellerId,
    stone_type: "Diamond",
    carat: 1.52,
    origin: "Russia",
    treatment: "None",
    color: "D",
    clarity: "VVS1",
    price: 145000,
    currency: "USD",
    certificate_number: "GIA1174852",
    images: [
      { image_url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=600&fit=crop", width: 800, height: 600, label: "front" },
      { image_url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&h=600&fit=crop", width: 800, height: 600, label: "side" },
      { image_url: "https://images.unsplash.com/photo-1603902618516-5a3e22dd73d9?w=800&h=600&fit=crop", width: 800, height: 600, label: "certificate" },
    ],
    is_featured: true,
  });

  seedGem({
    seller_id: sellerId,
    stone_type: "Diamond",
    carat: 0.75,
    origin: "Botswana",
    treatment: "None",
    color: "G",
    clarity: "VS1",
    price: 4200,
    currency: "USD",
    certificate_number: "GIA9928341",
    images: [
      { image_url: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&h=600&fit=crop", width: 800, height: 600, label: "front" },
      { image_url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=600&fit=crop", width: 800, height: 600, label: "side" },
    ],
  });

  seedGem({
    seller_id: minerId,
    stone_type: "Ruby",
    carat: 2.47,
    origin: "Burma",
    treatment: "None",
    price: 18500,
    currency: "USD",
    certificate_number: "GRS2024-R8871",
    images: [
      { image_url: "https://images.unsplash.com/photo-1560161793-ec61e5d72caf?w=800&h=600&fit=crop", width: 800, height: 600, label: "front" },
      { image_url: "https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800&h=600&fit=crop", width: 800, height: 600, label: "inclusion" },
      { image_url: "https://images.unsplash.com/photo-1611244419377-b0a760c19719?w=800&h=600&fit=crop", width: 800, height: 600, label: "certificate" },
    ],
    is_featured: true,
  });

  seedGem({
    seller_id: sellerId,
    stone_type: "Emerald",
    carat: 3.15,
    origin: "Colombia",
    treatment: "Oiling",
    price: 22000,
    currency: "USD",
    certificate_number: "GRS2024-E4432",
    images: [
      { image_url: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&h=600&fit=crop", width: 800, height: 600, label: "front" },
      { image_url: "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=800&h=600&fit=crop", width: 800, height: 600, label: "side" },
    ],
  });

  seedGem({
    seller_id: sellerId,
    stone_type: "Sapphire",
    carat: 5.62,
    origin: "Kashmir",
    treatment: "None",
    price: 68000,
    currency: "USD",
    certificate_number: "GRS2024-S0012",
    images: [
      { image_url: "https://images.unsplash.com/photo-1563464493-f11d21a83929?w=800&h=600&fit=crop", width: 800, height: 600, label: "front" },
      { image_url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=600&fit=crop", width: 800, height: 600, label: "side" },
    ],
  });

  seedGem({
    seller_id: minerId,
    stone_type: "Alexandrite",
    carat: 1.83,
    origin: "Brazil",
    treatment: "None",
    price: 37000,
    currency: "USD",
    certificate_number: "GIA4418733",
    images: [
      { image_url: "https://images.unsplash.com/photo-1551334787-21e6bd3ab135?w=800&h=600&fit=crop", width: 800, height: 600, label: "front" },
      { image_url: "https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800&h=600&fit=crop", width: 800, height: 600, label: "side" },
    ],
  });

  seedGem({
    seller_id: minerId,
    stone_type: "Spinel",
    carat: 4.20,
    origin: "Burma",
    treatment: "None",
    price: 16800,
    currency: "USD",
    certificate_number: "GRS2024-SP882",
    images: [
      { image_url: "https://images.unsplash.com/photo-1611244419377-b0a760c19719?w=800&h=600&fit=crop", width: 800, height: 600, label: "front" },
      { image_url: "https://images.unsplash.com/photo-1560161793-ec61e5d72caf?w=800&h=600&fit=crop", width: 800, height: 600, label: "side" },
    ],
  });

  await initPosts();
  await initAuctions();
  await initReferrals();
  await loadCrmProspects();
  await loadSalesUsers();
  await loadEndorsements();
  await loadConnections();
  await loadActivities();
  await loadCredits();
  await loadDeals();
  await loadDisputes();

  // Award starter credits to all seed users
  for (const u of users) {
    if (!u.credits) {
      u.credits = 50;
      addCredits(u.id, 50, "Welcome bonus", null);
    }
  }

  // Emit joined activities for seed users
  for (const u of users) {
    if (!activities.some((a) => a.user_id === u.id && a.type === "joined")) {
      void emitActivity(u.id, "joined", { name: u.company_name ?? u.name });
    }
  }

  saveUsers(users);
  saveInventory(inventory);
  logger.info({ users: users.length, gems: inventory.length }, "Demo data seeded");
  startPeriodicBackup({
    users: () => users,
    inventory: () => inventory,
    messages: () => messages,
    supportTickets: () => supportTickets,
    ticketResponses: () => ticketResponses,
    transactions: () => transactions,
    sales: () => sales,
    auctions: () => auctions,
    bids: () => bids,
    referrals: () => referrals,
    endorsements: () => endorsements,
    connections: () => connections,
    credits: () => creditTransactions,
    deals: () => deals,
    activities: () => activities,
    disputes: () => disputes,
    approvals: () => approvalRequests,
    partnerListings: () => partnerListings,
    tradeContacts: () => tradeContacts,
    tradeDeals: () => tradeDeals,
    tradeInvoices: () => tradeInvoices,
    tradePayments: () => tradePayments,
    salesLedger: () => salesLedger,
    payablesLedger: () => payablesLedger,
    ledgerPayments: () => ledgerPayments,
  });
}
