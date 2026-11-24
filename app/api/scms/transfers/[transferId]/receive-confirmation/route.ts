import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedPosRequest } from "@/lib/pos/auth";
import { ensureBranchRequestColumns } from "@/lib/stock-transfer/ensure-branch-request-tables";

export async function POST(
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

    // Find the transfer by TransferNumber, parent RequestNumber (STR-YYYY-XXXX), or TransferId
    const transfer = await prisma.stockTransfers.findFirst({
      where: {
        OR: [
          { TransferNumber: transferId },
          { StockTransferRequests: { RequestNumber: transferId } },
          !isNaN(Number(transferId)) ? { TransferId: Number(transferId) } : {},
        ],
      },
      include: {
        FinishedProducts: true,
        StockTransferRequests: { select: { RequestId: true, BranchRequestId: true } },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { success: false, message: `Transfer "${transferId}" not found in SCMS.` },
        { status: 404 }
      );
    }

    // Idempotent: if already completed or received, acknowledge with 200
    if (transfer.Status === "Completed" && transfer.ReceivedDate) {
      return NextResponse.json({
        success: true,
        message: `Transfer "${transferId}" receipt was already acknowledged.`,
        transferId,
        status: transfer.Status,
      });
    }

    const newStatus = body.status || "Completed";

    // Build discrepancy summaries if any lines had damages or mismatch
    const discrepancies: string[] = [];
    if (Array.isArray(body.receivedProducts)) {
      for (const item of body.receivedProducts) {
        const expected = Number(item.expectedQuantity ?? 0);
        const received = Number(item.receivedQuantity ?? 0);
        const damaged = Number(item.damagedQuantity ?? 0);
        if (received !== expected || damaged > 0) {
          discrepancies.push(
            `SKU ${item.sku || "unknown"}: expected ${expected}, received ${received}, damaged ${damaged}${
              item.discrepancyReason ? ` (${item.discrepancyReason})` : ""
            }`
          );
        }
      }
    }

    const customNotes = body.notes ? String(body.notes).trim() : "";
    const discrepancyStr = discrepancies.length > 0 ? `Discrepancies: [${discrepancies.join("; ")}]` : "";
    const combinedNotes = [customNotes, discrepancyStr].filter(Boolean).join(" | ");

    await prisma.stockTransfers.update({
      where: { TransferId: transfer.TransferId },
      data: {
        Status: newStatus,
        ReceivedDate: body.receivedAt ? new Date(body.receivedAt) : new Date(),
        ReceivedBy: body.receivedByName ? String(body.receivedByName) : transfer.ReceivedBy,
        Notes: combinedNotes
          ? `${transfer.Notes ? transfer.Notes + "\n" : ""}[POS-RECEIVE]: ${combinedNotes}`
          : transfer.Notes,
      },
    });

    if (transfer.RequestId && ["Completed", "Received"].includes(newStatus)) {
      await prisma.stockTransfers.updateMany({
        where: {
          RequestId: transfer.RequestId,
          Status: { in: ["Dispatched", "In Transit"] },
        },
        data: {
          Status: "Completed",
          ReceivedDate: body.receivedAt ? new Date(body.receivedAt) : new Date(),
          ReceivedBy: body.receivedByName ? String(body.receivedByName) : transfer.ReceivedBy,
        },
      });
      await prisma.stockTransferRequests.update({
        where: { RequestId: transfer.RequestId },
        data: { Status: "Completed" },
      });
    }

    // Close / update linked POS Branch Stock Request (§3.4 & §6.5)
    // Match primarily via transferId -> BranchRequestId, with body.stockRequestId as backup.
    if (["Completed", "Received"].includes(newStatus)) {
      let linkedBranchReqId =
        transfer.BranchRequestId ?? transfer.StockTransferRequests?.BranchRequestId ?? null;

      if (!linkedBranchReqId && typeof body.stockRequestId === "string" && body.stockRequestId.trim()) {
        const byReqNum = await prisma.branchRequests.findUnique({
          where: { RequestNumber: body.stockRequestId.trim() },
          select: { BranchRequestId: true },
        });
        linkedBranchReqId = byReqNum?.BranchRequestId ?? null;
      }

      if (linkedBranchReqId) {
        const receivedAtDate = body.receivedAt ? new Date(body.receivedAt) : new Date();
        const receivedMap = new Map<string, number>();
        if (Array.isArray(body.receivedProducts)) {
          for (const rp of body.receivedProducts) {
            const skuKey = String(rp?.sku || "").trim().toLowerCase();
            const rQty = Number(rp?.receivedQuantity ?? 0);
            if (skuKey && Number.isFinite(rQty) && rQty > 0) {
              receivedMap.set(skuKey, (receivedMap.get(skuKey) || 0) + rQty);
            }
          }
        }

        const brItems = await prisma.branchRequestItems.findMany({
          where: { BranchRequestId: linkedBranchReqId },
        });

        for (const item of brItems) {
          const skuKey = String(item.Sku || "").trim().toLowerCase();
          const matchedReceived = receivedMap.get(skuKey);
          const fallbackQty =
            item.ProductId === transfer.ProductId ? Number(transfer.TransferQuantity || 0) : 0;
          const incQty = matchedReceived !== undefined ? matchedReceived : fallbackQty;
          if (incQty > 0) {
            await prisma.branchRequestItems.update({
              where: { BranchRequestItemId: item.BranchRequestItemId },
              data: { ReceivedQuantity: { increment: incQty } },
            });
          }
        }

        // Check if all approved quantities are now received across linked deliveries
        const refreshedItems = await prisma.branchRequestItems.findMany({
          where: { BranchRequestId: linkedBranchReqId },
        });
        const allReceived =
          refreshedItems.length > 0 &&
          refreshedItems.every((i) => {
            const target = Number(i.ApprovedQuantity) > 0 ? Number(i.ApprovedQuantity) : Number(i.RequestedQuantity);
            return Number(i.ReceivedQuantity) >= target;
          });

        await prisma.branchRequests.update({
          where: { BranchRequestId: linkedBranchReqId },
          data: {
            ...(allReceived ? { Status: "Fulfilled", FulfilledAt: receivedAtDate } : {}),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Transfer "${transferId}" receipt confirmed successfully in SCMS.`,
      transferId,
      status: newStatus,
    });
  } catch (error: any) {
    console.error("[POS-RECEIVE-CONFIRMATION-ERROR]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}

