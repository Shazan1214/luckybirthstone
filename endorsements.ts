import { Router } from "express";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { applyTrustScore } from "../lib/trustScore.js";
import { saveUsers, saveEndorsements, loadPersistedEndorsements } from "../lib/persist.js";
import { logger } from "../lib/logger.js";

const router = Router();

export interface Endorsement {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  years_known: number | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  accepted_at: string | null;
}

export const endorsements: Endorsement[] = [];

export async function loadEndorsements(): Promise<void> {
  const saved = await loadPersistedEndorsements();
  if (saved.length > 0) {
    endorsements.push(...(saved as Endorsement[]));
    logger.info({ count: endorsements.length }, "endorsements: loaded from storage");
  }
  // Sync endorsements_count for all users from accepted endorsements
  for (const u of users) {
    u.endorsements_count = endorsements.filter(
      (e) => e.to_user_id === u.id && e.status === "accepted"
    ).length;
    applyTrustScore(u);
  }
}

function save() {
  saveEndorsements(endorsements);
}

// ── POST /endorsements ── Give an endorsement ────────────────────────────────
router.post("/endorsements", (req, res) => {
  const { from_user_id, to_user_id, message, years_known } = req.body as {
    from_user_id?: string;
    to_user_id?: string;
    message?: string;
    years_known?: number | null;
  };

  if (!from_user_id || !to_user_id || !message?.trim()) {
    return res.status(400).json({ error: "from_user_id, to_user_id and message are required" });
  }
  if (from_user_id === to_user_id) {
    return res.status(400).json({ error: "Cannot endorse yourself" });
  }

  const fromUser = users.find((u) => u.id === from_user_id);
  const toUser = users.find((u) => u.id === to_user_id);
  if (!fromUser) return res.status(404).json({ error: "Sender not found" });
  if (!toUser) return res.status(404).json({ error: "Recipient not found" });

  const existing = endorsements.find(
    (e) =>
      e.from_user_id === from_user_id &&
      e.to_user_id === to_user_id &&
      e.status === "pending"
  );
  if (existing) {
    return res.status(409).json({ error: "A pending endorsement already exists between these users" });
  }
  const alreadyAccepted = endorsements.find(
    (e) =>
      e.from_user_id === from_user_id &&
      e.to_user_id === to_user_id &&
      e.status === "accepted"
  );
  if (alreadyAccepted) {
    return res.status(409).json({ error: "You have already endorsed this user" });
  }

  const endorsement: Endorsement = {
    id: randomUUID(),
    from_user_id,
    to_user_id,
    message: message.trim(),
    years_known: typeof years_known === "number" ? years_known : null,
    status: "pending",
    created_at: new Date().toISOString(),
    accepted_at: null,
  };
  endorsements.push(endorsement);
  save();
  logger.info({ from: from_user_id, to: to_user_id }, "endorsement: created");
  return res.status(201).json(endorsement);
});

// ── GET /endorsements/received/:userId ── Accepted endorsements for a user ───
router.get("/endorsements/received/:userId", (req, res) => {
  const { userId } = req.params;
  const accepted = endorsements
    .filter((e) => e.to_user_id === userId && e.status === "accepted")
    .sort((a, b) => (b.accepted_at ?? b.created_at).localeCompare(a.accepted_at ?? a.created_at));

  const enriched = accepted.map((e) => {
    const from = users.find((u) => u.id === e.from_user_id);
    return {
      ...e,
      from_name: from?.company_name ?? from?.name ?? "Unknown",
      from_logo: from?.logo_url ?? null,
      from_verification_badge: from?.verification_badge ?? null,
    };
  });
  return res.json(enriched);
});

// ── GET /endorsements/pending/:userId ── Pending endorsements awaiting action ─
router.get("/endorsements/pending/:userId", (req, res) => {
  const { userId } = req.params;
  const pending = endorsements
    .filter((e) => e.to_user_id === userId && e.status === "pending")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const enriched = pending.map((e) => {
    const from = users.find((u) => u.id === e.from_user_id);
    return {
      ...e,
      from_name: from?.company_name ?? from?.name ?? "Unknown",
      from_logo: from?.logo_url ?? null,
      from_verification_badge: from?.verification_badge ?? null,
    };
  });
  return res.json(enriched);
});

// ── GET /endorsements/given/:userId ── Endorsements given by a user ───────────
router.get("/endorsements/given/:userId", (req, res) => {
  const { userId } = req.params;
  const given = endorsements
    .filter((e) => e.from_user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const enriched = given.map((e) => {
    const to = users.find((u) => u.id === e.to_user_id);
    return {
      ...e,
      to_name: to?.company_name ?? to?.name ?? "Unknown",
      to_logo: to?.logo_url ?? null,
    };
  });
  return res.json(enriched);
});

// ── PATCH /endorsements/:id/accept ── Accept an endorsement ──────────────────
router.patch("/endorsements/:id/accept", (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body as { user_id?: string };

  const endorsement = endorsements.find((e) => e.id === id);
  if (!endorsement) return res.status(404).json({ error: "Endorsement not found" });
  if (endorsement.to_user_id !== user_id) {
    return res.status(403).json({ error: "Only the recipient can accept an endorsement" });
  }
  if (endorsement.status !== "pending") {
    return res.status(400).json({ error: `Endorsement is already ${endorsement.status}` });
  }

  endorsement.status = "accepted";
  endorsement.accepted_at = new Date().toISOString();

  const toUser = users.find((u) => u.id === endorsement.to_user_id);
  if (toUser) {
    toUser.endorsements_count = endorsements.filter(
      (e) => e.to_user_id === toUser.id && e.status === "accepted"
    ).length;
    applyTrustScore(toUser);
    saveUsers(users);
  }

  save();
  logger.info({ id, to: user_id }, "endorsement: accepted");
  return res.json({ ...endorsement, new_trust_score: toUser?.trust_score ?? null });
});

// ── PATCH /endorsements/:id/reject ── Reject an endorsement ──────────────────
router.patch("/endorsements/:id/reject", (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body as { user_id?: string };

  const endorsement = endorsements.find((e) => e.id === id);
  if (!endorsement) return res.status(404).json({ error: "Endorsement not found" });
  if (endorsement.to_user_id !== user_id) {
    return res.status(403).json({ error: "Only the recipient can reject an endorsement" });
  }
  if (endorsement.status !== "pending") {
    return res.status(400).json({ error: `Endorsement is already ${endorsement.status}` });
  }

  endorsement.status = "rejected";
  save();
  logger.info({ id, to: user_id }, "endorsement: rejected");
  return res.json(endorsement);
});

// ── DELETE /endorsements/:id ── Withdraw an endorsement ──────────────────────
router.delete("/endorsements/:id", (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body as { user_id?: string };

  const idx = endorsements.findIndex((e) => e.id === id);
  if (idx === -1) return res.status(404).json({ error: "Endorsement not found" });
  const endorsement = endorsements[idx];
  if (endorsement.from_user_id !== user_id) {
    return res.status(403).json({ error: "Only the sender can withdraw an endorsement" });
  }

  if (endorsement.status === "accepted") {
    const toUser = users.find((u) => u.id === endorsement.to_user_id);
    if (toUser) {
      endorsements.splice(idx, 1);
      toUser.endorsements_count = endorsements.filter(
        (e) => e.to_user_id === toUser.id && e.status === "accepted"
      ).length;
      applyTrustScore(toUser);
      saveUsers(users);
    } else {
      endorsements.splice(idx, 1);
    }
  } else {
    endorsements.splice(idx, 1);
  }

  save();
  logger.info({ id, from: user_id }, "endorsement: withdrawn");
  return res.json({ success: true });
});

export default router;
