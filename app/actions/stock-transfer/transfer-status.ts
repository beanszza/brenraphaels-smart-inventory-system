"use server";
import { auditVersion } from "@/lib/audit";

/* eslint-disable @typescript-eslint/no-explicit-any -- Retain existing transfer DTOs during migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput, saved } from "@/lib/stock-transfer/operations";
export async function updateTransferStatus(idInput: number, body: any = {}) {
  const staff = await requireModule("Stock Transfer");
  return mutate(staff, async (tx) => {
validateInput(body);
    const id = positiveId(idInput);
    const newStatus = body.status as string;

    const transfer = await tx.stockTransfers.findUnique({ where: { TransferId: id } });
    if (!transfer) {
      return refuse("Transfer not found.");
    }

    const transitions: Record<string, string[]> = {
      Dispatched: ["In Transit", "Received", "Completed"],
      "In Transit": ["Received", "Completed"],
    };
    if (!transitions[transfer.Status]?.includes(newStatus)) refuse("Invalid transfer status transition. Dispatch scheduled transfers through dispatch.");
    const updateData: any = { Status: newStatus };
    if (newStatus === "Dispatched") updateData.DispatchedDate = new Date();
    if (["Received", "Completed"].includes(newStatus)) {
      updateData.ReceivedDate = new Date();
      updateData.ReceivedBy = staff.username;
    }

    const updated = await tx.stockTransfers.update({
      where: { TransferId: id },
      data: updateData,
    });

    if (["Received", "Completed"].includes(newStatus) && transfer.RequestId) {
      const remainingIncomplete = await tx.stockTransfers.count({
        where: {
          RequestId: transfer.RequestId,
          Status: { notIn: ["Received", "Completed", "Cancelled"] },
          TransferId: { not: id },
        },
      });
      if (remainingIncomplete === 0) {
        await tx.stockTransferRequests.update({
          where: { RequestId: transfer.RequestId },
          data: { Status: "Completed" },
        });
      }
    }

    return saved(staff, "stock-transfer", updated.TransferId, updated.TransferNumber || String(updated.TransferId), ["Received", "Completed"].includes(newStatus) ? "stock_transfer.received" : "record.updated", resourceResult({ success: true, data: { transferId: updated.TransferId, status: updated.Status } }));

  }, { module: "Stock Transfer", action: "record.updated", target: { type: "operation", id: String(idInput), name: "updateTransferStatus" }, description: "Validation refused for updateTransferStatus", version: auditVersion([idInput, body]) });
}
