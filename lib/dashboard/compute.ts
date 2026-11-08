import type {
  BranchFlow, CategorySlice, InventoryForecast, ProcurementMonth, ProcurementRecommendation,
  QualitySlice, SupplierScore, Urgency,
} from "./types";

/** Pure calculations over rows already read from the database. Nothing here touches I/O. */

export type ItemRow = {
  itemId: number; name: string; category: string; unit: string;
  min: number; max: number; stock: number; incoming: number;
};
export type OrderRow = { orderDate: Date; status: string; total: number };
export type BatchRow = { productionDate: Date; status: string; qualityStatus: string };
export type SupplierOrderRow = { supplier: string; orderDate: Date; expected: Date; firstReceived: Date | null };
export type SupplierReceiptRow = { supplier: string; rejected: boolean };
export type TransferRow = { branch: string; status: string; receivedDate: Date | null };

const PALETTE = ["#2563eb", "#7c3aed", "#16a34a", "#ca8a04", "#e11d48", "#0891b2", "#ea580c"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const round1 = (n: number) => Math.round(n * 10) / 10;
const DAY = 86_400_000;

export function isLowStock(item: Pick<ItemRow, "stock" | "min">) {
  return item.stock <= item.min;
}

export function inventoryByCategory(items: ItemRow[]): CategorySlice[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.category || "Uncategorized", (counts.get(item.category || "Uncategorized") ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
}

const inMonth = (date: Date, year: number, month: number) => date.getUTCFullYear() === year && date.getUTCMonth() === month;

/** Last six calendar months ending at `now`, oldest first, including months with no orders. Drafts and cancelled orders are not demand. */
export function procurementTrend(orders: OrderRow[], now: Date): ProcurementMonth[] {
  const counted = orders.filter((o) => !["draft", "cancelled"].includes(o.status.toLowerCase()));
  return Array.from({ length: 6 }, (_, back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - back), 1));
    const inside = counted.filter((o) => inMonth(o.orderDate, d.getUTCFullYear(), d.getUTCMonth()));
    return { month: MONTHS[d.getUTCMonth()], orders: inside.length, valueK: round1(inside.reduce((s, o) => s + o.total, 0) / 1000) };
  });
}

export function productionQuality(batches: BatchRow[]): QualitySlice[] {
  let passed = 0, rejected = 0, cancelled = 0, inProgress = 0;
  for (const b of batches) {
    const status = b.status.toLowerCase(), quality = b.qualityStatus.toLowerCase();
    if (status === "cancelled") cancelled++;
    else if (status === "rejected" || quality === "rejected") rejected++;
    else if (quality === "passed") passed++;
    else inProgress++;
  }
  return [
    { name: "Passed", value: passed, color: "#16a34a" },
    { name: "Rejected", value: rejected, color: "#e11d48" },
    { name: "Cancelled", value: cancelled, color: "#dc2626" },
    { name: "In progress", value: inProgress, color: "#ca8a04" },
  ].filter((s) => s.value > 0);
}

/** Percentage change against the previous month; null when there is nothing to compare. */
export function batchesTrend(batches: BatchRow[], now: Date): { thisMonth: number; trend: number | null } {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const thisMonth = batches.filter((b) => inMonth(b.productionDate, now.getUTCFullYear(), now.getUTCMonth())).length;
  const last = batches.filter((b) => inMonth(b.productionDate, prev.getUTCFullYear(), prev.getUTCMonth())).length;
  return { thisMonth, trend: last > 0 ? round1(((thisMonth - last) / last) * 100) : null };
}

/** Lead time and punctuality come from the first receipt against each order; defects from rejected receipts. */
export function supplierPerformance(orders: SupplierOrderRow[], receipts: SupplierReceiptRow[]): SupplierScore[] {
  const names = new Set([...orders.map((o) => o.supplier), ...receipts.map((r) => r.supplier)]);
  const scores: SupplierScore[] = [];
  for (const supplier of names) {
    const received = orders.filter((o) => o.supplier === supplier && o.firstReceived);
    const grns = receipts.filter((r) => r.supplier === supplier);
    if (!received.length && !grns.length) continue;
    const lead = received.map((o) => (o.firstReceived!.getTime() - o.orderDate.getTime()) / DAY);
    const onTime = received.filter((o) => o.firstReceived!.getTime() <= o.expected.getTime() + DAY - 1).length;
    scores.push({
      supplier,
      avgLeadDays: received.length ? round1(lead.reduce((s, d) => s + d, 0) / received.length) : 0,
      onTimeRate: received.length ? round1((onTime / received.length) * 100) : 0,
      defectRate: grns.length ? round1((grns.filter((g) => g.rejected).length / grns.length) * 100) : 0,
    });
  }
  return scores;
}

export function distributionByBranch(transfers: TransferRow[]): BranchFlow[] {
  const byBranch = new Map<string, BranchFlow>();
  for (const t of transfers) {
    const row = byBranch.get(t.branch) ?? { branch: t.branch, transfers: 0, received: 0 };
    row.transfers++;
    if (t.receivedDate || t.status.toLowerCase() === "received") row.received++;
    byBranch.set(t.branch, row);
  }
  return [...byBranch.values()].sort((a, b) => b.transfers - a.transfers);
}

const RANK: Record<Urgency, number> = { High: 0, Medium: 1, Low: 2 };

/** Average daily use over the history actually available (at most `window` days, at least one week). */
export function dailyUsage(used: number, historyDays: number, window = 90) {
  return used / Math.max(7, Math.min(window, historyDays));
}

export function inventoryForecasts(items: ItemRow[], used: Map<number, number>, historyDays: number): InventoryForecast[] {
  const out: InventoryForecast[] = [];
  for (const item of items) {
    const perDay = dailyUsage(Math.abs(used.get(item.itemId) ?? 0), historyDays);
    if (perDay <= 0) continue;
    const daysRemaining = Math.max(0, Math.floor(item.stock / perDay));
    out.push({
      sku: `ITEM-${item.itemId}`, item: item.name, currentStock: item.stock, unit: item.unit,
      forecastedDemand: Math.ceil(perDay * 30), daysRemaining,
      urgency: daysRemaining <= 7 ? "High" : daysRemaining <= 21 ? "Medium" : "Low",
    });
  }
  return out.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 6);
}

export function procurementRecommendations(
  items: ItemRow[], used: Map<number, number>, historyDays: number, supplierFor: Map<number, string>,
): ProcurementRecommendation[] {
  const out: ProcurementRecommendation[] = [];
  for (const item of items) {
    const available = item.stock + item.incoming;
    const qty = Math.ceil(item.max - available);
    const perDay = dailyUsage(Math.abs(used.get(item.itemId) ?? 0), historyDays);
    const days = perDay > 0 ? item.stock / perDay : null;
    const below = item.stock <= item.min && available <= item.min;
    const runningOut = days !== null && days <= 14 && available < item.max;
    if (qty <= 0 || (!below && !runningOut)) continue;
    const urgency: Urgency = item.stock <= 0 || (days !== null && days <= 7) ? "High" : below ? "Medium" : "Low";
    const reason = below
      ? `Stock ${item.stock} is at or below the minimum of ${item.min}${item.incoming > 0 ? `; ${item.incoming} already on open orders` : ""}`
      : `About ${Math.floor(days!)} days of stock left at the recent usage rate`;
    out.push({
      id: `ITEM-${item.itemId}`, item: item.name, supplier: supplierFor.get(item.itemId) ?? "No preferred supplier",
      recommendedQty: qty, unit: item.unit, urgency, reason,
    });
  }
  return out.sort((a, b) => RANK[a.urgency] - RANK[b.urgency] || b.recommendedQty - a.recommendedQty).slice(0, 8);
}

