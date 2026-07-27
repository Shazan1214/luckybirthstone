import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";

const COOLDOWN_SECS = 60;

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const email = localStorage.getItem("gw_verify_email") ?? "";
  const simulatedCode = localStorage.getItem("gw_verify_code");
  const userId = localStorage.getItem("gw_user_id");

  if (!userId) {
    navigate("/");
    return null;
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.verifyEmail({ email, code });
      localStorage.setItem("gw_email_verified", "true");
      localStorage.removeItem("gw_verify_code");
      localStorage.removeItem("gw_verify_email");
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResendMsg("");
    setError("");
    setResendLoading(true);
    try {
      const res = await api.resendVerification(email);
      setResendMsg(res.message);
      setCooldown(COOLDOWN_SECS);
      localStorage.removeItem("gw_verify_code");
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : "Failed to resend. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold">Verify Your Email</h1>
          <p className="text-muted-foreground text-sm mt-2">
            A verification code was sent to <strong>{email || "your email"}</strong>
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            Check your spam/junk folder if you don't see it in your inbox.
          </p>
        </div>

        {simulatedCode && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
              📬 Simulated Email Preview
            </div>
            <div className="bg-white rounded-xl border border-amber-100 px-4 py-3 text-sm">
              <div className="text-muted-foreground text-xs mb-1">From: LuckyBirthstone &lt;noreply@luckybirthstone.com&gt;</div>
              <div className="text-muted-foreground text-xs mb-3">Subject: Verify your LuckyBirthstone account</div>
              <p className="text-sm text-foreground">Your verification code is:</p>
              <div className="text-3xl font-bold tracking-[0.3em] text-primary my-2">{simulatedCode}</div>
              <p className="text-xs text-muted-foreground">This code expires in 30 minutes.</p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Verification Code</label>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="w-full px-3 py-2.5 rounded-lg border border-input text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition text-center text-lg tracking-[0.3em] font-mono"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          {resendMsg && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
              {resendMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
          >
            {loading && <span className="spinner !w-4 !h-4" />}
            Verify Email
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">Didn't receive the code?</p>
          <button
            onClick={resend}
            disabled={resendLoading || cooldown > 0}
            className="text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5 mx-auto transition-opacity"
          >
            {resendLoading && <span className="spinner !w-3.5 !h-3.5" />}
            {cooldown > 0
              ? `Resend available in ${cooldown}s`
              : resendLoading
              ? "Sending…"
              : "Resend verification email"}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Once verified, you can browse the marketplace and contact sellers.
        </p>
      </div>
    </main>
  );
}
