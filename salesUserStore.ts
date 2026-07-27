import { randomUUID } from "crypto";
import { logger } from "./logger.js";
import { loadPersistedSalesUsers, saveSalesUsers } from "./persist.js";

export interface SalesUser {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  created_by_admin_id: string;
}

export const salesUsers: SalesUser[] = [];

export async function loadSalesUsers(): Promise<void> {
  const data = await loadPersistedSalesUsers();
  salesUsers.length = 0;
  for (const raw of data) {
    const u = raw as SalesUser;
    if (u.id && u.email) salesUsers.push(u);
  }
  logger.info({ count: salesUsers.length }, "Sales users loaded");
}

export function createSalesUser(fields: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  adminId: string;
}): SalesUser {
  const user: SalesUser = {
    id: randomUUID(),
    name: fields.name.trim(),
    email: fields.email.trim().toLowerCase(),
    password: fields.password,
    phone: fields.phone?.trim() || null,
    is_active: true,
    created_at: new Date().toISOString(),
    created_by_admin_id: fields.adminId,
  };
  salesUsers.push(user);
  saveSalesUsers(salesUsers);
  return user;
}

export function toPublicSalesUser(u: SalesUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    is_active: u.is_active,
    created_at: u.created_at,
  };
}
