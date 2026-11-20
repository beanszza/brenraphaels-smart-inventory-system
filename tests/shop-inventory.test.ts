import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { startShopDatabase } from "./shop-database";

let db: Awaited<ReturnType<typeof startShopDatabase>>;
let prisma: PrismaClient;
let GET: typeof import("@/app/api/shop/inventory/route").GET;
const key = "shop-test-key-at-least-thirty-two-characters";
const request = (query = "productIds=1,2", credential: string | null = key) => new Request(`https://ims.test/api/shop/inventory?${query}`, {
  headers: credential === null ? {} : { Authorization: `Bearer ${credential}` },
});
beforeAll(async () => {
  db = await startShopDatabase();
  vi.stubEnv("DATABASE_URL", db.url);
  ({ prisma } = await import("@/lib/prisma"));
  ({ GET } = await import("@/app/api/shop/inventory/route"));
}, 60_000);
afterAll(async () => { await prisma?.$disconnect(); db?.close(); vi.unstubAllEnvs(); });

async function lotFor(productId: number, lotId: number, remaining: number, reserved: number, over: { code?: string; status?: string; locationId?: number } = {}) {
  await prisma.inventoryLots.create({ data: {
    LotId: lotId, LotCode: over.code ?? `LOT-${lotId}`, ItemId: 1, LocationId: over.locationId ?? 1, SourceType: "Opening", ReceivedDate: new Date(),
    IsExpiryEstimated: false, QuantityReceived: remaining, QuantityRemaining: remaining, ReservedQuantity: reserved, UomId: 1, UnitCost: 10, Status: over.status ?? "Active", IsOpeningBalance: true,
  } });
  const recipe = await prisma.recipes.create({ data: { ProductId: productId, OutputQuantity: 1, Notes: "", IsActive: true } });
  await prisma.productionBatches.create({ data: {
    RecipeId: recipe.RecipeId, ProductId: productId, BatchMultiplier: 1, EstimatedQuantity: remaining, ActualQuantity: remaining,
    ProductionDate: new Date(), Stage: "Done", QualityStatus: "Passed", RejectionReason: "", ImageUrl: "", Notes: "", FgLotId: lotId, Status: "Completed",
  } });
}

beforeEach(async () => {
  vi.stubEnv("IMS_SHOP_API_KEY", key);
  await prisma.$executeRawUnsafe('TRUNCATE "Categories", "UnitOfMeasures", "Locations" CASCADE');
  await prisma.categories.create({ data: { CategoryId: 1, CategoryName: "Finished Goods", Description: "" } });
  await prisma.unitOfMeasures.create({ data: { UomId: 1, Name: "Piece", Abbreviation: "pc", Code: "PC" } });
  for (const id of [1, 2]) await prisma.locations.create({ data: { LocationId: id, LocationName: `Loc ${id}`, LocationType: "Warehouse", IsActive: true } });
  // One Item with two Sizes: the Finished Goods tab counts each Size's own lots, wherever they sit.
  await prisma.items.create({ data: { ItemId: 1, ItemName: "Ube Jam", UomId: 1, StockUomId: 1, CategoryId: 1, MinStockLevel: 0, MaxStockLevel: 100, IsActive: true } });
  await prisma.finishedProducts.createMany({ data: [
    { ProductId: 1, ItemId: 1, Sku: "JAM-250", Variant: "250g", SellingPrice: 100 },
    { ProductId: 2, ItemId: 1, Sku: "JAM-500", Variant: "500g", SellingPrice: 200 },
  ] });
});

it("refuses missing and incorrect credentials", async () => {
  expect((await GET(request("productIds=1", null))).status).toBe(401);
  expect((await GET(request("productIds=1", "incorrect"))).status).toBe(401);
});

it("gives each Size what the Finished Goods tab shows: its own lots in any location, less their reservations", async () => {
  await lotFor(1, 10, 67, 0, { locationId: 1 });
  await lotFor(2, 11, 40, 15, { locationId: 2 });
  await lotFor(2, 12, 20, 5, { locationId: 1, status: "Available" });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ products: [
    { productId: 1, quantity: 67, reserved: 0, available: 67 },
    { productId: 2, quantity: 60, reserved: 20, available: 40 },
  ] });
});

it("ignores depleted or held lots and the seeded test lots, like the tab", async () => {
  await lotFor(1, 10, 30, 0);
  await lotFor(1, 11, 25, 0, { status: "Depleted" });
  await lotFor(1, 12, 99, 0, { code: "LOT-UJH-2026-01" });
  expect((await (await GET(request("productIds=1"))).json()).products).toEqual([{ productId: 1, quantity: 30, reserved: 0, available: 30 }]);
});

it("answers zero for a Size with no lots and leaves out a product the IMS does not know; refuses a bad list", async () => {
  expect((await (await GET(request("productIds=1,99"))).json()).products).toEqual([{ productId: 1, quantity: 0, reserved: 0, available: 0 }]);
  for (const query of ["", "productIds=abc", "productIds=0", `productIds=${Array.from({ length: 201 }, (_, i) => i + 1).join(",")}`]) {
    expect((await GET(request(query))).status).toBe(400);
  }
});
