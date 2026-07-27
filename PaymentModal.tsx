import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { PaymentType } from "@/lib/api";

interface PaymentModalProps {
  userId: string;
  paymentType: PaymentType;
  meta: Record<string, unknown>;
  amount: number;
  description: string;
  onSuccess: (effect: Record<string, unknown>) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
}

type Step = "ready" | "processing" | "success" | "failed";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PaymentModal({ userId, paymentType, meta, amount, description, onSuccess, onClose }: PaymentModalProps) {
  const [step, setStep] = useState<Step>("ready");
  const [error, setError] = useState("");
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    loadRazorpayScript().then(setScriptReady);
  }, []);

  async function handlePay() {
    setError("");
    setStep("processing");

    try {
      const initiated = await api.initiatePlatformPayment({ user_id: userId, type: paymentType, meta });
      if (!initiated.payment_id) throw new Error("Failed to initiate payment");

      if (amount === 0) {
        const result = await api.verifyPlatformPayment(initiated.payment_id, {});
        if (result.status === "success") {
          setStep("success");
          setTimeout(() => onSuccess(result.effect), 1200);
        } else {
          throw new Error("Verification failed");
        }
        return;
      }

      if (!initiated.razorpay_order_id || !initiated.razorpay_key_id) {
        throw new Error("Payment gateway configuration error");
      }

      if (!scriptReady || !window.Razorpay) {
        throw new Error("Payment gateway not loaded. Please refresh and try again.");
      }

      await new Promise<void>((resolve, reject) => {
        const options: RazorpayOptions = {
          key: initiated.razorpay_key_id!,
          order_id: initiated.razorpay_order_id!,
          amount: initiated.amount_usd_cents ?? Math.round(amount * 100),
          currency: "USD",
          name: "LuckyBirthstone",
          description,
          image: "/favicon.ico",
          theme: { color: "#1d4ed8" },
          handler: async (response) => {
            try {
              const result = await api.verifyPlatformPayment(initiated.payment_id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (result.status === "success") {
                setStep("success");
                setTimeout(() => onSuccess(result.effect), 1200);
                resolve();
              } else {
                reject(new Error("Payment verification failed"));
              }
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              reject(new Error("Payment was cancelled"));
            },
          },
        };

        const rzp = new window.Razorpay(options);
        setStep("ready");
        rzp.open();
      });

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed. Please try again.";
      if (msg === "Payment was cancelled") {
        setStep("ready");
      } else {
        setStep("failed");
        setError(msg);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => e.target === e.currentTarget && step !== "processing" && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-base">Secure Payment</div>
            <div className="text-slate-300 text-sm mt-0.5">{description}</div>
          </div>
          {step !== "processing" && (
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl leading-none">✕</button>
          )}
        </div>

        <div className="p-6">
          {(step === "ready" || step === "processing") && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-blue-700 font-medium">Amount due</span>
                <div className="text-right">
                  <div className="font-bold text-blue-900 text-lg">${amount.toFixed(2)} USD</div>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <span className="text-2xl mt-0.5">🔒</span>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Secured by Razorpay</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Pay with PayPal, cards, UPI, net banking, or wallets. Your payment is encrypted and secure.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-center">
                {["PayPal", "Visa", "Mastercard", "UPI", "Net Banking"].map((m) => (
                  <span key={m} className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{m}</span>
                ))}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <button
                onClick={handlePay}
                disabled={step === "processing" || !scriptReady}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
              >
                {step === "processing" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Opening payment…
                  </>
                ) : !scriptReady ? (
                  "Loading gateway…"
                ) : (
                  <>Pay ${amount.toFixed(2)} via Razorpay →</>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                By paying, you agree to our <a href="/terms" className="underline">Terms & Conditions</a>. No refunds on digital products.
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
              <div className="font-bold text-lg text-emerald-700 mb-1">Payment Successful!</div>
              <div className="text-sm text-muted-foreground mb-1">{description} activated.</div>
              <div className="text-xs text-muted-foreground">A confirmation email has been sent to your inbox.</div>
            </div>
          )}

          {step === "failed" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">✕</div>
                <div className="font-bold text-base text-red-700 mb-1">Payment Failed</div>
                {error && <div className="text-sm text-muted-foreground">{error}</div>}
              </div>
              <button
                onClick={() => { setStep("ready"); setError(""); }}
                className="w-full py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
