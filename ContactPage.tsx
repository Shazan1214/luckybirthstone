import { useState } from "react";
import { Link } from "wouter";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed to send message");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="mb-10">
          <Link href="/">
            <span className="flex items-center gap-2 font-bold text-lg text-primary cursor-pointer mb-8 w-fit">
              <span className="text-2xl">💎</span> LuckyBirthstone
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Contact Us</h1>
          <p className="text-muted-foreground">
            Have a question or need help? Fill out the form below and our team will get back to you within 1–2 business days.
          </p>
        </div>

        {success ? (
          <div className="bg-white border border-border rounded-2xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-foreground mb-2">Message received!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for reaching out. We'll respond to <strong>{form.email}</strong> within 1–2 business days.
            </p>
            <Link href="/">
              <span className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 cursor-pointer transition-opacity">
                Back to home
              </span>
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-2xl p-8 shadow-sm">
            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@company.com"
                    className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Subject</label>
                <input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="What is your inquiry about?"
                  className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={5}
                  placeholder="Describe your question or issue in detail..."
                  className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
              >
                {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {loading ? "Sending…" : "Send Message"}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-4">Other ways to reach us</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1.5">⏱️</div>
                  <p className="text-xs font-semibold text-foreground">Response time</p>
                  <p className="text-xs text-muted-foreground mt-0.5">1–2 business days</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1.5">🌍</div>
                  <p className="text-xs font-semibold text-foreground">Coverage</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Global support</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Already have an account?{" "}
              <Link href="/">
                <span className="text-primary hover:underline cursor-pointer font-medium">Sign in</span>
              </Link>{" "}
              to submit a support ticket from your dashboard for faster response times.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
