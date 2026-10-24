import ViewInventory from "@/components/pages/ViewInventory";
import { requireModule } from "@/lib/portal/staff";
import { listInventory } from "@/app/actions/inventory/balances";
import { listLots } from "@/app/actions/inventory/lots";
import { inventoryPages } from "@/lib/inventory/screen-data";
import type { InventoryItem } from "@/components/inventory/types";
import type { LotItem } from "@/components/lots/types";

export default async function InventoryPage() {
  await requireModule("Inventory");
  const [inventory, lots] = await Promise.all([
    inventoryPages<InventoryItem>(listInventory, "pageSize=1000"),
    inventoryPages<LotItem>(listLots, "status=Available&pageSize=500"),
  ]);
  return <ViewInventory initialInventories={inventory.items} initialLots={lots.items} initialTotal={inventory.totalCount} asOf={new Date().toISOString()} />;
}
