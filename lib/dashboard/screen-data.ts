import { prisma } from "@/lib/prisma";
import type { Module } from "@/lib/portal/config";
import {
  batchesTrend, distributionByBranch, inventoryByCategory, inventoryForecasts, isLowStock,
  procurementRecommendations, procurementTrend, productionQuality, supplierPerformance,
  type ItemRow,
} from "./compute";
import type { DashboardAnalytics } from "./types";

/** Orders that have been placed but whose goods are not all in yet. */
const OPEN_ORDER_STATUSES = ["Pending", "Approved", "Ordered", "Arrived"];
const USAGE_WINDOW_DAYS = 90;
const num = (value: unknown) => Number(value ?? 0);

async function loadItems(): Promise<ItemRow[]> {
  const [items, open] = await Promise.all([
    prisma.items.findMany({
      where: { IsActive: true },
      select: {
        ItemId: true, ItemName: true, MinStockLevel: true, MaxStockLevel: true,
        Category: { select: { CategoryName: true } },
        Uom: { select: { Abbreviation: true } },
        Inventories: { select: { CurrentStock: true } },
      },
    }),
    prisma.purchaseOrderItems.findMany({
      where: { PoId: { in: (await prisma.purchaseOrders.findMany({ where: { Status: { in: OPEN_ORDER_STATUSES } }, select: { PoId: true } })).map((p) => p.PoId) } },
      select: { ItemId: true, PoItemQuantity: true, ReceivedQuantity: true },
    }),
  ]);
  const incoming = new Map<number, number>();
  for (const line of open) {
    incoming.set(line.ItemId, (incoming.get(line.ItemId) ?? 0) + Math.max(0, num(line.PoItemQuantity) - num(line.ReceivedQuantity)));
  }
  return items.map((item) => ({
    itemId: item.ItemId, name: item.ItemName, category: item.Category?.CategoryName ?? "", unit: item.Uom?.Abbreviation ?? "",
    min: num(item.MinStockLevel), max: num(item.MaxStockLevel),
    stock: item.Inventories.reduce((sum, row) => sum + num(row.CurrentStock), 0),
    incoming: incoming.get(item.ItemId) ?? 0,
  }));
}

/** Material consumed by production per item, and how many days of ledger history exist to measure it over. */
async function loadUsage(now: Date) {
  const since = new Date(now.getTime() - USAGE_WINDOW_DAYS * 86_400_000);
  const [grouped, earliest] = await Promise.all([
    prisma.stockLedgers.groupBy({
      by: ["ItemId"],
      where: { MovementType: "PRODUCTION_ISSUE", PostedAt: { gte: since } },
      _sum: { Quantity: true },
    }),
    prisma.stockLedgers.aggregate({ _min: { PostedAt: true } }),
  ]);
  const first = earliest._min.PostedAt;
  return {
    used: new Map(grouped.map((g) => [g.ItemId, num(g._sum.Quantity)])),
    historyDays: first ? Math.ceil((now.getTime() - first.getTime()) / 86_400_000) : 0,
  };
}

async function loadSupplierScores() {
  const [suppliers, orders, receipts] = await Promise.all([
    prisma.suppliers.findMany({ select: { SupplierId: true, CompanyName: true } }),
    prisma.purchaseOrders.findMany({
      where: { Status: { notIn: ["Draft", "Cancelled"] } },
      select: { PoId: true, SupplierId: true, OrderDate: true, ExpectedArrivalDate: true },
    }),
    prisma.goodsReceipts.findMany({
      where: { Status: { not: "Cancelled" } },
      select: { PoId: true, SupplierId: true, ReceivedDate: true, Status: true },
    }),
  ]);
  const names = new Map(suppliers.map((s) => [s.SupplierId, s.CompanyName]));
  const firstReceived = new Map<number, Date>();
  for (const r of receipts) {
    const seen = firstReceived.get(r.PoId);
    if (!seen || r.ReceivedDate < seen) firstReceived.set(r.PoId, r.ReceivedDate);
  }
  return supplierPerformance(
    orders.map((o) => ({
      supplier: names.get(o.SupplierId) ?? `Supplier ${o.SupplierId}`,
      orderDate: o.OrderDate, expected: o.ExpectedArrivalDate, firstReceived: firstReceived.get(o.PoId) ?? null,
    })),
    receipts.map((r) => ({ supplier: names.get(r.SupplierId) ?? `Supplier ${r.SupplierId}`, rejected: r.Status === "Rejected" })),
  );
}

async function loadPreferredSuppliers() {
  const [links, suppliers] = await Promise.all([
    prisma.supplierItems.findMany({ where: { IsActive: true }, select: { ItemId: true, SupplierId: true, IsPreferred: true } }),
    prisma.suppliers.findMany({ where: { IsActive: true }, select: { SupplierId: true, CompanyName: true } }),
  ]);
  const names = new Map(suppliers.map((s) => [s.SupplierId, s.CompanyName]));
  const chosen = new Map<number, string>();
  for (const link of [...links].sort((a, b) => Number(a.IsPreferred) - Number(b.IsPreferred))) {
    const name = names.get(link.SupplierId);
    if (name) chosen.set(link.ItemId, name); // preferred links are written last, so they win
  }
  return chosen;
}

/**
 * Every figure the Dashboard shows, read live from the IMS database. A section is only read when
 * Staff hold the Module that owns its data; a failed read throws so it can never look like zero.
 */
export async function loadDashboardAnalytics(modules: readonly Module[], now = new Date()): Promise<DashboardAnalytics> {
  const has = (module: Module) => modules.includes(module);
  const wantsStock = has("Inventory") || has("Orders & Procurement");

  const [items, usage, suppliers, preferred, orders, batches, transfers, activeSuppliers] = await Promise.all([
    wantsStock ? loadItems() : null,
    wantsStock ? loadUsage(now) : null,
    has("Orders & Procurement") ? loadSupplierScores() : null,
    has("Orders & Procurement") ? loadPreferredSuppliers() : null,
    has("Orders & Procurement")
      ? prisma.purchaseOrders.findMany({ select: { OrderDate: true, Status: true, TotalAmount: true } })
      : null,
    has("Production & Quality")
      ? prisma.productionBatches.findMany({ select: { ProductionDate: true, Status: true, QualityStatus: true } })
      : null,
    has("Stock Transfer")
      ? prisma.stockTransfers.findMany({
          select: {
            Status: true, ReceivedDate: true,
            Locations_StockTransfers_DestLocationIdToLocations: { select: { LocationName: true } },
          },
        })
      : null,
    has("Resources & Suppliers") ? prisma.suppliers.count({ where: { IsActive: true } }) : null,
  ]);

  const batchRows = batches?.map((b) => ({ productionDate: b.ProductionDate, status: b.Status, qualityStatus: b.QualityStatus }));
  const batchFigures = batchRows ? batchesTrend(batchRows, now) : null;
  const canSeeStock = has("Inventory");

  return {
    generatedAt: now.toISOString(),
    kpis: {
      activeInventory: items && canSeeStock ? { value: items.length, unit: "Items", trend: null } : null,
      lowStockAlerts: items && canSeeStock ? { value: items.filter(isLowStock).length, unit: "Items", trend: null } : null,
      productionBatches: batchFigures ? { value: batchFigures.thisMonth, unit: "This month", trend: batchFigures.trend } : null,
      activeSuppliers: activeSuppliers === null ? null : { value: activeSuppliers, unit: "Suppliers", trend: null },
    },
    inventoryDistribution: items && canSeeStock ? inventoryByCategory(items) : null,
    procurementTrend: orders ? procurementTrend(orders.map((o) => ({ orderDate: o.OrderDate, status: o.Status, total: num(o.TotalAmount) })), now) : null,
    productionQuality: batchRows ? productionQuality(batchRows) : null,
    supplierPerformance: suppliers,
    distribution: transfers
      ? distributionByBranch(transfers.map((t) => ({
          branch: t.Locations_StockTransfers_DestLocationIdToLocations?.LocationName ?? "Unknown location",
          status: t.Status, receivedDate: t.ReceivedDate,
        })))
      : null,
    procurementRecommendations: items && usage && preferred && has("Orders & Procurement")
      ? procurementRecommendations(items, usage.used, usage.historyDays, preferred) : null,
    inventoryForecasts: items && usage && canSeeStock ? inventoryForecasts(items, usage.used, usage.historyDays) : null,
  };
}

