import { Router, type IRouter } from "express";
import { addNotification } from "../lib/notifications.js";
import { sendVerificationOTP, sendVerificationSubmittedConfirmation, sendEmailVerifiedConfirmation, sendPasswordResetOTP } from "../lib/email.js";
import { saveUsers } from "../lib/persist.js";
import { notifyUserVerified, notifyAdminNewSignup, notifyAdminEmailVerified } from "../lib/whatsapp.js";
import { randomUUID } from "crypto";
import { ensureUniqueReferralCode, createPendingReferral, checkAndCompleteReferral } from "./referrals.js";
import { applyTrustScore, calculateTrustScore } from "../lib/trustScore.js";
import {
  launchState,
  getVerificationFee,
  getSubscriptionPrice,
  getAnnualSubscriptionPrice,
  ANNUAL_DISCOUNT,
  FREE_BOOSTS_DURING_LAUNCH,
  SUBSCRIPTION_PRICES,
  SUBSCRIPTION_ANNUAL_PRICES,
  VERIFICATION_FEES,
  SINGLE_BOOST_COST_USD,
  BOOST_PACKS,
  type BoostPackType,
} from "../lib/launch.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

export type UserType = "b2b_trader" | "retailer" | "miner" | "manufacturer" | "gems_lab";
export type VerificationStatus = "unverified" | "basic_verified" | "verified" | "legacy_verified";
export type VerificationBadge = "none" | "basic_verified" | "verified" | "legacy_verified";
export type VerifiableTier = "basic_verified" | "verified" | "legacy_verified";
export type SubscriptionPlan = "basic" | "pro" | "premium";
export type PreferredLanguage = "en" | "hi" | "th" | "ar" | "ru" | "fa" | "ur";

export const USER_TYPE_LABELS: Record<UserType, string> = {
  b2b_trader: "Trader",
  retailer: "Retailer",
  miner: "Miner",
  manufacturer: "Manufacturer",
  gems_lab: "Gems Lab",
};

const VALID_USER_TYPES: UserType[] = ["b2b_trader", "retailer", "miner", "manufacturer", "gems_lab"];

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlan,
  { max_listings: number | null; label: string }
> = {
  basic:   { max_listings: 5,    label: "Basic"   },
  pro:     { max_listings: 50,   label: "Pro"     },
  premium: { max_listings: null, label: "Premium" },
};

export const FREE_VERIFICATION_SLOTS = 50;
export let verificationRequestCount = 0;

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  user_type: UserType;
  company_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_number: string | null;
  trade_license_number: string | null;
  trade_license_document_url: string | null;
  owner_name: string | null;
  government_id_number: string | null;
  government_id_document_url: string | null;
  website: string | null;
  logo_url: string | null;
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
  verification_fee_paid: boolean;
  verification_badge: VerificationBadge;
  requested_tier?: VerifiableTier;
  verification_requested_at?: string;
  verification_payment_amount?: number;
  email_verified: boolean;
  email_verification_code: string | null;
  password_reset_code: string | null;
  password_reset_expires: string | null;
  subscription_plan: SubscriptionPlan;
  subscription_payment_status?: "paid" | "unpaid";
  subscription_billing_cycle?: "monthly" | "annual";
  subscription_expires_at?: string;
  trial_ends_at?: string;
  trial_notified_at?: string;
  trial_expired_notified_at?: string;
  free_boosts: number;
  extra_listing_credits: number;
  is_founding_seller: boolean;
  is_online: boolean;
  last_active_at: string;
  created_at: string;
  is_admin?: boolean;
  is_blocked?: boolean;
  referral_code?: string;
  referred_by?: string;
  whatsapp_opt_in?: boolean;
  listing_reminder_sent_at?: string;
  company_description?: string | null;
  instagram_url?: string | null;
  facebook_page_url?: string | null;
  store_slug?: string | null;
  credits?: number;
  default_currency?: string | null;
}

export const users: User[] = [];

function generateStoreSlug(companyName: string, existingUsers: User[], excludeId?: string): string {
  const base = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40) || "store";
  const taken = (s: string) => existingUsers.some((u) => u.id !== excludeId && u.store_slug === s);
  if (!taken(base)) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`;
    if (!taken(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toPublicProfile(u: User) {
  return {
    id: u.id,
    name: u.name,
    user_type: u.user_type,
    user_type_label: USER_TYPE_LABELS[u.user_type] ?? u.user_type,
    company_name: u.company_name,
    website: u.website,
    logo_url: u.logo_url,
    owner_name: u.owner_name,
    city: u.city,
    country: u.country,
    years_in_business: u.years_in_business ?? null,
    specialization: u.specialization ?? null,
    preferred_language: u.preferred_language ?? "en",
    trust_score: u.trust_score ?? 0,
    deals_completed: u.deals_completed ?? 0,
    on_time_payments: u.on_time_payments ?? 0,
    delayed_payments: u.delayed_payments ?? 0,
    disputes_count: u.disputes_count ?? 0,
    response_rate: u.response_rate ?? 0,
    endorsements_count: u.endorsements_count ?? 0,
    gallery_urls: u.gallery_urls ?? [],
    rating: u.rating,
    total_reviews: u.total_reviews,
    verification_status: u.verification_status,
    verification_badge: u.verification_badge,
    requested_tier: u.requested_tier ?? null,
    verification_requested_at: u.verification_requested_at ?? null,
    verification_payment_amount: u.verification_payment_amount ?? null,
    email_verified: u.email_verified,
    subscription_plan: u.subscription_plan,
    free_boosts: u.free_boosts,
    extra_listing_credits: u.extra_listing_credits ?? 0,
    is_founding_seller: u.is_founding_seller,
    is_online: u.is_online,
    last_active_at: u.last_active_at,
    created_at: u.created_at,
    referral_code: u.referral_code ?? null,
    company_description: u.company_description ?? null,
    instagram_url: u.instagram_url ?? null,
    facebook_page_url: u.facebook_page_url ?? null,
    store_slug: u.store_slug ?? null,
    address: u.address,
    whatsapp_opt_in: u.whatsapp_opt_in ?? true,
    credits: u.credits ?? 0,
    default_currency: u.default_currency ?? null,
    trial_ends_at: u.trial_ends_at ?? null,
    subscription_payment_status: u.subscription_payment_status ?? "unpaid",
    subscription_billing_cycle: u.subscription_billing_cycle ?? "monthly",
  };
}

function calcVerificationPrice(tier: VerifiableTier): { original: number; final: number; is_free: boolean } {
  const original = VERIFICATION_FEES[tier];
  return { original, final: original, is_free: original === 0 };
}

router.get("/verification-pricing", (_req, res) => {
  res.json({
    pricing: {
      basic_verified: calcVerificationPrice("basic_verified"),
      verified: calcVerificationPrice("verified"),
      legacy_verified: calcVerificationPrice("legacy_verified"),
    },
  });
});

router.get("/users", (_req, res) => {
  res.json(users.map(toPublicProfile));
});

router.get("/profile/:id", (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    ...toPublicProfile(user),
    contact_number: user.contact_number,
    trade_license_number: user.trade_license_number ?? null,
    trade_license_document_url: user.trade_license_document_url ?? null,
    government_id_number: user.government_id_number ?? null,
    government_id_document_url: user.government_id_document_url ?? null,
  });
});

router.post("/signup", (req, res) => {
  const { name, email, password, user_type, company_name, address, contact_number, city, state, country, latitude, longitude, referral_code: incomingRefCode } = req.body as Partial<{
    name: string;
    email: string;
    password: string;
    user_type: UserType;
    company_name: string;
    address: string;
    contact_number: string;
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
    referral_code: string;
  }>;

  if (!name || !email || !password || !user_type || !company_name?.trim() || !address?.trim() || !contact_number?.trim()) {
    res.status(400).json({ error: "name, email, password, user_type, company_name, address, and contact_number are required" });
    return;
  }

  if (!VALID_USER_TYPES.includes(user_type)) {
    res.status(400).json({
      error: "user_type must be one of: b2b_trader, retailer, miner, manufacturer, gems_lab",
    });
    return;
  }

  if (users.some((u) => u.email === email)) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const isLaunch = launchState.is_launch_period;
  const code = generateVerificationCode();
  const now = new Date().toISOString();

  const starterExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const newReferralCode = ensureUniqueReferralCode(name);

  const referrer = incomingRefCode
    ? users.find((u) => u.referral_code === incomingRefCode.toUpperCase().trim() && !u.is_admin)
    : null;

  const newUser: User = {
    id: randomUUID(),
    name,
    email,
    password,
    user_type,
    company_name: company_name ?? null,
    address: address?.trim() ?? null,
    city: city ?? null,
    state: state ?? null,
    country: country ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    contact_number: contact_number?.trim() ?? null,
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
    trust_score: 0,
    deals_completed: 0,
    on_time_payments: 0,
    delayed_payments: 0,
    disputes_count: 0,
    response_rate: 0,
    endorsements_count: 0,
    gallery_urls: [],
    rating: 0,
    total_reviews: 0,
    verification_status: "unverified",
    verification_fee_paid: false,
    verification_badge: "none",
    email_verified: false,
    email_verification_code: code,
    password_reset_code: null,
    password_reset_expires: null,
    subscription_plan: "premium",
    subscription_expires_at: starterExpiry,
    subscription_payment_status: "unpaid",
    trial_ends_at: starterExpiry,
    free_boosts: isLaunch ? FREE_BOOSTS_DURING_LAUNCH : 0,
    extra_listing_credits: 0,
    is_founding_seller: isLaunch,
    is_online: true,
    last_active_at: now,
    created_at: now,
    referral_code: newReferralCode,
    referred_by: referrer?.id,
    whatsapp_opt_in: true,
    store_slug: generateStoreSlug(company_name ?? name, users),
    credits: 50,
  };

  users.push(newUser);
  saveUsers(users);

  if (referrer && referrer.id !== newUser.id) {
    createPendingReferral(referrer.id, newUser.id, email, company_name ?? name);
  }
  addNotification(
    "new_user",
    "New User Registered",
    `${name} (${email}) signed up as ${user_type.replace("_", " ")} — pending email verification.`,
    { user_id: newUser.id }
  );

  sendVerificationOTP(email, name, code).catch((err) =>
    logger.error({ email, err }, "Failed to send verification OTP email")
  );

  const adminUrl = (process.env.APP_URL ?? "https://luckybirthstone.com") + "/admin";
  notifyAdminNewSignup(newUser, adminUrl).catch(() => {});

  res.status(201).json({
    ...toPublicProfile(newUser),
    _message: `Verification code sent to ${email}. Use it to verify your email.`,
    ...(isLaunch && {
      _launch_perks: {
        founding_seller_badge: true,
        free_boosts: FREE_BOOSTS_DURING_LAUNCH,
        message: "Welcome Founding Member! You have been granted launch perks.",
      },
    }),
  });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body as Partial<{ email: string; password: string }>;

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const user = users.find((u) => u.email === email);
  if (!user || user.password !== password) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.is_blocked) {
    res.status(403).json({ error: "Your account has been suspended. Please raise a support ticket from your dashboard." });
    return;
  }

  user.is_online = true;
  user.last_active_at = new Date().toISOString();

  res.json({
    ...toPublicProfile(user),
    _authenticated: true,
  });
});

router.post("/logout/:id", (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  user.is_online = false;
  res.json({ message: "Logged out" });
});

router.post("/resend-verification", (req, res) => {
  const { email } = req.body as Partial<{ email: string }>;
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  const user = users.find((u) => u.email === email);
  if (!user) {
    res.json({ message: "If that email is registered, a new code has been sent." });
    return;
  }
  if (user.email_verified) {
    res.json({ message: "Email is already verified." });
    return;
  }
  const code = generateVerificationCode();
  user.email_verification_code = code;
  saveUsers(users);

  sendVerificationOTP(user.email, user.name, code).catch((err) =>
    logger.error({ email: user.email, err }, "Failed to resend verification OTP")
  );

  res.json({ message: "A new verification code has been sent to your email." });
});

router.post("/verify-email", (req, res) => {
  const { email, code } = req.body as Partial<{ email: string; code: string }>;

  if (!email || !code) {
    res.status(400).json({ error: "email and code are required" });
    return;
  }

  const user = users.find((u) => u.email === email);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.email_verified) {
    res.json({ message: "Email already verified", ...toPublicProfile(user) });
    return;
  }

  if (user.email_verification_code !== code) {
    res.status(400).json({ error: "Invalid verification code" });
    return;
  }

  user.email_verified = true;
  user.email_verification_code = null;
  saveUsers(users);

  sendEmailVerifiedConfirmation(user.email, user.name).catch((err) =>
    logger.error({ email: user.email, err }, "Failed to send email verified confirmation")
  );

  const adminPanelUrl = (process.env.APP_URL ?? "https://luckybirthstone.com") + "/admin";
  notifyAdminEmailVerified(user, adminPanelUrl).catch(() => {});

  checkAndCompleteReferral(user.id);

  res.json({ message: "Email verified successfully", ...toPublicProfile(user) });
});

router.get("/store/:slug", (req, res) => {
  const user = users.find((u) => u.store_slug === req.params["slug"]);
  if (!user) {
    res.status(404).json({ error: "Store not found" });
    return;
  }
  res.json(toPublicProfile(user));
});

router.patch("/profile/:id", (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const allowed: (keyof User)[] = [
    "name", "company_name", "address", "city", "state", "country",
    "latitude", "longitude", "contact_number", "website",
    "logo_url", "owner_name", "trade_license_number", "whatsapp_opt_in",
    "company_description", "instagram_url", "facebook_page_url",
    "years_in_business", "specialization", "preferred_language", "gallery_urls",
    "default_currency",
  ];

  for (const key of allowed) {
    if (key in req.body) {
      (user as unknown as Record<string, unknown>)[key] = req.body[key];
    }
  }

  if ("store_slug" in req.body) {
    const raw = String(req.body.store_slug ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 40);
    const slug = raw || generateStoreSlug(user.company_name ?? user.name, users, user.id);
    if (users.some((u) => u.id !== user.id && u.store_slug === slug)) {
      res.status(409).json({ error: "That store URL is already taken. Please choose a different one." });
      return;
    }
    user.store_slug = slug;
  }

  user.last_active_at = new Date().toISOString();
  applyTrustScore(user);
  saveUsers(users);
  res.json(toPublicProfile(user));
});

router.get("/profile/:id/trust-score", (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const breakdown = calculateTrustScore(user);
  res.json({
    user_id: user.id,
    trust_score: breakdown.final_score,
    breakdown,
  });
});

router.post("/forgot-password", (req, res) => {
  const { email } = req.body as Partial<{ email: string }>;
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  const user = users.find((u) => u.email === email);
  if (!user) {
    res.json({ message: "If that email is registered, a reset code has been sent." });
    return;
  }
  const code = generateVerificationCode();
  user.password_reset_code = code;
  user.password_reset_expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  saveUsers(users);

  sendPasswordResetOTP(user.email, user.name, code).catch((err) =>
    logger.error({ email: user.email, err }, "Failed to send password reset OTP")
  );

  res.json({ message: "If that email is registered, a reset code has been sent." });
});

router.post("/reset-password", (req, res) => {
  const { email, code, new_password } = req.body as Partial<{ email: string; code: string; new_password: string }>;
  if (!email || !code || !new_password) {
    res.status(400).json({ error: "email, code, and new_password are required" });
    return;
  }
  if (new_password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  const user = users.find((u) => u.email === email);
  if (!user || user.password_reset_code !== code) {
    res.status(400).json({ error: "Invalid or expired reset code" });
    return;
  }
  if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
    res.status(400).json({ error: "Reset code has expired. Please request a new one." });
    return;
  }
  user.password = new_password;
  user.password_reset_code = null;
  user.password_reset_expires = null;
  saveUsers(users);
  res.json({ message: "Password reset successfully. You can now log in." });
});

router.patch("/users/:id/subscription", (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { plan, billing_cycle } = req.body as Partial<{ plan: SubscriptionPlan; billing_cycle: "monthly" | "annual" }>;
  const VALID_PLANS: SubscriptionPlan[] = ["basic", "pro", "premium"];
  const cycle: "monthly" | "annual" = billing_cycle === "annual" ? "annual" : "monthly";

  if (!plan || !VALID_PLANS.includes(plan)) {
    res.status(400).json({ error: "plan must be one of basic, pro, premium" });
    return;
  }

  const planMeta = SUBSCRIPTION_PLANS[plan];
  const monthlyPrice = getSubscriptionPrice(plan);
  const annualPrice = getAnnualSubscriptionPrice(plan);
  const effectivePrice = cycle === "annual" ? annualPrice : monthlyPrice;

  user.subscription_plan = plan;
  user.subscription_billing_cycle = cycle;
  const now = new Date();
  const expiryDays = cycle === "annual" ? 365 : 30;
  user.subscription_expires_at = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
  saveUsers(users);

  res.json({
    ...toPublicProfile(user),
    _plan_details: {
      label: planMeta.label,
      price_usd: effectivePrice,
      billing_cycle: cycle,
      max_listings: planMeta.max_listings ?? "unlimited",
    },
  });
});

router.post("/users/:id/boost-packs", (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { pack } = req.body as Partial<{ pack: BoostPackType }>;
  const VALID_PACKS: BoostPackType[] = ["boosts_5", "boosts_10"];

  if (!pack || !VALID_PACKS.includes(pack)) {
    res.status(400).json({ error: "pack must be one of boosts_5, boosts_10" });
    return;
  }

  const packMeta = BOOST_PACKS[pack];
  user.free_boosts += packMeta.boosts;

  res.json({
    pack,
    boosts_added: packMeta.boosts,
    cost_usd: packMeta.price,
    boosts_available: user.free_boosts,
    standard_price_per_boost: SINGLE_BOOST_COST_USD,
    effective_price_per_boost: Math.round((packMeta.price / packMeta.boosts) * 100) / 100,
  });
});

router.post("/users/:id/verification-request", (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const {
    tier,
    trade_license_document_url,
    government_id_document_url,
  } = req.body as Partial<{
    tier: VerifiableTier;
    trade_license_document_url: string;
    government_id_document_url: string;
  }>;

  const VALID_TIERS: VerifiableTier[] = ["basic_verified", "verified", "legacy_verified"];

  if (!tier || !VALID_TIERS.includes(tier)) {
    res.status(400).json({ error: "tier must be one of basic_verified, verified, legacy_verified" });
    return;
  }

  if (user.verification_status !== "unverified") {
    res.status(400).json({ error: "User is already verified" });
    return;
  }

  if (user.requested_tier) {
    res.status(400).json({ error: "A verification request is already pending" });
    return;
  }

  const pricing = calcVerificationPrice(tier);

  if (trade_license_document_url) {
    user.trade_license_document_url = trade_license_document_url;
  }
  if (government_id_document_url) {
    user.government_id_document_url = government_id_document_url;
  }

  user.verification_requested_at = new Date().toISOString();
  user.verification_payment_amount = pricing.final;

  if (tier === "basic_verified") {
    user.verification_status = "basic_verified";
    user.verification_badge = "basic_verified";
    user.verification_fee_paid = true;
    saveUsers(users);
    res.json({
      ...toPublicProfile(user),
      pricing,
      message: "Basic Verified status granted instantly — your trust badge is now visible to buyers.",
    });
    return;
  }

  verificationRequestCount++;
  user.requested_tier = tier;
  user.verification_fee_paid = pricing.final === 0;

  addNotification(
    "new_user",
    "Verification Request Submitted",
    `${user.name} (${user.company_name ?? user.email}) applied for ${tier.replace(/_/g, " ")} — $${pricing.final}.`,
    { user_id: user.id }
  );

  sendVerificationSubmittedConfirmation(
    user.email,
    user.name,
    tier,
    pricing.final,
    pricing.is_free
  ).catch((err) =>
    logger.error({ userId: user.id, err }, "Failed to send verification confirmation email")
  );

  saveUsers(users);

  res.json({
    ...toPublicProfile(user),
    pricing,
    message: `Verification request for ${tier.replace(/_/g, " ")} submitted. Pending admin review (1–2 business days).`,
  });
});

router.patch("/users/:id/verification", (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { action } = req.body as Partial<{ action: "approve" | "reject" }>;

  if (!action || !["approve", "reject"].includes(action)) {
    res.status(400).json({ error: "action must be approve or reject" });
    return;
  }

  if (!user.verification_fee_paid || !user.requested_tier) {
    res.status(400).json({ error: "No pending verification request for this user" });
    return;
  }

  if (action === "approve") {
    user.verification_status = user.requested_tier;
    user.verification_badge = user.requested_tier;
    user.requested_tier = undefined;
    const siteBase = process.env.SITE_URL ?? "https://luckybirthstone.com";
    notifyUserVerified(user, `${siteBase}/dashboard`).catch((err) =>
      logger.error({ userId: user.id, err }, "[WhatsApp] Failed to send verification welcome")
    );
  } else {
    user.verification_fee_paid = false;
    user.requested_tier = undefined;
  }

  res.json(toPublicProfile(user));
});

// ─── GET /users/:id/listing-quota — listing credits overview ─────────────────
router.get("/users/:id/listing-quota", (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const planMeta = SUBSCRIPTION_PLANS[user.subscription_plan];
  const extraCredits = user.extra_listing_credits ?? 0;
  const planLimit = planMeta.max_listings;
  const effectiveLimit = planLimit === null ? null : planLimit + extraCredits;
  res.json({
    plan: user.subscription_plan,
    plan_label: planMeta.label,
    plan_limit: planLimit,
    extra_listing_credits: extraCredits,
    effective_limit: effectiveLimit,
    is_unlimited: planLimit === null,
  });
});

export default router;
