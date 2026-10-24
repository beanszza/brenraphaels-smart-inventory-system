import { notifyModule, notifyStaff } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

export function stockInNotifications(module: "Inventory" | "Goods Receiving") {
  const link = () => `${appOrigin()}/${module === "Inventory" ? "inventory" : "goods-receiving"}`;
  function notifyApprovalRequested(staff: Staff, record: string) {
    return notifyModule(module, {
      type: "approval-requested", title: "Approval needed", body: `${record} is waiting for approval.`, link: link(),
    }, { except: staff.id });
  }

  async function notifyRequester(username: string, decision: "approved" | "rejected", record: string) {
    // Historical free-text names have no reliable Portal id and must not be guessed.
    const requester = await prisma.knownStaff.findFirst({ where: { Username: username } });
    if (!requester) return;
    await notifyStaff(requester.StaffId, {
      type: `request-${decision}`, title: decision === "approved" ? "Request approved" : "Request rejected",
      body: `${record} was ${decision}.`, link: link(),
    });
  }

  return { notifyApprovalRequested, notifyRequester };
}
