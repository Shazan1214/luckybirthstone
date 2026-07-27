import { Router } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";
import {
  loadPayablesLedger, savePayablesLedger,
  loadLedgerPayments, saveLedgerPayments,
} from "../lib/persist.js";
import { users } from "./users.js";
import { sendEmail } from "../lib/email.js";
import { ledgerPayments } from "./sales-ledger.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PayableRecord {
  id: string;
  buyer_id: string;
  supplier_contact_id: string;
  supplier_name: string;
  supplier_company: string;
  supplier_phone?: string | null;
  supplier_email?: string | null;
  listing_id?: string | null;
  gemstone_name: string;
  quantity: number;
  total_cost: number;
  amount_paid: number;
  currency: string;
  purchase_type: "direct" | "approval";
  related_sale_id?: string | null;
  due_date?: string | null;
  status: "pending" | "partial" | "paid" | "overdue";
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── In-memory store ─────────────────────────────────────────────────────────

export let payablesLedger: PayableRecord[] = [];

export async function loadPayablesLedgerData(): Promise<void> {
  const records = await loadPayablesLedger();
  payablesLedger.length = 0;
  for (const r of records) {
    const p = r as PayableRecord;
    if (p.id && p.buyer_id && p.supplier_name) {
      p.amount_paid = p.amount_paid ?? 0;
      payablesLedger.push(p);
    }
  }
  logger.info({ payables: payablesLedger.length }, "payables-ledger: loaded");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_ALLOWED = ["pro", "premium"];

function requirePlanUser(req: any, res: any): { userId: string } | null {
  const userId = (req.query.user_id || req.body?.user_id) as string | undefined;
  if (!userId) { res.status(401).json({ error: "user_id required" }); return null; }
  const user = users.find((u: any) => u.id === userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return null; }
  if (!PLAN_ALLOWED.includes((user as any).subscription_plan)) {
    res.status(403).json({ error: "Requires Pro or Premium plan" }); return null;
  }
  return { userId };
}

function computeStatus(record: PayableRecord): PayableRecord["status"] {
  if (record.amount_paid >= record.total_cost) return "paid";
  if (record.amount_paid > 0) return "partial";
  if (record.due_date && new Date(record.due_date) < new Date()) return "overdue";
  return "pending";
}

function daysOverdue(dueDate?: string | null): number {
  if (!dueDate) return 0;
  const diff = Date.now() - new Date(dueDate).getTime();
  return diff > 0 ? Math.floor(diff / 86400000) : 0;
}

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

// ════════════════════════════════════════════════════════════════════════════
// PAYABLE RECORDS
// ════════════════════════════════════════════════════════════════════════════

// GET /payables-ledger?user_id=&filter=
router.get("/payables-ledger", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const filter = (req.query.filter as string) || "all";
  let records = payablesLedger
    .filter((r) => r.buyer_id === userId)
    .map((r) => ({ ...r, outstanding_amount: r.total_cost - r.amount_paid, status: computeStatus(r), days_overdue: daysOverdue(r.due_date) }));
  if (filter !== "all") records = records.filter((r) => r.status === filter);
  res.json(records);
});

// POST /payables-ledger
router.post("/payables-ledger", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const {
    supplier_contact_id, supplier_name, supplier_company, supplier_phone, supplier_email,
    listing_id, gemstone_name, quantity, total_cost, currency,
    purchase_type, related_sale_id, due_date, notes,
  } = req.body as Partial<PayableRecord>;
  if (!supplier_name?.trim()) { res.status(400).json({ error: "supplier_name required" }); return; }
  if (!gemstone_name?.trim()) { res.status(400).json({ error: "gemstone_name required" }); return; }
  if (!total_cost || total_cost <= 0) { res.status(400).json({ error: "total_cost required" }); return; }

  const now = new Date().toISOString();
  const record: PayableRecord = {
    id: randomUUID(),
    buyer_id: userId,
    supplier_contact_id: supplier_contact_id ?? "",
    supplier_name: supplier_name.trim(),
    supplier_company: supplier_company?.trim() ?? "",
    supplier_phone: supplier_phone ?? null,
    supplier_email: supplier_email ?? null,
    listing_id: listing_id ?? null,
    gemstone_name: gemstone_name.trim(),
    quantity: Number(quantity) || 1,
    total_cost: Number(total_cost),
    amount_paid: 0,
    currency: currency ?? "USD",
    purchase_type: purchase_type ?? "direct",
    related_sale_id: related_sale_id ?? null,
    due_date: due_date ?? null,
    status: "pending",
    notes: notes ?? null,
    created_at: now,
    updated_at: now,
  };
  payablesLedger.push(record);
  savePayablesLedger(payablesLedger);
  res.status(201).json({ ...record, outstanding_amount: record.total_cost, days_overdue: 0 });
});

// PATCH /payables-ledger/:id
router.patch("/payables-ledger/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = payablesLedger.findIndex((r) => r.id === req.params.id && r.buyer_id === userId);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  const allowed = ["supplier_name","supplier_company","supplier_phone","supplier_email","gemstone_name","quantity","total_cost","currency","purchase_type","due_date","notes"];
  const update: Partial<PayableRecord> = {};
  for (const k of allowed) { if (req.body[k] !== undefined) (update as any)[k] = req.body[k]; }
  Object.assign(payablesLedger[idx], update, { updated_at: new Date().toISOString() });
  savePayablesLedger(payablesLedger);
  const r = payablesLedger[idx];
  res.json({ ...r, outstanding_amount: r.total_cost - r.amount_paid, status: computeStatus(r), days_overdue: daysOverdue(r.due_date) });
});

// DELETE /payables-ledger/:id
router.delete("/payables-ledger/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = payablesLedger.findIndex((r) => r.id === req.params.id && r.buyer_id === userId);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  payablesLedger.splice(idx, 1);
  const toRemove = ledgerPayments.filter((p) => p.record_id === req.params.id && p.record_type === "payable");
  for (const p of toRemove) {
    const i = ledgerPayments.indexOf(p); if (i > -1) ledgerPayments.splice(i, 1);
  }
  savePayablesLedger(payablesLedger);
  saveLedgerPayments(ledgerPayments);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════
// PAYMENTS FOR PAYABLES
// ════════════════════════════════════════════════════════════════════════════

// GET /payables-ledger/:id/payments?user_id=
router.get("/payables-ledger/:id/payments", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const payable = payablesLedger.find((r) => r.id === req.params.id && r.buyer_id === userId);
  if (!payable) { res.status(404).json({ error: "Payable not found" }); return; }
  const payments = ledgerPayments.filter((p) => p.record_id === req.params.id && p.record_type === "payable");
  res.json(payments);
});

// POST /payables-ledger/:id/payments
router.post("/payables-ledger/:id/payments", async (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = payablesLedger.findIndex((r) => r.id === req.params.id && r.buyer_id === userId);
  if (idx === -1) { res.status(404).json({ error: "Payable not found" }); return; }
  const { amount_paid, currency, payment_date, payment_mode, notes } = req.body as any;
  if (!amount_paid || amount_paid <= 0) { res.status(400).json({ error: "amount_paid required" }); return; }

  const now = new Date().toISOString();
  const payment = {
    id: randomUUID(),
    record_id: req.params.id,
    record_type: "payable" as const,
    owner_id: userId,
    amount_paid: Number(amount_paid),
    currency: currency ?? payablesLedger[idx].currency,
    payment_date: payment_date ?? now,
    payment_mode: payment_mode ?? "cash",
    notes: notes ?? null,
    created_at: now,
  };
  ledgerPayments.push(payment);

  const totalPaid = ledgerPayments
    .filter((p) => p.record_id === req.params.id && p.record_type === "payable")
    .reduce((sum, p) => sum + p.amount_paid, 0);
  payablesLedger[idx].amount_paid = totalPaid;
  payablesLedger[idx].updated_at = now;

  saveLedgerPayments(ledgerPayments);
  savePayablesLedger(payablesLedger);

  // Optional: send confirmation to supplier
  const payable = payablesLedger[idx];
  if (payable.supplier_email) {
    try {
      await sendEmail({
        to: payable.supplier_email,
        subject: `Payment Confirmation – ${payable.currency} ${amount_paid} for ${payable.gemstone_name}`,
        html: `<p>Dear ${payable.supplier_name},</p><p>A payment of <strong>${payable.currency} ${Number(amount_paid).toLocaleString()}</strong> has been made for <strong>${payable.gemstone_name}</strong>.</p><p>Thank you for your business. – LuckyBirthstone</p>`,
      });
    } catch (e) { logger.error({ err: e }, "payable payment confirmation email failed"); }
  }

  res.status(201).json(payment);
});

// DELETE /payables-ledger/payments/:paymentId
router.delete("/payables-ledger/payments/:paymentId", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = ledgerPayments.findIndex((p) => p.id === req.params.paymentId && p.owner_id === userId && p.record_type === "payable");
  if (idx === -1) { res.status(404).json({ error: "Payment not found" }); return; }
  const recordId = ledgerPayments[idx].record_id;
  ledgerPayments.splice(idx, 1);

  const pIdx = payablesLedger.findIndex((r) => r.id === recordId);
  if (pIdx > -1) {
    payablesLedger[pIdx].amount_paid = ledgerPayments
      .filter((p) => p.record_id === recordId && p.record_type === "payable")
      .reduce((sum, p) => sum + p.amount_paid, 0);
    payablesLedger[pIdx].updated_at = new Date().toISOString();
  }

  saveLedgerPayments(ledgerPayments);
  savePayablesLedger(payablesLedger);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════
// REMINDER
// ════════════════════════════════════════════════════════════════════════════

// POST /payables-ledger/:id/remind — send payment confirmation to supplier
router.post("/payables-ledger/:id/remind", async (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const payable = payablesLedger.find((r) => r.id === req.params.id && r.buyer_id === userId);
  if (!payable) { res.status(404).json({ error: "Not found" }); return; }

  const outstanding = payable.total_cost - payable.amount_paid;
  const msg = `Hello ${payable.supplier_name}, payment of ${payable.currency} ${outstanding.toLocaleString()} is pending for ${payable.gemstone_name}. We will settle this shortly. Thank you. – LuckyBirthstone`;
  const waLink = payable.supplier_phone ? `https://wa.me/${payable.supplier_phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : null;

  let emailSent = false;
  if (payable.supplier_email) {
    try {
      await sendEmail({
        to: payable.supplier_email,
        subject: `Payment Confirmation – ${payable.gemstone_name}`,
        html: `<p>Dear ${payable.supplier_name},</p><p>This is to confirm that your payment of <strong>${payable.currency} ${outstanding.toLocaleString()}</strong> for <strong>${payable.gemstone_name}</strong> is being processed.</p><p>Thank you. – LuckyBirthstone</p>`,
      });
      emailSent = true;
    } catch (e) { logger.error({ err: e }, "payable remind email failed"); }
  }

  res.json({ success: true, whatsapp_link: waLink, email_sent: emailSent, message: msg });
});

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY (Net Position)
// ════════════════════════════════════════════════════════════════════════════

// GET /payables-ledger/summary?user_id=
router.get("/payables-ledger/summary", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const records = payablesLedger.filter((r) => r.buyer_id === userId);
  const totalPayable = records.reduce((s, r) => s + (r.total_cost - r.amount_paid), 0);
  const overdueAmount = records
    .filter((r) => r.due_date && new Date(r.due_date) < new Date() && r.amount_paid < r.total_cost)
    .reduce((s, r) => s + (r.total_cost - r.amount_paid), 0);

  const byCurrency: Record<string, number> = {};
  const overduesByCurrency: Record<string, number> = {};
  for (const r of records) {
    const outstanding = r.total_cost - r.amount_paid;
    if (outstanding > 0) {
      byCurrency[r.currency] = (byCurrency[r.currency] ?? 0) + outstanding;
    }
    if (r.due_date && new Date(r.due_date) < new Date() && r.amount_paid < r.total_cost) {
      overduesByCurrency[r.currency] = (overduesByCurrency[r.currency] ?? 0) + outstanding;
    }
  }

  const topSuppliers = Object.values(
    records.reduce((acc: Record<string, { name: string; company: string; total: number; outstanding: number }>, r) => {
      const key = r.supplier_contact_id || r.supplier_name;
      if (!acc[key]) acc[key] = { name: r.supplier_name, company: r.supplier_company, total: 0, outstanding: 0 };
      acc[key].total += r.total_cost;
      acc[key].outstanding += r.total_cost - r.amount_paid;
      return acc;
    }, {})
  ).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);

  res.json({
    totalPayable,
    overdueAmount,
    byCurrency,
    overduesByCurrency,
    recordCount: records.length,
    paidCount: records.filter((r) => computeStatus(r) === "paid").length,
    pendingCount: records.filter((r) => computeStatus(r) === "pending").length,
    overdueCount: records.filter((r) => computeStatus(r) === "overdue").length,
    topSuppliers,
    currency: records[0]?.currency ?? "USD",
  });
});

export default router;
