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
    prisma.categories.findMany({ where: { CategoryName: { in: ["Raw Materials", "Ingredients", "Tools and Supplies"] } } }),
    prisma.unitOfMeasures.findMany({ orderBy: [{ UomType: "asc" }, { Name: "asc" }] }),
  ]);
  return {
    supplies: items.filter(i => !i.Category.CategoryName.toLowerCase().includes("finished good")).map(i => ({
      itemId: i.ItemId, itemCode: i.ItemCode, itemName: i.ItemName, categoryId: i.CategoryId,
      categoryName: i.Category.CategoryName, uomId: i.UomId, uomName: i.Uom.Name,
      minStockLevel: Number(i.MinStockLevel), maxStockLevel: Number(i.MaxStockLevel),
      currentStock: i.Inventories.reduce((sum, row) => sum + Number(row.CurrentStock), 0),
      isActive: i.IsActive, supplierIds: i.SupplierItems.map(s => s.SupplierId),
    })),
    suppliers: suppliers.map(s => ({ supplierId: s.SupplierId, supplierCode: s.SupplierCode,
      companyName: s.CompanyName, contactPerson: s.ContactPerson, email: s.Email, phone: s.Phone,
      address: s.Address, website: s.Website ?? undefined, isActive: s.IsActive,
      suppliedItems: s.SupplierItems.map(i => ({ itemId: i.ItemId, itemName: i.Items.ItemName })),
    })),
    recipes: recipes.map(r => ({ recipeId: r.RecipeId, recipeCode: r.RecipeCode,
      recipeName: r.RecipeName, productId: r.ProductId, finishedProduct: r.Product.Items.ItemName,
      outputQuantity: Number(r.OutputQuantity), notes: r.Notes, isActive: r.IsActive,
      displayName: `${r.RecipeName} — Batch of ${Number(r.OutputQuantity)} pcs`,
      yieldLabel: `Batch of ${Number(r.OutputQuantity)} pcs`,
      ingredients: r.RecipeIngredients.map(i => ({ itemId: i.ItemId, uomId: i.UomId, standardQuantity: Number(i.StandardQuantity) })),
    })),
    products: products.map(p => ({ productId: p.ProductId, itemName: p.Items.ItemName, variant: p.Variant })),
    categories: categories.map(c => ({ categoryId: c.CategoryId, categoryName: c.CategoryName })),
    units: units.map(u => ({ uomId: u.UomId, code: u.Code, name: u.Name, abbreviation: u.Abbreviation,
      uomType: u.UomType, conversionFactor: Number(u.ConversionFactor) })),
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
