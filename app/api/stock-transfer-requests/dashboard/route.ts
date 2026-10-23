import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const access = await requireRouteModule(request, "Stock Transfer");
  if (!access.ok) return access.response;

  try {
    const [totalRequests, pendingApproval, approvedRequests, dispatchedTransfers, scheduledTransfers] =
      await Promise.all([
        prisma.stockTransferRequests.count(),
        prisma.stockTransferRequests.count({ where: { Status: "Pending Approval" } }),
        prisma.stockTransferRequests.count({ where: { Status: "Approved" } }),
        prisma.stockTransfers.count({ where: { Status: { in: ["Dispatched", "In Transit"] } } }),
        prisma.stockTransfers.count({ where: { Status: "Scheduled" } }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        totalRequests,
        pendingApproval,
        approvedRequests,
        dispatchedTransfers,
        scheduledTransfers,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/stock-transfer-requests/dashboard:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch dashboard metrics" },
      { status: 500 }
    );
  }
}
