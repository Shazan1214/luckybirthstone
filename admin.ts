import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "crypto";
import {
  launchState,
  getLaunchConfigResponse,
  FREE_BOOSTS_DURING_LAUNCH,
} from "../lib/launch.js";
import { users, type VerificationStatus, type SubscriptionPlan } from "./users.js";
import { applyTrustScore, calculateTrustScore } from "../lib/trustScore.js";
import { checkAndCompleteReferral, referrals, ensureUniqueReferralCode } from "./referrals.js";
import { crmProspects, type CrmProspect } from "./crm.js";
import { inventory } from "./inventory.js";
import { saveInventory, saveUsers, saveCRM, saveSalesUsers } from "../lib/persist.js";
import { salesUsers, createSalesUser, toPublicSalesUser } from "../lib/salesUserStore.js";
import { transactions } from "./transactions.js";
import { notifications, addNotification } from "../lib/notifications.js";
import { runAutomationCycle } from "../lib/automation.js";
import { sendVerificationApproved, sendListingFeaturedComplimentary, sendListingReminderEmail, sendBroadcastEmail, sendVerificationReminderEmail, sendWhatsAppOptInEmail, sendProspectWelcomeEmail } from "../lib/email.js";
import { sendListingReminderWhatsApp, sendTemplateToPhone, notifyAllUsersNewListing, sendRawMessage } from "../lib/whatsapp.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const USD_RATES: Record<string, number> = { USD: 1, INR: 0.012, AED: 0.272, THB: 0.028 };
function toUSD(amount: number, currency: string): number {
  return Math.round(amount * (USD_RATES[currency] ?? 1) * 100) / 100;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminId = req.headers["x-admin-id"] as string | undefined;
  if (!adminId) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  const admin = users.find((u) => u.id === adminId);
  if (!admin || !admin.is_admin) {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  next();
}

// Allows both admins and active sales users
function requireAdminOrSales(req: Request, res: Response, next: NextFunction): void {
  const adminId = req.headers["x-admin-id"] as string | undefined;
  if (adminId) {
    const admin = users.find((u) => u.id === adminId && u.is_admin);
    if (admin) { next(); return; }
  }
  const salesId = req.headers["x-sales-id"] as string | undefined;
  if (salesId) {
    const salesUser = salesUsers.find((u) => u.id === salesId && u.is_active);
    if (salesUser) { next(); return; }
  }
  res.status(401).json({ error: "Auth required" });
}

router.post("/admin/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user || !user.is_admin) {
    res.status(401).json({ error: "Invalid credentials or not an admin account" });
    return;
  }
  res.json({ id: user.id, name: user.name, email: user.email, is_admin: true });
});

router.get("/admin/dashboard", requireAdmin, (_req, res) => {
  const now = new Date();
  const nonAdminUsers = users.filter((u) => !u.is_admin);
  const overdueTxns = transactions.filter(
    (t) => t.status !== "completed" && new Date(t.due_date) < now
  );
  const overdue_payments_usd = overdueTxns.reduce(
    (sum, t) => sum + toUSD(t.credit_amount, t.currency),
    0
  );
  const pendingVerifCount = nonAdminUsers.filter(
    (u) => u.verification_status === "unverified" && u.email_verified
  ).length;
  const newListingNotifCount = notifications.filter(
    (n) => n.type === "new_listing" && !n.read
  ).length;

  const alerts: { type: "warning" | "danger" | "info"; icon: string; message: string }[] = [];
  if (pendingVerifCount > 0) {
    alerts.push({ type: "warning", icon: "⚠️", message: `${pendingVerifCount} user${pendingVerifCount > 1 ? "s" : ""} pending verification` });
  }
  if (overdueTxns.length > 0) {
    alerts.push({ type: "danger", icon: "💰", message: `${overdueTxns.length} overdue transaction${overdueTxns.length > 1 ? "s" : ""}` });
  }
  if (newListingNotifCount > 0) {
    alerts.push({ type: "info", icon: "🆕", message: `${newListingNotifCount} new listing${newListingNotifCount > 1 ? "s" : ""} pending review` });
  }
  const expiringCount = nonAdminUsers.filter((u) => {
    if (!u.subscription_expires_at) return false;
    const exp = new Date(u.subscription_expires_at);
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return exp > now && exp <= threeDays;
  }).length;
  if (expiringCount > 0) {
    alerts.push({ type: "warning", icon: "📋", message: `${expiringCount} subscription${expiringCount > 1 ? "s" : ""} expiring within 3 days` });
  }

  res.json({
    total_users: nonAdminUsers.length,
    verified_users: nonAdminUsers.filter((u) => u.verification_status !== "unverified").length,
    active_subscriptions: nonAdminUsers.length,
    total_listings: inventory.filter((g) => g.listing_status !== "removed").length,
    overdue_transactions: overdueTxns.length,
    overdue_payments_usd: Math.round(overdue_payments_usd * 100) / 100,
    alerts,
    unread_notifications: notifications.filter((n) => !n.read).length,
  });
});

router.get("/admin/users", requireAdmin, (req, res) => {
  const { user_type, verification_status } = req.query as {
    user_type?: string;
    verification_status?: string;
  };
  let result = users.filter((u) => !u.is_admin);
  if (user_type) result = result.filter((u) => u.user_type === user_type);
  if (verification_status) result = result.filter((u) => u.verification_status === verification_status);
  res.json(
    result.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      user_type: u.user_type,
      company_name: u.company_name,
      address: u.address,
      owner_name: u.owner_name,
      website: u.website,
      verification_status: u.verification_status,
      requested_tier: u.requested_tier ?? null,
      subscription_plan: u.subscription_plan,
      subscription_payment_status: u.subscription_payment_status ?? "paid",
      subscription_expires_at: u.subscription_expires_at ?? null,
      email_verified: u.email_verified,
      is_founding_seller: u.is_founding_seller,
      is_online: u.is_online,
      rating: u.rating,
      total_reviews: u.total_reviews,
      created_at: u.created_at,
      last_active_at: u.last_active_at,
      trade_license_number: u.trade_license_number,
      trade_license_document_url: u.trade_license_document_url,
      government_id_document_url: u.government_id_document_url,
      is_blocked: u.is_blocked ?? false,
      contact_number: u.contact_number,
    }))
  );
});

router.get("/admin/users/:id", requireAdmin, (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _p, email_verification_code: _c, ...safe } = user;
  res.json({
    ...safe,
    subscription_payment_status: user.subscription_payment_status ?? "paid",
  });
});

router.patch("/admin/users/:id/verification", requireAdmin, (req, res) => {
  const { action, tier } = req.body as { action?: string; tier?: string };
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (action === "approve") {
    const newStatus = ((tier ?? user.requested_tier) || "basic_verified") as VerificationStatus;
    if (!["basic_verified", "verified", "legacy_verified"].includes(newStatus)) {
      res.status(400).json({ error: "Invalid verification tier" });
      return;
    }
    user.verification_status = newStatus;
    user.verification_badge = newStatus as "basic_verified" | "verified" | "legacy_verified";
    user.requested_tier = undefined;
    addNotification(
      "verification_approved",
      "Verification Approved",
      `${user.name} was approved as ${newStatus.replace("_", " ")}.`,
      { user_id: user.id }
    );
    sendVerificationApproved(user.email, user.name, newStatus).catch((err) =>
      logger.error({ userId: user.id, err }, "Failed to send verification approved email")
    );
    const userGems = inventory.filter((g) => g.seller_id === user.id);
    if (userGems.length === 0) {
      const siteBase = process.env.SITE_URL ?? "https://luckybirthstone.com";
      sendListingReminderEmail(user.email, user.name, user.company_name).catch((err) =>
        logger.error({ userId: user.id, err }, "Failed to send listing reminder email on verification")
      );
      sendListingReminderWhatsApp(user, `${siteBase}/dashboard`).catch((err) =>
        logger.error({ userId: user.id, err }, "Failed to send listing reminder WhatsApp on verification")
      );
      user.listing_reminder_sent_at = new Date().toISOString();
    }
    saveUsers(users);
    checkAndCompleteReferral(user.id);
    res.json({ success: true, verification_status: user.verification_status, verification_badge: user.verification_badge });
  } else if (action === "reject") {
    const prev = user.verification_status;
    user.verification_status = "unverified";
    user.verification_badge = "none";
    user.requested_tier = undefined;
    addNotification(
      "verification_rejected",
      "Verification Rejected",
      `${user.name}'s verification request was rejected (was: ${prev}).`,
      { user_id: user.id }
    );
    saveUsers(users);
    res.json({ success: true, verification_status: "unverified" });
  } else {
    res.status(400).json({ error: "action must be 'approve' or 'reject'" });
  }
});

router.patch("/admin/users/:id/plan", requireAdmin, (req, res) => {
  const { plan } = req.body as { plan?: string };
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!plan || !["basic", "pro", "premium"].includes(plan)) {
    res.status(400).json({ error: "plan must be basic, pro, or premium" });
    return;
  }
  user.subscription_plan = plan as SubscriptionPlan;
  saveUsers(users);
  res.json({ success: true, plan: user.subscription_plan });
});

router.post("/admin/users/:id/credits", requireAdmin, (req, res) => {
  const { amount } = req.body as { amount?: number };
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > 1000) {
    res.status(400).json({ error: "amount must be a positive integer between 1 and 1000" });
    return;
  }
  user.extra_listing_credits = (user.extra_listing_credits ?? 0) + amount;
  addNotification(
    "new_user",
    "Credits Added",
    `Admin added ${amount} listing credit${amount !== 1 ? "s" : ""} to ${user.name}. New total: ${user.extra_listing_credits}.`,
    { user_id: user.id }
  );
  saveUsers(users);
  res.json({ success: true, extra_listing_credits: user.extra_listing_credits });
});

router.patch("/admin/users/:id/profile", requireAdmin, (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const allowed = ["name", "company_name", "contact_number", "address", "city", "state", "country", "owner_name", "website", "company_description", "email"] as const;
  const body = req.body as Partial<Record<typeof allowed[number], string>>;
  for (const key of allowed) {
    if (key in body) {
      (user as unknown as Record<string, unknown>)[key] = body[key]?.trim() || null;
    }
  }
  applyTrustScore(user);
  saveUsers(users);
  logger.info({ userId: user.id }, "[ADMIN] Updated user profile");
  res.json({ success: true, user: { id: user.id, name: user.name, company_name: user.company_name, contact_number: user.contact_number, address: user.address, city: user.city, country: user.country, owner_name: user.owner_name, website: user.website, email: user.email } });
});

router.patch("/admin/users/:id/trust-stats", requireAdmin, (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const allowed = ["deals_completed", "on_time_payments", "delayed_payments", "disputes_count", "response_rate", "endorsements_count"] as const;
  const body = req.body as Partial<Record<typeof allowed[number], number>>;
  for (const key of allowed) {
    if (key in body && typeof body[key] === "number") {
      (user as unknown as Record<string, unknown>)[key] = body[key];
    }
  }
  applyTrustScore(user);
  saveUsers(users);
  logger.info({ userId: user.id, trust_score: user.trust_score }, "[ADMIN] Updated trust stats");
  res.json({ success: true, trust_score: user.trust_score, breakdown: calculateTrustScore(user) });
});

router.post("/admin/trust-scores/recalculate-all", requireAdmin, (_req, res) => {
  let updated = 0;
  for (const user of users) {
    const before = user.trust_score;
    applyTrustScore(user);
    if (user.trust_score !== before) updated++;
  }
  saveUsers(users);
  logger.info({ updated }, "[ADMIN] Bulk trust score recalculation complete");
  res.json({ success: true, total_users: users.length, updated });
});

router.get("/admin/users/:id/trust-score", requireAdmin, (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ user_id: user.id, trust_score: user.trust_score, breakdown: calculateTrustScore(user) });
});

router.patch("/admin/users/:id/whatsapp-optin", requireAdmin, (req, res) => {
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const { opt_in } = req.body as { opt_in?: boolean };
  if (typeof opt_in !== "boolean") { res.status(400).json({ error: "opt_in must be a boolean" }); return; }
  user.whatsapp_opt_in = opt_in;
  saveUsers(users);
  logger.info({ userId: user.id, opt_in }, "[ADMIN] Updated WhatsApp opt-in");
  res.json({ success: true, whatsapp_opt_in: user.whatsapp_opt_in });
});

// POST /admin/crm/:id/message — send email or WhatsApp to a single prospect
router.post("/admin/crm/:id/message", requireAdminOrSales, async (req, res) => {
  const prospect = crmProspects.find((p) => p.id === req.params["id"]);
  if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }

  const { channel, template_id = "custom", params = {} } = req.body as {
    channel: "email" | "whatsapp";
    template_id?: string;
    params?: Record<string, string>;
  };

  if (!channel) { res.status(400).json({ error: "channel is required" }); return; }
  const siteBase = process.env.SITE_URL ?? "https://luckybirthstone.com";

  try {
    if (channel === "whatsapp") {
      if (!prospect.phone) {
        res.status(400).json({ error: "Prospect has no phone number" });
        return;
      }
      if (template_id === "prospects_outreach") {
        const outreachText = [
          `Hi ${prospect.name},`,
          "",
          "Meet Gems Stones Dealers worldwide - manage accounts, trade, auction, chat or just be there..",
          "",
          "It's free!!",
          "",
          "luckybirthstone.com",
        ].join("\n");
        await sendRawMessage(prospect.phone, outreachText);
        logger.info({ prospectId: prospect.id }, "[ADMIN] prospects_outreach sent as raw WhatsApp message");
        res.json({ success: true, channel: "whatsapp" });
        return;
      }
      let waParams: string[];
      if (template_id === "listing_reminder") {
        waParams = [prospect.name, params["url"] || `${siteBase}/dashboard`];
      } else if (template_id === "new_listing_alert") {
        waParams = [
          params["company"] || "LuckyBirthstone",
          params["stone_type"] || "Gemstone",
          params["carat"] || "1",
          params["origin"] || "Unknown",
          params["url"] || siteBase,
        ];
      } else if (template_id === "new_auction_alert") {
        waParams = [
          params["stone_type"] || "Gemstone",
          params["carat"] || "1",
          params["starting_bid"] || "0",
          params["end_time"] || "",
          params["url"] || `${siteBase}/gem-auctions`,
        ];
      } else {
        waParams = Object.values(params);
      }
      await sendTemplateToPhone(prospect.phone, template_id, waParams);
      logger.info({ prospectId: prospect.id, template_id }, "[ADMIN] WhatsApp sent to prospect");
      res.json({ success: true, channel: "whatsapp" });
    } else {
      if (!prospect.email) {
        res.status(400).json({ error: "Prospect has no email address" });
        return;
      }
      const subject = params["subject"] || "Message from LuckyBirthstone";
      const body = params["body"] || "";
      if (!body.trim()) { res.status(400).json({ error: "Email body is required" }); return; }
      await sendBroadcastEmail(prospect.email, subject, body);
      logger.info({ prospectId: prospect.id }, "[ADMIN] Email sent to prospect");
      res.json({ success: true, channel: "email" });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Send failed";
    logger.error({ err, prospectId: prospect.id, channel }, "[ADMIN] Failed to message prospect");
    res.status(500).json({ error: msg });
  }
});

// POST /admin/crm/:id/convert — convert a CRM prospect into a live user account
router.post("/admin/crm/:id/convert", requireAdminOrSales, (req, res) => {
  const prospect = crmProspects.find((p) => p.id === req.params["id"]);
  if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }
  if (prospect.converted_user_id) { res.status(409).json({ error: "Prospect already converted", user_id: prospect.converted_user_id }); return; }

  const { user_type = "b2b_trader", address = "", city = "", country = "" } = req.body as Partial<{
    user_type: string; address: string; city: string; country: string;
  }>;

  const email = prospect.email?.trim();
  if (!email) { res.status(400).json({ error: "Prospect must have an email to convert" }); return; }
  if (users.some((u) => u.email === email)) { res.status(409).json({ error: "An account with this email already exists" }); return; }

  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const tempPassword = "Gem@" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  const now = new Date().toISOString();
  const referralCode = ensureUniqueReferralCode(prospect.name);

  const baseSlug = prospect.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 40) || "shop";
  let storeSlug = baseSlug;
  let n = 1;
  while (users.some((u) => u.store_slug === storeSlug)) { storeSlug = `${baseSlug}-${n++}`; }

  const newUser = {
    id: randomUUID(),
    name: prospect.name,
    email,
    password: tempPassword,
    user_type: (["b2b_trader", "retailer", "miner", "manufacturer", "gems_lab"].includes(user_type) ? user_type : "b2b_trader") as import("./users.js").UserType,
    company_name: prospect.company,
    address: address.trim() || null,
    city: city.trim() || null,
    state: null,
    country: country.trim() || null,
    latitude: null,
    longitude: null,
    contact_number: prospect.phone?.trim() || null,
    trade_license_number: null,
    trade_license_document_url: null,
    owner_name: null,
    government_id_number: null,
    government_id_document_url: null,
    website: null,
    logo_url: null,
    rating: 0,
    total_reviews: 0,
    verification_status: "unverified" as const,
    verification_fee_paid: false,
    verification_badge: "none",
    email_verified: true,
    email_verification_code: null,
    password_reset_code: null,
    password_reset_expires: null,
    subscription_plan: "basic" as const,
    subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_payment_status: "unpaid" as const,
    free_boosts: 0,
    extra_listing_credits: 0,
    is_founding_seller: false,
    is_online: false,
    last_active_at: now,
    created_at: now,
    referral_code: referralCode,
    whatsapp_opt_in: true,
    store_slug: storeSlug,
    is_admin: false,
    is_blocked: false,
    is_blocked_reason: null,
    company_description: null,
    instagram_url: null,
    facebook_page_url: null,
  };

  (users as unknown[]).push(newUser);
  saveUsers(users);

  prospect.status = "converted";
  prospect.converted_user_id = newUser.id;
  prospect.updated_at = now;
  saveCRM(crmProspects);

  const loginUrl = "https://luckybirthstone.com/signin";
  sendProspectWelcomeEmail(email, prospect.name, prospect.company, tempPassword, loginUrl).catch((err) =>
    logger.error({ err, email }, "[ADMIN] Failed to send prospect welcome email")
  );

  logger.info({ prospectId: prospect.id, userId: newUser.id, email }, "[ADMIN] Prospect converted to user account");
  res.status(201).json({ success: true, user_id: newUser.id, email, temp_password: tempPassword });
});

router.patch("/admin/users/:id/block", requireAdmin, (req, res) => {
  const { action } = req.body as { action?: string };
  const user = users.find((u) => u.id === req.params["id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.is_admin) {
    res.status(400).json({ error: "Cannot block an admin account" });
    return;
  }
  if (action === "block") {
    user.is_blocked = true;
    user.is_online = false;
    addNotification(
      "new_user",
      "User Blocked",
      `${user.name} (${user.email}) has been blocked by admin.`,
      { user_id: user.id }
    );
    saveUsers(users);
    res.json({ success: true, is_blocked: true });
  } else if (action === "unblock") {
    user.is_blocked = false;
    addNotification(
      "new_user",
      "User Unblocked",
      `${user.name} (${user.email}) has been reinstated by admin.`,
      { user_id: user.id }
    );
    saveUsers(users);
    res.json({ success: true, is_blocked: false });
  } else {
    res.status(400).json({ error: "action must be 'block' or 'unblock'" });
  }
});

router.get("/admin/verifications", requireAdmin, (req, res) => {
  const { status } = req.query as { status?: string };
  let verifiable = users.filter((u) => !u.is_admin);
  if (status === "pending") {
    verifiable = verifiable.filter((u) => !!u.requested_tier);
  } else if (status === "unverified") {
    verifiable = verifiable.filter((u) => u.verification_status === "unverified" && !u.requested_tier);
  } else {
    verifiable = verifiable.filter(
      (u) => u.verification_status !== "legacy_verified" || u.requested_tier
    );
  }
  res.json(
    verifiable.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      company_name: u.company_name,
      user_type: u.user_type,
      owner_name: u.owner_name,
      address: u.address,
      verification_status: u.verification_status,
      requested_tier: u.requested_tier ?? null,
      verification_requested_at: u.verification_requested_at ?? null,
      verification_payment_amount: u.verification_payment_amount ?? null,
      email_verified: u.email_verified,
      trade_license_number: u.trade_license_number,
      trade_license_document_url: u.trade_license_document_url,
      government_id_number: u.government_id_number,
      government_id_document_url: u.government_id_document_url,
      created_at: u.created_at,
    }))
  );
});

router.get("/admin/subscriptions", requireAdmin, (_req, res) => {
  res.json(
    users.filter((u) => !u.is_admin).map((u) => ({
      user_id: u.id,
      name: u.name,
      email: u.email,
      plan: u.subscription_plan,
      status: "active",
      payment_status: u.subscription_payment_status ?? "paid",
      expiry_date: u.subscription_expires_at ?? null,
      extra_listing_credits: u.extra_listing_credits ?? 0,
    }))
  );
});

router.patch("/admin/subscriptions/:userId", requireAdmin, (req, res) => {
  const { plan, payment_status } = req.body as { plan?: string; payment_status?: "paid" | "unpaid" };
  const user = users.find((u) => u.id === req.params["userId"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (plan && ["basic", "pro", "premium"].includes(plan)) {
    user.subscription_plan = plan as SubscriptionPlan;
  }
  if (payment_status === "paid" || payment_status === "unpaid") {
    user.subscription_payment_status = payment_status;
  }
  saveUsers(users);
  res.json({
    success: true,
    plan: user.subscription_plan,
    payment_status: user.subscription_payment_status,
  });
});

router.post("/admin/subscriptions/:userId/extend", requireAdmin, (req, res) => {
  const { days = 30 } = req.body as { days?: number };
  const user = users.find((u) => u.id === req.params["userId"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const base = user.subscription_expires_at
    ? new Date(user.subscription_expires_at)
    : new Date();
  if (base < new Date()) base.setTime(Date.now());
  base.setDate(base.getDate() + days);
  user.subscription_expires_at = base.toISOString();
  saveUsers(users);
  res.json({ success: true, subscription_expires_at: user.subscription_expires_at });
});

router.get("/admin/transactions", requireAdmin, (req, res) => {
  const { overdue } = req.query as { overdue?: string };
  const now = new Date();
  let result = [...transactions];
  if (overdue === "true") {
    result = result.filter((t) => t.status !== "completed" && new Date(t.due_date) < now);
  }
  res.json(
    result.map((t) => {
      const buyer = users.find((u) => u.id === t.buyer_id);
      const seller = users.find((u) => u.id === t.seller_id);
      return {
        ...t,
        buyer_name: buyer?.name ?? "Unknown",
        seller_name: seller?.name ?? "Unknown",
        is_overdue: t.status !== "completed" && new Date(t.due_date) < now,
      };
    })
  );
});

router.post("/admin/send-reminder", requireAdmin, (req, res) => {
  const { user_id, message } = req.body as { user_id?: string; message?: string };
  if (!user_id) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }
  const user = users.find((u) => u.id === user_id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const emailMessage = message?.trim() || "Your payment is overdue. Please clear dues.";
  console.log(`[EMAIL REMINDER] To: ${user.email} — ${emailMessage}`);
  res.json({ success: true, simulated: true, to: user.email, message: emailMessage });
});

router.get("/admin/listings", requireAdmin, (req, res) => {
  const { status } = req.query as { status?: string };
  let result = [...inventory];
  if (status) result = result.filter((g) => (g.listing_status ?? "approved") === status);
  res.json(
    result.map((g) => {
      const seller = users.find((u) => u.id === g.seller_id);
      return {
        ...g,
        seller_name: seller?.name ?? "Unknown",
        seller_email: seller?.email ?? "Unknown",
      };
    })
  );
});

router.put("/admin/listings/:id", requireAdmin, (req, res) => {
  const { action } = req.body as { action?: string };
  const gem = inventory.find((g) => g.id === req.params["id"]);
  if (!gem) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (action === "approve") {
    gem.listing_status = "approved";
    const approvedSeller = users.find((u) => u.id === gem.seller_id);
    const siteBase = process.env.SITE_URL ?? "https://luckybirthstone.com";
    notifyAllUsersNewListing(
      gem.stone_type,
      gem.carat,
      gem.origin ?? "Unknown",
      approvedSeller?.company_name ?? approvedSeller?.name ?? "A seller",
      `${siteBase}/listing/${gem.id}`,
      users,
      crmProspects
    ).catch((err) => logger.error({ listingId: gem.id, err }, "[WhatsApp] Failed to broadcast approved listing"));
  } else if (action === "remove") {
    gem.listing_status = "removed";
  } else if (action === "feature") {
    gem.is_featured = true;
    gem.boost_expiry_date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const seller = users.find((u) => u.id === gem.seller_id);
    if (seller) {
      sendListingFeaturedComplimentary(seller.email, seller.name, gem.stone_type).catch((err) =>
        logger.error({ listingId: gem.id, err }, "Failed to send listing featured complimentary email")
      );
    }
  } else {
    res.status(400).json({ error: "action must be 'approve', 'remove', or 'feature'" });
    return;
  }
  res.json({ success: true, listing_status: gem.listing_status, is_featured: gem.is_featured });
});

router.delete("/admin/listings/:id", requireAdmin, (req, res) => {
  const idx = inventory.findIndex((g) => g.id === req.params["id"]);
  if (idx === -1) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const deleted = inventory.splice(idx, 1)[0];
  saveInventory(inventory);
  addNotification(
    "new_listing",
    "Listing Permanently Deleted",
    `Listing ${deleted.stone_type} (${deleted.carat}ct, ${deleted.origin}) was permanently deleted by admin.`,
    { entity_id: deleted.id }
  );
  res.json({ success: true, deleted_id: req.params["id"] });
});

router.patch("/admin/listings/:id/promote", requireAdmin, (req, res) => {
  const gem = inventory.find((g) => g.id === req.params["id"]);
  if (!gem) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const { is_ad_promoted } = req.body as { is_ad_promoted?: boolean };
  gem.is_ad_promoted = is_ad_promoted !== undefined ? is_ad_promoted : !gem.is_ad_promoted;
  gem.ad_promoted_at = gem.is_ad_promoted ? new Date().toISOString() : null;
  saveInventory(inventory);
  res.json({ success: true, is_ad_promoted: gem.is_ad_promoted });
});

router.patch("/admin/listings/:id/edit", requireAdmin, (req, res) => {
  const gem = inventory.find((g) => g.id === req.params["id"]);
  if (!gem) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const { stone_type, carat, origin, treatment, color, clarity, price, currency, certificate_number } = req.body as Partial<{
    stone_type: string;
    carat: number;
    origin: string;
    treatment: string;
    color: string;
    clarity: string;
    price: number;
    currency: string;
    certificate_number: string;
  }>;
  if (stone_type !== undefined) gem.stone_type = stone_type;
  if (carat !== undefined) gem.carat = carat;
  if (origin !== undefined) gem.origin = origin;
  if (treatment !== undefined) gem.treatment = treatment;
  if (color !== undefined) gem.color = color;
  if (clarity !== undefined) gem.clarity = clarity;
  if (price !== undefined) {
    gem.price = price;
    gem.base_price_usd = toUSD(price, (currency ?? gem.currency) as string);
  }
  if (currency !== undefined) {
    gem.currency = currency as "USD" | "INR" | "AED" | "THB";
    gem.base_price_usd = toUSD(gem.price, currency);
  }
  if (certificate_number !== undefined) gem.certificate_number = certificate_number;
  saveInventory(inventory);
  res.json({ success: true, gem });
});

router.get("/admin/notifications", requireAdmin, (req, res) => {
  const { limit = "50", type } = req.query as { limit?: string; type?: string };
  let result = [...notifications];
  if (type) result = result.filter((n) => n.type === type);
  res.json(result.slice(0, parseInt(limit)));
});

router.patch("/admin/notifications/:id/read", requireAdmin, (req, res) => {
  const notif = notifications.find((n) => n.id === req.params["id"]);
  if (!notif) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  notif.read = true;
  res.json({ success: true });
});

router.post("/admin/notifications/read-all", requireAdmin, (_req, res) => {
  notifications.forEach((n) => { n.read = true; });
  res.json({ success: true, marked: notifications.length });
});

router.post("/admin/automation/run", requireAdmin, (_req, res) => {
  runAutomationCycle();
  res.json({ success: true, message: "Automation cycle triggered" });
});

router.get("/admin/referrals", requireAdmin, (_req, res) => {
  const totalReferrals = referrals.length;
  const successfulReferrals = referrals.filter((r) => r.status === "successful");
  const pendingReferrals = referrals.filter((r) => r.status === "pending");

  const referrerStats = new Map<string, { pending: number; successful: number }>();
  for (const r of referrals) {
    if (!referrerStats.has(r.referrer_id)) {
      referrerStats.set(r.referrer_id, { pending: 0, successful: 0 });
    }
    const s = referrerStats.get(r.referrer_id)!;
    if (r.status === "successful") s.successful++;
    else s.pending++;
  }

  const topReferrers = Array.from(referrerStats.entries())
    .map(([uid, stats]) => {
      const user = users.find((u) => u.id === uid);
      return {
        user_id: uid,
        name: user?.company_name ?? user?.name ?? "Unknown",
        email: user?.email ?? "",
        pending: stats.pending,
        successful: stats.successful,
        credits_earned: stats.successful * 5,
      };
    })
    .sort((a, b) => b.successful - a.successful)
    .slice(0, 20);

  const recentReferrals = [...referrals]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50)
    .map((r) => {
      const referrer = users.find((u) => u.id === r.referrer_id);
      const referred = users.find((u) => u.id === r.referred_user_id);
      return {
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        completed_at: r.completed_at,
        referrer_name: referrer?.company_name ?? referrer?.name ?? "Unknown",
        referrer_email: referrer?.email ?? "",
        referred_name: referred?.company_name ?? referred?.name ?? "Unknown",
        referred_email: referred?.email ?? "",
      };
    });

  res.json({
    total: totalReferrals,
    pending: pendingReferrals.length,
    successful: successfulReferrals.length,
    top_referrers: topReferrers,
    recent_referrals: recentReferrals,
  });
});

router.get("/admin/launch", (_req, res) => {
  res.json(getLaunchConfigResponse());
});

router.patch("/admin/launch", (req, res) => {
  const { is_launch_period } = req.body as Partial<{ is_launch_period: boolean }>;
  if (typeof is_launch_period !== "boolean") {
    res.status(400).json({ error: "is_launch_period must be a boolean" });
    return;
  }
  const wasLaunch = launchState.is_launch_period;
  launchState.is_launch_period = is_launch_period;
  if (is_launch_period && !wasLaunch) {
    let boosted = 0;
    for (const user of users) {
      if (!user.is_founding_seller) {
        user.free_boosts = FREE_BOOSTS_DURING_LAUNCH;
        user.is_founding_seller = true;
        boosted++;
      }
    }
    res.json({
      ...getLaunchConfigResponse(),
      _action: `Launch period enabled. ${boosted} existing seller(s) granted Founding Seller badge and ${FREE_BOOSTS_DURING_LAUNCH} free boosts.`,
    });
    return;
  }
  res.json(getLaunchConfigResponse());
});

// ─── POST /admin/broadcast ────────────────────────────────────────────────────

type BroadcastAudience = "all" | "verified" | "unverified" | "with_phone" | "specific";
type BroadcastChannel = "email" | "whatsapp";

router.post("/admin/broadcast", requireAdmin, async (req, res) => {
  const {
    channel,
    template_id,
    params = {},
    audience,
    user_ids = [],
  } = req.body as {
    channel: BroadcastChannel;
    template_id: string;
    params: Record<string, string>;
    audience: BroadcastAudience;
    user_ids: string[];
  };

  if (!channel || !template_id || !audience) {
    res.status(400).json({ error: "channel, template_id and audience are required" });
    return;
  }

  // Determine target users
  let targets = users.filter((u) => !u.is_admin && !u.is_blocked && u.email_verified);

  if (audience === "verified") {
    targets = targets.filter((u) => ["basic_verified", "verified", "legacy_verified"].includes(u.verification_status));
  } else if (audience === "unverified") {
    targets = targets.filter((u) => u.verification_status === "unverified");
  } else if (audience === "with_phone") {
    targets = targets.filter((u) => !!u.contact_number);
  } else if (audience === "specific") {
    targets = targets.filter((u) => user_ids.includes(u.id));
  }

  if (targets.length === 0) {
    res.json({ sent: 0, failed: 0, skipped: 0, message: "No matching users found" });
    return;
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const siteBase = process.env.SITE_URL ?? "https://luckybirthstone.com";

  const results = await Promise.allSettled(
    targets.map(async (user) => {
      if (channel === "whatsapp") {
        if (!user.contact_number || user.whatsapp_opt_in === false) {
          skipped++;
          return;
        }
        let waParams: string[];
        if (template_id === "listing_reminder") {
          waParams = [user.name, params["url"] || `${siteBase}/dashboard`];
        } else if (template_id === "new_listing_alert") {
          waParams = [
            params["company"] || "LuckyBirthstone",
            params["stone_type"] || "Gemstone",
            params["carat"] || "1",
            params["origin"] || "Unknown",
            params["url"] || siteBase,
          ];
        } else if (template_id === "new_auction_alert") {
          waParams = [
            params["stone_type"] || "Gemstone",
            params["carat"] || "1",
            params["starting_bid"] || "0",
            params["end_time"] || "",
            params["url"] || `${siteBase}/gem-auctions`,
          ];
        } else if (template_id === "raw_message") {
          // free-form raw text message (no registered template needed)
          const text = (params["message"] || "").replace(/\{name\}/g, user.name || "there");
          await sendRawMessage(user.contact_number, text);
          return;
        } else {
          // custom template — pass ordered params array
          waParams = Object.values(params);
        }
        await sendTemplateToPhone(user.contact_number, template_id, waParams);
      } else {
        // email channel
        if (template_id === "custom") {
          if (!params["subject"] || !params["body"]) throw new Error("subject and body required");
          await sendBroadcastEmail(user.email, params["subject"], params["body"]);
        } else if (template_id === "listing_reminder") {
          await sendListingReminderEmail(user.email, user.name, user.company_name);
        } else if (template_id === "verification_reminder") {
          await sendVerificationReminderEmail(user.email, user.name);
        } else if (template_id === "whatsapp_optin") {
          if (!user.contact_number) { skipped++; return; }
          const waNumber = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
          const appName = process.env.WHATSAPP_APP_NAME ?? "LuckyBirthstone";
          await sendWhatsAppOptInEmail(user.email, user.name, waNumber, appName);
        } else {
          const subject = params["subject"] || "Message from LuckyBirthstone";
          const body = params["body"] || "";
          await sendBroadcastEmail(user.email, subject, body);
        }
      }
      sent++;
    })
  );

  results.forEach((r) => {
    if (r.status === "rejected") { failed++; sent = Math.max(0, sent - 1); }
  });

  logger.info({ channel, template_id, audience, sent, failed, skipped }, "[ADMIN] Broadcast sent");
  res.json({ sent, failed, skipped, total: targets.length });
});

// ─── GET /admin/broadcast/users ───────────────────────────────────────────────

router.get("/admin/broadcast/users", requireAdmin, (_req, res) => {
  res.json(
    users
      .filter((u) => !u.is_admin)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        company_name: u.company_name,
        verification_status: u.verification_status,
        has_phone: !!u.contact_number,
        whatsapp_opt_in: u.whatsapp_opt_in !== false,
        subscription_plan: u.subscription_plan,
      }))
  );
});

// ─── Sales Users (internal staff) ───────────────────────────────────────────

router.get("/admin/sales-users", requireAdmin, (_req, res) => {
  res.json(salesUsers.map(toPublicSalesUser));
});

router.post("/admin/sales-users", requireAdmin, (req, res) => {
  const { name, email, password, phone } = req.body as Partial<{ name: string; email: string; password: string; phone: string }>;
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    res.status(400).json({ error: "name, email and password are required" });
    return;
  }
  if (salesUsers.some((u) => u.email === email.trim().toLowerCase())) {
    res.status(409).json({ error: "A sales user with this email already exists" });
    return;
  }
  const adminId = (req as { headers: Record<string, string | string[] | undefined> }).headers["x-admin-id"] as string;
  const user = createSalesUser({ name, email, password, phone, adminId });
  logger.info({ id: user.id, email: user.email }, "[ADMIN] Sales user created");
  res.status(201).json(toPublicSalesUser(user));
});

router.patch("/admin/sales-users/:id/active", requireAdmin, (req, res) => {
  const user = salesUsers.find((u) => u.id === req.params["id"]);
  if (!user) { res.status(404).json({ error: "Sales user not found" }); return; }
  const { is_active } = req.body as { is_active: boolean };
  if (typeof is_active !== "boolean") { res.status(400).json({ error: "is_active must be boolean" }); return; }
  user.is_active = is_active;
  saveSalesUsers(salesUsers);
  res.json(toPublicSalesUser(user));
});

router.delete("/admin/sales-users/:id", requireAdmin, (req, res) => {
  const idx = salesUsers.findIndex((u) => u.id === req.params["id"]);
  if (idx === -1) { res.status(404).json({ error: "Sales user not found" }); return; }
  salesUsers.splice(idx, 1);
  saveSalesUsers(salesUsers);
  res.json({ success: true });
});

export default router;
