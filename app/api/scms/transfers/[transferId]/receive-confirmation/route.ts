import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedPosRequest } from "@/lib/pos/auth";

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

    const { transferId } = await context.params;
    const body = await req.json().catch(() => ({}));

    // Find the transfer by TransferNumber or TransferId
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

