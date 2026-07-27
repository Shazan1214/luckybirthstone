import { users } from "../routes/users.js";
import { inventory } from "../routes/inventory.js";
import { transactions } from "../routes/transactions.js";
import { notifications, addNotification } from "./notifications.js";
import { saveUsers } from "./persist.js";
import { sendListingReminderEmail, sendTrialWelcomeEmail, sendTrialEndingSoonEmail, sendTrialExpiredEmail } from "./email.js";
import { sendListingReminderWhatsApp, sendTrialWelcomeWhatsApp, sendTrialEndingSoonWhatsApp, sendTrialExpiredWhatsApp } from "./whatsapp.js";
import { logger } from "./logger.js";

function updateOnlineStatuses(): void {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  let updated = 0;
  for (const user of users) {
    if (!user.is_admin && user.is_online && new Date(user.last_active_at) < tenMinutesAgo) {
      user.is_online = false;
      updated++;
    }
  }
  if (updated > 0) {
    logger.info({ updated }, "[AUTOMATION] User online statuses updated");
  }
}

function checkOverdueTransactions(): void {
  const now = new Date();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const t of transactions) {
    if (t.status === "completed") continue;
    if (new Date(t.due_date) >= now) continue;

    const alreadyNotified = notifications.some(
      (n) =>
        n.type === "overdue_payment" &&
        n.entity_id === t.id &&
        new Date(n.created_at) > oneDayAgo
    );
    if (alreadyNotified) continue;

    const buyer = users.find((u) => u.id === t.buyer_id);
    const buyerName = buyer?.name ?? t.buyer_id.slice(0, 8);
    addNotification(
      "overdue_payment",
      "Overdue Payment",
      `${buyerName}'s payment of ${t.currency} ${t.total_amount.toLocaleString()} is overdue (due ${new Date(t.due_date).toDateString()}).`,
      { user_id: t.buyer_id, entity_id: t.id }
    );
    logger.info({ transaction_id: t.id, buyer: buyerName }, "[AUTOMATION] Overdue payment reminder logged");
  }
}

function checkSubscriptionExpiry(): void {
  const now = new Date();
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const user of users) {
    if (!user.subscription_expires_at || user.is_admin) continue;
    const expiry = new Date(user.subscription_expires_at);
    if (expiry < now || expiry > threeDaysFromNow) continue;

    const alreadyNotified = notifications.some(
      (n) =>
        n.type === "subscription_expiry" &&
        n.user_id === user.id &&
        new Date(n.created_at) > oneDayAgo
    );
    if (alreadyNotified) continue;

    addNotification(
      "subscription_expiry",
      "Subscription Expiring Soon",
      `${user.name}'s ${user.subscription_plan.toUpperCase()} plan expires on ${expiry.toDateString()}. Renewal reminder sent.`,
      { user_id: user.id }
    );
    logger.info({ user_id: user.id, plan: user.subscription_plan, expiry: user.subscription_expires_at }, "[AUTOMATION] Subscription expiry alert");
  }
}

const TRIAL_DAYS = 30;
const SITE_BASE = process.env.SITE_URL ?? "https://luckybirthstone.com";
const UPGRADE_URL = `${SITE_BASE}/dashboard`;

function backfillPremiumTrials(): void {
  const now = new Date();
  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  let backfilled = 0;

  for (const user of users) {
    if (user.is_admin || user.is_blocked) continue;
    if (user.trial_ends_at) continue;
    if (user.subscription_plan === "pro") continue;

    user.trial_ends_at = trialEnd.toISOString();
    user.subscription_plan = "premium";
    user.subscription_payment_status = "unpaid";

    sendTrialWelcomeEmail(user.email, user.name, user.trial_ends_at, UPGRADE_URL).catch((err) =>
      logger.error({ userId: user.id, err }, "[AUTOMATION] Failed to send trial welcome email")
    );
    sendTrialWelcomeWhatsApp(user, user.trial_ends_at, UPGRADE_URL).catch((err) =>
      logger.error({ userId: user.id, err }, "[AUTOMATION] Failed to send trial welcome WhatsApp")
    );

    logger.info({ user_id: user.id, trial_ends_at: user.trial_ends_at }, `[AUTOMATION] Backfilled premium trial`);
    backfilled++;
  }

  if (backfilled > 0) {
    saveUsers(users);
    logger.info({ backfilled }, "[AUTOMATION] Premium trial backfill complete");
  }
}

function checkTrialExpiry(): void {
  const now = new Date();
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let changed = false;

  for (const user of users) {
    if (user.is_admin || user.is_blocked || !user.trial_ends_at) continue;

    const trialEnd = new Date(user.trial_ends_at);

    if (trialEnd <= now) {
      if (user.subscription_plan === "premium" && user.subscription_payment_status !== "paid") {
        user.subscription_plan = "basic";
        changed = true;
        logger.info({ user_id: user.id }, "[AUTOMATION] Trial expired — downgraded to basic");
      }

      if (!user.trial_expired_notified_at || new Date(user.trial_expired_notified_at) < oneDayAgo) {
        user.trial_expired_notified_at = now.toISOString();
        changed = true;

        sendTrialExpiredEmail(user.email, user.name, UPGRADE_URL).catch((err) =>
          logger.error({ userId: user.id, err }, "[AUTOMATION] Failed to send trial expired email")
        );
        sendTrialExpiredWhatsApp(user, UPGRADE_URL).catch((err) =>
          logger.error({ userId: user.id, err }, "[AUTOMATION] Failed to send trial expired WhatsApp")
        );

        addNotification(
          "subscription_expiry",
          "Premium Trial Ended",
          `${user.name}'s 30-day Premium trial has ended. Account downgraded to basic.`,
          { user_id: user.id }
        );
      }
      continue;
    }

    if (trialEnd <= threeDaysFromNow) {
      if (!user.trial_notified_at || new Date(user.trial_notified_at) < oneDayAgo) {
        user.trial_notified_at = now.toISOString();
        changed = true;

        const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

        sendTrialEndingSoonEmail(user.email, user.name, daysLeft, user.trial_ends_at, UPGRADE_URL).catch((err) =>
          logger.error({ userId: user.id, err }, "[AUTOMATION] Failed to send trial ending soon email")
        );
        sendTrialEndingSoonWhatsApp(user, daysLeft, user.trial_ends_at, UPGRADE_URL).catch((err) =>
          logger.error({ userId: user.id, err }, "[AUTOMATION] Failed to send trial ending soon WhatsApp")
        );

        addNotification(
          "subscription_expiry",
          "Premium Trial Ending Soon",
          `${user.name}'s Premium trial ends in ${daysLeft} day(s) on ${trialEnd.toDateString()}.`,
          { user_id: user.id }
        );

        logger.info({ user_id: user.id, daysLeft }, "[AUTOMATION] Trial ending soon alert sent");
      }
    }
  }

  if (changed) saveUsers(users);
}

const VERIFIED_STATUSES = ["basic_verified", "verified", "legacy_verified"];
const REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function checkVerifiedUsersNeedingListingReminder(): void {
  const siteBase = process.env.SITE_URL ?? "https://luckybirthstone.com";
  const now = Date.now();
  let sent = 0;

  for (const user of users) {
    if (user.is_admin || user.is_blocked || !user.email_verified) continue;
    if (!VERIFIED_STATUSES.includes(user.verification_status)) continue;

    if (user.listing_reminder_sent_at) {
      const lastSent = new Date(user.listing_reminder_sent_at).getTime();
      if (now - lastSent < REMINDER_INTERVAL_MS) continue;
    }

    const hasListings = inventory.some((g) => g.seller_id === user.id);
    if (hasListings) continue;

    user.listing_reminder_sent_at = new Date().toISOString();
    saveUsers(users);

    sendListingReminderEmail(user.email, user.name, user.company_name).catch((err) =>
      logger.error({ userId: user.id, err }, "[AUTOMATION] Failed to send listing reminder email")
    );
    sendListingReminderWhatsApp(user, `${siteBase}/dashboard`).catch((err) =>
      logger.error({ userId: user.id, err }, "[AUTOMATION] Failed to send listing reminder WhatsApp")
    );

    logger.info({ user_id: user.id }, "[AUTOMATION] Sent listing reminder to verified user with no listings");
    sent++;
  }

  if (sent > 0) logger.info({ sent }, "[AUTOMATION] Listing reminders dispatched");
}

export function runAutomationCycle(): void {
  updateOnlineStatuses();
  checkOverdueTransactions();
  checkSubscriptionExpiry();
  checkTrialExpiry();
  checkVerifiedUsersNeedingListingReminder();
}

export function startAutomation(): void {
  setTimeout(() => {
    backfillPremiumTrials();
    runAutomationCycle();
  }, 5000);
  setInterval(() => runAutomationCycle(), 60 * 1000);
  logger.info("[AUTOMATION] Automation engine started (60s interval)");
}
