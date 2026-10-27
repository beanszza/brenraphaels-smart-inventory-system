"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, positiveId, validateInput } from "@/lib/receiving/mutate";
import { notifyApprovalRequested, notifyRequester } from "@/lib/receiving/notify";
import type { ReturnInput } from "@/lib/receiving/inputs";

const MODULE = "Goods Receiving";

export async function requestReturnApproval(idInput: string | number, body: ReturnInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async tx => {
    const id = positiveId(idInput);
    validateInput(body);
    const rtv = await tx.returnToVendors.findUnique({ where: { RtvId: id } });
    if (!rtv || rtv.Status !== "Draft") refuse("Only draft supplier returns can be submitted for approval.");
    const updated = await tx.returnToVendors.update({ where: { RtvId: id }, data: { Status: "PendingApproval", ApprovalRequestNotes: body.notes } });
    return { result: resourceResult({ success: true, data: updated, message: "Return submitted for approval." }),
      audit: { module: MODULE, change: "updated", target: { type: "supplier-return", id: rtv.RtvId, name: rtv.RtvNumber },
        description: `${staff.name} submitted supplier return ${rtv.RtvNumber} for approval` },
      after: () => notifyApprovalRequested(staff, rtv.RtvNumber) };
  });
}

export async function listReturns(query = "") {
  await requireModule(MODULE);
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const status = searchParams.get("status") || "All";

    const where: import("@prisma/client").Prisma.ReturnToVendorsWhereInput = {};
    if (status !== "All") {
      where.Status = status;
    }

    const rtvs = await prisma.returnToVendors.findMany({
      where,
      orderBy: { CreatedAt: "desc" },
      include: {
        Discrepancies: { include: { GoodsReceipts: true, PurchaseOrders: { include: { PurchaseRequisition: true } } } },
        NonConformanceReports: { include: { QualityInspections: true } },
        Suppliers: true,
        Items: { include: { Uom: true, UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } }
      }
    });

    const data = rtvs.map((r: typeof rtvs[number]) => ({
      rtvId: r.RtvId,
      rtvNumber: r.RtvNumber,
      ncrId: r.NcrId,
      ncrNumber: r.NonConformanceReports?.NcrNumber,
      discrepancyId: r.Discrepancies[0]?.DiscrepancyId,
      discrepancyNumber: r.Discrepancies[0]?.DiscrepancyNumber,
      grnId: r.Discrepancies[0]?.GrnId,
      grnNumber: r.Discrepancies[0]?.GrnNumber,
      poId: r.Discrepancies[0]?.PoId,
      poNumber: r.Discrepancies[0]?.PoNumber,
      prId: r.Discrepancies[0]?.PurchaseOrders?.PrId,
      prNumber: r.Discrepancies[0]?.PurchaseOrders?.PurchaseRequisition?.PrNumber,
      supplierId: r.SupplierId,
      supplierName: r.Suppliers?.CompanyName || "",
      itemId: r.ItemId,
      itemName: r.Items?.ItemName || "",
      returnedQuantity: Number(r.ReturnedQuantity),
      quantityReturned: Number(r.ReturnedQuantity),
      uomName: r.Items?.Uom?.Abbreviation || r.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
      returnReason: r.Reason,
      status: r.Status,
      approvalRequestNotes: r.ApprovalRequestNotes,
      approvedBy: r.ApprovedBy,
      approvedAt: r.ApprovedAt,
      rejectedBy: r.RejectedBy,
      rejectedAt: r.RejectedAt,
      rejectionReason: r.RejectionReason,
      dispatchedDate: r.DispatchedDate,
      creditNoteNumber: r.CreditNoteNumber,
      createdBy: r.CreatedBy,
      createdAt: r.CreatedAt
    }));

    return resourceResult({ success: true, data });

  });
}

export async function approveReturn(idInput: string | number) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);

    const rtv = await tx.returnToVendors.findUnique({
      where: { RtvId: id },
    });

    if (!rtv) {
      return refuse(`Return to Supplier (RTV) ${id} not found.`);
    }

    if (rtv.Status !== "PendingApproval") {
      return refuse(`Only RTVs in PendingApproval status can be approved. Current status: ${rtv.Status}.`);
    }

    const updated = await tx.returnToVendors.update({
      where: { RtvId: id },
      data: {
        Status: "Approved",
        ApprovedBy: staff.username,
        ApprovedAt: new Date(),
      }
    });

    return { result: resourceResult({ success: true, data: updated, message: "RTV approved successfully." }), audit: { module: MODULE, change: "approved", target: { type: "supplier-return", id: updated.RtvId, name: updated.RtvNumber }, description: `${staff.name} approved supplier return ${updated.RtvNumber}` }, after: () => notifyRequester(rtv.CreatedBy, "approved", updated.RtvNumber) };

  });
}

export async function rejectReturn(idInput: string | number, body: ReturnInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    validateInput(body);

    const rtv = await tx.returnToVendors.findUnique({
      where: { RtvId: id },
    });

    if (!rtv) {
      return refuse(`Return to Supplier (RTV) ${id} not found.`);
    }

    if (rtv.Status !== "PendingApproval") {
      return refuse(`Only RTVs in PendingApproval status can be rejected. Current status: ${rtv.Status}.`);
    }

    const updated = await tx.returnToVendors.update({
      where: { RtvId: id },
      data: {
        Status: "Rejected",
        RejectedBy: staff.username,
        RejectedAt: new Date(),
        RejectionReason: body.reason,
      }
    });

    return { result: resourceResult({ success: true, data: updated, message: "RTV rejected successfully." }), audit: { module: MODULE, change: "rejected", target: { type: "supplier-return", id: updated.RtvId, name: updated.RtvNumber }, description: `${staff.name} rejected supplier return ${updated.RtvNumber}` }, after: () => notifyRequester(rtv.CreatedBy, "rejected", updated.RtvNumber) };

  });
}

export async function dispatchReturn(idInput: string | number, body: ReturnInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    validateInput(body);

    const rtv = await tx.returnToVendors.findUnique({
      where: { RtvId: id },
    });

    if (!rtv) {
      return refuse(`Return to Supplier (RTV) ${id} not found.`);
    }

    if (rtv.Status !== "Approved") {
      return refuse(`Only RTVs in Approved status can be dispatched. Current status: ${rtv.Status}.`);
    }

    const updated = await tx.returnToVendors.update({
      where: { RtvId: id },
      data: {
        Status: "Dispatched",
        DispatchedDate: body.dispatchDate ? new Date(body.dispatchDate) : new Date(),
        CreditNoteNumber: body.creditNoteNumber || undefined,
      }
    });

    return { result: resourceResult({ success: true, data: updated, message: "RTV dispatched successfully." }), audit: { module: MODULE, change: "updated", target: { type: "supplier-return", id: updated.RtvId, name: updated.RtvNumber }, description: `${staff.name} dispatched supplier return ${updated.RtvNumber}` } };

  });
}
