"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import type { AuditAction } from "@/lib/audit";
import { resourceResult } from "@/lib/resources/result";
import { DELIVERY_INCLUDE, deliveryDto } from "@/lib/orders/dto";
import type { DeliveryInput, DeliveryUpdateInput } from "@/lib/orders/inputs";
import { fail, mutate, read } from "@/lib/orders/mutate";
import { queryDeliveries, queryDelivery } from "@/lib/orders/queries";
import { isDeliveryInFlight, syncRequisitionLifecycleByPoId } from "@/lib/orders/requisition-lifecycle";

const MODULE = "Orders & Procurement";
const IN_FLIGHT = ["Scheduled", "Arrived"];

const target = (d: { DeliveryId: number; DeliveryNumber: string }) => ({ type: "delivery", id: d.DeliveryId, name: d.DeliveryNumber });
const change = (staff: { name: string }, d: { DeliveryNumber: string }, what: string): Pick<AuditAction, "description"> => ({
  description: `${staff.name} ${what} delivery ${d.DeliveryNumber}`,
});

export async function listDeliveries(query = "") {
  await requireModule(MODULE);
  return read(() => queryDeliveries(query));
}

export async function getDelivery(idInput: string | number) {
  await requireModule(MODULE);
  return read(() => queryDelivery(parseInt(String(idInput), 10)));
}

/** What is still to be delivered on each line: ordered, less received, less what is on its way. */
export async function outstandingItems(poIdInput: string | number) {
  await requireModule(MODULE);
  return read(async () => {
    const poId = parseInt(String(poIdInput), 10);
    const po = await prisma.purchaseOrders.findUnique({
      where: { PoId: poId },
      include: { PurchaseOrderItems: { include: { Items: true, UnitOfMeasures: true } } },
    });
    if (!po) return resourceResult({ success: false, message: `Purchase order ${poId} not found.` });

    const [activeDeliveries, discrepancies] = await Promise.all([
      prisma.deliveries.findMany({
        where: { PoId: poId, Status: { in: IN_FLIGHT } },
        include: {
          GoodsReceipts: { select: { Status: true } },
          DeliveryItems: true,
        },
      }),
      prisma.discrepancies.findMany({
        where: { PoId: poId },
        select: { ItemId: true, DiscrepancyQuantity: true, Status: true, ResolutionType: true },
      }),
    ]);

    const inFlight = new Map<number, number>();
    for (const del of activeDeliveries) {
      if (!isDeliveryInFlight(del)) continue;
      for (const di of del.DeliveryItems ?? []) {
        inFlight.set(di.PoItemId, (inFlight.get(di.PoItemId) ?? 0) + Number(di.DeclaredQuantity || 0));
      }
    }

    const closedDiscByItem = new Map<number, number>();
    for (const d of discrepancies) {
      if ((d.Status === "Resolved" || d.Status === "Closed") && d.ResolutionType !== "NewDelivery") {
        closedDiscByItem.set(d.ItemId, (closedDiscByItem.get(d.ItemId) ?? 0) + Number(d.DiscrepancyQuantity || 0));
      }
    }

    return resourceResult({
      success: true,
      data: po.PurchaseOrderItems.map((item) => {
        const flying = inFlight.get(item.PoItemId) || 0;
        const closedDisc = closedDiscByItem.get(item.ItemId) ?? 0;
        const ordered = Number(item.PoItemQuantity);
        const received = Number(item.ReceivedQuantity);
        const rawRemaining = ordered - received - flying - closedDisc;
        const usedDisc = Math.max(0, Math.min(closedDisc, ordered - received - flying));
        closedDiscByItem.set(item.ItemId, Math.max(0, closedDisc - usedDisc));
        const remaining = rawRemaining > 0 ? rawRemaining : 0;
        return {
          poItemId: item.PoItemId,
          itemId: item.ItemId,
          itemCode: item.Items?.ItemCode || `SPL-${String(item.ItemId).padStart(4, "0")}`,
          itemName: item.Items?.ItemName || "",
          orderedQuantity: ordered,
          receivedQuantity: received,
          inFlightQuantity: flying,
          remainingQuantity: remaining,
          purchaseUomId: item.PurchaseUomId,
          purchaseUomName: item.UnitOfMeasures?.Abbreviation || "Unit",
        };
      }),
    });
  });
}

export async function createDelivery(body: DeliveryInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    if (!body.items || body.items.length === 0) return fail("A delivery must contain at least one item.");

    const po = await tx.purchaseOrders.findUnique({
      where: { PoId: body.poId ?? 0 },
      include: { Suppliers: true, PurchaseOrderItems: { include: { Items: true, UnitOfMeasures: true } } },
    });
    if (!po) return fail(`Purchase order ${body.poId} was not found.`);
    if (["Cancelled", "Rejected", "Draft", "Pending Approval", "PendingApproval", "Delivered"].includes(po.Status)) {
      return fail(`Cannot create a delivery for a purchase order in '${po.Status}' status.`);
    }

    const activeDeliveries = await tx.deliveries.findMany({
      where: { PoId: po.PoId, Status: { in: IN_FLIGHT } },
      include: {
        GoodsReceipts: { select: { Status: true } },
        DeliveryItems: true,
      },
    });
    const inFlightByPoItem = new Map<number, number>();
    for (const del of activeDeliveries) {
      if (!isDeliveryInFlight(del)) continue;
      for (const di of del.DeliveryItems ?? []) {
        inFlightByPoItem.set(di.PoItemId, (inFlightByPoItem.get(di.PoItemId) ?? 0) + Number(di.DeclaredQuantity || 0));
      }
    }

    const discrepancies = await tx.discrepancies.findMany({
      where: { PoId: po.PoId },
      select: { ItemId: true, DiscrepancyQuantity: true, Status: true, ResolutionType: true },
    });
    const closedDiscByItem = new Map<number, number>();
    for (const d of discrepancies) {
      if ((d.Status === "Resolved" || d.Status === "Closed") && d.ResolutionType !== "NewDelivery") {
        closedDiscByItem.set(d.ItemId, (closedDiscByItem.get(d.ItemId) ?? 0) + Number(d.DiscrepancyQuantity || 0));
      }
    }

    const lines = [];
    for (const req of body.items) {
      const poItem = po.PurchaseOrderItems.find((i) => i.PoItemId === req.poItemId);
      if (!poItem) return fail(`PO item ${req.poItemId} does not belong to purchase order ${po.PoNumber}.`);
      const name = poItem.Items?.ItemName || poItem.ItemId;
      if (req.declaredQuantity <= 0) return fail(`Shipment quantity for item '${name}' must be greater than zero.`);

      const flying = inFlightByPoItem.get(poItem.PoItemId) ?? 0;
      const closedDisc = closedDiscByItem.get(poItem.ItemId) ?? 0;
      const remaining = Math.max(
        0,
        Number(poItem.PoItemQuantity) - Number(poItem.ReceivedQuantity) - flying - closedDisc
      );
      if (req.declaredQuantity > remaining) {
        return fail(`Declared quantity (${req.declaredQuantity}) exceeds remaining outstanding quantity (${remaining}) for item '${name}'.`);
      }
      lines.push({ PoItemId: poItem.PoItemId, ItemId: poItem.ItemId, DeclaredQuantity: req.declaredQuantity, PurchaseUomId: poItem.PurchaseUomId });
    }

    const year = new Date().getFullYear();
    const seq = await tx.documentSequences.upsert({
      where: { DocType_Year: { DocType: "Delivery", Year: year } },
      update: { LastNumber: { increment: 1 } },
      create: { DocType: "Delivery", Year: year, LastNumber: 1 },
    });

    const scheduledProof = body.scheduledAttachmentBase64?.trim() || body.attachmentUrl?.trim();
    const delivery = await tx.deliveries.create({
      data: {
        DeliveryNumber: `DLV-${year}-${String(seq.LastNumber).padStart(4, "0")}`,
        PoId: po.PoId,
        SupplierId: po.SupplierId,
        // The main warehouse, until receiving locations are chosen per delivery.
        ReceivingLocationId: 1,
        Status: "Scheduled",
        ScheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : new Date(),
        ExpectedArrivalDate: body.expectedArrivalDate ? new Date(body.expectedArrivalDate) : po.ExpectedArrivalDate,
        TrackingNumber: body.trackingNumber?.trim(),
        Carrier: body.carrier?.trim(),
        DriverName: body.driverName?.trim(),
        VehiclePlateNumber: body.vehiclePlateNumber?.trim(),
        DeliveryNoteNumber: body.deliveryNoteNumber?.trim(),
        PaymentType: body.paymentType || po.PaymentType,
        Notes: body.notes?.trim(),
        AttachmentUrl: scheduledProof,
        ScheduledAttachment: scheduledProof,
        CreatedBy: staff.username,
        CreatedAt: new Date(),
        DeliveryItems: { create: lines },
      },
      include: DELIVERY_INCLUDE,
    });

    if (po.Status === "Approved") await tx.purchaseOrders.update({ where: { PoId: po.PoId }, data: { Status: "Ordered" } });

    return {
      result: resourceResult({
        success: true,
        message: "Delivery scheduled successfully.",
        data: {
          deliveryId: delivery.DeliveryId,
          deliveryNumber: delivery.DeliveryNumber,
          poId: delivery.PoId,
          poNumber: delivery.PurchaseOrders?.PoNumber,
          supplierId: delivery.SupplierId,
          supplierName: delivery.PurchaseOrders?.Suppliers?.CompanyName || "",
          status: delivery.Status,
          items: deliveryDto(delivery).items,
        },
      }),
      audit: { module: MODULE, change: "created", target: target(delivery), ...change(staff, delivery, "scheduled") },
    };
  });
}

export async function cancelDelivery(idInput: string | number, body: DeliveryUpdateInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = parseInt(String(idInput), 10);
    const delivery = await tx.deliveries.findUnique({ where: { DeliveryId: id } });
    if (!delivery) return fail(`Delivery ${id} not found.`);
    if (["Cancelled", "Arrived", "Received"].includes(delivery.Status)) {
      return fail(`Cannot cancel a delivery in ${delivery.Status} status.`);
    }
    const updated = await tx.deliveries.update({
      where: { DeliveryId: id },
      data: {
        Status: "Cancelled",
        Notes: body.reason
          ? delivery.Notes ? `${delivery.Notes}\nCancellation Reason: ${body.reason}` : `Cancellation Reason: ${body.reason}`
          : delivery.Notes,
      },
    });
    await syncRequisitionLifecycleByPoId(tx, delivery.PoId);
    return {
      result: resourceResult({ success: true, message: "Delivery cancelled successfully.", data: updated }),
      audit: { module: MODULE, change: "updated", target: target(updated), ...change(staff, updated, "cancelled") },
    };
  });
}

export async function arriveDelivery(idInput: string | number, body: DeliveryUpdateInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = parseInt(String(idInput), 10);
    const delivery = await tx.deliveries.findUnique({ where: { DeliveryId: id } });
    if (!delivery) return fail(`Delivery ${id} not found.`);
    if (delivery.Status !== "Scheduled") {
      return fail(`Only Scheduled deliveries can be marked as arrived. Current status: ${delivery.Status}.`);
    }

    const arrivalProof = body.arrivalAttachmentBase64?.trim() || body.attachmentUrl?.trim();
    const updated = await tx.deliveries.update({
      where: { DeliveryId: id },
      data: {
        Status: "Arrived",
        ReceivedBy: staff.username,
        ActualArrivalDate: body.actualArrivalDate ? new Date(body.actualArrivalDate) : new Date(),
        DeliveryNoteNumber: body.deliveryNoteNumber?.trim() || delivery.DeliveryNoteNumber,
        Notes: body.notes?.trim() || delivery.Notes,
        ...(arrivalProof ? { ArrivalAttachment: arrivalProof } : {}),
      },
    });
    return {
      result: resourceResult({ success: true, message: "Delivery marked as arrived.", data: updated }),
      audit: { module: MODULE, change: "updated", target: target(updated), ...change(staff, updated, "marked as arrived") },
    };
  });
}
