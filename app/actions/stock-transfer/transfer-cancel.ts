"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Retain existing transfer DTOs during migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput, saved } from "@/lib/stock-transfer/operations";
export async function cancelTransfer(idInput: number, body: any = {}) {
  const staff = await requireModule("Stock Transfer");
  return mutate(staff, async (tx) => {
validateInput(body);
    const transferId = positiveId(idInput);
    if (isNaN(transferId)) {
      return refuse("Invalid transfer ID.");
    }
    const { reason = "Cancelled by user" } = body;

    const transfer = await tx.stockTransfers.findUnique({
      where: { TransferId: transferId },
    });

    if (!transfer) {
      return refuse("Stock transfer not found.");
    }

    if (transfer.Status === "Dispatched" || ["Completed", "Received", "In Transit"].includes(transfer.Status)) {
      return refuse("Cannot cancel a transfer that has already been dispatched.");
    }

    if (transfer.Status === "Cancelled") {
      return refuse("Transfer is already cancelled.");
    }

    const updated = await tx.stockTransfers.update({
      where: { TransferId: transferId },
      data: {
        Status: "Cancelled",
        Notes: transfer.Notes ? `${transfer.Notes} | Cancellation reason: ${reason}` : `Cancellation reason: ${reason}`,
      },
    });

    return saved(staff, "stock-transfer", updated.TransferId, updated.TransferNumber || String(updated.TransferId), "updated", resourceResult({
      success: true,
      message: "Stock transfer cancelled successfully.",
      data: {
        transferId: updated.TransferId,
        status: updated.Status,
      },
    }));

  });
}
