import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import ProductionPage from "@/app/(root)/production-quality/page";
import { productionTabs, productionTab } from "@/lib/production/screen-data";
import { ProductionSkeleton } from "@/components/production/ProductionSkeleton";
import { lossReportsFromBatches } from "@/lib/production/loss-reports";
import { filterProductionRequests } from "@/lib/production/filters";

const fake = vi.hoisted(() => ({ guard: vi.fn(), requests: vi.fn(), issuances: vi.fn(), batches: vi.fn(),
  qa: vi.fn(), products: vi.fn(), items: vi.fn() }));
vi.mock("@/lib/portal/staff", () => ({ requireModule: fake.guard }));
vi.mock("@/app/actions/production/requests", () => ({ listProductionRequests: fake.requests }));
vi.mock("@/app/actions/production/issuances", () => ({ listIssuances: fake.issuances }));
vi.mock("@/app/actions/production/batches", () => ({ listBatches: fake.batches }));
vi.mock("@/app/actions/production/quality", () => ({ listProductionQa: fake.qa }));
vi.mock("@/app/actions/production/products", () => ({ listFinishedProducts: fake.products }));
vi.mock("@/app/actions/production/lookups", () => ({ listItems: fake.items }));
vi.mock("@/components/pages/ViewProduction", () => ({ default: ({ activeTab, initialRows, initialItems }: {
  activeTab: string; initialRows: { name: string }[]; initialItems: { currentStock: number }[];
}) => <div>{activeTab}: {initialRows.map(row => row.name).join(",")} stock: {initialItems[0]?.currentStock}</div> }));

const readers = () => [fake.requests, fake.issuances, fake.batches, fake.qa, fake.products, fake.items];
beforeEach(() => {
  vi.resetAllMocks();
  for (const reader of readers()) reader.mockResolvedValue({ success: true, data: [{ name: "Persisted product" }] });
  fake.items.mockResolvedValue({ success: true, data: { items: [{ currentStock: 23 }] } });
});

it.each(productionTabs)("guards %s before accessing any records", async tab => {
  fake.guard.mockRejectedValue(new Error("Portal unavailable"));
  await expect(ProductionPage({ searchParams: Promise.resolve({ tab }) })).rejects.toThrow("Portal unavailable");
  for (const reader of readers()) expect(reader).not.toHaveBeenCalled();
});

it.each(productionTabs)("server loads %s and passes persisted rows to the screen", async tab => {
  const html = renderToStaticMarkup(await ProductionPage({ searchParams: Promise.resolve({ tab }) }));
  expect(html).toContain(`${tab}: Persisted product`);
  expect(fake.guard).toHaveBeenCalledWith("Production & Quality");
  expect(readers().reduce((total, reader) => total + reader.mock.calls.length, 0)).toBe(tab === "stockin" ? 2 : 1);
  if (tab === "stockin") expect(html).toContain("stock: 23");
  if (tab === "qa") expect(fake.qa).toHaveBeenCalledWith("status=all");
});

it.each(productionTabs)("surfaces failed %s reads to the retry boundary", async tab => {
  for (const reader of readers()) reader.mockResolvedValue({ success: false, message: "Database offline" });
  await expect(ProductionPage({ searchParams: Promise.resolve({ tab }) })).rejects.toThrow("could not be loaded");
});

it("does not turn a failed stock lookup into invented or empty stock levels", async () => {
  fake.items.mockResolvedValue({ success: false });
  await expect(ProductionPage({ searchParams: Promise.resolve({ tab: "stockin" }) })).rejects.toThrow("Stock levels");
});

it("defaults unknown tabs to Requests", async () => {
  expect(productionTab("untrusted")).toBe("requests");
  await ProductionPage();
  expect(fake.requests).toHaveBeenCalledOnce();
});

it("provides accessible skeletons", () => {
  const html = renderToStaticMarkup(<ProductionSkeleton />);
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-label="Loading Production &amp; Quality"');
  expect(html).toContain("animate-pulse");
});

it("preserves legacy priority aliases and recipe/requester searches locally", () => {
  const base = { reqNumber: "PR-1", productName: "Jam", recipeName: "Purple yam recipe", requestedBy: "cook.one" };
  const rows = [{ ...base, priority: "Normal" }, { ...base, priority: "Priority" }];
  expect(filterProductionRequests(rows, "", "Medium")).toEqual([rows[0]]);
  expect(filterProductionRequests(rows, "", "High")).toEqual([rows[1]]);
  expect(filterProductionRequests(rows, "  YAM  ", "All")).toHaveLength(2);
  expect(filterProductionRequests(rows, "COOK.ONE", "All")).toHaveLength(2);
  expect(filterProductionRequests(rows, "absent", "All")).toEqual([]);
});

it("shows actual rejected-batch consumption and costs without sample records", () => {
  const batch = { batchId: 1, batchNumber: "B-1", productName: "Jam", status: "Rejected", estimatedQuantity: 12,
    totalMaterialCost: 60, consumptions: [{ itemName: "Sugar", lotCode: "LOT-1", quantityUsed: 3, uomAbbr: "kg", unitCost: 20 }] };
  const reports = lossReportsFromBatches([batch, { ...batch, batchId: 2, status: "Completed" }]);
  expect(reports).toHaveLength(1);
  expect(reports[0].totalEstimatedLoss).toBe(60);
  expect(reports[0].items).toEqual([{ itemName: "Sugar", lotNumber: "LOT-1", quantity: 3, uom: "kg", unitCost: 20, totalCost: 60 }]);
  expect(lossReportsFromBatches([{ ...batch, consumptions: [], totalMaterialCost: 0 }])[0].items).toEqual([]);
});
