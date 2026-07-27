import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, fmtCurrency, convertPrice, type UserType, type Gemstone, type Auction } from "@/lib/api";
import CountdownTimer from "@/components/CountdownTimer";
const FEATURES = [
  {
    icon: "🚫💸",
    title: "Why Zero Commission",
    body: "Most platforms take 5–15% on every deal. LuckyBirthstone charges nothing on transactions — ever. We earn through optional seller subscriptions and verification services, so our incentives align with yours.",
    points: ["No per-deal fees", "No hidden charges", "Flat-rate plans from $0"],
  },
  {
    icon: "🔐",
    title: "Verified Network",
    body: "Every member goes through a multi-step identity and business verification process. Buyers see verification badges so they know exactly who they're dealing with.",
    points: ["KYC & trade licence checks", "Premium verification badge", "Buyer-visible trust signals"],
  },
  {
    icon: "📊",
    title: "Price Transparency",
    body: "Every listing shows an estimated trade range powered by rule-based pricing and Rapaport benchmarks for diamonds. No more guesswork — buyers and sellers negotiate from the same data.",
    points: ["Live Rapaport benchmark for diamonds", "Market range on every gem", "Multi-currency (USD, INR, AED, THB)"],
  },
];

const USER_TYPES: { value: UserType; label: string; icon: string }[] = [
  { value: "b2b_trader",    label: "Trader",         icon: "💼" },
  { value: "retailer",      label: "Retailer",       icon: "🏪" },
  { value: "miner",         label: "Miner",          icon: "⛏️" },
  { value: "manufacturer",  label: "Manufacturer",   icon: "🏭" },
  { value: "gems_lab",      label: "Gems Lab",       icon: "🔬" },
];

type AuthMode = "login" | "signup" | "forgot" | "reset";

function AuctionCard({ auction }: { auction: Auction }) {
  const firstImg = auction.gem?.images?.find(i => i.media_type !== "video") ?? auction.gem?.images?.[0];
  const thumb = firstImg?.image_url;
  const thumbIsVideo = firstImg?.media_type === "video";
  const bid = auction.current_highest_bid || auction.starting_price;

  return (
    <Link href={`/gem-auctions/${auction.id}`}>
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col">
        <div className="aspect-[4/3] bg-slate-50 overflow-hidden relative">
          {thumb ? (
            thumbIsVideo ? (
              <>
                <video src={thumb} muted preload="metadata" playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow">
                    <svg width="14" height="14" viewBox="0 0 10 10" fill="currentColor" className="ml-0.5 text-slate-700"><polygon points="2,1 9,5 2,9" /></svg>
                  </div>
                </div>
              </>
            ) : (
              <img src={thumb} alt={auction.gem?.stone_type} className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-slate-100 to-slate-200">💎</div>
          )}
          {auction.is_featured && (
            <span className="absolute top-2 left-2 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">⭐ Featured</span>
          )}
          {auction.is_ending_soon && (
            <span className="absolute top-2 right-2 text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-semibold animate-pulse">🔥 Ending soon</span>
          )}
        </div>
        <div className="p-3 flex flex-col gap-1.5 flex-1">
          <p className="font-semibold text-sm leading-tight">{auction.gem?.stone_type ?? "Gemstone"}</p>
          <p className="text-xs text-muted-foreground">{auction.gem?.carat} ct · {auction.gem?.origin}</p>
          <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-border/40">
            <div>
              <p className="text-xs text-muted-foreground">Current bid</p>
              <p className="text-sm font-bold text-primary">${bid.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Ends in</p>
              <CountdownTimer endTime={auction.end_time} compact className="text-xs font-semibold text-foreground" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function GemCard({ gem }: { gem: Gemstone }) {
  const thumb = gem.images[0]?.image_url;
  const price = convertPrice(gem.base_price_usd, "USD", "USD");

  return (
    <Link href={`/listing/${gem.id}`}>
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col">
        <div className="aspect-[4/3] bg-slate-50 overflow-hidden">
          {thumb ? (
            <img src={thumb} alt={gem.stone_type} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-slate-100 to-slate-200">💎</div>
          )}
        </div>
        <div className="p-3 flex flex-col gap-1 flex-1">
          <p className="font-semibold text-sm leading-tight">{gem.stone_type}</p>
          <p className="text-xs text-muted-foreground">{gem.carat} ct · {gem.origin} · {gem.treatment}</p>
          <p className="text-sm font-bold text-primary mt-auto pt-2">{fmtCurrency(price, "USD")}</p>
        </div>
      </div>
    </Link>
  );
}

function AuthForm() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const initialMode = (new URLSearchParams(search).get("mode") as AuthMode | null) ?? "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);

  useEffect(() => {
    const m = new URLSearchParams(search).get("mode") as AuthMode | null;
    if (m === "login" || m === "signup") setMode(m);
  }, [search]);

  const [userType, setUserType] = useState<UserType>("b2b_trader");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const urlRef = (new URLSearchParams(search).get("ref") ?? "").toUpperCase().trim();
  const [refCode, setRefCode] = useState(urlRef);
  const [refValid, setRefValid] = useState<{ valid: boolean; name?: string } | null>(null);

  useEffect(() => {
    if (!refCode) { setRefValid(null); return; }
    const t = setTimeout(() => {
      api.validateReferralCode(refCode).then((r) => setRefValid({ valid: r.valid, name: r.referrer_name })).catch(() => setRefValid({ valid: false }));
    }, 600);
    return () => clearTimeout(t);
  }, [refCode]);

  function switchMode(m: AuthMode) { setMode(m); setError(""); setSuccess(""); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "signup") {
        const res = await api.signup({ name, email, password, user_type: userType, company_name: company, address, contact_number: contactNumber, referral_code: refValid?.valid ? refCode : undefined });
        localStorage.setItem("gw_user_id", res.id);
        localStorage.setItem("gw_email_verified", String(res.email_verified));
        localStorage.setItem("gw_verify_email", email);
        if (res._verification_code) localStorage.setItem("gw_verify_code", res._verification_code);
        navigate("/verify-email");
      } else if (mode === "login") {
        const res = await api.login({ email, password });
        localStorage.setItem("gw_user_id", res.id);
        localStorage.setItem("gw_email_verified", String(res.email_verified));
        localStorage.removeItem("gw_verify_code");
        navigate(res.email_verified ? "/marketplace" : "/verify-email");
      } else if (mode === "forgot") {
        await api.forgotPassword(email);
        setSuccess("If that email is registered, a 6-digit reset code has been sent. Check your inbox.");
        setMode("reset");
      } else if (mode === "reset") {
        await api.resetPassword(email, resetCode, newPassword);
        setSuccess("Password reset successfully! You can now sign in.");
        setMode("login"); setResetCode(""); setNewPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const formTitle = mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : mode === "forgot" ? "Forgot Password" : "Reset Password";

  return (
    <>
      {/* Privacy badge */}
      <div className="mb-4 flex items-center gap-2.5 bg-slate-50 border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground">
        <span className="text-base shrink-0">🔒</span>
        <span dangerouslySetInnerHTML={{ __html: "Your contact details are <strong class='text-foreground'>private and secure</strong>. Never shared without consent." }} />
      </div>

      {/* Forgot / Reset header */}
      {(mode === "forgot" || mode === "reset") && (
        <div className="mb-5">
          <button onClick={() => switchMode("login")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
            ← Back to Sign In
          </button>
          <h2 className="text-lg font-semibold">{formTitle}</h2>
          {mode === "forgot" && <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send a 6-digit reset code.</p>}
          {mode === "reset" && <p className="text-sm text-muted-foreground mt-1">Enter the code we emailed you and choose a new password.</p>}
        </div>
      )}

      {/* Tabs */}
      {(mode === "login" || mode === "signup") && (
        <div className="flex rounded-xl overflow-hidden border border-border bg-secondary mb-5">
          {(["login", "signup"] as const).map((m) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === m ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
        {mode === "signup" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Company Name</label>
              <input required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company"
                className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Business Address</label>
              <input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, country"
                className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Contact Number</label>
              <input required value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="+1 555 000 0000" type="tel"
                className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Business Type</label>
              <div className="grid grid-cols-2 gap-2">
                {USER_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setUserType(t.value)}
                    className={`py-3 rounded-xl border-2 text-xs font-medium transition-all ${userType === t.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                    <div className="text-xl mb-1">{t.icon}</div>
                    <div>{t.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Referral Code <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase().trim())} placeholder="e.g. JOHN1234" type="text" maxLength={20}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-ring/30 transition ${refValid?.valid ? "border-green-400 bg-green-50/40" : refValid?.valid === false ? "border-red-300" : "border-input"}`} />
              {refValid?.valid && <p className="text-xs text-green-600 mt-1">Referred by {refValid.name} — you'll both earn credits!</p>}
              {refValid?.valid === false && <p className="text-xs text-red-500 mt-1">Invalid referral code</p>}
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium mb-1.5">Email Address</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
            className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition" />
        </div>

        {mode === "reset" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">Reset Code</label>
            <input required value={resetCode} onChange={(e) => setResetCode(e.target.value)} placeholder="6-digit code from your email" maxLength={6}
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition tracking-widest font-mono" />
          </div>
        )}

        {(mode === "login" || mode === "signup") && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium">Password</label>
              {mode === "login" && (
                <button type="button" onClick={() => switchMode("forgot")} className="text-xs text-primary hover:underline">Forgot password?</button>
              )}
            </div>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition" />
          </div>
        )}

        {mode === "reset" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">New Password</label>
            <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" minLength={6}
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition" />
          </div>
        )}

        {error && <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">{error}</div>}
        {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">{success}</div>}

        {mode === "signup" && (
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
              onChange={(e) => {
                const btn = (e.target.closest("form") as HTMLFormElement | null)?.querySelector("button[type='submit']") as HTMLButtonElement | null;
                if (btn) btn.disabled = !e.target.checked;
              }}
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I agree to the{" "}
              <a href="https://luckybirthstone.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Terms of Service</a>
              {" & "}
              <a href="https://luckybirthstone.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Privacy Policy</a>
              . I consent to receiving WhatsApp notifications about new listings and auctions (opt-out anytime from your profile).
            </span>
          </label>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <span className="spinner !w-4 !h-4" />}
          {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : mode === "forgot" ? "Send Reset Code" : "Reset Password"}
        </button>

        {(mode === "login" || mode === "signup") && (
          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? "New to LuckyBirthstone? " : "Already have an account? "}
            <button type="button" className="text-primary font-medium hover:underline" onClick={() => switchMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
        )}

        {mode === "reset" && (
          <p className="text-center text-xs text-muted-foreground">
            Didn't receive the code?{" "}
            <button type="button" className="text-primary font-medium hover:underline" onClick={() => switchMode("forgot")}>Resend</button>
          </p>
        )}
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">No fees on transactions · Trusted globally</p>
    </>
  );
}

export default function AuthPage() {
  const { data: auctions = [] } = useQuery<Auction[]>({
    queryKey: ["home-auctions"],
    queryFn: () => api.getAuctions({ status: "active", limit: 6 }),
    staleTime: 30_000,
  });

  const { data: allGems = [] } = useQuery<Gemstone[]>({
    queryKey: ["home-gems"],
    queryFn: api.getInventory,
    staleTime: 30_000,
  });

  const featuredGems = allGems.filter((g) => g.is_featured).slice(0, 6);
  const recentGems = featuredGems.length > 0 ? featuredGems : allGems.slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 flex flex-col">

      {/* Founding banner */}
      <div className="w-full bg-amber-500 text-amber-950 py-2.5 px-4 flex items-center justify-center gap-3">
        <span className="text-base">🏅</span>
        <p className="text-sm font-semibold tracking-wide">Founding Seller Offer — Limited 90 Days</p>
        <span className="hidden sm:inline text-xs opacity-80">· Free boosts · Founding badge · Priority listing</span>
        <span className="ml-1 text-xs bg-amber-900/15 border border-amber-900/20 text-amber-900 px-2 py-0.5 rounded-full font-medium">Live now</span>
      </div>

      {/* ── MOBILE layout (< lg) ── */}
      <div className="lg:hidden w-full max-w-lg mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Hero */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <span className="text-3xl">💎</span>
            <span className="text-xl font-bold text-primary tracking-tight">LuckyBirthstone</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground leading-tight tracking-tight mb-3">
            Global Gem Trade Network<br />
            <span className="text-primary">Built on Trust</span>
          </h1>
          <p className="text-sm text-muted-foreground mb-3">
            Buy, sell, give on approval, and manage your entire gemstone business — all in one platform.
          </p>
          <p className="text-sm text-muted-foreground">
            Connect with verified traders, sell globally, and track every deal, payment, and partner with complete transparency.
          </p>
        </div>

        {/* Key pillars */}
        <div className="flex flex-col items-center gap-2">
          {(["0% Commission", "Approval-Based Trading Enabled", "CRM + Payments Tracking Built-In"]).map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm font-medium text-foreground/80">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">✓</span>
              {item}
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-2 italic">Your contacts stay private. Your trade stays secure.</p>
        </div>

        {/* Auth form */}
        <AuthForm />

        {/* Live Auctions */}
        {auctions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base">🏆 Live Auctions <span className="text-xs font-normal text-muted-foreground">({auctions.length})</span></h2>
              <Link href="/gem-auctions"><span className="text-xs text-primary font-medium hover:underline cursor-pointer">View all →</span></Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {auctions.slice(0, 4).map((a) => <AuctionCard key={a.id} auction={a} />)}
            </div>
          </div>
        )}

        {/* Featured Listings */}
        {recentGems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base">⭐ {featuredGems.length > 0 ? "Featured Listings" : "Recent Listings"} <span className="text-xs font-normal text-muted-foreground">({recentGems.length})</span></h2>
              <Link href="/marketplace"><span className="text-xs text-primary font-medium hover:underline cursor-pointer">Browse all →</span></Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {recentGems.slice(0, 4).map((g) => <GemCard key={g.id} gem={g} />)}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="space-y-4">
          <h2 className="font-bold text-sm text-center text-foreground/60 uppercase tracking-wider">Why traders choose us</h2>
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white/80 border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-2">{f.body}</p>
                  <ul className="space-y-0.5">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-xs text-foreground/70">
                        <span className="text-primary font-bold">·</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DESKTOP layout (lg+) ── */}
      <div className="hidden lg:block">
        {/* Two-column hero + auth */}
        <div className="flex flex-row flex-1 max-w-7xl mx-auto w-full px-8 py-16 gap-20">
          {/* Left: hero + features */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2.5 mb-10">
              <span className="text-3xl">💎</span>
              <span className="text-xl font-bold text-primary tracking-tight">LuckyBirthstone</span>
            </div>
            <h1 className="text-5xl font-bold text-foreground leading-tight tracking-tight mb-4">
              Global Gem Trade Network<br />
              <span className="text-primary">Built on Trust</span>
            </h1>
            <p className="text-base text-muted-foreground mb-2 leading-relaxed">
              Buy, sell, give on approval, and manage your entire gemstone business — all in one platform.
            </p>
            <p className="text-base text-muted-foreground mb-6 leading-relaxed">
              Connect with verified traders, sell globally, and track every deal, payment, and partner with complete transparency.
            </p>
            <ul className="space-y-3 mb-6">
              {(["0% Commission", "Approval-Based Trading Enabled", "CRM + Payments Tracking Built-In"]).map((item) => (
                <li key={item} className="flex items-start gap-3 text-base text-foreground/80">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground italic mb-10">Your contacts stay private. Your trade stays secure.</p>
            <div className="space-y-5">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-white/80 border border-border rounded-2xl p-5 shadow-sm">
                  <h2 className="font-semibold text-base mb-2">{f.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{f.body}</p>
                  <ul className="space-y-1">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-xs text-foreground/70">
                        <span className="text-primary font-bold">·</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Right: auth form (sticky) */}
          <div className="w-[380px] shrink-0">
            <div className="sticky top-8 space-y-4">
              <AuthForm />
            </div>
          </div>
        </div>

        {/* Auctions + Featured below hero, full width */}
        {(auctions.length > 0 || recentGems.length > 0) && (
          <div className="max-w-7xl mx-auto w-full px-8 pb-16 space-y-10">
            {auctions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">🏆 Live Auctions <span className="text-sm font-normal text-muted-foreground">({auctions.length} active)</span></h2>
                  <Link href="/gem-auctions"><span className="text-sm text-primary font-medium hover:underline cursor-pointer">View all →</span></Link>
                </div>
                <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
                  {auctions.slice(0, 6).map((a) => <AuctionCard key={a.id} auction={a} />)}
                </div>
              </div>
            )}

            {recentGems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">⭐ {featuredGems.length > 0 ? "Featured Listings" : "Recent Listings"} <span className="text-sm font-normal text-muted-foreground">({recentGems.length})</span></h2>
                  <Link href="/marketplace"><span className="text-sm text-primary font-medium hover:underline cursor-pointer">Browse all →</span></Link>
                </div>
                <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
                  {recentGems.slice(0, 6).map((g) => <GemCard key={g.id} gem={g} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-white/60 py-4 px-6 text-center text-xs text-muted-foreground">
        LuckyBirthstone · B2B Gemstone Marketplace · Prices for reference only · No investment advice
      </div>
    </div>
  );
}
