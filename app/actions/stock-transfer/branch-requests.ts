"use server";

/* eslint-disable @typescript-eslint/no-explicit-any -- Consistent with existing stock-transfer actions. */
import { prisma } from "@/lib/prisma";
import { auditVersion } from "@/lib/audit";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, mutate, refuse, positiveId, saved, safeIsoDate } from "@/lib/stock-transfer/operations";
import { isQaStaff, isHeadCook } from "@/lib/auth-roles";
import { sendStockRequestDecisionToPos } from "@/lib/pos/client";
import { computeBranchRequestAllocation } from "@/lib/stock-transfer/branch-request-math";
import { ensureBranchRequestColumns } from "@/lib/stock-transfer/ensure-branch-request-tables";
import { revalidatePath } from "next/cache";

function formatImsRequestId(branchRequestId: number): string {
  return `br_${branchRequestId}`;
}

export async function listBranchRequests(query = "") {
  await requireModule("Stock Transfer");
  await ensureBranchRequestColumns();
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "100", 10) || 100));

    const where: any = {};
    if (search) {
      where.OR = [
        { RequestNumber: { contains: search, mode: "insensitive" } },
        { BranchName: { contains: search, mode: "insensitive" } },
        { RequestedByName: { contains: search, mode: "insensitive" } },
        { Locations: { LocationName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.branchRequests.count({ where }),
      prisma.branchRequests.findMany({
        where,
        include: {
          Locations: true,
          BranchRequestItems: {
            include: {
              FinishedProducts: { include: { Items: true } },
            },
          },
          StockTransferRequests: {
            include: {
              StockTransferRequestItems: true,
              StockTransfers: {
                select: {
                  TransferId: true,
                  TransferNumber: true,
                  ProductId: true,
                  Status: true,
                  TransferQuantity: true,
                  ScheduledDate: true,
                  DispatchedDate: true,
                  ReceivedDate: true,
                },
              },
            },
            orderBy: { CreatedAt: "desc" },
          },
        },
        orderBy: { RequestDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Fetch live commissary available stock for all requested products
    const itemIds = rows
      .flatMap((r) => r.BranchRequestItems.map((i) => i.FinishedProducts?.ItemId))
      .filter((id): id is number => typeof id === "number" && id > 0);

    const activeLots = itemIds.length > 0
      ? await prisma.inventoryLots.findMany({
          where: {
            ItemId: { in: itemIds },
            Status: { in: ["Active", "Available"] },
            QuantityRemaining: { gt: 0 },
            OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
          },
        })
      : [];

    const availByItem = new Map<number, number>();
    for (const lot of activeLots) {
      const free = Math.max(0, Number(lot.QuantityRemaining) - Number(lot.ReservedQuantity || 0));
      availByItem.set(lot.ItemId, (availByItem.get(lot.ItemId) || 0) + free);
    }

    const data = rows.map((row) => {
      const allocation = computeBranchRequestAllocation(
        row.Status,
        row.BranchRequestItems,
        row.StockTransferRequests
      );

      const allocByProd = new Map(allocation.items.map((a) => [a.productId, a]));

      return {
        branchRequestId: row.BranchRequestId,
        imsRequestId: formatImsRequestId(row.BranchRequestId),
        requestNumber: row.RequestNumber,
        branchId: row.BranchId,
        branchName: row.BranchName || row.Locations?.LocationName || `Branch #${row.BranchId}`,
        requestDate: safeIsoDate(row.RequestDate) || new Date().toISOString(),
        status: row.Status,
        subtab: allocation.subtab,
        transferStage: allocation.transferStage,
        requestedBy: row.RequestedBy,
        requestedByName: row.RequestedByName || row.RequestedBy,
        notes: row.Notes || "",
        decidedBy: row.ApprovedBy || null,
        decidedByName: row.DecidedByName || row.ApprovedBy || null,
        decidedAt: safeIsoDate(row.DecidedAt),
        decisionRemarks: row.DecisionRemarks || "",
        fulfilledAt: safeIsoDate(row.FulfilledAt),
        posSyncStatus: row.PosSyncStatus || "Synced",
        posSyncError: row.PosSyncError || null,
        posManifestLinked: Boolean(row.PosManifestLinked),
        totalRequested: allocation.totalRequested,
        totalApproved: allocation.totalApproved,
        totalAllocated: allocation.totalAllocated,
        totalRemaining: allocation.totalRemaining,
        totalScheduled: allocation.totalScheduled,
        totalDispatched: allocation.totalDispatched,
        totalReceived: allocation.totalReceived,
        items: row.BranchRequestItems.map((it) => {
          const itemAlloc = allocByProd.get(it.ProductId);
          const imsAvailableStock = it.FinishedProducts?.ItemId
            ? availByItem.get(it.FinishedProducts.ItemId) || 0
            : 0;
          return {
            branchRequestItemId: it.BranchRequestItemId,
            productId: it.ProductId,
            sku: it.Sku || it.FinishedProducts?.Sku || "",
            productName: it.ProductName || it.FinishedProducts?.Items?.ItemName || "Finished Product",
            variationName: it.VariationName || it.FinishedProducts?.Variant || "",
            branchCurrentStock: Number(it.BranchCurrentStock || 0),
            imsAvailableStock,
            requestedQuantity: Number(it.RequestedQuantity || 0),
            approvedQuantity: Number(it.ApprovedQuantity || 0),
            allocatedQuantity: itemAlloc?.allocatedQuantity ?? 0,
            remainingQuantity: itemAlloc?.remainingQuantity ?? 0,
            scheduledQuantity: itemAlloc?.scheduledQuantity ?? 0,
            dispatchedQuantity: itemAlloc?.dispatchedQuantity ?? Number(it.DispatchedQuantity || 0),
            receivedQuantity: itemAlloc?.receivedQuantity ?? Number(it.ReceivedQuantity || 0),
          };
        }),
        linkedStrs: row.StockTransferRequests.map((str) => {
          const qty = str.StockTransferRequestItems.reduce((sum, i) => sum + Number(i.RequestedQuantity || 0), 0);
          const nonCancelled = (str.StockTransfers || []).filter((t) => t.Status !== "Cancelled");
          const hasCompleted =
            nonCancelled.length > 0 &&
            nonCancelled.every((t) => t.Status === "Completed" || t.Status === "Received");
          const hasDispatched = nonCancelled.some((t) => t.Status === "Dispatched" || t.Status === "In Transit");
          const hasScheduled = nonCancelled.some((t) => t.Status === "Scheduled");
          let effectiveStatus = str.Status;
          if (hasCompleted) effectiveStatus = "Completed";
          else if (hasDispatched && !hasScheduled && (str.Status === "Approved" || str.Status === "Scheduled")) {
            effectiveStatus = "Dispatched";
          } else if (hasScheduled && str.Status === "Approved") {
            effectiveStatus = "Scheduled";
          }
          return {
            requestId: str.RequestId,
            requestNumber: str.RequestNumber,
            status: effectiveStatus,
            quantity: qty,
            createdAt: safeIsoDate(str.CreatedAt) || new Date().toISOString(),
          };
        }),
      };
    });

    return resourceResult({
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  });
}

export async function reviewBranchRequest(
  idInput: number,
  body: { action?: string; approvedQuantity?: number; remarks?: string } = {}
) {
  const staff = await requireModule("Stock Transfer");
  await ensureBranchRequestColumns();
  let posCallback: (() => Promise<{
    success: boolean;
    status: number;
    message: string;
    conflict?: boolean;
  }>) | null = null;
  let updatedBranchReqId: number | null = null;

  const result = await mutate(
    staff,
    async (tx) => {
      if (isQaStaff(staff) || isHeadCook(staff)) {
        return refuse("Only Admin or Inventory Manager can approve or reject branch stock requests.");
      }

      const branchRequestId = positiveId(idInput);
      const action = body.action === "Approve" || body.action === "Reject" ? body.action : null;
      if (!action) {
        return refuse("Action must be either 'Approve' or 'Reject'.");
      }

      const remarks = typeof body.remarks === "string" ? body.remarks.trim() : "";
      if (remarks.length > 500 || /[<>]/.test(remarks)) {
        return refuse("Remarks must be at most 500 characters and cannot contain '<' or '>'.");
      }
      if (action === "Reject" && !remarks) {
        return refuse("Rejection remarks are required when rejecting a branch stock request.");
      }

      const existing = await tx.branchRequests.findUnique({
        where: { BranchRequestId: branchRequestId },
        include: { BranchRequestItems: true },
      });

      if (!existing) {
        return refuse("Branch stock request not found.");
      }
      if (existing.Status !== "Submitted" && existing.Status !== "Pending") {
        return refuse(`Cannot review this request because it is already '${existing.Status}'.`);
      }

      const primaryItem = existing.BranchRequestItems[0];
      if (!primaryItem) {
        return refuse("Branch stock request has no items.");
      }
      const requestedQty = Math.round(Number(primaryItem.RequestedQuantity));

      let approvedQty = 0;
      if (action === "Approve") {
        const candidateQty =
          body.approvedQuantity !== undefined && body.approvedQuantity !== null
            ? Number(body.approvedQuantity)
            : requestedQty;
        if (!Number.isInteger(candidateQty) || candidateQty < 1 || candidateQty > requestedQty) {
          return refuse(`Approved quantity must be a whole number between 1 and ${requestedQty}.`);
        }
        approvedQty = candidateQty;
      }

      const decidedAt = new Date();
      const decidedBy = staff.id || staff.username;
      const decidedByName = staff.name?.trim() || staff.username;
      const newStatus = action === "Approve" ? "Approved" : "Rejected";

      await tx.branchRequests.update({
        where: { BranchRequestId: branchRequestId },
        data: {
          Status: newStatus,
          ApprovedBy: decidedBy,
          DecidedByName: decidedByName,
          DecidedAt: decidedAt,
          DecisionRemarks: remarks || null,
          PosSyncStatus: "Pending",
          PosSyncError: null,
        },
      });

      if (action === "Approve") {
        // Apply approved quantity to primary item (and full requested qty if multi-item in future)
        await tx.branchRequestItems.update({
          where: { BranchRequestItemId: primaryItem.BranchRequestItemId },
          data: { ApprovedQuantity: approvedQty },
        });
      }

      updatedBranchReqId = branchRequestId;
      const requestNumber = existing.RequestNumber;
      posCallback = () =>
        sendStockRequestDecisionToPos(requestNumber, {
          status: newStatus,
          ...(action === "Approve" ? { approvedQuantity: approvedQty } : {}),
          ...(remarks ? { remarks } : {}),
          imsRequestId: formatImsRequestId(branchRequestId),
          decidedBy,
          decidedByName,
          decidedAt: decidedAt.toISOString(),
        });

      return saved(
        staff,
        "branch-stock-request",
        branchRequestId,
        requestNumber,
        action === "Approve" ? "stock_transfer.approved" : "stock_transfer.rejected",
        resourceResult({
          success: true,
          message:
            action === "Approve"
              ? `Branch stock request ${requestNumber} approved for ${approvedQty} units.`
              : `Branch stock request ${requestNumber} rejected.`,
          data: {
            branchRequestId,
            requestNumber,
            status: newStatus,
            approvedQuantity: action === "Approve" ? approvedQty : null,
            remarks: remarks || null,
          },
        })
      );
    },
    {
      module: "Stock Transfer",
      action: "record.updated",
      target: { type: "operation", id: String(idInput), name: "reviewBranchRequest" },
      description: "Validation refused for reviewBranchRequest",
      version: auditVersion([idInput, body]),
    }
  );

  // Sync decision back to POS after DB transaction commits
  if (result.success && posCallback && updatedBranchReqId !== null) {
    const syncRes = await (posCallback as () => Promise<{
      success: boolean;
      status: number;
      message: string;
      conflict?: boolean;
    }>)();
    const nextSyncStatus = syncRes.success
      ? "Synced"
      : syncRes.conflict
      ? "Conflict"
      : "Failed";

    await prisma.branchRequests
      .update({
        where: { BranchRequestId: updatedBranchReqId },
        data: {
          PosSyncStatus: nextSyncStatus,
          PosSyncError: syncRes.success ? null : syncRes.message,
        },
      })
      .catch((e) => console.error("[POS-SYNC-STATUS-UPDATE-ERROR]", e));

    revalidatePath("/stock-transfer");

    if (!syncRes.success) {
      return resourceResult({
        success: true,
        message: `${result.message} Note: POS sync returned ${
          syncRes.conflict ? "a conflict (409)" : "an error"
        } — ${syncRes.message}`,
        data: {
          ...(result.data || {}),
          posSyncStatus: nextSyncStatus,
          posSyncError: syncRes.message,
        },
      });
    }
  }

  return result;
}

export async function retryBranchRequestPosSync(idInput: number) {
  const staff = await requireModule("Stock Transfer");
  return read(async () => {
    if (isQaStaff(staff) || isHeadCook(staff)) {
      return refuse("Only Admin or Inventory Manager can retry POS sync.");
    }
    const branchRequestId = positiveId(idInput);
    const existing = await prisma.branchRequests.findUnique({
      where: { BranchRequestId: branchRequestId },
      include: { BranchRequestItems: true },
    });
    if (!existing) return refuse("Branch stock request not found.");
    if (existing.Status !== "Approved" && existing.Status !== "Rejected") {
      return refuse("Only Approved or Rejected requests can be synced to POS.");
    }

    const primaryItem = existing.BranchRequestItems[0];
    const approvedQty = primaryItem ? Math.round(Number(primaryItem.ApprovedQuantity)) : 0;

    const syncRes = await sendStockRequestDecisionToPos(existing.RequestNumber, {
      status: existing.Status as "Approved" | "Rejected",
      ...(existing.Status === "Approved" ? { approvedQuantity: approvedQty } : {}),
      ...(existing.DecisionRemarks ? { remarks: existing.DecisionRemarks } : {}),
      imsRequestId: formatImsRequestId(existing.BranchRequestId),
      decidedBy: existing.ApprovedBy || staff.id || staff.username,
      decidedByName: existing.DecidedByName || staff.name || staff.username,
      decidedAt: (existing.DecidedAt || new Date()).toISOString(),
    });

    const nextSyncStatus = syncRes.success ? "Synced" : syncRes.conflict ? "Conflict" : "Failed";
    await prisma.branchRequests.update({
      where: { BranchRequestId: branchRequestId },
      data: {
        PosSyncStatus: nextSyncStatus,
        PosSyncError: syncRes.success ? null : syncRes.message,
      },
    });

    revalidatePath("/stock-transfer");

    if (!syncRes.success) {
      return resourceResult({
        success: false,
        message: syncRes.message || "Failed to sync decision to POS.",
      });
    }

    return resourceResult({
      success: true,
      message: `Decision for ${existing.RequestNumber} synced to POS.`,
      data: { branchRequestId, posSyncStatus: "Synced" },
    });
  });
}
