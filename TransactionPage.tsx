import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, fmtCurrency, convertPrice, type Currency } from "@/lib/api";

const CURRENCIES: Currency[] = ["USD", "INR", "AED"];

export default function TransactionPage() {
  const { gemId } = useParams<{ gemId: string }>();
  const [, navigate] = useLocation();

  const userId = localStorage.getItem("gw_user_id");
  if (!userId) { navigate("/"); return null; }

  const { data: gems = [] } = useQuery({ queryKey: ["inventory"], queryFn: api.getInventory });
  const gem = gems.find((g) => g.id === gemId);

  const [form, setForm] = useState({
    total_amount: "",
    advance_paid: "",
    credit_amount: "",
    currency: "USD" as Currency,
    due_date: "",
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      if (!gem) throw new Error("Gem not found");
      return api.createTransaction({
        buyer_id: userId,
        seller_id: gem.seller_id,
        inventory_id: gem.id,
        total_amount: parseFloat(form.total_amount),
        currency: form.currency,
        advance_paid: parseFloat(form.advance_paid),
        credit_amount: parseFloat(form.credit_amount),
        due_date: form.due_date,
      });
    },
    onSuccess: (tx) => {
      setSuccess(tx.id);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate();
  }

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  // Auto-fill credit from total - advance
  function handleAdvanceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const adv = parseFloat(e.target.value) || 0;
    const total = parseFloat(form.total_amount) || 0;
    const credit = Math.max(0, total - adv);
    setForm((f) => ({ ...f, advance_paid: e.target.value, credit_amount: credit > 0 ? String(credit) : "" }));
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Transaction Request Sent</h2>
        <p className="text-muted-foreground text-sm mb-1">Transaction ID:</p>
        <code className="text-xs bg-secondary px-3 py-1.5 rounded-lg font-mono block mb-6">{success}</code>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate("/marketplace")}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  if (!gem && gems.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <div className="text-4xl">🔍</div>
        <p>Listing not found.</p>
        <button onClick={() => navigate("/marketplace")} className="text-primary text-sm underline">
          Back to Marketplace
        </button>
      </div>
    );
  }

  const displayPrice = gem ? convertPrice(gem.base_price_usd, "USD", form.currency) : 0;
  const estMin = gem ? convertPrice(gem.estimated_price_min, "USD", form.currency) : 0;
  const estMax = gem ? convertPrice(gem.estimated_price_max, "USD", form.currency) : 0;
  const isDiamond = gem?.stone_type.toLowerCase() === "diamond";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => navigate("/marketplace")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        ← Back to Marketplace
      </button>

      <h1 className="text-xl font-bold mb-6">Request a Deal</h1>

      <div className="grid gap-6">
        {/* Gem summary */}
        {gem && (
          <div className="bg-white border border-border rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Selected Listing
            </h2>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-base">
                  {gem.stone_type}
                  {isDiamond && gem.color && (
                    <span className="text-muted-foreground font-normal text-sm ml-1.5">{gem.color}/{gem.clarity}</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {gem.carat} ct · {gem.origin} · {gem.treatment}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Cert: {gem.certificate_number}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-lg">{fmtCurrency(gem.price, gem.currency)}</div>
                <div className="text-xs text-muted-foreground">Listed price</div>
              </div>
            </div>

            {/* Market value summary */}
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Displayed in {form.currency}</div>
                <div className="font-bold">{fmtCurrency(displayPrice, form.currency)}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Est. Trade Range ({form.currency})</div>
                <div className="font-semibold text-sm">
                  {fmtCurrency(estMin, form.currency)} – {fmtCurrency(estMax, form.currency)}
                </div>
              </div>
              {isDiamond && gem.rap_price_per_carat && (
                <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">Rapaport Benchmark (total)</span>
                  <span className="font-semibold">{fmtCurrency(convertPrice(gem.total_rap_value!, "USD", form.currency), form.currency)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transaction form */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold mb-5">Deal Terms</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Currency */}
            <div>
              <label className="block text-sm font-medium mb-2">Deal Currency</label>
              <div className="flex rounded-lg overflow-hidden border border-border text-sm">
                {CURRENCIES.map((c) => (
                  <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, currency: c }))}
                    className={`flex-1 py-2.5 font-medium transition-colors ${form.currency === c ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium mb-1.5">Total Deal Amount ({form.currency})</label>
                <input required type="number" min="0" step="any" value={form.total_amount}
                  onChange={(e) => {
                    const total = parseFloat(e.target.value) || 0;
                    const adv = parseFloat(form.advance_paid) || 0;
                    const credit = Math.max(0, total - adv);
                    setForm((f) => ({ ...f, total_amount: e.target.value, credit_amount: credit > 0 ? String(credit) : "" }));
                  }}
                  placeholder="Enter total amount"
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Advance Paid</label>
                <input required type="number" min="0" step="any" value={form.advance_paid}
                  onChange={handleAdvanceChange}
                  placeholder="0"
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Credit Amount</label>
                <input required type="number" min="0" step="any" value={form.credit_amount}
                  onChange={set("credit_amount")}
                  placeholder="Auto-calculated"
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Due Date</label>
                <input required type="date" value={form.due_date} onChange={set("due_date")}
                  min={new Date().toISOString().split("T")[0]}
                  className="form-input w-full"
                />
              </div>
            </div>

            {/* Summary */}
            {form.total_amount && form.advance_paid && form.credit_amount && (
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-sm space-y-2">
                <div className="font-semibold text-primary text-xs uppercase tracking-wide mb-2">Deal Summary</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{fmtCurrency(parseFloat(form.total_amount), form.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance</span>
                  <span className="font-semibold text-green-700">- {fmtCurrency(parseFloat(form.advance_paid), form.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-primary/10 pt-2 mt-1">
                  <span className="font-medium">Credit Outstanding</span>
                  <span className="font-bold text-amber-700">{fmtCurrency(parseFloat(form.credit_amount), form.currency)}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <button type="submit" disabled={mutation.isPending || !gem}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity">
              {mutation.isPending && <span className="spinner !w-4 !h-4" />}
              Submit Transaction Request
            </button>

            <p className="text-center text-xs text-muted-foreground">
              This is a record of the deal terms. No payment is processed on LuckyBirthstone.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
