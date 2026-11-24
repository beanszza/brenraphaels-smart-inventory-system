export type BranchRequestSubtab = "requests" | "approved" | "rejected" | "completed";

export interface LinkedStrTransferLike {
  TransferId?: number;
  ProductId: number;
  Status: string;
  TransferQuantity: unknown;
}

export interface LinkedStrItemLike {
  ProductId: number;
  RequestedQuantity: unknown;
}

export interface LinkedStrLike {
  RequestId: number;
  RequestNumber: string;
  Status: string;
  StockTransferRequestItems: LinkedStrItemLike[];
  StockTransfers: LinkedStrTransferLike[];
}

export interface BranchItemAllocation {
  productId: number;
  requestedQuantity: number;
  approvedQuantity: number;
  allocatedQuantity: number;
  remainingQuantity: number;
  scheduledQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
}

export interface BranchRequestComputedSummary {
  totalRequested: number;
  totalApproved: number;
  totalAllocated: number;
  totalRemaining: number;
  totalScheduled: number;
  totalDispatched: number;
  totalReceived: number;
  subtab: BranchRequestSubtab;
  transferStage: "Unscheduled" | "Pending Schedule" | "Scheduled" | "In Transit" | "Delivered";
  items: BranchItemAllocation[];
}

const INACTIVE_STR_STATUSES = new Set(["Cancelled", "Rejected"]);
const SCHEDULED_OR_BEYOND = new Set(["Scheduled", "Dispatched", "In Transit", "Completed", "Received"]);
const DISPATCHED_OR_BEYOND = new Set(["Dispatched", "In Transit", "Completed", "Received"]);
const DELIVERED_STATUSES = new Set(["Completed", "Received"]);

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Computes live allocated, remaining, and scheduled quantities for a Branch Stock Request
 * from its linked StockTransferRequests and StockTransfers.
 *
 * Rules:
 * - Cancelled or Rejected STRs contribute 0 (their quantities are immediately released back).
 * - Cancelled individual StockTransfers under an active STR also reduce allocated quantity
 *   so cancelled transfer units immediately return to `remainingQuantity`.
 * - A request moves to `completed` once 100% of `approvedQuantity` is allocated AND has reached
 *   at least the `Scheduled` stage (Scheduled / Dispatched / In Transit / Completed / Received).
 */
export function computeBranchRequestAllocation(
  status: string,
  items: Array<{
    ProductId: number;
    RequestedQuantity: unknown;
    ApprovedQuantity: unknown;
    DispatchedQuantity?: unknown;
    ReceivedQuantity?: unknown;
  }>,
  linkedStrs: LinkedStrLike[]
): BranchRequestComputedSummary {
  const activeStrs = (linkedStrs || []).filter((s) => !INACTIVE_STR_STATUSES.has(s.Status));

  const computedItems: BranchItemAllocation[] = items.map((item) => {
    const requestedQuantity = num(item.RequestedQuantity);
    const approvedQuantity = num(item.ApprovedQuantity);
    let allocatedQuantity = 0;
    let scheduledQuantity = 0;
    let dispatchedFromTransfers = 0;
    let receivedFromTransfers = 0;

    for (const str of activeStrs) {
      const strItemQty = (str.StockTransferRequestItems || [])
        .filter((si) => si.ProductId === item.ProductId)
        .reduce((sum, si) => sum + num(si.RequestedQuantity), 0);

      if (strItemQty <= 0) continue;

      const productTransfers = (str.StockTransfers || []).filter((t) => t.ProductId === item.ProductId);
      const cancelledTransferQty = productTransfers
        .filter((t) => t.Status === "Cancelled")
        .reduce((sum, t) => sum + num(t.TransferQuantity), 0);

      const effectiveStrAllocated = Math.max(0, strItemQty - cancelledTransferQty);
      allocatedQuantity += effectiveStrAllocated;

      for (const t of productTransfers) {
        const tQty = num(t.TransferQuantity);
        if (SCHEDULED_OR_BEYOND.has(t.Status)) {
          scheduledQuantity += tQty;
        }
        if (DISPATCHED_OR_BEYOND.has(t.Status)) {
          dispatchedFromTransfers += tQty;
        }
        if (DELIVERED_STATUSES.has(t.Status)) {
          receivedFromTransfers += tQty;
        }
      }
    }

    const remainingQuantity = Math.max(0, approvedQuantity - allocatedQuantity);
    const dispatchedQuantity = Math.max(num(item.DispatchedQuantity), dispatchedFromTransfers);
    const receivedQuantity = Math.max(num(item.ReceivedQuantity), receivedFromTransfers);

    return {
      productId: item.ProductId,
      requestedQuantity,
      approvedQuantity,
      allocatedQuantity,
      remainingQuantity,
      scheduledQuantity,
      dispatchedQuantity,
      receivedQuantity,
    };
  });

  const totalRequested = computedItems.reduce((s, i) => s + i.requestedQuantity, 0);
  const totalApproved = computedItems.reduce((s, i) => s + i.approvedQuantity, 0);
  const totalAllocated = computedItems.reduce((s, i) => s + i.allocatedQuantity, 0);
  const totalRemaining = computedItems.reduce((s, i) => s + i.remainingQuantity, 0);
  const totalScheduled = computedItems.reduce((s, i) => s + i.scheduledQuantity, 0);
  const totalDispatched = computedItems.reduce((s, i) => s + i.dispatchedQuantity, 0);
  const totalReceived = computedItems.reduce((s, i) => s + i.receivedQuantity, 0);

  let subtab: BranchRequestSubtab;
  if (status === "Submitted" || status === "Pending") {
    subtab = "requests";
  } else if (status === "Rejected") {
    subtab = "rejected";
  } else if (
    totalApproved > 0 &&
    totalRemaining === 0 &&
    (totalScheduled >= totalApproved || status === "Fulfilled")
  ) {
    subtab = "completed";
  } else {
    subtab = "approved";
  }

  let transferStage: BranchRequestComputedSummary["transferStage"] = "Unscheduled";
  if (totalApproved > 0 && (totalReceived >= totalApproved || status === "Fulfilled")) {
    transferStage = "Delivered";
  } else if (totalDispatched > 0) {
    transferStage = "In Transit";
  } else if (totalScheduled > 0) {
    transferStage = "Scheduled";
  } else if (totalAllocated > 0) {
    transferStage = "Pending Schedule";
  }

  return {
    totalRequested,
    totalApproved,
    totalAllocated,
    totalRemaining,
    totalScheduled,
    totalDispatched,
    totalReceived,
    subtab,
    transferStage,
    items: computedItems,
  };
}
