import { Router } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";
import {
  loadSalesLedger, saveSalesLedger,
  loadLedgerPayments, saveLedgerPayments,
} from "../lib/persist.js";
import { users } from "./users.js";
import { sendEmail } from "../lib/email.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SalesRecord {
  id: string;
  seller_id: string;
  buyer_contact_id: string;
  buyer_name: string;
  buyer_company: string;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  listing_id?: string | null;
  gemstone_name: string;
  quantity: number;
  total_amount: number;
  amount_received: number;
  currency: string;
  sale_type: "direct" | "approval";
  invoice_id?: string | null;
  due_date?: string | null;
  status: "pending" | "partial" | "paid" | "overdue";
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerPayment {
  id: string;
  record_id: string;
  record_type: "sale" | "payable";
  owner_id: string;
  amount_paid: number;
  currency: string;
  payment_date: string;
  payment_mode: "cash" | "bank" | "online" | "other";
  notes?: string | null;
  created_at: string;
}

// ─── In-memory stores ────────────────────────────────────────────────────────

export let salesLedger: SalesRecord[] = [];
export let ledgerPayments: LedgerPayment[] = [];

export async function loadSalesLedgerData(): Promise<void> {
  const records = await loadSalesLedger();
  salesLedger.length = 0;
  for (const r of records) {
    const s = r as SalesRecord;
    if (s.id && s.seller_id && s.buyer_name) {
      s.amount_received = s.amount_received ?? 0;
      salesLedger.push(s);
    }
  }

  const payments = await loadLedgerPayments();
  ledgerPayments.length = 0;
  for (const p of payments) {
    const lp = p as LedgerPayment;
    if (lp.id && lp.record_id && lp.owner_id) ledgerPayments.push(lp);
  }

  logger.info({ sales: salesLedger.length, payments: ledgerPayments.length }, "sales-ledger: loaded");
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

function computeStatus(record: SalesRecord): SalesRecord["status"] {
  if (record.amount_received >= record.total_amount) return "paid";
  if (record.amount_received > 0) return "partial";
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
// SALES RECORDS
// ════════════════════════════════════════════════════════════════════════════

// GET /sales-ledger?user_id=&filter=all|pending|partial|paid|overdue
router.get("/sales-ledger", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const filter = (req.query.filter as string) || "all";
  let records = salesLedger
    .filter((r) => r.seller_id === userId)
    .map((r) => ({ ...r, outstanding_amount: r.total_amount - r.amount_received, status: computeStatus(r), days_overdue: daysOverdue(r.due_date) }));
  if (filter !== "all") records = records.filter((r) => r.status === filter);
  res.json(records);
});

// POST /sales-ledger
router.post("/sales-ledger", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const {
    buyer_contact_id, buyer_name, buyer_company, buyer_phone, buyer_email,
    listing_id, gemstone_name, quantity, total_amount, currency,
    sale_type, invoice_id, due_date, notes,
  } = req.body as Partial<SalesRecord>;
  if (!buyer_name?.trim()) { res.status(400).json({ error: "buyer_name required" }); return; }
  if (!gemstone_name?.trim()) { res.status(400).json({ error: "gemstone_name required" }); return; }
  if (!total_amount || total_amount <= 0) { res.status(400).json({ error: "total_amount required" }); return; }

  const now = new Date().toISOString();
  const record: SalesRecord = {
    id: randomUUID(),
    seller_id: userId,
    buyer_contact_id: buyer_contact_id ?? "",
    buyer_name: buyer_name.trim(),
    buyer_company: buyer_company?.trim() ?? "",
    buyer_phone: buyer_phone ?? null,
    buyer_email: buyer_email ?? null,
    listing_id: listing_id ?? null,
    gemstone_name: gemstone_name.trim(),
    quantity: Number(quantity) || 1,
    total_amount: Number(total_amount),
    amount_received: 0,
    currency: currency ?? "USD",
    sale_type: sale_type ?? "direct",
    invoice_id: invoice_id ?? null,
    due_date: due_date ?? null,
    status: "pending",
    notes: notes ?? null,
    created_at: now,
    updated_at: now,
  };
  salesLedger.push(record);
  saveSalesLedger(salesLedger);
  res.status(201).json({ ...record, outstanding_amount: record.total_amount, days_overdue: 0 });
});

// PATCH /sales-ledger/:id
router.patch("/sales-ledger/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = salesLedger.findIndex((r) => r.id === req.params.id && r.seller_id === userId);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  const allowed = ["buyer_name","buyer_company","buyer_phone","buyer_email","gemstone_name","quantity","total_amount","currency","sale_type","due_date","notes","invoice_id"];
  const update: Partial<SalesRecord> = {};
  for (const k of allowed) { if (req.body[k] !== undefined) (update as any)[k] = req.body[k]; }
  Object.assign(salesLedger[idx], update, { updated_at: new Date().toISOString() });
  saveSalesLedger(salesLedger);
  const r = salesLedger[idx];
  res.json({ ...r, outstanding_amount: r.total_amount - r.amount_received, status: computeStatus(r), days_overdue: daysOverdue(r.due_date) });
});

// DELETE /sales-ledger/:id
router.delete("/sales-ledger/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = salesLedger.findIndex((r) => r.id === req.params.id && r.seller_id === userId);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  salesLedger.splice(idx, 1);
  ledgerPayments.filter((p) => p.record_id === req.params.id).forEach((p) => {
    const i = ledgerPayments.indexOf(p); if (i > -1) ledgerPayments.splice(i, 1);
  });
  saveSalesLedger(salesLedger);
  saveLedgerPayments(ledgerPayments);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════
// PAYMENTS FOR SALES
// ════════════════════════════════════════════════════════════════════════════

// GET /sales-ledger/:id/payments?user_id=
router.get("/sales-ledger/:id/payments", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const sale = salesLedger.find((r) => r.id === req.params.id && r.seller_id === userId);
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }
  const payments = ledgerPayments.filter((p) => p.record_id === req.params.id && p.record_type === "sale");
  res.json(payments);
});

// POST /sales-ledger/:id/payments
router.post("/sales-ledger/:id/payments", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = salesLedger.findIndex((r) => r.id === req.params.id && r.seller_id === userId);
  if (idx === -1) { res.status(404).json({ error: "Sale not found" }); return; }
  const { amount_paid, currency, payment_date, payment_mode, notes } = req.body as Partial<LedgerPayment>;
  if (!amount_paid || amount_paid <= 0) { res.status(400).json({ error: "amount_paid required" }); return; }

  const now = new Date().toISOString();
  const payment: LedgerPayment = {
    id: randomUUID(),
    record_id: req.params.id,
    record_type: "sale",
    owner_id: userId,
    amount_paid: Number(amount_paid),
    currency: currency ?? salesLedger[idx].currency,
    payment_date: payment_date ?? now,
    payment_mode: payment_mode ?? "cash",
    notes: notes ?? null,
    created_at: now,
  };
  ledgerPayments.push(payment);

  // Update sale amount_received
  const totalReceived = ledgerPayments
    .filter((p) => p.record_id === req.params.id && p.record_type === "sale")
    .reduce((sum, p) => sum + p.amount_paid, 0);
  salesLedger[idx].amount_received = totalReceived;
  salesLedger[idx].updated_at = now;

  saveLedgerPayments(ledgerPayments);
  saveSalesLedger(salesLedger);
  res.status(201).json(payment);
});

// DELETE /sales-ledger/payments/:paymentId
router.delete("/sales-ledger/payments/:paymentId", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = ledgerPayments.findIndex((p) => p.id === req.params.paymentId && p.owner_id === userId && p.record_type === "sale");
  if (idx === -1) { res.status(404).json({ error: "Payment not found" }); return; }
  const recordId = ledgerPayments[idx].record_id;
  ledgerPayments.splice(idx, 1);

  // Recompute
  const saleIdx = salesLedger.findIndex((r) => r.id === recordId);
  if (saleIdx > -1) {
    salesLedger[saleIdx].amount_received = ledgerPayments
      .filter((p) => p.record_id === recordId && p.record_type === "sale")
      .reduce((sum, p) => sum + p.amount_paid, 0);
    salesLedger[saleIdx].updated_at = new Date().toISOString();
  }

  saveLedgerPayments(ledgerPayments);
  saveSalesLedger(salesLedger);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════
// REMINDERS & INVITES
// ════════════════════════════════════════════════════════════════════════════

// POST /sales-ledger/:id/remind — send WhatsApp link + email reminder
router.post("/sales-ledger/:id/remind", async (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const sale = salesLedger.find((r) => r.id === req.params.id && r.seller_id === userId);
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }

  const outstanding = sale.total_amount - sale.amount_received;
  const msg = `Hello ${sale.buyer_name}, this is a reminder for pending payment of ${sale.currency} ${outstanding.toLocaleString()} for ${sale.gemstone_name}. Kindly clear dues. – LuckyBirthstone`;
  const waLink = sale.buyer_phone ? `https://wa.me/${sale.buyer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : null;

  let emailSent = false;
  if (sale.buyer_email) {
    try {
      await sendEmail({
        to: sale.buyer_email,
        subject: `Payment Reminder – ${sale.gemstone_name} (${sale.currency} ${outstanding.toLocaleString()})`,
        html: `<p>Dear ${sale.buyer_name},</p><p>This is a reminder for your pending payment of <strong>${sale.currency} ${outstanding.toLocaleString()}</strong> for <strong>${sale.gemstone_name}</strong>.</p>${sale.due_date ? `<p>Due date: ${new Date(sale.due_date).toLocaleDateString()}</p>` : ""}<p>Kindly clear dues at your earliest convenience.</p><p>– LuckyBirthstone Team</p>`,
      });
      emailSent = true;
    } catch (e) { logger.error({ err: e }, "sales reminder email failed"); }
  }

  res.json({ success: true, whatsapp_link: waLink, email_sent: emailSent, message: msg });
});

// POST /sales-ledger/invite — invite external contact to join platform
router.post("/sales-ledger/invite", async (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const user = users.find((u: any) => u.id === userId) as any;
  const { name, phone, email, channel } = req.body as { name: string; phone?: string; email?: string; channel?: "whatsapp" | "email" };

  if (!name) { res.status(400).json({ error: "name required" }); return; }
  if (!phone && !email) { res.status(400).json({ error: "phone or email required" }); return; }

  const inviterName = user?.company_name || user?.full_name || "A LuckyBirthstone Trader";
  const inviteMsg = `Hi ${name}, ${inviterName} has invited you to join LuckyBirthstone – the premier B2B gemstone marketplace. Sign up at https://luckybirthstone.com`;
  const waLink = phone ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(inviteMsg)}` : null;

  let emailSent = false;
  if (email && (!channel || channel === "email")) {
    try {
      await sendEmail({
        to: email,
        subject: `${inviterName} invites you to LuckyBirthstone`,
        html: `<p>Hi ${name},</p><p>${inviterName} has invited you to join <strong>LuckyBirthstone</strong> – the premier B2B gemstone marketplace.</p><p><a href="https://luckybirthstone.com">Click here to sign up</a></p>`,
      });
      emailSent = true;
    } catch (e) { logger.error({ err: e }, "invite email failed"); }
  }

  res.json({ success: true, whatsapp_link: waLink, email_sent: emailSent });
});

// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════════════════════

// GET /sales-ledger/summary?user_id=
router.get("/sales-ledger/summary", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const records = salesLedger.filter((r) => r.seller_id === userId);
  const totalReceivable = records.reduce((s, r) => s + (r.total_amount - r.amount_received), 0);
  const overdueAmount = records
    .filter((r) => r.due_date && new Date(r.due_date) < new Date() && r.amount_received < r.total_amount)
    .reduce((s, r) => s + (r.total_amount - r.amount_received), 0);

  const byCurrency: Record<string, number> = {};
  const overduesByCurrency: Record<string, number> = {};
  for (const r of records) {
    const outstanding = r.total_amount - r.amount_received;
    if (outstanding > 0) {
      byCurrency[r.currency] = (byCurrency[r.currency] ?? 0) + outstanding;
    }
    if (r.due_date && new Date(r.due_date) < new Date() && r.amount_received < r.total_amount) {
      overduesByCurrency[r.currency] = (overduesByCurrency[r.currency] ?? 0) + (r.total_amount - r.amount_received);
    }
  }

  const topBuyers = Object.values(
    records.reduce((acc: Record<string, { name: string; company: string; total: number; outstanding: number }>, r) => {
      const key = r.buyer_contact_id || r.buyer_name;
      if (!acc[key]) acc[key] = { name: r.buyer_name, company: r.buyer_company, total: 0, outstanding: 0 };
      acc[key].total += r.total_amount;
      acc[key].outstanding += r.total_amount - r.amount_received;
      return acc;
    }, {})
  ).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);

  res.json({
    totalReceivable,
    overdueAmount,
    byCurrency,
    overduesByCurrency,
    recordCount: records.length,
    paidCount: records.filter((r) => computeStatus(r) === "paid").length,
    pendingCount: records.filter((r) => computeStatus(r) === "pending").length,
    overdueCount: records.filter((r) => computeStatus(r) === "overdue").length,
    topBuyers,
    currency: records[0]?.currency ?? "USD",
  });
});

export default router;
