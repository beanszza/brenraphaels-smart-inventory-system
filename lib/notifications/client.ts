import { listMyNotifications, countMyUnreadNotifications, markMyNotificationRead, markAllMyNotificationsRead } from "@/app/actions/notifications";

export type StaffNotification = { id: string; title: string; description: string; createdAt: string; readAt: string | null };
export type NotificationSnapshot = { notifications: StaffNotification[]; unreadCount: number };
export type NotificationAction = { type: "list" } | { type: "read"; id: string } | { type: "read-all" };

/** Server actions resolve the validated Staff identity and IMS app scope. */
export async function requestNotifications(action: NotificationAction = { type: "list" }): Promise<NotificationSnapshot> {
  if (action.type === "read") await markMyNotificationRead(action.id);
  if (action.type === "read-all") await markAllMyNotificationsRead();
  const [records, unreadCount] = await Promise.all([listMyNotifications(), countMyUnreadNotifications()]);
  if (!Number.isSafeInteger(unreadCount) || unreadCount < 0 || !Array.isArray(records)) {
    throw new Error("Invalid notifications response");
  }
  const notifications = records.map((n) => {
    if (!n || typeof n.id !== "string" || !n.id || typeof n.title !== "string" || typeof n.body !== "string" ||
      typeof n.createdAt !== "string" || !Number.isFinite(Date.parse(n.createdAt)) ||
      !(n.readAt === null || (typeof n.readAt === "string" && Number.isFinite(Date.parse(n.readAt))))) {
      throw new Error("Invalid notifications response");
    }
    return { id: n.id, title: n.title, description: n.body, createdAt: n.createdAt, readAt: n.readAt };
  });
  return { notifications, unreadCount };
}
