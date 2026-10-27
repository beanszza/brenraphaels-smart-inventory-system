import ViewInventory from "@/components/pages/ViewInventory";
import { requireModule } from "@/lib/portal/staff";
import { listInventory } from "@/app/actions/inventory/balances";
import { listLots } from "@/app/actions/inventory/lots";
import { inventoryPages } from "@/lib/inventory/screen-data";
import { prisma } from "@/lib/prisma";
import type { InventoryItem } from "@/components/inventory/types";
import type { LotItem } from "@/components/lots/types";

export default async function InventoryPage() {
  await requireModule("Inventory");
  const [inventory, lots, categories] = await Promise.all([
    inventoryPages<InventoryItem>(listInventory, "pageSize=1000"),
    inventoryPages<LotItem>(listLots, "status=Available&pageSize=500"),
    prisma.categories.findMany({
      where: {
        IsActive: true,
        NOT: {
          CategoryName: { in: ["Finished Goods", "Finished Good"] },
        },
      },
      select: { CategoryId: true, CategoryName: true },
      orderBy: { CategoryId: "asc" },
    }),
  ]);
  return (
    <ViewInventory
      initialInventories={inventory.items}
      initialLots={lots.items}
      initialTotal={inventory.totalCount}
      initialCategories={categories.map((c) => ({ categoryId: c.CategoryId, categoryName: c.CategoryName }))}
      asOf={new Date().toISOString()}
    />
  );
}
