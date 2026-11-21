import { prisma } from "@/lib/prisma";
import type { Module } from "@/lib/portal/config";
import {
  batchesTrend, batchesTrendForRange, distributionByBranch, inventoryByCategory, inventoryForecasts, isLowStock,
  procurementRecommendations, procurementTrend, procurementTrendForRange, productionQuality, supplierPerformance,
  type ItemRow,
} from "./compute";
import type { DashboardAnalytics, DashboardDateRange } from "./types";

/** Orders that have been placed but whose goods are not all in yet. */
const OPEN_ORDER_STATUSES = ["Pending", "Approved", "Ordered", "Arrived"];
const USAGE_WINDOW_DAYS = 90;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (value: unknown) => Number(value ?? 0);

type ParsedRange = {
  from: Date;
  to: Date;
  spanDays: number;
  normalized: DashboardDateRange;
};

function parseDateRange(range?: DashboardDateRange | null): ParsedRange | null {
  if (!range || !ISO_DATE_RE.test(range.from) || !ISO_DATE_RE.test(range.to)) return null;
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  const spanDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
  return {
    from,
    to,
    spanDays,
    normalized: { from: range.from, to: range.to, ...(range.label ? { label: range.label } : {}) },
  };
}

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
async function loadUsage(now: Date, parsed: ParsedRange | null) {
  const postedFilter = parsed
    ? { gte: parsed.from, lte: parsed.to }
    : { gte: new Date(now.getTime() - USAGE_WINDOW_DAYS * 86_400_000) };

  const [grouped, earliest] = await Promise.all([
    prisma.stockLedgers.groupBy({
      by: ["ItemId"],
      where: { MovementType: "PRODUCTION_ISSUE", PostedAt: postedFilter },
      _sum: { Quantity: true },
    }),
    parsed ? Promise.resolve(null) : prisma.stockLedgers.aggregate({ _min: { PostedAt: true } }),
  ]);

  const historyDays = parsed
    ? parsed.spanDays
    : earliest?._min.PostedAt
      ? Math.ceil((now.getTime() - earliest._min.PostedAt.getTime()) / 86_400_000)
      : 0;

  return {
    used: new Map(grouped.map((g) => [g.ItemId, num(g._sum.Quantity)])),
    historyDays,
  };
}

async function loadSupplierScores(parsed: ParsedRange | null) {
  const [suppliers, orders, receipts] = await Promise.all([
    prisma.suppliers.findMany({ select: { SupplierId: true, CompanyName: true } }),
    prisma.purchaseOrders.findMany({
      where: {
        Status: { notIn: ["Draft", "Cancelled"] },
        ...(parsed ? { OrderDate: { gte: parsed.from, lte: parsed.to } } : {}),
      },
      select: { PoId: true, SupplierId: true, OrderDate: true, ExpectedArrivalDate: true },
    }),
    prisma.goodsReceipts.findMany({
      where: {
        Status: { not: "Cancelled" },
        ...(parsed ? { ReceivedDate: { gte: parsed.from, lte: parsed.to } } : {}),
      },
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
export async function loadDashboardAnalytics(
  modules: readonly Module[],
  now = new Date(),
  range?: DashboardDateRange | null,
): Promise<DashboardAnalytics> {
  const parsed = parseDateRange(range);
  const has = (module: Module) => modules.includes(module);
  const wantsStock = has("Inventory") || has("Orders & Procurement");

  const [items, usage, suppliers, preferred, orders, batches, transfers, activeSuppliers] = await Promise.all([
    wantsStock ? loadItems() : null,
    wantsStock ? loadUsage(now, parsed) : null,
    has("Orders & Procurement") ? loadSupplierScores(parsed) : null,
    has("Orders & Procurement") ? loadPreferredSuppliers() : null,
    has("Orders & Procurement")
      ? prisma.purchaseOrders.findMany({
          where: parsed ? { OrderDate: { gte: parsed.from, lte: parsed.to } } : undefined,
          select: { OrderDate: true, Status: true, TotalAmount: true },
        })
      : null,
    has("Production & Quality")
      ? prisma.productionBatches.findMany({ select: { ProductionDate: true, Status: true, QualityStatus: true } })
      : null,
    has("Stock Transfer")
      ? prisma.stockTransfers.findMany({
          where: parsed ? { TransferDate: { gte: parsed.from, lte: parsed.to } } : undefined,
          select: {
            Status: true, ReceivedDate: true,
            Locations_StockTransfers_DestLocationIdToLocations: { select: { LocationName: true } },
          },
        })
      : null,
    has("Resources & Suppliers") ? prisma.suppliers.count({ where: { IsActive: true } }) : null,
  ]);

  const batchRows = batches?.map((b) => ({ productionDate: b.ProductionDate, status: b.Status, qualityStatus: b.QualityStatus }));
  const filteredBatches = batchRows && parsed
    ? batchRows.filter((b) => b.productionDate >= parsed.from && b.productionDate <= parsed.to)
    : batchRows;
  const batchFigures = batchRows
    ? parsed
      ? batchesTrendForRange(batchRows, parsed.from, parsed.to)
      : batchesTrend(batchRows, now)
    : null;
  const canSeeStock = has("Inventory");

  return {
    generatedAt: now.toISOString(),
    dateRange: parsed ? parsed.normalized : null,
    kpis: {
      activeInventory: items && canSeeStock ? { value: items.length, unit: "Items", trend: null } : null,
      lowStockAlerts: items && canSeeStock ? { value: items.filter(isLowStock).length, unit: "Items", trend: null } : null,
      productionBatches: batchFigures ? { value: batchFigures.thisMonth, unit: parsed ? "In range" : "This month", trend: batchFigures.trend } : null,
      activeSuppliers: activeSuppliers === null ? null : { value: activeSuppliers, unit: "Suppliers", trend: null },
    },
    inventoryDistribution: items && canSeeStock ? inventoryByCategory(items) : null,
    procurementTrend: orders
      ? parsed
        ? procurementTrendForRange(orders.map((o) => ({ orderDate: o.OrderDate, status: o.Status, total: num(o.TotalAmount) })), parsed.from, parsed.to)
        : procurementTrend(orders.map((o) => ({ orderDate: o.OrderDate, status: o.Status, total: num(o.TotalAmount) })), now)
      : null,
    productionQuality: filteredBatches ? productionQuality(filteredBatches) : null,
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
