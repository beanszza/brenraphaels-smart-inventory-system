// Reads of purchase orders and deliveries that more than one Module's screens show. They do no
// access check themselves: each Module's action checks its own Module, then calls these.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resourceResult, type ResourceResult } from "@/lib/resources/result";
import { DELIVERY_INCLUDE, PO_INCLUDE, deliveryDto, poDto } from "./dto";

export async function queryOrders(query = ""): Promise<ResourceResult> {
  const params = new URLSearchParams(query);
  const status = params.get("status") || "All";
  const search = params.get("search") || "";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get("pageSize") || "10", 10)));

  const where: Prisma.PurchaseOrdersWhereInput = {};
  if (status !== "All") where.Status = status;
  if (search) {
    where.OR = [
      { PoNumber: { contains: search, mode: "insensitive" } },
      { Suppliers: { CompanyName: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (params.get("eligibleForDelivery") === "true") where.Status = { in: ["Approved", "PartiallyDelivered"] };

  const totalCount = await prisma.purchaseOrders.count({ where });
  const orders = await prisma.purchaseOrders.findMany({
    where,
    orderBy: { OrderDate: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: PO_INCLUDE,
  });
  return resourceResult({ success: true, data: { items: orders.map(poDto), totalCount, page, pageSize } });
}

export async function queryOrder(id: number): Promise<ResourceResult> {
  const order = await prisma.purchaseOrders.findUnique({ where: { PoId: id }, include: PO_INCLUDE });
  if (!order) return resourceResult({ success: false, message: `Purchase order with ID ${id} not found.` });
  return resourceResult({ success: true, data: poDto(order) });
}

export async function queryDeliveries(query = ""): Promise<ResourceResult> {
  const params = new URLSearchParams(query);
  const poId = params.get("poId");
  const status = params.get("status") || "All";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get("pageSize") || "50", 10)));

  const where: Prisma.DeliveriesWhereInput = {};
  if (poId) where.PoId = parseInt(poId, 10);
  if (status !== "All") where.Status = status;
  if (params.get("eligibleForGrn") === "true") where.Status = "Arrived";

  const totalCount = await prisma.deliveries.count({ where });
  const deliveries = await prisma.deliveries.findMany({
    where,
    orderBy: { CreatedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: DELIVERY_INCLUDE,
  });
  return resourceResult({ success: true, data: { items: deliveries.map(deliveryDto), totalCount, page, pageSize } });
}

export async function queryDelivery(id: number): Promise<ResourceResult> {
  const delivery = await prisma.deliveries.findUnique({ where: { DeliveryId: id }, include: DELIVERY_INCLUDE });
  if (!delivery) return resourceResult({ success: false, message: `Delivery with ID ${id} not found.` });
  return resourceResult({ success: true, data: deliveryDto(delivery) });
}
