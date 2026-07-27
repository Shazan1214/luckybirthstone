export type UserType = "b2b_trader" | "retailer" | "miner" | "manufacturer" | "gems_lab";
export type VerificationStatus = "unverified" | "basic_verified" | "verified" | "legacy_verified";
export type SubscriptionPlan = "basic" | "pro" | "premium";
export type Currency = "USD" | "INR" | "AED" | "THB";
export type PreferredLanguage = "en" | "hi" | "th" | "ar" | "ru" | "fa" | "ur" | "zh";

export const USER_TYPE_LABELS: Record<UserType, string> = {
  b2b_trader: "Trader",
  retailer: "Retailer",
  miner: "Miner",
  manufacturer: "Manufacturer",
  gems_lab: "Gems Lab",
};

export const LANGUAGE_LABELS: Record<PreferredLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  th: "ภาษาไทย",
  ar: "العربية",
  ru: "Русский",
  fa: "فارسی",
  ur: "اردو",
  zh: "中文",
};

export const RTL_LANGUAGES: PreferredLanguage[] = ["ar", "fa", "ur"];

export interface PublicProfile {
  id: string;
  name: string;
  user_type: UserType;
  user_type_label: string;
  company_name: string | null;
  website: string | null;
  logo_url: string | null;
  owner_name: string | null;
  city: string | null;
  country: string | null;
  years_in_business: number | null;
  specialization: string | null;
  preferred_language: PreferredLanguage;
  trust_score: number;
  deals_completed: number;
  on_time_payments: number;
  delayed_payments: number;
  disputes_count: number;
  response_rate: number;
  endorsements_count: number;
  gallery_urls: string[];
  rating: number;
  total_reviews: number;
  verification_status: VerificationStatus;
  verification_badge: string;
  requested_tier: string | null;
  verification_requested_at: string | null;
  verification_payment_amount: number | null;
  email_verified: boolean;
  subscription_plan: SubscriptionPlan;
  free_boosts: number;
  extra_listing_credits: number;
  is_founding_seller: boolean;
  is_online: boolean;
  last_active_at: string;
  created_at: string;
  whatsapp_opt_in?: boolean;
  company_description?: string | null;
  instagram_url?: string | null;
  facebook_page_url?: string | null;
  address?: string | null;
  store_slug?: string | null;
  referral_code?: string | null;
  contact_number?: string | null;
  credits?: number;
  default_currency?: Currency | null;
  trade_license_number?: string | null;
  trade_license_document_url?: string | null;
  government_id_number?: string | null;
  government_id_document_url?: string | null;
  trial_ends_at?: string | null;
  subscription_payment_status?: "paid" | "unpaid";
  subscription_billing_cycle?: "monthly" | "annual";
}

// ─── Profile Completion ───────────────────────────────────────────────────────
export interface ProfileCompletionField {
  key: string;
  label: string;
  category: string;
  weight: number;
  done: boolean;
  section?: string;
}

export interface ProfileCompletion {
  percentage: number;
  fields: ProfileCompletionField[];
  badge: string;
}

export function computeProfileCompletion(p: PublicProfile): ProfileCompletion {
  const fields: ProfileCompletionField[] = [
    // BASIC INFO — 30%
    { key: "name",           label: "Full name",       category: "Basic Info",        weight: 5,  done: !!p.name?.trim(),            section: "basic" },
    { key: "email_verified", label: "Email verified",  category: "Basic Info",        weight: 5,  done: !!p.email_verified,          section: "basic" },
    { key: "contact_number", label: "Contact number",  category: "Basic Info",        weight: 5,  done: !!p.contact_number?.trim(),  section: "basic" },
    { key: "company_name",   label: "Company name",    category: "Basic Info",        weight: 5,  done: !!p.company_name?.trim(),    section: "basic" },
    { key: "user_type",      label: "Business type",   category: "Basic Info",        weight: 5,  done: !!p.user_type,               section: "basic" },
    { key: "address",        label: "Address",         category: "Basic Info",        weight: 5,  done: !!p.address?.trim(),         section: "basic" },
    // BUSINESS DETAILS — 30%
    { key: "trade_license_number",       label: "Trade license number",   category: "Business Details",  weight: 10, done: !!p.trade_license_number?.trim(),       section: "business" },
    { key: "trade_license_document_url", label: "Trade license document", category: "Business Details",  weight: 10, done: !!p.trade_license_document_url?.trim(), section: "business" },
    { key: "owner_name",    label: "Owner / director name", category: "Business Details", weight: 5,  done: !!p.owner_name?.trim(),   section: "business" },
    { key: "website",       label: "Website",                category: "Business Details", weight: 5,  done: !!p.website?.trim(),      section: "business" },
    // VERIFICATION — 20%
    { key: "government_id_number",       label: "Government ID number",   category: "Verification",      weight: 10, done: !!p.government_id_number?.trim(),       section: "verification" },
    { key: "government_id_document_url", label: "Government ID document", category: "Verification",      weight: 10, done: !!p.government_id_document_url?.trim(), section: "verification" },
    // BRANDING — 20%
    { key: "logo_url",           label: "Company logo",      category: "Branding",   weight: 10, done: !!p.logo_url?.trim(),           section: "branding" },
    { key: "company_description",label: "Company description", category: "Branding", weight: 10, done: !!p.company_description?.trim(), section: "branding" },
  ];

  const percentage = fields.reduce((sum, f) => sum + (f.done ? f.weight : 0), 0);

  let badge = "Basic Profile";
  if (percentage >= 80) badge = "Verified Profile";
  else if (percentage >= 50) badge = "Partially Verified";

  return { percentage, fields, badge };
}

export interface VerificationPricing {
  pricing: {
    basic_verified: { original: number; final: number; is_free: boolean };
    verified: { original: number; final: number; is_free: boolean };
    legacy_verified: { original: number; final: number; is_free: boolean };
  };
}

export type PaymentType = "verification" | "subscription" | "boost" | "listing_credits";
export type ListingCreditPackType = "credits_10" | "credits_25" | "credits_50";

export interface ListingQuota {
  plan: SubscriptionPlan;
  plan_label: string;
  plan_limit: number | null;
  extra_listing_credits: number;
  effective_limit: number | null;
  is_unlimited: boolean;
}

export interface PlatformPaymentInitiateRequest {
  user_id: string;
  type: PaymentType;
  meta: Record<string, unknown>;
}

export interface PlatformPaymentInitiateResponse {
  payment_id: string;
  amount: number;
  amount_usd_cents?: number;
  currency: "USD";
  type: PaymentType;
  status: string;
  meta: Record<string, unknown>;
  razorpay_order_id: string | null;
  razorpay_key_id: string | null;
  message: string;
}

export interface PlatformPaymentVerifyResponse {
  payment_id: string;
  status: "success" | "failed";
  amount: number;
  currency: "USD";
  type: PaymentType;
  completed_at: string;
  effect: Record<string, unknown>;
}

export interface SellerSummary {
  id: string;
  name: string;
  company_name: string | null;
  user_type: string;
  user_type_label: string;
  verification_badge: string;
  verification_status: string;
  logo_url: string | null;
  rating: number;
  total_reviews: number;
  is_online: boolean;
  city: string | null;
  country: string | null;
}

export interface CompanySnapshot {
  id: string;
  name: string;
  company_name: string;
  user_type: string;
  user_type_label: string;
  city: string | null;
  country: string | null;
  distance_km: number | null;
  rating: number;
  total_reviews: number;
  verification_status: string;
  verification_badge: string;
  logo_url: string | null;
  is_online: boolean;
  instagram_url?: string | null;
  facebook_page_url?: string | null;
}

export interface GemImage {
  image_url: string;
  width: number;
  height: number;
  label?: string;
  media_type?: "image" | "video";
}

export interface Gemstone {
  id: string;
  seller_id: string;
  seller: SellerSummary | null;
  company_snapshot: CompanySnapshot | null;
  stone_type: string;
  carat: number;
  origin: string;
  treatment: string;
  color: string | null;
  clarity: string | null;
  price: number;
  currency: Currency;
  base_price_usd: number;
  certificate_number: string;
  images: GemImage[];
  is_featured: boolean;
  boost_expiry_date: string | null;
  estimated_price_min: number;
  estimated_price_max: number;
  pricing_confidence: "low" | "medium" | "high";
  pricing_disclaimer: string;
  rap_price_per_carat: number | null;
  total_rap_value: number | null;
  num_pieces: number | null;
  created_at: string;
  seller_distance_km: number | null;
  listing_status?: "approved" | "pending" | "removed" | "review";
  goes_live_at?: string;
  is_in_auction?: boolean;
  auction_id?: string | null;
  approval_enabled?: boolean;
  approval_duration_days?: number;
  max_partners?: number;
  margin_type?: "flexible" | "fixed";
  approval_visibility?: "private" | "trusted" | "public";
  min_price?: number;
  quantity?: number;
}

// ─── Approval Trading Types ───────────────────────────────────────────────────

export type ApprovalStatus =
  | "pending" | "approved" | "rejected" | "in_approval"
  | "sold" | "returned" | "expired" | "recalled";

export interface ApprovalUserSnap {
  id: string;
  name: string;
  company_name: string;
  logo_url: string | null;
}

export interface ApprovalListingSnap {
  id?: string;
  stone_type: string;
  carat: number;
  price?: number;
  currency?: string;
  images?: GemImage[];
  min_price?: number | null;
  approval_duration_days?: number;
}

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
  direction?: "sent" | "received";
  counterparty_name?: string | null;
  stone_type_manual?: string | null;
  stone_carat_manual?: number | null;
  stone_price_manual?: number | null;
  stone_currency_manual?: string | null;
  collected_date?: string | null;
  returned_date?: string | null;
  created_at: string;
  updated_at: string;
  requester?: ApprovalUserSnap;
  owner?: ApprovalUserSnap;
  listing_snapshot?: ApprovalListingSnap | null;
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
  is_approval_listing?: boolean;
  created_at: string;
  original_gem?: {
    id: string;
    stone_type: string;
    carat: number;
    origin: string;
    treatment: string;
    certificate_number: string;
    images: GemImage[];
  } | null;
  owner?: ApprovalUserSnap | null;
  partner?: ApprovalUserSnap | null;
  expiry_date?: string | null;
  days_remaining?: number | null;
}

// ─── Trader CRM Types ────────────────────────────────────────────────────────

export interface TradeContact {
  id: string;
  owner_id: string;
  name: string;
  company_name: string;
  type: "buyer" | "supplier" | "partner";
  source: "platform" | "external";
  is_platform_user: boolean;
  platform_user_id: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SalesRecord {
  id: string;
  seller_id: string;
  buyer_contact_id: string;
  buyer_name: string;
  buyer_company: string;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  listing_id?: string | null;
  gemstone_name: string;
  quantity: number;
  total_amount: number;
  amount_received: number;
  outstanding_amount: number;
  currency: string;
  sale_type: "direct" | "approval";
  invoice_id?: string | null;
  due_date?: string | null;
  status: "pending" | "partial" | "paid" | "overdue";
  days_overdue?: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayableRecord {
  id: string;
  buyer_id: string;
  supplier_contact_id: string;
  supplier_name: string;
  supplier_company: string;
  supplier_phone?: string | null;
  supplier_email?: string | null;
  listing_id?: string | null;
  gemstone_name: string;
  quantity: number;
  total_cost: number;
  amount_paid: number;
  outstanding_amount: number;
  currency: string;
  purchase_type: "direct" | "approval";
  related_sale_id?: string | null;
  due_date?: string | null;
  status: "pending" | "partial" | "paid" | "overdue";
  days_overdue?: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerPayment {
  id: string;
  record_id: string;
  record_type: "sale" | "payable";
  owner_id: string;
  amount_paid: number;
  currency: string;
  payment_date: string;
  payment_mode: "cash" | "bank" | "online" | "other";
  notes?: string | null;
  created_at: string;
}

export interface SalesSummary {
  totalReceivable: number;
  overdueAmount: number;
  byCurrency: Record<string, number>;
  overduesByCurrency: Record<string, number>;
  recordCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  topBuyers: { name: string; company: string; total: number; outstanding: number }[];
  currency: string;
}

export interface PayablesSummary {
  totalPayable: number;
  overdueAmount: number;
  byCurrency: Record<string, number>;
  overduesByCurrency: Record<string, number>;
  recordCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  topSuppliers: { name: string; company: string; total: number; outstanding: number }[];
  currency: string;
}

export type DealStage = "stone_picked_up" | "negotiating" | "close" | "stone_returned" | "deal_lost";

export interface DealPaymentTerms {
  upfront_amount?: number | null;
  payment_due_date?: string | null;
  payment_method?: "cash" | "bank" | "cheque" | null;
  reminder_days_before?: number | null;
  reminder_sent?: boolean;
}

export interface TradeDeal {
  id: string;
  owner_id: string;
  contact_id?: string | null;
  listing_id?: string | null;
  title: string;
  deal_value: number;
  currency: string;
  stage: DealStage;
  notes?: string | null;
  payment_terms?: DealPaymentTerms | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface TradeInvoice {
  id: string;
  invoice_number: string;
  owner_id: string;
  buyer_id?: string | null;
  contact_id?: string | null;
  buyer_name: string;
  buyer_company: string;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  buyer_address?: string | null;
  items: InvoiceItem[];
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  status: "pending" | "paid" | "overdue" | "partial" | "cancelled";
  due_date: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradePayment {
  id: string;
  invoice_id: string;
  owner_id: string;
  amount_paid: number;
  currency: string;
  payment_date: string;
  method?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface TradeAnalytics {
  totalRevenue: number;
  pendingPayments: number;
  overduePayments: number;
  revenueByCurrency: Record<string, number>;
  pendingByCurrency: Record<string, number>;
  overdueByCurrency: Record<string, number>;
  invoiceCount: number;
  paidCount: number;
  overdueCount: number;
  topBuyers: { name: string; company: string; total: number }[];
  topGems: { description: string; count: number; revenue: number }[];
  contactCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  buyer_id: string;
  seller_id: string;
  inventory_id: string;
  total_amount: number;
  currency: Currency;
  advance_paid: number;
  credit_amount: number;
  due_date: string;
  status: "pending" | "completed" | "overdue";
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  created_at: string;
  is_read: boolean;
  listing_id?: string;
}

export interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_company: string | null;
  partner_user_type: string | null;
  partner_verification_badge: string;
  partner_is_online: boolean;
  partner_preferred_language: string;
  unread_count: number;
  listing_id: string | null;
  last_message: { text: string; sent_at: string; is_mine: boolean } | null;
}

export interface SupportTicket {
  id: string;
  user_id: string | null;
  ticket_type: "user_support" | "contact_inquiry";
  submitter_name: string;
  submitter_email: string;
  submitter_plan: "anonymous" | "free" | "paid";
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
}

export interface TicketResponse {
  id: string;
  ticket_id: string;
  admin_id: string;
  message: string;
  timestamp: string;
}

export type SupportTicketWithResponses = SupportTicket & { responses: TicketResponse[] };

export interface Sale {
  id: string;
  gem_id: string;
  seller_id: string;
  buyer_email: string;
  sale_price_usd: number;
  note: string;
  confirmed_at: string;
}

let FX: Record<Currency, Record<Currency, number>> = {
  USD: { USD: 1,      INR: 83.5,  AED: 3.67,  THB: 35.5  },
  INR: { USD: 0.012,  INR: 1,     AED: 0.044, THB: 0.425 },
  AED: { USD: 0.272,  INR: 22.73, AED: 1,     THB: 9.67  },
  THB: { USD: 0.028,  INR: 2.35,  AED: 0.103, THB: 1     },
};

const CURRENCIES: Currency[] = ["USD", "INR", "AED", "THB"];

function buildFX(usdRates: Record<string, number>): Record<Currency, Record<Currency, number>> {
  const table = {} as Record<Currency, Record<Currency, number>>;
  for (const from of CURRENCIES) {
    table[from] = {} as Record<Currency, number>;
    const fromInUsd = from === "USD" ? 1 : 1 / (usdRates[from] ?? 1);
    for (const to of CURRENCIES) {
      const toRate = usdRates[to] ?? 1;
      table[from][to] = from === to ? 1 : Math.round(fromInUsd * toRate * 1e6) / 1e6;
    }
  }
  return table;
}

export async function initLiveRates(): Promise<void> {
  try {
    const data = await req<{ rates: Record<string, number> }>("/exchange-rates");
    if (data.rates && typeof data.rates.INR === "number") {
      FX = buildFX(data.rates);
    }
  } catch {
    // keep fallback hardcoded rates
  }
}

export function convertPrice(amount: number, from: Currency, to: Currency): number {
  return Math.round(amount * (FX[from]?.[to] ?? 1) * 100) / 100;
}

const SYM: Record<Currency, string> = { USD: "$", INR: "₹", AED: "د.إ ", THB: "฿" };

export function fmtCurrency(amount: number, currency: Currency): string {
  return SYM[currency] + amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...restOpts } = opts ?? {};
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(extraHeaders as Record<string, string> | undefined) },
    ...restOpts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

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
  ms_remaining: number;
  is_ending_soon: boolean;
  is_trending: boolean;
  gem: {
    id: string;
    stone_type: string;
    carat: number;
    origin: string;
    treatment: string;
    color: string | null;
    clarity: string | null;
    images: GemImage[];
    certificate_number: string;
  } | null;
  seller: {
    id: string;
    name: string;
    company_name: string | null;
    verification_badge: string;
    verification_status: string;
    logo_url: string | null;
    is_online: boolean;
    city: string | null;
    country: string | null;
  } | null;
}

export interface AuctionBid {
  id: string;
  auction_id: string;
  user_id: string;
  bid_amount: number;
  created_at: string;
  bidder_name: string;
  bidder_company: string | null;
}

export interface AuctionDetail extends Auction {
  bids: AuctionBid[];
}

export const api = {
  signup: (b: { name: string; email: string; password: string; user_type: UserType; company_name: string; address: string; contact_number: string; referral_code?: string }) =>
    req<PublicProfile & { _verification_code?: string; _launch_perks?: object }>("/signup", {
      method: "POST",
      body: JSON.stringify(b),
    }),

  login: (b: { email: string; password: string }) =>
    req<PublicProfile & { _authenticated: boolean }>("/login", {
      method: "POST",
      body: JSON.stringify(b),
    }),

  logout: (id: string) =>
    req(`/logout/${id}`, { method: "POST" }),

  forgotPassword: (email: string) =>
    req<{ message: string }>("/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (email: string, code: string, new_password: string) =>
    req<{ message: string }>("/reset-password", { method: "POST", body: JSON.stringify({ email, code, new_password }) }),

  resendVerification: (email: string) =>
    req<{ message: string }>("/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),

  verifyEmail: (b: { email: string; code: string }) =>
    req<PublicProfile>("/verify-email", { method: "POST", body: JSON.stringify(b) }),

  getProfile: (id: string) =>
    req<PublicProfile>(`/profile/${id}`),
  getProfileBySlug: (slug: string) =>
    req<PublicProfile>(`/store/${slug}`),

  getUsers: () => req<PublicProfile[]>("/users"),

  updateProfile: (id: string, b: Partial<{ name: string; company_name: string; address: string; city: string; state: string; country: string; latitude: number; longitude: number; website: string; contact_number: string; owner_name: string; trade_license_number: string; whatsapp_opt_in: boolean; company_description: string; instagram_url: string; facebook_page_url: string; store_slug: string; logo_url: string; specialization: string; years_in_business: number; preferred_language: string; gallery_urls: string[] }>) =>
    req<PublicProfile>(`/profile/${id}`, { method: "PATCH", body: JSON.stringify(b) }),

  getVerificationPricing: () =>
    req<VerificationPricing>("/verification-pricing"),

  requestVerification: (
    id: string,
    body: {
      tier: "basic_verified" | "verified" | "legacy_verified";
      trade_license_document_url?: string;
      government_id_document_url?: string;
    }
  ) => req(`/users/${id}/verification-request`, { method: "POST", body: JSON.stringify(body) }),

  getInventory: () => req<Gemstone[]>("/inventory"),
  getListing: (id: string) => req<Gemstone>(`/inventory/${id}`),

  searchNearbyInventory: (params: { lat: number; lng: number; radius_km: number; stone_type?: string }) => {
    const p = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      radius_km: String(params.radius_km),
      ...(params.stone_type ? { stone_type: params.stone_type } : {}),
    });
    return req<Gemstone[]>(`/inventory/search?${p.toString()}`);
  },

  addInventory: (b: Record<string, unknown>) =>
    req<Gemstone & { _quota?: object }>("/inventory", { method: "POST", body: JSON.stringify(b) }),

  updateInventory: (id: string, b: Record<string, unknown>) =>
    req<Gemstone>(`/inventory/${id}`, { method: "PUT", body: JSON.stringify(b) }),

  createTransaction: (b: Record<string, unknown>) =>
    req<Transaction>("/transactions", { method: "POST", body: JSON.stringify(b) }),

  sendMessage: (b: { sender_id: string; receiver_id: string; message_text: string; listing_id?: string }) =>
    req<Message>("/messages", { method: "POST", body: JSON.stringify(b) }),

  getInbox: (user_id: string) =>
    req<{ user_id: string; conversations: Conversation[] }>(`/messages/inbox/${user_id}`),

  getConversation: (user1: string, user2: string) =>
    req<{ user1: string; user2: string; messages: Message[] }>(`/messages/conversation/${user1}/${user2}`),

  createSupportTicket: (body: { user_id: string; subject: string; message: string }) =>
    req<SupportTicket>("/support/tickets", { method: "POST", body: JSON.stringify(body) }),

  getMyTickets: (user_id: string) =>
    req<SupportTicketWithResponses[]>(`/support/tickets/${user_id}`),

  submitContactForm: (body: { name: string; email: string; subject: string; message: string }) =>
    req<{ success: boolean; ticket_id: string }>("/contact", { method: "POST", body: JSON.stringify(body) }),

  boostPay: (gemId: string, sellerId: string) =>
    req<{ gemstone_id: string; is_featured: boolean; boost_expiry_date: string; amount_charged_usd: number; expires_in_days: number }>(
      `/inventory/${gemId}/boost-pay`,
      { method: "POST", body: JSON.stringify({ seller_id: sellerId }) }
    ),

  recordSale: (body: { gem_id: string; seller_id: string; buyer_email: string; sale_price_usd: number; note?: string }) =>
    req<Sale>("/sales", { method: "POST", body: JSON.stringify(body) }),

  getSellerSales: (sellerId: string) =>
    req<{ seller_id: string; sales: Sale[]; total_sales: number; total_revenue_usd: number }>(`/sales?seller_id=${sellerId}`),

  getInquiryCount: (userId: string) =>
    req<{ user_id: string; total_inquiries: number; unread: number }>(`/messages/inquiries/count?user_id=${userId}`),

  getMyInventory: (sellerId: string) =>
    req<Gemstone[]>(`/inventory/mine?seller_id=${sellerId}`),

  adminBlockUser: (adminId: string, userId: string, action: "block" | "unblock") =>
    fetch(`/api/admin/users/${userId}/block`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-id": adminId },
      body: JSON.stringify({ action }),
    }).then(async (r) => {
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error ?? "Request failed"); }
      return r.json();
    }),

  deleteInventory: (id: string, sellerId: string) =>
    req<{ success: boolean; deleted_id: string }>(`/inventory/${id}?seller_id=${encodeURIComponent(sellerId)}`, { method: "DELETE" }),

  adminDeleteListing: (adminId: string, listingId: string) =>
    fetch(`/api/admin/listings/${listingId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-id": adminId },
    }).then(async (r) => {
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error ?? "Request failed"); }
      return r.json();
    }),

  adminEditListing: (adminId: string, listingId: string, body: Record<string, unknown>) =>
    fetch(`/api/admin/listings/${listingId}/edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-id": adminId },
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error ?? "Request failed"); }
      return r.json();
    }),

  initiatePlatformPayment: (body: PlatformPaymentInitiateRequest) =>
    req<PlatformPaymentInitiateResponse>("/platform-payments/initiate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  verifyPlatformPayment: (paymentId: string, body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  }) =>
    req<PlatformPaymentVerifyResponse>(`/platform-payments/verify/${paymentId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getPlatformPaymentHistory: (userId: string) =>
    req<{ payments: Array<{ id: string; amount: number; currency: string; type: string; status: string; created_at: string; completed_at?: string; meta: Record<string, unknown> }>; total: number }>(`/platform-payments/history/${userId}`),

  getListingQuota: (userId: string) =>
    req<ListingQuota>(`/users/${userId}/listing-quota`),

  getAuctions: (params?: { status?: string; stone_type?: string; min_price?: number; max_price?: number; ending_soon?: boolean; trending?: boolean; featured?: boolean; limit?: number }) => {
    const p = new URLSearchParams();
    if (params?.status) p.set("status", params.status);
    if (params?.stone_type) p.set("stone_type", params.stone_type);
    if (params?.min_price !== undefined) p.set("min_price", String(params.min_price));
    if (params?.max_price !== undefined) p.set("max_price", String(params.max_price));
    if (params?.ending_soon) p.set("ending_soon", "true");
    if (params?.trending) p.set("trending", "true");
    if (params?.featured) p.set("featured", "true");
    if (params?.limit !== undefined) p.set("limit", String(params.limit));
    return req<Auction[]>(`/gem-auctions?${p.toString()}`);
  },

  getAuction: (id: string) => req<AuctionDetail>(`/gem-auctions/${id}`),

  createAuction: (body: { seller_id: string; inventory_id: string; starting_price: number; reserve_price?: number; min_increment?: number; duration_hours?: number }) =>
    req<Auction>("/gem-auctions/create", { method: "POST", body: JSON.stringify(body) }),

  placeBid: (body: { auction_id: string; user_id: string; bid_amount: number }) =>
    req<{ bid: AuctionBid; current_highest_bid: number; total_bids: number }>("/gem-auctions/bid", { method: "POST", body: JSON.stringify(body) }),

  shareAuction: (id: string) =>
    req<{ success: boolean; share_count: number }>(`/gem-auctions/${id}/share`, { method: "POST" }),

  cancelAuction: (id: string, seller_id: string) =>
    req<{ success: boolean }>(`/gem-auctions/${id}/cancel`, { method: "POST", body: JSON.stringify({ seller_id }) }),

  validateReferralCode: (code: string) =>
    req<{ valid: boolean; referrer_name?: string }>(`/referrals/validate?code=${encodeURIComponent(code)}`),

  getMyReferrals: (userId: string) =>
    req<{
      referral_code: string;
      referral_link: string;
      total_referrals: number;
      pending_referrals: number;
      successful_referrals: number;
      total_credits_earned: number;
      current_credits: number;
      referrals: Array<{
        id: string;
        status: "pending" | "successful";
        created_at: string;
        completed_at: string | null;
        referred_name: string;
        referred_verified: boolean;
      }>;
    }>(`/referrals/my/${userId}`),

  // Broadcast / Communications
  getBroadcastUsers: (adminId: string) =>
    req<Array<{
      id: string; name: string; email: string; company_name: string | null;
      verification_status: string; has_phone: boolean; whatsapp_opt_in: boolean; subscription_plan: string;
    }>>(`/admin/broadcast/users`, { headers: { "x-admin-id": adminId } }),

  sendBroadcast: (adminId: string, payload: {
    channel: "email" | "whatsapp";
    template_id: string;
    params: Record<string, string>;
    audience: "all" | "verified" | "unverified" | "with_phone" | "specific";
    user_ids?: string[];
  }) =>
    req<{ sent: number; failed: number; skipped: number; total: number }>(
      `/admin/broadcast`,
      { method: "POST", body: JSON.stringify(payload), headers: { "x-admin-id": adminId } }
    ),

  // CRM
  getCrmProspects: (adminId: string) =>
    req<CrmProspect[]>(`/admin/crm`, { headers: { "x-admin-id": adminId } }),

  createCrmProspect: (adminId: string, data: Omit<CrmProspect, "id" | "created_at" | "updated_at">) =>
    req<CrmProspect>(`/admin/crm`, { method: "POST", body: JSON.stringify(data), headers: { "x-admin-id": adminId } }),

  updateCrmProspect: (adminId: string, id: string, data: Partial<Omit<CrmProspect, "id" | "created_at" | "updated_at">>) =>
    req<CrmProspect>(`/admin/crm/${id}`, { method: "PATCH", body: JSON.stringify(data), headers: { "x-admin-id": adminId } }),

  deleteCrmProspect: (adminId: string, id: string) =>
    req<{ success: boolean }>(`/admin/crm/${id}`, { method: "DELETE", headers: { "x-admin-id": adminId } }),

  convertCrmProspect: (adminId: string, id: string, data: { user_type: string; address?: string; city?: string; country?: string }) =>
    req<ConvertProspectResult>(`/admin/crm/${id}/convert`, { method: "POST", body: JSON.stringify(data), headers: { "x-admin-id": adminId } }),

  messageCrmProspect: (adminId: string, id: string, data: { channel: "email" | "whatsapp"; template_id?: string; params?: Record<string, string> }) =>
    req<{ success: boolean; channel: string }>(`/admin/crm/${id}/message`, { method: "POST", body: JSON.stringify(data), headers: { "x-admin-id": adminId } }),

  importCrmProspects: (adminId: string, rows: Array<Partial<CrmProspect>>) =>
    req<{ imported: number; skipped: number[]; prospects: CrmProspect[] }>(`/admin/crm/import`, { method: "POST", body: JSON.stringify(rows), headers: { "x-admin-id": adminId } }),

  // Admin — Sales Users management
  getSalesUsers: (adminId: string) =>
    req<SalesUserPublic[]>(`/admin/sales-users`, { headers: { "x-admin-id": adminId } }),

  createSalesUser: (adminId: string, data: { name: string; email: string; password: string; phone?: string }) =>
    req<SalesUserPublic>(`/admin/sales-users`, { method: "POST", body: JSON.stringify(data), headers: { "x-admin-id": adminId } }),

  toggleSalesUserActive: (adminId: string, id: string, is_active: boolean) =>
    req<SalesUserPublic>(`/admin/sales-users/${id}/active`, { method: "PATCH", body: JSON.stringify({ is_active }), headers: { "x-admin-id": adminId } }),

  deleteSalesUser: (adminId: string, id: string) =>
    req<{ success: boolean }>(`/admin/sales-users/${id}`, { method: "DELETE", headers: { "x-admin-id": adminId } }),

  // Sales Agent portal
  salesAgentLogin: (email: string, password: string) =>
    req<SalesUserPublic & { role: string }>(`/sales-agent/login`, { method: "POST", body: JSON.stringify({ email, password }) }),

  salesAgentDashboard: (salesId: string) =>
    req<SalesDashboard>(`/sales-agent/dashboard`, { headers: { "x-sales-id": salesId } }),

  // CRM via sales auth
  getSalesCrmProspects: (salesId: string) =>
    req<CrmProspect[]>(`/admin/crm`, { headers: { "x-sales-id": salesId } }),

  createSalesCrmProspect: (salesId: string, data: Omit<CrmProspect, "id" | "created_at" | "updated_at">) =>
    req<CrmProspect>(`/admin/crm`, { method: "POST", body: JSON.stringify(data), headers: { "x-sales-id": salesId } }),

  updateSalesCrmProspect: (salesId: string, id: string, data: Partial<Omit<CrmProspect, "id" | "created_at" | "updated_at">>) =>
    req<CrmProspect>(`/admin/crm/${id}`, { method: "PATCH", body: JSON.stringify(data), headers: { "x-sales-id": salesId } }),

  deleteSalesCrmProspect: (salesId: string, id: string) =>
    req<{ success: boolean }>(`/admin/crm/${id}`, { method: "DELETE", headers: { "x-sales-id": salesId } }),

  convertSalesCrmProspect: (salesId: string, id: string, data: { user_type: string; address?: string; city?: string; country?: string }) =>
    req<ConvertProspectResult>(`/admin/crm/${id}/convert`, { method: "POST", body: JSON.stringify(data), headers: { "x-sales-id": salesId } }),

  messageSalesCrmProspect: (salesId: string, id: string, data: { channel: "email" | "whatsapp"; template_id?: string; params?: Record<string, string> }) =>
    req<{ success: boolean; channel: string }>(`/admin/crm/${id}/message`, { method: "POST", body: JSON.stringify(data), headers: { "x-sales-id": salesId } }),

  importSalesCrmProspects: (salesId: string, rows: Array<Partial<CrmProspect>>) =>
    req<{ imported: number; skipped: number[]; prospects: CrmProspect[] }>(`/admin/crm/import`, { method: "POST", body: JSON.stringify(rows), headers: { "x-sales-id": salesId } }),

  // ── Endorsements ────────────────────────────────────────────────────────────
  getReceivedEndorsements: (userId: string) =>
    req<Endorsement[]>(`/endorsements/received/${userId}`),

  getPendingEndorsements: (userId: string) =>
    req<Endorsement[]>(`/endorsements/pending/${userId}`),

  getGivenEndorsements: (userId: string) =>
    req<Endorsement[]>(`/endorsements/given/${userId}`),

  createEndorsement: (data: { from_user_id: string; to_user_id: string; message: string; years_known?: number | null }) =>
    req<Endorsement>(`/endorsements`, { method: "POST", body: JSON.stringify(data) }),

  acceptEndorsement: (id: string, userId: string) =>
    req<Endorsement>(`/endorsements/${id}/accept`, { method: "PATCH", body: JSON.stringify({ user_id: userId }) }),

  rejectEndorsement: (id: string, userId: string) =>
    req<Endorsement>(`/endorsements/${id}/reject`, { method: "PATCH", body: JSON.stringify({ user_id: userId }) }),

  withdrawEndorsement: (id: string, userId: string) =>
    req<{ success: boolean }>(`/endorsements/${id}`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),

  fetchAdminDisputes: (adminId: string): Promise<Dispute[]> =>
    req<Dispute[]>("/admin/disputes", { headers: { "Content-Type": "application/json", "x-admin-id": adminId } }),

  resolveDispute: (adminId: string, disputeId: string, status: DisputeStatus, resolution?: string): Promise<Dispute> =>
    req<Dispute>(`/admin/disputes/${disputeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-id": adminId },
      body: JSON.stringify({ status, resolution }),
    }),

  // ── Approval Trading ───────────────────────────────────────────────────────

  getIncomingApprovals: (ownerId: string) =>
    req<ApprovalRequest[]>(`/approvals/incoming?owner_id=${ownerId}`),

  getMyApprovals: (userId: string) =>
    req<ApprovalRequest[]>(`/approvals/mine?user_id=${userId}`),

  getListingApprovals: (listingId: string, ownerId: string) =>
    req<{ requests: ApprovalRequest[]; active_partners: number }>(`/approvals/listing/${listingId}?owner_id=${ownerId}`),

  requestApproval: (data: { listing_id: string; requester_id: string; notes?: string; duration_days?: number }) =>
    req<ApprovalRequest>("/approvals/request", { method: "POST", body: JSON.stringify(data) }),

  approveRequest: (id: string, ownerId: string) =>
    req<ApprovalRequest>(`/approvals/${id}/approve`, { method: "PUT", body: JSON.stringify({ owner_id: ownerId }) }),

  rejectRequest: (id: string, ownerId: string) =>
    req<ApprovalRequest>(`/approvals/${id}/reject`, { method: "PUT", body: JSON.stringify({ owner_id: ownerId }) }),

  returnItem: (id: string, userId: string) =>
    req<ApprovalRequest>(`/approvals/${id}/return`, { method: "PUT", body: JSON.stringify({ user_id: userId }) }),

  markAsSold: (id: string, userId: string, finalPrice?: number) =>
    req<ApprovalRequest>(`/approvals/${id}/sell`, { method: "PUT", body: JSON.stringify({ user_id: userId, final_price: finalPrice }) }),

  recallItem: (id: string, ownerId: string) =>
    req<ApprovalRequest>(`/approvals/${id}/recall`, { method: "PUT", body: JSON.stringify({ owner_id: ownerId }) }),

  requestExtension: (id: string, userId: string, extensionDays?: number) =>
    req<ApprovalRequest>(`/approvals/${id}/extend`, { method: "PUT", body: JSON.stringify({ user_id: userId, extension_days: extensionDays ?? 7 }) }),

  grantExtension: (id: string, ownerId: string, extensionDays: number) =>
    req<ApprovalRequest>(`/approvals/${id}/extend`, { method: "PUT", body: JSON.stringify({ owner_id: ownerId, extension_days: extensionDays }) }),

  addToStore: (id: string, userId: string, sellingPrice: number, sellingCurrency: string) =>
    req<PartnerListing>(`/approvals/${id}/add-to-store`, { method: "POST", body: JSON.stringify({ user_id: userId, selling_price: sellingPrice, selling_currency: sellingCurrency }) }),

  createManualApproval: (data: {
    user_id: string;
    direction: "sent" | "received";
    counterparty_name?: string;
    stone_type_manual?: string;
    stone_carat_manual?: number;
    stone_price_manual?: number;
    stone_currency_manual?: string;
    collected_date?: string;
    returned_date?: string;
    notes?: string;
    duration_days?: number;
  }) => req<ApprovalRequest>("/approvals/manual", { method: "POST", body: JSON.stringify(data) }),

  updateApprovalDetails: (id: string, userId: string, data: Partial<Pick<ApprovalRequest,
    "counterparty_name" | "stone_type_manual" | "stone_carat_manual" | "stone_price_manual" |
    "stone_currency_manual" | "collected_date" | "returned_date" | "notes" | "status"
  >>) => req<ApprovalRequest>(`/approvals/${id}/details`, { method: "PATCH", body: JSON.stringify({ user_id: userId, ...data }) }),

  deleteManualApproval: (id: string, userId: string) =>
    req<{ ok: boolean }>(`/approvals/manual/${id}?user_id=${userId}`, { method: "DELETE" }),

  getMyPartnerListings: (userId: string) =>
    req<PartnerListing[]>(`/approvals/partner-listings?user_id=${userId}`),

  getPublicPartnerListings: () =>
    req<PartnerListing[]>("/approvals/partner-listings/public"),

  getCompanyPartnerListings: (companyId: string) =>
    req<PartnerListing[]>(`/approvals/partner-listings/for-company/${companyId}`),

  // ── Trader CRM ──────────────────────────────────────────────────────────────
  trm: {
    // Contacts
    getContacts: (userId: string) =>
      req<TradeContact[]>(`/trade-crm/contacts?user_id=${userId}`),
    createContact: (userId: string, data: Partial<TradeContact>) =>
      req<TradeContact>("/trade-crm/contacts", { method: "POST", body: JSON.stringify({ ...data, user_id: userId }) }),
    updateContact: (userId: string, id: string, data: Partial<TradeContact>) =>
      req<TradeContact>(`/trade-crm/contacts/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, user_id: userId }) }),
    deleteContact: (userId: string, id: string) =>
      req<{ success: boolean }>(`/trade-crm/contacts/${id}`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),

    // Deals
    getDeals: (userId: string) =>
      req<TradeDeal[]>(`/trade-crm/deals?user_id=${userId}`),
    createDeal: (userId: string, data: Partial<TradeDeal>) =>
      req<TradeDeal>("/trade-crm/deals", { method: "POST", body: JSON.stringify({ ...data, user_id: userId }) }),
    updateDeal: (userId: string, id: string, data: Partial<TradeDeal>) =>
      req<TradeDeal>(`/trade-crm/deals/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, user_id: userId }) }),
    deleteDeal: (userId: string, id: string) =>
      req<{ success: boolean }>(`/trade-crm/deals/${id}`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),

    // Invoices
    getInvoices: (userId: string) =>
      req<TradeInvoice[]>(`/trade-crm/invoices?user_id=${userId}`),
    getInvoice: (userId: string, id: string) =>
      req<TradeInvoice>(`/trade-crm/invoices/${id}?user_id=${userId}`),
    createInvoice: (userId: string, data: Partial<TradeInvoice>) =>
      req<TradeInvoice>("/trade-crm/invoices", { method: "POST", body: JSON.stringify({ ...data, user_id: userId }) }),
    updateInvoice: (userId: string, id: string, data: Partial<TradeInvoice>) =>
      req<TradeInvoice>(`/trade-crm/invoices/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, user_id: userId }) }),
    deleteInvoice: (userId: string, id: string) =>
      req<{ success: boolean }>(`/trade-crm/invoices/${id}`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),
    sendInvoiceEmail: (userId: string, id: string, email?: string) =>
      req<{ success: boolean }>(`/trade-crm/invoices/${id}/send-email`, { method: "POST", body: JSON.stringify({ user_id: userId, email }) }),

    // Payments
    getPayments: (userId: string) =>
      req<TradePayment[]>(`/trade-crm/payments?user_id=${userId}`),
    recordPayment: (userId: string, data: Partial<TradePayment>) =>
      req<TradePayment>("/trade-crm/payments", { method: "POST", body: JSON.stringify({ ...data, user_id: userId }) }),
    deletePayment: (userId: string, id: string) =>
      req<{ success: boolean }>(`/trade-crm/payments/${id}`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),

    // Analytics
    getAnalytics: (userId: string) =>
      req<TradeAnalytics>(`/trade-crm/analytics?user_id=${userId}`),

    // Invite external contact
    invite: (userId: string, data: { name: string; phone?: string; email?: string; channel?: "whatsapp" | "email" }) =>
      req<{ success: boolean; whatsapp_link: string | null; email_sent: boolean }>("/sales-ledger/invite", { method: "POST", body: JSON.stringify({ ...data, user_id: userId }) }),
  },

  // ── Sales Ledger (Receivables) ─────────────────────────────────────────────
  sl: {
    list: (userId: string, filter = "all") =>
      req<SalesRecord[]>(`/sales-ledger?user_id=${userId}&filter=${filter}`),
    create: (userId: string, data: Partial<SalesRecord>) =>
      req<SalesRecord>("/sales-ledger", { method: "POST", body: JSON.stringify({ ...data, user_id: userId }) }),
    update: (userId: string, id: string, data: Partial<SalesRecord>) =>
      req<SalesRecord>(`/sales-ledger/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, user_id: userId }) }),
    remove: (userId: string, id: string) =>
      req<{ success: boolean }>(`/sales-ledger/${id}`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),
    getPayments: (userId: string, saleId: string) =>
      req<LedgerPayment[]>(`/sales-ledger/${saleId}/payments?user_id=${userId}`),
    addPayment: (userId: string, saleId: string, data: Partial<LedgerPayment>) =>
      req<LedgerPayment>(`/sales-ledger/${saleId}/payments`, { method: "POST", body: JSON.stringify({ ...data, user_id: userId }) }),
    deletePayment: (userId: string, paymentId: string) =>
      req<{ success: boolean }>(`/sales-ledger/payments/${paymentId}`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),
    remind: (userId: string, saleId: string) =>
      req<{ success: boolean; whatsapp_link: string | null; email_sent: boolean; message: string }>(`/sales-ledger/${saleId}/remind`, { method: "POST", body: JSON.stringify({ user_id: userId }) }),
    summary: (userId: string) =>
      req<SalesSummary>(`/sales-ledger/summary?user_id=${userId}`),
  },

  // ── Payables Ledger ────────────────────────────────────────────────────────
  pl: {
    list: (userId: string, filter = "all") =>
      req<PayableRecord[]>(`/payables-ledger?user_id=${userId}&filter=${filter}`),
    create: (userId: string, data: Partial<PayableRecord>) =>
      req<PayableRecord>("/payables-ledger", { method: "POST", body: JSON.stringify({ ...data, user_id: userId }) }),
    update: (userId: string, id: string, data: Partial<PayableRecord>) =>
      req<PayableRecord>(`/payables-ledger/${id}`, { method: "PATCH", body: JSON.stringify({ ...data, user_id: userId }) }),
    remove: (userId: string, id: string) =>
      req<{ success: boolean }>(`/payables-ledger/${id}`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),
    getPayments: (userId: string, payableId: string) =>
      req<LedgerPayment[]>(`/payables-ledger/${payableId}/payments?user_id=${userId}`),
    addPayment: (userId: string, payableId: string, data: Partial<LedgerPayment>) =>
      req<LedgerPayment>(`/payables-ledger/${payableId}/payments`, { method: "POST", body: JSON.stringify({ ...data, user_id: userId }) }),
    deletePayment: (userId: string, paymentId: string) =>
      req<{ success: boolean }>(`/payables-ledger/payments/${paymentId}`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),
    remind: (userId: string, payableId: string) =>
      req<{ success: boolean; whatsapp_link: string | null; email_sent: boolean; message: string }>(`/payables-ledger/${payableId}/remind`, { method: "POST", body: JSON.stringify({ user_id: userId }) }),
    summary: (userId: string) =>
      req<PayablesSummary>(`/payables-ledger/summary?user_id=${userId}`),
  },

  // ── AstroBot Leads ──────────────────────────────────────────────────────────
  astro: {
    recommend: (data: { date_of_birth: string; concern?: string; budget_preference?: string; ref_trader_id?: string }) =>
      req<AstroResult>("/astrobot/recommend", { method: "POST", body: JSON.stringify(data) }),
    captureLead: (data: { trader_id: string; customer_name: string; customer_phone: string; customer_email?: string; recommended_gemstone: string; zodiac?: string; concern?: string; budget?: string; astro_reason?: string }) =>
      req<{ success: boolean; lead: AstrobotLead; whatsapp_trader_link: string | null; whatsapp_customer_link: string; message: string }>("/astrobot/lead", { method: "POST", body: JSON.stringify(data) }),
    getLeads: (traderId: string) =>
      req<AstrobotLead[]>(`/astrobot/leads/${traderId}`),
    updateLead: (leadId: string, data: { status?: AstrobotLead["status"]; notes?: string }) =>
      req<AstrobotLead>(`/astrobot/leads/${leadId}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

};

export interface ConvertProspectResult { success: boolean; user_id: string; email: string; temp_password: string; }

// ── AstroBot types ────────────────────────────────────────────────────────────
export interface AstroListing {
  id: string;
  stone_type: string;
  carat: number;
  origin: string;
  treatment: string;
  price: number;
  currency: string;
  images: string[];
  is_featured: boolean;
  seller_id: string;
}

export interface AstroResult {
  zodiac: string;
  planet: string;
  element: string;
  zodiac_gemstone: string;
  concern_override: string | null;
  recommended_gemstone: string;
  reason: string;
  suggested_quality: string;
  quality_description: string;
  listings: AstroListing[];
  trader_has_stock: boolean;
  trader_info: { name: string; company: string | null; phone: string | null } | null;
}

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

// ── Endorsements ──────────────────────────────────────────────────────────────
export interface Endorsement {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  years_known: number | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  accepted_at: string | null;
  // enriched fields from API
  from_name?: string;
  from_logo?: string | null;
  from_verification_badge?: string | null;
  to_name?: string;
  to_logo?: string | null;
  new_trust_score?: number | null;
}

export interface SalesUserPublic {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  role?: string;
}

export interface SalesDashboard {
  total_prospects: number;
  by_status: Record<string, number>;
  recent_prospects: CrmProspect[];
  platform: { verified_sellers: number; active_listings: number };
}

export interface CrmProspect {
  id: string;
  name: string;
  company: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status: "prospect" | "contacted" | "demo" | "onboarded" | "declined" | "converted";
  converted_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Phase 4 — Connections ───────────────────────────────────────────────────
export type ConnectionStatus = "pending" | "accepted" | "rejected";
export interface Connection {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: ConnectionStatus;
  created_at: string;
  accepted_at: string | null;
  other_name: string;
  other_logo: string | null;
  other_id: string;
  other_user_type: string | null;
  other_verification_badge: string | null;
}

const API_BASE = "/api";

export async function sendConnectionRequest(fromUserId: string, toUserId: string): Promise<Connection> {
  const r = await fetch(`${API_BASE}/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from_user_id: fromUserId, to_user_id: toUserId }),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Connection>;
}

export async function fetchPendingConnections(userId: string): Promise<Connection[]> {
  const r = await fetch(`${API_BASE}/connections/pending/${userId}`);
  return r.json() as Promise<Connection[]>;
}

export async function fetchAcceptedConnections(userId: string): Promise<Connection[]> {
  const r = await fetch(`${API_BASE}/connections/accepted/${userId}`);
  return r.json() as Promise<Connection[]>;
}

export async function fetchSentConnections(userId: string): Promise<Connection[]> {
  const r = await fetch(`${API_BASE}/connections/sent/${userId}`);
  return r.json() as Promise<Connection[]>;
}

export async function acceptConnection(connId: string, userId: string): Promise<Connection> {
  const r = await fetch(`${API_BASE}/connections/${connId}/accept`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Connection>;
}

export async function rejectConnection(connId: string, userId: string): Promise<Connection> {
  const r = await fetch(`${API_BASE}/connections/${connId}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Connection>;
}

// ─── Phase 5 — Credits ───────────────────────────────────────────────────────
export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: "earn" | "spend";
  reason: string;
  reference_id: string | null;
  created_at: string;
}

export async function fetchCreditBalance(userId: string): Promise<{ user_id: string; balance: number }> {
  const r = await fetch(`${API_BASE}/credits/balance/${userId}`);
  return r.json() as Promise<{ user_id: string; balance: number }>;
}

export async function fetchCreditHistory(userId: string): Promise<CreditTransaction[]> {
  const r = await fetch(`${API_BASE}/credits/history/${userId}`);
  return r.json() as Promise<CreditTransaction[]>;
}

// ─── Phase 6 — Deals ─────────────────────────────────────────────────────────
export type DealStatus = "proposed" | "confirmed" | "completed" | "cancelled" | "disputed";
export interface Deal {
  id: string;
  buyer_id: string;
  seller_id: string;
  gem_id: string | null;
  amount_usd: number;
  description: string;
  status: DealStatus;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  buyer_name: string;
  seller_name: string;
}

export async function fetchMyDeals(userId: string): Promise<Deal[]> {
  const r = await fetch(`${API_BASE}/deals/my/${userId}`);
  return r.json() as Promise<Deal[]>;
}

export async function proposeDeal(data: {
  buyer_id: string; seller_id: string; gem_id?: string | null;
  amount_usd: number; description: string;
}): Promise<Deal> {
  const r = await fetch(`${API_BASE}/deals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Deal>;
}

export async function confirmDeal(dealId: string, userId: string): Promise<Deal> {
  const r = await fetch(`${API_BASE}/deals/${dealId}/confirm`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Deal>;
}

export async function completeDeal(dealId: string, userId: string): Promise<Deal> {
  const r = await fetch(`${API_BASE}/deals/${dealId}/complete`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Deal>;
}

export async function cancelDeal(dealId: string, userId: string, notes?: string): Promise<Deal> {
  const r = await fetch(`${API_BASE}/deals/${dealId}/cancel`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, notes }),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Deal>;
}

// ─── Phase 7 — Disputes ──────────────────────────────────────────────────────
export type DisputeStatus = "open" | "investigating" | "resolved_buyer" | "resolved_seller" | "dismissed";
export interface Dispute {
  id: string;
  deal_id: string | null;
  filed_by: string;
  against_user_id: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  filed_by_name: string;
  against_name: string;
}

export async function fileDispute(data: {
  filed_by: string; against_user_id: string; deal_id?: string | null;
  reason: string; description: string;
}): Promise<Dispute> {
  const r = await fetch(`${API_BASE}/disputes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Dispute>;
}

export async function fetchMyDisputes(userId: string): Promise<Dispute[]> {
  const r = await fetch(`${API_BASE}/disputes/my/${userId}`);
  return r.json() as Promise<Dispute[]>;
}

export async function fetchAdminDisputes(adminId: string): Promise<Dispute[]> {
  const r = await fetch(`${API_BASE}/admin/disputes`, {
    headers: { "x-admin-id": adminId },
  });
  return r.json() as Promise<Dispute[]>;
}

export async function resolveDispute(adminId: string, disputeId: string, status: DisputeStatus, resolution?: string): Promise<Dispute> {
  const r = await fetch(`${API_BASE}/admin/disputes/${disputeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-id": adminId },
    body: JSON.stringify({ status, resolution }),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Dispute>;
}

// ─── Phase 10 — Activity Feed ────────────────────────────────────────────────
export interface Activity {
  id: string;
  user_id: string;
  type: string;
  label: string;
  metadata: Record<string, unknown>;
  is_public: boolean;
  created_at: string;
}

export async function fetchActivities(userId: string, limit = 20): Promise<Activity[]> {
  const r = await fetch(`${API_BASE}/activities/${userId}?limit=${limit}`);
  return r.json() as Promise<Activity[]>;
}

// ─── Phase 16 — Gem Terminology ──────────────────────────────────────────────
export type GemTermCategory = "gemstone" | "quality" | "treatment" | "trade" | "grading" | "cut" | "origin";
export interface GemTerm {
  id: string;
  term: string;
  slug: string;
  category: GemTermCategory;
  definition: string;
  properties?: string;
  related_terms?: string[];
  example?: string;
}

export const GEM_TERM_CATEGORY_LABELS: Record<GemTermCategory, string> = {
  gemstone: "Gemstones",
  quality: "Quality Grades",
  treatment: "Treatments",
  trade: "Trade Terms",
  grading: "Grading & Labs",
  cut: "Cut Styles",
  origin: "Origins",
};

export async function fetchGemTerms(category?: GemTermCategory): Promise<GemTerm[]> {
  const url = category ? `${API_BASE}/gem-knowledge/terms?category=${category}` : `${API_BASE}/gem-knowledge/terms`;
  const r = await fetch(url);
  return r.json() as Promise<GemTerm[]>;
}

export async function searchGemTerms(q: string): Promise<GemTerm[]> {
  const r = await fetch(`${API_BASE}/gem-knowledge/search?q=${encodeURIComponent(q)}`);
  return r.json() as Promise<GemTerm[]>;
}

export async function fetchGemTerm(slug: string): Promise<GemTerm> {
  const r = await fetch(`${API_BASE}/gem-knowledge/terms/${slug}`);
  if (!r.ok) throw new Error("Term not found");
  return r.json() as Promise<GemTerm>;
}

initLiveRates();
