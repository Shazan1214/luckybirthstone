import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

interface RatesCache {
  rates: Record<string, number>;
  fetched_at: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const FALLBACK: Record<string, number> = { USD: 1, INR: 83.5, AED: 3.67, THB: 35.5 };
const CURRENCIES = ["USD", "INR", "AED", "THB"];

let cache: RatesCache | null = null;

async function fetchLiveRates(): Promise<Record<string, number>> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);
  const data = await res.json() as { rates: Record<string, number>; result: string };
  if (data.result !== "success") throw new Error("Exchange rate API error");
  const rates: Record<string, number> = { USD: 1 };
  for (const c of CURRENCIES) {
    if (c !== "USD" && data.rates[c]) rates[c] = data.rates[c];
  }
  return rates;
}

router.get("/exchange-rates", async (_req: Request, res: Response) => {
  const now = Date.now();

  if (cache && (now - cache.fetched_at) < CACHE_TTL_MS) {
    res.json({ rates: cache.rates, fetched_at: new Date(cache.fetched_at).toISOString(), source: "cache" });
    return;
  }

  try {
    const rates = await fetchLiveRates();
    cache = { rates, fetched_at: now };
    logger.info({ rates }, "exchange-rates: fetched live rates");
    res.json({ rates, fetched_at: new Date(now).toISOString(), source: "live" });
  } catch (err) {
    logger.warn({ err }, "exchange-rates: failed to fetch live rates, using fallback");
    res.json({ rates: FALLBACK, fetched_at: new Date().toISOString(), source: "fallback" });
  }
});

export default router;
