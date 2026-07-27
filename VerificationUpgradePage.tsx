import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { api } from "@/lib/api";
import PaymentModal from "@/components/PaymentModal";

const TIERS = [
  {
    key: "basic_verified" as const,
    label: "Basic Verified",
    icon: "✓",
    iconBg: "bg-blue-100 text-blue-700",
    price: 0,
    approval: "Instant approval",
    color: "border-blue-300",
    highlight: false,
    features: [
      "Verified badge on all listings",
      "Higher search ranking",
      "Identity confirmed",
      "Instant — no admin wait",
    ],
    docsRequired: false,
  },
  {
    key: "verified" as const,
    label: "Verified",
    icon: "✓",
    iconBg: "bg-sky-100 text-sky-700",
    price: 99,
    approval: "Admin review 1–2 business days",
    color: "border-sky-400",
    highlight: true,
    features: [
      "Everything in Basic Verified",
      "Sky-blue Verified badge",
      "Document review by compliance team",
      "Higher trust score with buyers",
    ],
    docsRequired: true,
  },
  {
    key: "legacy_verified" as const,
    label: "Legacy Verified",
    icon: "★",
    iconBg: "bg-amber-100 text-amber-700",
    price: 499,
    approval: "Admin review 1–2 business days",
    color: "border-amber-400",
    highlight: false,
    features: [
      "Everything in Verified",
      "Gold Legacy badge",
      "Top placement in all results",
      "Enhanced business profile",
      "Dedicated support",
    ],
    docsRequired: true,
  },
] as const;

type TierKey = typeof TIERS[number]["key"];

export default function VerificationUpgradePage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const userId = localStorage.getItem("gw_user_id") ?? "";

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile(userId),
    enabled: !!userId,
  });

  const [selectedTier, setSelectedTier] = useState<TierKey | null>(null);
  const [step, setStep] = useState<"select" | "docs" | "confirm">("select");
  const [tradeLicenseUrl, setTradeLicenseUrl] = useState("");
  const [govIdUrl, setGovIdUrl] = useState("");
  const [uploading, setUploading] = useState<"trade" | "govid" | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [successTier, setSuccessTier] = useState<string | null>(null);
  const [freeSubmitting, setFreeSubmitting] = useState(false);
  const [freeError, setFreeError] = useState("");

  const { uploadFile } = useUpload();

  const currentBadge = profile?.verification_badge ?? "none";
  const selectedTierData = TIERS.find((t) => t.key === selectedTier);

  const tierOrder: Record<string, number> = { none: 0, basic_verified: 1, verified: 2, legacy_verified: 3 };
  const currentLevel = tierOrder[currentBadge] ?? 0;

  async function handleFileUpload(file: File, type: "trade" | "govid") {
    setUploading(type);
    try {
      const result = await uploadFile(file);
      if (result) {
        const url = `/api/storage${result.objectPath}`;
        if (type === "trade") setTradeLicenseUrl(url);
        else setGovIdUrl(url);
      }
    } catch {
    } finally {
      setUploading(null);
    }
  }

  async function handleFreeVerification() {
    if (!selectedTier) return;
    setFreeSubmitting(true);
    setFreeError("");
    try {
      await api.requestVerification(userId, { tier: selectedTier });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      setSuccessTier("basic_verified");
    } catch (e: unknown) {
      setFreeError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setFreeSubmitting(false);
    }
  }

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    setSuccessTier(selectedTier);
    setShowPayment(false);
  }

  if (successTier) {
    const tierLabel = TIERS.find((t) => t.key === successTier)?.label ?? successTier;
    const isFree = successTier === "basic_verified";
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            {isFree ? "✓" : "⏳"}
          </div>
          <h2 className="text-2xl font-extrabold mb-3">
            {isFree ? "Verification Complete!" : "Request Submitted!"}
          </h2>
          <p className="text-muted-foreground mb-2">
            {isFree
              ? `Your account is now Basic Verified. Your badge appears on all listings immediately.`
              : `Your ${tierLabel} verification request is pending admin review. We'll email you within 1–2 business days.`}
          </p>
          {!isFree && (
            <p className="text-sm text-muted-foreground mb-6">A payment confirmation email has been sent to your inbox.</p>
          )}
          <button onClick={() => navigate("/dashboard")} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity">
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          ← Back to Dashboard
        </button>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold mb-3">Get Verified</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            A verified badge builds buyer trust, increases your search ranking, and shows on every listing.
          </p>
          {currentBadge !== "none" && (
            <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-sm text-emerald-700 font-medium">
              Current badge: <strong>{TIERS.find((t) => t.key === currentBadge)?.label ?? currentBadge}</strong>
            </div>
          )}
        </div>

        {step === "select" && (
          <div className="grid sm:grid-cols-3 gap-5">
            {TIERS.map((tier) => {
              const isCurrentOrLower = tierOrder[tier.key] <= currentLevel;
              const isCurrent = tier.key === currentBadge;
              return (
                <div
                  key={tier.key}
                  onClick={() => !isCurrentOrLower && setSelectedTier(tier.key)}
                  className={`relative bg-white border-2 rounded-2xl p-6 flex flex-col transition-all ${
                    selectedTier === tier.key ? "border-primary shadow-lg scale-[1.02]" :
                    isCurrent ? "border-emerald-400 shadow" :
                    isCurrentOrLower ? "border-border opacity-60 cursor-default" :
                    `${tier.color} hover:shadow-md cursor-pointer`
                  }`}
                >
                  {tier.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-sky-600 text-white text-xs font-bold px-3 py-1 rounded-full">Popular</span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">Current</span>
                    </div>
                  )}

                  <div className="mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mb-3 ${tier.iconBg}`}>
                      {tier.icon}
                    </div>
                    <div className="font-bold text-base mb-1">{tier.label}</div>
                    <div className="text-2xl font-extrabold text-primary">
                      {tier.price === 0 ? "FREE" : `$${tier.price}`}
                      {tier.price > 0 && <span className="text-sm font-normal text-muted-foreground"> one-time</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{tier.approval}</div>
                  </div>

                  <ul className="space-y-1.5 flex-1 mb-5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className={`text-center text-xs py-2 rounded-lg font-semibold ${
                    isCurrent ? "bg-emerald-50 text-emerald-700" :
                    isCurrentOrLower ? "bg-secondary text-muted-foreground" :
                    selectedTier === tier.key ? "bg-primary text-primary-foreground" :
                    "bg-secondary text-foreground"
                  }`}>
                    {isCurrent ? "Current tier" : isCurrentOrLower ? "Already achieved" : selectedTier === tier.key ? "Selected ✓" : "Select"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === "select" && selectedTier && (
          <div className="mt-8 text-center">
            {selectedTierData?.docsRequired ? (
              <button
                onClick={() => setStep("docs")}
                className="px-10 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:opacity-90 transition-opacity"
              >
                Continue — Upload Documents →
              </button>
            ) : (
              <div className="space-y-3">
                {freeError && (
                  <div className="text-sm text-red-600">{freeError}</div>
                )}
                <button
                  onClick={handleFreeVerification}
                  disabled={freeSubmitting}
                  className="px-10 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {freeSubmitting ? "Submitting…" : "Get Basic Verified — Free →"}
                </button>
              </div>
            )}
          </div>
        )}

        {step === "docs" && selectedTierData && (
          <div className="max-w-xl mx-auto mt-4">
            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="font-bold text-base mb-1">Upload Documents</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Upload your documents for <strong>{selectedTierData.label}</strong> verification. Accepted formats: PDF, JPG, PNG.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2">Trade License / Business Registration</label>
                  {tradeLicenseUrl ? (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <span className="text-emerald-600 text-lg">✓</span>
                      <span className="text-sm text-emerald-700 font-medium">Document uploaded</span>
                      <button onClick={() => setTradeLicenseUrl("")} className="ml-auto text-xs text-muted-foreground hover:text-red-600">Remove</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-xl p-5 cursor-pointer hover:border-primary/40 transition-colors">
                      <span className="text-2xl">📄</span>
                      <span className="text-sm text-muted-foreground">Click to upload trade license</span>
                      {uploading === "trade" && <span className="text-xs text-primary">Uploading…</span>}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "trade")}
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Government ID <span className="text-muted-foreground font-normal">(optional but recommended)</span></label>
                  {govIdUrl ? (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <span className="text-emerald-600 text-lg">✓</span>
                      <span className="text-sm text-emerald-700 font-medium">Document uploaded</span>
                      <button onClick={() => setGovIdUrl("")} className="ml-auto text-xs text-muted-foreground hover:text-red-600">Remove</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-xl p-5 cursor-pointer hover:border-primary/40 transition-colors">
                      <span className="text-2xl">🪪</span>
                      <span className="text-sm text-muted-foreground">Click to upload government ID</span>
                      {uploading === "govid" && <span className="text-xs text-primary">Uploading…</span>}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "govid")}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep("select")} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors">
                  Back
                </button>
                <button
                  onClick={() => setStep("confirm")}
                  disabled={!tradeLicenseUrl}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "confirm" && selectedTierData && (
          <div className="max-w-xl mx-auto mt-4">
            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="font-bold text-base mb-1">Confirm &amp; Pay</h2>
              <p className="text-sm text-muted-foreground mb-5">Review your request before paying.</p>

              <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tier</span>
                  <span className="font-semibold">{selectedTierData.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trade License</span>
                  <span className="text-emerald-600 font-medium">{tradeLicenseUrl ? "✓ Uploaded" : "Not uploaded"}</span>
                </div>
                {govIdUrl && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gov. ID</span>
                    <span className="text-emerald-600 font-medium">✓ Uploaded</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <span className="text-muted-foreground">One-time fee</span>
                  <span className="font-bold text-primary">${selectedTierData.price} USD</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("docs")} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors">
                  Back
                </button>
                <button
                  onClick={() => setShowPayment(true)}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  Pay ${selectedTierData.price} →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showPayment && selectedTierData && (
        <PaymentModal
          userId={userId}
          paymentType="verification"
          meta={{
            tier: selectedTierData.key,
            trade_license_document_url: tradeLicenseUrl || undefined,
            government_id_document_url: govIdUrl || undefined,
          }}
          amount={selectedTierData.price}
          description={`${selectedTierData.label} Verification — One-time`}
          onSuccess={handleSuccess}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
