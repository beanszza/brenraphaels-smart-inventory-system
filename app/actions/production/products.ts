"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, validateInput, positiveId } from "@/lib/production/mutate";
import {
  generateProductCode,
  buildBaseVariantSku,
  getUniqueVariantSku,
} from "@/lib/production/sku";

export async function listProductFormLookups() {
  await requireModule("Production & Quality");
  return read(async () => {
    const [categories, uoms] = await Promise.all([
      prisma.categories.findMany({
        orderBy: { CategoryName: "asc" },
        select: { CategoryId: true, CategoryName: true },
      }),
      prisma.unitOfMeasures.findMany({
        orderBy: { Name: "asc" },
        select: { UomId: true, Name: true, Abbreviation: true },
      }),
    ]);
    return resourceResult({
      success: true,
      data: {
        categories,
        uoms: uoms.map((u) => ({
          uomId: u.UomId,
          name: u.Name,
          abbreviation: u.Abbreviation,
        })),
      },
    });
  });
}

export async function listFinishedProducts() {
  await requireModule("Production & Quality");
  return read(async () => {
    const products = await prisma.finishedProducts.findMany({
      include: {
        Items: {
          include: {
            Category: true,
            Uom: true,
          },
        },
      },
      orderBy: { ProductId: "desc" },
    });
    const response = products.map((fp) => ({
      productId: fp.ProductId,
      itemId: fp.ItemId,
      sellingPrice: Number(fp.SellingPrice),
      unitCost: Number(fp.UnitCost ?? 0),
      sku: fp.Sku,
      itemName: fp.Items?.ItemName || "",
      variant: fp.Variant,
      imageUrl: fp.ImageUrl || undefined,
      productCode: fp.Items?.ItemCode || "",
      categoryName: fp.Items?.Category?.CategoryName || "Finished Goods",
      uomName: fp.Items?.Uom?.Abbreviation || "pcs",
      description: fp.Items?.Description || "",
    }));
    return resourceResult({ success: true, data: response });
  });
}

export interface CreateProductVariantInput {
  variantName: string;
  unitCost?: number;
  sellingPrice: number;
}

export interface CreateFullProductInput {
  productName: string;
  categoryId: number;
  uomId: number;
  description?: string;
  unitCost: number;
  variants: CreateProductVariantInput[];
}

export async function createFinishedProductWithVariants(body: CreateFullProductInput) {
  const staff = await requireModule("Production & Quality");
  return mutate(staff, async (tx) => {
    validateInput(body);
    const trimmedName = body.productName?.trim() || "";
    if (!trimmedName) refuse("Enter a product name.");

    if (!Array.isArray(body.variants) || body.variants.length === 0) {
      refuse("Add at least one product variant.");
    }

    const categoryId = positiveId(body.categoryId);
    const uomId = positiveId(body.uomId);
    const productUnitCost = Number(body.unitCost) >= 0 ? Number(body.unitCost) : 0;

    // Check duplicate variant names in the submitted payload
    const seenNames = new Set<string>();
    for (const v of body.variants) {
      const vName = (v.variantName || "").trim().toLowerCase();
      if (!vName) refuse("All variants must have a name (e.g. '250g Tub').");
      if (seenNames.has(vName)) refuse(`Duplicate variant '${v.variantName}' in product definition.`);
      seenNames.add(vName);
      if (typeof v.sellingPrice !== "number" || v.sellingPrice < 0) {
        refuse("Selling price must be a valid non-negative number.");
      }
    }

    // Check if an Item record already exists with this name
    const existingItem = await tx.items.findFirst({
      where: { ItemName: { equals: trimmedName, mode: "insensitive" } },
    });

    let item = existingItem;
    if (!item) {
      const productCode = await generateProductCode(tx);
      item = await tx.items.create({
        data: {
          ItemCode: productCode,
          ItemName: trimmedName,
          Description: body.description?.trim() || null,
          UomId: uomId,
          StockUomId: uomId,
          CategoryId: categoryId,
          MinStockLevel: 0,
          MaxStockLevel: 1000,
          IsActive: true,
        },
      });
    } else {
      item = await tx.items.update({
        where: { ItemId: item.ItemId },
        data: {
          Description: body.description?.trim() || item.Description,
          UomId: uomId,
          StockUomId: uomId,
          CategoryId: categoryId,
        },
      });
    }

    const createdVariants = [];
    for (const v of body.variants) {
      const cleanVarName = v.variantName.trim();
      const baseSku = buildBaseVariantSku(trimmedName, cleanVarName);
      const uniqueSku = await getUniqueVariantSku(tx, baseSku);
      const varCost = Number(v.unitCost) > 0 ? Number(v.unitCost) : productUnitCost;

      const created = await tx.finishedProducts.create({
        data: {
          ItemId: item.ItemId,
          SellingPrice: v.sellingPrice,
          UnitCost: varCost,
          Sku: uniqueSku,
          Variant: cleanVarName,
        },
        include: {
          Items: {
            include: {
              Category: true,
              Uom: true,
            },
          },
        },
      });

      createdVariants.push({
        productId: created.ProductId,
        itemId: created.ItemId,
        sellingPrice: Number(created.SellingPrice),
        unitCost: Number(created.UnitCost),
        sku: created.Sku,
        variant: created.Variant,
        itemName: created.Items?.ItemName || "",
        productCode: created.Items?.ItemCode || "",
        categoryName: created.Items?.Category?.CategoryName || "",
        uomName: created.Items?.Uom?.Abbreviation || "",
      });
    }

    return {
      result: resourceResult({
        success: true,
        data: {
          item: {
            itemId: item.ItemId,
            itemName: item.ItemName,
            itemCode: item.ItemCode,
            description: item.Description,
          },
          variants: createdVariants,
        },
      }),
      audit: {
        module: "Production & Quality",
        change: "created",
        target: { type: "finished-product", id: createdVariants[0]?.productId || item.ItemId, name: item.ItemName },
        description: `${staff.name} created finished product ${item.ItemName} with ${createdVariants.length} variant(s)`,
      },
    };
  });
}

export async function createFinishedProduct(body: any = {}) {
  const staff = await requireModule("Production & Quality");
  return mutate(staff, async (tx) => {
    validateInput(body);
    const trimmedName = body.productName?.trim() || "";
    if (!trimmedName) refuse("Enter a product name.");

    const existingItem = await tx.items.findFirst({
      where: { ItemName: { equals: trimmedName, mode: "insensitive" } },
    });
    let item = existingItem;
    if (!item) {
      let category = null;
      if (body.categoryId) {
        category = await tx.categories.findUnique({ where: { CategoryId: positiveId(body.categoryId) } });
      }
      if (!category) {
        category = await tx.categories.findFirst({
          where: { CategoryName: { contains: "finished good", mode: "insensitive" } },
        });
      }
      if (!category) {
        category = await tx.categories.create({
          data: { CategoryName: "Finished Good", Description: "Finished Goods" },
        });
      }

      let uom = null;
      if (body.uomId) {
        uom = await tx.unitOfMeasures.findUnique({ where: { UomId: positiveId(body.uomId) } });
      }
      if (!uom) {
        uom = await tx.unitOfMeasures.findFirst({
          where: { Abbreviation: "pcs" },
        });
      }
      if (!uom) {
        uom = await tx.unitOfMeasures.findFirst();
      }

      const productCode = await generateProductCode(tx);
      item = await tx.items.create({
        data: {
          ItemCode: productCode,
          ItemName: trimmedName,
          Description: body.description?.trim() || null,
          UomId: uom?.UomId || 1,
          StockUomId: uom?.UomId || 1,
          CategoryId: category?.CategoryId || 1,
          MinStockLevel: 0,
          MaxStockLevel: 100,
          IsActive: true,
        },
      });
    }

    const variantLabel = body.variant?.trim() || "";
    let finalSku = body.sku?.trim().toUpperCase();
    if (!finalSku) {
      const baseSku = buildBaseVariantSku(trimmedName, variantLabel);
      finalSku = await getUniqueVariantSku(tx, baseSku);
    } else {
      // Ensure SKU is unique even if provided
      finalSku = await getUniqueVariantSku(tx, finalSku);
    }

    const unitCost = Number(body.unitCost) >= 0 ? Number(body.unitCost) : 0;

    const newProduct = await tx.finishedProducts.create({
      data: {
        ItemId: item.ItemId,
        SellingPrice: body.sellingPrice,
        UnitCost: unitCost,
        Sku: finalSku,
        Variant: variantLabel,
      },
      include: {
        Items: {
          include: {
            Category: true,
            Uom: true,
          },
        },
      },
    });

    const response = {
      productId: newProduct.ProductId,
      itemId: newProduct.ItemId,
      sellingPrice: Number(newProduct.SellingPrice),
      unitCost: Number(newProduct.UnitCost),
      sku: newProduct.Sku,
      itemName: newProduct.Items?.ItemName || "",
      variant: newProduct.Variant,
      productCode: newProduct.Items?.ItemCode || "",
      categoryName: newProduct.Items?.Category?.CategoryName || "",
      uomName: newProduct.Items?.Uom?.Abbreviation || "",
    };

    return {
      result: resourceResult({ success: true, data: response }),
      audit: {
        module: "Production & Quality",
        change: "created",
        target: { type: "finished-product", id: newProduct.ProductId, name: newProduct.Items.ItemName },
        description: `${staff.name} created finished product (${newProduct.Items.ItemName})`,
      },
    };
  });
}
