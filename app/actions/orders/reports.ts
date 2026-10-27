"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/orders/mutate";

const day = (value: string | undefined, end: boolean) => value ? new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`) : undefined;

/** The Reports page's tabs. Reads only; `query` carries the optional startDate and endDate. */
export async function loadReport(typeInput: string, query = "") {
  await requireModule("Orders & Procurement");
  return read(async () => {
    const params = new URLSearchParams(query);
    const gte = day(params.get("startDate") ?? undefined, false);
    const lte = day(params.get("endDate") ?? undefined, true);
    const dateFilter: Prisma.DateTimeFilter = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };

    const type = typeInput.toLowerCase();

    if (type === "inventory") {
      const inventories = await prisma.inventories.findMany({
        include: {
          Items: {
            include: { Category: true },
          },
        },
      });

      const aggregated = new Map<number, { itemId: number; itemName: string; category: string; currentStock: number; minReorderPoint: number; status: string }>();
      inventories.forEach(inv => {
        const item = inv.Items;
        if (!aggregated.has(item.ItemId)) {
          aggregated.set(item.ItemId, {
            itemId: item.ItemId,
            itemName: item.ItemName,
            category: item.Category?.CategoryName || "",
            currentStock: 0,
            minReorderPoint: Number(item.MinStockLevel),
            status: item.IsActive ? "Active" : "Inactive",
          });
        }
        aggregated.get(item.ItemId)!.currentStock += Number(inv.CurrentStock);
      });

      return resourceResult({
        success: true,
        data: {
          inventoryLevels: Array.from(aggregated.values()),
        },
      });
    }

    if (type === "procurement") {
      const where = gte || lte ? { OrderDate: dateFilter } : {};
      const orders = await prisma.purchaseOrders.findMany({
        where,
        include: { Suppliers: true },
        orderBy: { OrderDate: 'desc' },
      });

      return resourceResult({
        success: true,
        data: {
          orders: orders.map(po => ({
            poId: po.PoId,
            supplierName: po.Suppliers?.CompanyName || "",
            orderDate: po.OrderDate ? po.OrderDate.toISOString().split("T")[0] : "",
            expectedArrivalDate: po.ExpectedArrivalDate ? po.ExpectedArrivalDate.toISOString().split("T")[0] : "",
            status: po.Status,
            totalAmount: Number(po.TotalAmount),
          })),
        },
      });
    }

    if (type === "production") {
      const where = gte || lte ? { ProductionDate: dateFilter } : {};
      const batches = await prisma.productionBatches.findMany({
        where,
        include: { FinishedProducts: { include: { Items: true } } },
        orderBy: { ProductionDate: 'desc' },
      });

      return resourceResult({
        success: true,
        data: {
          batches: batches.map(b => ({
            batchId: b.BatchId,
            productName: b.FinishedProducts?.Items?.ItemName || "",
            batchMultiplier: Number(b.BatchMultiplier || 1),
            estimatedQuantity: Number(b.EstimatedQuantity || 0),
            actualQuantity: Number(b.ActualQuantity || 0),
            productionDate: b.ProductionDate ? b.ProductionDate.toISOString().split("T")[0] : "",
            stage: b.Stage || "",
            status: b.Status,
          })),
        },
      });
    }

    if (type === "supplier") {
      // Basic scorecard implementation
      const suppliers = await prisma.suppliers.findMany({
        where: { IsActive: true },
        include: { PurchaseOrders: true },
      });

      return resourceResult({
        success: true,
        data: {
          vendorScorecard: suppliers.map(s => {
            const totalOrders = s.PurchaseOrders.length;
            const completed = s.PurchaseOrders.filter(po => po.Status === "Completed").length;
            const fulfillmentRate = totalOrders > 0 ? Math.round((completed / totalOrders) * 100) + "%" : "100%";
            return {
              supplierId: s.SupplierId,
              supplierName: s.CompanyName,
              totalOrders,
              onTimeRate: "100%", // Mocked for now
              fulfillmentRate,
              qualityPassRate: "100%", // Mocked for now
            };
          }),
        },
      });
    }

    if (type === "distribution") {
      const where = gte || lte ? { TransferDate: dateFilter } : {};
      const transfers = await prisma.stockTransfers.findMany({
        where,
        include: {
          FinishedProducts: { include: { Items: true } },
          Locations_StockTransfers_SourceLocationIdToLocations: true,
          Locations_StockTransfers_DestLocationIdToLocations: true,
        },
        orderBy: { TransferDate: 'desc' },
      });

      return resourceResult({
        success: true,
        data: {
          stockTransfers: transfers.map(t => ({
            transferId: t.TransferId,
            productName: t.FinishedProducts?.Items?.ItemName || "",
            transferQuantity: Number(t.TransferQuantity),
            sourceLocationName: t.Locations_StockTransfers_SourceLocationIdToLocations?.LocationName || "",
            destLocationName: t.Locations_StockTransfers_DestLocationIdToLocations?.LocationName || "",
            status: t.Status,
            transferDate: t.TransferDate ? t.TransferDate.toISOString().split("T")[0] : "",
          })),
        },
      });
    }

    return resourceResult({ success: false, message: "Unknown report type" });
  });
}
