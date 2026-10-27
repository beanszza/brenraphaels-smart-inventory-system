import "server-only";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";

export async function getResources() {
  await requireModule("Resources & Suppliers");
  const [items, suppliers, recipes, products, categories, units] = await Promise.all([
    prisma.items.findMany({ include: { Category: true, Uom: true, Inventories: true, SupplierItems: true }, orderBy: { ItemId: "desc" } }),
    prisma.suppliers.findMany({ include: { SupplierItems: { include: { Items: true } } }, orderBy: { SupplierId: "desc" } }),
    prisma.recipes.findMany({ include: { RecipeIngredients: true, Product: { include: { Items: true } } }, orderBy: { RecipeId: "desc" } }),
    prisma.finishedProducts.findMany({ include: { Items: true }, orderBy: { ProductId: "asc" } }),
    prisma.categories.findMany({
      where: {
        NOT: {
          CategoryName: { in: ["Finished Goods", "Finished Good"] },
        },
      },
      select: {
        CategoryId: true,
        CategoryName: true,
        Description: true,
        _count: { select: { Items: true } },
      },
      orderBy: { CategoryId: "asc" },
    }),
    prisma.unitOfMeasures.findMany({ orderBy: [{ UomType: "asc" }, { Name: "asc" }] }),
  ]);

  let finalUnits = units;
  if (finalUnits.length === 0) {
    const DEFAULT_UOMS = [
      { Name: "Kilogram", Abbreviation: "kg", Code: "kg", ConversionFactor: 1, IsBaseUnit: true, UomType: "Weight" },
      { Name: "Piece", Abbreviation: "pcs", Code: "pcs", ConversionFactor: 1, IsBaseUnit: true, UomType: "Count" },
      { Name: "Litre", Abbreviation: "L", Code: "L", ConversionFactor: 1, IsBaseUnit: true, UomType: "Volume" },
      { Name: "Gram", Abbreviation: "g", Code: "g", ConversionFactor: 0.001, IsBaseUnit: false, UomType: "Weight" },
      { Name: "Box", Abbreviation: "box", Code: "box", ConversionFactor: 1, IsBaseUnit: false, UomType: "Count" },
      { Name: "Pack", Abbreviation: "pack", Code: "pack", ConversionFactor: 1, IsBaseUnit: false, UomType: "Count" },
      { Name: "Bottle", Abbreviation: "bottle", Code: "bottle", ConversionFactor: 1, IsBaseUnit: false, UomType: "Count" },
      { Name: "Meter", Abbreviation: "m", Code: "m", ConversionFactor: 1, IsBaseUnit: true, UomType: "Length" },
      { Name: "Millilitre", Abbreviation: "mL", Code: "mL", ConversionFactor: 0.001, IsBaseUnit: false, UomType: "Volume" },
      { Name: "Sack (50 kg)", Abbreviation: "sack", Code: "sack50", ConversionFactor: 50, IsBaseUnit: false, UomType: "Weight" },
      { Name: "Roll", Abbreviation: "roll", Code: "roll", ConversionFactor: 1, IsBaseUnit: false, UomType: "Count" },
    ];
    try {
      for (const def of DEFAULT_UOMS) {
        await prisma.unitOfMeasures.upsert({
          where: { Code: def.Code },
          update: {},
          create: def,
        });
      }
      finalUnits = await prisma.unitOfMeasures.findMany({ orderBy: [{ UomType: "asc" }, { Name: "asc" }] });
    } catch (e) {
      console.warn("Could not seed unitOfMeasures into DB, using fallback array:", e);
      finalUnits = DEFAULT_UOMS.map((u, i) => ({ ...u, UomId: i + 1, BaseUomId: null } as any));
    }
  }

  let finalCategories = categories;
  if (finalCategories.length === 0) {
    const DEFAULT_CATS = [
      { CategoryName: "Raw Materials", Description: "Unprocessed materials used in production" },
      { CategoryName: "Ingredients", Description: "Edible ingredients and food components" },
      { CategoryName: "Tools and Supplies", Description: "Operational tools, packaging, and supplies" },
    ];
    try {
      for (const cat of DEFAULT_CATS) {
        await prisma.categories.create({ data: cat });
      }
      finalCategories = await prisma.categories.findMany({
        where: { NOT: { CategoryName: { in: ["Finished Goods", "Finished Good"] } } },
        select: { CategoryId: true, CategoryName: true, Description: true, _count: { select: { Items: true } } },
        orderBy: { CategoryId: "asc" },
      });
    } catch (e) {
      console.warn("Could not seed initial categories:", e);
      finalCategories = DEFAULT_CATS.map((c, i) => ({ ...c, CategoryId: i + 1, _count: { Items: 0 } }));
    }
  }

  return {
    supplies: items
      .filter((i) => !i.Category?.CategoryName?.toLowerCase().includes("finished good"))
      .map((i) => ({
        itemId: i.ItemId,
        itemCode: i.ItemCode ?? `SPL-${String(i.ItemId).padStart(4, "0")}`,
        itemName: i.ItemName,
        categoryId: i.CategoryId,
        categoryName: i.Category?.CategoryName ?? "Uncategorized",
        uomId: i.UomId,
        uomName: i.Uom?.Name ?? "",
        minStockLevel: Number(i.MinStockLevel ?? 0),
        maxStockLevel: Number(i.MaxStockLevel ?? 0),
        currentStock: (i.Inventories ?? []).reduce((sum, row) => sum + Number(row.CurrentStock ?? 0), 0),
        isActive: i.IsActive ?? true,
        supplierIds: (i.SupplierItems ?? []).map((s) => s.SupplierId),
      })),
    suppliers: suppliers.map((s) => ({
      supplierId: s.SupplierId,
      supplierCode: s.SupplierCode ?? `SUP-${String(s.SupplierId).padStart(4, "0")}`,
      companyName: s.CompanyName,
      contactPerson: s.ContactPerson ?? "",
      email: s.Email ?? "",
      phone: s.Phone ?? "",
      address: s.Address ?? "",
      website: s.Website ?? undefined,
      isActive: s.IsActive ?? true,
      suppliedItems: (s.SupplierItems ?? []).map((i) => ({
        itemId: i.ItemId,
        itemName: i.Items?.ItemName ?? "",
      })),
    })),
    recipes: recipes.map((r) => ({
      recipeId: r.RecipeId,
      recipeCode: r.RecipeCode ?? `BOM-${String(r.RecipeId).padStart(4, "0")}`,
      recipeName: r.RecipeName,
      productId: r.ProductId,
      finishedProduct: r.Product?.Items?.ItemName ?? "Finished Product",
      outputQuantity: Number(r.OutputQuantity ?? 1),
      notes: r.Notes ?? "",
      isActive: r.IsActive ?? true,
      displayName: `${r.RecipeName} — Batch of ${Number(r.OutputQuantity ?? 1)} pcs`,
      yieldLabel: `Batch of ${Number(r.OutputQuantity ?? 1)} pcs`,
      ingredients: (r.RecipeIngredients ?? []).map((i) => ({
        itemId: i.ItemId,
        uomId: i.UomId,
        standardQuantity: Number(i.StandardQuantity ?? 0),
      })),
    })),
    products: products.map((p) => ({
      productId: p.ProductId,
      itemName: p.Items?.ItemName ?? "",
      variant: p.Variant ?? "",
    })),
    allCategories: finalCategories.map((c) => ({
      categoryId: c.CategoryId,
      categoryName: c.CategoryName,
      description: c.Description ?? "",
      isActive: (c as any).IsActive ?? true,
      itemCount: c._count?.Items ?? 0,
    })),
    categories: finalCategories
      .filter((c) => (c as any).IsActive !== false)
      .map((c) => ({ categoryId: c.CategoryId, categoryName: c.CategoryName })),
    units: finalUnits.map((u) => ({
      uomId: u.UomId,
      code: u.Code,
      name: u.Name,
      abbreviation: u.Abbreviation,
      uomType: u.UomType,
      conversionFactor: Number(u.ConversionFactor ?? 1),
    })),
  };
}

export type ResourcesData = Awaited<ReturnType<typeof getResources>>;

export async function getSupplyDetails(itemId: number) {
  await requireModule("Resources & Suppliers");
  if (!Number.isSafeInteger(itemId) || itemId <= 0) throw new Error("Invalid supply item.");
  const [links, orders] = await Promise.all([
    prisma.supplierItems.findMany({ where: { ItemId: itemId }, include: { Suppliers: true } }),
    prisma.purchaseOrders.findMany({ where: { PurchaseOrderItems: { some: { ItemId: itemId } } },
      include: { PurchaseOrderItems: { where: { ItemId: itemId }, include: { UnitOfMeasures: true } } }, orderBy: { OrderDate: "desc" }, take: 5 }),
  ]);
  return {
    linkedSuppliers: links.map(s => ({ supplierId: s.SupplierId, supplierName: s.Suppliers.CompanyName,
      supplierCode: s.Suppliers.SupplierCode, leadTimeDays: s.LeadTimeDays })),
    recentOrders: orders.flatMap(o => o.PurchaseOrderItems.map(i => ({ poId: o.PoId, poNumber: o.PoNumber,
      orderDate: o.OrderDate.toISOString(), status: o.Status, quantity: Number(i.PoItemQuantity), uomName: i.UnitOfMeasures.Name }))),
  };
}

export async function getSupplierDetails(supplierId: number) {
  await requireModule("Resources & Suppliers");
  if (!Number.isSafeInteger(supplierId) || supplierId <= 0) throw new Error("Invalid supplier.");
  const [links, orders] = await Promise.all([
    prisma.supplierItems.findMany({ where: { SupplierId: supplierId }, include: { Items: true, UnitOfMeasures: true } }),
    prisma.purchaseOrders.findMany({ where: { SupplierId: supplierId }, include: { _count: { select: { PurchaseOrderItems: true } } }, orderBy: { OrderDate: "desc" }, take: 5 }),
  ]);
  return {
    catalog: links.map(s => ({ itemId: s.ItemId, itemName: s.Items.ItemName, supplierSku: s.SupplierSku,
      unitPrice: Number(s.UnitPrice), currency: s.Currency, purchaseUomName: s.UnitOfMeasures.Name,
      packSize: Number(s.PackSize), leadTimeDays: s.LeadTimeDays, isPreferred: s.IsPreferred })),
    recentOrders: orders.map(o => ({ poId: o.PoId, poNumber: o.PoNumber, orderDate: o.OrderDate.toISOString(),
      status: o.Status, totalAmount: Number(o.TotalAmount), itemCount: o._count.PurchaseOrderItems })),
  };
}
