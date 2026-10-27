"use server";
import { requireModule } from "@/lib/portal/staff";
import { listRequisitions } from "./requisitions";
import { listOrders } from "./orders";
import { listDeliveries } from "./deliveries";
import { allPages, resultData } from "@/lib/orders/screen-data";
import { prisma } from "@/lib/prisma";
import { read } from "@/lib/orders/mutate";
import { resourceResult } from "@/lib/resources/result";

export async function loadProcurementScreen() {
  await requireModule("Orders & Procurement");
  const [requisitions, orders, deliveries] = await Promise.all([
    listRequisitions().then(resultData), allPages(listOrders), allPages(listDeliveries),
  ]);
  return { requisitions, orders, deliveries };
}

// Procurement Staff can inspect stock while requesting supplies without Inventory access.
export async function requisitionSupplies() {
  await requireModule("Orders & Procurement");
  return read(async () => {
    const items = await prisma.items.findMany({ where: { IsActive: true },
      include: { Category: true, Uom: true, Inventories: true }, orderBy: { ItemName: "asc" } });
    return resourceResult({ success: true, data: items
      .filter(i => !["Finished Good", "Finished Goods"].includes(i.Category?.CategoryName ?? ""))
      .map(i => ({ itemId: i.ItemId, itemCode: i.ItemCode, itemName: i.ItemName,
        purchaseUomId: i.StockUomId, uomName: i.Uom?.Abbreviation || "Unit",
        currentStock: i.Inventories.reduce((sum, inv) => sum + Number(inv.CurrentStock), 0) })) });
  });
}
export async function procurementRecipes() {
  await requireModule("Orders & Procurement");
  return read(async () => resourceResult({ success: true, data:
    (await prisma.recipes.findMany({ orderBy: { RecipeName: "asc" } }))
      .map(r => ({ recipeId: r.RecipeId, recipeName: r.RecipeName })) }));
}
