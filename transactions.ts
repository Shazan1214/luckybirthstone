import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { saveTransactions } from "../lib/persist.js";

const router: IRouter = Router();

type Currency = "USD" | "INR" | "AED";
type TransactionStatus = "pending" | "completed" | "overdue";

export interface Transaction {
  id: string;
  buyer_id: string;
  seller_id: string;
  inventory_id: string;
  total_amount: number;
  currency: Currency;
  advance_paid: number;
  credit_amount: number;
  due_date: string;
  status: TransactionStatus;
  created_at: string;
}

const VALID_CURRENCIES: Currency[] = ["USD", "INR", "AED"];

export const transactions: Transaction[] = [];

function computeStatus(due_date: string, current: TransactionStatus): TransactionStatus {
  if (current === "completed") return "completed";
  return new Date(due_date) < new Date() ? "overdue" : current;
}

function computeCreditScore(
  completedCount: number,
  overdueCount: number,
  totalOutstanding: number
): number {
  let score = 750;
  score += Math.min(completedCount * 20, 100);
  score -= overdueCount * 100;
  const outstandingPenalty = Math.min(Math.floor(totalOutstanding / 100) * 0.5, 150);
  score -= outstandingPenalty;
  return Math.max(300, Math.min(850, Math.round(score)));
}

function creditRating(score: number): string {
  if (score >= 750) return "Excellent";
  if (score >= 680) return "Good";
  if (score >= 580) return "Fair";
  if (score >= 450) return "Poor";
  return "Very Poor";
}

router.post("/transactions", (req, res) => {
  const {
    buyer_id,
    seller_id,
    inventory_id,
    total_amount,
    currency,
    advance_paid,
    credit_amount,
    due_date,
  } = req.body as Partial<Omit<Transaction, "id" | "status" | "created_at">>;

  if (
    !buyer_id ||
    !seller_id ||
    !inventory_id ||
    total_amount == null ||
    !currency ||
    advance_paid == null ||
    credit_amount == null ||
    !due_date
  ) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!VALID_CURRENCIES.includes(currency)) {
    res.status(400).json({ error: "currency must be one of USD, INR, AED" });
    return;
  }

  if (typeof total_amount !== "number" || total_amount < 0) {
    res.status(400).json({ error: "total_amount must be a non-negative number" });
    return;
  }

  if (typeof advance_paid !== "number" || advance_paid < 0) {
    res.status(400).json({ error: "advance_paid must be a non-negative number" });
    return;
  }

  if (typeof credit_amount !== "number" || credit_amount < 0) {
    res.status(400).json({ error: "credit_amount must be a non-negative number" });
    return;
  }

  if (isNaN(Date.parse(due_date))) {
    res.status(400).json({ error: "due_date must be a valid date" });
    return;
  }

  const transaction: Transaction = {
    id: randomUUID(),
    buyer_id,
    seller_id,
    inventory_id,
    total_amount,
    currency,
    advance_paid,
    credit_amount,
    due_date: new Date(due_date).toISOString(),
    status: computeStatus(due_date, "pending"),
    created_at: new Date().toISOString(),
  };

  transactions.push(transaction);
  saveTransactions(transactions);
  res.status(201).json(transaction);
});

router.get("/buyers/:id/credit-summary", (req, res) => {
  const buyer_id = req.params["id"];
  const { requester_id } = req.query as { requester_id?: string };

  if (!requester_id) {
    res.status(401).json({
      error: "requester_id query parameter is required. Only PRO plan members may access buyer credit data.",
    });
    return;
  }

  const requester = users.find((u) => u.id === requester_id);
  if (!requester) {
    res.status(404).json({ error: "Requester not found" });
    return;
  }

  if (requester.subscription_plan !== "pro") {
    res.status(403).json({
      error: "Access denied. Buyer credit insights are exclusive to PRO plan members.",
      requester_plan: requester.subscription_plan,
      upgrade_hint: "Upgrade to the PRO plan ($500/month) to unlock buyer credit scores, outstanding balances, and overdue tracking.",
    });
    return;
  }

  const buyerTransactions = transactions
    .filter((t) => t.buyer_id === buyer_id)
    .map((t) => ({ ...t, status: computeStatus(t.due_date, t.status) }));

  const now = new Date();

  const completedTxns = buyerTransactions.filter((t) => t.status === "completed");
  const overdueTxns = buyerTransactions.filter(
    (t) => t.status === "overdue" || (t.status !== "completed" && new Date(t.due_date) < now)
  );

  const total_outstanding = buyerTransactions
    .filter((t) => t.status !== "completed")
    .reduce((sum, t) => sum + t.credit_amount, 0);

  const overdue_amount = overdueTxns.reduce((sum, t) => sum + t.credit_amount, 0);

  const score = computeCreditScore(completedTxns.length, overdueTxns.length, total_outstanding);

  res.json({
    buyer_id,
    credit_score: score,
    credit_rating: creditRating(score),
    total_outstanding: Math.round(total_outstanding * 100) / 100,
    overdue_amount: Math.round(overdue_amount * 100) / 100,
    completed_transactions: completedTxns.length,
    overdue_transactions: overdueTxns.length,
    transactions: buyerTransactions,
  });
});

export default router;
