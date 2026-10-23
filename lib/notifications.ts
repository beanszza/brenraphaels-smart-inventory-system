import { knownStaffHolding, type KnownStaffStore, prismaKnownStaff } from "@/lib/known-staff";
import {
  notificationGateway,
  SEND_TIMEOUT_MS,
  type NotificationGatewayPort,
  type NotificationInput,
  type NotificationRecord,
} from "@/lib/gateway/notifications";
import type { Module } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

type Deps = { gateway?: NotificationGatewayPort; knownStaff?: KnownStaffStore };

/**
 * Sends to one Staff member, addressed by their Portal user id. Best effort like audit:
 * a failing or slow gateway is logged on the server and never reaches the caller.
 */
export async function notifyStaff(
  staffId: string,
  input: NotificationInput,
  { gateway = notificationGateway }: Deps = {},
): Promise<void> {
  try {
    await gateway.send([staffId], input, AbortSignal.timeout(SEND_TIMEOUT_MS));
  } catch (error) {
    console.error("Notification could not be sent", error);
  }
}

/**
 * Sends to the Known Staff who held the Module when they last signed in, optionally leaving
 * out the Staff member whose action raised it. Staff IMS has not seen sign in are not reached.
 */
export async function notifyModule(
  module: Module,
  input: NotificationInput,
  { gateway = notificationGateway, knownStaff = prismaKnownStaff, except }: Deps & { except?: string } = {},
): Promise<void> {
  try {
    const recipients = (await knownStaffHolding(module, knownStaff))
      .map((member) => member.staffId)
      .filter((id) => id !== except);
    if (recipients.length === 0) return;
    await gateway.send(recipients, input, AbortSignal.timeout(SEND_TIMEOUT_MS));
  } catch (error) {
    console.error("Notification could not be sent", error);
  }
}

/** The bell's reads and writes, for the signed-in Staff member only. */
export function listNotifications(staff: Staff, limit = 20, { gateway = notificationGateway }: Deps = {}): Promise<NotificationRecord[]> {
  return gateway.list(staff.id, { limit });
}

export function countUnreadNotifications(staff: Staff, { gateway = notificationGateway }: Deps = {}): Promise<number> {
  return gateway.countUnread(staff.id);
}

export function markNotificationRead(staff: Staff, id: string, { gateway = notificationGateway }: Deps = {}): Promise<void> {
  return gateway.markRead(staff.id, id);
}

export function markAllNotificationsRead(staff: Staff, { gateway = notificationGateway }: Deps = {}): Promise<void> {
  return gateway.markAllRead(staff.id);
}
