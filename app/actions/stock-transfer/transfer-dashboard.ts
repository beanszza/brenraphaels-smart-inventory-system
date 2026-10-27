"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/stock-transfer/operations";
export async function transferDashboard() {
  await requireModule("Stock Transfer");
  return read(async () => {

    const [total, pending, dispatched, received] = await Promise.all([
      prisma.stockTransfers.count(),
      prisma.stockTransfers.count({ where: { Status: { in: ["Pending", "Scheduled"] } } }),
      prisma.stockTransfers.count({ where: { Status: { in: ["Dispatched", "In Transit"] } } }),
      prisma.stockTransfers.count({ where: { Status: { in: ["Received", "Completed"] } } }),
    ]);

    return resourceResult({
      success: true,
      data: { total, pending, dispatched, received },
    });

  });
}
