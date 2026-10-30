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
    // Only standard finished goods UOMs: Jar, Container, Pouch
    const standardUomDefs = [
      { name: "Jar", abbreviation: "jar", code: "jar" },
      { name: "Container", abbreviation: "container", code: "container" },
      { name: "Pouch", abbreviation: "pouch", code: "pouch" },
    ];

    const dbUoms = await prisma.unitOfMeasures.findMany({
      where: {
        OR: [
          { Name: { in: ["Jar", "Container", "Pouch", "Tub"], mode: "insensitive" } },
          { Abbreviation: { in: ["jar", "container", "pouch", "tub"], mode: "insensitive" } },
        ],
      },
      select: { UomId: true, Name: true, Abbreviation: true },
    });

    const standardChoices = [];
    for (const def of standardUomDefs) {
      let match = dbUoms.find(
        (u) =>
          u.Name.toLowerCase() === def.name.toLowerCase() ||
          (def.name === "Container" && u.Name.toLowerCase() === "tub")
      );

      if (!match) {
        try {
          match = await prisma.unitOfMeasures.create({
            data: {
              Name: def.name,
              Abbreviation: def.abbreviation,
              Code: def.code,
              ConversionFactor: 1,
              IsBaseUnit: false,
              UomType: "Count",
            },
            select: { UomId: true, Name: true, Abbreviation: true },
          });
        } catch {
          match = dbUoms[0] || { UomId: standardChoices.length + 1, Name: def.name, Abbreviation: def.abbreviation };
        }
      }

      standardChoices.push({
        uomId: match.UomId,
        name: def.name,
        abbreviation: match.Abbreviation || def.abbreviation,
      });
    }

    const finishedCategory = await prisma.categories.findFirst({
      where: { CategoryName: { contains: "finished", mode: "insensitive" } },
      select: { CategoryId: true, CategoryName: true },
    });

    return resourceResult({
      success: true,
      data: {
        defaultCategoryId: finishedCategory?.CategoryId || 1,
        uoms: standardChoices,
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
      sku: fp.Sku,
      itemName: fp.Items?.ItemName || "",
      variant: fp.Variant,
      imageUrl: fp.ImageUrl || undefined,
      productCode: fp.Items?.ItemCode || "",
      categoryName: fp.Items?.Category?.CategoryName || "Finished Goods",
      uomName: fp.Items?.Uom?.Abbreviation || "pcs",
      isActive: fp.Items?.IsActive ?? true,
    }));
    return resourceResult({ success: true, data: response });
  });
}

export interface CreateProductVariantInput {
  variantName: string;
  unitCost?: number;
  sellingPrice?: number;
}

export interface CreateFullProductInput {
  productName: string;
  categoryId?: number;
  uomId?: number;
  uomName?: string;
  description?: string;
  unitCost?: number;
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

    // Automatically resolve category: Finished Goods / Finished Product
    let categoryId = body.categoryId ? positiveId(body.categoryId) : null;
    if (!categoryId) {
      const category = await tx.categories.findFirst({
        where: { CategoryName: { contains: "finished", mode: "insensitive" } },
      });
      categoryId = category?.CategoryId || 1;
    }

    // Automatically resolve UOM (Jar, Container, Pouch, or provided uomId)
    let uomId = body.uomId ? positiveId(body.uomId) : null;
    if (!uomId && body.uomName) {
      const matchUom = await tx.unitOfMeasures.findFirst({
        where: {
          OR: [
            { Name: { equals: body.uomName, mode: "insensitive" } },
            { Abbreviation: { equals: body.uomName, mode: "insensitive" } },
          ],
        },
      });
      if (matchUom) uomId = matchUom.UomId;
    }
    if (!uomId) {
      uomId = 1;
    }

    // Check duplicate variant names in the submitted payload
    const seenNames = new Set<string>();
    for (const v of body.variants) {
      const vName = (v.variantName || "").trim().toLowerCase();
      if (!vName) refuse("All variants must have a name (e.g. '250g Tub').");
      if (seenNames.has(vName)) refuse(`Duplicate variant '${v.variantName}' in product definition.`);
      seenNames.add(vName);
      const effectivePrice = typeof v.unitCost === "number" && !isNaN(v.unitCost)
        ? v.unitCost
        : (typeof v.sellingPrice === "number" && !isNaN(v.sellingPrice) ? v.sellingPrice : 0);
      if (effectivePrice < 0) {
        refuse("Unit cost must be a valid non-negative number.");
      }
      v.sellingPrice = effectivePrice;
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

      const created: any = await (tx as any).finishedProducts.create({
        data: {
          ItemId: item.ItemId,
          SellingPrice: v.sellingPrice ?? 0,
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

    const newProduct = await tx.finishedProducts.create({
      data: {
        ItemId: item.ItemId,
        SellingPrice: body.sellingPrice,
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
