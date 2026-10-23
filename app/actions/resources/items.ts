"use server";

import type { ItemInput } from "@/lib/resources/inputs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { recordAudit, type AuditAction } from "@/lib/audit";
import { resourceResult, errorMessage } from "@/lib/resources/result";

export async function listItems(query = "") {
  await requireModule("Resources & Suppliers");

  try {
    const searchParams = new URLSearchParams(query);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const isActiveParam = searchParams.get("isActive");
    const sort = searchParams.get("sort") || "asc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));

    if (search.length > 200) {
      return resourceResult({ success: false, message: "Search query cannot exceed 200 characters.", data: null });
    }

    // Build the query where clause
    const where: Prisma.ItemsWhereInput = {};
    if (category) {
      where.Category = { CategoryName: category };
    }
    if (isActiveParam !== null && isActiveParam !== "") {
      where.IsActive = isActiveParam.toLowerCase() === "true";
    }

    // Fetch items with relations
    const items = await prisma.items.findMany({
      where,
      include: {
        Uom: true,
        Category: true,
        Inventories: true,
      },
      orderBy: { ItemId: sort.toLowerCase() === "desc" ? "desc" : "asc" },
    });

    // Map to response DTO format matching C#
    let formattedItems = items.map(i => ({
      itemId: i.ItemId,
      itemCode: i.ItemCode,
      itemName: i.ItemName,
      uomId: i.UomId,
      categoryId: i.CategoryId,
      uomName: i.Uom?.Name,
      categoryName: i.Category?.CategoryName,
      currentStock: i.Inventories.reduce((sum, inv) => sum + Number(inv.CurrentStock), 0),
      minStockLevel: Number(i.MinStockLevel),
      maxStockLevel: Number(i.MaxStockLevel),
      isActive: i.IsActive
    }));

    // In-memory search filter (replicating the C# logic)
    if (search) {
      const terms = search.split(/\s+/).filter(Boolean);
      formattedItems = formattedItems.filter(item => {
        return terms.every(term => {
          const lowerTerm = term.toLowerCase();
          const codeMatch = item.itemCode?.toLowerCase().includes(lowerTerm);
          const idMatch = item.itemId.toString().includes(lowerTerm);
          const nameMatch = item.itemName?.toLowerCase().includes(lowerTerm);
          const categoryMatch = item.categoryName?.toLowerCase().includes(lowerTerm);
          const quantityMatch = item.currentStock.toString().includes(lowerTerm);
          return codeMatch || idMatch || nameMatch || categoryMatch || quantityMatch;
        });
      });
    }

    const totalCount = formattedItems.length;
    const pagedItems = formattedItems.slice((page - 1) * pageSize, page * pageSize);

    return resourceResult({
      success: true,
      message: "Items fetched successfully.",
      data: {
        items: pagedItems,
        totalCount: totalCount,
        page: page,
        pageSize: pageSize
      }
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}`, data: null });
  }
}

export async function createItem(body: ItemInput) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const itemName = body.itemName?.trim();

      if (!itemName) return { result: resourceResult({ success: false, message: "Supply item name is required." }), audit: undefined };
      if (itemName.length > 50) return { result: resourceResult({ success: false, message: "Supply item name cannot exceed 50 characters." }), audit: undefined };
      if (!/^[a-zA-Z\s]+$/.test(itemName)) return { result: resourceResult({ success: false, message: "Supply item name can only contain letters." }), audit: undefined };
      if (body.minStockLevel <= 0) return { result: resourceResult({ success: false, message: "Min stock level must be greater than 0." }), audit: undefined };
      if (body.maxStockLevel <= 0) return { result: resourceResult({ success: false, message: "Max stock level must be greater than 0." }), audit: undefined };
      if (body.maxStockLevel < body.minStockLevel) return { result: resourceResult({ success: false, message: "Max stock level cannot be less than min stock level." }), audit: undefined };

      const normalizedName = itemName.toLowerCase();
      const nameExists = await tx.items.findFirst({
        where: { ItemName: { equals: normalizedName, mode: 'insensitive' } }
      });
      if (nameExists) return { result: resourceResult({ success: false, message: "An item with this name already exists." }), audit: undefined };

      if (!body.uomId || typeof body.uomId !== 'number') {
        return { result: resourceResult({ success: false, message: "Please select a valid Unit of Measurement." }), audit: undefined };
      }
      if (!body.categoryId || typeof body.categoryId !== 'number') {
        return { result: resourceResult({ success: false, message: "Please select a valid Category." }), audit: undefined };
      }

      const uom = await tx.unitOfMeasures.findUnique({ where: { UomId: body.uomId } });
      const category = await tx.categories.findUnique({ where: { CategoryId: body.categoryId } });
      if (!uom || !category) return { result: resourceResult({ success: false, message: "Invalid UOM or Category ID" }), audit: undefined };

      const allowedCategories = ["Raw Materials", "Ingredients", "Tools and Supplies"];
      if (!allowedCategories.includes(category.CategoryName)) {
        return { result: resourceResult({ success: false, message: "Category must be 'Raw Materials', 'Ingredients', or 'Tools and Supplies'." }), audit: undefined };
      }

      // Atomic Document Number generation for "Item"
      const year = new Date().getFullYear();
      const seq = await tx.documentSequences.upsert({
        where: { DocType_Year: { DocType: "Item", Year: year } },
        update: { LastNumber: { increment: 1 } },
        create: { DocType: "Item", Year: year, LastNumber: 1 },
      });
      const itemCode = `SPL-${year}-${String(seq.LastNumber).padStart(4, '0')}`;

      const newItem = await tx.items.create({
        data: {
          ItemCode: itemCode,
          ItemName: itemName,
          UomId: body.uomId,
          StockUomId: body.uomId,
          CategoryId: body.categoryId,
          MinStockLevel: body.minStockLevel,
          MaxStockLevel: body.maxStockLevel,
          IsActive: body.isActive ?? true,
        },
        include: {
          Uom: true,
          Category: true,
        }
      });

      const response = {
        itemId: newItem.ItemId,
        itemCode: newItem.ItemCode,
        itemName: newItem.ItemName,
        uomId: newItem.UomId,
        categoryId: newItem.CategoryId,
        minStockLevel: Number(newItem.MinStockLevel),
        maxStockLevel: Number(newItem.MaxStockLevel),
        isActive: newItem.IsActive,
        uomName: newItem.Uom?.Name,
        categoryName: newItem.Category?.CategoryName,
        currentStock: 0,
      };

      const audit = {
        module: "Resources & Suppliers", change: "created",
        target: { type: "item", id: newItem.ItemId, name: newItem.ItemName },
        description: `${staff.name} created item ${newItem.ItemName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Item created successfully", data: response }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    console.error("Error creating item:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function getItem(idInput: string | number) {
  await requireModule("Resources & Suppliers");

  try {
    const id = parseInt(String(idInput), 10);
    const item = await prisma.items.findUnique({
      where: { ItemId: id },
      include: {
        Uom: true,
        Category: true,
        Inventories: true,
      }
    });

    if (!item) return resourceResult({ success: false, message: "Item not found" });

    const response = {
      itemId: item.ItemId,
      itemCode: item.ItemCode,
      itemName: item.ItemName,
      uomId: item.UomId,
      categoryId: item.CategoryId,
      minStockLevel: Number(item.MinStockLevel),
      maxStockLevel: Number(item.MaxStockLevel),
      isActive: item.IsActive,
      uomName: item.Uom?.Name,
      categoryName: item.Category?.CategoryName,
      currentStock: item.Inventories.reduce((sum, inv) => sum + Number(inv.CurrentStock), 0),
    };

    return resourceResult({ success: true, data: response });
  } catch (error) {
    console.error("Error fetching item:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function updateItem(idInput: string | number, body: Partial<ItemInput>) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const id = parseInt(String(idInput), 10);

      const existingItem = await tx.items.findUnique({ where: { ItemId: id } });
      if (!existingItem) return { result: resourceResult({ success: false, message: "Item not found" }), audit: undefined };

      if (body.itemName && body.itemName.toLowerCase() !== existingItem.ItemName.toLowerCase()) {
        const trimmedName = body.itemName.trim();
        if (!trimmedName) return { result: resourceResult({ success: false, message: "Supply item name cannot be empty." }), audit: undefined };
        if (trimmedName.length > 50) return { result: resourceResult({ success: false, message: "Supply item name cannot exceed 50 characters." }), audit: undefined };
        if (!/^[a-zA-Z\s]+$/.test(trimmedName)) return { result: resourceResult({ success: false, message: "Supply item name can only contain letters." }), audit: undefined };

        const nameExists = await tx.items.findFirst({
          where: { ItemName: { equals: trimmedName.toLowerCase(), mode: 'insensitive' }, ItemId: { not: id } }
        });
        if (nameExists) return { result: resourceResult({ success: false, message: "An item with this name already exists." }), audit: undefined };
      }

      const nextMin = body.minStockLevel ?? Number(existingItem.MinStockLevel);
      const nextMax = body.maxStockLevel ?? Number(existingItem.MaxStockLevel);
      if (body.minStockLevel !== undefined && body.minStockLevel <= 0) return { result: resourceResult({ success: false, message: "Min stock level must be greater than 0." }), audit: undefined };
      if (body.maxStockLevel !== undefined && body.maxStockLevel <= 0) return { result: resourceResult({ success: false, message: "Max stock level must be greater than 0." }), audit: undefined };
      if (nextMax < nextMin) return { result: resourceResult({ success: false, message: "Max stock level cannot be less than min stock level." }), audit: undefined };

      if (body.categoryId) {
        const category = await tx.categories.findUnique({ where: { CategoryId: body.categoryId } });
        if (!category) return { result: resourceResult({ success: false, message: "Invalid Category ID" }), audit: undefined };
        const allowedCategories = ["Raw Materials", "Ingredients", "Tools and Supplies"];
        if (!allowedCategories.includes(category.CategoryName)) {
          return { result: resourceResult({ success: false, message: "Category must be 'Raw Materials', 'Ingredients', or 'Tools and Supplies'." }), audit: undefined };
        }
      }

      if (body.uomId) {
        const uomExists = await tx.unitOfMeasures.findUnique({ where: { UomId: body.uomId } });
        if (!uomExists) return { result: resourceResult({ success: false, message: "Invalid UOM ID" }), audit: undefined };
      }

      const updatedItem = await tx.items.update({
        where: { ItemId: id },
        data: {
          ItemName: body.itemName !== undefined ? body.itemName : undefined,
          UomId: body.uomId !== undefined ? body.uomId : undefined,
          StockUomId: body.uomId !== undefined ? body.uomId : undefined,
          CategoryId: body.categoryId !== undefined ? body.categoryId : undefined,
          MinStockLevel: body.minStockLevel !== undefined ? body.minStockLevel : undefined,
          MaxStockLevel: body.maxStockLevel !== undefined ? body.maxStockLevel : undefined,
          IsActive: body.isActive !== undefined ? body.isActive : undefined,
        },
        include: {
          Uom: true,
          Category: true,
          Inventories: true,
        }
      });

      const response = {
        itemId: updatedItem.ItemId,
        itemCode: updatedItem.ItemCode,
        itemName: updatedItem.ItemName,
        uomId: updatedItem.UomId,
        categoryId: updatedItem.CategoryId,
        minStockLevel: Number(updatedItem.MinStockLevel),
        maxStockLevel: Number(updatedItem.MaxStockLevel),
        isActive: updatedItem.IsActive,
        uomName: updatedItem.Uom?.Name,
        categoryName: updatedItem.Category?.CategoryName,
        currentStock: updatedItem.Inventories.reduce((sum, inv) => sum + Number(inv.CurrentStock), 0),
      };

      const audit = {
        module: "Resources & Suppliers", change: "updated",
        target: { type: "item", id: updatedItem.ItemId, name: updatedItem.ItemName },
        description: `${staff.name} updated item ${updatedItem.ItemName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Item updated successfully", data: response }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    console.error("Error updating item:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function deleteItem(idInput: string | number) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const id = parseInt(String(idInput), 10);
      const item = await tx.items.findUnique({
        where: { ItemId: id },
        include: { Inventories: true }
      });

      if (!item) return { result: resourceResult({ success: false, message: "Item not found" }), audit: undefined };
      const hasStock = item.Inventories.some(inv => Number(inv.CurrentStock) > 0);
      if (hasStock) return { result: resourceResult({ success: false, message: "Cannot delete item with existing stock." }), audit: undefined };

      await tx.items.delete({ where: { ItemId: id } });

      const audit = {
        module: "Resources & Suppliers", change: "deleted",
        target: { type: "item", id: item.ItemId, name: item.ItemName },
        description: `${staff.name} deleted item ${item.ItemName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Item deleted successfully" }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    console.error("Error deleting item:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

