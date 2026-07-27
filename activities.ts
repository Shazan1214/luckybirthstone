import { Router } from "express";
import { randomUUID } from "crypto";
import { saveActivities, loadPersistedActivities } from "../lib/persist.js";
import { logger } from "../lib/logger.js";

const router = Router();

export type ActivityType =
  | "joined"
  | "listed_gem"
  | "got_endorsement"
  | "gave_endorsement"
  | "connected"
  | "deal_completed"
  | "got_verified"
  | "auction_created"
  | "auction_won"
  | "deal_proposed";

export interface Activity {
  id: string;
  user_id: string;
  type: ActivityType;
  metadata: Record<string, unknown>;
  is_public: boolean;
  created_at: string;
}

export const activities: Activity[] = [];

export async function loadActivities(): Promise<void> {
  const saved = await loadPersistedActivities();
  if (saved.length > 0) activities.push(...(saved as Activity[]));
  logger.info({ count: activities.length }, "activities: loaded");
}

function save() { saveActivities(activities); }

export async function emitActivity(
  userId: string,
  type: ActivityType,
  metadata: Record<string, unknown> = {},
  isPublic = true
): Promise<void> {
  const activity: Activity = {
    id: randomUUID(),
    user_id: userId,
    type,
    metadata,
    is_public: isPublic,
    created_at: new Date().toISOString(),
  };
  activities.push(activity);
  save();
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  joined: "Joined LuckyBirthstone",
  listed_gem: "Listed a gemstone",
  got_endorsement: "Received an endorsement",
  gave_endorsement: "Endorsed a trader",
  connected: "Connected with a trader",
  deal_completed: "Completed a deal",
  got_verified: "Got verified",
  auction_created: "Created an auction",
  auction_won: "Won an auction",
  deal_proposed: "Proposed a deal",
};

// GET /activities/:userId — public activity feed
router.get("/activities/:userId", (req, res) => {
  const { limit = "20" } = req.query as { limit?: string };
  const feed = activities
    .filter((a) => a.user_id === req.params.userId && a.is_public)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, Math.min(50, parseInt(limit, 10)));

  return res.json(feed.map((a) => ({ ...a, label: ACTIVITY_LABELS[a.type] ?? a.type })));
});

// GET /activities/feed/global — global activity feed (admin/display)
router.get("/activities/feed/global", (req, res) => {
  const { limit = "30" } = req.query as { limit?: string };
  const feed = [...activities]
    .filter((a) => a.is_public)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, Math.min(100, parseInt(limit, 10)));
  return res.json(feed.map((a) => ({ ...a, label: ACTIVITY_LABELS[a.type] ?? a.type })));
});

export default router;
