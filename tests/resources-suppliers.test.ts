import type { AuditEventInput } from "@/lib/gateway/audit";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveSupply, saveSupplier, saveRecipe, saveCategory, toggleCategoryStatus, loadSupplyDetails, loadSupplierDetails } from "@/lib/resources-suppliers/actions";
import { getResources } from "@/lib/resources-suppliers/data";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-return-to": "/resources-suppliers" }),
  cookies: async () => ({ get: () => ({ value: "opaque-session" }) }),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const audit = vi.hoisted(() => ({ events: [] as AuditEventInput[], fails: false }));
vi.mock("@/lib/gateway/audit", () => ({
  WRITE_TIMEOUT_MS: 3000,
  gatewayPort: {
    writeAudit: async (event: AuditEventInput) => {
      if (audit.fails) throw new Error("Gateway offline");
      audit.events.push(event);
    },
    listAudit: async () => [],
  },
}));

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  items: { findMany: vi.fn() }, suppliers: { findMany: vi.fn() },
  recipes: { findMany: vi.fn() }, finishedProducts: { findMany: vi.fn() },
  categories: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  unitOfMeasures: { findMany: vi.fn() },
  inventoryMovementLogs: { findMany: vi.fn() }, supplierItems: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const supplier = { companyName: "Acme", contactPerson: "Ada Santos", email: "ada@example.com",
  phone: "+639171234567", address: "Manila", isActive: true, suppliedItemIds: [] };
const supply = { itemName: "Sugar", categoryId: 1, uomId: 1, minStock: 1, maxStock: 20,
  isActive: true, supplierIds: [1] };
const recipe = { recipeName: "Cake", productId: 1, outputQuantity: 10, notes: "", isActive: true,
  ingredients: [{ itemId: 2, uomId: 1, standardQuantity: 2 }] };

beforeEach(() => {
  vi.clearAllMocks();
  audit.events.length = 0;
  audit.fails = false;
  vi.stubEnv("IMS_DEV_BYPASS", "false");
  vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret");
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const { module } = JSON.parse(init.body as string);
    expect(module).toBe("Resources & Suppliers");
    return Response.json({ active: true, user_id: "staff-1", system: "IMS", module,
      staff: { name: "Ada Santos", username: "ada", email: "ada@example.com" } });
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([403, 401, 503])("denies every page read and action before data access for Portal %i", async status => {
  vi.stubGlobal("fetch", async () => Response.json({}, { status }));
  for (const operation of [() => getResources(), () => loadSupplyDetails(1),
    () => loadSupplierDetails(1), () => saveSupply(supply), () => saveSupplier(supplier), () => saveRecipe(recipe)]) {
    await expect(operation()).rejects.toThrow("redirect:");
  }
  expect(db.$transaction).not.toHaveBeenCalled();
  for (const table of [db.items, db.suppliers, db.recipes, db.categories, db.finishedProducts, db.unitOfMeasures, db.inventoryMovementLogs, db.supplierItems]) {
    expect(table.findMany).not.toHaveBeenCalled();
  }
});

it("returns useful validation errors without saving invalid forms", async () => {
  expect(await saveSupply({ ...supply, maxStock: 0 })).toMatchObject({ success: false, message: expect.stringContaining("Stock limits") });
  expect(await saveSupplier({ ...supplier, email: "invalid" })).toMatchObject({ success: false, message: expect.stringContaining("email") });
  expect(await saveRecipe({ ...recipe, ingredients: [] })).toMatchObject({ success: false, message: expect.stringContaining("ingredient") });
  expect(db.$transaction).not.toHaveBeenCalled();
});

it("saves supplier contact edits without replacing the existing catalog", async () => {
  const record = { SupplierId: 1, CompanyName: "Old name", catalog: [{ itemId: 12, price: 50 }] };
  db.$transaction.mockImplementation(async callback => callback({ suppliers: {
    findFirst: async () => null, findUnique: async () => record,
    update: async ({ data }: { data: object }) => Object.assign(record, data),
  } }));
  expect(await saveSupplier(supplier, 1)).toEqual({ success: true, message: "Supplier saved successfully." });
  expect(record.CompanyName).toBe("Acme");
  expect(audit.events).toMatchObject([{ source: "IMS", module: "Resources & Suppliers", action: "record.updated",
    actor: { id: "ada", display_name: "Ada Santos" }, target: { type: "supplier", id: "1", display_name: "Acme" } }]);
  expect(record.catalog).toEqual([{ itemId: 12, price: 50 }]);
});

it("reports storage failure without leaking database details", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  db.$transaction.mockRejectedValueOnce(new Error("private database connection string"));
  expect(await saveSupplier(supplier)).toEqual({ success: false, message: "Unable to save. Please try again." });
  log.mockRestore();
});

it("saves a supply and updates supplier links while retaining existing catalog terms", async () => {
  const record = { ItemId: 8, ItemName: "Old sugar" };
  const links = [
    { SupplierId: 1, ItemId: 8, UnitPrice: 50 },
    { SupplierId: 3, ItemId: 8, UnitPrice: 30 },
  ];
  db.$transaction.mockImplementation(async callback => callback({
    categories: { findUnique: async () => ({ CategoryName: "Ingredients" }) },
    unitOfMeasures: { findUnique: async () => ({ UomId: 1 }) },
    suppliers: { count: async () => 2 },
    items: { findFirst: async () => null, findUnique: async () => record,
      update: async ({ data }: { data: object }) => Object.assign(record, data) },
    supplierItems: {
      deleteMany: async ({ where }: { where: { SupplierId: { notIn: number[] } } }) => {
        for (let index = links.length - 1; index >= 0; index--) {
          if (!where.SupplierId.notIn.includes(links[index].SupplierId)) links.splice(index, 1);
        }
      },
      upsert: async ({ create }: { create: typeof links[number] }) => {
        if (!links.some(link => link.SupplierId === create.SupplierId)) links.push(create);
      },
    },
  }));
  expect(await saveSupply({ ...supply, supplierIds: [1, 2] }, 8)).toMatchObject({ success: true });
  expect(record.ItemName).toBe("Sugar");
  expect(links.map(link => link.SupplierId)).toEqual([1, 2]);
  expect(links[0].UnitPrice).toBe(50);
  expect(audit.events).toMatchObject([{ target: { type: "item", id: "8" }, actor: { id: "ada" } }]);
});

it("saves a recipe with the selected product and ingredient quantities", async () => {
  let saved: unknown;
  db.$transaction.mockImplementation(async callback => callback({
    finishedProducts: { findUnique: async () => ({ ItemId: 10 }) },
    items: { findUnique: async () => ({ ItemId: 2, StockUomId: 1, Category: { CategoryName: "Ingredients" } }) },
    unitOfMeasures: { findUnique: async () => ({ UomType: "Weight", ConversionFactor: 1 }) },
    recipeIngredients: { create: async () => {} },
    recipes: { findUnique: async () => ({ RecipeId: 3, RecipeIngredients: [] }),
      update: async ({ data }: { data: unknown }) => { saved = data; } },
  }));
  expect(await saveRecipe(recipe, 3)).toMatchObject({ success: true });
  expect(audit.events).toMatchObject([{ target: { type: "recipe", id: "3" }, actor: { id: "ada" } }]);
  expect(saved).toMatchObject({ RecipeName: "Cake", ProductId: 1, OutputQuantity: 10 });
});

it("provides complete, serializable initial data, including supplier links and decimal values", async () => {
  db.items.findMany.mockResolvedValue(Array.from({ length: 125 }, (_, i) => ({
    ItemId: i + 1, ItemCode: `SPL-${i}`, ItemName: `Supply ${i}`, CategoryId: 1, UomId: 1,
    Category: { CategoryName: "Ingredients" }, Uom: { Name: "kg" }, MinStockLevel: "1.5", MaxStockLevel: "10",
    Inventories: [{ CurrentStock: "2.5" }], SupplierItems: [{ SupplierId: 7 }], IsActive: true,
  })));
  for (const table of [db.suppliers, db.recipes, db.finishedProducts, db.categories, db.unitOfMeasures]) table.findMany.mockResolvedValue([]);
  const result = await getResources();
  expect(result.supplies).toHaveLength(125);
  expect(result.supplies[0]).toMatchObject({ currentStock: 2.5, minStockLevel: 1.5, supplierIds: [7] });
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
});

it.each(["production reservation", "material issuance scan"])(
  "edits a recipe while preserving the ingredient referenced by a %s",
  async () => {
    const ingredient = { IngredientId: 71, RecipeId: 3, ItemId: 2, UomId: 1, StandardQuantity: 2 };
    const reference = { IngredientId: 71 };
    const record = { RecipeId: 3, OutputQuantity: 10, RecipeIngredients: [ingredient] };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.$transaction.mockImplementation(async callback => callback({
      finishedProducts: { findUnique: async () => ({ ItemId: 10 }) },
      items: { findUnique: async () => ({ ItemId: 2, StockUomId: 1, Category: { CategoryName: "Ingredients" } }) },
      unitOfMeasures: { findUnique: async () => ({ UomType: "Weight", ConversionFactor: 1 }) },
      recipes: {
        findUnique: async () => record,
        update: async ({ data }: { data: { OutputQuantity: number; RecipeIngredients?: { deleteMany?: object } } }) => {
          if (data.RecipeIngredients?.deleteMany) throw new Error("Foreign key prevents deleting referenced ingredient 71");
          record.OutputQuantity = data.OutputQuantity;
        },
      },
      recipeIngredients: {
        update: async ({ where, data }: { where: { IngredientId: number }; data: { StandardQuantity: number; UomId: number } }) => {
          expect(where.IngredientId).toBe(reference.IngredientId);
          Object.assign(ingredient, data);
        },
        deleteMany: async () => { throw new Error("Foreign key prevents deleting referenced ingredient 71"); },
      },
    }));
    try {
      const result = await saveRecipe({ ...recipe, outputQuantity: 24,
        ingredients: [{ itemId: 2, uomId: 1, standardQuantity: 4 }] }, 3);
      expect(result).toMatchObject({ success: true });
      expect(record.OutputQuantity).toBe(24);
      expect(ingredient).toMatchObject({ IngredientId: reference.IngredientId, StandardQuantity: 4 });
      expect(audit.events).toHaveLength(1);
    } finally { log.mockRestore(); }
  },
);


it("keeps a committed form successful when the audit gateway fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  audit.fails = true;
  let committed = false;
  db.$transaction.mockImplementation(async callback => {
    const result = await callback({ suppliers: {
      findFirst: async () => null, findUnique: async () => ({ SupplierId: 1 }),
      update: async () => { committed = true; },
    } });
    return result;
  });
  expect(await saveSupplier(supplier, 1)).toMatchObject({ success: true });
  expect(committed).toBe(true);
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});

it("allows editing a category to inactive and excludes inactive categories from supply category options", async () => {
  const catRecord = { CategoryId: 2, CategoryName: "Ingredients", Description: "Edible ingredients", _count: { Items: 3 } };
  db.categories.findFirst.mockResolvedValue(null);
  db.categories.findUnique.mockResolvedValue(catRecord);
  db.categories.update.mockImplementation(async ({ data }: { data: { CategoryName?: string; Description?: string } }) => {
    if (data.CategoryName !== undefined) catRecord.CategoryName = data.CategoryName;
    if (data.Description !== undefined) catRecord.Description = data.Description;
    return catRecord;
  });

  const editRes = await saveCategory({ categoryName: "Ingredients", description: "Edible ingredients", isActive: false }, 2);
  expect(editRes).toEqual({ success: true, message: "Category saved successfully." });

  db.items.findMany.mockResolvedValue([]);
  db.suppliers.findMany.mockResolvedValue([]);
  db.recipes.findMany.mockResolvedValue([]);
  db.finishedProducts.findMany.mockResolvedValue([]);
  db.unitOfMeasures.findMany.mockResolvedValue([{ UomId: 1, Code: "kg", Name: "Kilogram", Abbreviation: "kg", UomType: "Weight", ConversionFactor: 1 }]);
  db.categories.findMany.mockResolvedValue([
    { CategoryId: 1, CategoryName: "Raw Materials", Description: "Unprocessed materials", _count: { Items: 1 } },
    catRecord,
  ]);

  const resources = await getResources();
  const editedInAll = resources.allCategories.find((c) => c.categoryId === 2);
  expect(editedInAll).toMatchObject({
    categoryId: 2,
    categoryName: "Ingredients",
    description: "Edible ingredients",
    isActive: false,
  });
  // Inactive category must not appear in Supply category dropdown options
  expect(resources.categories).toEqual([{ categoryId: 1, categoryName: "Raw Materials" }]);

  // Reactivating restores it to Supply category options
  await toggleCategoryStatus(2, true);
  const afterReactivate = await getResources();
  expect(afterReactivate.categories).toEqual([
    { categoryId: 1, categoryName: "Raw Materials" },
    { categoryId: 2, categoryName: "Ingredients" },
  ]);
});

it("restricts Admin to configuring BOM only and IMS Manager to configuring Categories, Suppliers, and Supply only", async () => {
  // 1. Admin staff: cannot configure Categories, Suppliers, or Supply, but CAN configure BOM
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const { module } = JSON.parse(init.body as string);
    return Response.json({
      active: true,
      user_id: "admin-1",
      system: "IMS",
      module,
      staff: { name: "Jude Nitram", username: "2026-ADMIN-001", email: "admin@creoms.com" },
    });
  });

  expect(await saveCategory({ categoryName: "Test Cat", description: "Desc", isActive: true })).toMatchObject({
    success: false,
    message: expect.stringContaining("view-only"),
  });
  expect(await saveSupplier(supplier)).toMatchObject({
    success: false,
    message: expect.stringContaining("view-only"),
  });
  expect(await saveSupply(supply)).toMatchObject({
    success: false,
    message: expect.stringContaining("view-only"),
  });

  // 2. IMS Manager: cannot configure BOM
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const { module } = JSON.parse(init.body as string);
    return Response.json({
      active: true,
      user_id: "ims-1",
      system: "IMS",
      module,
      staff: { name: "Vince Neil", username: "2026-VM-007", email: "madejavinceneil@example.com" },
    });
  });

  expect(await saveRecipe(recipe)).toMatchObject({
    success: false,
    message: expect.stringContaining("do not have access to Bill of Materials"),
  });
});

it("enforces category, supplier, and supply character and numeric validation rules", async () => {
  // Category: no numbers, max 50 name, max 100 description (create & edit)
  expect(await saveCategory({ categoryName: "Packaging 1", description: "Valid", isActive: true })).toMatchObject({
    success: false,
    message: expect.stringContaining("numbers"),
  });
  expect(await saveCategory({ categoryName: "Packaging 2", description: "Valid", isActive: true }, 1)).toMatchObject({
    success: false,
    message: expect.stringContaining("numbers"),
  });
  expect(await saveCategory({ categoryName: "A".repeat(51), description: "Valid", isActive: true })).toMatchObject({
    success: false,
    message: expect.stringContaining("50"),
  });
  expect(await saveCategory({ categoryName: "Packaging", description: "D".repeat(101), isActive: true })).toMatchObject({
    success: false,
    message: expect.stringContaining("100"),
  });

  db.categories.findFirst.mockResolvedValue(null);
  db.categories.create.mockResolvedValue({ CategoryId: 10, CategoryName: "A".repeat(50), Description: "D".repeat(100) });
  expect(await saveCategory({ categoryName: "A".repeat(50), description: "D".repeat(100), isActive: true })).toEqual({
    success: true,
    message: "Category saved successfully.",
  });

  // Supplier: max 100 companyName, 50 chars per contact name part (combined up to 160)
  expect(await saveSupplier({ ...supplier, companyName: "S".repeat(101) })).toMatchObject({
    success: false,
    message: expect.stringContaining("100"),
  });
  db.$transaction.mockImplementationOnce(async callback => callback({
    documentSequences: { upsert: async () => ({ LastNumber: 1 }) },
    suppliers: {
      findFirst: async () => null,
      create: async () => ({ SupplierId: 99 }),
    },
  }));
  const longContact = `${"L".repeat(50)}, ${"F".repeat(50)} ${"M".repeat(50)}`;
  expect(await saveSupplier({ ...supplier, companyName: "S".repeat(100), contactPerson: longContact })).toEqual({
    success: true,
    message: "Supplier saved successfully.",
  });

  // Supply: max 50 itemName
  expect(await saveSupply({ ...supply, itemName: "A".repeat(51) })).toMatchObject({
    success: false,
    message: expect.stringContaining("50"),
  });
});
