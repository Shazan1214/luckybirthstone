import { Router, type IRouter } from "express";
import { users } from "./users.js";
import { saveUsers, saveReferrals } from "../lib/persist.js";
import { sendReferralJoined, sendReferralSuccessful } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  status: "pending" | "successful";
  created_at: string;
  completed_at: string | null;
}

export const referrals: Referral[] = [];

export function generateReferralCode(name: string): string {
  const prefix = name.trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}${digits}`;
}

export function ensureUniqueReferralCode(name: string): string {
  let code: string;
  let attempts = 0;
  do {
    code = generateReferralCode(name);
    attempts++;
  } while (users.some((u) => u.referral_code === code) && attempts < 30);
  return code;
}

// ─── GET /referrals/validate?code=XYZ ─────────────────────────────────────────
router.get("/referrals/validate", (req, res) => {
  const code = (req.query["code"] as string ?? "").toUpperCase().trim();
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }
  const referrer = users.find((u) => u.referral_code === code);
  if (!referrer) {
    res.json({ valid: false });
    return;
  }
  res.json({
    valid: true,
    referrer_name: referrer.company_name ?? referrer.name,
  });
});

// ─── GET /referrals/my/:user_id ────────────────────────────────────────────────
router.get("/referrals/my/:user_id", (req, res) => {
  const user = users.find((u) => u.id === req.params["user_id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const myReferrals = referrals.filter((r) => r.referrer_id === user.id);
  const successful = myReferrals.filter((r) => r.status === "successful");
  const referralCode = user.referral_code ?? "";
  res.json({
    referral_code: referralCode,
    referral_link: referralCode ? `https://luckybirthstone.com/?ref=${referralCode}` : "",
    total_referrals: myReferrals.length,
    pending_referrals: myReferrals.filter((r) => r.status === "pending").length,
    successful_referrals: successful.length,
    total_credits_earned: successful.length * 5,
    current_credits: user.extra_listing_credits ?? 0,
    referrals: myReferrals.map((r) => {
      const referred = users.find((u) => u.id === r.referred_user_id);
      return {
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        completed_at: r.completed_at,
        referred_name: referred ? (referred.company_name ?? referred.name) : "—",
        referred_verified: referred
          ? ["basic_verified", "verified", "legacy_verified"].includes(referred.verification_status)
          : false,
      };
    }),
  });
});

// ─── Exported helper: called from verify-email and admin verify ───────────────

export function checkAndCompleteReferral(userId: string): void {
  const user = users.find((u) => u.id === userId);
  if (!user || !user.referred_by) return;
  if (!user.email_verified) return;

  const isVerified = ["basic_verified", "verified", "legacy_verified"].includes(
    user.verification_status
  );
  if (!isVerified) return;

  const referral = referrals.find(
    (r) => r.referred_user_id === userId && r.status === "pending"
  );
  if (!referral) return;

  referral.status = "successful";
  referral.completed_at = new Date().toISOString();
  saveReferrals(referrals);

  const referrer = users.find((u) => u.id === referral.referrer_id);
  if (referrer) {
    referrer.extra_listing_credits = (referrer.extra_listing_credits ?? 0) + 5;
    saveUsers(users);
    sendReferralSuccessful(
      referrer.email,
      referrer.name,
      user.company_name ?? user.name,
      5
    ).catch((err) =>
      logger.error({ err }, "Failed to send referral success email to referrer")
    );
  }

  user.extra_listing_credits = (user.extra_listing_credits ?? 0) + 2;
  saveUsers(users);

  logger.info(
    { referral_id: referral.id, referrer_id: referral.referrer_id, referred_id: userId },
    "Referral completed — credits awarded"
  );
}

// ─── Called from signup when a valid referral code is provided ────────────────

export function createPendingReferral(referrerId: string, referredUserId: string, referredEmail: string, referredName: string): void {
  const referral: Referral = {
    id: crypto.randomUUID(),
    referrer_id: referrerId,
    referred_user_id: referredUserId,
    status: "pending",
    created_at: new Date().toISOString(),
    completed_at: null,
  };
  referrals.push(referral);
  saveReferrals(referrals);

  const referrer = users.find((u) => u.id === referrerId);
  if (referrer) {
    sendReferralJoined(referrer.email, referrer.name, referredName).catch((err) =>
      logger.error({ err }, "Failed to send referral joined email")
    );
  }
  logger.info({ referral_id: referral.id, referrer_id: referrerId, referred_id: referredUserId }, "Referral created");
}

export default router;
