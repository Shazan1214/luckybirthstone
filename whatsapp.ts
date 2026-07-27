import { logger } from "./logger.js";
import type { User } from "../routes/users.js";

// Gupshup WhatsApp Business Messaging API
const GUPSHUP_URL = "https://api.gupshup.io/wa/api/v1/msg";
const GUPSHUP_TEMPLATE_URL = "https://api.gupshup.io/wa/api/v1/template/msg";

// Admin WhatsApp phone — override via ADMIN_WHATSAPP_PHONE env var
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP_PHONE ?? "919901301634";

// Template texts stored locally — fill {{n}} placeholders and send as plain text
const TEMPLATES: Record<string, string> = {
  verified_welcome: [
    "🎉 Congratulations {{1}}!",
    "",
    "Your LuckyBirthstone account has been officially verified as *{{2}}*.",
    "",
    "You now get priority placement in the marketplace and buyers will trust your listings more.",
    "",
    "Post your first gem listing now: {{3}}",
    "",
    "Reply STOP to opt out.",
  ].join("\n"),

  listing_reminder: [
    "Hi {{1}} 👋",
    "",
    "Your LuckyBirthstone account is now verified! Verified sellers get priority placement and are contacted by buyers first.",
    "",
    "You haven't listed any gems yet — it only takes a few minutes. Start here: {{2}}",
    "",
    "Reply STOP to opt out.",
  ].join("\n"),

  new_auction_alert: [
    "🔔 New auction live on LuckyBirthstone!",
    "",
    "Stone: {{1}} ({{2}} ct)",
    "Starting bid: {{3}}",
    "Ends: {{4}}",
    "Place your bid: {{5}}",
    "",
    "Reply STOP to opt out.",
  ].join("\n"),

  new_listing_alert: [
    "💎 New gem just listed on LuckyBirthstone by {{1}}!",
    "",
    "Stone: {{2}}",
    "Carat: {{3}} ct",
    "Origin: {{4}}",
    "",
    "View listing: {{5}}",
    "",
    "Reply STOP to opt out.",
  ].join("\n"),

  admin_new_signup: [
    "🆕 *New User Registered* — LuckyBirthstone",
    "",
    "👤 Name: {{1}}",
    "🏢 Company: {{2}}",
    "📧 Email: {{3}}",
    "📱 Phone: {{4}}",
    "🔖 Type: {{5}}",
    "📅 Registered: {{6}}",
    "",
    "⚠️ Email NOT yet verified. Awaiting user to confirm OTP.",
    "",
    "Review in Admin Panel: {{7}}",
  ].join("\n"),

  trial_welcome: [
    "🎉 *Your 30-Day Premium Trial Has Started!*",
    "",
    "Hi {{1}}, welcome to LuckyBirthstone Premium!",
    "",
    "Your free trial is active until *{{2}}*. Here's what you can do:",
    "✅ Unlimited listings",
    "✅ Full Trade Manager (sales, payables, receivables)",
    "✅ Approval & consignment workflows",
    "✅ Co-sell partner management",
    "✅ Priority placement in search",
    "",
    "Explore now: {{3}}",
    "",
    "Reply STOP to opt out.",
  ].join("\n"),

  trial_ending_soon: [
    "⏳ *Your Premium Trial Ends in {{2}} Day(s)*",
    "",
    "Hi {{1}},",
    "",
    "Your LuckyBirthstone Premium trial expires on *{{3}}*.",
    "",
    "After that you'll lose access to unlimited listings, Trade Manager, and priority placement.",
    "",
    "Upgrade now to continue without interruption:",
    "👉 {{4}}",
    "",
    "Reply STOP to opt out.",
  ].join("\n"),

  trial_expired: [
    "💎 *Your Premium Trial Has Ended*",
    "",
    "Hi {{1}},",
    "",
    "Your 30-day free Premium trial on LuckyBirthstone has expired.",
    "Your account is now on the basic plan.",
    "",
    "Upgrade to Premium to restore full access:",
    "✅ Unlimited listings",
    "✅ Trade Manager & payment tracking",
    "✅ Approval & co-sell workflows",
    "",
    "👉 Upgrade here: {{2}}",
    "",
    "Reply STOP to opt out.",
  ].join("\n"),

  admin_email_verified: [
    "✅ *User Email Verified* — LuckyBirthstone",
    "",
    "👤 Name: {{1}}",
    "🏢 Company: {{2}}",
    "📧 Email: {{3}}",
    "📱 Phone: {{4}}",
    "",
    "This user has verified their email and is now active.",
    "Please review and approve their Business ID if required.",
    "",
    "Admin Panel: {{5}}",
  ].join("\n"),

  prospects_outreach: [
    "Hi {{1}},",
    "",
    "Meet Gems Stones Dealers worldwide - manage accounts, trade, auction, chat or just be there..",
    "",
    "It's free!!",
  ].join("\n"),
};

function renderTemplate(templateId: string, params: string[]): string | null {
  const text = TEMPLATES[templateId];
  if (!text) return null;
  return params.reduce((t, val, i) => t.replaceAll(`{{${i + 1}}}`, val), text);
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // Auto-prefix Indian 10-digit numbers (starting with 6-9) with country code 91
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  return digits;
}

function getConfig() {
  const apiKey = process.env.WHATSAPP_TOKEN;
  const source = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const appName = process.env.WHATSAPP_APP_NAME ?? "LuckyBirthstone";
  if (!apiKey || !source) return null;
  return { apiKey, source: normalizePhone(source) ?? source, appName };
}

async function sendMessage(to: string, templateId: string, params: string[]): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;

  const phone = normalizePhone(to);
  if (!phone) return;

  const message = renderTemplate(templateId, params);
  if (!message) {
    logger.warn({ templateId }, "[WHATSAPP] Unknown template ID — skipping");
    return;
  }

  const body = new URLSearchParams({
    channel: "whatsapp",
    source: cfg.source,
    destination: phone,
    "src.name": cfg.appName,
    message,
  });

  logger.info({ to: phone, templateId }, "[WHATSAPP] Sending message");

  const res = await fetch(GUPSHUP_URL, {
    method: "POST",
    headers: {
      apikey: cfg.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const responseText = await res.text();
  logger.info({ to: phone, templateId, status: res.status, response: responseText }, "[WHATSAPP] Gupshup response");
  if (!res.ok) {
    throw new Error(`Gupshup error ${res.status}: ${responseText}`);
  }
}

export async function sendRawMessage(to: string, text: string): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;

  const phone = normalizePhone(to);
  if (!phone) return;

  const body = new URLSearchParams({
    channel: "whatsapp",
    source: cfg.source,
    destination: phone,
    "src.name": cfg.appName,
    message: text,
  });

  logger.info({ to: phone }, "[WHATSAPP] Sending raw message");

  const res = await fetch(GUPSHUP_URL, {
    method: "POST",
    headers: {
      apikey: cfg.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const responseText = await res.text();
  logger.info({ to: phone, status: res.status, response: responseText }, "[WHATSAPP] Gupshup raw response");
  if (!res.ok) {
    throw new Error(`Gupshup error ${res.status}: ${responseText}`);
  }
}

export async function sendTemplateToPhone(
  phone: string,
  templateId: string,
  params: string[]
): Promise<void> {
  await sendMessage(phone, templateId, params);
}

// Register a phone number as opted-in to receive Gupshup HSM template messages.
// Must be called before sendGupshupTemplate for numbers that haven't messaged first.
async function optInPhone(cfg: ReturnType<typeof getConfig>, normalizedPhone: string): Promise<void> {
  if (!cfg) return;
  const appId = process.env.WHATSAPP_APP_ID;
  if (!appId) {
    logger.warn("[WHATSAPP] WHATSAPP_APP_ID not set — skipping opt-in");
    return;
  }
  // Gupshup WhatsApp opt-in endpoint (uses App UUID, not app name)
  const optInUrl = `https://api.gupshup.io/wa/api/v1/app/opt-in/${encodeURIComponent(appId)}`;
  const body = new URLSearchParams({ user: JSON.stringify({ phone: normalizedPhone }) });
  const res = await fetch(optInUrl, {
    method: "POST",
    headers: { apikey: cfg.apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  logger.info({ to: normalizedPhone, status: res.status, response: text }, "[WHATSAPP] Gupshup opt-in response");
  // Non-fatal: a 2xx means success; non-2xx is logged but we proceed to send anyway
}

// Send a pre-approved Gupshup HSM template (bypasses the 24-hour session window).
// Automatically opts-in the number first so template delivery is not blocked.
export async function sendGupshupTemplate(
  phone: string,
  gupshupTemplateId: string,
  params: string[]
): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;

  // Step 1: opt-in the number (required by Gupshup before sending templates to cold contacts)
  await optInPhone(cfg, normalizedPhone);

  // Step 2: send the approved HSM template
  const templatePayload = JSON.stringify({ id: gupshupTemplateId, params });

  const body = new URLSearchParams({
    channel: "whatsapp",
    source: cfg.source,
    destination: normalizedPhone,
    "src.name": cfg.appName,
    template: templatePayload,
  });

  logger.info({ to: normalizedPhone, gupshupTemplateId, params }, "[WHATSAPP] Sending Gupshup template message");

  const res = await fetch(GUPSHUP_TEMPLATE_URL, {
    method: "POST",
    headers: { apikey: cfg.apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const responseText = await res.text();
  logger.info({ to: normalizedPhone, gupshupTemplateId, status: res.status, response: responseText }, "[WHATSAPP] Gupshup template response");
  if (!res.ok) {
    throw new Error(`Gupshup template error ${res.status}: ${responseText}`);
  }
}

export async function notifyUserVerified(user: User, dashboardUrl: string): Promise<void> {
  if (!getConfig()) return;
  if (!user.contact_number || user.whatsapp_opt_in === false) return;
  const tierLabel = user.verification_badge === "basic_verified" ? "Basic Verified" : user.verification_badge === "verified" ? "Verified Seller" : "Verified";
  try {
    await sendMessage(user.contact_number, "verified_welcome", [user.name, tierLabel, dashboardUrl]);
    logger.info({ userId: user.id }, "[WHATSAPP] Sent verified welcome");
  } catch (err) {
    logger.error({ userId: user.id, err }, "[WHATSAPP] Failed to send verified welcome");
  }
}

export async function sendTrialWelcomeWhatsApp(user: User, trialEndDate: string, dashboardUrl: string): Promise<void> {
  if (!getConfig()) return;
  if (!user.contact_number || user.whatsapp_opt_in === false) return;
  const formatted = new Date(trialEndDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  try {
    await sendMessage(user.contact_number, "trial_welcome", [user.name, formatted, dashboardUrl]);
    logger.info({ userId: user.id }, "[WHATSAPP] Sent trial welcome");
  } catch (err) {
    logger.error({ userId: user.id, err }, "[WHATSAPP] Failed to send trial welcome");
  }
}

export async function sendTrialEndingSoonWhatsApp(user: User, daysLeft: number, trialEndDate: string, upgradeUrl: string): Promise<void> {
  if (!getConfig()) return;
  if (!user.contact_number || user.whatsapp_opt_in === false) return;
  const formatted = new Date(trialEndDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  try {
    await sendMessage(user.contact_number, "trial_ending_soon", [user.name, String(daysLeft), formatted, upgradeUrl]);
    logger.info({ userId: user.id, daysLeft }, "[WHATSAPP] Sent trial ending soon");
  } catch (err) {
    logger.error({ userId: user.id, err }, "[WHATSAPP] Failed to send trial ending soon");
  }
}

export async function sendTrialExpiredWhatsApp(user: User, upgradeUrl: string): Promise<void> {
  if (!getConfig()) return;
  if (!user.contact_number || user.whatsapp_opt_in === false) return;
  try {
    await sendMessage(user.contact_number, "trial_expired", [user.name, upgradeUrl]);
    logger.info({ userId: user.id }, "[WHATSAPP] Sent trial expired");
  } catch (err) {
    logger.error({ userId: user.id, err }, "[WHATSAPP] Failed to send trial expired");
  }
}

export interface CrmProspectPhone { phone?: string | null }

export async function notifyAllUsersNewListing(
  stoneName: string,
  carat: number,
  origin: string,
  sellerCompany: string,
  listingUrl: string,
  allUsers: User[],
  crmProspects: CrmProspectPhone[] = []
): Promise<void> {
  if (!getConfig()) return;

  const targets = allUsers.filter(
    (u) => !u.is_admin && !u.is_blocked && u.email_verified && u.contact_number && u.whatsapp_opt_in !== false
  );
  logger.info({ count: targets.length }, "[WHATSAPP] Broadcasting new listing");

  const params = [sellerCompany, stoneName, String(carat), origin, listingUrl];

  const results = await Promise.allSettled([
    ...targets.map((u) => sendMessage(u.contact_number!, "new_listing_alert", params)),
    ...crmProspects.filter((p) => p.phone).map((p) => sendMessage(p.phone!, "new_listing_alert", params)),
  ]);
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) logger.warn({ failed }, "[WHATSAPP] Some new-listing notifications failed");
}

export async function notifyAllUsersNewAuction(
  stoneName: string,
  carat: number,
  startingBid: number,
  endTime: string,
  auctionUrl: string,
  allUsers: User[],
  crmProspects: CrmProspectPhone[] = []
): Promise<void> {
  if (!getConfig()) return;

  const endLabel = new Date(endTime).toUTCString().replace(" GMT", " UTC");
  const targets = allUsers.filter(
    (u) => !u.is_admin && !u.is_blocked && u.email_verified && u.contact_number && u.whatsapp_opt_in !== false
  );
  logger.info({ count: targets.length }, "[WHATSAPP] Broadcasting new auction");

  const params = [stoneName, String(carat), String(startingBid), endLabel, auctionUrl];

  const results = await Promise.allSettled([
    ...targets.map((u) => sendMessage(u.contact_number!, "new_auction_alert", params)),
    ...crmProspects.filter((p) => p.phone).map((p) => sendMessage(p.phone!, "new_auction_alert", params)),
  ]);
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) logger.warn({ failed }, "[WHATSAPP] Some new-auction notifications failed");
}

export async function sendListingReminderWhatsApp(user: User, profileUrl: string): Promise<void> {
  if (!getConfig()) return;
  if (!user.contact_number || user.whatsapp_opt_in === false) return;
  try {
    await sendMessage(user.contact_number, "listing_reminder", [user.name, profileUrl]);
    logger.info({ userId: user.id }, "[WHATSAPP] Sent listing reminder");
  } catch (err) {
    logger.error({ userId: user.id, err }, "[WHATSAPP] Failed to send listing reminder");
  }
}

export async function notifyAdminNewSignup(
  user: { name: string; email: string; company_name: string | null; contact_number: string | null; user_type: string; created_at: string },
  adminPanelUrl: string
): Promise<void> {
  if (!getConfig()) return;
  const registeredAt = new Date(user.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const typeLabel = user.user_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  try {
    await sendMessage(ADMIN_PHONE, "admin_new_signup", [
      user.name,
      user.company_name ?? "N/A",
      user.email,
      user.contact_number ?? "N/A",
      typeLabel,
      registeredAt + " IST",
      adminPanelUrl,
    ]);
    logger.info({ email: user.email }, "[WHATSAPP] Admin notified of new signup");
  } catch (err) {
    logger.warn({ email: user.email, err }, "[WHATSAPP] Failed to notify admin of new signup");
  }
}

export async function notifyAdminEmailVerified(
  user: { name: string; email: string; company_name: string | null; contact_number: string | null },
  adminPanelUrl: string
): Promise<void> {
  if (!getConfig()) return;
  try {
    await sendMessage(ADMIN_PHONE, "admin_email_verified", [
      user.name,
      user.company_name ?? "N/A",
      user.email,
      user.contact_number ?? "N/A",
      adminPanelUrl,
    ]);
    logger.info({ email: user.email }, "[WHATSAPP] Admin notified of email verification");
  } catch (err) {
    logger.warn({ email: user.email, err }, "[WHATSAPP] Failed to notify admin of email verification");
  }
}
