import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import StockTransferPage from "@/app/(root)/stock-transfer/page";
import AnalyticsPage from "@/app/(root)/distribution-analytics/page";
import { allRows } from "@/lib/stock-transfer/screen-data";
import { TransferSkeleton } from "@/components/stock-transfer/TransferSkeleton";

const fake = vi.hoisted(() => ({ guard: vi.fn(), requests: vi.fn(), transfers: vi.fn(), locations: vi.fn(),
  metrics: vi.fn(), stats: vi.fn() }));
vi.mock("@/lib/portal/staff", () => ({ requireModule: fake.guard }));
vi.mock("@/app/actions/stock-transfer/requests", () => ({ listRequests: fake.requests }));
vi.mock("@/app/actions/stock-transfer/transfers", () => ({ listTransfers: fake.transfers }));
vi.mock("@/app/actions/stock-transfer/locations", () => ({ listLocations: fake.locations }));
vi.mock("@/app/actions/stock-transfer/request-dashboard", () => ({ requestDashboard: fake.metrics }));
vi.mock("@/app/actions/stock-transfer/transfer-dashboard", () => ({ transferDashboard: fake.stats }));
vi.mock("@/components/stock-transfer/StockTransferModule", () => ({ default: ({ requests, locations, activeMainTab }: {
  requests: { requestNumber: string }[]; locations: { locationName: string }[]; activeMainTab: string;
}) => <div>{activeMainTab} {requests.map(r => r.requestNumber).join(",")} {locations.map(l => l.locationName).join(",")}</div> }));
vi.mock("@/components/pages/ViewDistribution", () => ({ default: ({ transfers, stats }: {
  transfers: { transferNumber: string }[]; stats: { total: number };
}) => <div>{transfers.map(t => t.transferNumber).join(",")} total: {stats.total}</div> }));
const readers = () => [fake.requests, fake.transfers, fake.locations, fake.metrics, fake.stats];
beforeEach(() => {
  vi.resetAllMocks();
  fake.requests.mockResolvedValue({ success: true, data: [{ requestNumber: "STR-persisted" }] });
  fake.transfers.mockResolvedValue({ success: true, data: [{ transferNumber: "STF-persisted" }] });
  fake.locations.mockResolvedValue({ success: true, data: [{ locationName: "Branch persisted" }] });
  fake.metrics.mockResolvedValue({ success: true, data: { totalRequests: 25, pendingApproval: 2, approvedRequests: 3,
    dispatchedTransfers: 4, scheduledTransfers: 5 } });
  fake.stats.mockResolvedValue({ success: true, data: { total: 25, pending: 3, dispatched: 4, received: 18 } });
});
it.each(["unsigned", "expired", "denied", "unavailable"])("guards both pages before data reads: %s", async reason => {
  fake.guard.mockRejectedValue(new Error(reason));
  await expect(StockTransferPage()).rejects.toThrow(reason);
  await expect(AnalyticsPage()).rejects.toThrow(reason);
  for (const reader of readers()) expect(reader).not.toHaveBeenCalled();
});
it("server loads persisted requests and location URL tab", async () => {
  const html = renderToStaticMarkup(await StockTransferPage({ searchParams: Promise.resolve({ tab: "locations" }) }));
  expect(html).toContain("locations STR-persisted Branch persisted");
  expect(fake.guard).toHaveBeenCalledWith("Stock Transfer");
  expect(fake.transfers).not.toHaveBeenCalled();
});
it("defaults unknown tabs to transfers", async () => {
  expect(renderToStaticMarkup(await StockTransferPage({ searchParams: Promise.resolve({ tab: "unknown" }) }))).toContain("transfers STR-persisted");
});
it("server loads analytics and preserves persisted dashboard counts", async () => {
  expect(renderToStaticMarkup(await AnalyticsPage())).toContain("STF-persisted total: 25");
  expect(fake.guard).toHaveBeenCalledWith("Stock Transfer");
});
it.each(["requests", "locations", "metrics"] as const)("surfaces failed %s reads to retry boundary", async key => {
  fake[key].mockResolvedValue({ success: false, message: "Database offline" });
  await expect(StockTransferPage()).rejects.toThrow("could not be loaded");
});
it.each(["transfers", "locations", "stats"] as const)("surfaces failed analytics %s reads", async key => {
  fake[key].mockResolvedValue({ success: false });
  await expect(AnalyticsPage()).rejects.toThrow("could not be loaded");
});
it("does not silently truncate lists at 100 records", async () => {
  const reader = vi.fn().mockResolvedValueOnce({ success: true, data: Array.from({ length: 100 }, (_, id) => id),
    pagination: { totalPages: 2 } }).mockResolvedValueOnce({ success: true, data: [100, 101], pagination: { totalPages: 2 } });
  expect(await allRows(reader)).toHaveLength(102);
  expect(reader.mock.calls.map(call => call[0])).toEqual(["page=1&pageSize=100", "page=2&pageSize=100"]);
});
it("does not return a partial list if a subsequent page fails", async () => {
  const reader = vi.fn().mockResolvedValueOnce({ success: true, data: [1], pagination: { totalPages: 2 } })
    .mockResolvedValueOnce({ success: false });
  await expect(allRows(reader)).rejects.toThrow("could not be loaded");
});
it("rejects malformed data and dashboard shapes", async () => {
  fake.requests.mockResolvedValue({ success: true, data: {} });
  await expect(StockTransferPage()).rejects.toThrow("could not be loaded");
  fake.requests.mockResolvedValue({ success: true, data: [] });
  fake.metrics.mockResolvedValue({ success: true, data: {} });
  await expect(StockTransferPage()).rejects.toThrow("metrics could not be loaded");
});
it("provides accessible skeleton loading", () => {
  const html = renderToStaticMarkup(<TransferSkeleton />);
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-label="Loading Stock Transfer"');
  expect(html).toContain("animate-pulse");
});
