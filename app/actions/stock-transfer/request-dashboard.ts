"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/stock-transfer/operations";
export async function requestDashboard() {
  await requireModule("Stock Transfer");
  return read(async () => {

    const [totalRequests, pendingApproval, approvedRequests, dispatchedTransfers, scheduledTransfers] =
      await Promise.all([
        prisma.stockTransferRequests.count(),
        prisma.stockTransferRequests.count({ where: { Status: "Pending Approval" } }),
        prisma.stockTransferRequests.count({ where: { Status: "Approved" } }),
        prisma.stockTransfers.count({ where: { Status: { in: ["Dispatched", "In Transit"] } } }),
        prisma.stockTransfers.count({ where: { Status: "Scheduled" } }),
      ]);

    return resourceResult({
      success: true,
      data: {
        totalRequests,
        pendingApproval,
        approvedRequests,
        dispatchedTransfers,
        scheduledTransfers,
      },
    });

  });
}
