"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Retain existing transfer DTOs during migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput, saved } from "@/lib/stock-transfer/operations";
import { notifyRequester } from "@/lib/stock-transfer/notify";
export async function reviewRequest(idInput: number, body: any = {}) {
  const staff = await requireModule("Stock Transfer");
  return mutate(staff, async (tx) => {
validateInput(body);
    const requestId = positiveId(idInput);
    if (isNaN(requestId)) {
      return refuse("Invalid request ID.");
    }
    const { action, adminNotes } = body;

    if (!action || !["Approve", "Reject"].includes(action)) {
      return refuse("Action must be either 'Approve' or 'Reject'.");
    }

    if (action === "Reject" && (!adminNotes || !adminNotes.trim())) {
      return refuse("Rejection remarks are required when rejecting a request.");
    }

    const existing = await tx.stockTransferRequests.findUnique({
      where: { RequestId: requestId },
    });

    if (!existing) {
      return refuse("Stock transfer request not found.");
    }

    if (existing.Status !== "Pending Approval") {
      return refuse(`Cannot change status. Request is already in '${existing.Status}' status.`);
    }

    const newStatus = action === "Approve" ? "Approved" : "Rejected";

    const updated = await tx.stockTransferRequests.update({
      where: { RequestId: requestId },
      data: {
        Status: newStatus,
        AdminNotes: adminNotes ? adminNotes.trim() : null,
        ReviewedBy: staff.username,
        ReviewedAt: new Date(),
      },
    });

    return saved(staff, "stock-transfer-request", updated.RequestId, updated.RequestNumber || String(updated.RequestId), action === "Approve" ? "approved" : "rejected", resourceResult({
      success: true,
      message: `Stock transfer request successfully ${action === "Approve" ? "approved" : "rejected"}.`,
      data: {
        requestId: updated.RequestId,
        status: updated.Status,
        adminNotes: updated.AdminNotes,
      },
    }), () => notifyRequester(existing.RequestedBy, action === "Approve" ? "approved" : "rejected", existing.RequestNumber));

  });
}
