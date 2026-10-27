"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, positiveId, validateInput } from "@/lib/receiving/mutate";
import type { ResolutionInput } from "@/lib/receiving/inputs";

const MODULE = "Goods Receiving";

export async function listDiscrepancies(query = "") {
  await requireModule(MODULE);
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const status = searchParams.get("status") || "All";

    const where: import("@prisma/client").Prisma.DiscrepanciesWhereInput = {};
    if (status !== "All") {
      where.Status = status;
    }

    const discrepancies = await prisma.discrepancies.findMany({
      where,
      orderBy: { CreatedAt: "desc" },
      include: {
        Items: true,
        PurchaseOrders: { include: { Suppliers: true, PurchaseRequisition: true } },
        Deliveries: true,
      }
    });

    const data = discrepancies.map((d: typeof discrepancies[number]) => ({
      discrepancyId: d.DiscrepancyId,
      discrepancyNumber: d.DiscrepancyNumber,
      discrepancyType: d.DiscrepancyType,
      grnId: d.GrnId,
      grnNumber: d.GrnNumber,
      poId: d.PoId,
      poNumber: d.PoNumber,
      prId: d.PurchaseOrders?.PrId,
      prNumber: d.PurchaseOrders?.PurchaseRequisition?.PrNumber,
      supplierName: d.PurchaseOrders?.Suppliers?.CompanyName || "",
      deliveryId: d.DeliveryId,
      deliveryNumber: d.DeliveryNumber,
      itemId: d.ItemId,
      itemName: d.Items?.ItemName || "",
      orderedQuantity: Number(d.OrderedQuantity),
      previouslyReceivedQty: Number(d.PreviouslyReceivedQty),
      currentReceivedQty: Number(d.CurrentReceivedQty),
      discrepancyQuantity: Number(d.DiscrepancyQuantity),
      status: d.Status,
      resolutionType: d.ResolutionType,
      resolutionNotes: d.ResolutionNotes,
      resolvedBy: d.ResolvedBy,
      resolvedAt: d.ResolvedAt,
      createdAt: d.CreatedAt
    }));

    return resourceResult({ success: true, data });

  });
}

export async function resolveDiscrepancy(idInput: string | number, body: ResolutionInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    validateInput(body);

    const discrepancy = await tx.discrepancies.findUnique({
      where: { DiscrepancyId: id },
    });

    if (!discrepancy) {
      return refuse(`Discrepancy ${id} not found.`);
    }

    if (discrepancy.Status === "Resolved" || discrepancy.Status === "Closed") {
      return refuse(`Discrepancy is already resolved or closed.`);
    }

    const updated = await tx.discrepancies.update({
      where: { DiscrepancyId: id },
      data: {
        Status: "Resolved",
        ResolutionType: body.resolutionType,
        ResolutionNotes: body.resolutionNotes,
        ResolvedBy: staff.username,
        ResolvedAt: new Date(),
      }
    });

    return { result: resourceResult({ success: true, data: updated, message: "Discrepancy resolved successfully." }), audit: { module: MODULE, change: "updated", target: { type: "discrepancy", id: updated.DiscrepancyId, name: updated.DiscrepancyNumber }, description: `${staff.name} resolved discrepancy ${updated.DiscrepancyNumber}` } };

  });
}

export async function resolveAsLoss(idInput: string | number, body: ResolutionInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    validateInput(body);

    const discrepancy = await tx.discrepancies.findUnique({
      where: { DiscrepancyId: id },
    });

    if (!discrepancy) {
      return refuse(`Discrepancy ${id} not found.`);
    }

    if (discrepancy.Status === "Resolved" || discrepancy.Status === "Closed") {
      return refuse(`Discrepancy is already resolved or closed.`);
    }

    // In a full implementation, you would also create the LossReport record here.
    const updated = await tx.discrepancies.update({
      where: { DiscrepancyId: id },
      data: {
        Status: "Resolved",
        ResolutionType: "LossReport",
        ResolutionNotes: body.notes ? `Loss Report Reason: ${body.reason} - ${body.notes}` : `Loss Report Reason: ${body.reason}`,
        ResolvedBy: staff.username,
        ResolvedAt: new Date(),
      }
    });

    return { result: resourceResult({ success: true, data: updated, message: "Discrepancy resolved via Loss Report." }), audit: { module: MODULE, change: "updated", target: { type: "discrepancy", id: updated.DiscrepancyId, name: updated.DiscrepancyNumber }, description: `${staff.name} resolved discrepancy via loss report ${updated.DiscrepancyNumber}` } };

  });
}

export async function resolveAsReturn(idInput: string | number, body: ResolutionInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    validateInput(body);

    const discrepancy = await tx.discrepancies.findUnique({
      where: { DiscrepancyId: id },
    });

    if (!discrepancy) {
      return refuse(`Discrepancy ${id} not found.`);
    }

    if (discrepancy.Status === "Resolved" || discrepancy.Status === "Closed") {
      return refuse(`Discrepancy is already resolved or closed.`);
    }

    // In a full implementation, you would also create the ReturnToVendors record here.
    const updated = await tx.discrepancies.update({
      where: { DiscrepancyId: id },
      data: {
        Status: "Resolved",
        ResolutionType: "ReturnToSupplier",
        ResolutionNotes: body.notes ? `Return Reason: ${body.reason} - ${body.notes}` : `Return Reason: ${body.reason}`,
        ResolvedBy: staff.username,
        ResolvedAt: new Date(),
      }
    });

    return { result: resourceResult({ success: true, data: updated, message: "Discrepancy resolved via Return to Supplier." }), audit: { module: MODULE, change: "updated", target: { type: "discrepancy", id: updated.DiscrepancyId, name: updated.DiscrepancyNumber }, description: `${staff.name} resolved discrepancy via supplier return ${updated.DiscrepancyNumber}` } };

  });
}
