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
        { success: false, message: "Admins are not permitted to cancel stock transfers." },
        { status: 403 }
      );
    }

    const transferId = parseInt(params.id, 10);
    if (isNaN(transferId)) {
      return NextResponse.json({ success: false, message: "Invalid transfer ID." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { reason = "Cancelled by user" } = body;

    const transfer = await prisma.stockTransfers.findUnique({
      where: { TransferId: transferId },
    });

    if (!transfer) {
      return NextResponse.json({ success: false, message: "Stock transfer not found." }, { status: 404 });
    }

    if (transfer.Status === "Dispatched" || transfer.Status === "Completed") {
      return NextResponse.json(
        {
          success: false,
          message: "Cannot cancel a transfer that has already been dispatched.",
        },
        { status: 400 }
      );
    }

    if (transfer.Status === "Cancelled") {
      return NextResponse.json(
        { success: false, message: "Transfer is already cancelled." },
        { status: 400 }
      );
    }

    const updated = await prisma.stockTransfers.update({
      where: { TransferId: transferId },
      data: {
        Status: "Cancelled",
        Notes: transfer.Notes ? `${transfer.Notes} | Cancellation reason: ${reason}` : `Cancellation reason: ${reason}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Stock transfer cancelled successfully.",
      data: {
        transferId: updated.TransferId,
        status: updated.Status,
      },
    });
  } catch (error: any) {
    console.error("Error in PUT /api/stock-transfers/[id]/cancel:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to cancel stock transfer" },
      { status: 500 }
    );
  }
}
