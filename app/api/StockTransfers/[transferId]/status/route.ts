import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedPosRequest } from "@/lib/pos/auth";
import { ensureBranchRequestColumns } from "@/lib/stock-transfer/ensure-branch-request-tables";

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
    await ensureBranchRequestColumns();
    const { transferId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const newStatus = body.status || "Completed";

    const transfer = await prisma.stockTransfers.findFirst({
      where: {
        OR: [
          { TransferNumber: transferId },
          { StockTransferRequests: { RequestNumber: transferId } },
          !isNaN(Number(transferId)) ? { TransferId: Number(transferId) } : {},
        ],
      },
      include: {
        StockTransferRequests: { select: { RequestId: true, BranchRequestId: true } },
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

    if (transfer.RequestId && ["Completed", "Received"].includes(newStatus)) {
      await prisma.stockTransfers.updateMany({
        where: {
          RequestId: transfer.RequestId,
          Status: { in: ["Dispatched", "In Transit"] },
        },
        data: { Status: "Completed" },
      });
      await prisma.stockTransferRequests.update({
        where: { RequestId: transfer.RequestId },
        data: { Status: "Completed" },
      });
    }

    // Backup closure path (§3.4 & §6.5): when POS reconciliation retries via PUT /status = Completed
    if (["Completed", "Received"].includes(newStatus)) {
      const linkedBranchReqId =
        transfer.BranchRequestId ?? transfer.StockTransferRequests?.BranchRequestId ?? null;
      if (linkedBranchReqId) {
        const brItems = await prisma.branchRequestItems.findMany({
          where: { BranchRequestId: linkedBranchReqId },
        });
        for (const item of brItems) {
          if (item.ProductId === transfer.ProductId && Number(item.ReceivedQuantity) === 0) {
            await prisma.branchRequestItems.update({
              where: { BranchRequestItemId: item.BranchRequestItemId },
              data: { ReceivedQuantity: { increment: Number(transfer.TransferQuantity || 0) } },
            });
          }
        }
        const refreshed = await prisma.branchRequestItems.findMany({
          where: { BranchRequestId: linkedBranchReqId },
        });
        const allReceived =
          refreshed.length > 0 &&
          refreshed.every((i) => {
            const target = Number(i.ApprovedQuantity) > 0 ? Number(i.ApprovedQuantity) : Number(i.RequestedQuantity);
            return Number(i.ReceivedQuantity) >= target;
          });
        if (allReceived) {
          await prisma.branchRequests.update({
            where: { BranchRequestId: linkedBranchReqId },
            data: { Status: "Fulfilled", FulfilledAt: new Date() },
          });
        }
      }
    }

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

