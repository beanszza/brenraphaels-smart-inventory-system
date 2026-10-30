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

    const updateData: any = {
      Variant: body.variant !== undefined ? body.variant : product.Variant,
      SellingPrice: body.sellingPrice !== undefined ? body.sellingPrice : product.SellingPrice,
    };

    if (body.unitCost !== undefined && body.unitCost !== null && body.unitCost !== "") {
      updateData.UnitCost = Number(body.unitCost);
    }

    // Keep SKU strictly immutable to preserve POS and Stock Transfer mapping
    if (body.sku && !product.Sku) {
      updateData.Sku = body.sku;
    }

    const updatedProduct = await tx.finishedProducts.update({
      where: { ProductId: id },
      data: {
        ...updateData,
        ...(body.productName
          ? {
              Items: {
                update: {
                  ItemName: body.productName,
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
      unitCost: Number(updatedProduct.UnitCost),
      sku: updatedProduct.Sku,
      itemName: updatedProduct.Items?.ItemName || "",
      variant: updatedProduct.Variant,
      productCode: updatedProduct.Items?.ItemCode || "",
      categoryName: updatedProduct.Items?.Category?.CategoryName || "",
      uomName: updatedProduct.Items?.Uom?.Abbreviation || "",
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
