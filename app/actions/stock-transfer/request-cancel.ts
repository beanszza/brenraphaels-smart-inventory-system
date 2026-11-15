"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Retain existing transfer DTOs during migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput, saved } from "@/lib/stock-transfer/operations";
import { isAdminStaff, isQaStaff, isHeadCook } from "@/lib/auth-roles";

export async function cancelRequest(idInput: number, body: any = {}) {
  const staff = await requireModule("Stock Transfer");
  return mutate(staff, async (tx) => {
    if (isAdminStaff(staff) || isQaStaff(staff) || isHeadCook(staff)) {
      return refuse("Only the Inventory Manager can cancel a stock transfer request.");
    }
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

    const hasActiveTransfer = existing.StockTransfers.some(
      (st) => st.Status === "Scheduled" || st.Status === "Dispatched" || ["Completed", "Received", "In Transit"].includes(st.Status)
    );
    if (hasActiveTransfer) {
      return refuse("Cannot cancel this request because it has already been scheduled or dispatched.");
    }

    // Cancel the STR and release any lot reservations held by this request
    const updated = await (async () => {
      const items = await tx.stockTransferRequestItems.findMany({
        where: { RequestId: requestId },
      });
      for (const item of items) {
        const sLots = (item.SuggestedLots as any[]) || [];
        for (const sLot of sLots) {
          if (sLot.lotId && sLot.qty > 0) {
            const lot = await tx.inventoryLots.findUnique({ where: { LotId: sLot.lotId } });
            if (lot) {
              const currentRes = Number(lot.ReservedQuantity || 0);
              const toRelease = Math.max(0, Math.min(currentRes, Number(sLot.qty)));
              if (toRelease > 0) {
                await tx.inventoryLots.update({
                  where: { LotId: sLot.lotId },
                  data: {
                    ReservedQuantity: { decrement: toRelease },
                    Status: Number(lot.QuantityRemaining || 0) > 0 ? "Available" : lot.Status,
                  },
                });
              }
            }
          }
        }
      }

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
