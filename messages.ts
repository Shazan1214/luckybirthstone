import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { users, USER_TYPE_LABELS } from "./users.js";
import { logger } from "../lib/logger.js";
import { sendNewMessageNotification } from "../lib/email.js";
import { saveMessages } from "../lib/persist.js";

const router: IRouter = Router();

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  created_at: string;
  is_read: boolean;
  listing_id?: string;
}

export const messages: Message[] = [];

router.post("/messages", (req, res) => {
  const { sender_id, receiver_id, message_text, listing_id } = req.body as Partial<{
    sender_id: string;
    receiver_id: string;
    message_text: string;
    listing_id: string;
  }>;

  if (!sender_id || !receiver_id || !message_text?.trim()) {
    res.status(400).json({ error: "sender_id, receiver_id, and message_text are required" });
    return;
  }

  if (sender_id === receiver_id) {
    res.status(400).json({ error: "Cannot send a message to yourself" });
    return;
  }

  const sender = users.find((u) => u.id === sender_id);
  if (!sender) {
    res.status(404).json({ error: "Sender not found" });
    return;
  }

  const receiver = users.find((u) => u.id === receiver_id);
  if (!receiver) {
    res.status(404).json({ error: "Receiver not found" });
    return;
  }

  if (!sender.email_verified) {
    res.status(403).json({
      error: "You must verify your email before sending messages.",
      hint: "Check your inbox for the verification code.",
    });
    return;
  }

  if (
    sender.verification_status !== "basic_verified" &&
    sender.verification_status !== "verified" &&
    sender.verification_status !== "legacy_verified"
  ) {
    res.status(403).json({
      error: "Only verified users can initiate conversations. Please complete verification first.",
      verification_status: sender.verification_status,
    });
    return;
  }

  const msg: Message = {
    id: randomUUID(),
    sender_id,
    receiver_id,
    message_text: message_text.trim(),
    created_at: new Date().toISOString(),
    is_read: false,
    ...(listing_id ? { listing_id } : {}),
  };

  messages.push(msg);
  saveMessages(messages);

  if (!receiver.is_online) {
    const senderCompany = sender.company_name ?? sender.name;
    sendNewMessageNotification(receiver.email, receiver.name, senderCompany).catch((err) =>
      logger.error({ err }, "Failed to send new message notification email")
    );
  }

  res.status(201).json(msg);
});

router.get("/messages/inbox/:user_id", (req, res) => {
  const user_id = req.params["user_id"];
  const user = users.find((u) => u.id === user_id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userMessages = messages.filter(
    (m) => m.sender_id === user_id || m.receiver_id === user_id
  );

  const partnerIds = new Set<string>();
  for (const m of userMessages) {
    partnerIds.add(m.sender_id === user_id ? m.receiver_id : m.sender_id);
  }

  const conversations = Array.from(partnerIds).map((partnerId) => {
    const partner = users.find((u) => u.id === partnerId);
    const thread = userMessages
      .filter(
        (m) =>
          (m.sender_id === user_id && m.receiver_id === partnerId) ||
          (m.sender_id === partnerId && m.receiver_id === user_id)
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const unread = thread.filter((m) => m.receiver_id === user_id && !m.is_read).length;
    const latest = thread[0];

    const listingRef = thread.slice().reverse().find((m) => m.listing_id);
    return {
      partner_id: partnerId,
      partner_name: partner?.name ?? "Unknown",
      partner_company: partner?.company_name ?? null,
      partner_user_type: partner ? USER_TYPE_LABELS[partner.user_type] : null,
      partner_verification_badge: partner?.verification_badge ?? "none",
      partner_is_online: partner?.is_online ?? false,
      partner_preferred_language: partner?.preferred_language ?? "en",
      unread_count: unread,
      listing_id: listingRef?.listing_id ?? null,
      last_message: latest
        ? {
            text: latest.message_text,
            sent_at: latest.created_at,
            is_mine: latest.sender_id === user_id,
          }
        : null,
    };
  });

  conversations.sort((a, b) => {
    const aTime = a.last_message?.sent_at ?? "";
    const bTime = b.last_message?.sent_at ?? "";
    return bTime.localeCompare(aTime);
  });

  res.json({ user_id, conversations });
});

router.get("/messages/inquiries/count", (req, res) => {
  const user_id = req.query["user_id"] as string | undefined;
  if (!user_id) {
    res.status(400).json({ error: "user_id is required" });
    return;
  }
  const count = messages.filter((m) => m.receiver_id === user_id).length;
  const unread = messages.filter((m) => m.receiver_id === user_id && !m.is_read).length;
  res.json({ user_id, total_inquiries: count, unread });
});

router.get("/messages/conversation/:user1/:user2", (req, res) => {
  const { user1, user2 } = req.params;

  if (!users.find((u) => u.id === user1) || !users.find((u) => u.id === user2)) {
    res.status(404).json({ error: "One or both users not found" });
    return;
  }

  const thread = messages
    .filter(
      (m) =>
        (m.sender_id === user1 && m.receiver_id === user2) ||
        (m.sender_id === user2 && m.receiver_id === user1)
    )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let markedRead = false;
  for (const m of thread) {
    if (m.receiver_id === user1 && !m.is_read) {
      m.is_read = true;
      markedRead = true;
    }
  }
  if (markedRead) saveMessages(messages);

  res.json({ user1, user2, messages: thread });
});

export default router;
