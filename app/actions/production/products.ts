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
  composeVariantName,
  parseVariantComponents,
} from "@/lib/production/sku";
import { ensureUbeJamHavaneroStock } from "@/lib/inventory/seed-stock";

export async function listProductFormLookups() {
  await requireModule("Production & Quality");
  return read(async () => {
    const standardUomDefs = [
      { name: "ML", fullName: "Millilitre", abbreviation: "ML", code: "mL", uomType: "Volume", factor: 0.001, isBase: false },
      { name: "G", fullName: "Gram", abbreviation: "G", code: "g", uomType: "Weight", factor: 0.001, isBase: false },
      { name: "KG", fullName: "Kilogram", abbreviation: "KG", code: "kg", uomType: "Weight", factor: 1, isBase: true },
      { name: "L", fullName: "Litre", abbreviation: "L", code: "L", uomType: "Volume", factor: 1, isBase: true },
    ];

    const dbUoms = await prisma.unitOfMeasures.findMany({
      where: {
        OR: [
          { Abbreviation: { in: ["ml", "mL", "ML", "g", "G", "kg", "KG", "l", "L"], mode: "insensitive" } },
          { Code: { in: ["ml", "mL", "ML", "g", "G", "kg", "KG", "l", "L"], mode: "insensitive" } },
          { Name: { in: ["Millilitre", "Milliliter", "Gram", "Kilogram", "Litre", "Liter"], mode: "insensitive" } },
        ],
      },
      select: { UomId: true, Name: true, Abbreviation: true },
    });

    const standardChoices = [];
    for (const def of standardUomDefs) {
      let match = dbUoms.find(
        (u) =>
          u.Abbreviation?.toLowerCase() === def.abbreviation.toLowerCase() ||
          u.Name.toLowerCase() === def.fullName.toLowerCase()
      );

      if (!match) {
        try {
          match = await prisma.unitOfMeasures.create({
            data: {
              Name: def.fullName,
              Abbreviation: def.abbreviation,
              Code: def.code,
              ConversionFactor: def.factor,
              IsBaseUnit: def.isBase,
              UomType: def.uomType,
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
        abbreviation: def.abbreviation,
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
        packagingTypes: ["Jar", "Container", "Pouch"],
      },
    });
  });
}

export async function listFinishedProducts() {
  await requireModule("Production & Quality");
  await ensureUbeJamHavaneroStock();
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

    // Share one photo per product across all variants of the same product name
    const sharedPhotoByProduct = new Map<string, string>();
    for (const fp of products) {
      const key = (fp.Items?.ItemName || "").trim().toLowerCase();
      if (key && fp.ImageUrl && !sharedPhotoByProduct.has(key)) {
        sharedPhotoByProduct.set(key, fp.ImageUrl);
      }
    }

    const response = products.map((fp) => {
      const parsed = parseVariantComponents(fp.Variant, fp.Items?.Uom?.Abbreviation);
      const nameKey = (fp.Items?.ItemName || "").trim().toLowerCase();
      const effectiveImage = fp.ImageUrl || (nameKey ? sharedPhotoByProduct.get(nameKey) : undefined);

      return {
        productId: fp.ProductId,
        itemId: fp.ItemId,
        sellingPrice: Number(fp.SellingPrice ?? 0),
        sku: fp.Sku,
        itemName: fp.Items?.ItemName || "",
        variant: parsed.variantName,
        contentSize: parsed.contentSize,
        contentUom: parsed.uom,
        packagingType: parsed.packagingType,
        minStockLevel: Number(fp.Items?.MinStockLevel ?? 10),
        maxStockLevel: Number(fp.Items?.MaxStockLevel ?? 100),
        imageUrl: effectiveImage || undefined,
        productCode: fp.Items?.ItemCode || "",
        categoryName: fp.Items?.Category?.CategoryName || "Finished Goods",
        uomName: parsed.uom,
        isActive: fp.Items?.IsActive ?? true,
      };
    });
    return resourceResult({ success: true, data: response });
  });
}

export interface CreateProductVariantInput {
  variantName?: string;
  contentSize?: string | number;
  contentUom?: string;
  packagingType?: string;
  uomId?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
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
  allowExistingProduct?: boolean;
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

    // Resolve default UOM fallback
    let fallbackUomId = body.uomId ? positiveId(body.uomId) : 1;

    // Normalize and validate variants
    const seenNames = new Set<string>();
    const normalizedVariants: Array<{
      variantName: string;
      contentUom: string;
      uomId?: number;
      minStockLevel: number;
      maxStockLevel: number;
      sellingPrice: number;
    }> = [];

    for (const v of body.variants) {
      const resolvedName =
        v.contentSize !== undefined && String(v.contentSize).trim() !== ""
          ? composeVariantName(
              v.contentSize,
              v.contentUom || body.uomName || "ML",
              v.packagingType || "Jar"
            )
          : (v.variantName || "").trim();

      const vNameKey = resolvedName.toLowerCase();
      if (!vNameKey) refuse("All variants must have a valid Content Size, Unit of Measurement, and Packaging Type.");
      if (seenNames.has(vNameKey)) refuse(`Duplicate variant '${resolvedName}' in product definition.`);
      seenNames.add(vNameKey);

      const effectivePrice =
        typeof v.unitCost === "number" && !isNaN(v.unitCost)
          ? v.unitCost
          : typeof v.sellingPrice === "number" && !isNaN(v.sellingPrice)
          ? v.sellingPrice
          : 0;
      if (effectivePrice < 0) {
        refuse("Unit cost must be a valid non-negative number.");
      }

      const minStock =
        typeof v.minStockLevel === "number" && !isNaN(v.minStockLevel) && v.minStockLevel >= 0
          ? v.minStockLevel
          : 10;
      const maxStock =
        typeof v.maxStockLevel === "number" && !isNaN(v.maxStockLevel) && v.maxStockLevel > 0
          ? v.maxStockLevel
          : Math.max(minStock * 2, 100);
      if (maxStock < minStock) {
        refuse("Maximum stock level cannot be less than minimum stock level.");
      }

      const parsed = parseVariantComponents(resolvedName, v.contentUom || body.uomName);
      normalizedVariants.push({
        variantName: resolvedName,
        contentUom: parsed.uom,
        uomId: v.uomId,
        minStockLevel: minStock,
        maxStockLevel: maxStock,
        sellingPrice: effectivePrice,
      });
    }

    // Prevent creating a duplicate product or variant that already exists in DB for this product
    const existingDbVariants = await tx.finishedProducts.findMany({
      where: {
        Items: { ItemName: { equals: trimmedName, mode: "insensitive" } },
      },
      select: {
        ProductId: true,
        Variant: true,
        ImageUrl: true,
        Items: { select: { ItemName: true } },
      },
    });

    if (!body.allowExistingProduct) {
      const hasSameProductName = existingDbVariants.some(
        (ex: any) => (ex.Items?.ItemName || "").trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (hasSameProductName) {
        refuse(`Product '${trimmedName}' already exists. Please edit the existing product instead.`);
      }
    }

    for (const v of normalizedVariants) {
      const targetCanonical = composeVariantName(
        parseVariantComponents(v.variantName, v.contentUom).contentSize,
        v.contentUom,
        parseVariantComponents(v.variantName, v.contentUom).packagingType
      ).toLowerCase();

      const conflict = existingDbVariants.find((ex) => {
        const exParsed = parseVariantComponents(ex.Variant);
        const exCanonical = composeVariantName(
          exParsed.contentSize,
          exParsed.uom,
          exParsed.packagingType
        ).toLowerCase();
        return exCanonical === targetCanonical || (ex.Variant || "").trim().toLowerCase() === v.variantName.toLowerCase();
      });

      if (conflict) {
        refuse(`Variant '${v.variantName}' already exists for product '${trimmedName}'.`);
      }
    }

    // Check if an existing variant of this product already has a shared photo
    const existingSiblingWithPhoto = existingDbVariants.find((ex) => Boolean(ex.ImageUrl));

    const createdVariants = [];
    let primaryItem: any = null;

    for (const v of normalizedVariants) {
      // Resolve UOM ID for this specific variant
      let variantUomId = v.uomId ? positiveId(v.uomId) : null;
      if (!variantUomId && v.contentUom) {
        const matchUom = await tx.unitOfMeasures.findFirst({
          where: {
            OR: [
              { Abbreviation: { equals: v.contentUom, mode: "insensitive" } },
              { Code: { equals: v.contentUom, mode: "insensitive" } },
              { Name: { equals: v.contentUom, mode: "insensitive" } },
            ],
          },
        });
        if (matchUom) variantUomId = matchUom.UomId;
      }
      if (!variantUomId) {
        variantUomId = fallbackUomId;
      }

      // Create a dedicated Items row per variant so each variant has independent stock, UOM, min/max stock, and active status
      const productCode = await generateProductCode(tx);
      const variantItem = await tx.items.create({
        data: {
          ItemCode: productCode,
          ItemName: trimmedName,
          UomId: variantUomId,
          StockUomId: variantUomId,
          CategoryId: categoryId,
          MinStockLevel: v.minStockLevel,
          MaxStockLevel: v.maxStockLevel,
          IsActive: true,
        },
      });
      if (!primaryItem) primaryItem = variantItem;

      const baseSku = buildBaseVariantSku(trimmedName, v.variantName);
      const uniqueSku = await getUniqueVariantSku(tx, baseSku);

      const created: any = await (tx as any).finishedProducts.create({
        data: {
          ItemId: variantItem.ItemId,
          SellingPrice: v.sellingPrice ?? 0,
          Sku: uniqueSku,
          Variant: v.variantName,
          ...(existingSiblingWithPhoto?.ImageUrl ? { ImageUrl: existingSiblingWithPhoto.ImageUrl } : {}),
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

      const parsed = parseVariantComponents(created.Variant, v.contentUom);

      createdVariants.push({
        productId: created.ProductId,
        itemId: created.ItemId,
        sellingPrice: Number(created.SellingPrice ?? 0),
        sku: created.Sku,
        variant: created.Variant,
        contentSize: parsed.contentSize,
        contentUom: parsed.uom,
        packagingType: parsed.packagingType,
        minStockLevel: Number(created.Items?.MinStockLevel ?? v.minStockLevel),
        maxStockLevel: Number(created.Items?.MaxStockLevel ?? v.maxStockLevel),
        itemName: created.Items?.ItemName || trimmedName,
        productCode: created.Items?.ItemCode || productCode,
        categoryName: created.Items?.Category?.CategoryName || "Finished Goods",
        uomName: parsed.uom,
        isActive: created.Items?.IsActive ?? true,
      });
    }

    return {
      result: resourceResult({
        success: true,
        data: {
          item: {
            itemId: primaryItem.ItemId,
            itemName: primaryItem.ItemName,
            itemCode: primaryItem.ItemCode,
          },
          variants: createdVariants,
        },
      }),
      audit: {
        module: "Production & Quality",
        change: "created",
        target: { type: "finished-product", id: createdVariants[0]?.productId || primaryItem.ItemId, name: primaryItem.ItemName },
        description: `${staff.name} created finished product ${primaryItem.ItemName} with ${createdVariants.length} variant(s)`,
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

    const variantLabel =
      body.contentSize !== undefined && String(body.contentSize).trim() !== ""
        ? composeVariantName(body.contentSize, body.contentUom || "ML", body.packagingType || "Jar")
        : body.variant?.trim() || "";
    const parsed = parseVariantComponents(variantLabel, body.contentUom);

    let uom = null;
    if (body.uomId) {
      uom = await tx.unitOfMeasures.findUnique({ where: { UomId: positiveId(body.uomId) } });
    }
    if (!uom) {
      uom = await tx.unitOfMeasures.findFirst({
        where: { Abbreviation: { equals: parsed.uom, mode: "insensitive" } },
      });
    }
    if (!uom) {
      uom = await tx.unitOfMeasures.findFirst();
    }

    const productCode = await generateProductCode(tx);
    const item = await tx.items.create({
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
        SellingPrice: typeof body.sellingPrice === "number" ? body.sellingPrice : 0,
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
      sellingPrice: Number(newProduct.SellingPrice ?? 0),
      sku: newProduct.Sku,
      itemName: newProduct.Items?.ItemName || trimmedName,
      variant: newProduct.Variant,
      contentSize: parsed.contentSize,
      contentUom: parsed.uom,
      packagingType: parsed.packagingType,
      productCode: newProduct.Items?.ItemCode || productCode,
      categoryName: newProduct.Items?.Category?.CategoryName || "",
      uomName: parsed.uom,
      isActive: newProduct.Items?.IsActive ?? true,
    };

    return {
      result: resourceResult({ success: true, data: response }),
      audit: {
        module: "Production & Quality",
        change: "created",
        target: { type: "finished-product", id: newProduct.ProductId, name: newProduct.Items?.ItemName || trimmedName },
        description: `${staff.name} created finished product (${newProduct.Items?.ItemName || trimmedName})`,
      },
    };
  });
}
