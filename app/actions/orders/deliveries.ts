"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import type { AuditAction } from "@/lib/audit";
import { resourceResult } from "@/lib/resources/result";
import { DELIVERY_INCLUDE, deliveryDto } from "@/lib/orders/dto";
import type { DeliveryInput, DeliveryUpdateInput } from "@/lib/orders/inputs";
import { fail, mutate, read } from "@/lib/orders/mutate";
import { queryDeliveries, queryDelivery } from "@/lib/orders/queries";

const MODULE = "Orders & Procurement";
const IN_FLIGHT = ["Scheduled", "InTransit", "Arrived"];

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

    const sums = await prisma.deliveryItems.groupBy({
      by: ["PoItemId"],
      where: { PoItemId: { in: po.PurchaseOrderItems.map((i) => i.PoItemId) }, Deliveries: { Status: { in: IN_FLIGHT } } },
      _sum: { DeclaredQuantity: true },
    });
    const inFlight = new Map(sums.map((s) => [s.PoItemId, Number(s._sum.DeclaredQuantity || 0)]));

    return resourceResult({
      success: true,
      data: po.PurchaseOrderItems.map((item) => {
        const flying = inFlight.get(item.PoItemId) || 0;
        const remaining = Number(item.PoItemQuantity) - Number(item.ReceivedQuantity) - flying;
        return {
          poItemId: item.PoItemId,
          itemId: item.ItemId,
          itemCode: item.Items?.ItemCode || `SPL-${String(item.ItemId).padStart(4, "0")}`,
          itemName: item.Items?.ItemName || "",
          orderedQuantity: Number(item.PoItemQuantity),
          receivedQuantity: Number(item.ReceivedQuantity),
          inFlightQuantity: flying,
          remainingQuantity: remaining > 0 ? remaining : 0,
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
    if (["Cancelled", "Rejected", "Draft", "PendingApproval"].includes(po.Status)) {
      return fail(`Cannot create a delivery for a purchase order in '${po.Status}' status.`);
    }

    const lines = [];
    for (const req of body.items) {
      const poItem = po.PurchaseOrderItems.find((i) => i.PoItemId === req.poItemId);
      if (!poItem) return fail(`PO item ${req.poItemId} does not belong to purchase order ${po.PoNumber}.`);
      const name = poItem.Items?.ItemName || poItem.ItemId;
      if (req.declaredQuantity <= 0) return fail(`Shipment quantity for item '${name}' must be greater than zero.`);

      const flying = await tx.deliveryItems.aggregate({
        where: { PoItemId: poItem.PoItemId, Deliveries: { Status: { in: IN_FLIGHT } } },
        _sum: { DeclaredQuantity: true },
      });
      const remaining = Number(poItem.PoItemQuantity) - Number(poItem.ReceivedQuantity) - Number(flying._sum.DeclaredQuantity || 0);
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
    return {
      result: resourceResult({ success: true, message: "Delivery cancelled successfully.", data: updated }),
      audit: { module: MODULE, change: "updated", target: target(updated), ...change(staff, updated, "cancelled") },
    };
  });
}

export async function dispatchDelivery(idInput: string | number, body: DeliveryUpdateInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = parseInt(String(idInput), 10);
    const delivery = await tx.deliveries.findUnique({ where: { DeliveryId: id } });
    if (!delivery) return fail(`Delivery ${id} not found.`);
    if (delivery.Status !== "Scheduled") return fail(`Only Scheduled deliveries can be dispatched. Current status: ${delivery.Status}.`);

    const updated = await tx.deliveries.update({
      where: { DeliveryId: id },
      data: {
        Status: "InTransit",
        DispatchedBy: staff.username,
        DispatchedDate: body.dispatchedDate ? new Date(body.dispatchedDate) : new Date(),
        ExpectedArrivalDate: body.expectedArrivalDate ? new Date(body.expectedArrivalDate) : delivery.ExpectedArrivalDate,
        TrackingNumber: body.trackingNumber?.trim() || delivery.TrackingNumber,
        Carrier: body.carrier?.trim() || delivery.Carrier,
        DriverName: body.driverName?.trim() || delivery.DriverName,
        VehiclePlateNumber: body.vehiclePlateNumber?.trim() || delivery.VehiclePlateNumber,
        DeliveryNoteNumber: body.deliveryNoteNumber?.trim() || delivery.DeliveryNoteNumber,
        Notes: body.notes?.trim() || delivery.Notes,
      },
    });
    return {
      result: resourceResult({ success: true, message: "Delivery marked as dispatched.", data: updated }),
      audit: { module: MODULE, change: "updated", target: target(updated), ...change(staff, updated, "dispatched") },
    };
  });
}

export async function arriveDelivery(idInput: string | number, body: DeliveryUpdateInput = {}) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = parseInt(String(idInput), 10);
    const delivery = await tx.deliveries.findUnique({ where: { DeliveryId: id } });
    if (!delivery) return fail(`Delivery ${id} not found.`);
    if (delivery.Status !== "InTransit" && delivery.Status !== "Scheduled") {
      return fail(`Only Scheduled or In-Transit deliveries can be marked as arrived. Current status: ${delivery.Status}.`);
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
