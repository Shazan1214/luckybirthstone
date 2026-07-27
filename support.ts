import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { users } from "./users.js";
import { logger } from "../lib/logger.js";
import {
  sendSupportTicketCreatedToUser,
  sendSupportTicketAdminAlert,
  sendSupportTicketReply,
} from "../lib/email.js";
import { addNotification } from "../lib/notifications.js";
import { saveSupportTickets, saveTicketResponses } from "../lib/persist.js";

const router: IRouter = Router();

export interface SupportTicket {
  id: string;
  user_id: string | null;
  ticket_type: "user_support" | "contact_inquiry";
  submitter_name: string;
  submitter_email: string;
  submitter_plan: "anonymous" | "free" | "paid";
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
}

export interface TicketResponse {
  id: string;
  ticket_id: string;
  admin_id: string;
  message: string;
  timestamp: string;
}

export const supportTickets: SupportTicket[] = [];
export const ticketResponses: TicketResponse[] = [];

// ─── Public: contact form (no auth required) ─────────────────────────────────
router.post("/contact", (req, res) => {
  const { name, email, subject, message } = req.body as Partial<{
    name: string;
    email: string;
    subject: string;
    message: string;
  }>;

  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    res.status(400).json({ error: "name, email, subject, and message are required" });
    return;
  }

  const ticket: SupportTicket = {
    id: randomUUID(),
    user_id: null,
    ticket_type: "contact_inquiry",
    submitter_name: name.trim(),
    submitter_email: email.trim(),
    submitter_plan: "anonymous",
    subject: subject.trim(),
    message: message.trim(),
    status: "open",
    created_at: new Date().toISOString(),
  };

  supportTickets.push(ticket);
  saveSupportTickets(supportTickets);

  addNotification(
    "new_user",
    "New Contact Inquiry",
    `${name.trim()} (${email.trim()}) submitted a contact form: "${ticket.subject}"`,
    {}
  );

  const admin = users.find((u) => u.is_admin);
  if (admin) {
    sendSupportTicketAdminAlert(
      admin.email,
      name.trim(),
      email.trim(),
      ticket.subject,
      ticket.id
    ).catch((err) => logger.error({ err }, "Failed to send contact inquiry admin alert"));
  }

  res.status(201).json({ success: true, ticket_id: ticket.id });
});

// ─── User: create ticket ────────────────────────────────────────────────────
router.post("/support/tickets", (req, res) => {
  const { user_id, subject, message } = req.body as Partial<{
    user_id: string;
    subject: string;
    message: string;
  }>;

  if (!user_id || !subject?.trim() || !message?.trim()) {
    res.status(400).json({ error: "user_id, subject, and message are required" });
    return;
  }

  const user = users.find((u) => u.id === user_id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const isPaid = user.subscription_plan && user.subscription_plan !== "basic";
  const submitterPlan: SupportTicket["submitter_plan"] = isPaid ? "paid" : "free";

  const ticket: SupportTicket = {
    id: randomUUID(),
    user_id,
    ticket_type: "user_support",
    submitter_name: user.name,
    submitter_email: user.email,
    submitter_plan: submitterPlan,
    subject: subject.trim(),
    message: message.trim(),
    status: "open",
    created_at: new Date().toISOString(),
  };

  supportTickets.push(ticket);
  saveSupportTickets(supportTickets);

  addNotification(
    "new_user",
    "New Support Ticket",
    `${user.name} opened a ticket: "${ticket.subject}"`,
    { user_id }
  );

  const admin = users.find((u) => u.is_admin);

  sendSupportTicketCreatedToUser(user.email, user.name, ticket.id, ticket.subject).catch((err) =>
    logger.error({ err }, "Failed to send support ticket confirmation email")
  );

  if (admin) {
    sendSupportTicketAdminAlert(
      admin.email,
      user.name,
      user.email,
      ticket.subject,
      ticket.id
    ).catch((err) => logger.error({ err }, "Failed to send support ticket admin alert"));
  }

  res.status(201).json(ticket);
});

// ─── User: view own tickets ─────────────────────────────────────────────────
router.get("/support/tickets/:user_id", (req, res) => {
  const user = users.find((u) => u.id === req.params["user_id"]);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const tickets = supportTickets
    .filter((t) => t.user_id === req.params["user_id"])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((t) => ({
      ...t,
      responses: ticketResponses
        .filter((r) => r.ticket_id === t.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    }));

  res.json(tickets);
});

// ─── Admin: view all tickets ────────────────────────────────────────────────
router.get("/admin/tickets", (req, res) => {
  const adminId = req.headers["x-admin-id"] as string | undefined;
  if (!adminId || !users.find((u) => u.id === adminId && u.is_admin)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  const { status, ticket_type } = req.query as { status?: string; ticket_type?: string };
  let result = [...supportTickets];
  if (status) result = result.filter((t) => t.status === status);
  if (ticket_type) result = result.filter((t) => t.ticket_type === ticket_type);
  result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json(
    result.map((t) => {
      const user = t.user_id ? users.find((u) => u.id === t.user_id) : null;
      return {
        ...t,
        user_name: t.submitter_name,
        user_email: t.submitter_email,
        company_name: user?.company_name ?? null,
        responses: ticketResponses
          .filter((r) => r.ticket_id === t.id)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      };
    })
  );
});

// ─── Admin: respond to ticket ───────────────────────────────────────────────
router.post("/admin/tickets/respond", (req, res) => {
  const adminId = req.headers["x-admin-id"] as string | undefined;
  if (!adminId || !users.find((u) => u.id === adminId && u.is_admin)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  const { ticket_id, message } = req.body as Partial<{ ticket_id: string; message: string }>;
  if (!ticket_id || !message?.trim()) {
    res.status(400).json({ error: "ticket_id and message are required" });
    return;
  }

  const ticket = supportTickets.find((t) => t.id === ticket_id);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const response: TicketResponse = {
    id: randomUUID(),
    ticket_id,
    admin_id: adminId,
    message: message.trim(),
    timestamp: new Date().toISOString(),
  };

  ticketResponses.push(response);
  saveTicketResponses(ticketResponses);

  if (ticket.status === "open") {
    ticket.status = "in_progress";
    saveSupportTickets(supportTickets);
  }

  sendSupportTicketReply(
    ticket.submitter_email,
    ticket.submitter_name,
    message.trim(),
    ticket.id,
    ticket.subject
  ).catch((err) => logger.error({ err }, "Failed to send support reply email"));

  res.status(201).json(response);
});

// ─── Admin: update ticket status ────────────────────────────────────────────
router.put("/admin/tickets/status", (req, res) => {
  const adminId = req.headers["x-admin-id"] as string | undefined;
  if (!adminId || !users.find((u) => u.id === adminId && u.is_admin)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  const { ticket_id, status } = req.body as Partial<{
    ticket_id: string;
    status: "open" | "in_progress" | "resolved";
  }>;

  const VALID_STATUSES = ["open", "in_progress", "resolved"] as const;
  if (!ticket_id || !status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: "ticket_id and status (open|in_progress|resolved) are required" });
    return;
  }

  const ticket = supportTickets.find((t) => t.id === ticket_id);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  ticket.status = status;
  saveSupportTickets(supportTickets);
  res.json({ success: true, ticket_id, status });
});

export default router;
