import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import PaymentModal from "@/components/PaymentModal";

const ANNUAL_DISCOUNT = 0.10;

const PLANS = [
  {
    key: "basic" as const,
    label: "Basic",
    monthlyPrice: 0,
    listing_limit: "5 listings",
    badge: "Free",
    badgeColor: "bg-slate-100 text-slate-700",
    features: ["5 active listings", "Basic search ranking", "Standard support"],
    cta: "Downgrade to Basic",
    color: "border-border",
    highlight: false,
  },
  {
    key: "pro" as const,
    label: "Pro",
    monthlyPrice: 29,
    listing_limit: "50 listings",
    badge: "Most Popular",
    badgeColor: "bg-blue-100 text-blue-700",
    features: ["50 active listings", "Priority search ranking", "Buyer credit reports", "Email support", "5 free standard auctions/month"],
    cta: "Upgrade to Pro",
    color: "border-blue-400",
    highlight: true,
  },
  {
    key: "premium" as const,
    label: "Premium",
    monthlyPrice: 79,
    listing_limit: "Unlimited listings",
    badge: "Best Value",
    badgeColor: "bg-amber-100 text-amber-700",
    features: ["Unlimited listings", "Top search ranking", "Buyer credit reports", "Dedicated account manager", "Priority support", "5 free premium auctions/month", "AstroBot buyer leads — gemstone inquiries forwarded directly to you"],
    cta: "Upgrade to Premium",
    color: "border-amber-400",
    highlight: false,
  },
] as const;

function getAnnualTotal(monthly: number) {
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));
}

export default function UpgradePlanPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const userId = localStorage.getItem("gw_user_id") ?? "";

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile(userId),
    enabled: !!userId,
  });

  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[number]["key"] | null>(null);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);

  const currentPlan = profile?.subscription_plan ?? "basic";

  function getPlanPrice(monthly: number): number {
    if (monthly === 0) return 0;
    return billingCycle === "annual" ? getAnnualTotal(monthly) : monthly;
  }

  function handleSelect(planKey: typeof PLANS[number]["key"]) {
    if (planKey === currentPlan) return;
    if (PLANS.find((p) => p.key === planKey)?.monthlyPrice === 0) {
      navigate("/dashboard");
      return;
    }
    setSelectedPlan(planKey);
  }

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    setSuccessPlan(selectedPlan);
    setSelectedPlan(null);
  }

  const selected = PLANS.find((p) => p.key === selectedPlan);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          ← Back to Dashboard
        </button>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-foreground mb-3">Upgrade Your Plan</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Your current plan: <span className="font-semibold text-foreground capitalize">{currentPlan}</span>. Upgrade to unlock more listings and features.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center mb-8">
          <div className="relative inline-flex items-center bg-secondary rounded-xl p-1 gap-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billingCycle === "monthly" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billingCycle === "annual" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Annual
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Save 10%</span>
            </button>
          </div>
        </div>

        {billingCycle === "annual" && (
          <p className="text-center text-sm text-emerald-700 font-medium mb-6">
            🎉 Annual plans billed once per year — <strong>10% off</strong> the monthly rate
          </p>
        )}

        {successPlan && (
          <div className="mb-8 bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-5 flex items-start gap-4">
            <div className="text-2xl">🎉</div>
            <div>
              <div className="font-bold text-emerald-800 mb-1">Plan upgraded successfully!</div>
              <div className="text-sm text-emerald-700">You're now on the <strong className="capitalize">{successPlan}</strong> plan. Your dashboard and listing quota have been updated. A confirmation email was sent to your inbox.</div>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            const isDowngrade = PLANS.findIndex((p) => p.key === plan.key) < PLANS.findIndex((p) => p.key === currentPlan);
            const displayPrice = getPlanPrice(plan.monthlyPrice);
            const annualTotal = getAnnualTotal(plan.monthlyPrice);
            const annualSavings = Math.round(plan.monthlyPrice * 12) - annualTotal;

            return (
              <div
                key={plan.key}
                className={`relative bg-white border-2 rounded-2xl p-6 flex flex-col transition-shadow ${
                  isCurrent ? "border-primary shadow-md" : plan.color
                } ${!isCurrent && !isDowngrade ? "hover:shadow-lg cursor-pointer" : ""}`}
                onClick={() => !isCurrent && handleSelect(plan.key)}
              >
                {plan.highlight && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">Current Plan</span>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-lg">{plan.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${plan.badgeColor}`}>{plan.badge}</span>
                  </div>

                  {plan.monthlyPrice === 0 ? (
                    <div className="text-3xl font-extrabold text-primary">Free</div>
                  ) : billingCycle === "annual" ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-primary">${annualTotal}</span>
                        <span className="text-base font-normal text-muted-foreground">/yr</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground line-through">${plan.monthlyPrice * 12}/yr</span>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Save ${annualSavings}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">(${(annualTotal / 12).toFixed(2)}/mo equivalent)</div>
                    </>
                  ) : (
                    <div className="text-3xl font-extrabold text-primary">
                      ${plan.monthlyPrice}
                      <span className="text-base font-normal text-muted-foreground">/mo</span>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground mt-1">{plan.listing_limit}</div>
                </div>

                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrent}
                  onClick={(e) => { e.stopPropagation(); handleSelect(plan.key); }}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isCurrent
                      ? "bg-secondary text-muted-foreground cursor-default"
                      : isDowngrade
                      ? "border border-border text-muted-foreground hover:bg-secondary"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {isCurrent ? "Current Plan" : isDowngrade ? "Contact Support to Downgrade" : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          {billingCycle === "annual"
            ? "Billed annually. Cancel anytime. All plans include zero commission on sales."
            : "Billed monthly. Cancel anytime. All plans include zero commission on sales."}
        </p>
      </div>

      {selectedPlan && selected && (
        <PaymentModal
          userId={userId}
          paymentType="subscription"
          meta={{ plan: selectedPlan, billing_cycle: billingCycle }}
          amount={getPlanPrice(selected.monthlyPrice)}
          description={`${selected.label} Plan — ${billingCycle === "annual" ? "Annual" : "Monthly"} Subscription${billingCycle === "annual" ? " (10% off)" : ""}`}
          onSuccess={handleSuccess}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  );
}
