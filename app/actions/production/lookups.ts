"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/production/mutate";
export async function listItems() {
    await requireModule("Production & Quality");
    return read(async () => {
        const items = await prisma.items.findMany({ include: { Uom: true, Category: true, Inventories: true }, orderBy: { ItemId: "asc" } });
        return resourceResult({ success: true, data: { items: items.map(item => ({
                    itemId: item.ItemId, itemCode: item.ItemCode, itemName: item.ItemName, uomId: item.UomId,
                    uomName: item.Uom?.Name, categoryName: item.Category?.CategoryName,
                    currentStock: item.Inventories.reduce((sum, inv) => sum + Number(inv.CurrentStock), 0),
                    minStockLevel: Number(item.MinStockLevel), maxStockLevel: Number(item.MaxStockLevel), isActive: item.IsActive,
                })) } });
    });
}
