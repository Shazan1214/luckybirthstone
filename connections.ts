import { Router } from "express";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { saveConnections, loadPersistedConnections } from "../lib/persist.js";
import { logger } from "../lib/logger.js";

const router = Router();

export interface Connection {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  accepted_at: string | null;
}

export const connections: Connection[] = [];

export async function loadConnections(): Promise<void> {
  const saved = await loadPersistedConnections();
  if (saved.length > 0) connections.push(...(saved as Connection[]));
  logger.info({ count: connections.length }, "connections: loaded");
}

function save() { saveConnections(connections); }

function enrich(c: Connection, perspective: "from" | "to") {
  const otherId = perspective === "from" ? c.to_user_id : c.from_user_id;
  const other = users.find((u) => u.id === otherId);
  return {
    ...c,
    other_name: other?.company_name ?? other?.name ?? "Unknown",
    other_logo: other?.logo_url ?? null,
    other_verification_badge: other?.verification_badge ?? null,
    other_user_type: other?.user_type ?? null,
    other_id: otherId,
  };
}

// POST /connections — send a connection request
router.post("/connections", (req, res) => {
  const { from_user_id, to_user_id } = req.body as { from_user_id?: string; to_user_id?: string };
  if (!from_user_id || !to_user_id) return res.status(400).json({ error: "from_user_id and to_user_id are required" });
  if (from_user_id === to_user_id) return res.status(400).json({ error: "Cannot connect with yourself" });
  if (!users.find((u) => u.id === from_user_id)) return res.status(404).json({ error: "Sender not found" });
  if (!users.find((u) => u.id === to_user_id)) return res.status(404).json({ error: "Recipient not found" });

  const existing = connections.find(
    (c) =>
      ((c.from_user_id === from_user_id && c.to_user_id === to_user_id) ||
       (c.from_user_id === to_user_id && c.to_user_id === from_user_id)) &&
      c.status !== "rejected"
  );
  if (existing) return res.status(409).json({ error: "Connection already exists or is pending", status: existing.status });

  const conn: Connection = {
    id: randomUUID(),
    from_user_id,
    to_user_id,
    status: "pending",
    created_at: new Date().toISOString(),
    accepted_at: null,
  };
  connections.push(conn);
  save();
  return res.status(201).json(conn);
});

// GET /connections/sent/:userId — outgoing requests
router.get("/connections/sent/:userId", (req, res) => {
  const list = connections
    .filter((c) => c.from_user_id === req.params.userId)
    .map((c) => enrich(c, "from"));
  return res.json(list);
});

// GET /connections/pending/:userId — incoming requests awaiting action
router.get("/connections/pending/:userId", (req, res) => {
  const list = connections
    .filter((c) => c.to_user_id === req.params.userId && c.status === "pending")
    .map((c) => enrich(c, "to"));
  return res.json(list);
});

// GET /connections/accepted/:userId — full network
router.get("/connections/accepted/:userId", (req, res) => {
  const uid = req.params.userId;
  const list = connections
    .filter((c) => (c.from_user_id === uid || c.to_user_id === uid) && c.status === "accepted")
    .map((c) => enrich(c, c.from_user_id === uid ? "from" : "to"));
  return res.json(list);
});

// PATCH /connections/:id/accept
router.patch("/connections/:id/accept", (req, res) => {
  const conn = connections.find((c) => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: "Connection not found" });
  const { user_id } = req.body as { user_id?: string };
  if (conn.to_user_id !== user_id) return res.status(403).json({ error: "Only the recipient can accept" });
  if (conn.status !== "pending") return res.status(400).json({ error: `Already ${conn.status}` });
  conn.status = "accepted";
  conn.accepted_at = new Date().toISOString();
  save();
  return res.json(conn);
});

// PATCH /connections/:id/reject
router.patch("/connections/:id/reject", (req, res) => {
  const conn = connections.find((c) => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: "Connection not found" });
  const { user_id } = req.body as { user_id?: string };
  if (conn.to_user_id !== user_id) return res.status(403).json({ error: "Only the recipient can reject" });
  if (conn.status !== "pending") return res.status(400).json({ error: `Already ${conn.status}` });
  conn.status = "rejected";
  save();
  return res.json(conn);
});

// DELETE /connections/:id — withdraw a request or disconnect
router.delete("/connections/:id", (req, res) => {
  const { user_id } = req.body as { user_id?: string };
  const idx = connections.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Connection not found" });
  const conn = connections[idx];
  if (conn.from_user_id !== user_id && conn.to_user_id !== user_id) {
    return res.status(403).json({ error: "Not your connection" });
  }
  connections.splice(idx, 1);
  save();
  return res.json({ success: true });
});

export default router;
