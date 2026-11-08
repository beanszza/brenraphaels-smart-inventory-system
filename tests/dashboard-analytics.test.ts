import { describe, expect, it } from "vitest";
import {
  batchesTrend, dailyUsage, distributionByBranch, inventoryByCategory, inventoryForecasts,
  procurementRecommendations, procurementTrend, productionQuality, supplierPerformance, type ItemRow,
} from "@/lib/dashboard/compute";

const now = new Date("2026-11-06T00:00:00Z");
const item = (over: Partial<ItemRow>): ItemRow => ({
  itemId: 1, name: "Flour", category: "Raw Materials", unit: "kg", min: 10, max: 100, stock: 50, incoming: 0, ...over,
});

describe("dashboard calculations", () => {
  it("counts active items per category, largest first", () => {
    const slices = inventoryByCategory([item({}), item({ itemId: 2 }), item({ itemId: 3, category: "Packaging" })]);
    expect(slices.map((s) => [s.name, s.value])).toEqual([["Raw Materials", 2], ["Packaging", 1]]);
  });

  it("buckets six calendar months oldest first, skipping drafts and cancelled orders", () => {
    const trend = procurementTrend([
      { orderDate: new Date("2026-11-02T00:00:00Z"), status: "Ordered", total: 2500 },
      { orderDate: new Date("2026-11-03T00:00:00Z"), status: "Cancelled", total: 9999 },
      { orderDate: new Date("2026-09-15T00:00:00Z"), status: "Completed", total: 1000 },
      { orderDate: new Date("2026-10-01T00:00:00Z"), status: "Draft", total: 5000 },
    ], now);
    expect(trend.map((t) => t.month)).toEqual(["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
    expect(trend[5]).toEqual({ month: "Nov", orders: 1, valueK: 2.5 });
    expect(trend[3]).toEqual({ month: "Sep", orders: 1, valueK: 1 });
    expect(trend[4].orders).toBe(0);
  });

  it("classifies batches and omits empty slices", () => {
    const slices = productionQuality([
      { productionDate: now, status: "Stocked In", qualityStatus: "Passed" },
      { productionDate: now, status: "Cancelled", qualityStatus: "" },
      { productionDate: now, status: "Rejected", qualityStatus: "Rejected" },
      { productionDate: now, status: "In Progress", qualityStatus: "" },
    ]);
    expect(slices.map((s) => [s.name, s.value])).toEqual([["Passed", 1], ["Rejected", 1], ["Cancelled", 1], ["In progress", 1]]);
    expect(productionQuality([])).toEqual([]);
  });

  it("compares batches with last month and gives no trend without one", () => {
    const b = (date: string) => ({ productionDate: new Date(date), status: "", qualityStatus: "" });
    expect(batchesTrend([b("2026-11-01"), b("2026-11-02"), b("2026-10-05")], now)).toEqual({ thisMonth: 2, trend: 100 });
    expect(batchesTrend([b("2026-11-01")], now)).toEqual({ thisMonth: 1, trend: null });
  });

  it("scores suppliers from first receipts and rejected receipts", () => {
    const scores = supplierPerformance(
      [
        { supplier: "A", orderDate: new Date("2026-09-01T00:00:00Z"), expected: new Date("2026-09-05T00:00:00Z"), firstReceived: new Date("2026-09-03T00:00:00Z") },
        { supplier: "A", orderDate: new Date("2026-09-10T00:00:00Z"), expected: new Date("2026-09-12T00:00:00Z"), firstReceived: new Date("2026-09-16T00:00:00Z") },
        { supplier: "A", orderDate: new Date("2026-09-20T00:00:00Z"), expected: new Date("2026-09-22T00:00:00Z"), firstReceived: null },
      ],
      [{ supplier: "A", rejected: true }, { supplier: "A", rejected: false }, { supplier: "A", rejected: false }, { supplier: "A", rejected: false }],
    );
    expect(scores).toEqual([{ supplier: "A", avgLeadDays: 4, onTimeRate: 50, defectRate: 25 }]);
  });

  it("groups transfers by destination and counts the received ones", () => {
    expect(distributionByBranch([
      { branch: "North", status: "Received", receivedDate: new Date() },
      { branch: "North", status: "In Transit", receivedDate: null },
      { branch: "South", status: "Received", receivedDate: null },
    ])).toEqual([{ branch: "North", transfers: 2, received: 1 }, { branch: "South", transfers: 1, received: 1 }]);
  });

  it("measures usage over the history that exists, never over a longer window", () => {
    expect(dailyUsage(90, 30)).toBe(3);
    expect(dailyUsage(90, 400)).toBe(1);
    expect(dailyUsage(14, 1)).toBe(2);
  });

  it("forecasts only items with recorded usage, soonest to run out first", () => {
    const items = [item({ itemId: 1, stock: 10 }), item({ itemId: 2, stock: 500 }), item({ itemId: 3 })];
    const out = inventoryForecasts(items, new Map([[1, -30], [2, -30]]), 30);
    expect(out.map((f) => [f.sku, f.daysRemaining, f.urgency, f.forecastedDemand])).toEqual([
      ["ITEM-1", 10, "Medium", 30], ["ITEM-2", 500, "Low", 30],
    ]);
  });

  it("recommends reorders from stock, open orders and usage, with no random input", () => {
    const supplier = new Map([[1, "Acme"]]);
    const recs = procurementRecommendations(
      [
        item({ itemId: 1, stock: 0, min: 10, max: 100 }),
        item({ itemId: 2, stock: 5, min: 10, max: 100, incoming: 200 }),
        item({ itemId: 3, stock: 80, min: 10, max: 100 }),
      ],
      new Map(), 30, supplier,
    );
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ id: "ITEM-1", supplier: "Acme", recommendedQty: 100, urgency: "High" });
  });
});
