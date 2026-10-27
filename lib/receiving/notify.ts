import { notifyModule, notifyStaff } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

const link = () => `${appOrigin()}/goods-receiving`;
export function notifyApprovalRequested(staff: Staff, record: string) {
  return notifyModule("Goods Receiving", {
    type: "approval-requested", title: "Approval needed", body: `${record} is waiting for approval.`, link: link(),
  }, { except: staff.id });
}

export async function notifyRequester(username: string, decision: "approved" | "rejected", record: string) {
  // Historical free-text names have no reliable Portal id and must not be guessed.
  const requester = await prisma.knownStaff.findFirst({ where: { Username: username } });
  if (!requester) return;
  await notifyStaff(requester.StaffId, {
    type: `request-${decision}`, title: decision === "approved" ? "Request approved" : "Request rejected",
    body: `${record} was ${decision}.`, link: link(),
  });
}
