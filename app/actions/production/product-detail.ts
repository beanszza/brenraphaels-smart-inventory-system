"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput } from "@/lib/production/mutate";

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

    const effectivePrice = body.sellingPrice !== undefined 
      ? body.sellingPrice 
      : (body.unitCost !== undefined ? body.unitCost : product.SellingPrice);

    const updateData: any = {
      Variant: body.variant !== undefined ? body.variant : product.Variant,
      SellingPrice: effectivePrice,
    };

    // Keep SKU strictly immutable to preserve POS and Stock Transfer mapping
    if (body.sku && !product.Sku) {
      updateData.Sku = body.sku;
    }

    const hasItemUpdate = body.productName !== undefined || body.isActive !== undefined;

    const updatedProduct = await tx.finishedProducts.update({
      where: { ProductId: id },
      data: {
        ...updateData,
        ...(hasItemUpdate
          ? {
              Items: {
                update: {
                  ...(body.productName !== undefined ? { ItemName: body.productName } : {}),
                  ...(body.isActive !== undefined ? { IsActive: Boolean(body.isActive) } : {}),
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
      sellingPrice: Number(updatedProduct.SellingPrice),
      sku: updatedProduct.Sku,
      itemName: updatedProduct.Items?.ItemName || "",
      variant: updatedProduct.Variant,
      productCode: updatedProduct.Items?.ItemCode || "",
      categoryName: updatedProduct.Items?.Category?.CategoryName || "",
      uomName: updatedProduct.Items?.Uom?.Abbreviation || "",
      isActive: updatedProduct.Items?.IsActive ?? true,
    };

    return {
      result: resourceResult({ success: true, data: response }),
      audit: {
        module: "Production & Quality",
        change: "updated",
        target: { type: "finished-product", id: id, name: String(id) },
        description: `${staff.name} updated finished product (${String(id)})`,
      },
    };
  });
}

export async function deleteFinishedProduct(idInput: string | number) {
  const staff = await requireModule("Production & Quality");
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);
    const product = await tx.finishedProducts.findUnique({
      where: { ProductId: id },
    });
    if (!product) {
      return refuse("Finished product variant not found.");
    }

    // Safely delete or detach dependent records to prevent foreign key errors
    await (tx as any).stockTransferRequestItems.deleteMany({ where: { ProductId: id } }).catch(() => {});
    await (tx as any).stockTransfers.deleteMany({ where: { ProductId: id } }).catch(() => {});
    await (tx as any).productionRequests.deleteMany({ where: { ProductId: id } }).catch(() => {});
    await (tx as any).productionBatches.deleteMany({ where: { ProductId: id } }).catch(() => {});
    await (tx as any).recipes.deleteMany({ where: { ProductId: id } }).catch(() => {});

    await tx.finishedProducts.delete({ where: { ProductId: id } });
    return {
      result: resourceResult({ success: true, data: true }),
      audit: {
        module: "Production & Quality",
        change: "deleted",
        target: { type: "finished-product", id: id, name: String(id) },
        description: `${staff.name} deleted finished product (${String(id)})`,
      },
    };
  });
}
