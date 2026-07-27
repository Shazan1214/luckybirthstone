import { randomUUID } from "crypto";

export type NotificationType =
  | "new_user"
  | "new_listing"
  | "overdue_payment"
  | "subscription_expiry"
  | "low_credit"
  | "verification_approved"
  | "verification_rejected";

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  user_id?: string;
  entity_id?: string;
  created_at: string;
  read: boolean;
}

export const notifications: AdminNotification[] = [];

export function addNotification(
  type: NotificationType,
  title: string,
  message: string,
  options: { user_id?: string; entity_id?: string } = {}
) {
  notifications.unshift({
    id: randomUUID(),
    type,
    title,
    message,
    user_id: options.user_id,
    entity_id: options.entity_id,
    created_at: new Date().toISOString(),
    read: false,
  });
  if (notifications.length > 200) notifications.splice(200);
}
