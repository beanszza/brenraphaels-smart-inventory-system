import ViewInventory from "@/components/pages/ViewInventory";
import { requireModule } from "@/lib/portal/staff";
import { listInventory } from "@/app/actions/inventory/balances";
import { listLots } from "@/app/actions/inventory/lots";
import { migrateLegacySkusAndLots } from "@/lib/inventory/migrate-codes";
import { inventoryPages } from "@/lib/inventory/screen-data";
import { prisma } from "@/lib/prisma";
import { decodeCategoryDescription } from "@/lib/resources-suppliers/category-status";
import type { InventoryItem } from "@/components/inventory/types";
import type { LotItem } from "@/components/lots/types";

export default async function InventoryPage() {
  await requireModule("Inventory");
  await migrateLegacySkusAndLots();

  // Load categories, inventory, and lots in parallel
  const [inventory, lots, categories] = await Promise.all([
    inventoryPages<InventoryItem>(listInventory, "pageSize=1000"),
    inventoryPages<LotItem>(listLots, "status=Available&pageSize=500"),
    (async () => {
      try {
        if (typeof prisma?.categories?.findMany !== "function") return [];
        const rows = await prisma.categories.findMany({
          where: {
            NOT: { CategoryName: { contains: "Finished", mode: "insensitive" } },
          },
          select: { CategoryId: true, CategoryName: true, Description: true },
          orderBy: { CategoryName: "asc" },
        });
        return rows.filter((c) => decodeCategoryDescription(c.Description, (c as any).IsActive).isActive);
      } catch {
        return [];
      }
    })(),
  ]);

  return (
    <ViewInventory
      initialInventories={inventory.items}
      initialLots={lots.items}
      initialTotal={inventory.totalCount}
      initialCategories={categories.map((c) => ({
        categoryId: c.CategoryId,
        categoryName: c.CategoryName,
      }))}
      asOf={new Date().toISOString()}
    />
  );
}
