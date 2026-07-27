import { Router } from "express";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { deals } from "./deals.js";
import { applyTrustScore } from "../lib/trustScore.js";
import { saveDisputes, loadPersistedDisputes } from "../lib/persist.js";
import { saveUsers } from "../lib/persist.js";
import { logger } from "../lib/logger.js";

const router = Router();

export type DisputeStatus = "open" | "investigating" | "resolved_buyer" | "resolved_seller" | "dismissed";

export interface Dispute {
  id: string;
  deal_id: string | null;
  filed_by: string;
  against_user_id: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

export const disputes: Dispute[] = [];

export async function loadDisputes(): Promise<void> {
  const saved = await loadPersistedDisputes();
  if (saved.length > 0) disputes.push(...(saved as Dispute[]));
  logger.info({ count: disputes.length }, "disputes: loaded");
}

function save() { saveDisputes(disputes); }

function enrich(d: Dispute) {
  const filer = users.find((u) => u.id === d.filed_by);
  const accused = users.find((u) => u.id === d.against_user_id);
  return {
    ...d,
    filed_by_name: filer?.company_name ?? filer?.name ?? "Unknown",
    against_name: accused?.company_name ?? accused?.name ?? "Unknown",
  };
}

// POST /disputes — file a dispute
router.post("/disputes", (req, res) => {
  const { filed_by, against_user_id, deal_id, reason, description } = req.body as {
    filed_by?: string; against_user_id?: string; deal_id?: string | null;
    reason?: string; description?: string;
  };
  if (!filed_by || !against_user_id || !reason?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "filed_by, against_user_id, reason, and description are required" });
  }
  if (filed_by === against_user_id) return res.status(400).json({ error: "Cannot dispute with yourself" });
  if (!users.find((u) => u.id === filed_by)) return res.status(404).json({ error: "Filing user not found" });
  if (!users.find((u) => u.id === against_user_id)) return res.status(404).json({ error: "Accused user not found" });

  // If deal_id provided, mark deal as disputed
  if (deal_id) {
    const deal = deals.find((d) => d.id === deal_id);
    if (deal && !["completed", "cancelled"].includes(deal.status)) {
      deal.status = "disputed";
    }
  }

  const dispute: Dispute = {
    id: randomUUID(),
    deal_id: deal_id ?? null,
    filed_by,
    against_user_id,
    reason: reason.trim(),
    description: description.trim(),
    status: "open",
    resolution: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
  };
  disputes.push(dispute);
  save();
  logger.info({ id: dispute.id, by: filed_by, against: against_user_id }, "dispute: filed");
  return res.status(201).json(enrich(dispute));
});

// GET /disputes/my/:userId
router.get("/disputes/my/:userId", (req, res) => {
  const uid = req.params.userId;
  const list = disputes
    .filter((d) => d.filed_by === uid || d.against_user_id === uid)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(enrich);
  return res.json(list);
});

// GET /admin/disputes — all disputes (admin)
router.get("/admin/disputes", (req, res) => {
  const adminId = req.headers["x-admin-id"] as string;
  const admin = users.find((u) => u.id === adminId && u.is_admin);
  if (!admin) return res.status(403).json({ error: "Admin access required" });
  return res.json([...disputes].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(enrich));
});

// PATCH /admin/disputes/:id — resolve a dispute (admin)
router.patch("/admin/disputes/:id", (req, res) => {
  const adminId = req.headers["x-admin-id"] as string;
  const admin = users.find((u) => u.id === adminId && u.is_admin);
  if (!admin) return res.status(403).json({ error: "Admin access required" });

  const dispute = disputes.find((d) => d.id === req.params.id);
  if (!dispute) return res.status(404).json({ error: "Dispute not found" });

  const { status, resolution } = req.body as { status?: DisputeStatus; resolution?: string };
  if (!status) return res.status(400).json({ error: "status is required" });

  const prevStatus = dispute.status;
  dispute.status = status;
  if (resolution) dispute.resolution = resolution;
  dispute.resolved_at = new Date().toISOString();

  // Apply dispute penalty to the losing party
  if (prevStatus === "open" || prevStatus === "investigating") {
    let penalizedUserId: string | null = null;
    if (status === "resolved_buyer") penalizedUserId = dispute.against_user_id; // seller lost
    if (status === "resolved_seller") penalizedUserId = dispute.filed_by; // buyer lost (frivolous)
    if (penalizedUserId) {
      const penalized = users.find((u) => u.id === penalizedUserId);
      if (penalized) {
        penalized.disputes_count = (penalized.disputes_count ?? 0) + 1;
        applyTrustScore(penalized);
        saveUsers(users);
      }
    }
  }

  save();
  logger.info({ id: dispute.id, status }, "dispute: resolved by admin");
  return res.json(enrich(dispute));
});

export default router;
