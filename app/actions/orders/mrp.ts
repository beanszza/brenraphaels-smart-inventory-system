"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import type { MrpInput } from "@/lib/orders/inputs";
import { read } from "@/lib/orders/mutate";

/**
 * Given planned batch counts per recipe, works out what is needed, sets it against what is on
 * hand and on order, and returns the net requirements. It plans only and changes nothing.
 */
export async function planMrp(body: MrpInput) {
  await requireModule("Orders & Procurement");
  return read(async () => {
    const planned = body?.plannedBatches || [];
    if (planned.length === 0) return resourceResult({ success: false, message: "No planned batches provided." });

    const gross = new Map<number, number>();
    for (const run of planned) {
      const recipe = await prisma.recipes.findUnique({
        where: { RecipeId: run.recipeId },
        include: { RecipeIngredients: { include: { Items: true, Uom: true } } },
      });
      if (!recipe) continue;
      const multiplier = run.batchCount || 1;
      for (const ing of recipe.RecipeIngredients) {
        gross.set(ing.ItemId, (gross.get(ing.ItemId) ?? 0) + Number(ing.StandardQuantity) * multiplier);
      }
    }
    if (gross.size === 0) return resourceResult({ success: false, message: "No ingredients found for the selected recipes." });

    const itemIds = [...gross.keys()];
    const [inventories, pending, supplierItems, items] = await Promise.all([
      prisma.inventories.findMany({ where: { ItemId: { in: itemIds } } }),
      prisma.purchaseOrderItems.findMany({
        where: { ItemId: { in: itemIds }, PurchaseOrders: { Status: { in: ["Approved", "Ordered"] } } },
        include: { PurchaseOrders: true },
      }),
      prisma.supplierItems.findMany({
        where: { ItemId: { in: itemIds }, IsActive: true, IsPreferred: true },
        include: { Suppliers: true, UnitOfMeasures: true },
        orderBy: [{ IsPreferred: "desc" }, { UnitPrice: "asc" }],
      }),
      prisma.items.findMany({
        where: { ItemId: { in: itemIds } },
        include: { Category: true, UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true },
      }),
    ]);

    const onHand = new Map<number, number>();
    for (const inv of inventories) onHand.set(inv.ItemId, (onHand.get(inv.ItemId) ?? 0) + Number(inv.CurrentStock));

    const onOrder = new Map<number, number>();
    for (const line of pending) {
      const remaining = Number(line.PoItemQuantity) - Number(line.ReceivedQuantity ?? 0);
      if (remaining > 0) onOrder.set(line.ItemId, (onOrder.get(line.ItemId) ?? 0) + remaining);
    }

    const supplier = new Map<number, (typeof supplierItems)[number]>();
    for (const si of supplierItems) if (!supplier.has(si.ItemId)) supplier.set(si.ItemId, si);
    const itemById = new Map(items.map((item) => [item.ItemId, item]));

    const requirements = [...gross].map(([itemId, need]) => {
      const item = itemById.get(itemId);
      const have = onHand.get(itemId) ?? 0;
      const ordered = onOrder.get(itemId) ?? 0;
      const net = Math.max(0, need - have - ordered);
      const preferred = supplier.get(itemId);
      return {
        itemId,
        itemName: item?.ItemName ?? `Item ${itemId}`,
        categoryName: item?.Category?.CategoryName ?? "—",
        uomName: item?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation ?? "Unit",
        grossRequirement: need,
        onHandQty: have,
        onOrderQty: ordered,
        netRequirement: net,
        reorderPoint: Number(item?.MinStockLevel ?? 0),
        urgency: net > need * 0.5 ? "High" : net > 0 ? "Normal" : "None",
        preferredSupplier: preferred?.Suppliers?.CompanyName ?? "—",
        estimatedCost: preferred ? Number(preferred.UnitPrice) * net : 0,
      };
    });

    const rank: Record<string, number> = { High: 0, Normal: 1, None: 2 };
    requirements.sort((a, b) => (rank[a.urgency] ?? 99) - (rank[b.urgency] ?? 99));
    return resourceResult({ success: true, data: { requirements } });
  });
}
