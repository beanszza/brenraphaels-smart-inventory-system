import { notifyModule, notifyStaff } from "@/lib/notifications";
import { appOrigin } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";
import { prisma } from "@/lib/prisma";

const link = () => `${appOrigin()}/inventory`;

export function notifyWriteOffApprovalRequested(staff: Staff, swoNumber: string) {
  return notifyModule(
    "Inventory",
    {
      type: "approval-requested",
      title: "Stock Write-Off approval needed",
      body: `${swoNumber} is waiting for approval.`,
      link: link(),
    },
    { except: staff.id },
  );
}

export async function notifyWriteOffRequester(
  requestedBy: string,
  decision: "approved" | "rejected",
  swoNumber: string,
  actor?: Staff,
) {
  if (actor?.username === requestedBy) return;
  try {
    const requester = await prisma.knownStaff.findFirst({ where: { Username: requestedBy } });
    if (!requester) return;
    await notifyStaff(requester.StaffId, {
      type: `request-${decision}`,
      title: decision === "approved" ? "Stock Write-Off approved" : "Stock Write-Off rejected",
      body: `${swoNumber} was ${decision}.`,
      link: link(),
    });
  } catch (error) {
    console.error("Write-off notification could not be sent", error);
  }
}
