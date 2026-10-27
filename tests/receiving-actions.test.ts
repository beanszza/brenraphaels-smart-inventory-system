/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEventInput } from "@/lib/gateway/audit";
import type { NotificationInput } from "@/lib/gateway/notifications";
import * as receipts from "@/app/actions/receiving/receipts";
import * as quality from "@/app/actions/receiving/quality";
import * as stock from "@/app/actions/receiving/stock-ins";
import * as discrepancies from "@/app/actions/receiving/discrepancies";
import * as returns from "@/app/actions/receiving/returns";
import * as losses from "@/app/actions/receiving/losses";
import * as lookups from "@/app/actions/receiving/lookups";
import * as procurement from "@/app/actions/receiving/procurement-reads";
import GoodsReceivingPage from "@/app/(root)/goods-receiving/page";
import type { ResourceResult } from "@/lib/resources/result";

const fake = vi.hoisted(() => ({
  dataAccess: vi.fn(), signed: true, decision: "allowed", status: {} as Record<string, string>,
  written: [] as AuditEventInput[], sent: [] as { ids: string[]; input: NotificationInput }[],
  pending: [] as { model: string; data: Record<string, unknown> }[],
  committed: [] as { model: string; data: Record<string, unknown> }[],
  transactionOpen: false, commitFails: false, gatewayFails: false, missing: false, foreignLine: false, knownMissing: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-return-to": "/goods-receiving" }),
  cookies: async () => ({ get: () => fake.signed ? { value: "opaque" } : undefined }),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`Redirect: ${url}`); } }));
vi.mock("@/components/pages/ViewGoodsReceiving", () => ({ default: () => null }));
vi.mock("@/lib/gateway/audit", () => ({
  WRITE_TIMEOUT_MS: 3000,
  gatewayPort: { writeAudit: async (event: AuditEventInput) => {
    expect(fake.transactionOpen).toBe(false);
    expect(fake.committed.length).toBeGreaterThan(0);
    if (fake.gatewayFails) throw new Error("Audit unavailable");
    fake.written.push(event);
  } },
}));
vi.mock("@/lib/gateway/notifications", () => ({
  SEND_TIMEOUT_MS: 3000,
  notificationGateway: { send: async (ids: string[], input: NotificationInput) => {
    expect(fake.transactionOpen).toBe(false);
    if (fake.gatewayFails) throw new Error("Notifications unavailable");
    fake.sent.push({ ids, input });
  } },
}));

vi.mock("@/lib/prisma", () => {
  const line = () => ({ GrnItemId: 1, ItemId: 1, PoItemId: 1, DeliveryItemId: 1, InspectionItemId: fake.foreignLine ? 2 : 1,
    DeclaredQuantity: 10, DeliveredQuantity: 10, OrderedQuantity: 10, PreviouslyReceivedQuantity: 0,
    VarianceQuantity: 0, PurchaseUomId: 1, ItemName: "Flour", ItemCode: "FLOUR", Category: { CategoryName: "Ingredients" },
    Items: { ItemName: "Flour", UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: { Abbreviation: "kg" } }, UnitOfMeasures: { Abbreviation: "kg" } });
  const row = (model: string) => ({
    GrnId: 1, GrnNumber: "GRN-2026-0001", DeliveryId: 1, DeliveryNumber: "DLV-2026-0001", PoId: 1,
    SupplierId: 1, LocationId: 1, InspectionId: 1, InspectionNumber: "QC-2026-0001", ReferenceType: "GRN", ReferenceId: 1,
    StockInId: 1, StockInNumber: "SI-2026-0001", DiscrepancyId: 1, DiscrepancyNumber: "DSC-2026-0001",
    RtvId: 1, RtvNumber: "RTV-2026-0001", LossReportId: 1, LossReportNumber: "LOSS-2026-0001", LastNumber: 1,
    ...(model === "lossReports" ? { StockLedgerEntryId: BigInt(9) } : {}),
    Status: fake.status[model] || "Draft", CreatedBy: "requester-username", SubmittedBy: "requester-username", IsAcknowledged: false,
    GoodsReceiptItems: [line()], QualityInspectionItems: [line()], DeliveryItems: [line()], StockInLines: [],
    PurchaseOrderItems: [{ PoItemId: 1, ItemId: 1, PoItemQuantity: 10, ReceivedQuantity: 0, TotalPrice: 10, PurchaseUomId: 1 }],
    Deliveries: { DeliveryId: 1 }, PurchaseOrders: { PoNumber: "PO-2026-0001", PurchaseOrderItems: [{ PoItemId: 1, PoItemQuantity: 10, PurchaseUomId: 1 }] },
  });
  const model = (name: string) => ({
    findUnique: async () => fake.missing ? null : row(name),
    findFirst: async () => name === "knownStaff" ? fake.knownMissing ? null : { StaffId: "requester-id" } : name === "locations" ? row(name) : null,
    findMany: async ({ where }: { where?: { Modules?: { has: string } } } = {}) => name === "knownStaff"
      ? [
          { StaffId: "actor-id", Name: "Ada", Username: "actor-username", Modules: ["Goods Receiving"] },
          { StaffId: "approver-id", Name: "Ben", Username: "approver-username", Modules: ["Goods Receiving"] },
          { StaffId: "other-module", Name: "Cook", Username: "cook", Modules: ["Production & Quality"] },
        ].filter(staff => !where?.Modules?.has || staff.Modules.includes(where.Modules.has)) : [],
    count: async () => 0,
    groupBy: async () => [],
    aggregate: async () => ({ _sum: { QuantityToStock: 0, CurrentStock: 5 } }),
    upsert: async () => row(name),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      fake.pending.push({ model: name, data });
      // Prisma returns included relations as rows, not the nested create input.
      return { ...row(name), ...Object.fromEntries(Object.entries(data).filter(([, value]) => value === null || typeof value !== "object")) };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => { fake.pending.push({ model: name, data }); return { ...row(name), ...Object.fromEntries(Object.entries(data).filter(([, value]) => value === null || typeof value !== "object" || value instanceof Date)) }; },
    updateMany: async ({ data }: { data: Record<string, unknown> }) => { fake.pending.push({ model: name, data }); return { count: 1 }; },
    deleteMany: async () => { fake.pending.push({ model: name, data: {} }); return { count: 1 }; },
  });
  const tx = new Proxy({}, { get: (_, key: string) => { fake.dataAccess(key); return model(key); } });
  return { prisma: new Proxy({}, { get: (_, key: string) => {
    fake.dataAccess(key);
    if (key === "$transaction") return async (work: (tx: unknown) => Promise<unknown>) => {
      fake.transactionOpen = true;
      try {
        const result = await work(tx);
        if (fake.commitFails) throw new Error("Commit failed");
        fake.committed.push(...fake.pending);
        return result;
      } finally { fake.pending = []; fake.transactionOpen = false; }
    };
    return model(key);
  } }) };
});

const receipt = { deliveryId: 1, physicalQuantityVerified: true, items: [{ itemId: 1, deliveryItemId: 1, deliveredQuantity: 10 }] };
const inspection = { items: [{ inspectionItemId: 1, acceptedQuantity: 8, rejectedQuantity: 2 }] };
const stockInput = { grnId: 1, submitForApproval: true, lines: [{ grnItemId: 1, itemId: 1, quantityToStock: 10, currentStockBeforeCommit: 999, lotCode: "LOT-1" }] };
const mutations: { name: string; run: () => Promise<ResourceResult>; status?: Record<string, string>; change: string; type: string }[] = [
  { name: "create receipt", run: () => receipts.createReceipt(receipt), status: { deliveries: "Arrived" }, change: "record.created", type: "goods-receipt" },
  { name: "update receipt", run: () => receipts.updateReceipt(1, receipt), change: "record.updated", type: "goods-receipt" },
  { name: "post receipt", run: () => receipts.postReceipt(1), change: "record.updated", type: "goods-receipt" },
  { name: "cancel receipt", run: () => receipts.cancelReceipt(1), change: "record.updated", type: "goods-receipt" },
  { name: "reject receipt", run: () => receipts.rejectReceipt(1, { reason: "Damaged" }), change: "record.updated", type: "goods-receipt" },
  { name: "proceed to QA", run: () => receipts.proceedToQa(1), change: "record.updated", type: "goods-receipt" },
  { name: "complete QA", run: () => quality.completeInspection(1, inspection), status: { qualityInspections: "Pending" }, change: "record.updated", type: "quality-inspection" },
  { name: "create stock-in", run: () => stock.createStockIn(stockInput), status: { goodsReceipts: "Received" }, change: "record.created", type: "stock-in" },
  { name: "submit stock-in", run: () => stock.submitStockIn(1), change: "record.updated", type: "stock-in" },
  { name: "approve stock-in", run: () => stock.approveStockIn(1), status: { stockIns: "PendingApproval" }, change: "record.updated", type: "stock-in" },
  { name: "reject stock-in", run: () => stock.rejectStockIn(1, { reason: "Wrong quantities" }), status: { stockIns: "PendingApproval" }, change: "record.updated", type: "stock-in" },
  { name: "commit stock-in", run: () => stock.commitStockIn(1), status: { stockIns: "Approved" }, change: "record.updated", type: "stock-in" },
  { name: "resolve discrepancy", run: () => discrepancies.resolveDiscrepancy(1, { resolutionType: "Accepted", resolutionNotes: "Checked" }), change: "record.updated", type: "discrepancy" },
  { name: "resolve as loss", run: () => discrepancies.resolveAsLoss(1, { reason: "Damaged" }), change: "record.updated", type: "discrepancy" },
  { name: "resolve as return", run: () => discrepancies.resolveAsReturn(1, { reason: "Wrong goods" }), change: "record.updated", type: "discrepancy" },
  { name: "request return approval", run: () => returns.requestReturnApproval(1), change: "record.updated", type: "supplier-return" },
  { name: "approve return", run: () => returns.approveReturn(1), status: { returnToVendors: "PendingApproval" }, change: "record.updated", type: "supplier-return" },
  { name: "reject return", run: () => returns.rejectReturn(1, { reason: "Wrong lot" }), status: { returnToVendors: "PendingApproval" }, change: "record.updated", type: "supplier-return" },
  { name: "dispatch return", run: () => returns.dispatchReturn(1), status: { returnToVendors: "Approved" }, change: "record.updated", type: "supplier-return" },
  { name: "acknowledge loss", run: () => losses.acknowledgeLoss(1), change: "record.updated", type: "loss-report" },
];

beforeEach(() => {
  Object.assign(fake, { signed: true, decision: "allowed", status: {}, written: [], sent: [], pending: [], committed: [],
    transactionOpen: false, commitFails: false, gatewayFails: false, missing: false, foreignLine: false, knownMissing: false });
  fake.dataAccess.mockClear();
  vi.stubEnv("IMS_DEV_BYPASS", "false"); vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret"); vi.stubEnv("IMS_APP_URL", "https://localhost:3003");
  vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
    expect(JSON.parse(String(init?.body)).module).toBe("Goods Receiving");
    if (fake.decision !== "allowed") return Response.json({ error: fake.decision === "invalid" ? "invalid_handle" : fake.decision }, { status: fake.decision === "invalid" ? 401 : fake.decision === "denied" ? 403 : 503 });
    return Response.json({ active: true, user_id: "actor-id", system: "IMS", module: "Goods Receiving", staff: { name: "Ada", username: "actor-username", email: "ada@example.test" } });
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

for (const test of mutations) {
  it(`${test.name} commits before emitting one IMS audit event`, async () => {
    fake.status = test.status || {};
    expect(await test.run()).toMatchObject({ success: true });
    expect(fake.written).toHaveLength(1);
    expect(fake.written[0]).toMatchObject({ source: "IMS", module: "Goods Receiving", action: test.change,
      actor: { id: "actor-username", display_name: "Ada" }, target: { type: test.type, id: "1" }, outcome: "success" });
    expect(fake.written[0].description).toContain("Ada");
    expect(fake.written[0].description).toContain(fake.written[0].target?.display_name);
    for (const write of fake.committed) {
      for (const field of ["CreatedBy", "ReceivedBy", "SubmittedBy", "ApprovedBy", "RejectedBy", "ResolvedBy", "AcknowledgedBy", "CommittedBy", "CompletedBy", "InspectorId"]) {
        if (write.data[field] !== undefined && write.data[field] !== null) expect(write.data[field]).toBe("actor-username");
      }
      if (write.data.InspectorName) expect(write.data.InspectorName).toBe("Ada");
    }
  });
  it(`${test.name} refuses a missing record without producing events`, async () => {
    fake.status = test.status || {}; fake.missing = true;
    expect(await test.run()).toMatchObject({ success: false });
    expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0); expect(fake.sent).toHaveLength(0);
  });
}

const allActions = { ...receipts, ...quality, ...stock, ...discrepancies, ...returns, ...losses, ...lookups, ...procurement };
for (const [name, action] of Object.entries(allActions).filter(([name]) => /^(list|get)/.test(name))) {
  it(`${name} returns data for permitted Staff without an audit event`, async () => {
    const args = ["getReceipt", "getOrderForReceiving", "getDeliveryForReceiving"].includes(name) ? [1] : [];
    const result = await (action as (...args: unknown[]) => Promise<ResourceResult>)(...args);
    expect(result).toMatchObject({ success: true });
    expect(fake.written).toHaveLength(0);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
}
for (const [name, action] of [...Object.entries(allActions), ["Goods Receiving page", () => GoodsReceivingPage({ searchParams: Promise.resolve({}) })]] as [string, (...args: never[]) => Promise<unknown>][]) {
  describe(name, () => {
    it.each(["unsigned", "invalid", "denied", "unavailable"])("denies %s before any data access", async decision => {
      fake.signed = decision !== "unsigned"; fake.decision = decision;
      await expect(action()).rejects.toThrow(/Redirect: \/(signing-in|no-access|unavailable)/);
      expect(fake.dataAccess).not.toHaveBeenCalled();
      expect(fake.written).toHaveLength(0); expect(fake.sent).toHaveLength(0);
    });
  });
}

it("records session attribution even when client identity fields are spoofed", async () => {
  fake.status.deliveries = "Arrived";
  await receipts.createReceipt({ ...receipt, receivedBy: "impostor", createdBy: "impostor" } as typeof receipt);
  expect(fake.committed.find(row => row.model === "goodsReceipts")?.data).toMatchObject({ ReceivedBy: "actor-username", CreatedBy: "actor-username" });
  fake.status.stockIns = "PendingApproval";
  await stock.approveStockIn(1, { notes: "Checked", approvedBy: "impostor" } as { notes: string });
  expect(fake.committed.find(row => row.model === "stockIns")?.data.ApprovedBy).toBe("actor-username");
});

it("derives stock-in starting stock from the database instead of the form", async () => {
  fake.status.goodsReceipts = "Received";
  expect(await stock.createStockIn(stockInput)).toMatchObject({ success: true });
  expect(fake.committed.find(write => write.model === "stockIns")?.data.StockInLines).toMatchObject({ create: [{ CurrentStockBeforeCommit: 5 }] });
});

it.each([stock.submitStockIn, returns.requestReturnApproval])("sends approval requests only to Known Staff holding Goods Receiving", async action => {
  expect(await action(1)).toMatchObject({ success: true });
  expect(fake.sent).toMatchObject([{ ids: ["approver-id"], input: { type: "approval-requested", link: "https://localhost:3003/goods-receiving" } }]);
});

it.each([
  [stock.approveStockIn, "stockIns", "approved"], [stock.rejectStockIn, "stockIns", "rejected"],
  [returns.approveReturn, "returnToVendors", "approved"], [returns.rejectReturn, "returnToVendors", "rejected"],
] as const)("notifies the stored requester of the decision", async (action, model, decision) => {
  fake.status[model] = "PendingApproval";
  expect(await action(1, { reason: "Checked" })).toMatchObject({ success: true });
  expect(fake.sent).toMatchObject([{ ids: ["requester-id"], input: { type: `request-${decision}` } }]);
});

it("keeps committed work successful during audit and notification outages", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  fake.gatewayFails = true;
  expect(await stock.submitStockIn(1)).toMatchObject({ success: true });
  expect(fake.committed).toHaveLength(1);
  expect(console.error).toHaveBeenCalled();
});

it("does not guess a Portal id for a historical requester", async () => {
  fake.knownMissing = true; fake.status.stockIns = "PendingApproval";
  expect(await stock.approveStockIn(1)).toMatchObject({ success: true });
  expect(fake.sent).toHaveLength(0); expect(fake.written).toHaveLength(1);
});

it("rolls back failures without sending audit events or notifications", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  fake.commitFails = true;
  expect(await stock.submitStockIn(1)).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0); expect(fake.sent).toHaveLength(0);
});

it("refuses repeated approvals and missing records without events", async () => {
  fake.status.stockIns = "Approved";
  expect(await stock.approveStockIn(1)).toMatchObject({ success: false });
  fake.missing = true;
  expect(await receipts.postReceipt(1)).toMatchObject({ success: false });
  expect(fake.written).toHaveLength(0); expect(fake.sent).toHaveLength(0);
});

it("rejects QA results belonging to another inspection", async () => {
  fake.foreignLine = true;
  expect(await quality.completeInspection(1, inspection)).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0);
});

it.each([NaN, Infinity, -1])("refuses invalid received quantity %s", async quantity => {
  expect(await receipts.createReceipt({ ...receipt, items: [{ itemId: 1, deliveredQuantity: quantity }] })).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0);
});

it("returns serializable dates and decimals at the action boundary", async () => {
  fake.status.stockIns = "PendingApproval";
  const result = await stock.approveStockIn(1);
  expect(result.success).toBe(true);
  expect(typeof result.data.ApprovedAt).toBe("string");
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
});
