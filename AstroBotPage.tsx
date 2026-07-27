import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { api, type AstroResult, type AstroListing } from "../lib/api";

type Concern = "career" | "wealth" | "health" | "marriage" | "protection";
type Budget = "low" | "medium" | "premium";

const CONCERNS: { value: Concern; label: string; icon: string; desc: string }[] = [
  { value: "career",     label: "Career",     icon: "💼", desc: "Professional growth & success" },
  { value: "wealth",     label: "Wealth",     icon: "💰", desc: "Financial abundance & prosperity" },
  { value: "health",     label: "Health",     icon: "🌿", desc: "Vitality & healing energy" },
  { value: "marriage",   label: "Love",       icon: "💍", desc: "Relationships & harmony" },
  { value: "protection", label: "Protection", icon: "🛡️", desc: "Shield against negative energy" },
];

const BUDGETS: { value: Budget; label: string; icon: string; desc: string }[] = [
  { value: "low",     label: "Starter",  icon: "🌱", desc: "Entry-level natural stones" },
  { value: "medium",  label: "Premium",  icon: "⭐", desc: "Natural, untreated stones" },
  { value: "premium", label: "Luxury",   icon: "👑", desc: "Certified investment-grade" },
];

const ZODIAC_EMOJI: Record<string, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋",
  Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏",
  Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

const GEM_COLOR: Record<string, string> = {
  "Red Coral":       "from-red-50 to-orange-50 border-red-200",
  "Emerald":         "from-green-50 to-emerald-50 border-green-200",
  "Pearl":           "from-slate-50 to-gray-50 border-slate-200",
  "Ruby":            "from-rose-50 to-red-50 border-rose-200",
  "Diamond":         "from-blue-50 to-cyan-50 border-blue-200",
  "Yellow Sapphire": "from-yellow-50 to-amber-50 border-yellow-200",
  "Blue Sapphire":   "from-blue-50 to-indigo-50 border-blue-200",
  "Turquoise":       "from-teal-50 to-cyan-50 border-teal-200",
};

const GEM_ICON: Record<string, string> = {
  "Red Coral": "🔴", "Emerald": "💚", "Pearl": "⚪", "Ruby": "❤️",
  "Diamond": "💎", "Yellow Sapphire": "💛", "Blue Sapphire": "💙", "Turquoise": "🩵",
};

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { USD: "$", INR: "₹", AED: "AED ", THB: "฿" };
  const sym = symbols[currency] ?? currency + " ";
  return sym + price.toLocaleString();
}

export default function AstroBotPage() {
  const [, navigate] = useLocation();

  // Read ?ref= from URL (trader referral)
  const refTraderId = new URLSearchParams(window.location.search).get("ref") ?? null;

  const [step, setStep] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [dob, setDob] = useState("");
  const [concern, setConcern] = useState<Concern | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AstroResult | null>(null);
  const [error, setError] = useState("");

  // Lead capture (shown after result when trader ref is present, or no listings)
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [waCustomerLink, setWaCustomerLink] = useState<string | null>(null);
  const leadRef = useRef<HTMLDivElement>(null);

  // Legacy inquiry (non-ref path, no listings)
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState("");
  const inquiryRef = useRef<HTMLDivElement>(null);

  const isRefMode = !!refTraderId;

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const data = await api.astro.recommend({
        date_of_birth: dob,
        concern: concern ?? undefined,
        budget_preference: budget ?? "medium",
        ref_trader_id: refTraderId ?? undefined,
      });
      setResult(data);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Trader-ref lead capture
  async function submitLead() {
    if (!result || !refTraderId) return;
    setLeadLoading(true);
    setLeadError("");
    try {
      const res = await api.astro.captureLead({
        trader_id: refTraderId,
        customer_name: customerName.trim(),
        customer_phone: leadPhone.trim(),
        customer_email: leadEmail.trim() || undefined,
        recommended_gemstone: result.recommended_gemstone,
        zodiac: result.zodiac,
        concern: concern ?? undefined,
        budget: budget ?? undefined,
        astro_reason: result.reason,
      });
      setLeadSuccess(true);
      if (res.whatsapp_customer_link) setWaCustomerLink(res.whatsapp_customer_link);
    } catch (e) {
      setLeadError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLeadLoading(false);
    }
  }

  // Legacy platform-wide inquiry
  async function submitInquiry() {
    if (!result) return;
    setInquiryLoading(true);
    setInquiryError("");
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    try {
      const res = await fetch(`${BASE}/api/astrobot/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inquiryName,
          email: inquiryEmail,
          phone: inquiryPhone,
          gemstone: result.recommended_gemstone,
          zodiac: result.zodiac,
          concern: concern ?? undefined,
          budget: budget ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to submit inquiry");
      }
      setInquirySuccess(true);
    } catch (e) {
      setInquiryError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setInquiryLoading(false);
    }
  }

  function reset() {
    setStep(1);
    setCustomerName("");
    setDob("");
    setConcern(null);
    setBudget(null);
    setResult(null);
    setError("");
    setLeadPhone("");
    setLeadEmail("");
    setLeadSuccess(false);
    setLeadError("");
    setInquiryName("");
    setInquiryEmail("");
    setInquiryPhone("");
    setInquirySuccess(false);
    setInquiryError("");
  }

  const gradientColors = result
    ? GEM_COLOR[result.recommended_gemstone] ?? "from-purple-50 to-indigo-50 border-purple-200"
    : "";

  const canContinueStep1 = isRefMode ? customerName.trim().length > 0 && !!dob : !!dob;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-800 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-5xl mb-3">🔮</div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">AstroBot</h1>
          <p className="text-indigo-200 text-base leading-relaxed">
            Discover your perfect gemstone based on your birth chart and life goals.
            Ancient astrology meets modern gemology.
          </p>
          {result?.trader_info && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm text-indigo-100">
              <span>🏪</span>
              <span>
                Powered by <strong className="text-white">{result.trader_info.company ?? result.trader_info.name}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Progress steps */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-2 mb-10">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= s ? "bg-indigo-600 text-white" : "bg-white border-2 border-indigo-200 text-indigo-300"
                }`}>
                  {step > s ? "✓" : s}
                </div>
                {s < 3 && <div className={`w-16 h-0.5 mx-1 ${step > s ? "bg-indigo-600" : "bg-indigo-200"}`} />}
              </div>
            ))}
          </div>
        )}

        {/* STEP 1 — Name (if ref mode) + Date of birth */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
            <div className="text-center mb-7">
              <div className="text-4xl mb-2">🎂</div>
              <h2 className="text-xl font-bold text-foreground">
                {isRefMode ? "Tell us about yourself" : "When were you born?"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Your birth date reveals your zodiac sign and ruling planet</p>
            </div>
            <div className="space-y-4">
              {isRefMode && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Your Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date of Birth *</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!canContinueStep1}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Concern */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
            <div className="text-center mb-7">
              <div className="text-4xl mb-2">🌟</div>
              <h2 className="text-xl font-bold text-foreground">What do you seek?</h2>
              <p className="text-muted-foreground text-sm mt-1">Your intention shapes the gemstone recommendation</p>
            </div>
            <div className="grid grid-cols-1 gap-3 mb-6">
              {CONCERNS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setConcern(c.value)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    concern === c.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-border hover:border-indigo-300 hover:bg-indigo-50/50"
                  }`}
                >
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.desc}</div>
                  </div>
                  {concern === c.value && <span className="ml-auto text-indigo-600 text-lg">✓</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setStep(1); setConcern(null); }}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!concern}
                className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Budget */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
            <div className="text-center mb-7">
              <div className="text-4xl mb-2">💎</div>
              <h2 className="text-xl font-bold text-foreground">Budget preference?</h2>
              <p className="text-muted-foreground text-sm mt-1">This guides the quality tier of your recommended stone</p>
            </div>
            <div className="grid grid-cols-1 gap-3 mb-6">
              {BUDGETS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setBudget(b.value)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    budget === b.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-border hover:border-indigo-300 hover:bg-indigo-50/50"
                  }`}
                >
                  <span className="text-2xl">{b.icon}</span>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{b.label}</div>
                    <div className="text-xs text-muted-foreground">{b.desc}</div>
                  </div>
                  {budget === b.value && <span className="ml-auto text-indigo-600 text-lg">✓</span>}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-red-600 text-center mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep(2); setBudget(null); }}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={submit}
                disabled={!budget || loading}
                className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                {loading ? "Reading your chart…" : "✨ Reveal My Gemstone"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Results */}
        {step === 4 && result && (
          <div className="space-y-6">
            {/* Trader banner (ref mode) */}
            {result.trader_info && (
              <div className="bg-gradient-to-r from-indigo-800 to-purple-800 text-white rounded-2xl p-5 flex items-center gap-4">
                <div className="text-3xl">🏪</div>
                <div>
                  <div className="text-xs text-indigo-300 uppercase tracking-wider font-semibold mb-0.5">Your Gemstone Expert</div>
                  <div className="font-bold text-base">{result.trader_info.company ?? result.trader_info.name}</div>
                  {result.trader_info.phone && (
                    <a
                      href={`https://wa.me/${result.trader_info.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-300 hover:text-green-200 flex items-center gap-1 mt-0.5"
                    >
                      <span>💬</span> WhatsApp: {result.trader_info.phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Zodiac banner */}
            <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white rounded-2xl p-6 text-center shadow-lg">
              <div className="text-5xl mb-2">{ZODIAC_EMOJI[result.zodiac] ?? "⭐"}</div>
              <div className="text-lg font-bold">{result.zodiac}</div>
              <div className="text-indigo-300 text-sm mt-0.5">
                Ruled by {result.planet} · {result.element} sign
              </div>
            </div>

            {/* Recommendation card */}
            <div className={`bg-gradient-to-br ${gradientColors} border rounded-2xl p-6 shadow-sm`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{GEM_ICON[result.recommended_gemstone] ?? "💎"}</span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-0.5">Your Stone</div>
                  <h2 className="text-2xl font-bold text-foreground">{result.recommended_gemstone}</h2>
                </div>
                {result.concern_override && result.concern_override !== result.zodiac_gemstone && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                    Concern-based pick
                  </span>
                )}
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed mb-4">{result.reason}</p>

              <div className="bg-white/60 rounded-xl p-4 border border-white/80">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Suggested Quality</div>
                <div className="font-semibold text-foreground text-sm">{result.suggested_quality}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{result.quality_description}</div>
              </div>

              {result.zodiac_gemstone !== result.recommended_gemstone && (
                <div className="mt-3 text-xs text-muted-foreground bg-white/40 rounded-lg px-3 py-2">
                  Your zodiac stone is <strong>{result.zodiac_gemstone}</strong> — your concern for{" "}
                  <strong>{CONCERNS.find((c) => c.value === concern)?.label}</strong> elevated this recommendation.
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <span className="text-amber-500 text-lg mt-0.5 shrink-0">⚠️</span>
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Disclaimer:</strong> This recommendation is based on general astrological beliefs. Please consult a professional astrologer before making any decisions. Gemstone effects are not scientifically proven.
              </p>
            </div>

            {/* ── TRADER REF MODE ── Listings from trader + lead capture */}
            {isRefMode && (
              <>
                {/* Trader stock */}
                {result.listings.length > 0 ? (
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                      <span>🛒</span> {result.recommended_gemstone} Available from {result.trader_info?.company ?? result.trader_info?.name ?? "this trader"}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">Contact the trader for pricing in your preferred currency.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {result.listings.map((gem) => (
                        <GemCard key={gem.id} gem={gem} onClick={() => navigate(`/listing/${gem.id}`)} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                    <span className="text-amber-500 shrink-0 text-lg">📦</span>
                    <div className="text-sm text-amber-800">
                      <strong>{result.trader_info?.company ?? result.trader_info?.name ?? "This trader"}</strong> doesn't currently have <strong>{result.recommended_gemstone}</strong> in stock — but they can source it for you. Leave your contact below.
                    </div>
                  </div>
                )}

                {/* Lead capture form (always shown in ref mode) */}
                <div ref={leadRef} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-6 py-5 text-white">
                    <div className="text-2xl mb-1">📲</div>
                    <h3 className="text-lg font-bold">
                      {result.listings.length > 0 ? "Interested? Connect with the trader" : "Request this stone"}
                    </h3>
                    <p className="text-indigo-200 text-sm mt-0.5">
                      Leave your contact details and the trader will reach out to assist you personally.
                    </p>
                  </div>

                  {leadSuccess ? (
                    <div className="px-6 py-8 text-center space-y-4">
                      <div className="text-4xl">✅</div>
                      <h4 className="text-lg font-bold text-foreground">Request Submitted!</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Your interest in <strong>{result.recommended_gemstone}</strong> has been shared with the trader. They will contact you shortly.
                      </p>
                      {waCustomerLink && (
                        <a
                          href={waCustomerLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-600 transition-colors"
                        >
                          <span>💬</span> Chat on WhatsApp
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="px-6 py-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                          WhatsApp / Phone *
                        </label>
                        <input
                          type="tel"
                          value={leadPhone}
                          onChange={(e) => setLeadPhone(e.target.value)}
                          placeholder="+1 234 567 8900"
                          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                          Email Address <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <input
                          type="email"
                          value={leadEmail}
                          onChange={(e) => setLeadEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>

                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-xs text-indigo-700 flex gap-2">
                        <span className="shrink-0">🔮</span>
                        <span>Your <strong>{result.recommended_gemstone}</strong> recommendation and contact will be shared directly with <strong>{result.trader_info?.company ?? result.trader_info?.name ?? "the trader"}</strong>.</span>
                      </div>

                      {leadError && <p className="text-sm text-red-600">{leadError}</p>}

                      <button
                        onClick={submitLead}
                        disabled={leadLoading || !leadPhone.trim()}
                        className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                      >
                        {leadLoading ? "Submitting…" : "📲 Connect Me with the Trader"}
                      </button>
                      <p className="text-[11px] text-muted-foreground text-center">
                        Your details are shared only with this verified trader.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── GLOBAL MODE ── Listings + legacy inquiry */}
            {!isRefMode && (
              <>
                {result.listings.length > 0 ? (
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                      <span>🛒</span> Available {result.recommended_gemstone} Listings
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {result.listings.map((gem) => (
                        <GemCard key={gem.id} gem={gem} onClick={() => navigate(`/listing/${gem.id}`)} />
                      ))}
                    </div>
                  </div>
                ) : (
                  /* No listings — show dealer inquiry form */
                  <div ref={inquiryRef} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-gradient-to-r from-purple-700 to-indigo-700 px-6 py-5 text-white">
                      <div className="text-2xl mb-1">🤝</div>
                      <h3 className="text-lg font-bold">We can connect you with a dealer</h3>
                      <p className="text-purple-200 text-sm mt-0.5">
                        No {result.recommended_gemstone} listings right now — but our premium dealers can source it for you.
                      </p>
                    </div>

                    {inquirySuccess ? (
                      <div className="px-6 py-8 text-center">
                        <div className="text-4xl mb-3">✅</div>
                        <h4 className="text-lg font-bold text-foreground mb-1">Inquiry Submitted!</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Your requirement for <strong>{result.recommended_gemstone}</strong> has been shared with our verified premium dealers. Expect to hear back within 24–48 hours.
                        </p>
                      </div>
                    ) : (
                      <div className="px-6 py-6 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Your Name *</label>
                          <input type="text" value={inquiryName} onChange={(e) => setInquiryName(e.target.value)} placeholder="Full name"
                            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Contact / WhatsApp *</label>
                          <input type="tel" value={inquiryPhone} onChange={(e) => setInquiryPhone(e.target.value)} placeholder="+1 234 567 8900"
                            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Email Address *</label>
                          <input type="email" value={inquiryEmail} onChange={(e) => setInquiryEmail(e.target.value)} placeholder="you@example.com"
                            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                        {inquiryError && <p className="text-sm text-red-600">{inquiryError}</p>}
                        <button onClick={submitInquiry}
                          disabled={inquiryLoading || !inquiryName.trim() || !inquiryPhone.trim() || !inquiryEmail.trim()}
                          className="w-full py-3 bg-purple-700 text-white font-semibold rounded-xl hover:bg-purple-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                          {inquiryLoading ? "Submitting…" : "🤝 Connect Me with a Dealer"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={reset}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
              >
                ← Start Over
              </button>
              {!isRefMode && (
                <button
                  onClick={() => navigate("/")}
                  className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-sm"
                >
                  Browse Marketplace
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gem card ─────────────────────────────────────────────────────────────────
function GemCard({ gem, onClick }: { gem: AstroListing; onClick: () => void }) {
  const GEM_ICON: Record<string, string> = {
    "Red Coral": "🔴", "Emerald": "💚", "Pearl": "⚪", "Ruby": "❤️",
    "Diamond": "💎", "Yellow Sapphire": "💛", "Blue Sapphire": "💙", "Turquoise": "🩵",
  };
  return (
    <div
      className="bg-white border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-[4/3] bg-secondary overflow-hidden">
        {gem.images.length > 0 ? (
          <img src={gem.images[0]} alt={gem.stone_type} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {GEM_ICON[gem.stone_type] ?? "💎"}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-semibold text-sm text-foreground leading-snug">
            {gem.stone_type}
            {gem.is_featured && (
              <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Featured</span>
            )}
          </div>
          <div className="text-sm font-bold text-primary shrink-0">
            {(() => {
              const symbols: Record<string, string> = { USD: "$", INR: "₹", AED: "AED ", THB: "฿" };
              const sym = symbols[gem.currency] ?? gem.currency + " ";
              return sym + gem.price.toLocaleString();
            })()}
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>{gem.carat} ct · {gem.origin}</div>
          <div>{gem.treatment}</div>
        </div>
        <button
          className="mt-3 w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          View Listing
        </button>
      </div>
    </div>
  );
}
