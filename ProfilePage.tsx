import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  api, computeProfileCompletion, type PublicProfile, type VerificationPricing, type Endorsement,
  fetchMyDeals, confirmDeal, completeDeal, cancelDeal, proposeDeal, type Deal,
  fetchAcceptedConnections, fetchPendingConnections, acceptConnection, rejectConnection, type Connection,
  fetchCreditBalance, fetchCreditHistory, type CreditTransaction,
  fetchActivities, type Activity,
} from "@/lib/api";
import { useUpload } from "@workspace/object-storage-web";

const BADGE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  none: { label: "Unverified", color: "text-slate-500 bg-slate-100", icon: "" },
  basic_verified: { label: "Basic Verified", color: "text-green-700 bg-green-100 border border-green-200", icon: "✓" },
  verified: { label: "Verified", color: "text-sky-700 bg-sky-100 border border-sky-200", icon: "✓" },
  legacy_verified: { label: "Legacy Verified", color: "text-amber-700 bg-amber-100 border border-amber-200", icon: "★" },
};

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic (5 listings)",
  pro: "Pro (50 listings)",
  premium: "Premium (Unlimited)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="w-full px-3 py-2.5 rounded-lg border border-border bg-slate-50 text-sm text-muted-foreground flex items-center justify-between gap-2">
        <span>{value ?? "Not provided"}</span>
        {note && <span className="text-xs text-slate-400 shrink-0">🔒 {note}</span>}
      </div>
    </div>
  );
}

function LogoAvatar({ name, logoUrl, editing, onLogoUrl }: {
  name: string; logoUrl: string; editing: boolean; onLogoUrl: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res: { objectPath: string }) => onLogoUrl(`/api/storage${res.objectPath}`),
  });
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <div className="relative w-14 h-14 shrink-0 group">
      {logoUrl ? (
        <img src={logoUrl} alt="Company logo" className="w-14 h-14 rounded-full object-cover border border-border" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
          {initial}
        </div>
      )}
      {editing && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await uploadFile(f); if (fileRef.current) fileRef.current.value = ""; } }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={isUploading}
            className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait">
            {isUploading ? (
              <span className="text-white text-[10px] font-semibold">{progress}%</span>
            ) : (
              <span className="text-white text-xs">📷</span>
            )}
          </button>
        </>
      )}
    </div>
  );
}

const MAX_GALLERY = 12;

function GalleryUploader({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res: { objectPath: string }) => {
      onChange([...urls, `/api/storage${res.objectPath}`]);
    },
  });

  function remove(i: number) {
    onChange(urls.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
        {urls.map((url, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
            <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {urls.length < MAX_GALLERY && (
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all disabled:opacity-50 disabled:cursor-wait"
          >
            {isUploading ? (
              <>
                <span className="text-base">⏳</span>
                <span className="text-[10px] font-semibold">{progress}%</span>
              </>
            ) : (
              <>
                <span className="text-xl">+</span>
                <span className="text-[10px] font-medium">Add Photo</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) { await uploadFile(f); if (fileRef.current) fileRef.current.value = ""; }
        }}
      />
      <p className="text-xs text-muted-foreground">{urls.length}/{MAX_GALLERY} photos · Shown on your public company page</p>
    </div>
  );
}

function SocialLinkFields({ instagram, facebook, website, onInstagram, onFacebook, onWebsite }: {
  instagram: string; facebook: string; website: string;
  onInstagram: (v: string) => void; onFacebook: (v: string) => void; onWebsite: (v: string) => void;
}) {
  const [active, setActive] = useState<"instagram" | "facebook" | "website" | null>(
    instagram ? "instagram" : facebook ? "facebook" : website ? "website" : null
  );
  const inputCls = "flex-1 px-3 py-2 text-sm border border-input rounded-r-lg outline-none focus:ring-2 focus:ring-ring/30 transition bg-white";
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <button type="button" title="Instagram"
          onClick={() => setActive(active === "instagram" ? null : "instagram")}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active === "instagram" ? "shadow-md scale-105" : "opacity-60 hover:opacity-100"}`}
          style={{ background: active === "instagram" ? "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)" : "#f3f4f6" }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill={active === "instagram" ? "white" : "#833ab4"}>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </button>
        <button type="button" title="Facebook"
          onClick={() => setActive(active === "facebook" ? null : "facebook")}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active === "facebook" ? "shadow-md scale-105" : "opacity-60 hover:opacity-100"}`}
          style={{ background: active === "facebook" ? "#1877f2" : "#f3f4f6" }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill={active === "facebook" ? "white" : "#1877f2"}>
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </button>
        <button type="button" title="Website"
          onClick={() => setActive(active === "website" ? null : "website")}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active === "website" ? "shadow-md scale-105 bg-sky-500" : "opacity-60 hover:opacity-100 bg-slate-100"}`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke={active === "website" ? "white" : "#0ea5e9"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </button>
      </div>
      {active === "instagram" && (
        <div className="flex rounded-lg overflow-hidden border border-pink-300 focus-within:ring-2 focus-within:ring-pink-300/40">
          <span className="px-3 py-2 text-xs font-semibold text-white whitespace-nowrap" style={{ background: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)" }}>instagram.com/</span>
          <input value={instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "")} placeholder="yourhandle"
            onChange={(e) => onInstagram(e.target.value ? `https://instagram.com/${e.target.value.replace(/^@/, "")}` : "")}
            className={inputCls} style={{ borderRadius: 0 }} autoFocus />
        </div>
      )}
      {active === "facebook" && (
        <div className="flex rounded-lg overflow-hidden border border-blue-300 focus-within:ring-2 focus-within:ring-blue-300/40">
          <span className="px-3 py-2 text-xs font-semibold text-white bg-[#1877f2] whitespace-nowrap">facebook.com/</span>
          <input value={facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")} placeholder="yourpage"
            onChange={(e) => onFacebook(e.target.value ? `https://facebook.com/${e.target.value}` : "")}
            className={inputCls} style={{ borderRadius: 0 }} autoFocus />
        </div>
      )}
      {active === "website" && (
        <div className="flex rounded-lg overflow-hidden border border-sky-300 focus-within:ring-2 focus-within:ring-sky-300/40">
          <span className="px-3 py-2 text-xs font-semibold text-white bg-sky-500 whitespace-nowrap">https://</span>
          <input value={website.replace(/^https?:\/\//i, "")} placeholder="yourwebsite.com"
            onChange={(e) => onWebsite(e.target.value ? `https://${e.target.value.replace(/^https?:\/\//i, "")}` : "")}
            className={inputCls} style={{ borderRadius: 0 }} autoFocus />
        </div>
      )}
      {(instagram || facebook || website) && !active && (
        <div className="flex flex-wrap gap-2 mt-1">
          {instagram && <span className="text-xs text-muted-foreground">📸 {instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").split("?")[0]}</span>}
          {facebook && <span className="text-xs text-muted-foreground">🔵 {facebook.replace(/^https?:\/\/(www\.)?/i, "").split("?")[0]}</span>}
          {website && <span className="text-xs text-muted-foreground">🌐 {website.replace(/^https?:\/\/(www\.)?/i, "").split("?")[0]}</span>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Click an icon to add or edit that link. Click again to collapse.</p>
    </div>
  );
}

function DocUploadField({ label, desc, url, setUrl }: { label: string; desc: string; url: string; setUrl: (u: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res: { objectPath: string }) => setUrl(`/api/storage${res.objectPath}`),
  });

  return (
    <div className="border border-dashed border-border rounded-xl p-4 bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          {url && (
            <a href={url} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2 inline-flex items-center gap-1">
              📄 Uploaded ✓
            </a>
          )}
        </div>
        <div className="shrink-0">
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) { await uploadFile(f); if (fileRef.current) fileRef.current.value = ""; }
            }} />
          <button type="button" onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="px-3 py-1.5 text-xs font-semibold border border-border bg-white hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5">
            {isUploading ? (
              <><span className="spinner !w-3 !h-3" />{progress}%</>
            ) : url ? "Replace" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

type VerifyStep = 0 | 1 | 2 | 3 | "done";

function VerificationSection({ profile, onRefresh }: { profile: PublicProfile; onRefresh: () => void }) {
  const userId = localStorage.getItem("gw_user_id")!;
  const [step, setStep] = useState<VerifyStep>(0);
  const [selectedTier, setSelectedTier] = useState<"basic_verified" | "verified" | "legacy_verified" | null>(null);
  const [tradeLicenseUrl, setTradeLicenseUrl] = useState("");
  const [govIdUrl, setGovIdUrl] = useState("");
  const [pricing, setPricing] = useState<VerificationPricing | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ message: string } | null>(null);

  useEffect(() => {
    api.getVerificationPricing().then(setPricing).catch(() => {});
  }, []);

  const tierPricing = pricing?.pricing[selectedTier ?? "basic_verified"];

  async function submit() {
    if (!selectedTier) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api.requestVerification(userId, {
        tier: selectedTier,
        trade_license_document_url: tradeLicenseUrl || undefined,
        government_id_document_url: govIdUrl || undefined,
      });
      setSuccess({ message: (result as Record<string, string>).message });
      setStep("done");
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (profile.verification_status !== "unverified") {
    const badge = BADGE_LABELS[profile.verification_badge] ?? BADGE_LABELS["none"];
    return (
      <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-base mb-4 flex items-center gap-2">🔍 Verification Status</h2>
        <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-2xl">{badge.icon}</div>
          <div>
            <p className="font-bold text-emerald-800">{badge.label}</p>
            <p className="text-sm text-emerald-700 mt-0.5">Your account is verified on LuckyBirthstone</p>
          </div>
        </div>
      </div>
    );
  }

  if (profile.requested_tier && step !== "done") {
    return (
      <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-base mb-4 flex items-center gap-2">🔍 Verification Status</h2>
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-4">
          <span className="text-3xl mt-0.5">⏳</span>
          <div>
            <p className="font-bold text-amber-800">Application Under Review</p>
            <p className="text-sm text-amber-700 mt-1">
              You've applied for <strong>{profile.requested_tier.replace("_", " ")}</strong>.
              Our team will review your documents and update your status within 2–3 business days.
            </p>
            {profile.verification_requested_at && (
              <p className="text-xs text-amber-600 mt-2">
                Submitted: {new Date(profile.verification_requested_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
            {profile.verification_payment_amount !== null && (
              <p className="text-xs text-amber-600 mt-0.5">
                Amount paid: <strong>${profile.verification_payment_amount}</strong>
                {profile.verification_payment_amount === 0 && " (Early Access — Free)"}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="font-bold text-base mb-1 flex items-center gap-2">🔍 Get Verified on LuckyBirthstone</h2>
      <p className="text-sm text-muted-foreground mb-5">Verification builds trust with buyers and unlocks premium features.</p>

      {step !== 0 && step !== "done" && (
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                (step as number) >= s ? "bg-primary text-primary-foreground" : "bg-slate-100 text-muted-foreground"}`}>
                {(step as number) > s ? "✓" : s}
              </div>
              {s < 3 && <div className={`h-0.5 w-8 transition-colors ${(step as number) > s ? "bg-primary" : "bg-slate-200"}`} />}
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            {step === 1 ? "Choose tier" : step === 2 ? "Upload documents" : "Confirm & pay"}
          </span>
        </div>
      )}

      {step === 0 && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-semibold text-emerald-700 mb-5">
            ✓ Basic Verified is free — get your badge instantly!
          </div>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Verified sellers receive a trust badge visible to all buyers on LuckyBirthstone, increasing inquiry rates and closing more deals.
          </p>
          <button onClick={() => setStep(1)}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:opacity-90 transition-opacity shadow-sm">
            Start Verification →
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {([
              {
                tier: "basic_verified" as const,
                label: "Basic Verified",
                icon: "✓",
                color: "text-emerald-600",
                features: [
                  "✓ Free — instant approval",
                  "✓ Trust badge on all listings",
                  "✓ Higher search ranking",
                  "✓ Identity confirmed",
                ],
              },
              {
                tier: "verified" as const,
                label: "Verified",
                icon: "✓",
                color: "text-sky-600",
                features: [
                  "✓ All Basic benefits",
                  "✓ Verified badge (sky blue)",
                  "✓ Document review by team",
                  "✓ Priority in search results",
                ],
              },
              {
                tier: "legacy_verified" as const,
                label: "Legacy Verified",
                icon: "★",
                color: "text-amber-500",
                features: [
                  "★ All Verified benefits",
                  "★ Premium gold badge",
                  "★ Top placement in results",
                  "★ Enhanced business profile",
                  "★ Dedicated account manager",
                ],
              },
            ]).map(({ tier, label, icon, color, features }) => {
              const p = pricing?.pricing[tier];
              const isSelected = selectedTier === tier;
              return (
                <button key={tier} type="button" onClick={() => setSelectedTier(tier)}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 bg-white"
                  }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xl ${color}`}>{icon}</span>
                      <span className="font-bold text-sm">{label}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected ? "border-primary bg-primary" : "border-slate-300"}`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1.5 mb-4">
                    {features.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                  {p !== undefined ? (
                    <div className="mt-auto">
                      {p.is_free ? (
                        <div>
                          <span className="text-xl font-bold text-emerald-600">FREE</span>
                          <div className="text-xs text-emerald-600 font-medium mt-0.5">Instant approval</div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-xl font-bold text-foreground">${p.original}</span>
                          <div className="text-xs text-muted-foreground mt-0.5">one-time · admin review</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(2)} disabled={!selectedTier}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity">
              Continue →
            </button>
            <button onClick={() => setStep(0)} className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Back
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload your business documents for verification. Accepted formats: PDF, JPG, PNG.
          </p>
          <DocUploadField
            label="Trade License / Business Registration"
            desc="Certificate of business registration or trade license issued by your local authority."
            url={tradeLicenseUrl}
            setUrl={setTradeLicenseUrl}
          />
          <DocUploadField
            label="Government-Issued ID"
            desc="Passport, national ID card, or driver's licence of the business owner or representative."
            url={govIdUrl}
            setUrl={setGovIdUrl}
          />
          <p className="text-xs text-muted-foreground bg-slate-50 border border-border rounded-lg px-3 py-2.5">
            🔒 Documents are stored securely and only accessible by the LuckyBirthstone compliance team. They will never be shared publicly.
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
              {tradeLicenseUrl || govIdUrl ? "Continue →" : "Continue without docs →"}
            </button>
            <button onClick={() => setStep(1)} className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Back
            </button>
          </div>
        </div>
      )}

      {step === 3 && selectedTier && (
        <div className="space-y-5">
          <div className="bg-slate-50 border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Order Summary</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Verification tier</span>
                <span className="font-medium">
                  {selectedTier === "legacy_verified" ? "Legacy Verified" : selectedTier === "verified" ? "Verified" : "Basic Verified"}
                </span>
              </div>
              {tradeLicenseUrl && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trade License</span>
                  <span className="text-emerald-600 font-medium text-xs">✓ Uploaded</span>
                </div>
              )}
              {govIdUrl && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Government ID</span>
                  <span className="text-emerald-600 font-medium text-xs">✓ Uploaded</span>
                </div>
              )}
              {!(tradeLicenseUrl || govIdUrl) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Documents</span>
                  <span className="text-amber-600 text-xs font-medium">⚠ None uploaded</span>
                </div>
              )}
              <div className="border-t border-border my-2" />
              <div className="flex justify-between font-bold">
                <span>Total due today</span>
                <span className={tierPricing?.is_free ? "text-emerald-600 text-lg" : "text-lg"}>
                  {tierPricing?.is_free ? "FREE" : `$${tierPricing?.final}`}
                </span>
              </div>
            </div>
          </div>

          {tierPricing?.is_free && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
              Your Basic Verified status will be granted <strong>instantly</strong> — no payment required and no admin review needed.
            </div>
          )}

          {!(tradeLicenseUrl || govIdUrl) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              ⚠ You haven't uploaded any documents yet. You can still submit — our team may contact you to request them before approval.
            </div>
          )}

          {error && (
            <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={submit} disabled={submitting}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity">
              {submitting && <span className="spinner !w-4 !h-4" />}
              {tierPricing?.is_free ? "Submit Free Application" : `Pay $${tierPricing?.final} & Submit`}
            </button>
            <button onClick={() => setStep(2)} disabled={submitting}
              className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors">
              Back
            </button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By submitting, you confirm the documents are authentic and the information is accurate.
          </p>
        </div>
      )}

      {step === "done" && success && (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl mx-auto mb-4">✓</div>
          <h3 className="font-bold text-lg mb-2">Application Submitted!</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">{success.message}</p>
          <p className="text-xs text-muted-foreground mt-3">
            We'll review your application within 2–3 business days and notify you of the outcome.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const userId = localStorage.getItem("gw_user_id");
  const emailVerified = localStorage.getItem("gw_email_verified") === "true";
  if (!userId) { navigate("/"); return null; }
  if (!emailVerified) { navigate("/verify-email"); return null; }

  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    company_name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    website: string;
    contact_number: string;
    owner_name: string;
    trade_license_number: string;
    company_description: string;
    instagram_url: string;
    facebook_page_url: string;
    store_slug: string;
    logo_url: string;
    specialization: string;
    years_in_business: string;
    preferred_language: string;
    gallery_urls: string[];
    default_currency: string;
  }>({
    name: "", company_name: "", address: "", city: "", state: "", country: "", website: "",
    contact_number: "", owner_name: "", trade_license_number: "",
    company_description: "", instagram_url: "", facebook_page_url: "", store_slug: "",
    logo_url: "", specialization: "", years_in_business: "", preferred_language: "en",
    gallery_urls: [], default_currency: "",
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile(userId),
    retry: false,
    throwOnError: (err: Error) => {
      if (err.message.toLowerCase().includes("not found") || err.message.toLowerCase().includes("session")) {
        localStorage.removeItem("gw_user_id");
        localStorage.removeItem("gw_email_verified");
        localStorage.removeItem("gw_verify_email");
        navigate("/");
      }
      return false;
    },
  });

  function startEdit() {
    if (!profile) return;
    setForm({
      name: profile.name,
      company_name: profile.company_name ?? "",
      address: profile.address ?? "",
      city: profile.city ?? "",
      state: "",
      country: profile.country ?? "",
      website: profile.website ?? "",
      contact_number: profile.contact_number ?? "",
      owner_name: profile.owner_name ?? "",
      trade_license_number: profile.trade_license_number ?? "",
      company_description: profile.company_description ?? "",
      instagram_url: profile.instagram_url ?? "",
      facebook_page_url: profile.facebook_page_url ?? "",
      store_slug: profile.store_slug ?? "",
      logo_url: profile.logo_url ?? "",
      specialization: profile.specialization ?? "",
      years_in_business: profile.years_in_business != null ? String(profile.years_in_business) : "",
      preferred_language: profile.preferred_language ?? "en",
      gallery_urls: profile.gallery_urls ?? [],
      default_currency: profile.default_currency ?? "",
    });
    setEditing(true);
    setSaveError("");
    setSaveSuccess(false);
  }

  const { data: pendingEndorsements = [] } = useQuery<Endorsement[]>({
    queryKey: ["endorsements", "pending", userId],
    queryFn: () => api.getPendingEndorsements(userId!),
  });

  const [endorseActionId, setEndorseActionId] = useState<string | null>(null);

  async function handleEndorseAction(id: string, action: "accept" | "reject") {
    setEndorseActionId(id);
    try {
      if (action === "accept") {
        await api.acceptEndorsement(id, userId!);
      } else {
        await api.rejectEndorsement(id, userId!);
      }
      void qc.invalidateQueries({ queryKey: ["endorsements", "pending", userId] });
      void qc.invalidateQueries({ queryKey: ["profile", userId] });
    } finally {
      setEndorseActionId(null);
    }
  }

  // ─── Deals, Connections, Credits, Activity ───────────────────────────────
  const [tradeTab, setTradeTab] = useState<"deals" | "connections" | "credits" | "activity">("deals");
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealForm, setDealForm] = useState({ seller_id: "", amount_usd: "", description: "" });
  const [dealError, setDealError] = useState("");
  const [dealSubmitting, setDealSubmitting] = useState(false);

  const { data: myDeals = [], refetch: refetchDeals } = useQuery<Deal[]>({
    queryKey: ["deals", userId],
    queryFn: () => fetchMyDeals(userId!),
    enabled: !!userId,
  });

  const { data: myConnections = [], refetch: refetchConnections } = useQuery<Connection[]>({
    queryKey: ["connections", "accepted", userId],
    queryFn: () => fetchAcceptedConnections(userId!),
    enabled: !!userId,
  });

  const { data: pendingIncoming = [], refetch: refetchPending } = useQuery<Connection[]>({
    queryKey: ["connections", "pending", userId],
    queryFn: () => fetchPendingConnections(userId!),
    enabled: !!userId,
  });

  const { data: creditBalance } = useQuery<{ balance: number }>({
    queryKey: ["credits", "balance", userId],
    queryFn: () => fetchCreditBalance(userId!),
    enabled: !!userId,
  });

  const { data: creditHistory = [] } = useQuery<CreditTransaction[]>({
    queryKey: ["credits", "history", userId],
    queryFn: () => fetchCreditHistory(userId!),
    enabled: !!userId && tradeTab === "credits",
  });

  const { data: myActivities = [] } = useQuery<Activity[]>({
    queryKey: ["activities", userId],
    queryFn: () => fetchActivities(userId!, 30),
    enabled: !!userId && tradeTab === "activity",
  });

  async function handleDealAction(dealId: string, action: "confirm" | "complete" | "cancel", myUserId: string) {
    try {
      if (action === "confirm") await confirmDeal(dealId, myUserId);
      if (action === "complete") await completeDeal(dealId, myUserId);
      if (action === "cancel") await cancelDeal(dealId, myUserId);
      void refetchDeals();
      void qc.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (err: unknown) {
      console.error(err);
    }
  }

  async function handleConnectionAction(connId: string, action: "accept" | "reject") {
    try {
      if (action === "accept") await acceptConnection(connId, userId!);
      if (action === "reject") await rejectConnection(connId, userId!);
      void refetchPending();
      void refetchConnections();
    } catch (err: unknown) {
      console.error(err);
    }
  }

  async function submitDeal() {
    if (!userId) return;
    if (!dealForm.seller_id.trim() || !dealForm.amount_usd || !dealForm.description.trim()) {
      setDealError("All fields are required"); return;
    }
    setDealSubmitting(true);
    setDealError("");
    try {
      await proposeDeal({
        buyer_id: userId,
        seller_id: dealForm.seller_id.trim(),
        amount_usd: parseFloat(dealForm.amount_usd),
        description: dealForm.description.trim(),
      });
      setShowDealModal(false);
      setDealForm({ seller_id: "", amount_usd: "", description: "" });
      void refetchDeals();
    } catch (err: unknown) {
      setDealError(err instanceof Error ? err.message : "Failed to propose deal");
    } finally {
      setDealSubmitting(false);
    }
  }

  const whatsAppMutation = useMutation({
    mutationFn: (optIn: boolean) => api.updateProfile(userId, { whatsapp_opt_in: optIn }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updateProfile(userId, {
      name: form.name || undefined,
      company_name: form.company_name || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      country: form.country || undefined,
      website: form.website || undefined,
      contact_number: form.contact_number || undefined,
      owner_name: form.owner_name || undefined,
      trade_license_number: form.trade_license_number || undefined,
      company_description: form.company_description || undefined,
      instagram_url: form.instagram_url || undefined,
      facebook_page_url: form.facebook_page_url || undefined,
      store_slug: form.store_slug || undefined,
      logo_url: form.logo_url || undefined,
      specialization: form.specialization || undefined,
      years_in_business: form.years_in_business ? Number(form.years_in_business) : undefined,
      preferred_language: form.preferred_language || undefined,
      gallery_urls: form.gallery_urls,
      default_currency: form.default_currency || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: Error) => {
      if (err.message.toLowerCase().includes("session expired") || err.message.toLowerCase().includes("not found")) {
        localStorage.removeItem("gw_user_id");
        localStorage.removeItem("gw_email_verified");
        localStorage.removeItem("gw_verify_email");
        navigate("/");
        return;
      }
      setSaveError(err.message);
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 flex items-center justify-center gap-2 text-muted-foreground">
        <span className="spinner" /> Loading profile…
      </main>
    );
  }

  if (!profile) return null;

  const badge = BADGE_LABELS[profile.verification_badge] ?? BADGE_LABELS["none"];

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {/* ── Profile Completion Progress ── */}
      {profile && (() => {
        const completion = computeProfileCompletion(profile);
        const categories = ["Basic Info", "Business Details", "Verification", "Branding"];
        return (
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Profile Completion</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {completion.percentage === 100
                    ? "Your profile is complete — you'll get more buyer trust"
                    : "Complete your profile to build trust and get more leads"}
                </p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                completion.percentage >= 80 ? "bg-emerald-100 text-emerald-700" :
                completion.percentage >= 50 ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-600"
              }`}>{completion.badge}</span>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    completion.percentage >= 80 ? "bg-emerald-500" :
                    completion.percentage >= 50 ? "bg-amber-500" : "bg-red-400"
                  }`}
                  style={{ width: `${completion.percentage}%` }}
                />
              </div>
              <span className={`text-sm font-bold tabular-nums w-10 text-right ${
                completion.percentage >= 80 ? "text-emerald-600" :
                completion.percentage >= 50 ? "text-amber-600" : "text-red-500"
              }`}>{completion.percentage}%</span>
            </div>
            {/* Checklist by category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const catFields = completion.fields.filter((f) => f.category === cat);
                const catDone = catFields.filter((f) => f.done).length;
                return (
                  <div key={cat} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{cat}</p>
                      <p className="text-[11px] text-muted-foreground">{catDone}/{catFields.length}</p>
                    </div>
                    <div className="space-y-1.5">
                      {catFields.map((f) => (
                        <div key={f.key} className="flex items-center gap-2">
                          {f.done ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-emerald-500"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="2"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-slate-300"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/></svg>
                          )}
                          <span className={`text-xs leading-tight ${f.done ? "text-slate-600" : "text-slate-500"}`}>{f.label}</span>
                          {!f.done && (
                            <span className="ml-auto text-[10px] text-primary font-medium">+{f.weight}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          ✅ Profile updated successfully
        </div>
      )}

      {/* ── Pending Endorsements Banner (Phase 3) ── */}
      {pendingEndorsements.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-600 text-lg">⭐</span>
            <h2 className="font-semibold text-base">Pending Endorsements</h2>
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">{pendingEndorsements.length}</span>
          </div>
          <div className="space-y-3">
            {pendingEndorsements.map((e) => (
              <div key={e.id} className="flex gap-3 items-start p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                <div className="shrink-0">
                  {e.from_logo ? (
                    <img src={e.from_logo} alt={e.from_name} className="w-9 h-9 rounded-full object-cover border border-border bg-white" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                      {(e.from_name ?? "?")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm">{e.from_name}</span>
                    {e.years_known && (
                      <span className="text-xs text-muted-foreground">· Known {e.years_known}+ yr{e.years_known > 1 ? "s" : ""}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed mb-3">{e.message}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEndorseAction(e.id, "accept")}
                      disabled={endorseActionId === e.id}
                      className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {endorseActionId === e.id ? "…" : "✓ Accept"}
                    </button>
                    <button
                      onClick={() => handleEndorseAction(e.id, "reject")}
                      disabled={endorseActionId === e.id}
                      className="px-4 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-secondary disabled:opacity-50 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile card */}
      <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <LogoAvatar
              name={profile.name}
              logoUrl={editing ? form.logo_url : (profile.logo_url ?? "")}
              editing={editing}
              onLogoUrl={(url) => setForm((f) => ({ ...f, logo_url: url }))}
            />
            <div>
              <div className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                {profile.name}
                {profile.is_founding_seller && (
                  <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-medium">
                    🏅 Founding Member
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{profile.company_name ?? "No company"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{profile.user_type_label}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${badge.color}`}>
              {badge.icon && <span className="mr-1">{badge.icon}</span>}{badge.label}
            </span>
            {profile.verification_badge !== "legacy_verified" && (
              <button
                onClick={() => navigate("/verification-upgrade")}
                className="text-xs px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full font-semibold hover:bg-sky-100 transition-colors"
              >
                {profile.verification_badge === "none" ? "Get Verified →" : "Upgrade Verification →"}
              </button>
            )}
            <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-secondary text-secondary-foreground">
              {PLAN_LABELS[profile.subscription_plan] ?? profile.subscription_plan}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-lg font-bold text-emerald-600">💎 {creditBalance?.balance ?? profile.credits ?? 0}</div>
            <div className="text-xs text-muted-foreground">Credits</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-lg font-bold text-amber-600">{profile.deals_completed}</div>
            <div className="text-xs text-muted-foreground">Deals Done</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className={`text-lg font-bold ${profile.email_verified ? "text-green-600" : "text-slate-400"}`}>
              {profile.email_verified ? "✓" : "✗"}
            </div>
            <div className="text-xs text-muted-foreground">Email verified</div>
          </div>
        </div>

        {/* ── WhatsApp readiness notice ── */}
        {(!profile.contact_number || profile.whatsapp_opt_in === false) && (
          <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <span className="text-xl">📱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                {!profile.contact_number
                  ? "Traders can't reach you on WhatsApp — your phone number is missing"
                  : "WhatsApp contact is turned off on your profile"}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {!profile.contact_number
                  ? "Add your international number (e.g. +92 300 1234567) so other traders can contact you directly."
                  : "Go to Edit Profile and enable WhatsApp contact so traders can reach you instantly."}
              </p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
              >
                Fix now →
              </button>
            )}
          </div>
        )}


        {!editing ? (
          <>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <ReadOnlyField label="Company Name" value={profile.company_name} />
              <ReadOnlyField label="Owner / Rep" value={profile.owner_name} />
              <ReadOnlyField label="Specialization" value={profile.specialization ?? null} />
              <ReadOnlyField label="Years in Business" value={profile.years_in_business != null ? `${profile.years_in_business} years` : null} />
              <ReadOnlyField label="Website" value={profile.website} />
              {(profile.city || profile.country) && (
                <ReadOnlyField
                  label="Location"
                  value={[profile.city, profile.country].filter(Boolean).join(", ")}
                />
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <ReadOnlyField label="Mobile Number" value={profile.contact_number ?? null} />
              <ReadOnlyField label="Government ID" value="Stored privately" note="Private" />
            </div>
            {/* Store URL display */}
            {profile.store_slug ? (
              <div className="mb-4 flex flex-wrap items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary mb-0.5">🏪 Your Store Link</p>
                  <p className="text-sm font-mono text-foreground truncate">luckybirthstone.com/store/<strong>{profile.store_slug}</strong></p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/store/${profile.store_slug}`).catch(() => {}); }}
                    className="px-3 py-1.5 text-xs font-semibold border border-primary/30 text-primary rounded-xl hover:bg-primary/10 transition-colors"
                  >
                    Copy Link
                  </button>
                  <a
                    href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/store/${profile.store_slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
                  >
                    View Store →
                  </a>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-4 bg-slate-50 border border-border rounded-2xl text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">🏪 Set up your Store URL</p>
                <p className="text-xs">Edit your profile to create a unique shareable link like <span className="font-mono">luckybirthstone.com/store/your-name</span></p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={startEdit}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
                Edit Profile
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input value={form.name} onChange={set("name")} className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              </Field>
              <Field label="Company Name">
                <input value={form.company_name} onChange={set("company_name")} placeholder="Your company" className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              </Field>
              <Field label="Owner / Rep Name">
                <input value={form.owner_name} onChange={set("owner_name")} placeholder="Owner name" className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              </Field>
              <Field label="Address">
                <input value={form.address} onChange={set("address")} placeholder="Street / building" className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input value={form.city} onChange={set("city")} placeholder="Bangkok" className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
                </Field>
                <Field label="State / Province">
                  <input value={form.state} onChange={set("state")} placeholder="Optional" className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
                </Field>
              </div>
              <Field label="Country">
                <input value={form.country} onChange={set("country")} placeholder="Thailand" className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              </Field>
              <p className="text-xs text-muted-foreground -mt-1">📍 City and country are shown on the marketplace to help buyers find nearby sellers.</p>
              <Field label="Trade License Number">
                <input value={form.trade_license_number} onChange={set("trade_license_number")} placeholder="License number" className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              </Field>
              <Field label="Store URL">
                <div className="flex items-center rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring/30 transition">
                  <span className="px-3 py-2.5 bg-slate-50 text-xs text-muted-foreground border-r border-input whitespace-nowrap select-none">luckybirthstone.com/store/</span>
                  <input
                    value={form.store_slug}
                    onChange={(e) => setForm((f) => ({ ...f, store_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+/, "").substring(0, 40) }))}
                    placeholder="your-store-name"
                    className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Only lowercase letters, numbers, and hyphens. This is your unique shareable store link.</p>
              </Field>
              <Field label="Social Links">
                <SocialLinkFields
                  instagram={form.instagram_url}
                  facebook={form.facebook_page_url}
                  website={form.website}
                  onInstagram={(v) => setForm((f) => ({ ...f, instagram_url: v }))}
                  onFacebook={(v) => setForm((f) => ({ ...f, facebook_page_url: v }))}
                  onWebsite={(v) => setForm((f) => ({ ...f, website: v }))}
                />
              </Field>
            </div>
            <div>
              <Field label="Company Description">
                <textarea
                  value={form.company_description}
                  onChange={(e) => setForm((f) => ({ ...f, company_description: e.target.value }))}
                  placeholder="Tell buyers about your company, specialties, and expertise…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition resize-none"
                />
              </Field>
              <p className="text-xs text-muted-foreground mt-1">Shown on your public company profile page.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Specialization">
                <input value={form.specialization} onChange={set("specialization")} placeholder="e.g. Ruby, Sapphire, Diamonds"
                  className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              </Field>
              <Field label="Years in Business">
                <input type="number" min="0" max="100" value={form.years_in_business} onChange={set("years_in_business")} placeholder="e.g. 15"
                  className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              </Field>
              <Field label="Default Trading Currency">
                <select value={form.default_currency} onChange={(e) => setForm((f) => ({ ...f, default_currency: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition bg-white">
                  <option value="">— Not set —</option>
                  <option value="USD">🇺🇸 USD — US Dollar</option>
                  <option value="INR">🇮🇳 INR — Indian Rupee</option>
                  <option value="AED">🇦🇪 AED — UAE Dirham</option>
                  <option value="THB">🇹🇭 THB — Thai Baht</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">Pre-fills currency when you add a new listing.</p>
              </Field>
            </div>
            <div>
              <Field label="Contact Number">
                <input value={form.contact_number} onChange={set("contact_number")} placeholder="+1 234 567 8900"
                  className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 transition" />
              </Field>
              <p className="text-xs text-muted-foreground mt-1">
                Enter with country code (e.g. <span className="font-mono">+92 300 1234567</span>) — required for your WhatsApp button to work.
              </p>
            </div>
            {/* Company Gallery */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Company Gallery</label>
              <GalleryUploader
                urls={form.gallery_urls}
                onChange={(urls) => setForm((f) => ({ ...f, gallery_urls: urls }))}
              />
            </div>

            {saveError && (
              <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
                {saveError}
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={updateMutation.isPending}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center gap-2 transition-opacity">
                {updateMutation.isPending && <span className="spinner !w-4 !h-4" />}
                Save Changes
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:bg-secondary transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Verification section */}
      <VerificationSection
        profile={profile}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["profile", userId] })}
      />

      {/* Notification Settings */}
      <div className="bg-white border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
          <span>🔔</span> Notification Settings
        </h3>
        <div className="py-3 border-b border-border last:border-0 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">WhatsApp Alerts</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receive instant WhatsApp messages when new gemstone listings and auctions go live.
              </p>
            </div>
            <button
              type="button"
              disabled={whatsAppMutation.isPending}
              onClick={() => whatsAppMutation.mutate(profile?.whatsapp_opt_in === false ? true : false)}
              className={`relative shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                profile?.whatsapp_opt_in === false ? "bg-muted-foreground/30" : "bg-primary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  profile?.whatsapp_opt_in === false ? "translate-x-0" : "translate-x-5"
                }`}
              />
            </button>
          </div>

          {/* WhatsApp opt-in CTA */}
          {profile?.whatsapp_opt_in !== false ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <span className="text-green-600 text-lg">✅</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-green-700">Opted in — alerts are active</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Make sure you've sent <strong>"join luckybirthstone"</strong> to{" "}
                  <a
                    href="https://wa.me/15559387034?text=join+luckybirthstone"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-semibold"
                  >
                    +1 (555) 938-7034
                  </a>{" "}
                  on WhatsApp to activate delivery.
                </p>
              </div>
            </div>
          ) : (
            <a
              href="https://wa.me/15559387034?text=join+luckybirthstone"
              target="_blank"
              rel="noreferrer"
              onClick={() => { if (profile?.whatsapp_opt_in === false) whatsAppMutation.mutate(true); }}
              className="flex items-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] transition-colors rounded-xl px-4 py-3 text-white no-underline"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div>
                <p className="text-sm font-bold leading-tight">Tap to activate WhatsApp alerts</p>
                <p className="text-xs opacity-90 mt-0.5">Opens WhatsApp · sends "join luckybirthstone" to +1 (555) 938-7034</p>
              </div>
              <svg className="w-4 h-4 opacity-80 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </a>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Email notifications are always active for account-critical updates (verification status, messages, auction results).
        </p>
      </div>

      {/* ── Trade Hub: Deals / Connections / Credits / Activity ── */}
      <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {(["deals", "connections", "credits", "activity"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTradeTab(tab)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                tradeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "deals" && `Deals${myDeals.length > 0 ? ` (${myDeals.length})` : ""}`}
              {tab === "connections" && `Network${myConnections.length > 0 ? ` (${myConnections.length})` : ""}${pendingIncoming.length > 0 ? ` ·${pendingIncoming.length}` : ""}`}
              {tab === "credits" && `Credits`}
              {tab === "activity" && "Activity"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Deals tab ── */}
          {tradeTab === "deals" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">My Deals</h3>
                <button
                  onClick={() => setShowDealModal(true)}
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
                >
                  + Propose Deal
                </button>
              </div>
              {myDeals.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="text-3xl mb-2">🤝</div>
                  <p className="text-sm">No deals yet. Propose your first B2B deal!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myDeals.map((deal) => {
                    const isBuyer = deal.buyer_id === userId;
                    const counterparty = isBuyer ? deal.seller_name : deal.buyer_name;
                    const statusColors: Record<string, string> = {
                      proposed: "bg-blue-100 text-blue-700",
                      confirmed: "bg-amber-100 text-amber-700",
                      completed: "bg-green-100 text-green-700",
                      cancelled: "bg-slate-100 text-slate-500",
                      disputed: "bg-red-100 text-red-700",
                    };
                    return (
                      <div key={deal.id} className="border border-border rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="font-medium text-sm">{deal.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isBuyer ? "Buying from" : "Selling to"}: <strong>{counterparty}</strong>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-primary">${deal.amount_usd.toLocaleString()}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[deal.status] ?? "bg-slate-100"}`}>
                              {deal.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {deal.status === "proposed" && !isBuyer && (
                            <button onClick={() => handleDealAction(deal.id, "confirm", userId!)}
                              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                              ✓ Confirm Deal
                            </button>
                          )}
                          {deal.status === "confirmed" && isBuyer && (
                            <button onClick={() => handleDealAction(deal.id, "complete", userId!)}
                              className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                              ✓ Mark Complete
                            </button>
                          )}
                          {["proposed", "confirmed"].includes(deal.status) && (
                            <button onClick={() => handleDealAction(deal.id, "cancel", userId!)}
                              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Connections tab ── */}
          {tradeTab === "connections" && (
            <div className="space-y-4">
              {pendingIncoming.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-amber-700 mb-3 flex items-center gap-2">
                    <span>📬</span> Incoming Connection Requests
                    <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{pendingIncoming.length}</span>
                  </h3>
                  <div className="space-y-2">
                    {pendingIncoming.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                          {c.other_name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{c.other_name}</p>
                          <p className="text-xs text-muted-foreground">{c.other_user_type}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleConnectionAction(c.id, "accept")}
                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                            ✓ Accept
                          </button>
                          <button onClick={() => handleConnectionAction(c.id, "reject")}
                            className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-base mb-3">My Network ({myConnections.length})</h3>
                {myConnections.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <div className="text-3xl mb-2">🌐</div>
                    <p className="text-sm">No connections yet. Visit a trader's profile and send a request!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {myConnections.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-3 border border-border rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                          {c.other_logo ? (
                            <img src={c.other_logo} alt={c.other_name} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            c.other_name[0]?.toUpperCase() ?? "?"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{c.other_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{c.other_user_type?.replace("_", " ")}</p>
                        </div>
                        {c.other_verification_badge && c.other_verification_badge !== "none" && (
                          <span className="text-xs text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Credits tab ── */}
          {tradeTab === "credits" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="text-3xl">💎</div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{creditBalance?.balance ?? 0}</p>
                  <p className="text-sm text-emerald-600">LuckyBirthstone Credits</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">Credits are earned by completing deals, endorsing traders, and building your profile.</p>
                </div>
              </div>
              <h3 className="font-semibold text-base">Transaction History</h3>
              {creditHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No credit transactions yet.</p>
              ) : (
                <div className="space-y-2">
                  {creditHistory.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{tx.reason}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`font-bold text-sm ${tx.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount} credits
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Activity tab ── */}
          {tradeTab === "activity" && (
            <div className="space-y-3">
              <h3 className="font-semibold text-base">Recent Activity</h3>
              {myActivities.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="text-sm">No activity recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myActivities.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-border/60 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm shrink-0">
                        {{
                          joined: "👋", listed_gem: "💎", got_endorsement: "⭐", gave_endorsement: "⭐",
                          connected: "🤝", deal_completed: "✅", got_verified: "✓", auction_created: "🔔",
                          auction_won: "🏆", deal_proposed: "📝",
                        }[a.type] ?? "📋"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{a.label}</p>
                        <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Deal Proposal Modal */}
      {showDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Propose a Deal</h3>
              <button onClick={() => setShowDealModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {dealError && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{dealError}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Seller's User ID</label>
                <input
                  value={dealForm.seller_id}
                  onChange={(e) => setDealForm((f) => ({ ...f, seller_id: e.target.value }))}
                  placeholder="Paste the seller's user ID"
                  className="form-input w-full text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">Find the seller's ID on their profile page.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Deal Amount (USD)</label>
                <input
                  type="number"
                  value={dealForm.amount_usd}
                  onChange={(e) => setDealForm((f) => ({ ...f, amount_usd: e.target.value }))}
                  placeholder="e.g. 5000"
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <input
                  value={dealForm.description}
                  onChange={(e) => setDealForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the trade"
                  className="form-input w-full"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => void submitDeal()}
                disabled={dealSubmitting}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
              >
                {dealSubmitting && <span className="spinner !w-4 !h-4" />}
                Propose Deal
              </button>
              <button onClick={() => setShowDealModal(false)} className="px-4 py-2.5 text-sm border border-border rounded-xl hover:bg-secondary transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy notice */}
      <div className="bg-slate-50 border border-border rounded-2xl p-5 text-sm text-muted-foreground">
        <div className="font-semibold text-foreground mb-2 flex items-center gap-2">🔒 Privacy Rules</div>
        <ul className="space-y-1.5">
          <li>· Your <strong>email</strong>, <strong>contact number</strong>, and <strong>government ID</strong> are never shown publicly.</li>
          <li>· Public profiles only show company name, user type, verification badge, rating, and website.</li>
          <li>· Other traders can only contact you through LuckyBirthstone's secure messaging system.</li>
          <li>· Verification documents are stored securely and only accessible by the LuckyBirthstone compliance team.</li>
        </ul>
      </div>
    </main>
  );
}
