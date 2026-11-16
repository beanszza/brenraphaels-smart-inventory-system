import ViewInventory from "@/components/pages/ViewInventory";
import { requireModule } from "@/lib/portal/staff";
import { isAdminStaff, isImsManager } from "@/lib/auth-roles";
import { listInventory } from "@/app/actions/inventory/balances";
import { listLots } from "@/app/actions/inventory/lots";
import { listWriteOffs } from "@/app/actions/inventory/write-offs";
import { migrateLegacySkusAndLots } from "@/lib/inventory/migrate-codes";
import { inventoryPages } from "@/lib/inventory/screen-data";
import { prisma } from "@/lib/prisma";
import { decodeCategoryDescription } from "@/lib/resources-suppliers/category-status";
import type { InventoryItem } from "@/components/inventory/types";
import type { LotItem } from "@/components/lots/types";
import type { StockWriteOffDto } from "@/components/inventory/write-off/types";

export default async function InventoryPage() {
  const staff = await requireModule("Inventory");
  await migrateLegacySkusAndLots();
  const canViewWriteOff = isAdminStaff(staff) || isImsManager(staff);

  // Load categories, inventory, lots, and (for IMS Manager / Admin) stock write-offs in parallel
  const [inventory, lots, categories, writeOffs] = await Promise.all([
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
    (async (): Promise<StockWriteOffDto[]> => {
      if (!canViewWriteOff) return [];
      try {
        const res = await listWriteOffs();
        if (res.success && Array.isArray(res.data)) {
          return res.data as StockWriteOffDto[];
        }
        return [];
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
      initialWriteOffs={writeOffs}
      asOf={new Date().toISOString()}
    />
  );
}
