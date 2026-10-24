/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { rows } = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
}));
const routes = import.meta.glob("../app/api/**/route.ts");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => ({ value: "opaque" }) }) }));
vi.mock("@/lib/gateway/audit", () => ({ WRITE_TIMEOUT_MS: 3000, gatewayPort: { writeAudit: async () => {} } }));
vi.mock("@/lib/gateway/notifications", () => ({ SEND_TIMEOUT_MS: 3000, notificationGateway: { send: async () => {} } }));
vi.mock("@/lib/prisma", () => {
  const prisma = new Proxy({
    documentSequences: { upsert: async () => ({ LastNumber: 1 }) },
  }, {
    get(target, table: string) {
      if (table === "$transaction") return (work: (tx: object) => Promise<unknown>) => work(prisma);
      if (table in target) return target[table as keyof typeof target];
      const model = {
        upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
          const row = rows.has(table) ? { ...rows.get(table), ...update } : create;
          rows.set(table, row);
          return row;
        },
        findUnique: async () => rows.get(table),
        findFirst: async () => rows.get(table) ?? null,
        findMany: async () => rows.has(table) ? [rows.get(table)] : [],
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...data, LotId: 1 };
          rows.set(table, row);
          return row;
        },
        update: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...rows.get(table), ...data };
          rows.set(table, row);
          return row;
        },
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          rows.set(table, { ...rows.get(table), ...data });
          return { count: 1 };
        },
      };
      return model;
    },
  });
  return { prisma };
});

beforeEach(() => {
  rows.clear();
  vi.stubEnv("IMS_DEV_BYPASS", "false");
  vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret");
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    const { module } = JSON.parse(String(init.body));
    return Response.json({ active: true, user_id: "staff-1", system: "IMS", module,
      staff: { name: "Ada Santos", username: "2026-AB-001", email: "ada@example.com" } });
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// Goods Receiving action attribution is covered in receiving-actions.test.ts after #21.
const transitions = [
  ["stock-transfers/[id]/status", "PUT", "stockTransfers", "Dispatched", "ReceivedBy"],
  ["stock-transfer-requests/[id]/status", "PUT", "stockTransferRequests", "Pending Approval", "ReviewedBy"],
] as const;

it.each(transitions)("%s attributes the action to signed-in Staff", async (path, method, table, status, actorField) => {
  rows.set(table, { Status: status, CreatedBy: "Legacy Creator", RequestedBy: "Legacy Requester" });
  await act(path, method, { status: "Received", action: "Approve", reason: "Damaged", resolutionType: "Accept", reviewedBy: "Forged", receivedBy: "Forged", authorisedBy: "Forged" });
  expect(rows.get(table)?.[actorField]).toBe("2026-AB-001");
  expect(rows.get(table)?.CreatedBy).toBe("Legacy Creator");
  expect(rows.get(table)?.RequestedBy).toBe("Legacy Requester");
});

async function act(path: string, method: string, body: Record<string, unknown> = {}) {
  const { production } = await import("@/lib/production/client");
  const actions: Record<string, () => ReturnType<typeof production.listBatches>> = {
    "production-requests/[id]": () => production.updateProductionRequest(1, body),
    "ProductionBatches/[id]/stages/complete": () => production.completeBatchStage(1, body),
    "ProductionBatches/[id]/complete": () => production.completeBatch(1, body),
    "ProductionBatches/[id]/reject": () => production.rejectBatch(1, body),
    "ProductionBatches/[id]/add-to-inventory": () => production.commitBatchInventory(1, body),
    "production-qa": () => production.reviewProductionQa(body),
    "ProductionBatches/[id]/packaging": () => production.packageBatch(1, body),
  };
  if (actions[path]) return (await actions[path]()).data;
  const route = await routes[`../app/api/${path}/route.ts`]() as Record<string, (r: NextRequest, p: { params: Promise<{ id: string }> }) => Promise<Response>>;
  const request = new NextRequest(`https://localhost:3003/api/${path.replace("[id]", "1")}`, {
    method, body: JSON.stringify(body),
  });
  request.cookies.set("ims_session", "opaque");
  const response = await route[method](request, { params: Promise.resolve({ id: "1" }) });
  const result = await response.json();
  expect(response.status, JSON.stringify(result)).toBe(200);
  return result;
}

it.each(["approve", "reject"])("records the approver Username and readable name for %s", async (action) => {
  rows.set("productionRequests", { Status: "Pending Approval", RequestedBy: "Legacy Requester", ProductionReqLotReservations: [] });
  rows.set("approvalRequests", { Status: "Pending", RequestedBy: "Legacy Requester" });
  await act("production-requests/[id]", "PATCH", { action, approvedBy: "Forged", rejectedBy: "Forged" });
  expect(rows.get("productionRequests")?.[action === "approve" ? "ApprovedBy" : "RejectedBy"]).toBe("2026-AB-001");
  expect(rows.get("approvalRequests")).toMatchObject({ ApproverId: "2026-AB-001", ApproverName: "Ada Santos", RequestedBy: "Legacy Requester" });
  expect(rows.get("productionRequests")?.RequestedBy).toBe("Legacy Requester");
});

it("attributes approval submission to the current Staff and preserves the original requester", async () => {
  rows.set("productionRequests", { Status: "Draft", RequestedBy: "Legacy Requester" });
  await act("production-requests/[id]", "PATCH", { action: "submit_approval", requestedBy: "Forged" });
  expect(rows.get("approvalRequests")?.RequestedBy).toBe("2026-AB-001");
  expect(rows.get("productionRequests")?.RequestedBy).toBe("Legacy Requester");
});

// Cycle-count attribution now runs through server actions in inventory-actions.test.ts.

it("records stage completion in batch notes using the session Username", async () => {
  rows.set("productionBatches", { Status: "In Progress" });
  const result = await act("ProductionBatches/[id]/stages/complete", "POST", { stage: "Steaming", endTime: "10:30", completedBy: "Forged" });
  expect(result.data.notes).toBe("[STAGE:Steaming|END:10:30|BY:2026-AB-001]");
});

it("attributes finished goods and its stock ledger to the same Staff", async () => {
  rows.set("productionBatches", { BatchId: 1, BatchNumber: "PB-1", Status: "In Progress", FinishedProducts: { ItemId: 1, Items: { UomId: 1 } } });
  await act("ProductionBatches/[id]/complete", "POST", { finalQuantity: 5, packagedBy: "Forged" });
  expect(rows.get("productionBatches")?.PackagedBy).toBe("2026-AB-001");
  expect(rows.get("stockLedgers")).toMatchObject({ UserId: "2026-AB-001", UserName: "Ada Santos" });
});

it.each(["POST", "PUT"])("%s batch rejection uses Staff identity for the loss report", async (method) => {
  rows.set("productionBatches", { BatchId: 1, ProdReqId: 1, BatchNumber: "PB-1", Status: "In Progress", AssignedCook: "Legacy Cook", EstimatedQuantity: 5 });
  rows.set("productionRequests", { RequestedBy: "Legacy Requester" });
  await act("ProductionBatches/[id]/reject", method, { reason: "Burnt", assignedCook: "Forged" });
  expect(rows.get("lossReports")).toMatchObject({ AuthorisedBy: "2026-AB-001", CreatedBy: "2026-AB-001" });
  expect(rows.get("productionRequests")).toMatchObject({ RejectedBy: "2026-AB-001", RequestedBy: "Legacy Requester" });
  expect(rows.get("productionBatches")?.AssignedCook).toBe("Legacy Cook");
});

it.each(["POST", "PUT"])("%s inventory commit passes Staff identity into the shared handler", async (method) => {
  rows.set("productionBatches", { BatchId: 1, BatchNumber: "PB-1", Status: "For Stock-in", FinalQuantity: 5, ProductId: 1 });
  rows.set("locations", { LocationId: 1, LocationName: "Warehouse" });
  await act("ProductionBatches/[id]/add-to-inventory", method, { userId: "Forged", userName: "Forged" });
  expect(rows.get("stockLedgers")).toMatchObject({ UserId: "2026-AB-001", UserName: "Ada Santos" });
  expect(rows.get("productionBatches")?.Notes).toContain("|ACTOR:2026-AB-001]");
});

it("attributes production QA and its loss report to the current inspector", async () => {
  rows.set("productionBatches", { BatchId: 1, BatchNumber: "PB-1", Status: "For QA", FinalQuantity: 5, ProductId: 1 });
  await act("production-qa", "POST", { batchId: 1, acceptedQuantity: 3, rejectedQuantity: 2, acceptedReason: "Passed", rejectedReason: "Damaged", inspectorName: "Forged" });
  expect(rows.get("qualityInspections")).toMatchObject({ InspectorId: "2026-AB-001", InspectorName: "Ada Santos", CompletedBy: "2026-AB-001" });
  expect(rows.get("lossReports")).toMatchObject({ AuthorisedBy: "2026-AB-001", CreatedBy: "2026-AB-001" });
});

it.each(["Forged", undefined])("packaging ignores packedBy=%s", async (packedBy) => {
  const proof = "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c";
  rows.set("productionBatches", { BatchId: 1, BatchNumber: "PB-1", Status: "In Progress", ProductId: 1, EstimatedQuantity: 5, ImageUrl: proof });
  await act("ProductionBatches/[id]/packaging", "POST", { packedBy, finalQuantity: 5, expiryDate: "2027-01-01", proofImageUrl: proof });
  expect(rows.get("productionBatches")?.PackagedBy).toBe("2026-AB-001");
});
