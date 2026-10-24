"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Retain existing transfer DTOs during migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput, saved } from "@/lib/stock-transfer/operations";
export async function cancelRequest(idInput: number, body: any = {}) {
  const staff = await requireModule("Stock Transfer");
  return mutate(staff, async (tx) => {
validateInput(body);
    const requestId = positiveId(idInput);
    if (isNaN(requestId)) {
      return refuse("Invalid request ID.");
    }
    const { reason = "Cancelled by user" } = body;

    const existing = await tx.stockTransferRequests.findUnique({
      where: { RequestId: requestId },
      include: {
        StockTransfers: true,
      },
    });

    if (!existing) {
      return refuse("Stock transfer request not found.");
    }

    if (!["Pending Approval", "Approved"].includes(existing.Status)) {
      return refuse(`Cannot cancel a request that is in '${existing.Status}' status. Only Pending Approval or Approved requests can be cancelled.`);
    }

    const hasDispatchedTransfer = existing.StockTransfers.some(
      (st) => st.Status === "Dispatched" || ["Completed", "Received", "In Transit"].includes(st.Status)
    );
    if (hasDispatchedTransfer) {
      return refuse("Cannot cancel this request because one or more associated transfers have already been dispatched.");
    }

    // Cancel the STR and any Scheduled transfers
    const updated = await (async () => {
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
    })();

    return saved(staff, "stock-transfer-request", updated.RequestId, updated.RequestNumber || String(updated.RequestId), "updated", resourceResult({
      success: true,
      message: "Stock transfer request and associated scheduled transfers cancelled successfully.",
      data: {
        requestId: updated.RequestId,
        status: updated.Status,
      },
    }));

  });
}
