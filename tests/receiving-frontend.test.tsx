import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import GoodsReceivingPage from "@/app/(root)/goods-receiving/page";
import type { ResourceResult } from "@/lib/resources/result";
import { receivingData, receivingDeliveries } from "@/lib/receiving/screen-data";
import { ReceivingSkeleton } from "@/components/receiving/ReceivingSkeleton";
import GrnTab from "@/components/receiving/GrnTab";
import DiscrepancyTab from "@/components/receiving/DiscrepancyTab";
import StockInTab from "@/components/receiving/StockInTab";
import RtvTab from "@/components/receiving/RtvTab";
import LossReportTab from "@/components/receiving/LossReportTab";
import type { ArrivedDelivery, Discrepancy, LossReport, RtvRecord, StockIn } from "@/components/receiving/types";

const fake = vi.hoisted(() => ({ guard: vi.fn(), counts: vi.fn(), receipts: vi.fn(), deliveries: vi.fn(),
  discrepancies: vi.fn(), stock: vi.fn(), returns: vi.fn(), losses: vi.fn() }));
vi.mock("@/lib/portal/staff", () => ({ requireModule: fake.guard }));
vi.mock("@/app/actions/receiving/lookups", () => ({ getReceivingCounts: fake.counts }));
vi.mock("@/app/actions/receiving/receipts", () => ({ listReceipts: fake.receipts }));
vi.mock("@/app/actions/receiving/procurement-reads", () => ({ listDeliveriesForReceiving: fake.deliveries }));
vi.mock("@/app/actions/receiving/discrepancies", () => ({ listDiscrepancies: fake.discrepancies }));
vi.mock("@/app/actions/receiving/stock-ins", () => ({ listStockIns: fake.stock }));
vi.mock("@/app/actions/receiving/returns", () => ({ listReturns: fake.returns }));
vi.mock("@/app/actions/receiving/losses", () => ({ listLossReports: fake.losses }));
vi.mock("@/lib/receiving/client", () => ({ receiving: {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/context/StaffContext", () => ({ useStaff: () => ({ name: "Staff", username: "staff" }) }));

beforeEach(() => {
  vi.clearAllMocks(); fake.guard.mockResolvedValue({ username: "staff" });
  fake.counts.mockResolvedValue({ success: true, data: { grn: 1, discrepancies: 2, stockin: 3, rtv: 4, loss: 5 } });
  for (const load of [fake.receipts, fake.discrepancies, fake.stock, fake.returns, fake.losses]) {
    load.mockResolvedValue({ success: true, data: [] });
  }
  fake.deliveries.mockResolvedValue({ success: true, data: { items: [], totalCount: 0, pageSize: 100 } });
});

it.each(["grn", "discrepancies", "stockin", "rtv", "loss"])("server loads the %s tab before rendering", async tab => {
  const page = await GoodsReceivingPage({ searchParams: Promise.resolve({ tab }) });
  const html = renderToStaticMarkup(page);
  expect(fake.guard).toHaveBeenCalledWith("Goods Receiving");
  expect(html).toMatch(new RegExp(`aria-current="page"[^>]*href="/goods-receiving\\?tab=${tab}"`));
  expect(html).not.toContain("Loading Goods Receiving");
  const expected = { grn: fake.receipts, discrepancies: fake.discrepancies, stockin: fake.stock, rtv: fake.returns, loss: fake.losses }[tab]!;
  expect(expected).toHaveBeenCalledOnce();
  for (const read of [fake.receipts, fake.discrepancies, fake.stock, fake.returns, fake.losses]) {
    if (read !== expected) expect(read).not.toHaveBeenCalled();
  }
});

it.each(["denied", "invalid session", "Portal unavailable"])("does not load data when access is %s", async reason => {
  fake.guard.mockRejectedValue(new Error(reason));
  await expect(GoodsReceivingPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(reason);
  for (const read of [fake.counts, fake.receipts, fake.deliveries, fake.discrepancies, fake.stock, fake.returns, fake.losses]) {
    expect(read).not.toHaveBeenCalled();
  }
});

it("defaults unknown and repeated tab parameters to receiving", async () => {
  for (const tab of ["unknown", ["rtv", "loss"]]) {
    const page = await GoodsReceivingPage({ searchParams: Promise.resolve({ tab }) });
    expect(renderToStaticMarkup(page)).toMatch(/aria-current="page"[^>]*href="\/goods-receiving\?tab=grn"/);
  }
});

it("fails visibly instead of rendering a failed read as an empty list", async () => {
  fake.returns.mockResolvedValue({ success: false, message: "private database detail" });
  await expect(GoodsReceivingPage({ searchParams: Promise.resolve({ tab: "rtv" }) })).rejects.toThrow("Goods Receiving data could not be loaded");
  expect(() => receivingData({ success: false })).toThrow("could not be loaded");
});

it("loads deliveries beyond the first hundred and refuses partial failures", async () => {
  const rows = Array.from({ length: 251 }, (_, deliveryId) => ({ deliveryId }));
  const load = vi.fn(async (query: string): Promise<ResourceResult> => {
    const params = new URLSearchParams(query);
    expect(params.get("status")).toBe("Arrived");
    const page = Number(params.get("page"));
    return { success: true, data: { items: rows.slice((page - 1) * 100, page * 100), totalCount: 251, pageSize: 100 } };
  });
  expect(await receivingDeliveries(load)).toEqual(rows);
  expect(load).toHaveBeenCalledTimes(3);
  load.mockImplementation(async query => query.includes("page=2&") ? { success: false, data: undefined } :
    { success: true, data: { items: rows.slice(0, 100), totalCount: 251, pageSize: 100 } });
  await expect(receivingDeliveries(load)).rejects.toThrow("could not be loaded");
});

it("renders every tab's supplied records without running browser effects", () => {
  const delivery = { deliveryId: 1, deliveryNumber: "DEL-SERVER", supplierName: "Supplier", status: "Arrived" } as ArrivedDelivery;
  const discrepancy = { discrepancyId: 1, discrepancyNumber: "DISC-SERVER", discrepancyType: "PartialShort", status: "Open", discrepancyQuantity: 2, createdAt: "2026-10-24" } as Discrepancy;
  const stock = { stockInId: 1, stockInNumber: "STK-SERVER", status: "PendingApproval", createdAt: "2026-10-24", lines: [] } as unknown as StockIn;
  const rtv = { rtvId: 1, rtvNumber: "RTV-SERVER", status: "PendingApproval", createdAt: "2026-10-24" } as RtvRecord;
  const loss = { lossReportId: 1, lossReportNumber: "LOSS-SERVER", lostQuantity: 2, createdAt: "2026-10-24" } as LossReport;
  const cases = [
    [<GrnTab key="GrnTab" initialReceipts={[]} initialDeliveries={[delivery]} />, "DEL-SERVER"],
    [<DiscrepancyTab key="DiscrepancyTab" initialDiscrepancies={[discrepancy]} />, "DISC-SERVER"],
    [<StockInTab key="StockInTab" initialStockIns={[stock]} />, "STK-SERVER"],
    [<RtvTab key="RtvTab" initialReturns={[rtv]} />, "RTV-SERVER"],
    [<LossReportTab key="LossReportTab" initialLossReports={[loss]} />, "LOSS-SERVER"],
  ] as const;
  for (const [component, number] of cases) expect(renderToStaticMarkup(component)).toContain(number);
});

it("provides an accessible skeleton state", () => {
  const html = renderToStaticMarkup(<ReceivingSkeleton />);
  expect(html).toContain('role="status"');
  expect(html).toContain("Loading Goods Receiving");
  expect(html).not.toContain("animate-spin");
});
