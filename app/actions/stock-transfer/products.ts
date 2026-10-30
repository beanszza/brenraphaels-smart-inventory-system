"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/stock-transfer/operations";
import { ensureUbeJamHavaneroStock } from "@/lib/inventory/seed-stock";

export async function listFinishedProducts() {
    await requireModule("Stock Transfer");
    await ensureUbeJamHavaneroStock();
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
