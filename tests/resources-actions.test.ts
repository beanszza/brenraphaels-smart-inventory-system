/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { AuditEventInput } from "@/lib/gateway/audit";
import * as items from "@/app/actions/resources/items";
import * as suppliers from "@/app/actions/resources/suppliers";
import * as locations from "@/app/actions/resources/locations";
import * as links from "@/app/actions/resources/supplier-items";
import * as recipes from "@/app/actions/resources/recipes";

const fake = vi.hoisted(() => ({
  dataAccess: vi.fn(),
  written: [] as AuditEventInput[],
  committed: [] as string[],
  signed: true,
  decision: "allowed",
  auditFails: false,
  commitFails: false,
  transactionOpen: false,
  linkExists: true,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-return-to": "/resources-suppliers" }),
  cookies: async () => ({ get: () => fake.signed ? { value: "opaque" } : undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`Redirect: ${url}`); },
}));
vi.mock("@/lib/gateway/audit", () => ({
  WRITE_TIMEOUT_MS: 3000,
  gatewayPort: {
    writeAudit: async (event: AuditEventInput) => {
      // The mutation must have persisted before the event can be sent.
      expect(fake.committed.length).toBeGreaterThan(0);
      expect(fake.transactionOpen).toBe(false);
      if (fake.auditFails) throw new Error("Gateway unavailable");
      fake.written.push(event);
    },
    listAudit: async () => [],
  },
}));

vi.mock("@/lib/prisma", () => {
  const row = {
    ItemId: 7, ItemName: "Flour", ItemCode: "SPL-7", UomId: 1, StockUomId: 1,
    CategoryId: 1, CategoryName: "Ingredients", MinStockLevel: 1, MaxStockLevel: 10,
    IsActive: true, SupplierId: 3, SupplierCode: "SUP-3", CompanyName: "Miller",
    SupplierItems: [], Inventories: [], RecipeIngredients: [],
    RecipeId: 4, RecipeName: "Bread", ProductId: 8, OutputQuantity: 100,
    LocationId: 9, LocationName: "Warehouse",
    Items: { ItemId: 8, ItemName: "Flour", Uom: {} },
    Suppliers: { CompanyName: "Miller" }, Category: { CategoryName: "Ingredients" },
    Product: { ItemId: 8 }, Uom: { Name: "kg" }, LastNumber: 1,
  };
  const model = (name: string) => ({
    findUnique: async () => name === "supplierItems" && !fake.linkExists ? null : name === "finishedProducts" ? { ...row, ItemId: 8 } : row,
    findFirst: async () => null,
    findMany: async () => [],
    count: async () => 0,
    create: async () => { fake.committed.push(name); return row; },
    update: async () => { fake.committed.push(name); return row; },
    upsert: async () => { fake.committed.push(name); return row; },
    delete: async () => { fake.committed.push(name); return row; },
    deleteMany: async () => { fake.committed.push(name); return { count: 1 }; },
  });
  const prisma = new Proxy({}, {
    get: (_target, name: string) => {
      fake.dataAccess(name);
      if (name === "$transaction") return async (work: (tx: PrismaClient) => Promise<unknown>) => {
        const before = [...fake.committed];
        fake.transactionOpen = true;
        try {
          const result = await work(prisma as PrismaClient);
          if (fake.commitFails) throw new Error("Transaction failed to commit");
          return result;
        } catch (error) {
          fake.committed.splice(0, fake.committed.length, ...before);
          throw error;
        } finally {
          fake.transactionOpen = false;
        }
      };
      return model(name);
    },
  });
  return { prisma };
});

beforeEach(() => {
  fake.dataAccess.mockClear();
  fake.written.length = 0;
  fake.committed.length = 0;
  fake.signed = true;
  fake.decision = "allowed";
  fake.auditFails = false;
  fake.commitFails = false;
  fake.transactionOpen = false;
  fake.linkExists = true;
  vi.stubEnv("IMS_DEV_BYPASS", "false");
  vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret");
  vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
    const { module } = JSON.parse(String(init.body));
    expect(module).toBe("Resources & Suppliers");
    if (fake.decision !== "allowed") return Response.json({ error: "invalid_handle" }, { status: Number(fake.decision) });
    return Response.json({ active: true, user_id: "staff-1", system: "IMS", module,
      staff: { name: "Ada Santos", username: "2026-AB-001", email: "ada@example.com" } });
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

// Discover every exported action, including future additions, and exercise it
// through the real Portal guard with no payload (authorization must run first).
const actionModules = import.meta.glob("../app/actions/resources/*.ts");
for (const [path, load] of Object.entries(actionModules)) {
  describe(path, async () => {
    const actions = await load() as Record<string, (...args: never[]) => Promise<unknown>>;
    for (const [name, action] of Object.entries(actions)) {
      it.each([
        ["unsigned", false, "allowed", "/signing-in"],
        ["revoked session", true, "401", "/signing-in"],
        ["missing Module", true, "403", "/no-access"],
        ["Portal unavailable", true, "503", "/unavailable"],
      ])(`${name} denies %s before reading inputs or data`, async (_, signed, decision, destination) => {
        fake.signed = Boolean(signed);
        fake.decision = String(decision);
        await expect(action()).rejects.toThrow(`Redirect: ${destination}`);
        expect(fake.dataAccess).not.toHaveBeenCalled();
        expect(fake.written).toEqual([]);
      });
    }
  });
}

const itemInput = { itemName: "Flour", uomId: 1, categoryId: 1, minStockLevel: 1, maxStockLevel: 10, createdBy: "Forged" };
const supplierInput = { companyName: "Miller", contactPerson: "Ana", email: "ana@example.com", phone: "09123456789", address: "Manila", createdBy: "Forged" };
const recipeInput = { recipeName: "Bread", productId: 8, ingredients: [{ itemId: 7, uomId: 1, standardQuantity: 2 }] };
const mutations = [
  ["create item", () => items.createItem(itemInput), "record.created", "item", "7", "Flour"],
  ["update item", () => items.updateItem(7, { itemName: "Flour" }), "record.updated", "item", "7", "Flour"],
  ["delete item", () => items.deleteItem(7), "record.deleted", "item", "7", "Flour"],
  ["create supplier", () => suppliers.createSupplier(supplierInput), "record.created", "supplier", "3", "Miller"],
  ["update supplier", () => suppliers.updateSupplier(3, { companyName: "Miller" }), "record.updated", "supplier", "3", "Miller"],
  ["delete supplier", () => suppliers.deleteSupplier(3), "record.deleted", "supplier", "3", "Miller"],
  ["create location", () => locations.createLocation({ locationName: "Warehouse" }), "record.created", "location", "9", "Warehouse"],
  ["update location", () => locations.updateLocation(9, { locationName: "Warehouse" }), "record.updated", "location", "9", "Warehouse"],
  ["save supplier link", () => links.saveSupplierItem({ supplierId: 3, itemId: 7, purchaseUomId: 1, unitPrice: 0 }), "record.updated", "supplier-item", "3/7", "Miller: Flour"],
  ["remove supplier link", () => links.removeSupplierItem(3, 7), "record.deleted", "supplier-item", "3/7", "Supplier 3, item 7"],
  ["create recipe", () => recipes.createRecipe(recipeInput), "record.created", "recipe", "4", "Bread"],
  ["update recipe", () => recipes.updateRecipe(4, { recipeName: "Bread" }), "record.updated", "recipe", "4", "Bread"],
  ["delete recipe", () => recipes.deleteRecipe(4), "record.deleted", "recipe", "4", "Bread"],
] as const;

it.each(mutations)("%s emits the persisted target and session actor through the gateway", async (_, act, action, type, id, display_name) => {
  expect((await act()).success).toBe(true);
  expect(fake.written).toHaveLength(1);
  expect(fake.written[0]).toMatchObject({
    source: "IMS", module: "Resources & Suppliers", action, outcome: "success",
    actor: { type: "staff", id: "2026-AB-001", display_name: "Ada Santos" },
    target: { type, id, display_name },
  });
  expect(fake.written[0].description).toContain("Ada Santos");
  if (type !== "supplier-item" || action !== "record.deleted") expect(fake.written[0].description).toContain(display_name);
});

it.each(mutations)("%s still succeeds when the audit gateway fails", async (_, act) => {
  fake.auditFails = true;
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await act()).success).toBe(true);
  expect(error).toHaveBeenCalledWith("Audit event could not be sent", expect.any(Error));
});

it.each(mutations)("%s does not publish an event for a transaction that fails to commit", async (_, act) => {
  fake.commitFails = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await act()).success).toBe(false);
  expect(fake.written).toEqual([]);
  expect(fake.committed).toEqual([]);
});

it("records a new supplier-item link as created", async () => {
  fake.linkExists = false;
  expect((await links.saveSupplierItem({ supplierId: 3, itemId: 7, purchaseUomId: 1, unitPrice: 0 })).success).toBe(true);
  expect(fake.written[0]).toMatchObject({ action: "record.created", target: { id: "3/7" } });
});

it("loads recipe choices with the Resources Module alone", async () => {
  const { loadResources } = await import("@/app/actions/resources/page-data");
  expect(await loadResources()).toEqual({ supplies: [], suppliers: [], recipes: [], categories: [], units: [], products: [] });
});

it("does not emit a success event or write data when validation rejects an item", async () => {
  expect(await items.createItem({ ...itemInput, itemName: "123" })).toMatchObject({ success: false });
  expect(fake.committed).toEqual([]);
  expect(fake.written).toEqual([]);
});

it("denies the resource page before loading its data during a Portal outage", async () => {
  fake.decision = "503";
  const { default: Page } = await import("@/app/(root)/resources-suppliers/page");
  await expect(Page()).rejects.toThrow("Redirect: /unavailable");
  expect(fake.dataAccess).not.toHaveBeenCalled();
});
