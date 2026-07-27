import { Router, type IRouter } from "express";
import { users } from "./users.js";
import { saveUsers } from "../lib/persist.js";
import { sendRawMessage } from "../lib/whatsapp.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const OPT_IN_KEYWORD = /join\s+luckybirthstone/i;
const STOP_KEYWORD = /^stop$/i;

const CONFIRMATION_MSG = [
  "✅ *You're now subscribed to LuckyBirthstone alerts!*",
  "",
  "You'll receive instant notifications for:",
  "💎 New gem listings from verified traders",
  "🏆 Live auction announcements",
  "✅ Account & verification updates",
  "",
  "Welcome to the LuckyBirthstone B2B gemstone network.",
  "Visit us: https://luckybirthstone.com",
  "",
  "Reply *STOP* anytime to unsubscribe.",
].join("\n");

const STOP_MSG = [
  "You've been unsubscribed from LuckyBirthstone alerts.",
  "",
  "You won't receive any further notifications from us.",
  "Reply *join luckybirthstone* anytime to re-subscribe.",
].join("\n");

function normalizeInboundPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function findUserByPhone(phone: string) {
  const digits = normalizeInboundPhone(phone);
  return users.find((u) => {
    if (!u.contact_number) return false;
    const uDigits = u.contact_number.replace(/\D/g, "");
    return uDigits === digits || uDigits.endsWith(digits) || digits.endsWith(uDigits);
  });
}

// POST /whatsapp/webhook — Gupshup inbound message callback
router.post("/whatsapp/webhook", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;

    logger.info({ body }, "[WHATSAPP WEBHOOK] Inbound message received");

    const type = body["type"] as string | undefined;
    if (type !== "message") {
      res.json({ status: "ignored", reason: "not a message event" });
      return;
    }

    const payload = body["payload"] as Record<string, unknown> | undefined;
    if (!payload) {
      res.status(400).json({ error: "Missing payload" });
      return;
    }

    const senderPhone = (payload["source"] as string | undefined) ?? "";
    const msgPayload = payload["payload"] as Record<string, unknown> | undefined;
    const msgText = ((msgPayload?.["text"] as string | undefined) ?? "").trim();

    if (!senderPhone || !msgText) {
      res.json({ status: "ignored", reason: "no sender or text" });
      return;
    }

    logger.info({ senderPhone, msgText }, "[WHATSAPP WEBHOOK] Parsed inbound");

    if (OPT_IN_KEYWORD.test(msgText)) {
      const user = findUserByPhone(senderPhone);
      if (user) {
        user.whatsapp_opt_in = true;
        await saveUsers();
        logger.info({ userId: user.id }, "[WHATSAPP WEBHOOK] Marked user whatsapp_opt_in=true");
      }

      await sendRawMessage(senderPhone, CONFIRMATION_MSG);
      logger.info({ senderPhone }, "[WHATSAPP WEBHOOK] Sent opt-in confirmation");
      res.json({ status: "ok", action: "opted_in" });
      return;
    }

    if (STOP_KEYWORD.test(msgText)) {
      const user = findUserByPhone(senderPhone);
      if (user) {
        user.whatsapp_opt_in = false;
        await saveUsers();
        logger.info({ userId: user.id }, "[WHATSAPP WEBHOOK] Marked user whatsapp_opt_in=false");
      }

      await sendRawMessage(senderPhone, STOP_MSG);
      logger.info({ senderPhone }, "[WHATSAPP WEBHOOK] Sent opt-out confirmation");
      res.json({ status: "ok", action: "opted_out" });
      return;
    }

    res.json({ status: "ignored", reason: "unrecognised keyword" });
  } catch (err) {
    logger.error({ err }, "[WHATSAPP WEBHOOK] Error handling inbound message");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /whatsapp/webhook — Gupshup webhook verification (if required)
router.get("/whatsapp/webhook", (_req, res) => {
  res.json({ status: "ok", service: "LuckyBirthstone WhatsApp Webhook" });
});

export default router;
