import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { startShopDatabase } from "./shop-database";

let db: Awaited<ReturnType<typeof startShopDatabase>>;
let prisma: PrismaClient;
let GET: typeof import("@/app/api/shop/products/route").GET;
const key = "shop-test-key-at-least-thirty-two-characters";
const request = (credential: string | null = key) => new Request("https://ims.test/api/shop/products", {
  headers: credential === null ? {} : { Authorization: `Bearer ${credential}` },
});
beforeAll(async () => {
  db = await startShopDatabase();
  vi.stubEnv("DATABASE_URL", db.url);
  ({ prisma } = await import("@/lib/prisma"));
  ({ GET } = await import("@/app/api/shop/products/route"));
}, 60_000);
afterAll(async () => { await prisma?.$disconnect(); db?.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  vi.stubEnv("IMS_SHOP_API_KEY", key);
  await prisma.$executeRawUnsafe('TRUNCATE "Categories", "UnitOfMeasures" CASCADE');
  await prisma.categories.create({ data: { CategoryId: 1, CategoryName: "Finished", Description: "" } });
  await prisma.unitOfMeasures.create({ data: { UomId: 1, Name: "Piece", Abbreviation: "pc", Code: "PC" } });
  const item = (ItemId: number, ItemName: string, IsActive: boolean) => prisma.items.create({
    data: { ItemId, ItemName, UomId: 1, StockUomId: 1, CategoryId: 1, MinStockLevel: 0, MaxStockLevel: 100, IsActive },
  });
  await item(1, "Ube Jam", true);
  await item(2, "Ube Powder", false);
  await prisma.finishedProducts.createMany({ data: [
    { ProductId: 1, ItemId: 1, Sku: "JAM-250", Variant: "250g", SellingPrice: 120.5, ImageUrl: "file-1" },
    { ProductId: 2, ItemId: 1, Sku: "JAM-DEFAULT", Variant: "", SellingPrice: 90 },
    { ProductId: 3, ItemId: 2, Sku: "POW-1", Variant: "1kg", SellingPrice: 300 },
  ] });
});

it("lists every Size with name, Variant, image, price and active state", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ products: [
    { productId: 1, name: "Ube Jam", variant: "250g", image: "file-1", price: 120.5, active: true },
    { productId: 2, name: "Ube Jam", variant: null, image: null, price: 90, active: true },
    { productId: 3, name: "Ube Powder", variant: "1kg", image: null, price: 300, active: false },
  ] });
});
it("treats a blank Variant as one unlabelled default Size", async () => {
  await prisma.finishedProducts.update({ where: { ProductId: 1 }, data: { Variant: "   " } });
  const { products } = await (await GET(request())).json();
  expect(products[0].variant).toBeNull();
});
it("refuses a missing or wrong credential, and every other credential", async () => {
  for (const credential of [null, "incorrect", process.env.SCMS_API_KEY ?? "pos-key"]) {
    const response = await GET(request(credential));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  }
  vi.stubEnv("IMS_SHOP_API_KEY", "");
  expect((await GET(request())).status).toBe(401);
});
