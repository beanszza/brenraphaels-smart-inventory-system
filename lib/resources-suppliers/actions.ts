"use server";

import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { getSupplierDetails, getSupplyDetails } from "./data";
import { syncRecipeIngredients } from "@/lib/resources/recipe-ingredients";

type Result = { success: boolean; message: string };
export type SupplyInput = { itemName: string; categoryId: number; uomId: number; minStock: number;
  maxStock: number; isActive: boolean; supplierIds: number[] };
export type SupplierInput = { companyName: string; contactPerson: string; email: string; phone: string;
  address: string; website?: string; isActive: boolean; suppliedItemIds: number[] };
export type RecipeInput = { recipeName: string; productId: number; outputQuantity: number;
  notes: string; isActive: boolean; ingredients: { itemId: number; uomId: number; standardQuantity: number }[] };
export type CategoryInput = { categoryName: string; description?: string; isActive?: boolean };

class ValidationError extends Error {}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}
function validId(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function text(value: unknown, max: number) { return typeof value === "string" && value.trim().length > 0 && value.length <= max; }
function failed(error: unknown): Result {
  if (error instanceof ValidationError) return { success: false, message: error.message };
  console.error("Resources & Suppliers save failed", error);
  return { success: false, message: "Unable to save. Please try again." };
}
function saved(message: string): Result {
  revalidatePath("/resources-suppliers");
  return { success: true, message };
}
const linkDefaults = { UnitPrice: 0, Currency: "PHP", PackSize: 1, LeadTimeDays: 3,
  MinOrderQuantity: 1, IsPreferred: false, IsActive: true };

export async function saveSupply(input: SupplyInput, id?: number): Promise<Result> {
  const staff = await requireModule("Resources & Suppliers");
  try {
    check(id === undefined || validId(id), "Invalid supply item.");
    check(text(input.itemName, 50) && /^[a-zA-Z\s]+$/.test(input.itemName), "Supply name must contain letters only (max 50 characters).");
    check(validId(input.categoryId) && validId(input.uomId), "Select a category and unit of measure.");
    check(Number.isFinite(input.minStock) && input.minStock > 0 && Number.isFinite(input.maxStock) && input.maxStock >= input.minStock, "Stock limits must be positive; maximum must be at least minimum.");
    check(typeof input.isActive === "boolean", "Invalid status.");
    check(Array.isArray(input.supplierIds) && input.supplierIds.length > 0 && input.supplierIds.every(validId), "Select at least one supplier.");
    const targetId = await prisma.$transaction(async tx => {
      const category = await tx.categories.findUnique({ where: { CategoryId: input.categoryId } });
      check(category && !category.CategoryName.toLowerCase().includes("finished good") && (category as any).IsActive !== false, "Select an active supply category.");
      check(await tx.unitOfMeasures.findUnique({ where: { UomId: input.uomId } }), "Invalid unit of measure.");
      check(!await tx.items.findFirst({ where: { ItemName: { equals: input.itemName.trim(), mode: "insensitive" }, ...(id ? { ItemId: { not: id } } : {}) } }), "An item with this name already exists.");
      const supplierIds = [...new Set(input.supplierIds)];
      check(await tx.suppliers.count({ where: { SupplierId: { in: supplierIds } } }) === supplierIds.length, "One of the suppliers no longer exists.");
      const data = { ItemName: input.itemName.trim(), CategoryId: input.categoryId, UomId: input.uomId,
        StockUomId: input.uomId, MinStockLevel: input.minStock, MaxStockLevel: input.maxStock, IsActive: input.isActive };
      let itemId = id;
      if (itemId) {
        check(await tx.items.findUnique({ where: { ItemId: itemId } }), "Supply item no longer exists.");
        await tx.items.update({ where: { ItemId: itemId }, data });
      } else {
        const year = new Date().getFullYear();
        const seq = await tx.documentSequences.upsert({ where: { DocType_Year: { DocType: "Item", Year: year } },
          update: { LastNumber: { increment: 1 } }, create: { DocType: "Item", Year: year, LastNumber: 1 } });
        const item = await tx.items.create({ data: { ...data, ItemCode: `SPL-${year}-${String(seq.LastNumber).padStart(4, "0")}` } });
        itemId = item.ItemId;
      }
      await tx.supplierItems.deleteMany({ where: { ItemId: itemId, SupplierId: { notIn: supplierIds } } });
      for (const supplierId of supplierIds) {
        await tx.supplierItems.upsert({ where: { SupplierId_ItemId: { SupplierId: supplierId, ItemId: itemId } },
          update: {}, create: { ...linkDefaults, SupplierId: supplierId, ItemId: itemId, PurchaseUomId: input.uomId } });
      }
      return itemId;
    });
    await recordAudit(staff, { module: "Resources & Suppliers", change: id ? "updated" : "created",
      target: { type: "item", id: targetId, name: input.itemName.trim() },
      description: `${staff.name} ${id ? "updated" : "created"} supply item ${input.itemName.trim()} and its supplier links` });
    return saved("Supply item saved successfully.");
  } catch (error) { return failed(error); }
}

export async function saveSupplier(input: SupplierInput, id?: number): Promise<Result> {
  const staff = await requireModule("Resources & Suppliers");
  try {
    check(id === undefined || validId(id), "Invalid supplier.");
    check(text(input.companyName, 50), "Supplier name is required (max 50 characters).");
    check(text(input.contactPerson, 50) && !/\d/.test(input.contactPerson), "Enter a contact name without numbers (max 50 characters).");
    check(text(input.email, 50) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email), "Enter a valid email address.");
    check(text(input.phone, 50) && /^[+\d\s-]{7,20}$/.test(input.phone), "Enter a valid phone number.");
    check(text(input.address, 100), "Address is required (max 100 characters).");
    check(input.website === undefined || (typeof input.website === "string" && input.website.length <= 50), "Website cannot exceed 50 characters.");
    check(typeof input.isActive === "boolean", "Invalid status.");
    const targetId = await prisma.$transaction(async tx => {
      check(!await tx.suppliers.findFirst({ where: { CompanyName: { equals: input.companyName.trim(), mode: "insensitive" }, ...(id ? { SupplierId: { not: id } } : {}) } }), "A supplier with this name already exists.");
      const data = { CompanyName: input.companyName.trim(), ContactPerson: input.contactPerson.trim(), Email: input.email.trim(),
        Phone: input.phone.trim(), Address: input.address.trim(), Website: input.website ?? "", IsActive: input.isActive };
      if (id) {
        check(await tx.suppliers.findUnique({ where: { SupplierId: id } }), "Supplier no longer exists.");
        // This form does not edit the catalog. Preserve existing item links and prices.
        await tx.suppliers.update({ where: { SupplierId: id }, data });
      } else {
        const year = new Date().getFullYear();
        const seq = await tx.documentSequences.upsert({ where: { DocType_Year: { DocType: "Supplier", Year: year } },
          update: { LastNumber: { increment: 1 } }, create: { DocType: "Supplier", Year: year, LastNumber: 1 } });
        const created = await tx.suppliers.create({ data: { ...data, SupplierCode: `SUP-${year}-${String(seq.LastNumber).padStart(4, "0")}` } });
        return created.SupplierId;
      }
      return id;
    });
    await recordAudit(staff, { module: "Resources & Suppliers", change: id ? "updated" : "created",
      target: { type: "supplier", id: targetId, name: input.companyName.trim() },
      description: `${staff.name} ${id ? "updated" : "created"} supplier ${input.companyName.trim()}` });
    return saved("Supplier saved successfully.");
  } catch (error) { return failed(error); }
}

export async function saveRecipe(input: RecipeInput, id?: number): Promise<Result> {
  const staff = await requireModule("Resources & Suppliers");
  try {
    check(id === undefined || validId(id), "Invalid recipe.");
    check(text(input.recipeName, 100), "Recipe name is required (max 100 characters).");
    check(validId(input.productId), "Select a finished product.");
    check(Number.isFinite(input.outputQuantity) && input.outputQuantity > 0, "Batch size must be greater than zero.");
    check(typeof input.isActive === "boolean" && typeof input.notes === "string", "Invalid recipe details.");
    check(Array.isArray(input.ingredients) && input.ingredients.length > 0, "Add at least one ingredient.");
    check(new Set(input.ingredients.map(i => i.itemId)).size === input.ingredients.length, "Each ingredient may appear only once.");
    const targetId = await prisma.$transaction(async tx => {
      const product = await tx.finishedProducts.findUnique({ where: { ProductId: input.productId } });
      check(product, "Finished product no longer exists.");
      for (const ing of input.ingredients) {
        check(validId(ing.itemId) && validId(ing.uomId) && Number.isFinite(ing.standardQuantity) && ing.standardQuantity > 0, "Select ingredients and enter positive quantities.");
        const item = await tx.items.findUnique({ where: { ItemId: ing.itemId }, include: { Category: true } });
        check(item && item.ItemId !== product.ItemId && !item.Category.CategoryName.toLowerCase().includes("finished good"), "Finished products cannot be recipe ingredients.");
        const [from, to] = await Promise.all([
          tx.unitOfMeasures.findUnique({ where: { UomId: ing.uomId } }),
          tx.unitOfMeasures.findUnique({ where: { UomId: item.StockUomId ?? item.UomId } }),
        ]);
        check(from && to && from.UomType === to.UomType && Number(from.ConversionFactor) > 0 && Number(to.ConversionFactor) > 0, "Ingredient units must be compatible with their stock units.");
      }
      const data = { RecipeName: input.recipeName.trim(), ProductId: input.productId, OutputQuantity: input.outputQuantity,
        Notes: input.notes, IsActive: input.isActive };
      const ingredients = input.ingredients.map(i => ({ ItemId: i.itemId, UomId: i.uomId, StandardQuantity: i.standardQuantity }));
      if (id) {
        const existing = await tx.recipes.findUnique({ where: { RecipeId: id }, include: { RecipeIngredients: true } });
        check(existing, "Recipe no longer exists.");
        await syncRecipeIngredients(tx, id, existing.RecipeIngredients, input.ingredients);
        await tx.recipes.update({ where: { RecipeId: id }, data });
      } else {
        const year = new Date().getFullYear();
        const seq = await tx.documentSequences.upsert({ where: { DocType_Year: { DocType: "Recipe", Year: year } },
          update: { LastNumber: { increment: 1 } }, create: { DocType: "Recipe", Year: year, LastNumber: 1 } });
        const created = await tx.recipes.create({ data: { ...data, RecipeCode: `BOM-${year}-${String(seq.LastNumber).padStart(4, "0")}`, RecipeIngredients: { create: ingredients } } });
        return created.RecipeId;
      }
      return id;
    });
    await recordAudit(staff, { module: "Resources & Suppliers", change: id ? "updated" : "created",
      target: { type: "recipe", id: targetId, name: input.recipeName.trim() },
      description: `${staff.name} ${id ? "updated" : "created"} recipe ${input.recipeName.trim()}` });
    return saved("Recipe saved successfully.");
  } catch (error) { return failed(error); }
}

export async function loadSupplyDetails(id: number) {
  return getSupplyDetails(id);
}

export async function loadSupplierDetails(id: number) {
  return getSupplierDetails(id);
}

export async function saveCategory(input: CategoryInput, id?: number): Promise<Result> {
  const staff = await requireModule("Resources & Suppliers");
  try {
    check(id === undefined || validId(id), "Invalid category.");
    check(text(input.categoryName, 100), "Category name is required (max 100 characters).");
    const categoryName = input.categoryName.trim();
    check(!categoryName.toLowerCase().includes("finished good"), "Cannot use 'Finished Goods' category name.");

    const existing = await prisma.categories.findFirst({
      where: {
        CategoryName: { equals: categoryName, mode: "insensitive" },
        ...(id ? { CategoryId: { not: id } } : {}),
      },
    });
    check(!existing, "A category with this name already exists.");

    const data = {
      CategoryName: categoryName,
      Description: input.description?.trim() || "",
      IsActive: input.isActive ?? true,
    };

    let targetId = id;
    if (id) {
      const cat = await prisma.categories.findUnique({ where: { CategoryId: id } });
      check(cat, "Category no longer exists.");
      await prisma.categories.update({ where: { CategoryId: id }, data });
    } else {
      const created = await prisma.categories.create({ data });
      targetId = created.CategoryId;
    }

    await recordAudit(staff, {
      module: "Resources & Suppliers",
      change: id ? "updated" : "created",
      target: { type: "category", id: targetId, name: categoryName },
      description: `${staff.name} ${id ? "updated" : "created"} category ${categoryName}`,
    });
    return saved("Category saved successfully.");
  } catch (error) {
    return failed(error);
  }
}

export async function toggleCategoryStatus(id: number, isActive: boolean): Promise<Result> {
  const staff = await requireModule("Resources & Suppliers");
  try {
    check(validId(id), "Invalid category.");
    const cat = await prisma.categories.findUnique({ where: { CategoryId: id } });
    check(cat, "Category not found.");
    await prisma.categories.update({
      where: { CategoryId: id },
      data: { IsActive: isActive },
    });
    await recordAudit(staff, {
      module: "Resources & Suppliers",
      change: "status_changed",
      target: { type: "category", id, name: cat.CategoryName },
      description: `${staff.name} set category ${cat.CategoryName} to ${isActive ? "Active" : "Inactive"}`,
    });
    return saved(`Category ${isActive ? "activated" : "deactivated"} successfully.`);
  } catch (error) {
    return failed(error);
  }
}

