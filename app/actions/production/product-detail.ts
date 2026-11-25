"use server";
import { auditVersion } from "@/lib/audit";

/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { unlinkFile } from "@/lib/files";
import { filesGateway } from "@/lib/gateway/files";
import { productImage, batchImage } from "@/lib/file-routes";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";
import {
  composeVariantName,
  parseVariantComponents,
  generateProductCode,
  buildBaseVariantSku,
  getUniqueVariantSku,
} from "@/lib/production/sku";

export async function updateFinishedProduct(idInput: string | number, body: any = {}) {
  const staff = await requireModule("Production & Quality");
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    validateInput(body);
    const product = await tx.finishedProducts.findUnique({
      where: { ProductId: id },
      include: {
        Items: {
          include: {
            Category: true,
            Uom: true,
          },
        },
      },
    });
    if (!product) {
      return refuse("Finished product not found.");
    }

    const effectivePrice =
      body.sellingPrice !== undefined
        ? Number(body.sellingPrice)
        : body.unitCost !== undefined
          ? Number(body.unitCost)
          : product.SellingPrice;

    if (body.sellingPrice !== undefined || body.unitCost !== undefined) {
      if (isNaN(Number(effectivePrice)) || Number(effectivePrice) < 0) {
        return refuse("Selling price must be a valid non-negative number.");
      }
    }

    const resolvedVariant =
      body.contentSize !== undefined && String(body.contentSize).trim() !== ""
        ? composeVariantName(
          body.contentSize,
          body.contentUom || product.Items?.Uom?.Abbreviation || "ML",
          body.packagingType || "Jar"
        )
        : body.variant !== undefined
          ? body.variant
          : product.Variant;

    const parsed = parseVariantComponents(resolvedVariant, body.contentUom || product.Items?.Uom?.Abbreviation);
    const previousParsed = parseVariantComponents(product.Variant, product.Items?.Uom?.Abbreviation);

    const effectiveProductName =
      body.productName !== undefined && String(body.productName).trim() !== ""
        ? String(body.productName).trim()
        : product.Items?.ItemName || "Finished Product";

    const updateData: any = {
      Variant: resolvedVariant,
      SellingPrice: effectivePrice,
    };

    // Update SKU if variant definition (size/UOM/packaging) or product name changed, or if SKU was missing
    const variantChanged =
      parsed.variantName.toLowerCase() !== previousParsed.variantName.toLowerCase() ||
      effectiveProductName.toLowerCase() !== (product.Items?.ItemName || "").trim().toLowerCase();

    if (variantChanged) {
      const baseSku = buildBaseVariantSku(effectiveProductName, resolvedVariant);
      updateData.Sku = await getUniqueVariantSku(tx, baseSku, id);
    } else if (body.sku && !product.Sku) {
      updateData.Sku = body.sku;
    }

    // Resolve UOM if contentUom was changed
    let targetUomId = body.uomId ? positiveId(body.uomId) : undefined;
    if (!targetUomId && body.contentUom) {
      const matchUom = await tx.unitOfMeasures.findFirst({
        where: {
          OR: [
            { Abbreviation: { equals: parsed.uom, mode: "insensitive" } },
            { Code: { equals: parsed.uom, mode: "insensitive" } },
          ],
        },
      });
      if (matchUom) {
        targetUomId = matchUom.UomId;
      }
    }

    const nextMinStock =
      typeof body.minStockLevel === "number" && !isNaN(body.minStockLevel)
        ? body.minStockLevel
        : undefined;
    const nextMaxStock =
      typeof body.maxStockLevel === "number" && !isNaN(body.maxStockLevel)
        ? body.maxStockLevel
        : undefined;

    if (nextMinStock !== undefined && nextMinStock < 0) {
      return refuse("Min stock level cannot be negative.");
    }
    if (nextMaxStock !== undefined && nextMaxStock <= 0) {
      return refuse("Max stock level must be greater than 0.");
    }
    const effectiveMin = nextMinStock ?? Number(product.Items?.MinStockLevel ?? 0);
    const effectiveMax = nextMaxStock ?? Number(product.Items?.MaxStockLevel ?? 1000);
    if (nextMinStock !== undefined || nextMaxStock !== undefined) {
      if (effectiveMax < effectiveMin) {
        return refuse("Max stock level cannot be less than min stock level.");
      }
    }

    // Ensure variant has its own dedicated Items row before mutating Item-level fields (IsActive, UomId, Min/MaxStock, etc.)
    const siblingsOnSameItem = await tx.finishedProducts.count({
      where: { ItemId: product.ItemId, ProductId: { not: id } },
    });

    if (siblingsOnSameItem > 0) {
      const newCode = await generateProductCode(tx);
      const dedicatedItem = await tx.items.create({
        data: {
          ItemCode: newCode,
          ItemName: body.productName !== undefined ? body.productName.trim() : product.Items?.ItemName || "Finished Product",
          UomId: targetUomId ?? product.Items?.UomId ?? 1,
          StockUomId: targetUomId ?? product.Items?.StockUomId ?? product.Items?.UomId ?? 1,
          CategoryId: product.Items?.CategoryId ?? 1,
          MinStockLevel: nextMinStock ?? product.Items?.MinStockLevel ?? 10,
          MaxStockLevel: nextMaxStock ?? product.Items?.MaxStockLevel ?? 100,
          IsActive: body.isActive !== undefined ? Boolean(body.isActive) : product.Items?.IsActive ?? true,
        },
      });
      updateData.ItemId = dedicatedItem.ItemId;
    }

    const hasItemUpdate =
      siblingsOnSameItem === 0 &&
      (body.productName !== undefined ||
        body.isActive !== undefined ||
        targetUomId !== undefined ||
        nextMinStock !== undefined ||
        nextMaxStock !== undefined);

    const updatedProduct = await tx.finishedProducts.update({
      where: { ProductId: id },
      data: {
        ...updateData,
        ...(hasItemUpdate
          ? {
            Items: {
              update: {
                ...(body.productName !== undefined ? { ItemName: body.productName.trim() } : {}),
                ...(body.isActive !== undefined ? { IsActive: Boolean(body.isActive) } : {}),
                ...(targetUomId !== undefined ? { UomId: targetUomId, StockUomId: targetUomId } : {}),
                ...(nextMinStock !== undefined ? { MinStockLevel: nextMinStock } : {}),
                ...(nextMaxStock !== undefined ? { MaxStockLevel: nextMaxStock } : {}),
              },
            },
          }
          : {}),
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
      productId: updatedProduct.ProductId,
      itemId: updatedProduct.ItemId,
      sellingPrice: Number(updatedProduct.SellingPrice ?? 0),
      sku: updatedProduct.Sku,
      itemName: updatedProduct.Items?.ItemName || "",
      variant: updatedProduct.Variant,
      contentSize: parsed.contentSize,
      contentUom: parsed.uom,
      packagingType: parsed.packagingType,
      minStockLevel: Number(updatedProduct.Items?.MinStockLevel ?? effectiveMin),
      maxStockLevel: Number(updatedProduct.Items?.MaxStockLevel ?? effectiveMax),
      productCode: updatedProduct.Items?.ItemCode || "",
      categoryName: updatedProduct.Items?.Category?.CategoryName || "",
      uomName: parsed.uom,
      isActive: updatedProduct.Items?.IsActive ?? true,
    };

    return {
      result: resourceResult({ success: true, data: response }),
      audit: {
        module: "Production & Quality",
        action: "record.updated",
        target: { type: "finished-product", id: id, name: String(id) },
        description: `${staff.name} updated finished product (${String(id)})`,
      },
    };
  }, { module: "Production & Quality", action: "record.updated", target: { type: "operation", id: String(idInput), name: "updateFinishedProduct" }, description: "Validation refused for updateFinishedProduct", version: auditVersion([idInput, body]) });
}

export async function deleteFinishedProduct(idInput: string | number) {
  const staff = await requireModule("Production & Quality");
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    const product = await tx.finishedProducts.findUnique({
      where: { ProductId: id },
      include: { Items: true },
    });
    if (!product) {
      return refuse("Finished product variant not found.");
    }

    // Prevent deletion if this finished product still has stock in inventory (Inventories or active InventoryLots)
    const [inventories, lots] = await Promise.all([
      tx.inventories.findMany({
        where: { ItemId: product.ItemId },
        select: { CurrentStock: true },
      }),
      tx.inventoryLots.findMany({
        where: { ItemId: product.ItemId, QuantityRemaining: { gt: 0 } },
        select: { QuantityRemaining: true },
      }),
    ]);

    const invStock = (inventories ?? []).reduce(
      (sum: number, row: { CurrentStock?: unknown }) => sum + (Number(row.CurrentStock) || 0),
      0
    );
    const lotStock = (lots ?? []).reduce(
      (sum: number, row: { QuantityRemaining?: unknown }) => sum + (Number(row.QuantityRemaining) || 0),
      0
    );
    const totalStock = Math.max(invStock, lotStock);

    if (totalStock > 0) {
      const label = [product.Items?.ItemName, product.Variant].filter(Boolean).join(" - ") || `Product #${id}`;
      return refuse(
        `Cannot delete "${label}" because it currently has ${totalStock} unit(s) in inventory. Clear or transfer all remaining stock first.`
      );
    }

    const batches = await tx.productionBatches.findMany({ where: { ProductId: id }, select: { BatchId: true, ImageUrl: true } });
    for (const batch of batches) await unlinkFile(filesGateway, staff, batchImage, batch.BatchId, batch.ImageUrl);
    await unlinkFile(filesGateway, staff, productImage, id, product.ImageUrl);

    // Safely delete or detach dependent records to prevent foreign key errors
    await (tx as any).branchRequestItems?.deleteMany({ where: { ProductId: id } }).catch(() => { });
    await (tx as any).branchReturnItems?.deleteMany({ where: { ProductId: id } }).catch(() => { });
    await (tx as any).stockWriteOffItems?.deleteMany({ where: { ProductId: id } }).catch(() => { });
    await (tx as any).stockTransferRequestItems?.deleteMany({ where: { ProductId: id } }).catch(() => { });
    await (tx as any).stockTransfers?.deleteMany({ where: { ProductId: id } }).catch(() => { });
    await (tx as any).productionRequests?.deleteMany({ where: { ProductId: id } }).catch(() => { });
    await (tx as any).productionBatches?.deleteMany({ where: { ProductId: id } }).catch(() => { });
    await (tx as any).recipes?.deleteMany({ where: { ProductId: id } }).catch(() => { });

    await tx.finishedProducts.delete({ where: { ProductId: id } });

    // Deactivate orphaned Item record if no other finished products share it
    const remainingSiblings = await tx.finishedProducts.count({
      where: { ItemId: product.ItemId, ProductId: { not: id } },
    });
    if (remainingSiblings === 0) {
      await tx.items.update({
        where: { ItemId: product.ItemId },
        data: { IsActive: false },
      }).catch(() => { });
    }

    return {
      result: resourceResult({ success: true, data: true }),
      audit: {
        module: "Production & Quality",
        action: "record.deleted",
        target: { type: "finished-product", id: id, name: product.Items?.ItemName || String(id) },
        description: `${staff.name} deleted finished product (${product.Items?.ItemName || String(id)})`,
      },
    };
  }, { module: "Production & Quality", action: "record.updated", target: { type: "operation", id: String(idInput), name: "deleteFinishedProduct" }, description: "Validation refused for deleteFinishedProduct", version: auditVersion([idInput]) });
}
