import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const access = await requireRouteModule(request, "Stock Transfer");
  if (!access.ok) return access.response;

  try {
    const params = await props.params;
    const userRole = request.headers.get("x-user-role")?.toLowerCase();
    if (userRole === "admin") {
      return NextResponse.json(
        { success: false, message: "Admins are not permitted to cancel stock transfer requests." },
        { status: 403 }
      );
    }

    const requestId = parseInt(params.id, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ success: false, message: "Invalid request ID." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { reason = "Cancelled by user" } = body;

    const existing = await prisma.stockTransferRequests.findUnique({
      where: { RequestId: requestId },
      include: {
        StockTransfers: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: "Stock transfer request not found." }, { status: 404 });
    }

    if (!["Pending Approval", "Approved"].includes(existing.Status)) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot cancel a request that is in '${existing.Status}' status. Only Pending Approval or Approved requests can be cancelled.`,
        },
        { status: 400 }
      );
    }

    const hasDispatchedTransfer = existing.StockTransfers.some(
      (st) => st.Status === "Dispatched" || st.Status === "Completed"
    );
    if (hasDispatchedTransfer) {
      return NextResponse.json(
        {
          success: false,
          message: "Cannot cancel this request because one or more associated transfers have already been dispatched.",
        },
        { status: 400 }
      );
    }

    // Cancel the STR and any Scheduled transfers
    const updated = await prisma.$transaction(async (tx) => {
      // Cancel pending/scheduled transfers associated with this request
      await tx.stockTransfers.updateMany({
        where: {
          RequestId: requestId,
          Status: { in: ["Pending", "Scheduled"] },
        },
        data: {
          Status: "Cancelled",
          Notes: `Parent request ${existing.RequestNumber} was cancelled.`,
        },
      });

      return await tx.stockTransferRequests.update({
        where: { RequestId: requestId },
        data: {
          Status: "Cancelled",
          AdminNotes: existing.AdminNotes ? `${existing.AdminNotes} | Cancellation reason: ${reason}` : `Cancellation reason: ${reason}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Stock transfer request and associated scheduled transfers cancelled successfully.",
      data: {
        requestId: updated.RequestId,
        status: updated.Status,
      },
    });
  } catch (error: any) {
    console.error("Error in PUT /api/stock-transfer-requests/[id]/cancel:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to cancel stock transfer request" },
      { status: 500 }
    );
  }
}
