import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ transferId: string }> }
) {
  try {
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

    const newStatus = body.status || "Completed";
    const notes = body.notes || (body.discrepancyReason ? `Discrepancy: ${body.discrepancyReason}` : "");

    await prisma.stockTransfers.update({
      where: { TransferId: transfer.TransferId },
      data: {
        Status: newStatus,
        ReceivedDate: body.receivedAt ? new Date(body.receivedAt) : new Date(),
        ReceivedBy: body.receivedByName ? String(body.receivedByName) : transfer.ReceivedBy,
        Notes: notes
          ? `${transfer.Notes ? transfer.Notes + "\n" : ""}[POS-RECEIVE]: ${notes}`
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
