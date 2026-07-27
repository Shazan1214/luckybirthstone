import { useState } from "react";
import { useLocation } from "wouter";

const loggedIn = () => !!localStorage.getItem("gw_user_id");

const ANNUAL_DISCOUNT = 0.10;
function annualTotal(monthly: number) { return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT)); }
function annualSavings(monthly: number) { return Math.round(monthly * 12) - annualTotal(monthly); }

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

export default function PlansPage() {
  const [, navigate] = useLocation();
  const isLoggedIn = loggedIn();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  function getVerifiedCta() {
    if (isLoggedIn) navigate("/verification-upgrade");
    else navigate("/");
  }

  function upgradePlanCta() {
    if (isLoggedIn) navigate("/upgrade-plan");
    else navigate("/");
  }

  function signInLabel(action: string) {
    return isLoggedIn ? action : "Sign In to Get Started";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <div className="text-center py-16 px-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold mb-4">
          💎 LuckyBirthstone Pricing
        </div>
        <h1 className="text-4xl font-extrabold text-foreground mb-4 tracking-tight">
          Simple, Transparent Pricing
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-base">
          Zero commission on every sale. Pay only for the plan tier that fits your business — upgrade or cancel anytime.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">

        {/* ─── Subscription Plans ─── */}
        <section className="mb-16">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Subscription Plans</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Choose the right plan for your listing volume. Upgrade or downgrade anytime. Zero commissions on every plan.
            </p>
          </div>

          {/* Billing toggle */}
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

          <div className="grid sm:grid-cols-3 gap-6">
            {/* Basic */}
            <div className="bg-white border border-border rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-1">Basic</h3>
              <p className="text-xs text-muted-foreground mb-5">Perfect for small traders testing the platform.</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-emerald-600">Free</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>Up to <strong>5 active listings</strong></li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>Multi-image gallery per listing</li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>B2B messaging &amp; inquiries</li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>Zero commission, always</li>
              </ul>
              <button
                onClick={() => { if (isLoggedIn) navigate("/dashboard"); else navigate("/"); }}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors"
              >
                {signInLabel("Start Free →")}
              </button>
            </div>

            {/* Pro */}
            <div className="bg-white border-2 border-primary rounded-2xl p-6 flex flex-col shadow-md relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow">Most popular</span>
              </div>
              <h3 className="font-bold text-lg mb-1">Pro</h3>
              <p className="text-xs text-muted-foreground mb-5">For active traders who list regularly.</p>
              <div className="mb-6">
                {billingCycle === "annual" ? (
                  <>
                    <div>
                      <span className="text-3xl font-extrabold text-foreground">${annualTotal(29)}</span>
                      <span className="text-muted-foreground text-sm ml-1">/yr</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground line-through">${29 * 12}/yr</span>
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Save ${annualSavings(29)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">(${(annualTotal(29) / 12).toFixed(2)}/mo equivalent)</div>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-foreground">$29</span>
                    <span className="text-muted-foreground text-sm ml-1">/month</span>
                  </>
                )}
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">✓</span>Up to <strong>50 active listings</strong></li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">✓</span>Everything in Basic</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">✓</span>Priority support</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">✓</span>Analytics dashboard</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">✓</span>1 free boost credit/month</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">✓</span><strong>5 free standard auctions/month</strong></li>
              </ul>
              <button
                onClick={upgradePlanCta}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                {signInLabel("Upgrade to Pro →")}
              </button>
            </div>

            {/* Premium */}
            <div className="bg-white border border-violet-300 rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg">Premium</h3>
                <Badge label="Unlimited" color="bg-violet-100 text-violet-700" />
              </div>
              <p className="text-xs text-muted-foreground mb-5">For high-volume sellers and established dealers.</p>
              <div className="mb-6">
                {billingCycle === "annual" ? (
                  <>
                    <div>
                      <span className="text-3xl font-extrabold text-foreground">${annualTotal(79)}</span>
                      <span className="text-muted-foreground text-sm ml-1">/yr</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground line-through">${79 * 12}/yr</span>
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Save ${annualSavings(79)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">(${(annualTotal(79) / 12).toFixed(2)}/mo equivalent)</div>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-foreground">$79</span>
                    <span className="text-muted-foreground text-sm ml-1">/month</span>
                  </>
                )}
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
                <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">★</span><strong>Unlimited</strong> active listings</li>
                <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">★</span>Everything in Pro</li>
                <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">★</span>Featured seller profile</li>
                <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">★</span>Dedicated account manager</li>
                <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">★</span>API access (coming soon)</li>
                <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">★</span>3 free boost credits/month</li>
                <li className="flex items-start gap-2"><span className="text-violet-500 mt-0.5">★</span><strong>5 free premium auctions/month</strong></li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-500 mt-0.5">★</span>
                  <span><strong>AstroBot buyer leads</strong> — receive gemstone inquiry emails direct from AstroBot</span>
                </li>
              </ul>
              <button
                onClick={upgradePlanCta}
                className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors"
              >
                {signInLabel("Go Premium →")}
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            All plans include zero-commission sales. {billingCycle === "annual" ? "Billed annually." : "Billed monthly."} Cancel anytime.
          </p>

          {/* AstroBot lead callout */}
          <div className="mt-6 bg-violet-50 border border-violet-200 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="text-3xl shrink-0">🔮</div>
            <div className="flex-1 text-center sm:text-left">
              <div className="font-bold text-violet-900 mb-1">AstroBot Buyer Leads — Exclusive to Premium</div>
              <p className="text-sm text-violet-700">
                When a buyer uses AstroBot to find their ideal gemstone, their inquiry — name, contact, gemstone, zodiac sign, and budget — is emailed <strong>directly to every Premium dealer</strong>. It's a steady stream of warm, pre-qualified leads at no extra cost.
              </p>
            </div>
            <button
              onClick={upgradePlanCta}
              className="shrink-0 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors whitespace-nowrap"
            >
              {signInLabel("Go Premium →")}
            </button>
          </div>
        </section>

        {/* ─── Verification ─── */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Seller Verification</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Build trust with B2B buyers. A verified badge appears on all your listings and your business profile.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {/* Basic Verified */}
            <div className="bg-white border border-border rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl text-emerald-600">✓</span>
                <h3 className="font-bold text-lg">Basic Verified</h3>
                <Badge label="Free" color="bg-emerald-100 text-emerald-700" />
              </div>
              <p className="text-xs text-muted-foreground mb-5">Instant approval — no documents, no payment.</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-emerald-600">FREE</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>Verified badge on all listings</li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>Higher search ranking</li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>Identity confirmed</li>
                <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">✓</span>Instant — no admin wait</li>
              </ul>
              <button
                onClick={getVerifiedCta}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors"
              >
                {signInLabel("Get Basic Verified →")}
              </button>
            </div>

            {/* Verified */}
            <div className="bg-white border-2 border-sky-400 rounded-2xl p-6 flex flex-col shadow-md relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-sky-500 text-white text-xs font-bold rounded-full shadow">Popular</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl text-sky-600">✓</span>
                <h3 className="font-bold text-lg">Verified</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-5">Admin reviews your documents within 1–2 business days.</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-foreground">$99</span>
                <span className="text-muted-foreground text-sm ml-1">one-time</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
                <li className="flex items-start gap-2"><span className="text-sky-500 mt-0.5">✓</span>Everything in Basic Verified</li>
                <li className="flex items-start gap-2"><span className="text-sky-500 mt-0.5">✓</span>Sky-blue Verified badge</li>
                <li className="flex items-start gap-2"><span className="text-sky-500 mt-0.5">✓</span>Document review by compliance team</li>
                <li className="flex items-start gap-2"><span className="text-sky-500 mt-0.5">✓</span>Priority placement in search</li>
              </ul>
              <button
                onClick={getVerifiedCta}
                className="w-full py-2.5 bg-sky-500 text-white rounded-xl font-semibold text-sm hover:bg-sky-600 transition-colors"
              >
                {signInLabel("Get Verified →")}
              </button>
            </div>

            {/* Legacy Verified */}
            <div className="bg-white border border-amber-300 rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl text-amber-500">★</span>
                <h3 className="font-bold text-lg">Legacy Verified</h3>
                <Badge label="Premium" color="bg-amber-100 text-amber-700" />
              </div>
              <p className="text-xs text-muted-foreground mb-5">The highest trust tier — gold badge, top placement, dedicated support.</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-foreground">$499</span>
                <span className="text-muted-foreground text-sm ml-1">one-time</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">★</span>Everything in Verified</li>
                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">★</span>Gold Legacy badge</li>
                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">★</span>Top placement in all results</li>
                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">★</span>Enhanced business profile</li>
                <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">★</span>Dedicated account manager</li>
              </ul>
              <button
                onClick={getVerifiedCta}
                className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 transition-colors"
              >
                {signInLabel("Get Legacy Verified →")}
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            All verification tiers include a permanent badge — no renewal fees.
          </p>
        </section>

        {/* ─── Listing Credit Add-ons ─── */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Listing Credit Add-ons</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Need more listing slots without upgrading your plan? Buy permanent add-on credits that stack on top of your plan quota — they never expire.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-white border border-border rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-1">10 Credits</h3>
              <p className="text-xs text-muted-foreground mb-5">+10 extra permanent listing slots.</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-foreground">$19</span>
                <span className="text-muted-foreground text-sm ml-1">$1.90/credit</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span>Permanent — never expire</li>
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span>Stacks on plan quota</li>
              </ul>
              <button
                onClick={() => { if (isLoggedIn) navigate("/dashboard"); else navigate("/"); }}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                {signInLabel("Buy 10 Credits →")}
              </button>
            </div>

            <div className="bg-white border-2 border-blue-400 rounded-2xl p-6 flex flex-col shadow-md relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full shadow">Best value</span>
              </div>
              <h3 className="font-bold text-lg mb-1">25 Credits</h3>
              <p className="text-xs text-muted-foreground mb-5">+25 extra permanent listing slots.</p>
              <div className="mb-1">
                <span className="text-3xl font-extrabold text-foreground">$39</span>
                <span className="text-muted-foreground text-sm ml-1">$1.56/credit</span>
              </div>
              <div className="text-xs text-emerald-600 font-semibold mb-5">Save vs. 10-credit pack</div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span>Permanent — never expire</li>
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span>Stacks on plan quota</li>
              </ul>
              <button
                onClick={() => { if (isLoggedIn) navigate("/dashboard"); else navigate("/"); }}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                {signInLabel("Buy 25 Credits →")}
              </button>
            </div>

            <div className="bg-white border border-blue-300 rounded-2xl p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-1">50 Credits</h3>
              <p className="text-xs text-muted-foreground mb-5">+50 extra permanent listing slots.</p>
              <div className="mb-1">
                <span className="text-3xl font-extrabold text-foreground">$69</span>
                <span className="text-muted-foreground text-sm ml-1">$1.38/credit</span>
              </div>
              <div className="text-xs text-emerald-600 font-semibold mb-5">Best per-credit rate</div>
              <ul className="space-y-2 text-sm text-muted-foreground flex-1 mb-6">
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span>Permanent — never expire</li>
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span>Stacks on plan quota</li>
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span>Best per-credit price</li>
              </ul>
              <button
                onClick={() => { if (isLoggedIn) navigate("/dashboard"); else navigate("/"); }}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                {signInLabel("Buy 50 Credits →")}
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Purchase listing credits from your dashboard after signing in.
          </p>
        </section>

        {/* ─── Zero Commission Banner ─── */}
        <div className="bg-gradient-to-r from-primary/10 to-violet-50 border border-primary/20 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🤝</div>
          <h2 className="text-2xl font-bold mb-2">0% Commission — Always</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm mb-6">
            LuckyBirthstone charges zero commission on every sale. When you close a deal, you keep 100% of what you negotiate. We make money only on subscriptions, verification, and add-ons — never on your margins.
          </p>
          <button
            onClick={() => navigate("/marketplace")}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Browse the Marketplace →
          </button>
        </div>
      </div>
    </div>
  );
}
