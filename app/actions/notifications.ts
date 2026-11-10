"use server";

import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import { notificationLiveUrl } from "@/lib/gateway/notifications";
import { requireModule } from "@/lib/portal/staff";

// The bell shows on every page, so any held Module opens it; access is re-checked on every call
// and Known Staff is never consulted here.

export async function listMyNotifications() {
  return listNotifications(await requireModule("Dashboard"));
}

export async function countMyUnreadNotifications() {
  return countUnreadNotifications(await requireModule("Dashboard"));
}

export async function markMyNotificationRead(id: string) {
  await markNotificationRead(await requireModule("Dashboard"), id);
}

export async function markAllMyNotificationsRead() {
  await markAllNotificationsRead(await requireModule("Dashboard"));
}

/** A fresh Live ticket address for the signed-in Staff member only; the caller cannot choose the user. */
export async function getMyNotificationLiveUrl() {
  return notificationLiveUrl((await requireModule("Dashboard")).id);
}
