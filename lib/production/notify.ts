import { notifyModule, notifyStaff } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

const link = () => `${appOrigin()}/production-quality`;
export function notifyApprovalRequested(staff: Staff, record: string) {
  return notifyModule("Production & Quality", {
    type: "approval-requested", title: "Approval needed", body: `${record} is waiting for approval.`, link: link(),
  }, { except: staff.id });
}
export async function notifyRequester(username: string, decision: "approved" | "rejected", record: string) {
  const requester = await prisma.knownStaff.findFirst({ where: { Username: username } });
  if (!requester) return;
  await notifyStaff(requester.StaffId, {
    type: `request-${decision}`, title: decision === "approved" ? "Request approved" : "Request rejected",
    body: `${record} was ${decision}.`, link: link(),
  });
}
export async function notifyBatchRequester(batch: { ProdReqId: number | null; AssignedCook: string; BatchNumber: string }, decision: "approved" | "rejected") {
  const request = batch.ProdReqId ? await prisma.productionRequests.findUnique({ where: { ProdReqId: batch.ProdReqId } }) : null;
  await notifyRequester(request?.RequestedBy || batch.AssignedCook, decision, batch.BatchNumber);
}
