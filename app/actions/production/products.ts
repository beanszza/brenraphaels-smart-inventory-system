"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing production DTOs during the action migration. */
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, validateInput } from "@/lib/production/mutate";
export async function listFinishedProducts() {
    await requireModule("Production & Quality");
    return read(async () => {
        const products = await prisma.finishedProducts.findMany({
            include: {
                Items: true,
            },
        });
        const response = products.map((fp) => ({
            productId: fp.ProductId,
            itemId: fp.ItemId,
            sellingPrice: Number(fp.SellingPrice),
            sku: fp.Sku,
            itemName: fp.Items?.ItemName || "",
            variant: fp.Variant,
        }));
        return resourceResult({ success: true, data: response });
    });
}
export async function createFinishedProduct(body: any = {}) {
    const staff = await requireModule("Production & Quality");
    return mutate(staff, async (tx) => {
        validateInput(body);
        const trimmedName = body.productName?.trim() || "";
        if (!trimmedName)
            refuse("Enter a product name.");
        const existingItem = await tx.items.findFirst({
            where: { ItemName: { equals: trimmedName, mode: "insensitive" } },
        });
        let item = existingItem;
        if (!item) {
            let category = await tx.categories.findFirst({
                where: { CategoryName: { contains: "finished good", mode: "insensitive" } },
            });
            if (!category) {
                category = await tx.categories.create({
                    data: { CategoryName: "Finished Good", Description: "Finished Goods" },
                });
            }
            let uom = await tx.unitOfMeasures.findFirst({
                where: { Abbreviation: "pcs" },
            });
            if (!uom) {
                uom = await tx.unitOfMeasures.findFirst();
            }
            const year = new Date().getFullYear();
            const seq = await tx.documentSequences.upsert({
                where: { DocType_Year: { DocType: "Item", Year: year } },
                update: { LastNumber: { increment: 1 } },
                create: { DocType: "Item", Year: year, LastNumber: 1 },
            });
            const itemCode = `SPL-${year}-${String(seq.LastNumber).padStart(4, "0")}`;
            item = await tx.items.create({
                data: {
                    ItemCode: itemCode,
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
        const newProduct = await tx.finishedProducts.create({
            data: {
                ItemId: item.ItemId,
                SellingPrice: body.sellingPrice,
                Sku: body.sku || "",
                Variant: body.variant || "",
            },
            include: {
                Items: true,
            }
        });
        const response = {
            productId: newProduct.ProductId,
            itemId: newProduct.ItemId,
            sellingPrice: Number(newProduct.SellingPrice),
            sku: newProduct.Sku,
            itemName: newProduct.Items?.ItemName || "",
            variant: newProduct.Variant,
        };
        return { result: resourceResult({ success: true, data: response }), audit: { module: "Production & Quality", change: "created", target: { type: "finished-product", id: newProduct.ProductId, name: newProduct.Items.ItemName }, description: `${staff.name} created finished product (${newProduct.Items.ItemName})` } };
    });
}
