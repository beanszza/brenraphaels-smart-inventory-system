import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { startShopDatabase } from "./shop-database";

let database: Awaited<ReturnType<typeof startShopDatabase>>;
let db: PrismaClient;
const dir = mkdtempSync(path.join(tmpdir(), "shop-catalog-test-"));
const input = path.join(dir, "catalog.json"), output = path.join(dir, "mapping.json");
const catalog = [{ sizeId: 901, productName: "Ube Jam", sizeLabel: "250g", priceInCentavos: 21900, available: true }];
function reconcile() {
  return execFileSync(process.execPath, ["scripts/verification/reconcile-storefront-catalog.mjs", input, output], {
    env: { ...process.env, DATABASE_URL: database.url }, encoding: "utf8", stdio: "pipe",
  });
}
beforeAll(async () => {
  database = await startShopDatabase(); db = new PrismaClient({ datasources: { db: { url: database.url } } });
  writeFileSync(input, JSON.stringify(catalog));
}, 60000);
afterAll(async () => { await db?.$disconnect(); database?.close(); rmSync(dir, { recursive: true, force: true }); });
beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE "Categories", "UnitOfMeasures" CASCADE');
  await db.categories.create({ data: { CategoryId: 1, CategoryName: "Finished Good", Description: "" } });
  await db.unitOfMeasures.create({ data: { UomId: 1, Name: "Piece", Abbreviation: "pcs", Code: "pcs", UomType: "Count" } });
  await db.unitOfMeasures.create({ data: { UomId: 2, Name: "Kilogram", Abbreviation: "kg", Code: "kg", UomType: "Weight" } });
});
it("creates explicit Size identities, replays the same mapping and never creates stock", async () => {
  reconcile(); const first = JSON.parse(readFileSync(output, "utf8"));
  reconcile(); expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(first);
  expect(Object.keys(first)).toEqual(["901"]);
  expect(await db.finishedProducts.count()).toBe(1);
  expect(await db.inventoryLots.count()).toBe(0);
  expect(await db.inventories.count()).toBe(0);
});
it("refuses an existing Size whose units changed to weight", async () => {
  reconcile();
  await db.items.updateMany({ where: { ItemCode: "SHOP-SIZE-901" }, data: { UomId: 2, StockUomId: 2 } });
  expect(() => reconcile()).toThrow();
});
it("refuses to share an existing Size Item with another SKU", async () => {
  reconcile();
  const item = await db.items.findFirstOrThrow({ where: { ItemCode: "SHOP-SIZE-901" } });
  await db.finishedProducts.create({ data: { ItemId: item.ItemId, Sku: "OTHER-SIZE", Variant: "500g", SellingPrice: 300 } });
  expect(() => reconcile()).toThrow();
});
it("seeds labelled demo stock once and never tops it up on replay", async () => {
  reconcile();
  await db.locations.create({ data: { LocationId: 1000, LocationName: "Factory", LocationType: "Warehouse", IsActive: true } });
  const seed = () => execFileSync(process.execPath, ["scripts/verification/seed-demo-stock.mjs", input, output, "20", "--confirm-demo"], {
    env: { ...process.env, DATABASE_URL: database.url, IMS_SHOP_WAREHOUSE_ID: "1000" }, stdio: "pipe",
  });
  seed();
  const lot = await db.inventoryLots.findFirstOrThrow();
  expect(lot.SupplierLotNo).toContain("DEMO-367");
  await db.inventoryLots.update({ where: { LotId: lot.LotId }, data: { QuantityRemaining: 17, LotCode: "FG-DMO-261115-99" } });
  seed();
  expect((await db.inventoryLots.findFirstOrThrow()).QuantityRemaining.toNumber()).toBe(17);
  expect(await db.inventoryLots.count()).toBe(1);
  expect(await db.stockLedgers.count()).toBe(1);
});

it("preserves the mapping when IMS normalizes its display SKU", async () => {
  reconcile(); const first = JSON.parse(readFileSync(output, "utf8"));
  await db.finishedProducts.updateMany({ data: { Sku: "UBH-JAM-JAR-250G" } });
  reconcile(); expect(JSON.parse(readFileSync(output, "utf8"))).toEqual(first);
  expect(await db.finishedProducts.count()).toBe(1);
});
