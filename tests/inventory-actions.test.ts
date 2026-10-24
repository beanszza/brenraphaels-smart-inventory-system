/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEventInput } from "@/lib/gateway/audit";
import type { NotificationInput } from "@/lib/gateway/notifications";
import type { ResourceResult } from "@/lib/resources/result";
import * as stock from "@/app/actions/inventory/stock-ins";
import { createCycleCount, reconcileCycleCount } from "@/app/actions/inventory/cycle-counts";
import { recallLot } from "@/app/actions/inventory/recall";
import InventoryPage from "@/app/(root)/inventory/page";
import CycleCountsPage from "@/app/(root)/cycle-counts/page";
import TraceabilityPage from "@/app/(root)/traceability/page";
import ValuationPage from "@/app/(root)/valuation/page";
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
vi.mock("@/components/pages/ViewInventory", () => ({ default: () => null }));
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
    CycleCountId: 1, CountNumber: "CC-1", CountedBy: "Legacy Counter", CountDate: new Date("2026-10-24"),
    CycleCountItems: [{ ItemId: 1, SystemQuantity: 10, CountedQuantity: 8 }],
    LotId: 1, LotCode: "LOT-1", BatchId: 1, BatchNumber: "BATCH-1", ReceivedDate: new Date("2026-10-24"),
    Items: { ItemName: "Flour" }, BatchConsumptions: [], GoodsReceiptItems: [line()],
    Status: fake.status[model] || "Draft", CreatedBy: "requester-username", SubmittedBy: "requester-username", IsAcknowledged: false,
    QualityInspectionItems: [line()], DeliveryItems: [line()], StockInLines: [],
    PurchaseOrderItems: [{ PoItemId: 1, ItemId: 1, PoItemQuantity: 10, ReceivedQuantity: 0, TotalPrice: 10, PurchaseUomId: 1 }],
    Deliveries: { DeliveryId: 1 }, PurchaseOrders: { PoNumber: "PO-2026-0001", PurchaseOrderItems: [{ PoItemId: 1, PoItemQuantity: 10, PurchaseUomId: 1 }] },
  });
  const model = (name: string) => ({
    findUnique: async () => fake.missing ? null : row(name),
    findFirst: async () => fake.missing ? null : name === "knownStaff" ? fake.knownMissing ? null : { StaffId: "requester-id" } : row(name),
    findMany: async ({ where }: { where?: { Modules?: { has: string } } } = {}) => name === "knownStaff"
      ? [
          { StaffId: "actor-id", Name: "Ada", Username: "actor-username", Modules: ["Inventory"] },
          { StaffId: "approver-id", Name: "Ben", Username: "approver-username", Modules: ["Inventory"] },
          { StaffId: "other-module", Name: "Cook", Username: "cook", Modules: ["Goods Receiving"] },
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

beforeEach(() => {
  Object.assign(fake, { signed: true, decision: "allowed", status: {}, written: [], sent: [], pending: [], committed: [],
    transactionOpen: false, commitFails: false, gatewayFails: false, missing: false, foreignLine: false, knownMissing: false });
  fake.dataAccess.mockClear();
  vi.stubEnv("IMS_DEV_BYPASS", "false"); vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret"); vi.stubEnv("IMS_APP_URL", "https://localhost:3003");
  vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
    expect(JSON.parse(String(init?.body)).module).toBe("Inventory");
    if (fake.decision !== "allowed") return Response.json({ error: fake.decision === "invalid" ? "invalid_handle" : fake.decision }, { status: fake.decision === "invalid" ? 401 : fake.decision === "denied" ? 403 : 503 });
    return Response.json({ active: true, user_id: "actor-id", system: "IMS", module: "Inventory", staff: { name: "Ada", username: "actor-username", email: "ada@example.test" } });
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const stockInput = { grnId: 1, submitForApproval: true, lines: [
  { grnItemId: 1, itemId: 1, quantityToStock: 10, lotCode: "LOT-1" },
] };
const mutations: { name: string; run: () => Promise<ResourceResult>; status?: Record<string, string>; action: string; target: string }[] = [
  { name: "create cycle count", run: () => createCycleCount({ locationId: 1 }), action: "record.created", target: "cycle-count" },
  { name: "reconcile cycle count", run: () => reconcileCycleCount(1), status: { cycleCounts: "Open" }, action: "record.updated", target: "cycle-count" },
  { name: "recall lot", run: () => recallLot({ lotCode: "LOT-1", applyHold: true }), action: "record.updated", target: "inventory-lot" },
  { name: "create stock-in", run: () => stock.createStockIn(stockInput), status: { goodsReceipts: "Received" }, action: "record.created", target: "stock-in" },
  { name: "submit stock-in", run: () => stock.submitStockIn(1), action: "record.updated", target: "stock-in" },
  { name: "approve stock-in", run: () => stock.approveStockIn(1), status: { stockIns: "PendingApproval" }, action: "record.updated", target: "stock-in" },
  { name: "reject stock-in", run: () => stock.rejectStockIn(1, { reason: "Incorrect quantity" }), status: { stockIns: "PendingApproval" }, action: "record.updated", target: "stock-in" },
  { name: "commit stock-in", run: () => stock.commitStockIn(1), status: { stockIns: "Approved" }, action: "record.updated", target: "stock-in" },
];

for (const test of mutations) {
  it(`${test.name} commits before sending its IMS audit event`, async () => {
    fake.status = test.status || {};
    expect(await test.run()).toMatchObject({ success: true });
    expect(fake.written).toHaveLength(1);
    expect(fake.written[0]).toMatchObject({ source: "IMS", module: "Inventory", action: test.action,
      actor: { id: "actor-username", display_name: "Ada" }, target: { type: test.target, id: "1" } });
    expect(fake.written[0].description).toContain("Ada");
    expect(fake.written[0].description.length).toBeGreaterThan(15);
  });
  it(`${test.name} sends nothing when its transaction fails`, async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake.status = test.status || {}; fake.commitFails = true;
    expect(await test.run()).toMatchObject({ success: false });
    expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0); expect(fake.sent).toHaveLength(0);
  });
  it(`${test.name} sends nothing for a missing record`, async () => {
    fake.status = test.status || {}; fake.missing = true;
    expect(await test.run()).toMatchObject({ success: false });
    expect(fake.written).toHaveLength(0); expect(fake.sent).toHaveLength(0);
  });
}

// Every exported action (including reads and stock-in approvals) is an authorization boundary.
const actions = import.meta.glob("../app/actions/inventory/*.ts");
for (const [path, load] of Object.entries(actions)) {
  describe(path, async () => {
    const exports = await load() as Record<string, (...args: never[]) => Promise<unknown>>;
    for (const [name, action] of Object.entries(exports)) {
      it.each(["unsigned", "invalid", "denied", "unavailable"])(`${name} denies %s before touching data`, async decision => {
        fake.signed = decision !== "unsigned"; fake.decision = decision;
        await expect(action()).rejects.toThrow(/Redirect: \/(signing-in|no-access|unavailable)/);
        expect(fake.dataAccess).not.toHaveBeenCalled(); expect(fake.written).toHaveLength(0); expect(fake.sent).toHaveLength(0);
      });
    }
  });
}
for (const page of [InventoryPage, CycleCountsPage, TraceabilityPage, ValuationPage]) {
  it.each(["unsigned", "invalid", "denied", "unavailable"])(`${page.name} denies %s before loading data`, async decision => {
    fake.signed = decision !== "unsigned"; fake.decision = decision;
    await expect(page()).rejects.toThrow(/Redirect: \/(signing-in|no-access|unavailable)/);
    expect(fake.dataAccess).not.toHaveBeenCalled();
  });
}

it("uses the current reconciler and preserves the historical counter", async () => {
  fake.status.cycleCounts = "Open";
  expect(await reconcileCycleCount(1)).toMatchObject({ success: true });
  expect(fake.committed.find(row => row.model === "cycleCounts")?.data).toMatchObject({ ReconciledBy: "actor-username", Status: "Reconciled" });
  expect(fake.committed.find(row => row.model === "cycleCounts")?.data).not.toHaveProperty("CountedBy");
  expect(fake.committed.find(row => row.model === "inventories")?.data).toEqual({ CurrentStock: { increment: -2 } });
});

it("ignores forged creator and approver attribution", async () => {
  expect(await createCycleCount({ locationId: 1, countedBy: "impostor" } as { locationId: number })).toMatchObject({ success: true });
  expect(fake.committed.find(row => row.model === "cycleCounts")?.data.CountedBy).toBe("actor-username");
  fake.status.stockIns = "PendingApproval";
  expect(await stock.approveStockIn(1, { approvedBy: "impostor" } as { notes?: string })).toMatchObject({ success: true });
  expect(fake.committed.find(row => row.model === "stockIns")?.data.ApprovedBy).toBe("actor-username");
});

it.each([stock.approveStockIn, stock.rejectStockIn])("notifies the stored requester by Portal id", async action => {
  fake.status.stockIns = "PendingApproval";
  expect(await action(1, { reason: "Checked" })).toMatchObject({ success: true });
  expect(fake.sent).toMatchObject([{ ids: ["requester-id"], input: { link: "https://localhost:3003/inventory" } }]);
});

it("notifies only other Known Staff holding Inventory when approval is requested", async () => {
  expect(await stock.submitStockIn(1)).toMatchObject({ success: true });
  expect(fake.sent).toMatchObject([{ ids: ["approver-id"], input: { type: "approval-requested", link: "https://localhost:3003/inventory" } }]);
});

it("does not guess a Portal id for historical free-text requesters", async () => {
  fake.status.stockIns = "PendingApproval"; fake.knownMissing = true;
  expect(await stock.approveStockIn(1)).toMatchObject({ success: true });
  expect(fake.sent).toHaveLength(0); expect(fake.written).toHaveLength(1);
});

it("does not fail committed work during audit or notification outages", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  fake.gatewayFails = true;
  expect(await stock.submitStockIn(1)).toMatchObject({ success: true });
  expect(fake.committed).toHaveLength(1); expect(console.error).toHaveBeenCalled();
});

it("simulates a recall without changing stock or emitting an event", async () => {
  expect(await recallLot({ lotCode: "LOT-1", applyHold: false })).toMatchObject({ success: true, data: { holdApplied: false } });
  expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0);
});

it("refuses repeated reconciliation or approval", async () => {
  fake.status.cycleCounts = "Reconciled"; fake.status.stockIns = "Approved";
  expect(await reconcileCycleCount(1)).toMatchObject({ success: false });
  expect(await stock.approveStockIn(1)).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0);
});

it("loads serializable inventory data on the server for permitted Staff", async () => {
  const page = await InventoryPage();
  expect(page.props).toMatchObject({ initialInventories: [], initialLots: [], initialTotal: 0 });
  expect(fake.written).toHaveLength(0);
});

it.each([NaN, Infinity, -1, 0, 1.5])("refuses invalid record id %s", async id => {
  expect(await createCycleCount({ locationId: id })).toMatchObject({ success: false });
  expect(await reconcileCycleCount(id)).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0);
});

