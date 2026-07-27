import { Router } from "express";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { saveCredits, loadPersistedCredits } from "../lib/persist.js";
import { logger } from "../lib/logger.js";

const router = Router();

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number; // positive = earn, negative = spend
  type: "earn" | "spend";
  reason: string;
  reference_id: string | null;
  created_at: string;
}

export const creditTransactions: CreditTransaction[] = [];

export async function loadCredits(): Promise<void> {
  const saved = await loadPersistedCredits();
  if (saved.length > 0) creditTransactions.push(...(saved as CreditTransaction[]));
  logger.info({ count: creditTransactions.length }, "credits: loaded transactions");
}

function save() { saveCredits(creditTransactions); }

export function addCredits(
  userId: string,
  amount: number,
  reason: string,
  referenceId: string | null = null
): void {
  const user = users.find((u) => u.id === userId);
  if (!user) return;
  user.credits = (user.credits ?? 0) + amount;
  if (user.credits < 0) user.credits = 0;
  const tx: CreditTransaction = {
    id: randomUUID(),
    user_id: userId,
    amount,
    type: amount >= 0 ? "earn" : "spend",
    reason,
    reference_id: referenceId,
    created_at: new Date().toISOString(),
  };
  creditTransactions.push(tx);
  save();
}

// GET /credits/balance/:userId
router.get("/credits/balance/:userId", (req, res) => {
  const user = users.find((u) => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ user_id: user.id, balance: user.credits ?? 0 });
});

// GET /credits/history/:userId
router.get("/credits/history/:userId", (req, res) => {
  const history = creditTransactions
    .filter((t) => t.user_id === req.params.userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 100);
  return res.json(history);
});

export default router;
