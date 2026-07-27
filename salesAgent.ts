import { Router } from "express";
import { salesUsers, toPublicSalesUser } from "../lib/salesUserStore.js";
import { users } from "./users.js";
import { inventory } from "./inventory.js";
import { crmProspects } from "./crm.js";
import { logger } from "../lib/logger.js";

const router = Router();

function requireSales(req: any, res: any): string | null {
  const salesId = req.headers["x-sales-id"] as string | undefined;
  if (!salesId) { res.status(401).json({ error: "Sales auth required" }); return null; }
  const user = salesUsers.find((u) => u.id === salesId && u.is_active);
  if (!user) { res.status(403).json({ error: "Invalid or inactive sales account" }); return null; }
  return user.id;
}

// POST /sales-agent/login
router.post("/sales-agent/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const user = salesUsers.find(
    (u) => u.email === email.trim().toLowerCase() && u.password === password && u.is_active
  );
  if (!user) {
    res.status(401).json({ error: "Invalid credentials or account deactivated" });
    return;
  }
  logger.info({ id: user.id, email: user.email }, "[SALES] Login");
  res.json({ ...toPublicSalesUser(user), role: "sales" });
});

// GET /sales-agent/me
router.get("/sales-agent/me", (req, res) => {
  const salesId = requireSales(req, res);
  if (!salesId) return;
  const user = salesUsers.find((u) => u.id === salesId)!;
  res.json({ ...toPublicSalesUser(user), role: "sales" });
});

// GET /sales-agent/dashboard — lightweight stats for sales portal
router.get("/sales-agent/dashboard", (req, res) => {
  if (!requireSales(req, res)) return;

  const totalProspects = crmProspects.length;
  const byStatus = Object.fromEntries(
    ["prospect", "contacted", "demo", "onboarded", "declined", "converted"].map((s) => [
      s,
      crmProspects.filter((p) => p.status === s).length,
    ])
  );
  const recentProspects = [...crmProspects]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const verifiedSellers = users.filter(
    (u) => !u.is_admin && ["basic_verified", "verified", "legacy_verified"].includes(u.verification_status)
  ).length;
  const totalListings = inventory.filter((g) => g.listing_status === "approved").length;

  res.json({
    total_prospects: totalProspects,
    by_status: byStatus,
    recent_prospects: recentProspects,
    platform: {
      verified_sellers: verifiedSellers,
      active_listings: totalListings,
    },
  });
});

export default router;
