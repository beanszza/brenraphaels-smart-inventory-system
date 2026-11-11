"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import type { AuditAction } from "@/lib/audit";
import { resourceResult } from "@/lib/resources/result";
import { PR_INCLUDE, prDto, resolveStaffName } from "@/lib/orders/dto";
import type { RequisitionInput, StatusInput } from "@/lib/orders/inputs";
import { fail, mutate, read } from "@/lib/orders/mutate";
import { changeFor, notifyApprovalRequested, statusNotice } from "@/lib/orders/notify";
import { normalizePrPriority, sortRequisitionsByPriority } from "@/lib/orders/requisition-lifecycle";

const MODULE = "Orders & Procurement";
const STATUSES = ["Draft", "PendingApproval", "Approved", "Rejected", "Returned", "ConvertedToPO", "Cancelled", "Closed"];

const target = (pr: { PrId: number; PrNumber: string }) => ({ type: "purchase-requisition", id: pr.PrId, name: pr.PrNumber });

/** Lines must be present and unique per item before anything is written. */
function lineProblem(items: RequisitionInput["items"] | undefined) {
  if (!items || items.length === 0) return "Requisition must contain at least one item.";
  if (new Set(items.map((i) => i.itemId)).size !== items.length) {
    return "Duplicate ingredient detected. Please consolidate duplicate lines before proceeding.";
  }
  return undefined;
}

const lineData = (items: RequisitionInput["items"]) =>
  items.map((i) => ({
    ItemId: i.itemId,
    SuggestedSupplierId: i.suggestedSupplierId || null,
    RequestedQuantity: i.requestedQuantity,
    PurchaseUomId: i.purchaseUomId,
    EstimatedUnitPrice: i.estimatedUnitPrice || 0,
  }));

const estimate = (items: RequisitionInput["items"]) =>
  items.reduce((sum, i) => sum + Number(i.requestedQuantity) * Number(i.estimatedUnitPrice || 0), 0);

export async function listRequisitions(status = "All") {
  await requireModule(MODULE);
  return read(async () => {
    const where: Prisma.PurchaseRequisitionsWhereInput = status !== "All" ? { Status: status } : {};
    const prs = await prisma.purchaseRequisitions.findMany({ where, orderBy: { PrId: "desc" }, include: PR_INCLUDE });

    if (status === "Approved" && prs.length > 0) {
      const prIds = prs.map((p) => p.PrId);
      const activeOrders = await prisma.purchaseOrders.findMany({
        where: {
          OR: [{ PrId: { in: prIds } }, { PurchaseRequisitionPrId: { in: prIds } }],
          Status: { notIn: ["Cancelled", "Rejected", "Draft"] },
        },
        include: { PurchaseOrderItems: true },
      });

      const orderedByPrAndItem = new Map<string, number>();
      for (const ord of activeOrders) {
        const pid = ord.PrId ?? ord.PurchaseRequisitionPrId;
        if (!pid) continue;
        for (const item of ord.PurchaseOrderItems) {
          const key = `${pid}:${item.ItemId}`;
          orderedByPrAndItem.set(key, (orderedByPrAndItem.get(key) ?? 0) + Number(item.PoItemQuantity));
        }
      }

      const availablePrs = prs.filter((pr) =>
        pr.PurchaseRequisitionItems.some((item) => {
          const ordered = orderedByPrAndItem.get(`${pr.PrId}:${item.ItemId}`) ?? 0;
          return Number(item.RequestedQuantity) - ordered > 0;
        })
      );

      return resourceResult({ success: true, data: sortRequisitionsByPriority(availablePrs.map((pr) => prDto(pr, true))) });
    }

    return resourceResult({ success: true, data: sortRequisitionsByPriority(prs.map((pr) => prDto(pr, true))) });
  });
}

export async function getRequisition(idInput: string | number) {
  await requireModule(MODULE);
  return read(async () => {
    const id = parseInt(String(idInput), 10);
    const pr = await prisma.purchaseRequisitions.findUnique({ where: { PrId: id }, include: PR_INCLUDE });
    if (!pr) return resourceResult({ success: false, message: `Purchase requisition ${id} not found.` });
    return resourceResult({ success: true, data: prDto(pr, true) });
  });
}

export async function createRequisition(body: RequisitionInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const problem = lineProblem(body.items);
    if (problem) return fail(problem);

    const now = new Date();
    const status = body.submitForApproval ? "PendingApproval" : "Draft";
    const year = now.getFullYear();
    const seq = await tx.documentSequences.upsert({
      where: { DocType_Year: { DocType: "PurchaseRequisition", Year: year } },
      update: { LastNumber: { increment: 1 } },
      create: { DocType: "PurchaseRequisition", Year: year, LastNumber: 1 },
    });

    const pr = await tx.purchaseRequisitions.create({
      data: {
        PrNumber: `PR-${year}-${String(seq.LastNumber).padStart(4, "0")}`,
        Department: body.department?.trim() || "Inventory",
        RequestedBy: staff.username,
        RequestDate: now,
        RequiredDate: body.requiredDate ? new Date(body.requiredDate) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        Status: status,
        RequestType: body.requestType?.trim() || "Stock Replenishment",
        Priority: normalizePrPriority(body.priority),
        Purpose: body.purpose?.trim() || "",
        Notes: body.notes || "",
        EstimatedTotalAmount: estimate(body.items),
        UpdatedAt: now,
        PurchaseRequisitionItems: { create: lineData(body.items) },
      },
      include: PR_INCLUDE,
    });

    return {
      result: resourceResult({ success: true, message: "Purchase requisition created successfully.", data: prDto(pr) }),
      audit: {
        module: MODULE, change: "created", target: target(pr),
        description: `${staff.name} created purchase requisition ${pr.PrNumber}`,
      } satisfies AuditAction,
      after: statusNotice(staff, pr.PrNumber, pr.RequestedBy, pr.Status),
    };
  });
}

export async function updateRequisition(idInput: string | number, body: RequisitionInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = parseInt(String(idInput), 10);
    const pr = await tx.purchaseRequisitions.findUnique({ where: { PrId: id } });
    if (!pr) return fail(`Purchase requisition ${id} not found.`);
    if (pr.Status !== "Draft" && pr.Status !== "Returned") {
      return fail(`Only Draft or Returned requisitions can be edited. Current status: ${pr.Status}.`);
    }
    const problem = lineProblem(body.items);
    if (problem) return fail(problem);

    await tx.purchaseRequisitionItems.deleteMany({ where: { PrId: id } });
    const updated = await tx.purchaseRequisitions.update({
      where: { PrId: id },
      data: {
        Department: body.department?.trim() || pr.Department,
        RequiredDate: body.requiredDate ? new Date(body.requiredDate) : pr.RequiredDate,
        RequestType: body.requestType?.trim() || pr.RequestType,
        Priority: body.priority ? normalizePrPriority(body.priority) : normalizePrPriority(pr.Priority),
        Purpose: body.purpose !== undefined ? (body.purpose?.trim() ?? "") : pr.Purpose,
        Notes: body.notes !== undefined ? body.notes : pr.Notes,
        EstimatedTotalAmount: estimate(body.items),
        UpdatedAt: new Date(),
        Status: body.submitForApproval ? "PendingApproval" : pr.Status,
        PurchaseRequisitionItems: { create: lineData(body.items) },
      },
      include: PR_INCLUDE,
    });

    return {
      result: resourceResult({ success: true, message: "Purchase requisition updated successfully.", data: prDto(updated) }),
      audit: {
        module: MODULE, change: "updated", target: target(updated),
        description: `${staff.name} updated purchase requisition ${updated.PrNumber}`,
      } satisfies AuditAction,
      after: body.submitForApproval ? () => notifyApprovalRequested(staff, updated.PrNumber) : undefined,
    };
  });
}

/** Approving, rejecting, returning or cancelling: the status moves and the right people hear of it. */
export async function setRequisitionStatus(idInput: string | number, body: StatusInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = parseInt(String(idInput), 10);
    const pr = await tx.purchaseRequisitions.findUnique({ where: { PrId: id } });
    if (!pr) return fail(`Purchase requisition ${id} not found.`);
    if (!body.status || !STATUSES.includes(body.status)) {
      return fail(`Invalid status '${body.status}'. Allowed: ${STATUSES.join(", ")}.`);
    }

    const note = body.adminNotes?.trim() || body.comments?.trim();
    const updated = await tx.purchaseRequisitions.update({
      where: { PrId: id },
      data: { Status: body.status, UpdatedAt: new Date(), ...(note ? { AdminNotes: note } : {}) },
      include: PR_INCLUDE,
    });

    const change = changeFor(body.status);
    return {
      result: resourceResult({ success: true, message: `Requisition status updated to ${body.status}.`, data: prDto(updated) }),
      audit: {
        module: MODULE, change, target: target(updated),
        description: `${staff.name} ${change === "updated" ? `set purchase requisition ${updated.PrNumber} to ${body.status}` : `${change} purchase requisition ${updated.PrNumber}`}`,
      } satisfies AuditAction,
      after: statusNotice(staff, updated.PrNumber, updated.RequestedBy, body.status),
    };
  });
}

/** One Purchase Order per supplier for an Approved requisition. */
export async function convertRequisitionToOrders(idInput: string | number) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = parseInt(String(idInput), 10);
    const pr = await tx.purchaseRequisitions.findUnique({
      where: { PrId: id },
      include: { PurchaseRequisitionItems: { include: { Items: true, SuggestedSuppliers: true, UnitOfMeasures: true } } },
    });
    if (!pr) return fail(`Purchase requisition ${id} not found.`);
    if (pr.Status !== "Approved") {
      return fail(`Only Approved requisitions can be converted to Purchase Orders. Current status: ${pr.Status}.`);
    }

    const bySupplier = new Map<number, typeof pr.PurchaseRequisitionItems>();
    for (const item of pr.PurchaseRequisitionItems) {
      let supplierId: number | null = item.SuggestedSupplierId && item.SuggestedSupplierId > 0 ? item.SuggestedSupplierId : null;
      if (!supplierId) {
        const vendor =
          (await tx.supplierItems.findFirst({ where: { ItemId: item.ItemId, IsPreferred: true, IsActive: true } })) ??
          (await tx.supplierItems.findFirst({ where: { ItemId: item.ItemId, IsActive: true } }));
        if (!vendor) {
          return fail(`Item '${item.Items?.ItemName || item.ItemId}' has no registered supplier in catalog. Please specify a supplier.`);
        }
        supplierId = vendor.SupplierId;
      }
      bySupplier.set(supplierId, [...(bySupplier.get(supplierId) ?? []), item]);
    }

    const year = new Date().getFullYear();
    const generated: { poId: number; poNumber: string; supplierName: string; totalAmount: number }[] = [];
    for (const [supplierId, items] of bySupplier) {
      const seq = await tx.documentSequences.upsert({
        where: { DocType_Year: { DocType: "PurchaseOrder", Year: year } },
        update: { LastNumber: { increment: 1 } },
        create: { DocType: "PurchaseOrder", Year: year, LastNumber: 1 },
      });
      const lines = items.map((i) => ({
        ItemId: i.ItemId,
        SupplierId: supplierId,
        PoItemQuantity: i.RequestedQuantity,
        TotalPrice: Number(i.EstimatedUnitPrice) * Number(i.RequestedQuantity),
        PurchaseUomId: i.PurchaseUomId,
        ReceivedQuantity: 0,
      }));
      const created = await tx.purchaseOrders.create({
        data: {
          PoNumber: `PO-${year}-${String(seq.LastNumber).padStart(4, "0")}`,
          PrId: pr.PrId,
          PurchaseRequisitionPrId: pr.PrId,
          SupplierId: supplierId,
          OrderDate: new Date(),
          ExpectedArrivalDate: pr.RequiredDate && pr.RequiredDate > new Date() ? pr.RequiredDate : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          Status: "Draft",
          PaymentType: "Terms 30 Days",
          ProofImageUrl: "",
          TotalAmount: lines.reduce((sum, l) => sum + l.TotalPrice, 0),
          RequestedBy: staff.username,
        },
        include: { Suppliers: true },
      });
      await tx.purchaseOrderItems.createMany({
        data: lines.map((l) => ({ ...l, PoId: created.PoId, PurchaseOrderPoId: created.PoId })),
      });
      generated.push({
        poId: created.PoId,
        poNumber: created.PoNumber,
        supplierName: created.Suppliers?.CompanyName || "",
        totalAmount: Number(created.TotalAmount),
      });
    }

    await tx.purchaseRequisitions.update({
      where: { PrId: id },
      data: { Status: "ConvertedToPO", UpdatedAt: new Date(), AdminNotes: `Converted to ${generated.map((g) => g.poNumber).join(", ")}` },
    });

    return {
      result: resourceResult({
        success: true,
        message: `Successfully generated ${generated.length} Purchase Orders from PR.`,
        data: { generatedPos: generated },
      }),
      audit: {
        module: MODULE, change: "updated", target: target(pr),
        description: `${staff.name} converted purchase requisition ${pr.PrNumber} to ${generated.map((g) => g.poNumber).join(", ")}`,
      } satisfies AuditAction,
    };
  });
}

/** Full end-to-end lifecycle report for a Purchase Requisition: Ordering -> Delivery -> Receiving -> Inventory. */
export async function getRequisitionLifecycleReport(idInput: string | number) {
  await requireModule(MODULE);
  return read(async () => {
    const id = parseInt(String(idInput), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return resourceResult({ success: false, message: "Invalid Purchase Requisition ID." });
    }

    const pr = await prisma.purchaseRequisitions.findUnique({
      where: { PrId: id },
      include: PR_INCLUDE,
    });
    if (!pr) {
      return resourceResult({ success: false, message: `Purchase requisition ${id} not found.` });
    }

    const orders = await prisma.purchaseOrders.findMany({
      where: { OR: [{ PrId: id }, { PurchaseRequisitionPrId: id }] },
      orderBy: { OrderDate: "asc" },
      include: {
        Suppliers: true,
        PurchaseOrderItems: { include: { Items: true, UnitOfMeasures: true } },
      },
    });
    const poIds = orders.map((o) => o.PoId);

    const [deliveries, grns, discrepancies, rawLosses] = poIds.length
      ? await Promise.all([
          prisma.deliveries.findMany({
            where: { PoId: { in: poIds } },
            orderBy: { CreatedAt: "asc" },
            include: {
              Suppliers: true,
              Locations: true,
              PurchaseOrders: true,
              DeliveryItems: { include: { Items: true, UnitOfMeasures: true } },
            },
          }),
          prisma.goodsReceipts.findMany({
            where: { PoId: { in: poIds } },
            orderBy: { CreatedAt: "asc" },
            include: {
              Deliveries: true,
              Locations: true,
              PurchaseOrders: true,
              GoodsReceiptItems: { include: { Items: true, UnitOfMeasures: true } },
            },
          }),
          prisma.discrepancies.findMany({
            where: { PoId: { in: poIds } },
            orderBy: { CreatedAt: "asc" },
            include: { Items: true },
          }),
          prisma.lossReports.findMany({
            where: { PoId: { in: poIds } },
            orderBy: { CreatedAt: "asc" },
            include: { Items: true, UnitOfMeasures: true },
          }),
        ])
      : [[], [], [], []];

    const grnIds = grns.map((g) => g.GrnId);
    const rtvIds = discrepancies.map((d) => d.RtvId).filter((rid): rid is number => typeof rid === "number" && rid > 0);

    const [inspections, stockIns, rtvs] = await Promise.all([
      grnIds.length
        ? prisma.qualityInspections.findMany({
            where: { ReferenceType: "GRN", ReferenceId: { in: grnIds } },
            orderBy: { InspectionDate: "asc" },
            include: { QualityInspectionItems: { include: { Items: true } } },
          })
        : Promise.resolve([]),
      grnIds.length
        ? prisma.stockIns.findMany({
            where: { GrnId: { in: grnIds } },
            orderBy: { CreatedAt: "asc" },
            include: {
              GoodsReceipts: { include: { Locations: true } },
              StockInLines: {
                include: {
                  Items: true,
                  UnitOfMeasures: true,
                  InventoryLots: { include: { Locations: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      rtvIds.length
        ? prisma.returnToVendors.findMany({
            where: { RtvId: { in: rtvIds } },
            orderBy: { CreatedAt: "asc" },
            include: { Suppliers: true, Items: true },
          })
        : Promise.resolve([]),
    ]);

    const report = {
      requisition: prDto(pr, true),
      purchaseOrders: orders.map((o) => ({
        poId: o.PoId,
        poNumber: o.PoNumber,
        supplierName: o.Suppliers?.CompanyName ?? "",
        status: o.Status,
        paymentType: o.PaymentType,
        orderDate: o.OrderDate.toISOString(),
        expectedArrivalDate: o.ExpectedArrivalDate.toISOString(),
        totalAmount: Number(o.TotalAmount),
        requestedBy: resolveStaffName(o.RequestedBy),
        items: o.PurchaseOrderItems.map((i) => ({
          itemId: i.ItemId,
          itemName: i.Items?.ItemName ?? "",
          quantity: Number(i.PoItemQuantity),
          uom: i.UnitOfMeasures?.Abbreviation || "Unit",
          totalPrice: Number(i.TotalPrice),
        })),
      })),
      deliveries: deliveries.map((d) => ({
        deliveryId: d.DeliveryId,
        deliveryNumber: d.DeliveryNumber,
        poNumber: d.PurchaseOrders?.PoNumber ?? "",
        supplierName: d.Suppliers?.CompanyName ?? "",
        locationName: d.Locations?.LocationName ?? "",
        status: d.Status,
        scheduledDate: d.ScheduledDate.toISOString(),
        dispatchedDate: d.DispatchedDate?.toISOString() ?? null,
        actualArrivalDate: d.ActualArrivalDate?.toISOString() ?? null,
        carrier: d.Carrier ?? "",
        trackingNumber: d.TrackingNumber ?? "",
        driverName: d.DriverName ?? "",
        receivedBy: resolveStaffName(d.ReceivedBy),
        items: d.DeliveryItems.map((di) => ({
          itemName: di.Items?.ItemName ?? "",
          declaredQuantity: Number(di.DeclaredQuantity),
          uom: di.UnitOfMeasures?.Abbreviation || "Unit",
        })),
      })),
      goodsReceipts: grns.map((g) => ({
        grnId: g.GrnId,
        grnNumber: g.GrnNumber,
        poNumber: g.PurchaseOrders?.PoNumber ?? "",
        deliveryNumber: g.Deliveries?.DeliveryNumber ?? "",
        locationName: g.Locations?.LocationName ?? "",
        status: g.Status,
        receivedDate: g.ReceivedDate.toISOString(),
        receivedBy: resolveStaffName(g.ReceivedBy),
        items: g.GoodsReceiptItems.map((gi) => ({
          itemName: gi.Items?.ItemName ?? "",
          orderedQuantity: Number(gi.OrderedQuantity),
          declaredQuantity: gi.DeclaredQuantity == null ? null : Number(gi.DeclaredQuantity),
          deliveredQuantity: Number(gi.DeliveredQuantity),
          varianceQuantity: Number(gi.VarianceQuantity),
          varianceType: gi.VarianceType,
          uom: gi.UnitOfMeasures?.Abbreviation || "Unit",
        })),
      })),
      qualityInspections: inspections.map((q) => ({
        inspectionNumber: q.InspectionNumber,
        grnNumber: q.ReferenceNumber,
        inspectorName: resolveStaffName(q.InspectorName),
        status: q.Status,
        inspectionDate: q.InspectionDate.toISOString(),
        completedAt: q.CompletedAt?.toISOString() ?? null,
        totalReceived: Number(q.TotalReceivedQuantity),
        totalAccepted: Number(q.TotalAcceptedQuantity),
        totalRejected: Number(q.TotalRejectedQuantity),
        overallNotes: q.OverallNotes ?? "",
        items: q.QualityInspectionItems.map((qi) => ({
          itemName: qi.Items?.ItemName ?? "",
          deliveredQuantity: Number(qi.DeliveredQuantity),
          acceptedQuantity: Number(qi.AcceptedQuantity),
          rejectedQuantity: Number(qi.RejectedQuantity),
          concessionQuantity: Number(qi.ConcessionQuantity),
          defectReason: qi.DefectReason ?? "",
        })),
      })),
      discrepancies: discrepancies.map((d) => ({
        discrepancyNumber: d.DiscrepancyNumber,
        discrepancyType: d.DiscrepancyType,
        grnNumber: d.GrnNumber,
        poNumber: d.PoNumber,
        itemName: d.Items?.ItemName ?? "",
        discrepancyQuantity: Number(d.DiscrepancyQuantity),
        status: d.Status,
        resolutionType: d.ResolutionType ?? "",
        resolutionNotes: d.ResolutionNotes ?? "",
        resolvedBy: resolveStaffName(d.ResolvedBy),
        resolvedAt: d.ResolvedAt?.toISOString() ?? null,
      })),
      lossReports: rawLosses.map((l) => ({
        lossReportNumber: l.LossReportNumber,
        itemName: l.Items?.ItemName ?? "",
        lostQuantity: Number(l.LostQuantity),
        uom: l.UnitOfMeasures?.Abbreviation || "Unit",
        reason: l.Reason,
        isAcknowledged: l.IsAcknowledged,
        acknowledgedBy: resolveStaffName(l.AcknowledgedBy),
        createdAt: l.CreatedAt.toISOString(),
      })),
      returns: rtvs.map((r) => ({
        rtvNumber: r.RtvNumber,
        supplierName: r.Suppliers?.CompanyName ?? "",
        itemName: r.Items?.ItemName ?? "",
        returnedQuantity: Number(r.ReturnedQuantity),
        reason: r.Reason,
        status: r.Status,
        dispatchedDate: r.DispatchedDate?.toISOString() ?? null,
      })),
      stockIns: stockIns.map((s) => ({
        stockInNumber: s.StockInNumber,
        grnNumber: s.GoodsReceipts?.GrnNumber ?? "",
        status: s.Status,
        createdBy: resolveStaffName(s.CreatedBy),
        committedBy: resolveStaffName(s.CommittedBy),
        committedAt: s.CommittedAt?.toISOString() ?? null,
        lines: s.StockInLines.map((sl) => ({
          itemName: sl.Items?.ItemName ?? "",
          quantityToStock: Number(sl.QuantityToStock),
          uom: sl.UnitOfMeasures?.Abbreviation || "Unit",
          lotCode: sl.LotCode,
          locationName: sl.InventoryLots?.Locations?.LocationName ?? s.GoodsReceipts?.Locations?.LocationName ?? "",
          unitCost: sl.InventoryLots ? Number(sl.InventoryLots.UnitCost) : 0,
          expiryDate: (sl.ExpiryDate ?? sl.InventoryLots?.ExpiryDate)?.toISOString() ?? null,
          committedToInventory: sl.CommittedToInventory,
        })),
      })),
    };

    return resourceResult({ success: true, data: report });
  });
}
