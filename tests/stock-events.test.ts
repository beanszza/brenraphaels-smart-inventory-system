import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { StockEventPorts } from "@/lib/shop/stock-events";
import { startShopDatabase } from "./shop-database";

function fakePorts(initial: Record<number, string>, failOn: number[] = []) {
  const state = new Map(Object.entries(initial).map(([id, f]) => [Number(id), f]));
  const known = new Map<number, string>();
  const sent: number[] = [];
  const ports: StockEventPorts = {
    current: async () => [...state].map(([productId, fingerprint]) => ({ productId, fingerprint })),
    published: async () => new Map(known),
    remember: async ({ productId, fingerprint }) => { known.set(productId, fingerprint); },
    publish: async ({ productId: id }) => { if (failOn.includes(id)) throw new Error("down"); sent.push(id); },
  };
  return { ports, state, sent };
}

let db: Awaited<ReturnType<typeof startShopDatabase>>;
let prisma: PrismaClient;
let publishStockChanges: typeof import("@/lib/shop/stock-events").publishStockChanges;
const events: number[] = [];
/** Every outgoing call in order: "push:<id>" to CREOMS, "event:<id>" to the gateway. */
const calls: string[] = [];
const pushes: Record<string, unknown>[] = [];
let creomsStatus = 200;

it("records a baseline on the first run without publishing", async () => {
  const { ports, sent } = fakePorts({ 1: "a", 2: "b" });
  await publishStockChanges(ports);
  expect(sent).toEqual([]);
});
it("publishes one event per changed Size and nothing for unchanged Sizes", async () => {
  const { ports, state, sent } = fakePorts({ 1: "a", 2: "b" });
  await publishStockChanges(ports);
  state.set(2, "b2");
  await publishStockChanges(ports);
  expect(sent).toEqual([2]);
  await publishStockChanges(ports);
  expect(sent).toEqual([2]);
});
it("publishes a new product once", async () => {
  const { ports, state, sent } = fakePorts({ 1: "a" });
  await publishStockChanges(ports);
  state.set(3, "c");
  await publishStockChanges(ports);
  await publishStockChanges(ports);
  expect(sent).toEqual([3]);
});
it("never throws when publishing fails, and retries that Size next time", async () => {
  const { ports, state, sent } = fakePorts({ 1: "a", 2: "b" }, [2]);
  await publishStockChanges(ports);
  state.set(1, "a2"); state.set(2, "b2");
  vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(publishStockChanges(ports)).resolves.toBe(1);
  expect(sent).toEqual([1]);
  const again = vi.fn(async () => { throw new Error("db down"); });
  await expect(publishStockChanges({ ...ports, current: again })).resolves.toBe(0);
});

beforeAll(async () => {
  db = await startShopDatabase();
  vi.stubEnv("DATABASE_URL", db.url);
  vi.stubEnv("IMS_SHOP_WAREHOUSE_ID", "1000");
  vi.stubEnv("IMS_GATEWAY_URL", "https://gateway.test");
  vi.stubEnv("IMS_GATEWAY_CALLER_KEY", "k");
  vi.stubEnv("CREOMS_URL", "https://creoms.test/");
  vi.stubEnv("IMS_CREOMS_SECRET", "creoms-secret-at-least-thirty-two-characters");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url === "https://creoms.test/api/internal/ims-stock") {
      const body = JSON.parse(String(init.body));
      expect(String((init.headers as Record<string, string>).Authorization)).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
      if (creomsStatus !== 200) return new Response(null, { status: creomsStatus });
      calls.push(`push:${body.productId}`);
      pushes.push(body);
      return new Response(null, { status: 200 });
    }
    expect(url).toBe("https://gateway.test/notifications/stock/changed");
    const { sizeId } = JSON.parse(String(init.body));
    // The notification service refuses a numeric id, so the Size ID always goes as a string.
    expect(typeof sizeId).toBe("string");
    events.push(Number(sizeId));
    calls.push(`event:${sizeId}`);
    return new Response(null, { status: 204 });
  }));
  ({ prisma } = await import("@/lib/prisma"));
  ({ publishStockChanges } = await import("@/lib/shop/stock-events"));
}, 60_000);
afterAll(async () => { await prisma?.$disconnect(); db?.close(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
beforeEach(() => { events.length = 0; calls.length = 0; pushes.length = 0; creomsStatus = 200; });

it("publishes the Size ID alone when a real stock, price or product change commits", async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Categories", "UnitOfMeasures", "Locations", "ShopStockSnapshots" CASCADE');
  await prisma.categories.create({ data: { CategoryId: 1, CategoryName: "Finished", Description: "" } });
  await prisma.unitOfMeasures.create({ data: { UomId: 1, Name: "Piece", Abbreviation: "pc", Code: "PC" } });
  await prisma.items.create({ data: { ItemId: 1, ItemName: "Ube Jam", UomId: 1, StockUomId: 1, CategoryId: 1, MinStockLevel: 0, MaxStockLevel: 100, IsActive: true } });
  await prisma.finishedProducts.create({ data: { ProductId: 1, ItemId: 1, Sku: "J", Variant: "250g", SellingPrice: 100 } });
  const run = () => publishStockChanges();
  await run();
  expect(events).toEqual([]);
  await run();
  expect(events).toEqual([]);
  await prisma.finishedProducts.update({ where: { ProductId: 1 }, data: { SellingPrice: 110 } });
  await run();
  expect(events).toEqual([1]);
  await prisma.finishedProducts.create({ data: { ProductId: 2, ItemId: 1, Sku: "J2", Variant: "500g", SellingPrice: 200 } });
  await run();
  expect(events).toEqual([1, 2]);
  await run();
  expect(events).toEqual([1, 2]);
}, 30_000);

it("publishes when the Finished Goods tab's stock for a Size changes, even where the shop Warehouse figure does not", async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Categories", "UnitOfMeasures", "Locations", "ShopStockSnapshots" CASCADE');
  await prisma.categories.create({ data: { CategoryId: 1, CategoryName: "Finished Goods", Description: "" } });
  await prisma.unitOfMeasures.create({ data: { UomId: 1, Name: "Piece", Abbreviation: "pc", Code: "PC" } });
  await prisma.locations.create({ data: { LocationId: 2, LocationName: "Elsewhere", LocationType: "Branch", IsActive: true } });
  await prisma.items.create({ data: { ItemId: 1, ItemName: "Ube Jam", UomId: 1, StockUomId: 1, CategoryId: 1, MinStockLevel: 0, MaxStockLevel: 100, IsActive: true } });
  await prisma.finishedProducts.create({ data: { ProductId: 1, ItemId: 1, Sku: "J", Variant: "250g", SellingPrice: 100 } });
  await prisma.inventoryLots.create({ data: {
    LotId: 1, LotCode: "LOT-1", ItemId: 1, LocationId: 2, SourceType: "Opening", ReceivedDate: new Date(), IsExpiryEstimated: false,
    QuantityReceived: 50, QuantityRemaining: 50, ReservedQuantity: 0, UomId: 1, UnitCost: 10, Status: "Active", IsOpeningBalance: true,
  } });
  const recipe = await prisma.recipes.create({ data: { ProductId: 1, OutputQuantity: 1, Notes: "", IsActive: true } });
  await prisma.productionBatches.create({ data: {
    RecipeId: recipe.RecipeId, ProductId: 1, BatchMultiplier: 1, EstimatedQuantity: 50, ActualQuantity: 50, ProductionDate: new Date(),
    Stage: "Done", QualityStatus: "Passed", RejectionReason: "", ImageUrl: "", Notes: "", FgLotId: 1, Status: "Completed",
  } });
  const run = () => publishStockChanges();
  await run();
  events.length = 0;
  await prisma.inventoryLots.update({ where: { LotId: 1 }, data: { QuantityRemaining: 40 } });
  await run();
  expect(events).toEqual([1]);
  await prisma.inventoryLots.update({ where: { LotId: 1 }, data: { ReservedQuantity: 5 } });
  await run();
  expect(events).toEqual([1, 1]);
}, 30_000);

it("pushes the Size's shop figures to CREOMS before announcing it, and retries a refused push on the next write", async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Categories", "UnitOfMeasures", "Locations", "ShopStockSnapshots" CASCADE');
  await prisma.categories.create({ data: { CategoryId: 1, CategoryName: "Finished Goods", Description: "" } });
  await prisma.unitOfMeasures.create({ data: { UomId: 1, Name: "Piece", Abbreviation: "pc", Code: "PC" } });
  await prisma.locations.create({ data: { LocationId: 1000, LocationName: "Factory", LocationType: "Warehouse", IsActive: true } });
  await prisma.items.create({ data: { ItemId: 1, ItemName: "Ube Halaya Smooth", UomId: 1, StockUomId: 1, CategoryId: 1, MinStockLevel: 0, MaxStockLevel: 100, IsActive: true } });
  await prisma.finishedProducts.create({ data: { ProductId: 22, ItemId: 1, Sku: "H", Variant: "500g", SellingPrice: 399 } });
  await prisma.inventories.create({ data: { ItemId: 1, LocationId: 1000, CurrentStock: 10 } });
  await prisma.inventoryLots.create({ data: {
    LotId: 1, LotCode: "UBH-261115-04", ItemId: 1, LocationId: 1000, SourceType: "Production", ReceivedDate: new Date(), IsExpiryEstimated: false,
    QuantityReceived: 10, QuantityRemaining: 10, ReservedQuantity: 0, UomId: 1, UnitCost: 10, Status: "Active", IsOpeningBalance: false,
  } });
  await publishStockChanges();
  expect(calls).toEqual([]);

  // An Order reserves 3 at checkout.
  await prisma.inventoryLots.update({ where: { LotId: 1 }, data: { ReservedQuantity: 3 } });
  await publishStockChanges();
  expect(calls).toEqual(["push:22", "event:22"]);
  expect(pushes[0]).toMatchObject({ productId: 22, name: "Ube Halaya Smooth", variant: "500g", price: 399, active: true, quantity: 10, reserved: 3, available: 7 });
  const first = BigInt(pushes[0].version as string);

  // CREOMS is down: nothing is announced, and the next write sends the newest figures with a larger version.
  creomsStatus = 503;
  vi.spyOn(console, "error").mockImplementation(() => {});
  await prisma.inventoryLots.update({ where: { LotId: 1 }, data: { ReservedQuantity: 0 } });
  await publishStockChanges();
  expect(calls).toEqual(["push:22", "event:22"]);
  creomsStatus = 200;
  await publishStockChanges();
  expect(calls).toEqual(["push:22", "event:22", "push:22", "event:22"]);
  expect(pushes[1]).toMatchObject({ reserved: 0, available: 10 });
  expect(BigInt(pushes[1].version as string)).toBeGreaterThan(first);
}, 30_000);
