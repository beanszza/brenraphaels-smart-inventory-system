import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const requestId = parseInt(params.id, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ success: false, message: "Invalid request ID." }, { status: 400 });
    }

    const body = await request.json();
    const { action, adminNotes, reviewedBy = "Admin" } = body;

    if (!action || !["Approve", "Reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Action must be either 'Approve' or 'Reject'." },
        { status: 400 }
      );
    }

    if (action === "Reject" && (!adminNotes || !adminNotes.trim())) {
      return NextResponse.json(
        { success: false, message: "Rejection remarks are required when rejecting a request." },
        { status: 400 }
      );
    }

    const existing = await prisma.stockTransferRequests.findUnique({
      where: { RequestId: requestId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: "Stock transfer request not found." }, { status: 404 });
    }

    if (existing.Status !== "Pending Approval") {
      return NextResponse.json(
        { success: false, message: `Cannot change status. Request is already in '${existing.Status}' status.` },
        { status: 400 }
      );
    }

    const newStatus = action === "Approve" ? "Approved" : "Rejected";

    const updated = await prisma.stockTransferRequests.update({
      where: { RequestId: requestId },
      data: {
        Status: newStatus,
        AdminNotes: adminNotes ? adminNotes.trim() : null,
        ReviewedBy: reviewedBy,
        ReviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Stock transfer request successfully ${action === "Approve" ? "approved" : "rejected"}.`,
      data: {
        requestId: updated.RequestId,
        status: updated.Status,
        adminNotes: updated.AdminNotes,
      },
    });
  } catch (error: any) {
    console.error("Error in PUT /api/stock-transfer-requests/[id]/status:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update stock transfer request status" },
      { status: 500 }
    );
  }
}
