import { Router } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";
import {
  loadTradeContacts, saveTradeContacts,
  loadTradeDeals, saveTradeDeals,
  loadTradeInvoices, saveTradeInvoices,
  loadTradePayments, saveTradePayments,
} from "../lib/persist.js";
import { users } from "./users.js";
import { sendEmail } from "../lib/email.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TradeContact {
  id: string;
  owner_id: string;
  name: string;
  company_name: string;
  type: "buyer" | "supplier" | "partner";
  source: "platform" | "external";
  is_platform_user: boolean;
  platform_user_id: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type DealStage = "stone_picked_up" | "negotiating" | "close" | "stone_returned" | "deal_lost";

export interface DealPaymentTerms {
  upfront_amount?: number | null;
  payment_due_date?: string | null;
  payment_method?: "cash" | "bank" | "cheque" | null;
  reminder_days_before?: number | null;
  reminder_sent?: boolean;
}

export interface TradeDeal {
  id: string;
  owner_id: string;
  contact_id?: string | null;
  listing_id?: string | null;
  title: string;
  deal_value: number;
  currency: string;
  stage: DealStage;
  notes?: string | null;
  payment_terms?: DealPaymentTerms | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface TradeInvoice {
  id: string;
  invoice_number: string;
  owner_id: string;
  buyer_id?: string | null;
  contact_id?: string | null;
  buyer_name: string;
  buyer_company: string;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  buyer_address?: string | null;
  items: InvoiceItem[];
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  status: "pending" | "paid" | "overdue" | "partial" | "cancelled";
  due_date: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradePayment {
  id: string;
  invoice_id: string;
  owner_id: string;
  amount_paid: number;
  currency: string;
  payment_date: string;
  method?: string | null;
  notes?: string | null;
  created_at: string;
}

// ─── In-memory stores ────────────────────────────────────────────────────────

export let tradeContacts: TradeContact[] = [];
export let tradeDeals: TradeDeal[] = [];
export let tradeInvoices: TradeInvoice[] = [];
export let tradePayments: TradePayment[] = [];

export async function loadTraderCRM(): Promise<void> {
  const contacts = await loadTradeContacts();
  tradeContacts.length = 0;
  for (const c of contacts) {
    const contact = c as TradeContact;
    if (contact.id && contact.owner_id && contact.name) {
      if (!Array.isArray(contact.tags)) contact.tags = [];
      tradeContacts.push(contact);
    }
  }

  const deals = await loadTradeDeals();
  tradeDeals.length = 0;
  for (const d of deals) {
    const deal = d as TradeDeal;
    if (deal.id && deal.owner_id && deal.title) tradeDeals.push(deal);
  }

  const invoices = await loadTradeInvoices();
  tradeInvoices.length = 0;
  for (const inv of invoices) {
    const invoice = inv as TradeInvoice;
    if (invoice.id && invoice.owner_id && invoice.invoice_number) {
      if (!Array.isArray(invoice.items)) invoice.items = [];
      tradeInvoices.push(invoice);
    }
  }

  const payments = await loadTradePayments();
  tradePayments.length = 0;
  for (const p of payments) {
    const payment = p as TradePayment;
    if (payment.id && payment.invoice_id && payment.owner_id) tradePayments.push(payment);
  }

  logger.info({
    contacts: tradeContacts.length,
    deals: tradeDeals.length,
    invoices: tradeInvoices.length,
    payments: tradePayments.length,
  }, "trader-crm: loaded");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_ALLOWED = ["pro", "premium"];

function requirePlanUser(req: any, res: any): { userId: string } | null {
  const userId = (req.query.user_id || req.body?.user_id) as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "user_id required" });
    return null;
  }
  const user = users.find((u: any) => u.id === userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return null;
  }
  if (!PLAN_ALLOWED.includes((user as any).subscription_plan)) {
    res.status(403).json({ error: "Trade Manager requires Pro or Premium plan" });
    return null;
  }
  return { userId };
}

let invoiceCounter = 1000;
function nextInvoiceNumber(): string {
  invoiceCounter += 1;
  return `INV-${invoiceCounter}`;
}

function computeInvoiceStatus(invoice: TradeInvoice): TradeInvoice["status"] {
  if (invoice.status === "cancelled") return "cancelled";
  if (invoice.amount_paid >= invoice.total_amount) return "paid";
  if (invoice.amount_paid > 0) return "partial";
  if (new Date(invoice.due_date) < new Date()) return "overdue";
  return "pending";
}

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

// ════════════════════════════════════════════════════════════════════════════
// CONTACTS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/trade-crm/contacts?user_id=
router.get("/trade-crm/contacts", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const contacts = tradeContacts.filter((c) => c.owner_id === userId);
  res.json(contacts);
});

// POST /api/trade-crm/contacts
router.post("/trade-crm/contacts", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const { name, company_name, type, phone, email, notes, tags } = req.body as Partial<TradeContact>;
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const { source, is_platform_user, platform_user_id } = req.body as Partial<TradeContact>;
  const contact: TradeContact = {
    id: randomUUID(),
    owner_id: userId,
    name: name.trim(),
    company_name: (company_name ?? "").trim(),
    type: (["buyer", "supplier", "partner"].includes(type as string) ? type : "buyer") as TradeContact["type"],
    source: source === "platform" ? "platform" : "external",
    is_platform_user: is_platform_user === true,
    platform_user_id: platform_user_id ?? null,
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    notes: notes?.trim() || null,
    tags: Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  tradeContacts.push(contact);
  saveTradeContacts(tradeContacts);
  res.status(201).json(contact);
});

// PATCH /api/trade-crm/contacts/:id
router.patch("/trade-crm/contacts/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const contact = tradeContacts.find((c) => c.id === req.params.id && c.owner_id === userId);
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const { name, company_name, type, phone, email, notes, tags, source, is_platform_user, platform_user_id } = req.body as Partial<TradeContact>;
  if (name?.trim()) contact.name = name.trim();
  if (company_name !== undefined) contact.company_name = company_name.trim();
  if (type && ["buyer", "supplier", "partner"].includes(type)) contact.type = type;
  if (source && ["platform", "external"].includes(source)) contact.source = source;
  if (is_platform_user !== undefined) contact.is_platform_user = is_platform_user === true;
  if (platform_user_id !== undefined) contact.platform_user_id = platform_user_id ?? null;
  if (phone !== undefined) contact.phone = phone?.trim() || null;
  if (email !== undefined) contact.email = email?.trim() || null;
  if (notes !== undefined) contact.notes = notes?.trim() || null;
  if (Array.isArray(tags)) contact.tags = tags.filter((t) => typeof t === "string");
  contact.updated_at = new Date().toISOString();
  saveTradeContacts(tradeContacts);
  res.json(contact);
});

// DELETE /api/trade-crm/contacts/:id
router.delete("/trade-crm/contacts/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = tradeContacts.findIndex((c) => c.id === req.params.id && c.owner_id === userId);
  if (idx === -1) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  tradeContacts.splice(idx, 1);
  saveTradeContacts(tradeContacts);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════
// DEALS (PIPELINE)
// ════════════════════════════════════════════════════════════════════════════

const VALID_STAGES: DealStage[] = ["stone_picked_up", "negotiating", "close", "stone_returned", "deal_lost"];

// GET /api/trade-crm/deals?user_id=
router.get("/trade-crm/deals", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const deals = tradeDeals.filter((d) => d.owner_id === userId);
  res.json(deals);
});

// POST /api/trade-crm/deals
router.post("/trade-crm/deals", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const { title, contact_id, listing_id, deal_value, currency, stage, notes } = req.body as Partial<TradeDeal>;
  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const deal: TradeDeal = {
    id: randomUUID(),
    owner_id: userId,
    title: title.trim(),
    contact_id: contact_id || null,
    listing_id: listing_id || null,
    deal_value: Number(deal_value) || 0,
    currency: (currency as string) || "USD",
    stage: (VALID_STAGES.includes(stage as DealStage) ? stage : "stone_picked_up") as DealStage,
    notes: notes?.trim() || null,
    payment_terms: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  tradeDeals.push(deal);
  saveTradeDeals(tradeDeals);
  res.status(201).json(deal);
});

// PATCH /api/trade-crm/deals/:id
router.patch("/trade-crm/deals/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const deal = tradeDeals.find((d) => d.id === req.params.id && d.owner_id === userId);
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }
  const { title, contact_id, listing_id, deal_value, currency, stage, notes, payment_terms } = req.body as Partial<TradeDeal>;
  if (title?.trim()) deal.title = title.trim();
  if (contact_id !== undefined) deal.contact_id = contact_id || null;
  if (listing_id !== undefined) deal.listing_id = listing_id || null;
  if (deal_value !== undefined) deal.deal_value = Number(deal_value) || 0;
  if (currency) deal.currency = currency;
  if (stage && VALID_STAGES.includes(stage)) deal.stage = stage;
  if (notes !== undefined) deal.notes = notes?.trim() || null;
  if (payment_terms !== undefined) {
    if (!payment_terms) {
      deal.payment_terms = null;
    } else {
      deal.payment_terms = {
        upfront_amount: payment_terms.upfront_amount != null ? Number(payment_terms.upfront_amount) : null,
        payment_due_date: payment_terms.payment_due_date || null,
        payment_method: payment_terms.payment_method || null,
        reminder_days_before: payment_terms.reminder_days_before != null ? Number(payment_terms.reminder_days_before) : null,
        reminder_sent: payment_terms.reminder_sent ?? deal.payment_terms?.reminder_sent ?? false,
      };
    }
  }
  deal.updated_at = new Date().toISOString();
  saveTradeDeals(tradeDeals);
  res.json(deal);
});

// DELETE /api/trade-crm/deals/:id
router.delete("/trade-crm/deals/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = tradeDeals.findIndex((d) => d.id === req.params.id && d.owner_id === userId);
  if (idx === -1) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }
  tradeDeals.splice(idx, 1);
  saveTradeDeals(tradeDeals);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════
// INVOICES
// ════════════════════════════════════════════════════════════════════════════

// GET /api/trade-crm/invoices?user_id=
router.get("/trade-crm/invoices", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const invoices = tradeInvoices
    .filter((inv) => inv.owner_id === userId)
    .map((inv) => ({ ...inv, status: computeInvoiceStatus(inv) }));
  res.json(invoices);
});

// GET /api/trade-crm/invoices/:id?user_id=
router.get("/trade-crm/invoices/:id", (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) {
    res.status(401).json({ error: "user_id required" });
    return;
  }
  const invoice = tradeInvoices.find((inv) => inv.id === req.params.id && inv.owner_id === userId);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json({ ...invoice, status: computeInvoiceStatus(invoice) });
});

// POST /api/trade-crm/invoices
router.post("/trade-crm/invoices", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const body = req.body as Partial<TradeInvoice>;
  if (!body.buyer_name?.trim()) {
    res.status(400).json({ error: "buyer_name is required" });
    return;
  }

  const items: InvoiceItem[] = (body.items ?? []).map((item: any) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unit_price) || 0;
    return {
      id: randomUUID(),
      description: String(item.description || ""),
      quantity: qty,
      unit_price: price,
      total: qty * price,
    };
  });
  const subtotal = items.reduce((sum, it) => sum + it.total, 0);
  const taxRate = Number(body.tax_rate) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const invoice: TradeInvoice = {
    id: randomUUID(),
    invoice_number: nextInvoiceNumber(),
    owner_id: userId,
    buyer_id: body.buyer_id || null,
    contact_id: body.contact_id || null,
    buyer_name: body.buyer_name.trim(),
    buyer_company: (body.buyer_company ?? "").trim(),
    buyer_email: body.buyer_email?.trim() || null,
    buyer_phone: body.buyer_phone?.trim() || null,
    buyer_address: body.buyer_address?.trim() || null,
    items,
    currency: body.currency || "USD",
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    amount_paid: 0,
    status: "pending",
    due_date: body.due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    notes: body.notes?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  tradeInvoices.push(invoice);
  saveTradeInvoices(tradeInvoices);
  logger.info({ id: invoice.id, invoice_number: invoice.invoice_number }, "trader-crm: invoice created");
  res.status(201).json({ ...invoice, status: computeInvoiceStatus(invoice) });
});

// PATCH /api/trade-crm/invoices/:id — update fields or mark paid
router.patch("/trade-crm/invoices/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const invoice = tradeInvoices.find((inv) => inv.id === req.params.id && inv.owner_id === userId);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const body = req.body as Partial<TradeInvoice>;
  const isPaid = invoice.status === "paid";
  // Allow cancellation at any time; all other edits blocked once paid
  if (body.status === "cancelled") {
    invoice.status = "cancelled";
    invoice.updated_at = new Date().toISOString();
    saveTradeInvoices(tradeInvoices);
    res.json(invoice);
    return;
  }
  if (!isPaid) {
    if (body.buyer_name?.trim()) invoice.buyer_name = body.buyer_name.trim();
    if (body.buyer_company !== undefined) invoice.buyer_company = (body.buyer_company ?? "").trim();
    if (body.buyer_email !== undefined) invoice.buyer_email = body.buyer_email?.trim() || null;
    if (body.buyer_phone !== undefined) invoice.buyer_phone = body.buyer_phone?.trim() || null;
    if (body.buyer_address !== undefined) invoice.buyer_address = body.buyer_address?.trim() || null;
    if (body.due_date) invoice.due_date = body.due_date;
    if (body.notes !== undefined) invoice.notes = body.notes?.trim() || null;
    if (body.currency) invoice.currency = body.currency;
    if (body.contact_id !== undefined) invoice.contact_id = body.contact_id || null;
    if (body.tax_rate !== undefined) invoice.tax_rate = Number(body.tax_rate) || 0;
    if (Array.isArray(body.items)) {
      invoice.items = body.items.map((item: any) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unit_price) || 0;
        return { id: item.id || randomUUID(), description: String(item.description || ""), quantity: qty, unit_price: price, total: qty * price };
      });
      invoice.subtotal = invoice.items.reduce((s, it) => s + it.total, 0);
      invoice.tax_amount = invoice.subtotal * (invoice.tax_rate / 100);
      invoice.total_amount = invoice.subtotal + invoice.tax_amount;
    }
  }
  if (body.amount_paid !== undefined) {
    invoice.amount_paid = Math.min(Number(body.amount_paid) || 0, invoice.total_amount);
  }
  invoice.status = computeInvoiceStatus(invoice);
  invoice.updated_at = new Date().toISOString();
  saveTradeInvoices(tradeInvoices);
  res.json(invoice);
});

// DELETE /api/trade-crm/invoices/:id
router.delete("/trade-crm/invoices/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = tradeInvoices.findIndex((inv) => inv.id === req.params.id && inv.owner_id === userId);
  if (idx === -1) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  tradeInvoices.splice(idx, 1);
  saveTradeInvoices(tradeInvoices);
  res.json({ success: true });
});

// POST /api/trade-crm/invoices/:id/send-email
router.post("/trade-crm/invoices/:id/send-email", async (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const invoice = tradeInvoices.find((inv) => inv.id === req.params.id && inv.owner_id === userId);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const toEmail = (req.body.email as string) || invoice.buyer_email;
  if (!toEmail) {
    res.status(400).json({ error: "No email address available" });
    return;
  }

  const owner = users.find((u: any) => u.id === userId) as any;
  const ownerName = owner?.company_name || owner?.full_name || "Your Supplier";

  const itemRows = invoice.items.map((it) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${it.description}</td><td align="right" style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${it.quantity}</td><td align="right" style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${it.unit_price.toFixed(2)}</td><td align="right" style="padding:6px 8px;border-bottom:1px solid #f0f0f0"><strong>${it.total.toFixed(2)}</strong></td></tr>`
  ).join("");

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1a3a5c;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">Invoice ${invoice.invoice_number}</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">from ${ownerName}</p>
  </div>
  <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
    <p>Dear <strong>${invoice.buyer_name}</strong>,</p>
    <p>Please find attached invoice <strong>${invoice.invoice_number}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:13px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:6px 8px;text-align:left">Item</th>
        <th style="padding:6px 8px;text-align:right">Qty</th>
        <th style="padding:6px 8px;text-align:right">Unit Price</th>
        <th style="padding:6px 8px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="text-align:right;margin-top:12px">
      <p style="margin:4px 0;font-size:13px">Subtotal: <strong>${invoice.currency} ${invoice.subtotal.toFixed(2)}</strong></p>
      ${invoice.tax_rate > 0 ? `<p style="margin:4px 0;font-size:13px">Tax (${invoice.tax_rate}%): <strong>${invoice.currency} ${invoice.tax_amount.toFixed(2)}</strong></p>` : ""}
      <p style="margin:8px 0 0;font-size:16px;font-weight:bold">Total: ${invoice.currency} ${invoice.total_amount.toFixed(2)}</p>
    </div>
    <p style="margin-top:16px;font-size:13px;color:#666">Due date: <strong>${invoice.due_date}</strong></p>
    ${invoice.notes ? `<p style="font-size:13px;color:#666">${invoice.notes}</p>` : ""}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:12px;color:#999">Sent via LuckyBirthstone Trade Manager</p>
  </div>
</div>`;

  try {
    await sendEmail({
      to: toEmail,
      subject: `Invoice ${invoice.invoice_number} from ${ownerName}`,
      html,
    });
    res.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "trader-crm: send-email failed");
    res.status(500).json({ error: "Failed to send email" });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/trade-crm/payments?user_id=
router.get("/trade-crm/payments", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const payments = tradePayments.filter((p) => p.owner_id === userId);
  res.json(payments);
});

// POST /api/trade-crm/payments — record a payment against an invoice
router.post("/trade-crm/payments", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const { invoice_id, amount_paid, currency, payment_date, method, notes } = req.body as Partial<TradePayment>;
  if (!invoice_id || !amount_paid) {
    res.status(400).json({ error: "invoice_id and amount_paid are required" });
    return;
  }
  const invoice = tradeInvoices.find((inv) => inv.id === invoice_id && inv.owner_id === userId);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const payment: TradePayment = {
    id: randomUUID(),
    invoice_id,
    owner_id: userId,
    amount_paid: Number(amount_paid),
    currency: currency || invoice.currency,
    payment_date: payment_date || new Date().toISOString().slice(0, 10),
    method: method?.trim() || null,
    notes: notes?.trim() || null,
    created_at: new Date().toISOString(),
  };
  tradePayments.push(payment);
  saveTradePayments(tradePayments);

  // Update invoice's amount_paid
  const totalPaidForInvoice = tradePayments
    .filter((p) => p.invoice_id === invoice_id)
    .reduce((sum, p) => sum + p.amount_paid, 0);
  invoice.amount_paid = Math.min(totalPaidForInvoice, invoice.total_amount);
  invoice.status = computeInvoiceStatus(invoice);
  invoice.updated_at = new Date().toISOString();
  saveTradeInvoices(tradeInvoices);

  res.status(201).json(payment);
});

// DELETE /api/trade-crm/payments/:id
router.delete("/trade-crm/payments/:id", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;
  const idx = tradePayments.findIndex((p) => p.id === req.params.id && p.owner_id === userId);
  if (idx === -1) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  const [removed] = tradePayments.splice(idx, 1);
  saveTradePayments(tradePayments);

  // Recalculate invoice amount_paid
  const invoice = tradeInvoices.find((inv) => inv.id === removed.invoice_id);
  if (invoice) {
    invoice.amount_paid = tradePayments
      .filter((p) => p.invoice_id === removed.invoice_id)
      .reduce((sum, p) => sum + p.amount_paid, 0);
    invoice.status = computeInvoiceStatus(invoice);
    invoice.updated_at = new Date().toISOString();
    saveTradeInvoices(tradeInvoices);
  }
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/trade-crm/analytics?user_id=
router.get("/trade-crm/analytics", (req, res) => {
  const ctx = requirePlanUser(req, res);
  if (!ctx) return;
  const { userId } = ctx;

  const myInvoices = tradeInvoices.filter((inv) => inv.owner_id === userId)
    .map((inv) => ({ ...inv, status: computeInvoiceStatus(inv) }));

  const totalRevenue = myInvoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const pendingPayments = myInvoices
    .filter((inv) => inv.status === "pending" || inv.status === "partial")
    .reduce((sum, inv) => sum + (inv.total_amount - inv.amount_paid), 0);
  const overduePayments = myInvoices
    .filter((inv) => inv.status === "overdue")
    .reduce((sum, inv) => sum + inv.total_amount, 0);

  const revenueByCurrency: Record<string, number> = {};
  const pendingByCurrency: Record<string, number> = {};
  const overdueByCurrency: Record<string, number> = {};
  for (const inv of myInvoices) {
    const cur = inv.currency || "USD";
    revenueByCurrency[cur] = (revenueByCurrency[cur] ?? 0) + inv.amount_paid;
    if (inv.status === "pending" || inv.status === "partial") {
      pendingByCurrency[cur] = (pendingByCurrency[cur] ?? 0) + (inv.total_amount - inv.amount_paid);
    }
    if (inv.status === "overdue") {
      overdueByCurrency[cur] = (overdueByCurrency[cur] ?? 0) + inv.total_amount;
    }
  }

  // Top buyers by revenue
  const buyerMap: Record<string, { name: string; company: string; total: number }> = {};
  for (const inv of myInvoices) {
    if (!buyerMap[inv.buyer_name]) {
      buyerMap[inv.buyer_name] = { name: inv.buyer_name, company: inv.buyer_company, total: 0 };
    }
    buyerMap[inv.buyer_name].total += inv.amount_paid;
  }
  const topBuyers = Object.values(buyerMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Top items (gemstones) across all invoices
  const gemMap: Record<string, { description: string; count: number; revenue: number }> = {};
  for (const inv of myInvoices) {
    for (const item of inv.items) {
      if (!gemMap[item.description]) {
        gemMap[item.description] = { description: item.description, count: 0, revenue: 0 };
      }
      gemMap[item.description].count += item.quantity;
      gemMap[item.description].revenue += item.total;
    }
  }
  const topGems = Object.values(gemMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  res.json({
    totalRevenue,
    pendingPayments,
    overduePayments,
    revenueByCurrency,
    pendingByCurrency,
    overdueByCurrency,
    invoiceCount: myInvoices.length,
    paidCount: myInvoices.filter((inv) => inv.status === "paid").length,
    overdueCount: myInvoices.filter((inv) => inv.status === "overdue").length,
    topBuyers,
    topGems,
    contactCount: tradeContacts.filter((c) => c.owner_id === userId).length,
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PAYMENT REMINDER JOB
// ════════════════════════════════════════════════════════════════════════════

export async function checkPaymentReminders(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const deal of tradeDeals) {
    if (deal.stage !== "close") continue;
    const pt = deal.payment_terms;
    if (!pt?.payment_due_date || !pt.reminder_days_before || pt.reminder_sent) continue;

    const dueDate = new Date(pt.payment_due_date);
    dueDate.setHours(0, 0, 0, 0);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - pt.reminder_days_before);

    if (today < reminderDate) continue;

    // Find the deal owner to send reminder
    const owner = (users as any[]).find((u: any) => u.id === deal.owner_id);
    if (!owner?.email) continue;

    const contact = tradeContacts.find((c) => c.id === deal.contact_id);
    const balanceDue = deal.deal_value - (pt.upfront_amount ?? 0);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);

    const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#1e40af;color:white;padding:24px 32px;border-radius:10px 10px 0 0">
    <h2 style="margin:0;font-size:20px">Payment Reminder</h2>
    <p style="margin:6px 0 0;opacity:.8;font-size:14px">Deal: ${deal.title}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 32px;border-radius:0 0 10px 10px">
    <p style="margin:0 0 16px;font-size:15px">Hi ${owner.full_name ?? owner.company_name ?? "Trader"},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151">This is a reminder that payment is due in <strong>${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}</strong> for the following deal:</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:16px">
      <p style="margin:0 0 8px;font-size:14px"><strong>Deal:</strong> ${deal.title}</p>
      ${contact ? `<p style="margin:0 0 8px;font-size:14px"><strong>Contact:</strong> ${contact.name}${contact.company_name ? ` · ${contact.company_name}` : ""}</p>` : ""}
      <p style="margin:0 0 8px;font-size:14px"><strong>Deal Value:</strong> ${deal.currency} ${deal.deal_value.toLocaleString()}</p>
      ${pt.upfront_amount ? `<p style="margin:0 0 8px;font-size:14px"><strong>Upfront Paid:</strong> ${deal.currency} ${pt.upfront_amount.toLocaleString()}</p>` : ""}
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#b45309"><strong>Balance Due:</strong> ${deal.currency} ${balanceDue.toLocaleString()}</p>
      <p style="margin:0 0 8px;font-size:14px"><strong>Due Date:</strong> ${pt.payment_due_date}</p>
      ${pt.payment_method ? `<p style="margin:0;font-size:14px"><strong>Payment Method:</strong> ${pt.payment_method.charAt(0).toUpperCase() + pt.payment_method.slice(1)}</p>` : ""}
    </div>
    <p style="font-size:12px;color:#9ca3af">Sent via LuckyBirthstone Trade Manager</p>
  </div>
</div>`;

    try {
      await sendEmail({
        to: owner.email,
        subject: `Payment reminder: ${deal.title} — Due ${pt.payment_due_date}`,
        html,
      });
      pt.reminder_sent = true;
      logger.info({ dealId: deal.id, title: deal.title }, "trader-crm: payment reminder sent");
    } catch (e) {
      logger.error({ err: e, dealId: deal.id }, "trader-crm: failed to send payment reminder");
    }
  }
  saveTradeDeals(tradeDeals);
}

export default router;
