/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AuditEventInput } from "@/lib/gateway/audit";
import type { NotificationInput } from "@/lib/gateway/notifications";
import type { ResourceResult } from "@/lib/resources/result";
import { production } from "@/lib/production/client";
import * as recipes from "@/app/actions/production/recipes";
import * as images from "@/app/actions/production/images";
import ProductionPage from "@/app/(root)/production-quality/page";

const fake = vi.hoisted(() => ({
  signed: true, decision: "allowed", open: false, commitFails: false, gatewayFails: false, missing: false,
  statuses: {} as Record<string, string>, dataAccess: vi.fn(),
  pending: [] as { model: string; data: Record<string, unknown> }[],
  committed: [] as { model: string; data: Record<string, unknown> }[],
  written: [] as AuditEventInput[], sent: [] as { ids: string[]; input: NotificationInput }[],
  existing: false, knownMissing: false, lotsEmpty: false, filePrivate: true, fileAccess: vi.fn(),
}));
const FILE = "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-return-to": "/production-quality" }),
  cookies: async () => ({ get: () => fake.signed ? { value: "opaque" } : undefined }),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`Redirect: ${url}`); } }));
vi.mock("@/components/pages/ViewProduction", () => ({ default: () => null }));
vi.mock("@/lib/gateway/audit", () => ({ WRITE_TIMEOUT_MS: 3000, gatewayPort: {
  writeAudit: async (event: AuditEventInput) => {
    expect(fake.open).toBe(false);
    if (fake.gatewayFails) throw new Error("Audit unavailable");
    fake.written.push(event);
  },
} }));
vi.mock("@/lib/gateway/notifications", () => ({ SEND_TIMEOUT_MS: 3000, notificationGateway: {
  send: async (ids: string[], input: NotificationInput) => {
    expect(fake.open).toBe(false);
    if (fake.gatewayFails) throw new Error("Notifications unavailable");
    fake.sent.push({ ids, input });
  },
} }));
vi.mock("@/lib/gateway/files", () => ({ filesGateway: {
  requestUpload: async (input: unknown, actor: string) => {
    fake.fileAccess("request", input, actor);
    return { id: "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c", uploadUrl: "https://storage.test/put", uploadUrlExpiresInSeconds: 600 };
  },
  confirm: async (_id: string, actor: string) => {
    fake.fileAccess("confirm", actor);
    return { id: "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c", status: "active", visibility: fake.filePrivate ? "private" : "public", retentionType: "permanent" };
  },
  addLink: async (...args: unknown[]) => { fake.fileAccess("link", ...args); },
  view: async () => { fake.fileAccess("view"); return { url: "https://storage.test/view", visibility: fake.filePrivate ? "private" : "public" }; },
} }));
vi.mock("@/lib/prisma", () => {
  const item = { ItemId: 2, ItemCode: "RAW", ItemName: "Flour", StockUomId: 1, UomId: 1,
    Uom: { Name: "kg", Abbreviation: "kg" }, Category: { CategoryName: "Raw material" }, Inventories: [], SupplierItems: [] };
  const ingredient = { IngredientId: 1, ItemId: 2, UomId: 1, StandardQuantity: 2, Items: item, Uom: item.Uom };
  const product = { ProductId: 1, ItemId: 1, Items: { ...item, ItemId: 1, ItemName: "Jam" } };
  const recipe = { RecipeId: 1, RecipeCode: "BOM-1", RecipeName: "Jam", ProductId: 1, Product: product,
    OutputQuantity: 10, RecipeIngredients: [ingredient], UnitOfMeasures: item.Uom };
  const lot = { LotId: 1, LotCode: "LOT-1", QuantityRemaining: 10, ReservedQuantity: 2, LocationId: 1, UnitCost: 2, UomId: 1 };
  const reservation = { ReservationId: 1, IngredientId: 1, ItemId: 2, LotId: 1, ReservedQuantity: 2, IsReleased: false, InventoryLots: lot, Items: item };
  const request = () => ({ ProdReqId: 1, ReqNumber: "PRQ-1", ProductId: 1, RecipeId: 1, RequestedBy: "requester-username", Quantity: 10,
    Status: fake.statuses.productionRequests || "Draft", Recipes: recipe, FinishedProducts: product,
    ProductionReqLotReservations: [reservation], MaterialIssuances: fake.existing ? [{ IssuanceId: 1, Status: "Pending" }] : [] });
  const row = (name: string): Record<string, unknown> => ({
    BatchId: 1, BatchNumber: "BTH-1", ProdReqId: 1, ProductId: 1, RecipeId: 1, IssuanceId: 1, IssuanceNumber: "ISS-1",
    PrId: 1, PrNumber: "PR-1", PurchaseRequisitionItems: [], InspectionId: 1, LastNumber: 1,
    LotId: 1, LotCode: "LOT-1", LocationId: 1, LocationName: "Warehouse", EstimatedQuantity: 10,
    FinalQuantity: 10, ActualQuantity: 10, FgLotId: null, AssignedCook: "legacy-cook",
    ProductionDate: new Date("2026-10-24"), ImageUrl: "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c",
    BatchConsumptions: [], Recipes: recipe, FinishedProducts: product, ProductionRequests: request(),
    ProductionReqLotReservations: [reservation], MaterialIssuances: [], MaterialIssuanceScans: [{ LotId: 1, IsVerified: true }],
    Status: fake.statuses[name] || "In Production",
    ...(name === "productionRequests" ? request() : name === "recipes" ? recipe : name === "items" ? item : name === "finishedProducts" ? product : name === "inventoryLots" ? lot : {}),
  });
  const model = (name: string) => ({
    findUnique: async () => fake.missing ? null : row(name),
    findFirst: async () => fake.missing ? null : name === "knownStaff" ? fake.knownMissing ? null : { StaffId: "requester-id" } : name === "materialIssuanceScans" ? null : row(name),
    findMany: async ({ where }: { where?: { Modules?: { has: string } } } = {}) => {
      if (name === "knownStaff") return [
        { StaffId: "actor-id", Modules: ["Production & Quality"] }, { StaffId: "approver-id", Modules: ["Production & Quality"] }, { StaffId: "other-id", Modules: ["Inventory"] }, { StaffId: "procurement-id", Modules: ["Orders & Procurement"] },
      ].filter(s => !where?.Modules?.has || s.Modules.includes(where.Modules.has));
      if (name === "inventoryLots" && fake.lotsEmpty) return [];
      return [row(name)];
    },
    count: async () => fake.missing ? 0 : 1,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      fake.pending.push({ model: name, data });
      return { ...row(name), ...Object.fromEntries(Object.entries(data).filter(([, value]) => value === null || typeof value !== "object" || value instanceof Date)) };
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      (fake.open ? fake.pending : fake.committed).push({ model: name, data });
      return { ...row(name), ...data };
    },
    upsert: async () => { fake.pending.push({ model: name, data: {} }); return row(name); },
    updateMany: async ({ data }: { data: Record<string, unknown> }) => { fake.pending.push({ model: name, data }); return { count: 1 }; },
    delete: async () => { fake.pending.push({ model: name, data: {} }); return row(name); },
    deleteMany: async () => { fake.pending.push({ model: name, data: {} }); return { count: 1 }; },
  });
  const tx = new Proxy({}, { get: (_, key: string) => { fake.dataAccess(key); return model(key); } });
  return { prisma: new Proxy({}, { get: (_, key: string) => {
    fake.dataAccess(key);
    if (key === "$transaction") return async (work: (tx: unknown) => Promise<unknown>, options: unknown) => {
      expect(options).toEqual({ isolationLevel: "Serializable" });
      fake.open = true;
      try {
        const result = await work(tx);
        if (fake.commitFails) throw new Error("Commit failed");
        fake.committed.push(...fake.pending);
        return result;
      } finally { fake.pending = []; fake.open = false; }
    };
    return model(key);
  } }) };
});

beforeEach(() => {
  Object.assign(fake, { signed: true, decision: "allowed", open: false, commitFails: false, gatewayFails: false, missing: false,
    statuses: {}, pending: [], committed: [], written: [], sent: [], existing: false, knownMissing: false, lotsEmpty: false, filePrivate: true });
  fake.dataAccess.mockClear(); fake.fileAccess.mockClear();
  vi.stubEnv("IMS_DEV_BYPASS", "false"); vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret"); vi.stubEnv("IMS_APP_URL", "https://localhost:3003");
  vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
    expect(JSON.parse(String(init?.body)).module).toBe("Production & Quality");
    if (fake.decision !== "allowed") return Response.json({ error: fake.decision }, { status: fake.decision === "invalid" ? 401 : fake.decision === "denied" ? 403 : 503 });
    return Response.json({ active: true, user_id: "actor-id", system: "IMS", module: "Production & Quality", staff: { name: "Ada", username: "actor-username", email: "ada@example.test" } });
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const recipeInput = { recipeName: "Jam", productId: 1, ingredients: [{ itemId: 2, uomId: 1, standardQuantity: 2 }] };
type Case = { name: string; run: () => Promise<unknown>; statuses?: Record<string, string>; target: string; change?: string; shortfall?: boolean };
const mutations: Case[] = [
  { name: "create batch", run: () => production.createBatch({ prodReqId: 1 }), statuses: { productionRequests: "Materials Issued" }, target: "production-batch", change: "created" },
  { name: "edit batch", run: () => production.updateBatch(1, { notes: "Adjusted" }), target: "production-batch" },
  { name: "delete batch", run: () => production.deleteBatch(1), statuses: { productionBatches: "Draft" }, target: "production-batch", change: "deleted" },
  { name: "approve batch", run: () => production.approveBatch(1), statuses: { productionBatches: "Pending Approval" }, target: "production-batch" },
  { name: "cancel batch", run: () => production.cancelBatch(1), statuses: { productionBatches: "Approved" }, target: "production-batch" },
  { name: "complete batch", run: () => production.completeBatch(1, { finalQuantity: 10 }), target: "production-batch" },
  { name: "QA notes", run: () => production.updateQaNotes(1, { notes: "Reviewed" }), target: "production-batch" },
  { name: "QA status", run: () => production.updateQaStatus(1, { isApproved: true }), target: "production-batch" },
  { name: "advance stage", run: () => production.advanceBatchStage(1, { stage: "Cooking" }), target: "production-batch" },
  { name: "complete stage", run: () => production.completeBatchStage(1, { stage: "Cooking", endTime: "10:30" }), target: "production-batch" },
  { name: "package batch", run: () => production.packageBatch(1, { finalQuantity: 10, expiryDate: "2027-01-01", proofImageUrl: FILE }), target: "production-batch" },
  { name: "reject batch", run: () => production.rejectBatch(1, { reason: "Burnt" }), target: "production-batch" },
  { name: "commit finished goods", run: () => production.commitBatchInventory(1), statuses: { productionBatches: "For Stock-in" }, target: "production-batch" },
  { name: "create request", run: () => production.createProductionRequest({ productId: 1, recipeId: 1, quantity: 10, submitForApproval: true, priority: "Medium", requiredDate: "2027-01-01", requiredTime: "10:30", reason: "Restock" }), target: "production-request", change: "created" },
  ...["submit_approval", "approve", "reject", "cancel"].map(action => ({ name: `${action} request`, run: () => production.updateProductionRequest(1, { action }), statuses: { productionRequests: action === "submit_approval" ? "Draft" : "Pending Approval" }, target: "production-request" })),
  { name: "edit request", run: () => production.updateProductionRequest(1, { reason: "Updated" }), target: "production-request" },
  { name: "delete request", run: () => production.deleteProductionRequest(1), target: "production-request", change: "deleted" },
  { name: "shortfall requisition", run: () => production.createShortfallRequisition(1), target: "purchase-requisition", change: "created", shortfall: true },
  { name: "create issuance", run: () => production.createIssuance({ prodReqId: 1 }), statuses: { productionRequests: "Approved" }, target: "material-issuance", change: "created" },
  { name: "scan lot", run: () => production.scanIssuance(1, { qrRaw: "LOT-1", ingredientId: 1 }), target: "material-issuance" },
  { name: "issue materials", run: () => production.issueMaterials(1), target: "material-issuance" },
  { name: "review QA", run: () => production.reviewProductionQa({ batchId: 1, acceptedQuantity: 8, rejectedQuantity: 2, acceptedReason: "Good", rejectedReason: "Damaged" }), statuses: { productionBatches: "For QA" }, target: "quality-inspection", change: "created" },
  { name: "create product", run: () => production.createFinishedProduct({ productName: "Jam", sellingPrice: 100 }), target: "finished-product", change: "created" },
  { name: "edit product", run: () => production.updateFinishedProduct(1, { productName: "Jam", sellingPrice: 100 }), target: "finished-product" },
  { name: "delete product", run: () => production.deleteFinishedProduct(1), target: "finished-product", change: "deleted" },
  { name: "create recipe", run: () => recipes.createRecipe(recipeInput), target: "recipe", change: "created" },
  { name: "edit recipe", run: () => recipes.updateRecipe(1, { notes: "Changed" }), target: "recipe" },
  { name: "delete recipe", run: () => recipes.deleteRecipe(1), target: "recipe", change: "deleted" },
];
for (const c of mutations) {
  const run = async () => {
    fake.statuses = c.statuses || {}; fake.lotsEmpty = !!c.shortfall;
    const result = await c.run().catch(error => {
      if (error?.response?.data?.message) return { success: false, message: error.message };
      throw error;
    }) as ResourceResult | { data: ResourceResult };
    return "success" in result ? result : result.data;
  };
  it(`${c.name} audits saved work through the fake gateway`, async () => {
    expect(await run()).toMatchObject({ success: true });
    expect(fake.committed.length).toBeGreaterThan(0);
    expect(fake.written).toHaveLength(1);
    expect(fake.written[0]).toMatchObject({ source: "IMS", module: "Production & Quality", action: `record.${c.change || "updated"}`,
      actor: { id: "actor-username", display_name: "Ada" }, target: { type: c.target, id: "1" } });
  });
  it(`${c.name} emits no event or notification on rollback`, async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); fake.commitFails = true;
    expect(await run()).toMatchObject({ success: false });
    expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0); expect(fake.sent).toHaveLength(0);
  });
}

const actions = import.meta.glob("../app/actions/production/*.ts");
for (const [path, load] of Object.entries(actions)) {
  const exports = await load() as Record<string, (...args: unknown[]) => Promise<unknown>>;
  for (const [name, action] of Object.entries(exports)) {
    it.each(["unsigned", "invalid", "denied", "unavailable"])(`${path} ${name} denies %s before data and file access`, async decision => {
      fake.signed = decision !== "unsigned"; fake.decision = decision;
      await expect(action()).rejects.toThrow("Redirect:");
      expect(fake.dataAccess).not.toHaveBeenCalled(); expect(fake.fileAccess).not.toHaveBeenCalled();
    });
  }
}
it.each(["unsigned", "invalid", "denied", "unavailable"])("Production page denies %s", async decision => {
  fake.signed = decision !== "unsigned"; fake.decision = decision;
  await expect(ProductionPage()).rejects.toThrow("Redirect:"); expect(fake.dataAccess).not.toHaveBeenCalled();
});
it("notifies only known Production approvers when a request is created", async () => {
  await production.createProductionRequest({ productId: 1, recipeId: 1, quantity: 10 });
  expect(fake.sent).toEqual([{ ids: ["approver-id"], input: expect.objectContaining({ type: "approval-requested", link: "https://localhost:3003/production-quality" }) }]);
});
it("notifies Production approvers on a draft submission", async () => {
  await production.updateProductionRequest(1, { action: "submit_approval" });
  expect(fake.sent).toEqual([{ ids: ["approver-id"], input: expect.objectContaining({ type: "approval-requested" }) }]);
});
it.each(["approve", "reject"])("notifies the linked requester after batch %s", async decision => {
  fake.statuses.productionBatches = decision === "approve" ? "Pending Approval" : "In Production";
  if (decision === "approve") await production.approveBatch(1);
  else await production.rejectBatch(1, { reason: "Burnt" });
  expect(fake.sent[0]).toMatchObject({ ids: ["requester-id"], input: { type: `request-${decision === "approve" ? "approved" : "rejected"}` } });
});
it("notifies Procurement approvers about a Production shortfall requisition", async () => {
  fake.lotsEmpty = true;
  await production.createShortfallRequisition(1);
  expect(fake.sent).toEqual([{ ids: ["procurement-id"], input: expect.objectContaining({ type: "approval-requested", link: "https://localhost:3003/orders-procurement" }) }]);
});
it.each(["approve", "reject"])("notifies the stored requester after request %s", async action => {
  fake.statuses.productionRequests = "Pending Approval";
  await production.updateProductionRequest(1, { action, requestedBy: "forged" });
  expect(fake.written[0].description).toContain(action === "approve" ? "approved" : "rejected");
  expect(fake.sent).toEqual([{ ids: ["requester-id"], input: expect.objectContaining({ type: `request-${action === "approve" ? "approved" : "rejected"}` }) }]);
});
it("does not invent an id for historical requesters", async () => {
  fake.knownMissing = true; fake.statuses.productionRequests = "Pending Approval";
  await production.updateProductionRequest(1, { action: "approve" }); expect(fake.sent).toHaveLength(0);
});
it("does not fail committed work when gateways are unavailable", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {}); fake.gatewayFails = true;
  await expect(production.createProductionRequest({ productId: 1, recipeId: 1, quantity: 10 })).resolves.toMatchObject({ data: { success: true } });
  expect(fake.committed.length).toBeGreaterThan(0);
});
it("loads an existing issuance without a state-change event", async () => {
  fake.existing = true; fake.statuses.productionRequests = "Approved";
  await production.createIssuance({ prodReqId: 1 }); expect(fake.written).toHaveLength(0); expect(fake.committed).toHaveLength(0);
});
it("refuses a second inventory commit", async () => {
  fake.statuses.productionBatches = "Stocked In";
  await expect(production.commitBatchInventory(1)).rejects.toThrow(); expect(fake.committed).toHaveLength(0);
});
it.each([NaN, Infinity, -1])("rejects invalid quantities %s before writing", async quantity => {
  await expect(production.createProductionRequest({ productId: 1, recipeId: 1, quantity })).rejects.toThrow(); expect(fake.committed).toHaveLength(0);
});
it("does not store an unconfirmed proof or local upload path", async () => {
  await expect(production.packageBatch(1, { finalQuantity: 10, expiryDate: "2027-01-01", proofImageUrl: "/uploads/proof.jpg" })).rejects.toThrow();
  expect(fake.committed).toHaveLength(0);
});
for (const kind of ["batch", "product"] as const) {
  it(`${kind} images use the file gateway, enforce visibility and audit uploads and links`, async () => {
    fake.filePrivate = kind === "batch";
    const request = kind === "batch" ? images.requestBatchImageUpload : images.requestProductImageUpload;
    const confirm = kind === "batch" ? images.confirmBatchImageUpload : images.confirmProductImageUpload;
    const resolve = kind === "batch" ? images.resolveBatchImage : images.resolveProductImage;
    expect(await request(1, { filename: "photo.png", contentType: "image/png", size: 50 })).toMatchObject({ success: true, data: { fileId: FILE } });
    expect(fake.fileAccess).toHaveBeenCalledWith("request", expect.objectContaining({ visibility: kind === "batch" ? "private" : "public", retentionType: "permanent" }), "actor-username");
    expect(await confirm(1, FILE)).toMatchObject({ success: true });
    expect(fake.committed[0]).toMatchObject({ data: { ImageUrl: FILE } });
    expect(fake.written.map(e => e.action)).toEqual(["record.created", "record.updated"]);
    expect(await resolve(1)).toMatchObject({ success: true, data: { url: "https://storage.test/view", private: kind === "batch" } });
  });
}

it("does not link a batch file with the wrong visibility", async () => {
  fake.filePrivate = false;
  expect(await images.confirmBatchImageUpload(1, FILE)).toMatchObject({ success: false });
  expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0);
});
it("denies uploads for missing records before contacting storage", async () => {
  fake.missing = true;
  expect(await images.requestBatchImageUpload(1, { filename: "x.png", contentType: "image/png", size: 5 })).toMatchObject({ success: false });
  expect(fake.fileAccess).not.toHaveBeenCalled();
});
it("rejects an invalid file type before contacting storage", async () => {
  expect(await images.requestBatchImageUpload(1, { filename: "x.exe", contentType: "application/octet-stream", size: 5 })).toMatchObject({ success: false });
  expect(fake.fileAccess).not.toHaveBeenCalled();
});
it.each([
  ["batches", () => production.listBatches()], ["batch detail", () => production.getBatch(1)],
  ["requests", () => production.listProductionRequests()], ["request detail", () => production.getProductionRequest(1)],
  ["issuances", () => production.listIssuances()], ["issuance detail", () => production.getIssuance(1)],
  ["quality", () => production.listProductionQa()], ["products", () => production.listFinishedProducts()],
] as const)("%s reads return serializable DTOs without mutation events", async (_, read) => {
  const result = await read();
  expect(result.data.success).toBe(true); expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  expect(fake.committed).toHaveLength(0); expect(fake.written).toHaveLength(0);
});
it("supports recipe and lot preview reads with only the Production Module", async () => {
  expect(await recipes.listRecipes()).toMatchObject({ success: true });
  expect(await recipes.getRecipe(1)).toMatchObject({ success: true });
  expect(await production.suggestRequestLots("preview", "recipeId=1&quantity=10")).toMatchObject({ data: { success: true, data: { quantity: 10 } } });
  expect(fake.written).toHaveLength(0);
});
