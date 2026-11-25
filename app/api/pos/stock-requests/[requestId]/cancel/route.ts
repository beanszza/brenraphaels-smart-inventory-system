import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAuthorizedPosRequest } from "@/lib/pos/auth";
import { sendStockRequestDecisionToPos } from "@/lib/pos/client";
import { ensureBranchRequestColumns } from "@/lib/stock-transfer/ensure-branch-request-tables";
import { notifyBranchStockRequestCancelled } from "@/lib/stock-transfer/notify";

function hasAngleBrackets(value: string): boolean {
  return /[<>]/.test(value);
}

function formatUtcTime(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return ` at ${hh}:${mm} UTC`;
}

function buildAlreadyDecidedMessage(requestNumber: string, status: string, decidedAt?: Date | null): string {
  const verb =
    status === "Rejected"
      ? "rejected"
      : status === "Approved"
      ? "approved"
      : status === "In Transit" || status === "Dispatched"
      ? "dispatched"
      : status === "Fulfilled" || status === "Completed"
      ? "fulfilled"
      : status.toLowerCase();
  return `${requestNumber} was already ${verb}${formatUtcTime(decidedAt)}.`;
}

/**
 * PUT /api/pos/stock-requests/{requestId}/cancel
 * Cancels a branch stock request initiated by POS before IMS has decided (§3.6 & §6.3).
 *
 * Responses:
 * - 200: Cancelled (or already Cancelled — idempotent)
 * - 404: IMS never received this requestId (POS cancels locally & stops retrying)
 * - 409: Already approved/rejected/shipped in IMS (also triggers decision catch-up if unsynced)
 * - 400: Malformed body
 * - 401: Invalid/missing POS Bearer key
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    if (!isAuthorizedPosRequest(req)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Invalid or missing SCMS API key." },
        { status: 401 }
      );
    }

    await ensureBranchRequestColumns();

    const { requestId: rawParamId } = await context.params;
    const requestId = decodeURIComponent(String(rawParamId || "")).trim();
    if (!requestId || requestId.length > 50) {
      return NextResponse.json(
        { success: false, message: "Invalid requestId in path." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body provided." },
        { status: 400 }
      );
    }

    if (typeof body.requestId === "string" && body.requestId.trim() && body.requestId.trim() !== requestId) {
      return NextResponse.json(
        { success: false, message: "Body requestId does not match path requestId." },
        { status: 400 }
      );
    }

    const reasonRaw = body.reason;
    let reason: string | null = null;
    if (reasonRaw !== undefined && reasonRaw !== null && String(reasonRaw).trim() !== "") {
      const trimmed = String(reasonRaw).trim();
      if (trimmed.length > 500 || hasAngleBrackets(trimmed)) {
        return NextResponse.json(
          { success: false, message: "reason must be at most 500 characters and must not contain '<' or '>'." },
          { status: 400 }
        );
      }
      reason = trimmed;
    }

    const cancelledBy = typeof body.cancelledBy === "string" ? body.cancelledBy.trim() : "";
    const cancelledByName = typeof body.cancelledByName === "string" ? body.cancelledByName.trim() : "";
    if (!cancelledBy || !cancelledByName) {
      return NextResponse.json(
        { success: false, message: "cancelledBy and cancelledByName are required." },
        { status: 400 }
      );
    }

    const cancelledAtRaw = typeof body.cancelledAt === "string" ? body.cancelledAt.trim() : "";
    const cancelledAt = cancelledAtRaw ? new Date(cancelledAtRaw) : null;
    if (!cancelledAt || Number.isNaN(cancelledAt.getTime())) {
      return NextResponse.json(
        { success: false, message: "cancelledAt must be a valid ISO 8601 UTC date string." },
        { status: 400 }
      );
    }

    const existing = await prisma.branchRequests.findUnique({
      where: { RequestNumber: requestId },
      include: { BranchRequestItems: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: `Stock request ${requestId} was not found in IMS.` },
        { status: 404 }
      );
    }

    // Idempotent: already cancelled -> 200
    if (existing.Status === "Cancelled") {
      return NextResponse.json(
        { success: true, data: { requestId: existing.RequestNumber, status: "Cancelled" } },
        { status: 200 }
      );
    }

    // Atomic conditional update so a simultaneous Approve/Reject wins cleanly if it committed first
    if (existing.Status === "Submitted" || existing.Status === "Pending") {
      const updated = await prisma.branchRequests.updateMany({
        where: {
          BranchRequestId: existing.BranchRequestId,
          Status: { in: ["Submitted", "Pending"] },
        },
        data: {
          Status: "Cancelled",
          CancelledBy: cancelledBy,
          CancelledByName: cancelledByName,
          CancelledAt: cancelledAt,
          CancelReason: reason,
          PosSyncStatus: "Synced",
          PosSyncError: null,
        },
      });

      if (updated.count > 0) {
        try {
          revalidatePath("/branch-requests");
        } catch {
          // Safe in non-Next test runtime
        }
        await notifyBranchStockRequestCancelled(
          existing.RequestNumber,
          existing.BranchName || `Branch #${existing.BranchId}`,
          reason
        ).catch((err) => console.error("[POS-STOCK-REQUEST-CANCEL-NOTIFY-ERROR]", err));

        return NextResponse.json(
          { success: true, data: { requestId: existing.RequestNumber, status: "Cancelled" } },
          { status: 200 }
        );
      }

      // Lost race: re-read current state
      const latest = await prisma.branchRequests.findUnique({
        where: { BranchRequestId: existing.BranchRequestId },
        include: { BranchRequestItems: true },
      });
      if (latest?.Status === "Cancelled") {
        return NextResponse.json(
          { success: true, data: { requestId: latest.RequestNumber, status: "Cancelled" } },
          { status: 200 }
        );
      }
      if (latest) {
        return NextResponse.json(
          {
            success: false,
            message: buildAlreadyDecidedMessage(latest.RequestNumber, latest.Status, latest.DecidedAt),
          },
          { status: 409 }
        );
      }
    }

    // Already decided in IMS -> 409 Conflict (§3.6 & §6.3 #7)
    // If IMS decision hasn't been synced to POS yet, trigger a best-effort catch-up status push
    if (
      (existing.Status === "Approved" || existing.Status === "Rejected") &&
      existing.PosSyncStatus !== "Synced"
    ) {
      const primaryItem = existing.BranchRequestItems[0];
      const approvedQty = primaryItem ? Math.round(Number(primaryItem.ApprovedQuantity)) : 0;
      void sendStockRequestDecisionToPos(existing.RequestNumber, {
        status: existing.Status as "Approved" | "Rejected",
        ...(existing.Status === "Approved" ? { approvedQuantity: approvedQty } : {}),
        ...(existing.DecisionRemarks ? { remarks: existing.DecisionRemarks } : {}),
        imsRequestId: `br_${existing.BranchRequestId}`,
        decidedBy: existing.ApprovedBy || "ims_system",
        decidedByName: existing.DecidedByName || existing.ApprovedBy || "IMS Staff",
        decidedAt: (existing.DecidedAt || new Date()).toISOString(),
      }).then(async (syncRes) => {
        if (syncRes.success) {
          await prisma.branchRequests
            .update({
              where: { BranchRequestId: existing.BranchRequestId },
              data: { PosSyncStatus: "Synced", PosSyncError: null },
            })
            .catch(() => {});
        }
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: buildAlreadyDecidedMessage(existing.RequestNumber, existing.Status, existing.DecidedAt),
      },
      { status: 409 }
    );
  } catch (error: any) {
    console.error("[POS-STOCK-REQUEST-CANCEL-ERROR]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error processing cancellation." },
      { status: 500 }
    );
  }
}
