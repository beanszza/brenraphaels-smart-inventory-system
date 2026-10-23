"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import type { AuditAction } from "@/lib/audit";
import { resourceResult } from "@/lib/resources/result";
import { PO_INCLUDE, poDto } from "@/lib/orders/dto";
import type { OrderInput, StatusInput } from "@/lib/orders/inputs";
import { fail, mutate, read } from "@/lib/orders/mutate";
import { changeFor, statusNotice } from "@/lib/orders/notify";
import { queryOrder, queryOrders } from "@/lib/orders/queries";

const MODULE = "Orders & Procurement";
const STATUSES = ["Draft", "PendingApproval", "Approved", "Rejected", "Returned", "PartiallyDelivered", "Delivered", "Cancelled"];

const target = (po: { PoId: number; PoNumber: string }) => ({ type: "purchase-order", id: po.PoId, name: po.PoNumber });

/** Prices come from the supplier's catalog, never from the client. */
type Line = { ItemId: number; SupplierId: number; PoItemQuantity: number; TotalPrice: number; PurchaseUomId: number; ReceivedQuantity: number };
type Priced = { problem: string } | { problem?: undefined; lines: Line[]; total: number };

async function priceLines(tx: Prisma.TransactionClient, body: OrderInput): Promise<Priced> {
  const lines: Line[] = [];
  for (const line of body.items) {
    if (line.poItemQuantity <= 0) return { problem: "Quantity must be greater than zero." };
    const item = await tx.items.findUnique({ where: { ItemId: line.itemId } });
    if (!item) return { problem: `Item with ID ${line.itemId} not found.` };
    const catalog = await tx.supplierItems.findFirst({ where: { SupplierId: body.supplierId ?? 0, ItemId: line.itemId } });
    if (!catalog) return { problem: `No supplier price is configured for '${item.ItemName}'.` };
    if (Number(catalog.UnitPrice) <= 0) return { problem: `Supplier price for '${item.ItemName}' must be greater than zero.` };
    let uomId = line.purchaseUomId ?? catalog.PurchaseUomId;
    if (!uomId || uomId <= 0) uomId = item.StockUomId;
    lines.push({
      ItemId: line.itemId,
      SupplierId: body.supplierId ?? 0,
      PoItemQuantity: line.poItemQuantity,
      TotalPrice: Number(catalog.UnitPrice) * Number(line.poItemQuantity),
      PurchaseUomId: uomId,
      ReceivedQuantity: 0,
    });
  }
  return { lines, total: lines.reduce((sum, l) => sum + l.TotalPrice, 0) };
}

export async function listOrders(query = "") {
  await requireModule(MODULE);
  return read(() => queryOrders(query));
}

export async function getOrder(idInput: string | number) {
  await requireModule(MODULE);
  return read(() => queryOrder(parseInt(String(idInput), 10)));
}

/** The number the next order will take; the real one is issued when the order is saved. */
export async function nextOrderNumber() {
  await requireModule(MODULE);
  return read(async () => {
    const year = new Date().getFullYear();
    const seq = await prisma.documentSequences.findUnique({ where: { DocType_Year: { DocType: "PurchaseOrder", Year: year } } });
    return resourceResult({ success: true, data: `PO-${year}-${String((seq ? seq.LastNumber : 0) + 1).padStart(4, "0")}` });
  });
}

/** What is already on non-cancelled orders for a requisition, so a new order only asks for the rest. */
export async function orderedQuantities(prIdInput: string | number) {
  await requireModule(MODULE);
  return read(async () => {
    const orders = await prisma.purchaseOrders.findMany({
      where: { PrId: parseInt(String(prIdInput), 10), Status: { notIn: ["Cancelled", "Rejected"] } },
      include: { PurchaseOrderItems: true },
    });
    const ordered = new Map<number, number>();
    for (const order of orders) {
      for (const item of order.PurchaseOrderItems) {
        ordered.set(item.ItemId, (ordered.get(item.ItemId) ?? 0) + Number(item.PoItemQuantity));
      }
    }
    return resourceResult({
      success: true,
      data: [...ordered].map(([itemId, orderedQty]) => ({ itemId, orderedQty })),
    });
  });
}

export async function createOrder(body: OrderInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const supplier = await tx.suppliers.findUnique({ where: { SupplierId: body.supplierId ?? 0 } });
    if (!supplier) return fail(`Supplier with ID ${body.supplierId} not found.`);
    if (!body.items || body.items.length === 0) return fail("Purchase order must contain at least one item.");

    let expected = body.expectedArrivalDate ? new Date(body.expectedArrivalDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (expected <= new Date()) expected = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const priced = await priceLines(tx, body);
    if (priced.problem !== undefined) return fail(priced.problem);

    const year = new Date().getFullYear();
    const seq = await tx.documentSequences.upsert({
      where: { DocType_Year: { DocType: "PurchaseOrder", Year: year } },
      update: { LastNumber: { increment: 1 } },
      create: { DocType: "PurchaseOrder", Year: year, LastNumber: 1 },
    });

    const created = await tx.purchaseOrders.create({
      data: {
        PoNumber: `PO-${year}-${String(seq.LastNumber).padStart(4, "0")}`,
        PrId: body.prId || null,
        PurchaseRequisitionPrId: body.prId || null,
        SupplierId: body.supplierId ?? 0,
        OrderDate: new Date(),
        ExpectedArrivalDate: expected,
        Status: body.initialStatus && body.initialStatus !== "Unspecified" ? body.initialStatus : "Draft",
        PaymentType: body.paymentType || "Cash",
        ProofImageUrl: "",
        TotalAmount: priced.total,
        RequestedBy: staff.username,
      },
    });
    await tx.purchaseOrderItems.createMany({
      data: priced.lines.map((l) => ({ ...l, PoId: created.PoId, PurchaseOrderPoId: created.PoId })),
    });
    const order = await tx.purchaseOrders.findUniqueOrThrow({ where: { PoId: created.PoId }, include: PO_INCLUDE });

    return {
      result: resourceResult({ success: true, message: "Purchase order created successfully", data: poDto(order) }),
      audit: {
        module: MODULE, change: "created", target: target(order),
        description: `${staff.name} created purchase order ${order.PoNumber}`,
      } satisfies AuditAction,
      after: statusNotice(staff, order.PoNumber, order.RequestedBy, order.Status),
    };
  });
}

export async function updateOrder(idInput: string | number, body: OrderInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = parseInt(String(idInput), 10);
    const order = await tx.purchaseOrders.findUnique({ where: { PoId: id } });
    if (!order) return fail(`Purchase order with ID ${id} not found.`);
    if (order.Status !== "Draft" && order.Status !== "Returned") {
      return fail(`Only Draft or Returned orders can be modified. Current status: ${order.Status}.`);
    }
    if (!body.items || body.items.length === 0) return fail("Purchase order must contain at least one item.");

    const priced = await priceLines(tx, body);
    if (priced.problem !== undefined) return fail(priced.problem);

    const status = body.initialStatus && body.initialStatus !== "Unspecified" ? body.initialStatus : order.Status;
    await tx.purchaseOrderItems.deleteMany({ where: { OR: [{ PoId: id }, { PurchaseOrderPoId: id }] } });
    await tx.purchaseOrders.update({
      where: { PoId: id },
      data: {
        SupplierId: body.supplierId || order.SupplierId,
        ExpectedArrivalDate: body.expectedArrivalDate ? new Date(body.expectedArrivalDate) : order.ExpectedArrivalDate,
        PaymentType: body.paymentType || order.PaymentType,
        Status: status,
        TotalAmount: priced.total,
      },
    });
    await tx.purchaseOrderItems.createMany({
      data: priced.lines.map((l) => ({ ...l, PoId: id, PurchaseOrderPoId: id })),
    });
    const updated = await tx.purchaseOrders.findUniqueOrThrow({ where: { PoId: id }, include: PO_INCLUDE });

    return {
      result: resourceResult({ success: true, message: "Purchase order updated successfully", data: poDto(updated) }),
      audit: {
        module: MODULE, change: "updated", target: target(updated),
        description: `${staff.name} updated purchase order ${updated.PoNumber}`,
      } satisfies AuditAction,
      after: statusNotice(staff, updated.PoNumber, updated.RequestedBy, status),
    };
  });
}

/** Approving, rejecting and the other status moves, plus the quality-check notes that come with receiving. */
export async function setOrderStatus(idInput: string | number, body: StatusInput) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = parseInt(String(idInput), 10);
    const order = await tx.purchaseOrders.findUnique({ where: { PoId: id } });
    if (!order) return fail(`Purchase order ${id} not found.`);
    if (body.status && !STATUSES.includes(body.status)) {
      return fail(`Invalid status '${body.status}'. Allowed: ${STATUSES.join(", ")}.`);
    }

    const data: Prisma.PurchaseOrdersUpdateInput = {};
    if (body.status) data.Status = body.status;
    if (body.qaStatus) data.QaStatus = body.qaStatus;
    if (body.qaNotes) data.QaNotes = body.qaNotes;
    if (body.qaStatus && body.qaStatus !== "Pending") {
      data.InspectedBy = staff.username;
      data.QaInspectedDate = new Date();
    }
    if (body.adminNotes) data.AdminNotes = body.adminNotes;
    if (body.comments) data.AdminNotes = body.comments;

    const updated = await tx.purchaseOrders.update({ where: { PoId: id }, data, include: PO_INCLUDE });

    const change = changeFor(body.status);
    const what = body.status ?? `quality status ${body.qaStatus}`;
    return {
      result: resourceResult({ success: true, message: `Order status updated to ${body.status || body.qaStatus}.`, data: poDto(updated) }),
      audit: {
        module: MODULE, change, target: target(updated),
        description: `${staff.name} ${change === "updated" ? `set purchase order ${updated.PoNumber} to ${what}` : `${change} purchase order ${updated.PoNumber}`}`,
      } satisfies AuditAction,
      after: statusNotice(staff, updated.PoNumber, updated.RequestedBy, body.status),
    };
  });
}
