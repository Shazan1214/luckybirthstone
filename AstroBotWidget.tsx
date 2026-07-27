import { useState, useEffect, useRef } from "react";
import { api, type AstroResult } from "@/lib/api";
import { Link } from "wouter";

type Concern = "career" | "wealth" | "health" | "marriage" | "protection";
type Budget = "low" | "medium" | "premium";

const CONCERNS: { value: Concern; label: string; icon: string }[] = [
  { value: "career",     label: "Career & Success", icon: "💼" },
  { value: "wealth",     label: "Wealth & Money",   icon: "💰" },
  { value: "health",     label: "Health & Healing", icon: "🌿" },
  { value: "marriage",   label: "Love & Harmony",   icon: "💍" },
  { value: "protection", label: "Protection",        icon: "🛡️" },
];

const BUDGETS: { value: Budget; label: string; icon: string }[] = [
  { value: "low",     label: "Starter",  icon: "🌱" },
  { value: "medium",  label: "Premium",  icon: "⭐" },
  { value: "premium", label: "Luxury",   icon: "👑" },
];

const GEM_ICON: Record<string, string> = {
  "Red Coral": "🔴", "Emerald": "💚", "Pearl": "⚪", "Ruby": "❤️",
  "Diamond": "💎", "Yellow Sapphire": "💛", "Blue Sapphire": "💙", "Turquoise": "🩵",
};

const GEM_BG: Record<string, string> = {
  "Red Coral": "bg-red-50 border-red-200",
  "Emerald": "bg-green-50 border-green-200",
  "Pearl": "bg-slate-50 border-slate-200",
  "Ruby": "bg-rose-50 border-rose-200",
  "Diamond": "bg-blue-50 border-blue-200",
  "Yellow Sapphire": "bg-yellow-50 border-yellow-200",
  "Blue Sapphire": "bg-indigo-50 border-indigo-200",
  "Turquoise": "bg-teal-50 border-teal-200",
};

export default function AstroBotWidget() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"dob" | "concern" | "budget" | "loading" | "result" | "error">("dob");
  const [dob, setDob] = useState("");
  const [concern, setConcern] = useState<Concern | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [result, setResult] = useState<AstroResult | null>(null);
  const [error, setError] = useState("");
  const [pulse, setPulse] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Drag state — use ref+DOM for position to avoid re-renders on every move
  const wrapperRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [step]);

  function reset() {
    setStep("dob");
    setDob("");
    setConcern(null);
    setBudget(null);
    setResult(null);
    setError("");
  }

  async function submit(budgetVal: Budget) {
    setStep("loading");
    try {
      const data = await api.astro.recommend({
        date_of_birth: dob,
        concern: concern ?? undefined,
        budget_preference: budgetVal,
      });
      setResult(data);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("error");
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    didDragRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: posRef.current.x, origY: posRef.current.y };
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) didDragRef.current = true;
    if (didDragRef.current) {
      const x = dragRef.current.origX + dx;
      const y = dragRef.current.origY + dy;
      posRef.current = { x, y };
      if (wrapperRef.current) {
        wrapperRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    }
  }

  function releaseDrag(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  function handleClick() {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setOpen((o) => !o);
    setPulse(false);
  }

  const gemIcon = result ? (GEM_ICON[result.recommended_gemstone] ?? "💎") : "💎";
  const gemBg = result ? (GEM_BG[result.recommended_gemstone] ?? "bg-purple-50 border-purple-200") : "";

  return (
    <div
      ref={wrapperRef}
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2"
    >
      {/* Chat panel — rendered above the button in DOM order (flex-col, items at end) */}
      <div
        className={`w-[340px] max-w-[calc(100vw-40px)] bg-white rounded-2xl shadow-2xl border border-border flex flex-col transition-all duration-300 origin-bottom-right ${
          open ? "scale-100 opacity-100 pointer-events-auto" : "scale-90 opacity-0 pointer-events-none"
        }`}
        style={{ maxHeight: "min(520px, calc(100vh - 110px))" }}
      >
        {/* Header — also acts as a drag handle for the panel */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-4 py-3 rounded-t-2xl flex items-center gap-3">
          <div className="text-2xl">🔮</div>
          <div>
            <p className="font-bold text-sm leading-tight">AstroBot</p>
            <p className="text-[11px] text-indigo-200">Find your lucky gemstone</p>
          </div>
          <button onClick={() => setOpen(false)} className="ml-auto text-indigo-200 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollBehavior: "smooth" }}>

          {/* Bot greeting */}
          <BotBubble>
            <p className="text-sm leading-relaxed">
              Namaste! 🙏 I'm AstroBot. Based on your birth date and life goals, I'll find the perfect gemstone for you using Vedic astrology.
            </p>
          </BotBubble>

          {/* Step: DOB */}
          {(step === "dob" || step === "concern" || step === "budget" || step === "loading" || step === "result" || step === "error") && (
            <div className="space-y-2">
              <BotBubble>
                <p className="text-sm font-medium">🎂 What's your date of birth?</p>
              </BotBubble>
              {dob ? (
                <UserBubble>
                  {new Date(dob + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                </UserBubble>
              ) : step === "dob" ? (
                <div className="space-y-2">
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => { if (dob) setStep("concern"); }}
                    disabled={!dob}
                    className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-40"
                  >
                    Continue →
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Step: Concern */}
          {(step === "concern" || step === "budget" || step === "loading" || step === "result" || step === "error") && (
            <div className="space-y-2">
              <BotBubble>
                <p className="text-sm font-medium">🌟 What's your primary intention?</p>
              </BotBubble>
              {concern ? (
                <UserBubble>
                  {CONCERNS.find((c) => c.value === concern)?.icon} {CONCERNS.find((c) => c.value === concern)?.label}
                </UserBubble>
              ) : step === "concern" ? (
                <div className="grid grid-cols-1 gap-1.5">
                  {CONCERNS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => { setConcern(c.value); setStep("budget"); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border hover:border-indigo-400 hover:bg-indigo-50 transition text-left text-sm"
                    >
                      <span className="text-base">{c.icon}</span>
                      <span className="font-medium text-foreground">{c.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Step: Budget */}
          {(step === "budget" || step === "loading" || step === "result" || step === "error") && (
            <div className="space-y-2">
              <BotBubble>
                <p className="text-sm font-medium">💰 What's your budget range?</p>
              </BotBubble>
              {budget ? (
                <UserBubble>
                  {BUDGETS.find((b) => b.value === budget)?.icon} {BUDGETS.find((b) => b.value === budget)?.label}
                </UserBubble>
              ) : step === "budget" ? (
                <div className="grid grid-cols-3 gap-2">
                  {BUDGETS.map((b) => (
                    <button
                      key={b.value}
                      onClick={() => { setBudget(b.value); submit(b.value); }}
                      className="flex flex-col items-center gap-1 px-2 py-3 rounded-xl border border-border hover:border-indigo-400 hover:bg-indigo-50 transition text-center"
                    >
                      <span className="text-xl">{b.icon}</span>
                      <span className="text-xs font-semibold text-foreground">{b.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Loading */}
          {step === "loading" && (
            <BotBubble>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="animate-spin text-base">⏳</span>
                Reading your birth chart…
              </div>
            </BotBubble>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="space-y-3">
              <BotBubble>
                <p className="text-sm text-red-600">{error || "Couldn't read your chart. Please try again."}</p>
              </BotBubble>
              <button onClick={reset} className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition">
                Try Again
              </button>
            </div>
          )}

          {/* Result */}
          {step === "result" && result && (
            <div className="space-y-3">
              <BotBubble>
                <p className="text-sm">✨ Your stars have spoken! Based on your <strong>{result.zodiac}</strong> energy, your lucky stone is:</p>
              </BotBubble>

              <div className={`rounded-2xl border-2 p-4 text-center ${gemBg}`}>
                <div className="text-4xl mb-1">{gemIcon}</div>
                <p className="text-lg font-bold text-foreground">{result.recommended_gemstone}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{result.reason}</p>
              </div>

              {result.listings && result.listings.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Available on marketplace</p>
                  {result.listings.slice(0, 2).map((l) => (
                    <Link key={l.id} href={`/listing/${l.id}`}>
                      <div className="flex justify-between items-center px-3 py-2 rounded-xl border border-border hover:bg-indigo-50 transition cursor-pointer text-sm">
                        <span>💎 {l.stone_type} {l.carat}ct</span>
                        <span className="font-semibold text-indigo-700 text-xs">{l.currency} {l.price.toLocaleString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Link href="/astrobot" className="flex-1">
                  <div onClick={() => setOpen(false)} className="w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition text-center cursor-pointer">
                    Full Report →
                  </div>
                </Link>
                <button onClick={reset} className="px-3 py-2 border border-border rounded-xl text-xs text-muted-foreground hover:bg-secondary transition">
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pulse balloon */}
      {!open && pulse && (
        <div className="bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg animate-bounce whitespace-nowrap">
          ✨ Discover your lucky gemstone!
        </div>
      )}

      {/* Floating button — drag to reposition, click to open/close */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={releaseDrag}
        onPointerCancel={releaseDrag}
        onClick={handleClick}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl transition-all duration-300 touch-none select-none ${
          open
            ? "bg-slate-700 text-white rotate-45 scale-95"
            : "bg-gradient-to-br from-indigo-600 to-purple-700 text-white hover:scale-110"
        } ${dragRef.current ? "cursor-grabbing" : "cursor-grab"}`}
        aria-label="AstroBot — drag to move"
      >
        {open ? "✕" : "🔮"}
      </button>
    </div>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-sm shrink-0 mt-0.5">🔮</div>
      <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]">{children}</div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[80%] font-medium">{children}</div>
    </div>
  );
}
