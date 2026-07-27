import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID, createHmac } from "crypto";
import Razorpay from "razorpay";
import { users } from "./users.js";
import { inventory } from "./inventory.js";
import {
  VERIFICATION_FEES,
  SUBSCRIPTION_PRICES,
  SUBSCRIPTION_ANNUAL_PRICES,
  BOOST_PACKS,
  LISTING_CREDIT_PACKS,
  SINGLE_BOOST_COST_USD,
  BOOST_DURATION_DAYS,
  type VerifiableTier,
  type SubscriptionPlan,
  type BoostPackType,
  type ListingCreditPackType,
} from "../lib/launch.js";
import { saveUsers, savePlatformPayments, saveInventory } from "../lib/persist.js";
import { sendPaymentConfirmation } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const rzp = new Razorpay({
  key_id: process.env["RAZORPAY_KEY_ID"] ?? "",
  key_secret: process.env["RAZORPAY_KEY_SECRET"] ?? "",
});

export type PaymentType = "verification" | "subscription" | "boost" | "listing_credits";
export type PaymentStatus = "pending" | "success" | "failed";

export interface PlatformPayment {
  id: string;
  user_id: string;
  amount: number;
  currency: "USD";
  type: PaymentType;
  status: PaymentStatus;
  created_at: string;
  completed_at?: string;
  meta: Record<string, unknown>;
  razorpay_order_id?: string;
}

export const platformPayments: PlatformPayment[] = [];

function savePayments(): void {
  savePlatformPayments(platformPayments);
}

function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

router.post("/platform-payments/initiate", async (req: Request, res: Response) => {
  const { user_id, type, meta } = req.body as Partial<{
    user_id: string;
    type: PaymentType;
    meta: Record<string, unknown>;
  }>;

  if (!user_id || !type) {
    res.status(400).json({ error: "user_id and type are required" });
    return;
  }

  const VALID_TYPES: PaymentType[] = ["verification", "subscription", "boost", "listing_credits"];
  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({ error: "type must be one of verification, subscription, boost, listing_credits" });
    return;
  }

  const user = users.find((u) => u.id === user_id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let amount = 0;

  if (type === "verification") {
    const tier = meta?.tier as VerifiableTier | undefined;
    const VALID_TIERS: VerifiableTier[] = ["basic_verified", "verified", "legacy_verified"];
    if (!tier || !VALID_TIERS.includes(tier)) {
      res.status(400).json({ error: "meta.tier must be one of basic_verified, verified, legacy_verified" });
      return;
    }
    amount = VERIFICATION_FEES[tier];
  } else if (type === "subscription") {
    const plan = meta?.plan as SubscriptionPlan | undefined;
    const billingCycle = (meta?.billing_cycle as string | undefined) === "annual" ? "annual" : "monthly";
    const VALID_PLANS: SubscriptionPlan[] = ["basic", "pro", "premium"];
    if (!plan || !VALID_PLANS.includes(plan)) {
      res.status(400).json({ error: "meta.plan must be one of basic, pro, premium" });
      return;
    }
    amount = billingCycle === "annual" ? SUBSCRIPTION_ANNUAL_PRICES[plan] : SUBSCRIPTION_PRICES[plan];
  } else if (type === "boost") {
    const boost_type = meta?.boost_type as string | undefined;
    if (boost_type === "single") {
      amount = SINGLE_BOOST_COST_USD;
    } else if (boost_type && (boost_type === "boosts_5" || boost_type === "boosts_10")) {
      amount = BOOST_PACKS[boost_type as BoostPackType].price;
    } else {
      res.status(400).json({ error: "meta.boost_type must be one of single, boosts_5, boosts_10" });
      return;
    }
  } else if (type === "listing_credits") {
    const pack = meta?.pack as string | undefined;
    const VALID_CREDIT_PACKS: ListingCreditPackType[] = ["credits_10", "credits_25", "credits_50"];
    if (!pack || !VALID_CREDIT_PACKS.includes(pack as ListingCreditPackType)) {
      res.status(400).json({ error: "meta.pack must be one of credits_10, credits_25, credits_50" });
      return;
    }
    amount = LISTING_CREDIT_PACKS[pack as ListingCreditPackType].price;
  }

  const payment: PlatformPayment = {
    id: randomUUID(),
    user_id,
    amount,
    currency: "USD",
    type,
    status: "pending",
    created_at: new Date().toISOString(),
    meta: meta ?? {},
  };

  if (amount === 0) {
    platformPayments.push(payment);
    savePayments();
    res.status(201).json({
      payment_id: payment.id,
      amount: 0,
      currency: "USD",
      type,
      status: "pending",
      meta: payment.meta,
      razorpay_order_id: null,
      razorpay_key_id: null,
      message: "No payment required — proceed to verify.",
    });
    return;
  }

  try {
    const rzpOrder = await rzp.orders.create({
      amount: usdToCents(amount),
      currency: "USD",
      receipt: payment.id,
      notes: {
        payment_id: payment.id,
        user_id,
        type,
      },
    });

    payment.razorpay_order_id = rzpOrder.id;
    platformPayments.push(payment);
    savePayments();

    res.status(201).json({
      payment_id: payment.id,
      amount,
      amount_usd_cents: usdToCents(amount),
      currency: "USD",
      type,
      status: "pending",
      meta: payment.meta,
      razorpay_order_id: rzpOrder.id,
      razorpay_key_id: process.env["RAZORPAY_KEY_ID"],
      message: `Razorpay order created. Amount: $${amount} USD.`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create Razorpay order");
    res.status(502).json({ error: "Payment gateway error. Please try again." });
  }
});

router.post("/platform-payments/verify/:id", async (req: Request, res: Response) => {
  const payment = platformPayments.find((p) => p.id === req.params["id"]);
  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  if (payment.status !== "pending") {
    res.status(400).json({ error: `Payment is already ${payment.status}` });
    return;
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body as Partial<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }>;

  if (payment.amount > 0) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required for paid orders" });
      return;
    }

    const secret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    const expectedSignature = createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      payment.status = "failed";
      payment.completed_at = new Date().toISOString();
      savePayments();
      res.status(402).json({ error: "Payment signature verification failed", payment_id: payment.id });
      return;
    }

    payment.meta = { ...payment.meta, razorpay_order_id, razorpay_payment_id, razorpay_signature };
  }

  payment.status = "success";
  payment.completed_at = new Date().toISOString();

  const user = users.find((u) => u.id === payment.user_id);
  if (!user) {
    savePayments();
    res.status(404).json({ error: "User not found" });
    return;
  }

  let effect: Record<string, unknown> = {};

  if (payment.type === "verification") {
    const tier = payment.meta.tier as VerifiableTier;
    if (tier === "basic_verified") {
      user.verification_status = "basic_verified";
      user.verification_badge = "basic_verified";
      user.verification_fee_paid = true;
      effect = { verification_status: "basic_verified", auto_approved: true };
    } else {
      user.requested_tier = tier;
      user.verification_fee_paid = true;
      user.verification_payment_amount = payment.amount;
      user.verification_requested_at = new Date().toISOString();
      effect = { requested_tier: tier, pending_admin_review: true };
    }
  } else if (payment.type === "subscription") {
    const plan = payment.meta.plan as SubscriptionPlan;
    user.subscription_plan = plan;
    user.subscription_payment_status = "paid";
    user.subscription_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    effect = { subscription_plan: plan, expires_at: user.subscription_expires_at };
  } else if (payment.type === "boost") {
    const boost_type = payment.meta.boost_type as string;
    const gemstone_id = payment.meta.gemstone_id as string | undefined;

    if (boost_type === "single" && gemstone_id) {
      const gemstone = inventory.find((g) => g.id === gemstone_id);
      if (gemstone) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + BOOST_DURATION_DAYS);
        gemstone.is_featured = true;
        gemstone.boost_expiry_date = expiryDate.toISOString();
        saveInventory(inventory);
        effect = {
          gemstone_id,
          is_featured: true,
          boost_expiry_date: gemstone.boost_expiry_date,
          boost_duration_days: BOOST_DURATION_DAYS,
        };
      } else {
        user.free_boosts = (user.free_boosts ?? 0) + 1;
        effect = { boosts_added: 1, boosts_available: user.free_boosts };
      }
      if (payment.amount > 0) {
        sendPaymentConfirmation(user.email, user.name, {
          type: "boost",
          amount: payment.amount,
          description: "Featured Listing",
          detail: `Your listing has been featured for ${BOOST_DURATION_DAYS} days and will appear at the top of search results.`,
        }).catch(() => {});
      }
    } else {
      let boosts_added = 0;
      if (boost_type === "boosts_5" || boost_type === "boosts_10") {
        boosts_added = BOOST_PACKS[boost_type as BoostPackType].boosts;
      } else if (boost_type === "single") {
        boosts_added = 1;
      }
      user.free_boosts = (user.free_boosts ?? 0) + boosts_added;
      effect = {
        boosts_added,
        boosts_available: user.free_boosts,
        boost_duration_days: BOOST_DURATION_DAYS,
      };
      if (payment.amount > 0) {
        const packLabel = boost_type === "single" ? "1 Boost Credit" : boost_type === "boosts_5" ? "5 Boost Credits" : "10 Boost Credits";
        sendPaymentConfirmation(user.email, user.name, {
          type: "boost",
          amount: payment.amount,
          description: packLabel,
          detail: `${boosts_added} boost credit(s) added to your account. Each boost features a listing for ${BOOST_DURATION_DAYS} days.`,
        }).catch(() => {});
      }
    }
  } else if (payment.type === "listing_credits") {
    const pack = payment.meta.pack as ListingCreditPackType;
    const packMeta = LISTING_CREDIT_PACKS[pack];
    const credits_added = packMeta?.credits ?? 0;
    user.extra_listing_credits = (user.extra_listing_credits ?? 0) + credits_added;
    effect = {
      credits_added,
      total_extra_credits: user.extra_listing_credits,
    };
    sendPaymentConfirmation(user.email, user.name, {
      type: "listing_credits",
      amount: payment.amount,
      description: `${credits_added} Listing Credits`,
      detail: `${credits_added} extra listing slots added to your account on top of your ${user.subscription_plan} plan quota.`,
    }).catch(() => {});
  }

  if (payment.type === "subscription") {
    const plan = payment.meta.plan as SubscriptionPlan;
    const planLabels: Record<SubscriptionPlan, string> = { basic: "Basic", pro: "Pro ($29/mo)", premium: "Premium ($79/mo)" };
    sendPaymentConfirmation(user.email, user.name, {
      type: "subscription",
      amount: payment.amount,
      description: `${planLabels[plan] ?? plan} Plan`,
      detail: `Your subscription has been upgraded to the ${planLabels[plan] ?? plan} plan. Valid for 30 days from today.`,
    }).catch(() => {});
  }

  saveUsers(users);
  savePayments();

  logger.info({ paymentId: payment.id, userId: payment.user_id, type: payment.type }, "Platform payment completed");

  res.json({
    payment_id: payment.id,
    status: "success",
    amount: payment.amount,
    currency: "USD",
    type: payment.type,
    completed_at: payment.completed_at,
    effect,
  });
});

router.get("/platform-payments/history/:userId", (req: Request, res: Response) => {
  const userId = req.params["userId"];
  const user = users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const history = platformPayments
    .filter((p) => p.user_id === userId)
    .map(({ id, amount, currency, type, status, created_at, completed_at, meta }) => ({
      id, amount, currency, type, status, created_at, completed_at, meta,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({ payments: history, total: history.length });
});

export default router;
