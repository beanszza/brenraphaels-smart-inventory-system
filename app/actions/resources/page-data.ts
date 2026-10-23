"use server";

import { requireModule } from "@/lib/portal/staff";
import { prisma } from "@/lib/prisma";
import { listItems } from "@/app/actions/resources/items";
import { listSuppliers } from "@/app/actions/resources/suppliers";
import { listSupplyCategories, listUnits } from "@/app/actions/resources/lookups";
import { listRecipes } from "@/app/actions/resources/recipes";
import { actionResponse } from "@/lib/resources/action-response";
import type { ResourcesData } from "@/lib/resources/data";

/** Product choices belong to the recipe form and need only this Module. */
export async function loadResources(): Promise<ResourcesData> {
  await requireModule("Resources & Suppliers");
  const [items, suppliers, recipes, categories, units, products] = await Promise.all([
    actionResponse(listItems("pageSize=1000&sort=desc")),
    actionResponse(listSuppliers("pageSize=1000")),
    actionResponse(listRecipes()),
    actionResponse(listSupplyCategories()),
    actionResponse(listUnits()),
    prisma.finishedProducts.findMany({
      select: { ProductId: true, Variant: true, Items: { select: { ItemName: true } } },
      orderBy: { ProductId: "asc" },
    }),
  ]);
  return {
    supplies: items.data.data.items.filter((item: { categoryName: string }) =>
      !["Finished Good", "Finished Goods"].includes(item.categoryName)),
    suppliers: suppliers.data.data.items.sort((a: { supplierId: number }, b: { supplierId: number }) => b.supplierId - a.supplierId),
    recipes: recipes.data.data.sort((a: { recipeId: number }, b: { recipeId: number }) => b.recipeId - a.recipeId),
    categories: categories.data.data,
    units: units.data.data,
    products: products.map((product) => ({ productId: product.ProductId, itemName: product.Items.ItemName, variant: product.Variant ?? "" })),
  };
}
