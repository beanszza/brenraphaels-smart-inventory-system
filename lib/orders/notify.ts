import { notifyModule, notifyStaff } from "@/lib/notifications";
import { appOrigin } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";
import { prisma } from "@/lib/prisma";

const link = () => `${appOrigin()}/orders-procurement`;

/** A record is waiting for approval: tell the Known Staff who hold the Module, except the sender. */
export function notifyApprovalRequested(staff: Staff, record: string) {
  return notifyModule(
    "Orders & Procurement",
    { type: "approval-requested", title: "Approval needed", body: `${record} is waiting for approval.`, link: link() },
    { except: staff.id },
  );
}

/**
 * The requester is stored as a Username, which the notification service does not know, so the
 * Portal user id comes from Known Staff. Rows from before sign-in carry free text and are skipped.
 */
export async function notifyRequester(requestedBy: string, decision: "approved" | "rejected", record: string, actor?: Staff) {
  if (actor?.username === requestedBy) return;
  try {
    const requester = await prisma.knownStaff.findFirst({ where: { Username: requestedBy } });
    if (!requester) return;
    await notifyStaff(requester.StaffId, {
      type: `request-${decision}`,
      title: decision === "approved" ? "Request approved" : "Request rejected",
      body: `${record} was ${decision}.`,
      link: link(),
    });
  } catch (error) {
    console.error("Notification could not be sent", error);
  }
}

/** What a status change calls for: an approval request goes to the Module, a decision to the requester. */
export function statusNotice(staff: Staff, record: string, requestedBy: string, status: string | null | undefined) {
  if (status?.replace(/\s/g, "") === "PendingApproval") return () => notifyApprovalRequested(staff, record);
  if (status === "Approved") return () => notifyRequester(requestedBy, "approved", record, staff);
  if (status === "Rejected") return () => notifyRequester(requestedBy, "rejected", record, staff);
  return undefined;
}

export const changeFor = (status: string | null | undefined) =>
  status === "Approved" ? "approved" : status === "Rejected" ? "rejected" : "updated";
