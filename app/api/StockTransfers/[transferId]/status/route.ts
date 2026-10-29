import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedPosRequest } from "@/lib/pos/auth";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ transferId: string }> }
) {
  try {
    if (!isAuthorizedPosRequest(req)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Invalid or missing SCMS service key." },
        { status: 401 }
      );
    }
    const { transferId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const newStatus = body.status || "Completed";

    const transfer = await prisma.stockTransfers.findFirst({
      where: {
        OR: [
          { TransferNumber: transferId },
          !isNaN(Number(transferId)) ? { TransferId: Number(transferId) } : {},
        ],
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { success: false, message: `Transfer "${transferId}" not found in SCMS.` },
        { status: 404 }
      );
    }

    await prisma.stockTransfers.update({
      where: { TransferId: transfer.TransferId },
      data: { Status: newStatus },
    });

    return NextResponse.json({
      success: true,
      message: `Transfer "${transferId}" status updated to ${newStatus}.`,
      transferId,
      status: newStatus,
    });
  } catch (error: any) {
    console.error("[POS-STATUS-UPDATE-ERROR]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}

