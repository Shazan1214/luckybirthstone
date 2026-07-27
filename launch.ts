export type VerifiableTier = "basic_verified" | "verified" | "legacy_verified";
export type SubscriptionPlan = "basic" | "pro" | "premium";
export type BoostPackType = "boosts_5" | "boosts_10";
export type ListingCreditPackType = "credits_10" | "credits_25" | "credits_50";

export const VERIFICATION_FEES: Record<VerifiableTier, number> = {
  basic_verified: 0,
  verified: 99,
  legacy_verified: 499,
};

export const SUBSCRIPTION_PRICES: Record<SubscriptionPlan, number> = {
  basic: 0,
  pro: 29,
  premium: 79,
};

export const ANNUAL_DISCOUNT = 0.10;

export const SUBSCRIPTION_ANNUAL_PRICES: Record<SubscriptionPlan, number> = {
  basic: 0,
  pro: Math.round(29 * 12 * (1 - ANNUAL_DISCOUNT)),
  premium: Math.round(79 * 12 * (1 - ANNUAL_DISCOUNT)),
};

export function getAnnualSubscriptionPrice(plan: SubscriptionPlan): number {
  return SUBSCRIPTION_ANNUAL_PRICES[plan];
}

export const FREE_BOOSTS_DURING_LAUNCH = 2;

export const SINGLE_BOOST_COST_USD = 10;
export const BOOST_DURATION_DAYS = 7;

export const BOOST_PACKS: Record<BoostPackType, { boosts: number; price: number }> = {
  boosts_5:  { boosts: 5,  price: 200 },
  boosts_10: { boosts: 10, price: 350 },
};

export const LISTING_CREDIT_PACKS: Record<ListingCreditPackType, { credits: number; price: number }> = {
  credits_10: { credits: 10, price: 19 },
  credits_25: { credits: 25, price: 39 },
  credits_50: { credits: 50, price: 69 },
};

interface LaunchState {
  is_launch_period: boolean;
}

export const launchState: LaunchState = {
  is_launch_period: false,
};

export function getVerificationFee(tier: VerifiableTier): number {
  return VERIFICATION_FEES[tier];
}

export function getSubscriptionPrice(plan: SubscriptionPlan): number {
  return SUBSCRIPTION_PRICES[plan];
}

export function getLaunchConfigResponse() {
  return {
    is_launch_period: launchState.is_launch_period,
    verification_fees: VERIFICATION_FEES,
    subscription_pricing: SUBSCRIPTION_PRICES,
    subscription_annual_pricing: SUBSCRIPTION_ANNUAL_PRICES,
    annual_discount_pct: ANNUAL_DISCOUNT * 100,
  };
}
