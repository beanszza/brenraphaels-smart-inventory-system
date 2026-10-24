import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import InventoryPage from "@/app/(root)/inventory/page";
import { inventoryPages } from "@/lib/inventory/screen-data";
import { InventorySkeleton } from "@/components/inventory/InventorySkeleton";
const fake = vi.hoisted(() => ({ guard: vi.fn(), balances: vi.fn(), lots: vi.fn() }));
vi.mock("@/lib/portal/staff", () => ({ requireModule: fake.guard }));
vi.mock("@/app/actions/inventory/balances", () => ({ listInventory: fake.balances }));
vi.mock("@/app/actions/inventory/lots", () => ({ listLots: fake.lots }));
vi.mock("@/components/pages/ViewInventory", () => ({ default: ({ initialTotal }: { initialTotal: number }) => <div>Inventory total: {initialTotal}</div> }));
beforeEach(() => {
  vi.resetAllMocks();
  for (const load of [fake.balances, fake.lots]) load.mockResolvedValue({ success: true, data: { items: [], totalCount: 0 } });
});
it.each(["denied", "Portal unavailable"])("requires Inventory before reads: %s", async reason => {
  fake.guard.mockRejectedValue(new Error(reason));
  await expect(InventoryPage()).rejects.toThrow(reason);
  expect(fake.balances).not.toHaveBeenCalled();
  expect(fake.lots).not.toHaveBeenCalled();
});
it("renders server data after requiring the Module", async () => {
  expect(renderToStaticMarkup(await InventoryPage())).toContain("Inventory total: 0");
  expect(fake.guard).toHaveBeenCalledWith("Inventory");
});
it("loads subsequent pages for complete summaries and filters", async () => {
  const load = vi.fn().mockResolvedValueOnce({ success: true, data: { items: [1, 2], totalCount: 3 } })
    .mockResolvedValueOnce({ success: true, data: { items: [3], totalCount: 3 } });
  expect(await inventoryPages(load, "pageSize=2")).toEqual({ items: [1, 2, 3], totalCount: 3 });
  expect(load).toHaveBeenLastCalledWith("pageSize=2&page=2");
});
it("surfaces failed reads instead of empty success", async () => {
  fake.lots.mockResolvedValue({ success: false, message: "Offline" });
  await expect(InventoryPage()).rejects.toThrow("Inventory could not be loaded");
});
it("rejects incomplete pagination instead of looping", async () => {
  await expect(inventoryPages(vi.fn().mockResolvedValue({ success: true, data: { items: [], totalCount: 1 } }), "")).rejects.toThrow("changed while loading");
});
it("provides accessible route and lot skeletons", () => {
  for (const compact of [true, false]) {
    const html = renderToStaticMarkup(<InventorySkeleton compact={compact} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading Inventory"');
    expect(html).toContain('animate-pulse');
  }
});

