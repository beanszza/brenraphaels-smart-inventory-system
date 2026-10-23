"use server";

import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
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
