import { Router } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";
import { loadPersistedCRM, saveCRM } from "../lib/persist.js";
import { salesUsers } from "../lib/salesUserStore.js";

export interface CrmProspect {
  id: string;
  name: string;
  company: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status: "prospect" | "contacted" | "demo" | "onboarded" | "declined" | "converted";
  converted_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export let crmProspects: CrmProspect[] = [];

export async function loadCrmProspects(): Promise<void> {
  const data = await loadPersistedCRM();
  crmProspects.length = 0;
  for (const raw of data) {
    const p = raw as CrmProspect;
    if (p.id && p.name) crmProspects.push(p);
  }
  logger.info({ count: crmProspects.length }, "CRM prospects loaded");
}

const VALID_STATUSES = ["prospect", "contacted", "demo", "onboarded", "declined", "converted"] as const;

const router = Router();

function requireAdminOrSales(req: any, res: any): boolean {
  const adminId = req.headers["x-admin-id"];
  if (adminId) return true;
  const salesId = req.headers["x-sales-id"] as string | undefined;
  if (salesId) {
    const salesUser = salesUsers.find((u) => u.id === salesId && u.is_active);
    if (salesUser) return true;
  }
  res.status(401).json({ error: "Auth required" });
  return false;
}

// GET /admin/crm — list all prospects
router.get("/admin/crm", (req, res) => {
  if (!requireAdminOrSales(req, res)) return;
  res.json(crmProspects);
});

// POST /admin/crm/import — bulk import prospects from CSV/Excel
router.post("/admin/crm/import", (req, res) => {
  if (!requireAdminOrSales(req, res)) return;
  const rows = req.body as Array<Partial<CrmProspect>>;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Expected a non-empty array of prospects" });
    return;
  }
  const imported: CrmProspect[] = [];
  const skipped: number[] = [];
  rows.forEach((row, i) => {
    if (!row.name?.trim() || !row.company?.trim()) { skipped.push(i + 1); return; }
    const prospect: CrmProspect = {
      id: randomUUID(),
      name: row.name.trim(),
      company: row.company.trim(),
      phone: row.phone?.trim() || null,
      email: row.email?.trim() || null,
      notes: row.notes?.trim() || null,
      status: (row.status && VALID_STATUSES.includes(row.status)) ? row.status : "prospect",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    crmProspects.push(prospect);
    imported.push(prospect);
  });
  saveCRM(crmProspects);
  logger.info({ imported: imported.length, skipped: skipped.length }, "CRM bulk import");
  res.status(201).json({ imported: imported.length, skipped, prospects: imported });
});

// POST /admin/crm — create prospect
router.post("/admin/crm", (req, res) => {
  if (!requireAdminOrSales(req, res)) return;
  const { name, company, phone, email, notes, status } = req.body as Partial<CrmProspect>;
  if (!name?.trim() || !company?.trim()) {
    res.status(400).json({ error: "name and company are required" });
    return;
  }
  const prospect: CrmProspect = {
    id: randomUUID(),
    name: name.trim(),
    company: company.trim(),
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    notes: notes?.trim() || null,
    status: (status && VALID_STATUSES.includes(status)) ? status : "prospect",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  crmProspects.push(prospect);
  saveCRM(crmProspects);
  logger.info({ id: prospect.id, name: prospect.name }, "CRM prospect created");
  res.status(201).json(prospect);
});

// PATCH /admin/crm/:id — update prospect
router.patch("/admin/crm/:id", (req, res) => {
  if (!requireAdminOrSales(req, res)) return;
  const prospect = crmProspects.find((p) => p.id === req.params.id);
  if (!prospect) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }
  const { name, company, phone, email, notes, status } = req.body as Partial<CrmProspect>;
  if (name?.trim()) prospect.name = name.trim();
  if (company?.trim()) prospect.company = company.trim();
  if ("phone" in req.body) prospect.phone = phone?.trim() || null;
  if ("email" in req.body) prospect.email = email?.trim() || null;
  if ("notes" in req.body) prospect.notes = notes?.trim() || null;
  if (status && VALID_STATUSES.includes(status)) prospect.status = status;
  prospect.updated_at = new Date().toISOString();
  saveCRM(crmProspects);
  res.json(prospect);
});

// DELETE /admin/crm/:id — delete prospect
router.delete("/admin/crm/:id", (req, res) => {
  if (!requireAdminOrSales(req, res)) return;
  const idx = crmProspects.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }
  const [removed] = crmProspects.splice(idx, 1);
  saveCRM(crmProspects);
  logger.info({ id: removed.id }, "CRM prospect deleted");
  res.json({ success: true });
});

export default router;
