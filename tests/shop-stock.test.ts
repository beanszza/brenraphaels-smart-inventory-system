import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { startShopDatabase } from "./shop-database";

const audit = vi.hoisted(() => ({ events: [] as unknown[], fail: false }));
vi.mock("@/lib/gateway/audit", () => ({
  WRITE_TIMEOUT_MS: 3000,
  gatewayPort: { writeAudit: async (event: unknown) => {
    if (audit.fail) throw new Error("offline");
    audit.events.push(event);
  } },
}));
let db: Awaited<ReturnType<typeof startShopDatabase>>;
let prisma: PrismaClient;
let GET: typeof import("@/app/api/shop/stock/route").GET;
let POST: typeof import("@/app/api/shop/stock/route").POST;
const key = "shop-test-key-at-least-thirty-two-characters";
const request = (query = "productId=1", credential: string | null = key) => new Request(`https://ims.test/api/shop/stock?${query}`, {
  headers: credential === null ? {} : { Authorization: `Bearer ${credential}` },
});
beforeAll(async () => {
  db = await startShopDatabase();
  vi.stubEnv("DATABASE_URL", db.url);
  ({ prisma } = await import("@/lib/prisma"));
  ({ GET, POST } = await import("@/app/api/shop/stock/route"));
}, 60_000);
afterAll(async () => { await prisma?.$disconnect(); db?.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  vi.stubEnv("IMS_SHOP_API_KEY", key);
  vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "1");
  audit.events = []; audit.fail = false;
  await prisma.$executeRawUnsafe('TRUNCATE "Categories", "UnitOfMeasures", "Locations", "ShopStockAuditOutbox" CASCADE');
  await prisma.categories.create({ data: { CategoryId: 1, CategoryName: "Finished", Description: "" } });
  await prisma.unitOfMeasures.create({ data: { UomId: 1, Name: "Piece", Abbreviation: "pc", Code: "PC" } });
  await prisma.items.create({ data: { ItemId: 1, ItemName: "Ube jam", UomId: 1, StockUomId: 1, CategoryId: 1, MinStockLevel: 0, MaxStockLevel: 100, IsActive: true } });
  for (const [id, type] of [[1, "Warehouse"], [2, "Branch"]] as const) {
    await prisma.locations.create({ data: { LocationId: id, LocationName: type, LocationType: type, IsActive: true } });
    await prisma.inventories.create({ data: { ItemId: 1, LocationId: id, CurrentStock: id === 1 ? 10 : 100 } });
    await prisma.inventoryLots.create({ data: { LotId: id, LotCode: `LOT-${id}`, ItemId: 1, LocationId: id, SourceType: "Opening", ReceivedDate: new Date(), IsExpiryEstimated: false, QuantityReceived: id === 1 ? 10 : 100, QuantityRemaining: id === 1 ? 10 : 100, ReservedQuantity: id === 1 ? 3 : 0, UomId: 1, UnitCost: 10, Status: "Active", IsOpeningBalance: true } });
  }
  await prisma.finishedProducts.create({ data: { ProductId: 1, ItemId: 1, Sku: "UBE-250", Variant: "250g", SellingPrice: 100 } });
});
it("refuses missing, incorrect and POS credentials, and fails closed without a configured key", async () => {
  for (const credential of [null, "incorrect", process.env.SCMS_API_KEY ?? "pos-key"]) expect((await GET(request("productId=1", credential))).status).toBe(401);
  vi.stubEnv("IMS_SHOP_API_KEY", "");
  expect((await GET(request())).status).toBe(401);
});
it("reports only sellable Warehouse quantity less all reservations, excluding POS branch stock", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ warehouseId: 1, productId: 1, quantity: 10, reserved: 3, available: 7 });
  expect(response.headers.get("cache-control")).toBe("no-store");
});

const move = (operation: string, orderId = "order-1", lineId = "line-1", quantity = 4, id = 1) => POST(new Request("https://ims.test/api/shop/stock", {
  method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ operation, orderId, lineId, productId: id, quantity }),
}));
it("reserves an Order line once across retries and refuses requests above available stock", async () => {
  expect((await move("reserve")).status).toBe(200);
  expect((await move("reserve")).status).toBe(200);
  expect(await (await GET(request())).json()).toMatchObject({ quantity: 10, reserved: 7, available: 3 });
  expect((await move("reserve", "order-2")).status).toBe(409);
  expect(await (await GET(request())).json()).toMatchObject({ quantity: 10, reserved: 7, available: 3 });
  expect(audit.events).toHaveLength(1);
  expect(audit.events[0]).toMatchObject({ source: "IMS", action: "record.updated", description: expect.stringContaining("reserve"), idempotency_key: expect.any(String) });
});
it("releases each reservation once, without resurrecting it on a delayed reserve retry", async () => {
  expect((await move("reserve")).status).toBe(200);
  expect((await move("release")).status).toBe(200);
  expect((await move("release")).status).toBe(200);
  expect(await (await move("reserve")).json()).toMatchObject({ state: "released" });
  expect(await (await GET(request())).json()).toMatchObject({ quantity: 10, reserved: 3, available: 7 });
  expect(audit.events).toHaveLength(2);
});
it("deducts when packed and adds back the same line once, preserving other reservations", async () => {
  expect((await move("reserve")).status).toBe(200);
  expect((await move("deduct")).status).toBe(200);
  expect((await move("deduct")).status).toBe(200);
  expect(await (await GET(request())).json()).toMatchObject({ quantity: 6, reserved: 3, available: 3 });
  expect((await move("release")).status).toBe(409);
  expect((await move("add_back")).status).toBe(200);
  expect((await move("add_back")).status).toBe(200);
  expect(await (await move("deduct")).json()).toMatchObject({ state: "added_back" });
  expect(await (await GET(request())).json()).toMatchObject({ quantity: 10, reserved: 3, available: 7 });
  expect(audit.events).toHaveLength(3);
});
it("cannot oversell when two Orders reserve concurrently, and concurrent retries reserve once", async () => {
  const results = await Promise.all([move("reserve", "buyer-a"), move("reserve", "buyer-b")]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  expect(await (await GET(request())).json()).toMatchObject({ available: 3, reserved: 7 });
  const retries = await Promise.all([move("reserve", "retry", "line", 3), move("reserve", "retry", "line", 3)]);
  expect(retries.map(r => r.status)).toEqual([200, 200]);
  expect(await (await GET(request())).json()).toMatchObject({ available: 0, reserved: 10 });
});
it("retries pending audit delivery on the next movement without repeating stock changes", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  audit.fail = true;
  expect((await move("reserve")).status).toBe(200);
  audit.fail = false;
  expect((await move("deduct")).status).toBe(200);
  expect(audit.events).toHaveLength(2);
  expect(await (await GET(request())).json()).toMatchObject({ quantity: 6, reserved: 3, available: 3 });
  vi.restoreAllMocks();
});
it("rejects a changed line fingerprint and illegal lifecycle transitions without changing stock", async () => {
  expect((await move("deduct")).status).toBe(404);
  expect((await move("reserve")).status).toBe(200);
  expect((await move("reserve", "order-1", "line-1", 5)).status).toBe(409);
  expect((await move("add_back")).status).toBe(409);
  expect((await move("release")).status).toBe(200);
  expect((await move("deduct")).status).toBe(409);
  expect((await move("add_back")).status).toBe(409);
  expect(await (await GET(request())).json()).toMatchObject({ available: 7, reserved: 3, quantity: 10 });
});
it("fails closed for an unset, inactive or POS-branch Warehouse setting", async () => {
  for (const setting of ["", "2", "garbage", "99999"]) {
    vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", setting);
    expect((await GET(request())).status).toBe(503);
    expect((await move("reserve")).status).toBe(503);
  }
  vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "1");
  await prisma.locations.update({ where: { LocationId: 1 }, data: { IsActive: false } });
  expect((await GET(request())).status).toBe(503);
});
it("keeps releases and returns tied to the original Warehouse after its setting changes", async () => {
  expect((await move("reserve")).status).toBe(200);
  expect((await move("deduct")).status).toBe(200);
  vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "2");
  expect((await move("add_back")).status).toBe(200);
  vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "1");
  expect(await (await GET(request())).json()).toMatchObject({ quantity: 10, reserved: 3, available: 7 });
});
it("excludes held and expired lots and blocks packing stock put on Hold after reservation", async () => {
  await prisma.inventoryLots.update({ where: { LotId: 1 }, data: { ExpiryDate: new Date("2020-01-01") } });
  expect(await (await GET(request())).json()).toMatchObject({ available: 0 });
  expect((await move("reserve")).status).toBe(409);
  await prisma.inventoryLots.update({ where: { LotId: 1 }, data: { ExpiryDate: null } });
  expect((await move("reserve")).status).toBe(200);
  await prisma.inventoryLots.update({ where: { LotId: 1 }, data: { Status: "Hold" } });
  expect(await (await GET(request())).json()).toMatchObject({ available: 0 });
  expect((await move("deduct")).status).toBe(409);
  expect((await move("release")).status).toBe(200);
});
it("validates malformed JSON, operations, references and quantities", async () => {
  const send = (body: string, credential = key) => POST(new Request("https://ims.test/api/shop/stock", {
    method: "POST", headers: { Authorization: `Bearer ${credential}` }, body,
  }));
  expect((await send("not JSON")).status).toBe(400);
  expect((await send("{}", "wrong")).status).toBe(401);
  for (const quantity of [0, -1, 1.5, 2147483648]) expect((await move("reserve", "bad", "line", quantity)).status).toBe(400);
  expect((await move("invent")).status).toBe(400);
  expect((await move("reserve", "../bad")).status).toBe(400);
  expect((await GET(request("productId=0"))).status).toBe(400);
  expect((await GET(request("productId=99999"))).status).toBe(404);
});
it("never offers another Size's lots when finished products share one Item", async () => {
  await prisma.finishedProducts.create({ data: { ProductId: 2, ItemId: 1, Sku: "UBE-500", Variant: "500g", SellingPrice: 200 } });
  // Unlinked opening stock cannot be assigned to one of several Sizes by guessing.
  expect(await (await GET(request())).json()).toMatchObject({ available: 0 });
  for (const id of [1, 2]) {
    await prisma.recipes.create({ data: { RecipeId: id, ProductId: id, OutputQuantity: 1, Notes: "", IsActive: true } });
    await prisma.productionBatches.create({ data: {
      RecipeId: id, ProductId: id, BatchMultiplier: 1, EstimatedQuantity: 10, ActualQuantity: 10,
      ProductionDate: new Date(), Stage: "Done", QualityStatus: "Passed", RejectionReason: "", ImageUrl: "", Notes: "",
      FgLotId: id, Status: "Completed",
    } });
  }
  expect(await (await GET(request())).json()).toMatchObject({ available: 7 });
  expect(await (await GET(request("productId=2"))).json()).toMatchObject({ available: 0 });
  expect((await move("reserve", "wrong-size", "line", 1, 2)).status).toBe(409);
  expect((await move("reserve")).status).toBe(200);
});
it("allocates across lots and restores both exactly once after packing", async () => {
  await prisma.inventoryLots.create({ data: {
    LotId: 3, LotCode: "LOT-3", ItemId: 1, LocationId: 1, SourceType: "Opening", ReceivedDate: new Date(),
    IsExpiryEstimated: false, QuantityReceived: 5, QuantityRemaining: 5, UomId: 1, UnitCost: 10, Status: "Active", IsOpeningBalance: true,
  } });
  await prisma.inventories.update({ where: { ItemId_LocationId: { ItemId: 1, LocationId: 1 } }, data: { CurrentStock: 15 } });
  expect((await move("reserve", "large", "line", 10)).status).toBe(200);
  expect(await (await GET(request())).json()).toMatchObject({ available: 2, reserved: 13, quantity: 15 });
  expect((await move("deduct", "large", "line", 10)).status).toBe(200);
  expect(await (await GET(request())).json()).toMatchObject({ available: 2, reserved: 3, quantity: 5 });
  expect((await move("add_back", "large", "line", 10)).status).toBe(200);
  expect((await move("add_back", "large", "line", 10)).status).toBe(200);
  expect(await (await GET(request())).json()).toMatchObject({ available: 12, reserved: 3, quantity: 15 });
});

it("allows only the exact integration path through the browser-session proxy, then authenticates it", async () => {
  vi.stubEnv("IMS_APP_URL", "https://localhost:3003");
  vi.stubEnv("IMS_DEV_BYPASS", "false");
  expect(proxy(new NextRequest("https://localhost:3003/api/shop/stock")).status).toBe(200);
  expect(proxy(new NextRequest("https://localhost:3003/api/shop/stock/extra")).status).toBe(401);
  expect((await GET(request("productId=1", null))).status).toBe(401);
});
it("keeps concurrent release, deduction and add-back retries idempotent", async () => {
  expect((await move("reserve")).status).toBe(200);
  expect((await move("reserve", "second", "line", 3)).status).toBe(200);
  for (const [operation, orderId, lineId, quantity] of [
    ["release", "second", "line", 3], ["deduct", "order-1", "line-1", 4], ["add_back", "order-1", "line-1", 4],
  ] as const) {
    const responses = await Promise.all([move(operation, orderId, lineId, quantity), move(operation, orderId, lineId, quantity)]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
  }
  expect(await (await GET(request())).json()).toMatchObject({ quantity: 10, reserved: 3, available: 7 });
});
