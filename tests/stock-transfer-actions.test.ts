/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AuditEventInput } from "@/lib/gateway/audit";
import type { NotificationInput } from "@/lib/gateway/notifications";
import * as requests from "@/app/actions/stock-transfer/requests";
import { reviewRequest } from "@/app/actions/stock-transfer/request-status";
import { cancelRequest } from "@/app/actions/stock-transfer/request-cancel";
import * as transfers from "@/app/actions/stock-transfer/transfers";
import { dispatchTransfer } from "@/app/actions/stock-transfer/dispatch";
import { cancelTransfer } from "@/app/actions/stock-transfer/transfer-cancel";
import { updateTransferStatus } from "@/app/actions/stock-transfer/transfer-status";
import { editTransfer } from "@/app/actions/stock-transfer/edit-transfer";
import * as locations from "@/app/actions/stock-transfer/locations";
import { suggestLots } from "@/app/actions/stock-transfer/lot-suggestions";
import StockTransferPage from "@/app/(root)/stock-transfer/page";
import DistributionPage from "@/app/(root)/distribution/page";
import AnalyticsPage from "@/app/(root)/distribution-analytics/page";

const fake = vi.hoisted(() => ({
  signed: true, decision: "allowed", open: false, commitFails: false, gatewayFails: false,
  requestStatus: "Approved", transferStatus: "Scheduled", lotsEmpty: false, knownMissing: false,
  lotRemaining: 20, lotReserved: 2, totalScheduled: 0, lastSeq: 1,
  staffRole: "generic" as "generic" | "admin" | "ims",
  requestTransfers: [] as { Status: string }[],
  requestSuggestedLots: [{ lotId: 1, lotCode: "LOT-1", expiryDate: null, qty: 10 }] as unknown[],
  dataAccess: vi.fn(), lotQuery: vi.fn(),
  pending: [] as { model: string; data: Record<string, unknown> }[],
  committed: [] as { model: string; data: Record<string, unknown> }[],
  written: [] as AuditEventInput[], sent: [] as { ids: string[]; input: NotificationInput }[],
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => fake.signed ? { value: "opaque" } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`Redirect: ${url}`); } }));
vi.mock("@/components/stock-transfer/StockTransferModule", () => ({ default: () => null }));
vi.mock("@/components/pages/ViewDistribution", () => ({ default: () => null }));
vi.mock("@/lib/gateway/audit", () => ({ WRITE_TIMEOUT_MS: 3000, gatewayPort: { writeAudit: async (event: AuditEventInput) => {
  expect(fake.open).toBe(false);
  if (fake.gatewayFails) throw new Error("Gateway unavailable");
  fake.written.push(event);
} } }));
vi.mock("@/lib/gateway/notifications", () => ({ SEND_TIMEOUT_MS: 3000, notificationGateway: { send: async (ids: string[], input: NotificationInput) => {
  expect(fake.open).toBe(false);
  if (fake.gatewayFails) throw new Error("Gateway unavailable");
  fake.sent.push({ ids, input });
} } }));
vi.mock("@/lib/prisma", () => {
  const product = { ProductId: 1, ItemId: 1, Items: { ItemName: "Jam" }, Sku: "JAM", Variant: "Regular" };
  const location = { LocationId: 1, LocationName: "Commissary", IsSystemLocation: true };
  const row = (model: string): Record<string, unknown> => ({
    RequestId: 1, RequestNumber: "STR-2026-0001", TransferId: 1, TransferNumber: "STF-1", ProductId: 1,
    RequestedBy: "requester", CreatedBy: "creator", ToLocationId: 2, SourceLocationId: 1, DestLocationId: 2,
    TransferQuantity: 5, CurrentStock: 20, LastNumber: fake.lastSeq, Locations: location, FinishedProducts: product,
    RequestDate: new Date(), RequiredDate: new Date(), CreatedAt: new Date(),
    LotId: 1, LotCode: "LOT-1", QuantityRemaining: fake.lotRemaining, ReservedQuantity: fake.lotReserved,
    StockTransferRequestItems: [{ ProductId: 1, RequestedQuantity: 10, AvailableQuantity: 20, SuggestedLots: fake.requestSuggestedLots, FinishedProducts: product }],
    StockTransfers: fake.requestTransfers,
    Status: model === "stockTransferRequests" ? fake.requestStatus : fake.transferStatus,
    ...(model === "finishedProducts" ? product : model === "locations" ? location : {}),
  });
  const write = (model: string, data: Record<string, unknown>) => {
    if (model === "inventoryLots" && data.ReservedQuantity && typeof data.ReservedQuantity === "object") {
      const rq = data.ReservedQuantity as { increment?: number; decrement?: number };
      if (typeof rq.increment === "number") fake.lotReserved += rq.increment;
      if (typeof rq.decrement === "number") fake.lotReserved = Math.max(0, fake.lotReserved - rq.decrement);
    }
    (fake.open ? fake.pending : fake.committed).push({ model, data });
    return { ...row(model), ...data };
  };
  const model = (name: string) => ({
    findUnique: async (args?: { where?: { RequestNumber?: string } }) => {
      if (name === "stockTransferRequests" && args?.where?.RequestNumber && args.where.RequestNumber !== "STR-2026-0001") {
        return null;
      }
      return row(name);
    },
    findFirst: async () => name === "knownStaff" ? fake.knownMissing ? null : { StaffId: "requester-id", Name: "Requester" } : row(name),
    findMany: async (args?: unknown) => {
      if (name === "knownStaff") return [{ StaffId: "actor-id", Modules: ["Stock Transfer"] }, { StaffId: "approver-id", Modules: ["Stock Transfer"] }];
      if (name === "inventoryLots") {
        fake.lotQuery(args);
        return fake.lotsEmpty ? [] : [{ LotId: 1, LotCode: "LOT-1", QuantityRemaining: fake.lotRemaining, ReservedQuantity: fake.lotReserved }];
      }
      if (name === "stockTransferRequestItems") {
        return [{ RequestItemId: 1, ProductId: 1, RequestedQuantity: 10, AvailableQuantity: 20, SuggestedLots: fake.requestSuggestedLots, FinishedProducts: product }];
      }
      return [row(name)];
    },
    count: async () => 0,
    aggregate: async () => ({ _sum: { TransferQuantity: fake.totalScheduled } }),
    create: async ({ data }: { data: Record<string, unknown> }) => write(name, data),
    update: async ({ data }: { data: Record<string, unknown> }) => write(name, data),
    updateMany: async ({ data }: { data: Record<string, unknown> }) => { write(name, data); return { count: 1 }; },
    upsert: async (args?: { update?: { LastNumber?: { increment?: number; set?: number } } }) => {
      if (name === "documentSequences") {
        if (args?.update?.LastNumber?.increment) fake.lastSeq += args.update.LastNumber.increment;
        else if (typeof args?.update?.LastNumber?.set === "number") fake.lastSeq = args.update.LastNumber.set;
      }
      write(name, (args?.update as Record<string, unknown>) || {});
      return { LastNumber: fake.lastSeq };
    },
  });
  const tx = new Proxy({}, { get: (_, key: string) => { fake.dataAccess(key); return model(key); } });
  return { prisma: new Proxy({}, { get: (_, key: string) => {
    fake.dataAccess(key);
    if (key === "$transaction") return async (work: (tx: unknown) => Promise<unknown>, options: unknown) => {
      expect(options).toMatchObject({ isolationLevel: "Serializable" }); fake.open = true;
      try {
        const result = await work(tx);
        if (fake.commitFails) throw new Error("Commit failed");
        fake.committed.push(...fake.pending); return result;
      } finally { fake.pending = []; fake.open = false; }
    };
    return model(key);
  } }) };
});
beforeEach(() => {
  Object.assign(fake, { signed: true, decision: "allowed", open: false, commitFails: false, gatewayFails: false,
    requestStatus: "Approved", transferStatus: "Scheduled", lotsEmpty: false, knownMissing: false, lotRemaining: 20, lotReserved: 2, totalScheduled: 0,
    lastSeq: 1, staffRole: "generic", requestTransfers: [], requestSuggestedLots: [{ lotId: 1, lotCode: "LOT-1", expiryDate: null, qty: 10 }],
    pending: [], committed: [], written: [], sent: [] });
  fake.dataAccess.mockClear(); fake.lotQuery.mockClear();
  vi.stubEnv("IMS_DEV_BYPASS", "false"); vi.stubEnv("PORTAL_URL", "https://portal.test"); vi.stubEnv("PORTAL_SYSTEM_SECRET", "secret"); vi.stubEnv("IMS_APP_URL", "https://localhost:3003");
  vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
    expect(JSON.parse(String(init?.body)).module).toBe("Stock Transfer");
    if (fake.decision !== "allowed") return Response.json({ error: fake.decision === "invalid" ? "invalid_handle" : fake.decision }, { status: fake.decision === "invalid" ? 401 : fake.decision === "denied" ? 403 : 503 });
    const staff = fake.staffRole === "admin"
      ? { name: "Jude Nitram", username: "2026-ADMIN-001", email: "jude.nitram08@gmail.com" }
      : fake.staffRole === "ims"
      ? { name: "Vince Neil Madeja", username: "2026-VM-007", email: "madejavinceneil@gmail.com" }
      : { name: "Ada", username: "actor-username", email: "ada@example.test" };
    return Response.json({ active: true, user_id: "actor-id", system: "IMS", module: "Stock Transfer", staff });
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const requestInput = { toLocationId: 2, requiredDate: "2027-01-01", items: [{ productId: 1, requestedQuantity: 5 }] };
const scheduleInput = { requestId: 1, productId: 1, transferQuantity: 5, scheduledDate: "2027-01-01" };
const edits = { productId: 1, sourceLocationId: 1, destLocationId: 2, transferQuantity: 5, transferDate: "2027-01-01" };
const mutations = [
  { name: "create request", run: () => requests.createRequest({ ...requestInput, requestedBy: "forged" }), target: "stock-transfer-request", change: "created" },
  { name: "approve request", run: () => reviewRequest(1, { action: "Approve", reviewedBy: "forged" }), target: "stock-transfer-request", status: "Pending Approval" },
  { name: "reject request", run: () => reviewRequest(1, { action: "Reject", adminNotes: "Unavailable" }), target: "stock-transfer-request", status: "Pending Approval" },
  { name: "cancel request", run: () => cancelRequest(1), target: "stock-transfer-request" },
  { name: "schedule", run: () => transfers.scheduleTransfer({ ...scheduleInput, createdBy: "forged" }), target: "stock-transfer", change: "created" },
  { name: "dispatch", run: () => dispatchTransfer(1), target: "stock-transfer" },
  { name: "cancel transfer", run: () => cancelTransfer(1), target: "stock-transfer" },
  { name: "receive", run: () => updateTransferStatus(1, { status: "Received", receivedBy: "forged" }), target: "stock-transfer", transferStatus: "Dispatched" },
  { name: "edit", run: () => editTransfer(1, edits), target: "stock-transfer" },
  { name: "create location", run: () => locations.createLocation({ locationName: "Branch" }), target: "location", change: "created" },
  { name: "edit location", run: () => locations.updateLocation(1, { locationName: "Branch" }), target: "location" },
];
for (const test of mutations) {
  it(`${test.name} audits committed work through the gateway`, async () => {
    if (test.status) fake.requestStatus = test.status;
    if (test.transferStatus) fake.transferStatus = test.transferStatus;
    expect(await test.run()).toMatchObject({ success: true });
    expect(fake.committed.length).toBeGreaterThan(0);
    expect(fake.written).toEqual([expect.objectContaining({ source: "IMS", module: "Stock Transfer", action: (({"create request": "stock_transfer.requested", "approve request": "stock_transfer.approved", "reject request": "stock_transfer.rejected", "dispatch": "stock_transfer.dispatched", "receive": "stock_transfer.received"} as Record<string, string>)[test.name] ?? `record.${test.change || "updated"}`),
      actor: { type: "user", id: "actor-id", display_name: "Ada" }, target: expect.objectContaining({ type: test.target }) })]);
    expect(JSON.stringify(fake.committed)).not.toContain("forged");
  });
  it(`${test.name} emits no audit or notification on rollback`, async () => {
    if (test.status) fake.requestStatus = test.status;
    if (test.transferStatus) fake.transferStatus = test.transferStatus;
    fake.commitFails = true; vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await test.run()).toMatchObject({ success: false });
    expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0); expect(fake.sent).toHaveLength(0);
  });
}
const actions = import.meta.glob("../app/actions/stock-transfer/*.ts");
for (const [path, load] of Object.entries(actions)) {
  const exports = await load() as Record<string, (...args: unknown[]) => Promise<unknown>>;
  for (const [name, action] of Object.entries(exports)) {
    it.each(["unsigned", "invalid", "denied", "unavailable"])(`${path} ${name} denies %s before input and data access`, async decision => {
      fake.signed = decision !== "unsigned"; fake.decision = decision;
      await expect(action()).rejects.toThrow("Redirect:"); expect(fake.dataAccess).not.toHaveBeenCalled();
    });
  }
}
for (const page of [StockTransferPage, DistributionPage, AnalyticsPage]) {
  it.each(["unsigned", "invalid", "denied", "unavailable"])(`${page.name} denies %s`, async decision => {
    fake.signed = decision !== "unsigned"; fake.decision = decision;
    await expect(page()).rejects.toThrow("Redirect:"); expect(fake.dataAccess).not.toHaveBeenCalled();
  });
}
it("notifies Known Staff approvers excluding the actor", async () => {
  expect(await requests.createRequest(requestInput)).toMatchObject({ success: true });
  expect(fake.sent).toEqual([{ ids: ["approver-id"], input: expect.objectContaining({ type: "approval-requested", link: "https://localhost:3003/stock-transfer" }) }]);
});
it.each(["Approve", "Reject"])("notifies the stored requester on %s", async action => {
  fake.requestStatus = "Pending Approval";
  expect(await reviewRequest(1, { action, adminNotes: "Decision", requestedBy: "forged" })).toMatchObject({ success: true });
  expect(fake.sent).toEqual([{ ids: ["requester-id"], input: expect.objectContaining({ type: action === "Approve" ? "request-approved" : "request-rejected" }) }]);
});
it("skips historical requesters without a Known Staff match", async () => {
  fake.knownMissing = true; fake.requestStatus = "Pending Approval";
  await reviewRequest(1, { action: "Approve" }); expect(fake.sent).toHaveLength(0);
});
it("keeps committed changes successful when gateways fail", async () => {
  fake.gatewayFails = true; vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await requests.createRequest(requestInput)).toMatchObject({ success: true }); expect(fake.committed.length).toBeGreaterThan(0);
});
it.each([NaN, Infinity, -1, 0])("rejects invalid quantities %s", async transferQuantity => {
  expect(await transfers.scheduleTransfer({ ...scheduleInput, transferQuantity })).toMatchObject({ success: false }); expect(fake.committed).toHaveLength(0);
});
it("refuses over-scheduling", async () => {
  fake.totalScheduled = 9;
  expect(await transfers.scheduleTransfer(scheduleInput)).toMatchObject({ success: false }); expect(fake.committed).toHaveLength(0);
});
it("dispatch uses source location and unreserved, unexpired FEFO lots", async () => {
  expect(await dispatchTransfer(1)).toMatchObject({ success: true, data: { lotDeductions: [{ lotId: 1, deducted: 5 }] } });
  expect(fake.lotQuery).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ LocationId: 1, OR: expect.any(Array) }), orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }] }));
});
it("short stock rolls back dispatch and audits failure", async () => {
  fake.lotsEmpty = true;
  expect(await dispatchTransfer(1)).toMatchObject({ success: false }); expect(fake.committed).toHaveLength(0);
  expect(fake.written).toMatchObject([{ action: "stock_transfer.dispatched", outcome: "failure" }]);
});
it.each(["Dispatched", "Received", "Completed"])("cannot dispatch or cancel %s transfers", async status => {
  fake.transferStatus = status;
  expect(await dispatchTransfer(1)).toMatchObject({ success: false }); expect(await cancelTransfer(1)).toMatchObject({ success: false }); expect(fake.committed).toHaveLength(0);
});
it("cannot bypass FEFO with the status action", async () => {
  expect(await updateTransferStatus(1, { status: "Dispatched" })).toMatchObject({ success: false }); expect(fake.committed).toHaveLength(0);
});
it("lot previews and list reads return serializable data without mutation events", async () => {
  for (const result of [await suggestLots("productId=1&quantity=5"), await requests.listRequests(), await transfers.listTransfers()]) {
    expect(result.success).toBe(true); expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  }
  expect(fake.written).toHaveLength(0); expect(fake.committed).toHaveLength(0);
});

it("reserved stock is unavailable to dispatch", async () => {
  fake.lotRemaining = 6; fake.lotReserved = 2;
  expect(await dispatchTransfer(1)).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0); expect(fake.written.filter(event => event.outcome !== "failure")).toHaveLength(0);
});
it("previews subtract reservations", async () => {
  fake.lotRemaining = 6; fake.lotReserved = 2;
  expect(await suggestLots("productId=1&quantity=5")).toMatchObject({ success: true, data: { totalAvailable: 4, isSufficient: false } });
});
it("received transfers cannot be received again", async () => {
  fake.transferStatus = "Received";
  expect(await updateTransferStatus(1, { status: "Received" })).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0); expect(fake.written.filter(event => event.outcome !== "failure")).toHaveLength(0);
});

it("refuses Admin on create, schedule, dispatch, and cancel, while allowing review", async () => {
  fake.staffRole = "admin";
  expect(await requests.createRequest(requestInput)).toMatchObject({ success: false });
  expect(await transfers.scheduleTransfer(scheduleInput)).toMatchObject({ success: false });
  expect(await dispatchTransfer(1)).toMatchObject({ success: false });
  expect(await cancelRequest(1, { reason: "Admin attempt" })).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0);

  fake.requestStatus = "Pending Approval";
  expect(await reviewRequest(1, { action: "Approve" })).toMatchObject({ success: true });
});

it("refuses IMS Manager on approve/reject review", async () => {
  fake.staffRole = "ims";
  fake.requestStatus = "Pending Approval";
  expect(await reviewRequest(1, { action: "Approve" })).toMatchObject({ success: false });
  expect(await reviewRequest(1, { action: "Reject", adminNotes: "Reason" })).toMatchObject({ success: false });
});

it("blocks cancelling a request that already has a scheduled transfer", async () => {
  fake.staffRole = "ims";
  fake.requestStatus = "Approved";
  fake.requestTransfers = [{ Status: "Scheduled" }];
  expect(await cancelRequest(1, { reason: "Too late" })).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0);
});

it("reserves stock on create (50 -> 40) and releases back to 50 on cancel", async () => {
  fake.staffRole = "ims";
  fake.lotRemaining = 50;
  fake.lotReserved = 0;

  // Before request: 50 available
  expect(await suggestLots("productId=1&quantity=10")).toMatchObject({
    success: true,
    data: { totalAvailable: 50 },
  });

  // Create STR for 10 units -> reserves 10
  expect(
    await requests.createRequest({
      toLocationId: 2,
      requiredDate: "2027-01-01",
      items: [{ productId: 1, requestedQuantity: 10 }],
    })
  ).toMatchObject({ success: true });
  expect(fake.lotReserved).toBe(10);

  // Next STR preview shows 40 available
  expect(await suggestLots("productId=1&quantity=10")).toMatchObject({
    success: true,
    data: { totalAvailable: 40 },
  });

  // Cancel the request -> releases 10 back to 0 reserved (50 available)
  fake.requestStatus = "Pending Approval";
  fake.requestSuggestedLots = [{ lotId: 1, lotCode: "LOT-1", expiryDate: null, qty: 10 }];
  expect(await cancelRequest(1, { reason: "No longer needed" })).toMatchObject({ success: true });
  expect(fake.lotReserved).toBe(0);

  expect(await suggestLots("productId=1&quantity=10")).toMatchObject({
    success: true,
    data: { totalAvailable: 50 },
  });
});

it("does not reuse cancelled STR numbers and never decrements the sequence counter", async () => {
  fake.staffRole = "ims";
  fake.lastSeq = 5;
  await requests.createRequest({
    ...requestInput,
    requestNumber: "STR-2026-0002",
  });
  expect(fake.lastSeq).toBe(5);
  const nextRes = await requests.getNextRequestNumber();
  expect(nextRes).toMatchObject({ success: true, data: expect.stringMatching(/-0006$/) });
});

it("validates driver names, contact numbers, proof of booking, and dispatch proof", async () => {
  fake.staffRole = "ims";
  expect(
    await transfers.scheduleTransfer({ ...scheduleInput, driverName: "Juan 123" })
  ).toMatchObject({ success: false });

  expect(
    await transfers.scheduleTransfer({
      ...scheduleInput,
      notes: JSON.stringify({ driverContact: "12345" }),
    })
  ).toMatchObject({ success: false });

  expect(
    await transfers.scheduleTransfer({
      ...scheduleInput,
      notes: JSON.stringify({ attachmentName: null }),
    })
  ).toMatchObject({ success: false });

  expect(
    await dispatchTransfer(1, { proofFileName: "" })
  ).toMatchObject({ success: false });

  expect(
    await dispatchTransfer(1, { actualDispatchDate: "2020-01-01", proofFileName: "proof.jpg" })
  ).toMatchObject({ success: false });
});
