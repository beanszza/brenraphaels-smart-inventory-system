"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import type { AuditAction } from "@/lib/audit";
import { resourceResult } from "@/lib/resources/result";
import { PR_INCLUDE, prDto } from "@/lib/orders/dto";
import type { RequisitionInput, StatusInput } from "@/lib/orders/inputs";
import { fail, mutate, read } from "@/lib/orders/mutate";
import { changeFor, notifyApprovalRequested, statusNotice } from "@/lib/orders/notify";

const MODULE = "Orders & Procurement";
const STATUSES = ["Draft", "PendingApproval", "Approved", "Rejected", "Returned", "ConvertedToPO", "Cancelled"];

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

      return resourceResult({ success: true, data: availablePrs.map((pr) => prDto(pr, true)) });
    }

    return resourceResult({ success: true, data: prs.map((pr) => prDto(pr, true)) });
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
        Priority: body.priority?.trim() || "Normal",
        Purpose: body.purpose || "",
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
        Priority: body.priority?.trim() || pr.Priority,
        Purpose: body.purpose !== undefined ? body.purpose : pr.Purpose,
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
