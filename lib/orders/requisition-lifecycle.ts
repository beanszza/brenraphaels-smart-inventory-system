import type { Prisma } from "@prisma/client";

export type PrPriority = "Low" | "Medium" | "High";

/** Map legacy priority values ("Normal", "Urgent") to the three standard tiers. */
export function normalizePrPriority(priority?: string | null): PrPriority {
  const norm = (priority ?? "").trim().toLowerCase();
  if (norm === "high" || norm === "urgent") return "High";
  if (norm === "low") return "Low";
  return "Medium";
}

export function prPriorityRank(priority?: string | null): number {
  const norm = normalizePrPriority(priority);
  if (norm === "High") return 3;
  if (norm === "Medium") return 2;
  return 1;
}

export function sortRequisitionsByPriority<T extends { priority?: string | null; prId?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rankDiff = prPriorityRank(b.priority) - prPriorityRank(a.priority);
    if (rankDiff !== 0) return rankDiff;
    return (b.prId ?? 0) - (a.prId ?? 0);
  });
}

const INACTIVE_PO_STATUSES = ["Cancelled", "Rejected", "Draft"];
const TERMINAL_OR_PRE_APPROVAL_PO_STATUSES = [
  "Draft",
  "Pending Approval",
  "PendingApproval",
  "Returned",
  "Cancelled",
  "Rejected",
];
export const CONFIRMED_GRN_STATUSES = [
  "QaCompleted",
  "PartiallyPutAway",
  "FullyPutAway",
  "Received",
];
const EPSILON = 1e-6;

/** True when a delivery shipment is still active / awaiting GRN confirmation. */
export function isDeliveryInFlight(delivery: {
  Status: string;
  GoodsReceipts?: Array<{ Status: string }>;
}): boolean {
  if (delivery.Status === "Scheduled") return true;
  if (delivery.Status === "Arrived") {
    const grns = delivery.GoodsReceipts ?? [];
    // Once a delivery has a GRN that completed QA or was rejected, its unreceived balance is closed out via GRN/discrepancies
    return !grns.some(
      (g) => CONFIRMED_GRN_STATUSES.includes(g.Status) || g.Status === "Rejected"
    );
  }
  return false;
}

/**
 * Re-evaluates a Purchase Order's received item quantities and delivery status:
 * - "Delivered": every PO line is accounted for by confirmed GRN accepted quantities + closed non-redelivery
 *   discrepancies, no deliveries/GRNs are still pending, and all discrepancies/losses/RTVs are resolved.
 * - "Partially Delivered": some quantity has been confirmed received via GRN, with remaining balance or unresolved discrepancy/delivery.
 * - "Ordered": delivery(s) or GRNs exist with 0 confirmed received quantity so far.
 * - "Approved": all deliveries/GRNs were cancelled and 0 quantity was received.
 */
export async function syncPurchaseOrderDeliveryStatus(
  tx: Prisma.TransactionClient,
  poId: number | null | undefined
): Promise<void> {
  if (!poId || poId <= 0 || !tx.purchaseOrders?.findUnique || !tx.purchaseOrders?.update) return;

  const po = await tx.purchaseOrders.findUnique({
    where: { PoId: poId },
    include: {
      PurchaseOrderItems: true,
      Deliveries: {
        include: {
          GoodsReceipts: { select: { GrnId: true, Status: true } },
        },
      },
      GoodsReceipts: {
        include: { GoodsReceiptItems: true },
      },
      Discrepancies: true,
      LossReports: true,
    },
  });

  if (!po || !Array.isArray(po.PurchaseOrderItems)) return;
  if (TERMINAL_OR_PRE_APPROVAL_PO_STATUSES.includes(po.Status)) return;

  const nonCancelledGrns = (Array.isArray(po.GoodsReceipts) ? po.GoodsReceipts : []).filter(
    (g) => g.Status !== "Cancelled"
  );
  const confirmedGrns = nonCancelledGrns.filter((g) => CONFIRMED_GRN_STATUSES.includes(g.Status));
  const finishedGrns = nonCancelledGrns.filter(
    (g) => CONFIRMED_GRN_STATUSES.includes(g.Status) || g.Status === "Rejected"
  );

  // Aggregate QA-confirmed accepted quantities from GRN line items
  const receivedByPoItem = new Map<number, number>();
  const receivedByItem = new Map<number, number>();
  for (const grn of confirmedGrns) {
    for (const gItem of Array.isArray(grn.GoodsReceiptItems) ? grn.GoodsReceiptItems : []) {
      const qty = Number(gItem.DeliveredQuantity || 0);
      if (gItem.PoItemId) {
        receivedByPoItem.set(gItem.PoItemId, (receivedByPoItem.get(gItem.PoItemId) ?? 0) + qty);
      } else {
        receivedByItem.set(gItem.ItemId, (receivedByItem.get(gItem.ItemId) ?? 0) + qty);
      }
    }
  }

  // Sync PurchaseOrderItems.ReceivedQuantity and track per-PO-item accepted qty
  const effectiveReceivedByPoItem = new Map<number, number>();
  let totalReceived = 0;
  for (const poItem of po.PurchaseOrderItems) {
    const ordered = Number(poItem.PoItemQuantity || 0);
    const direct = receivedByPoItem.get(poItem.PoItemId) ?? 0;
    const itemPool = receivedByItem.get(poItem.ItemId) ?? 0;
    const neededFromPool = Math.max(0, ordered - direct);
    const takenFromPool = Math.min(itemPool, neededFromPool);
    if (takenFromPool > 0) {
      receivedByItem.set(poItem.ItemId, itemPool - takenFromPool);
    }
    const lineReceived = direct + takenFromPool;
    effectiveReceivedByPoItem.set(poItem.PoItemId, lineReceived);
    totalReceived += lineReceived;

    if (
      tx.purchaseOrderItems?.update &&
      Math.abs(lineReceived - Number(poItem.ReceivedQuantity || 0)) > EPSILON
    ) {
      await tx.purchaseOrderItems.update({
        where: { PoItemId: poItem.PoItemId },
        data: { ReceivedQuantity: lineReceived },
      });
    }
  }

  const activeDeliveries = (Array.isArray(po.Deliveries) ? po.Deliveries : []).filter(
    (d) => d.Status !== "Cancelled"
  );
  const hasPendingDeliveryOrGrn =
    activeDeliveries.some((d) => isDeliveryInFlight(d)) ||
    nonCancelledGrns.some((g) => g.Status === "Draft" || g.Status === "QaPending");

  const discrepancies = Array.isArray(po.Discrepancies) ? po.Discrepancies : [];
  const hasUnresolvedDiscrepancy = discrepancies.some(
    (d) => d.Status !== "Resolved" && d.Status !== "Closed"
  );
  const hasUnacknowledgedLoss = (Array.isArray(po.LossReports) ? po.LossReports : []).some(
    (l) => !l.IsAcknowledged
  );

  let hasPendingRtv = false;
  const rtvIds = discrepancies
    .map((d) => d.RtvId)
    .filter((id): id is number => typeof id === "number" && id > 0);
  if (rtvIds.length > 0 && tx.returnToVendors?.findMany) {
    const rtvs = await tx.returnToVendors.findMany({
      where: { RtvId: { in: rtvIds } },
      select: { Status: true },
    });
    hasPendingRtv = rtvs.some((r) => ["Draft", "PendingApproval"].includes(r.Status));
  }

  // Resolved non-redelivery discrepancy quantities per item (CloseRemaining, LossReport, ReturnToSupplier, etc.)
  const closedDiscByItem = new Map<number, number>();
  for (const d of discrepancies) {
    if (
      (d.Status === "Resolved" || d.Status === "Closed") &&
      d.ResolutionType !== "NewDelivery"
    ) {
      closedDiscByItem.set(
        d.ItemId,
        (closedDiscByItem.get(d.ItemId) ?? 0) + Number(d.DiscrepancyQuantity || 0)
      );
    }
  }

  let allQuantitiesAccounted = po.PurchaseOrderItems.length > 0;
  for (const poItem of po.PurchaseOrderItems) {
    const ordered = Number(poItem.PoItemQuantity || 0);
    const received = effectiveReceivedByPoItem.get(poItem.PoItemId) ?? 0;
    const availDisc = closedDiscByItem.get(poItem.ItemId) ?? 0;
    if (received + availDisc < ordered - EPSILON) {
      allQuantitiesAccounted = false;
      break;
    }
    const usedDisc = Math.max(0, Math.min(availDisc, ordered - received));
    closedDiscByItem.set(poItem.ItemId, Math.max(0, availDisc - usedDisc));
  }

  let nextPoStatus = po.Status;
  if (
    finishedGrns.length > 0 &&
    !hasPendingDeliveryOrGrn &&
    !hasUnresolvedDiscrepancy &&
    !hasUnacknowledgedLoss &&
    !hasPendingRtv &&
    allQuantitiesAccounted
  ) {
    nextPoStatus = "Delivered";
  } else if (totalReceived > EPSILON) {
    nextPoStatus = "Partially Delivered";
  } else if (activeDeliveries.length > 0 || nonCancelledGrns.length > 0) {
    nextPoStatus = "Ordered";
  } else if (po.Status === "Ordered" || po.Status === "Partially Delivered" || po.Status === "PartiallyDelivered") {
    nextPoStatus = "Approved";
  }

  if (nextPoStatus !== po.Status) {
    await tx.purchaseOrders.update({
      where: { PoId: poId },
      data: { Status: nextPoStatus },
    });
  }
}

/**
 * Re-evaluates a Purchase Requisition's lifecycle status after PO or receiving/stock-in mutations:
 * - "Closed": every PR item is covered by active POs, and every active PO has finished delivery,
 *   GRN, QA, discrepancy/loss/return resolution, and Stock-In inventory commit.
 * - "ConvertedToPO": every PR item is fully covered by active POs (no duplicate/extra PO allowed).
 * - "Approved": remaining un-ordered balance still exists.
 */
export async function syncRequisitionLifecycle(tx: Prisma.TransactionClient, prId: number): Promise<void> {
  if (!prId || prId <= 0) return;

  const pr = await tx.purchaseRequisitions.findUnique({
    where: { PrId: prId },
    include: { PurchaseRequisitionItems: true },
  });
  if (!pr || !Array.isArray(pr.PurchaseRequisitionItems) || pr.PurchaseRequisitionItems.length === 0) return;
  if (!["Approved", "ConvertedToPO", "Closed"].includes(pr.Status)) return;

  const activeOrders = await tx.purchaseOrders.findMany({
    where: {
      OR: [{ PrId: prId }, { PurchaseRequisitionPrId: prId }],
      Status: { notIn: INACTIVE_PO_STATUSES },
    },
    include: {
      PurchaseOrderItems: true,
      Deliveries: {
        include: {
          GoodsReceipts: {
            include: {
              GoodsReceiptItems: true,
              StockIns: { include: { StockInLines: true } },
            },
          },
        },
      },
      GoodsReceipts: {
        include: {
          GoodsReceiptItems: true,
          StockIns: { include: { StockInLines: true } },
        },
      },
      Discrepancies: true,
      LossReports: true,
    },
  });

  if (!Array.isArray(activeOrders) || activeOrders.length === 0) {
    if (pr.Status === "ConvertedToPO" || pr.Status === "Closed") {
      await tx.purchaseRequisitions.update({
        where: { PrId: prId },
        data: { Status: "Approved", UpdatedAt: new Date() },
      });
    }
    return;
  }

  // 1. Check whether every PR line's requested quantity is covered by active POs
  const orderedByItem = new Map<number, number>();
  for (const ord of activeOrders) {
    for (const poItem of ord.PurchaseOrderItems ?? []) {
      orderedByItem.set(poItem.ItemId, (orderedByItem.get(poItem.ItemId) ?? 0) + Number(poItem.PoItemQuantity));
    }
  }

  const allPrItemsCovered = pr.PurchaseRequisitionItems.every((prItem) => {
    const ordered = orderedByItem.get(prItem.ItemId) ?? 0;
    return ordered >= Number(prItem.RequestedQuantity) - EPSILON;
  });

  if (!allPrItemsCovered) {
    if (pr.Status !== "Approved") {
      await tx.purchaseRequisitions.update({
        where: { PrId: prId },
        data: { Status: "Approved", UpdatedAt: new Date() },
      });
    }
    return;
  }

  // 2. Check whether all active POs have completed Delivery -> GRN -> QA -> Discrepancy/Loss -> Stock-In
  const isAllFinished = await checkOrdersLifecycleCompleted(tx, activeOrders);
  const nextStatus = isAllFinished ? "Closed" : "ConvertedToPO";

  if (pr.Status !== nextStatus) {
    await tx.purchaseRequisitions.update({
      where: { PrId: prId },
      data: { Status: nextStatus, UpdatedAt: new Date() },
    });
  }
}

async function checkOrdersLifecycleCompleted(
  tx: Prisma.TransactionClient,
  activeOrders: Array<{
    PoId: number;
    Status: string;
    PurchaseOrderItems?: Array<{ PoItemId: number; ItemId: number; PoItemQuantity: unknown }>;
    Deliveries?: Array<{ DeliveryId: number; Status: string; GoodsReceipts?: Array<{ GrnId: number; Status: string }> }>;
    GoodsReceipts?: Array<{
      GrnId: number;
      Status: string;
      GoodsReceiptItems?: Array<{ GrnItemId: number; PoItemId: number; ItemId: number; DeliveredQuantity: unknown }>;
      StockIns?: Array<{
        StockInId: number;
        Status: string;
        StockInLines?: Array<{ GrnItemId: number | null; ItemId: number; QuantityToStock: unknown; CommittedToInventory: boolean }>;
      }>;
    }>;
    Discrepancies?: Array<{
      DiscrepancyId: number;
      ItemId: number;
      DiscrepancyQuantity: unknown;
      Status: string;
      ResolutionType: string | null;
      RtvId: number | null;
      LossReportId: number | null;
    }>;
    LossReports?: Array<{ LossReportId: number; IsAcknowledged: boolean }>;
  }>
): Promise<boolean> {
  for (const po of activeOrders) {
    if (["Draft", "Pending Approval", "PendingApproval", "Returned"].includes(po.Status)) {
      return false;
    }

    const deliveries = (po.Deliveries ?? []).filter((d) => d.Status !== "Cancelled");
    if (deliveries.length === 0) return false;
    if (deliveries.some((d) => d.Status === "Scheduled")) return false;

    const grns = (po.GoodsReceipts ?? []).filter((g) => g.Status !== "Cancelled");
    if (grns.length === 0) return false;

    // Every arrived/received delivery must have at least one non-cancelled GRN
    for (const del of deliveries) {
      const delGrns = (del.GoodsReceipts ?? []).filter((g) => g.Status !== "Cancelled");
      if (delGrns.length === 0) return false;
    }

    // No GRN may still be Draft, QaPending, QaCompleted, or PartiallyPutAway
    for (const grn of grns) {
      if (grn.Status !== "FullyPutAway" && grn.Status !== "Rejected") {
        return false;
      }
      const stockIns = (grn.StockIns ?? []).filter((s) => s.Status !== "Rejected");
      if (stockIns.some((s) => s.Status !== "Committed")) {
        return false;
      }
      // If GRN is FullyPutAway, ensure at least one committed StockIn exists
      if (grn.Status === "FullyPutAway" && stockIns.length === 0) {
        return false;
      }
    }

    // Discrepancies must all be resolved/closed
    const discrepancies = po.Discrepancies ?? [];
    if (discrepancies.some((d) => d.Status !== "Resolved" && d.Status !== "Closed")) {
      return false;
    }

    // Any LossReports on this PO must be acknowledged
    const losses = po.LossReports ?? [];
    if (losses.some((l) => !l.IsAcknowledged)) {
      return false;
    }

    // Any linked ReturnToVendors must not still be in Draft or PendingApproval
    const rtvIds = discrepancies.map((d) => d.RtvId).filter((id): id is number => typeof id === "number" && id > 0);
    if (rtvIds.length > 0 && tx.returnToVendors?.findMany) {
      const rtvs = await tx.returnToVendors.findMany({
        where: { RtvId: { in: rtvIds } },
        select: { Status: true },
      });
      if (rtvs.some((r) => ["Draft", "PendingApproval"].includes(r.Status))) {
        return false;
      }
    }

    // Check per-PO-item quantity accounting: committed Stock-In qty + closed non-redelivery discrepancy qty >= ordered qty
    const stockedByPoItem = new Map<number, number>();
    const stockedByItem = new Map<number, number>();
    for (const grn of grns) {
      const grnItems = grn.GoodsReceiptItems ?? [];
      for (const stockIn of (grn.StockIns ?? []).filter((s) => s.Status === "Committed")) {
        for (const sLine of stockIn.StockInLines ?? []) {
          if (!sLine.CommittedToInventory) continue;
          const qty = Number(sLine.QuantityToStock || 0);
          const matchedGrnItem = grnItems.find((g) => (sLine.GrnItemId ? g.GrnItemId === sLine.GrnItemId : g.ItemId === sLine.ItemId));
          if (matchedGrnItem?.PoItemId) {
            stockedByPoItem.set(matchedGrnItem.PoItemId, (stockedByPoItem.get(matchedGrnItem.PoItemId) ?? 0) + qty);
          } else {
            stockedByItem.set(sLine.ItemId, (stockedByItem.get(sLine.ItemId) ?? 0) + qty);
          }
        }
      }
    }

    // Resolved non-redelivery discrepancy quantities per item (e.g. CloseRemaining, LossReport, ReturnToSupplier)
    const closedDiscByItem = new Map<number, number>();
    for (const d of discrepancies) {
      if ((d.Status === "Resolved" || d.Status === "Closed") && d.ResolutionType !== "NewDelivery") {
        closedDiscByItem.set(d.ItemId, (closedDiscByItem.get(d.ItemId) ?? 0) + Number(d.DiscrepancyQuantity || 0));
      }
    }

    const poItems = po.PurchaseOrderItems ?? [];
    for (const poItem of poItems) {
      const ordered = Number(poItem.PoItemQuantity || 0);
      const stocked = (stockedByPoItem.get(poItem.PoItemId) ?? 0) + (stockedByItem.get(poItem.ItemId) ?? 0);
      const accountedDisc = closedDiscByItem.get(poItem.ItemId) ?? 0;
      if (stocked + accountedDisc < ordered - EPSILON) {
        return false;
      }
      // Consume shared item-level allowances so multiple lines of same item aren't double-counted
      if (stockedByItem.has(poItem.ItemId)) {
        stockedByItem.set(poItem.ItemId, Math.max(0, (stockedByItem.get(poItem.ItemId) ?? 0) - Math.max(0, ordered - (stockedByPoItem.get(poItem.PoItemId) ?? 0))));
      }
      const usedDisc = Math.max(0, Math.min(accountedDisc, ordered - stocked));
      closedDiscByItem.set(poItem.ItemId, Math.max(0, accountedDisc - usedDisc));
    }
  }

  return true;
}

export async function syncRequisitionLifecycleByPoId(tx: Prisma.TransactionClient, poId: number | null | undefined): Promise<void> {
  if (!poId || poId <= 0 || !tx.purchaseOrders?.findUnique) return;
  await syncPurchaseOrderDeliveryStatus(tx, poId);
  const po = await tx.purchaseOrders.findUnique({
    where: { PoId: poId },
    select: { PrId: true, PurchaseRequisitionPrId: true },
  });
  const prId = po?.PrId ?? po?.PurchaseRequisitionPrId;
  if (prId) await syncRequisitionLifecycle(tx, prId);
}

export async function syncRequisitionLifecycleByGrnId(tx: Prisma.TransactionClient, grnId: number | null | undefined): Promise<void> {
  if (!grnId || grnId <= 0 || !tx.goodsReceipts?.findUnique) return;
  const grn = await tx.goodsReceipts.findUnique({
    where: { GrnId: grnId },
    select: { PoId: true },
  });
  if (grn?.PoId) await syncRequisitionLifecycleByPoId(tx, grn.PoId);
}

