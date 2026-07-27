import { Link } from "wouter";

interface Factor {
  icon: string;
  name: string;
  weight: string;
  description: string;
  howToImprove: string;
}

const FACTORS: Factor[] = [
  {
    icon: "🤝",
    name: "Deals Completed",
    weight: "30%",
    description:
      "Every verified deal closed through LuckyBirthstone adds 5 points (capped at 100). Completing 20 deals puts you at maximum contribution from this factor.",
    howToImprove:
      "List your inventory, respond quickly to inquiries, and close deals through the platform so they are recorded and verified.",
  },
  {
    icon: "💳",
    name: "Payment Rate",
    weight: "30%",
    description:
      "The percentage of payments made on time across all your deals. 100 % on-time payments earns the full 30 points; a single late payment reduces your score proportionally.",
    howToImprove:
      "Always pay within the agreed terms. If you foresee a delay, communicate with your counterpart and reach a mutual agreement before the deadline.",
  },
  {
    icon: "⭐",
    name: "Endorsements",
    weight: "20%",
    description:
      "Trading partners can publicly endorse your work. Each endorsement is worth 10 points (capped at 100), contributing up to 20 points to your total score.",
    howToImprove:
      "After completing a deal, ask your counterpart to leave an endorsement on your profile. The more genuine, long-term relationships you build, the more endorsements accumulate.",
  },
  {
    icon: "📋",
    name: "Profile Completeness",
    weight: "10%",
    description:
      "A fully filled profile — company name, owner, logo, website, description, specialization, location, contact, and years in business — signals seriousness to potential partners.",
    howToImprove:
      "Visit your Profile page and fill every field. Upload a logo and write a clear company description to stand out.",
  },
  {
    icon: "⚡",
    name: "Response Rate",
    weight: "10%",
    description:
      "How quickly and consistently you respond to messages and inquiries. A 90 %+ response rate earns the full 10 points.",
    howToImprove:
      "Enable notifications and reply to every inquiry within 24 hours. Even a brief acknowledgment keeps your rate high.",
  },
];

interface Penalty {
  icon: string;
  name: string;
  deduction: string;
  description: string;
}

const PENALTIES: Penalty[] = [
  {
    icon: "⚠️",
    name: "Disputes",
    deduction: "−20 pts each",
    description:
      "An open or unresolved dispute deducts 20 points per case. Points are restored once a dispute is resolved and marked closed.",
  },
  {
    icon: "⏰",
    name: "Delayed Payments",
    deduction: "−10 pts each",
    description:
      "Each payment recorded as late deducts 10 points. This stacks with the Payment Rate factor, so consistent delays have a compounding negative effect.",
  },
];

interface Tier {
  range: string;
  label: string;
  color: string;
  bg: string;
  description: string;
}

const TIERS: Tier[] = [
  {
    range: "0–30",
    label: "New Member",
    color: "text-slate-600",
    bg: "bg-slate-100",
    description: "Getting started. Complete your profile and make your first deals to build visibility.",
  },
  {
    range: "31–50",
    label: "Building Trust",
    color: "text-amber-700",
    bg: "bg-amber-50",
    description: "Early track record. Partners can see you are active; keep completing deals and collecting endorsements.",
  },
  {
    range: "51–70",
    label: "Trusted",
    color: "text-blue-700",
    bg: "bg-blue-50",
    description: "Solid standing. Most buyers and sellers are comfortable trading with you at this level.",
  },
  {
    range: "71–90",
    label: "Highly Trusted",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    description: "Top-tier credibility. You get priority visibility in search results and preferential access to premium features.",
  },
  {
    range: "91–100",
    label: "Elite",
    color: "text-violet-700",
    bg: "bg-violet-50",
    description: "The gold standard on LuckyBirthstone. Elite members enjoy highest search ranking, featured placement, and a special badge.",
  },
];

const FAQS = [
  {
    q: "How often is my Trust Score updated?",
    a: "Your score is recalculated automatically after every deal, payment, endorsement, dispute event, or profile update — usually within minutes.",
  },
  {
    q: "Can my score go down?",
    a: "Yes. Disputes, delayed payments, and a drop in your response rate will lower your score. Think of it as a live reflection of your trading behaviour.",
  },
  {
    q: "Is my Trust Score visible to other traders?",
    a: "Yes. Your score is displayed on your company profile so that potential trading partners can assess your credibility before reaching out.",
  },
  {
    q: "What if I dispute an incorrect dispute record?",
    a: "Contact our support team. We investigate all claims and will correct the record if a dispute was logged in error.",
  },
  {
    q: "Does my subscription plan affect my score?",
    a: "No. The score is based purely on trading activity, profile completeness, and payment behaviour — not on which plan you subscribe to.",
  },
  {
    q: "How is Profile Completeness calculated?",
    a: "We check ten key fields: company name, owner/representative, logo, website, company description, specialisation, years in business, contact number, city, and country. Each filled field contributes 10 % toward a perfect completeness score.",
  },
];

export default function TrustScorePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-8">
        <Link href="/"><span className="hover:text-primary cursor-pointer">Home</span></Link>
        <span>›</span>
        <span className="text-foreground font-medium">Trust Score</span>
      </nav>

      {/* ── Hero ── */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          🛡️ Platform Guide
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4 leading-tight">
          Trust Score on LuckyBirthstone
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          In B2B gemstone trading, reputation is everything. The Trust Score is LuckyBirthstone's transparent, data-driven credibility rating — built from your real trading history so every counterpart can assess your reliability before a single message is sent.
        </p>
      </div>

      {/* ── Why trust matters ── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4">Why does trust matter in gem trading?</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The international gemstone trade spans Bangkok, Jaipur, Hong Kong, Colombo, Dubai, and dozens of other hubs. Buyers and sellers rarely meet in person. A Kashmir sapphire worth tens of thousands of dollars can change hands between people who have never shared the same room.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          In this environment, reputation is the single most valuable asset a trader carries. Traditional markets relied on word-of-mouth networks built over decades. LuckyBirthstone brings that concept online — and makes it objective, verifiable, and instantly accessible to every member of the platform.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          A high Trust Score signals to the community that you pay on time, complete deals as agreed, respond promptly, and conduct yourself professionally. It replaces years of accumulated gossip with a single, honest number.
        </p>
      </section>

      {/* ── Score range visual ── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-5">Trust Score ranges</h2>
        <div className="space-y-3">
          {TIERS.map((tier) => (
            <div key={tier.label} className={`flex items-start gap-4 p-4 rounded-xl ${tier.bg} border border-border/40`}>
              <div className="shrink-0 text-center min-w-[52px]">
                <div className={`text-sm font-bold ${tier.color}`}>{tier.range}</div>
              </div>
              <div>
                <div className={`text-sm font-bold ${tier.color} mb-0.5`}>{tier.label}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{tier.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it's calculated ── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-2">How is the score calculated?</h2>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Your Trust Score is a weighted sum of five positive factors, minus penalties for disputes and late payments. The final number is always clamped between 0 and 100.
        </p>

        {/* Formula box */}
        <div className="bg-slate-50 border border-border rounded-2xl p-5 mb-8 font-mono text-xs text-muted-foreground leading-loose overflow-x-auto">
          <span className="text-foreground font-semibold">Trust Score =</span>{" "}
          (Deals × 30%) + (Payment Rate × 30%) + (Endorsements × 20%){" "}
          + (Profile % × 10%) + (Response Rate × 10%){" "}
          <span className="text-red-500">− (Disputes × 20) − (Delayed Payments × 10)</span>
          <br />
          <span className="text-slate-400 text-[10px]">Result clamped 0 – 100</span>
        </div>

        {/* Factors */}
        <div className="space-y-5">
          {FACTORS.map((f) => (
            <div key={f.name} className="border border-border rounded-2xl p-5 bg-white">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{f.icon}</span>
                  <span className="font-semibold text-sm">{f.name}</span>
                </div>
                <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full shrink-0">
                  Weight: {f.weight}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{f.description}</p>
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <span className="text-emerald-600 text-sm shrink-0">✦</span>
                <p className="text-xs text-emerald-800 leading-relaxed">{f.howToImprove}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Penalties ── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-2">Penalties</h2>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          The following behaviours deduct points directly from your final score and can push it below what your positive factors alone would produce.
        </p>
        <div className="space-y-4">
          {PENALTIES.map((p) => (
            <div key={p.name} className="flex items-start gap-4 border border-red-100 bg-red-50 rounded-xl p-4">
              <span className="text-2xl shrink-0">{p.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-foreground">{p.name}</span>
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{p.deduction}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Action guide ── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-2">Your step-by-step improvement guide</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Follow these actions in order of impact to raise your score as quickly as possible.
        </p>
        <ol className="space-y-4">
          {[
            {
              step: "Complete your profile to 100 %",
              impact: "Immediate +10 pts",
              detail: "Go to Profile → Edit and fill every field. Upload a logo, write a company description, add your website, location, and specialisation.",
            },
            {
              step: "Close your first 5 deals through the platform",
              impact: "Up to +25 pts",
              detail: "Each deal adds 5 points toward the Deals factor (capped at 100). Even small transactions count. Use the Deal Tracker to record them.",
            },
            {
              step: "Never miss a payment deadline",
              impact: "Protects your 30 % weight",
              detail: "Payment Rate is the joint-heaviest factor. A single late payment immediately chips away at your score. Pay early when possible.",
            },
            {
              step: "Collect endorsements from every counterpart",
              impact: "Up to +20 pts",
              detail: "After each deal, ask the other party to endorse you. 10 endorsements maxes out this factor. Include a personal note when you ask.",
            },
            {
              step: "Maintain a 90 %+ response rate",
              impact: "+up to 10 pts",
              detail: "Reply to every message within 24 hours. If you cannot respond immediately, set up a brief out-of-office reply to keep partners informed.",
            },
            {
              step: "Resolve any open disputes immediately",
              impact: "Recover up to +20 pts each",
              detail: "An unresolved dispute is the fastest way to sink your score. Engage with the other party, find a fair resolution, and ask our support team to mark the dispute closed.",
            },
          ].map((item, i) => (
            <li key={i} className="flex gap-4 items-start">
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 border border-border rounded-xl p-4 bg-white">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-semibold text-sm">{item.step}</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">{item.impact}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── FAQ ── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-5">Frequently asked questions</h2>
        <div className="space-y-4">
          {FAQS.map((faq) => (
            <div key={faq.q} className="border border-border rounded-xl p-5 bg-white">
              <p className="font-semibold text-sm mb-2">{faq.q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-7 text-center">
        <div className="text-3xl mb-3">🛡️</div>
        <h3 className="text-lg font-bold mb-2">Ready to build your reputation?</h3>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed max-w-md mx-auto">
          Your Trust Score starts growing the moment you complete your profile. Every deal, every endorsement, every on-time payment counts.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/profile">
            <button className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
              Complete My Profile →
            </button>
          </Link>
          <Link href="/marketplace">
            <button className="px-5 py-2.5 border border-border text-sm font-semibold rounded-xl hover:bg-secondary transition-colors">
              Browse Marketplace
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
