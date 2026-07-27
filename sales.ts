import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { saveSales } from "../lib/persist.js";

const router: IRouter = Router();

export interface Sale {
  id: string;
  gem_id: string;
  seller_id: string;
  buyer_email: string;
  sale_price_usd: number;
  note: string;
  confirmed_at: string;
}

export const sales: Sale[] = [];

router.post("/sales", (req, res) => {
  const { gem_id, seller_id, buyer_email, sale_price_usd, note } = req.body as Partial<{
    gem_id: string;
    seller_id: string;
    buyer_email: string;
    sale_price_usd: number;
    note: string;
  }>;

  if (!gem_id || !seller_id || !buyer_email || sale_price_usd == null) {
    res.status(400).json({ error: "gem_id, seller_id, buyer_email, and sale_price_usd are required" });
    return;
  }

  const seller = users.find((u) => u.id === seller_id);
  if (!seller) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(buyer_email)) {
    res.status(400).json({ error: "Invalid buyer_email format" });
    return;
  }

  if (typeof sale_price_usd !== "number" || sale_price_usd <= 0) {
    res.status(400).json({ error: "sale_price_usd must be a positive number" });
    return;
  }

  const sale: Sale = {
    id: randomUUID(),
    gem_id,
    seller_id,
    buyer_email,
    sale_price_usd,
    note: note?.trim() ?? "",
    confirmed_at: new Date().toISOString(),
  };

  sales.push(sale);
  saveSales(sales);

  res.status(201).json(sale);
});

router.get("/sales", (req, res) => {
  const seller_id = req.query["seller_id"] as string | undefined;
  if (!seller_id) {
    res.status(400).json({ error: "seller_id query param is required" });
    return;
  }

  const sellerSales = sales
    .filter((s) => s.seller_id === seller_id)
    .sort((a, b) => new Date(b.confirmed_at).getTime() - new Date(a.confirmed_at).getTime());

  const total_revenue_usd = sellerSales.reduce((sum, s) => sum + s.sale_price_usd, 0);

  res.json({ seller_id, sales: sellerSales, total_sales: sellerSales.length, total_revenue_usd });
});

export default router;
