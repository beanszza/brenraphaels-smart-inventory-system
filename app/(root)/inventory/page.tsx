import ViewInventory from "@/components/pages/ViewInventory";
import { requireModule } from "@/lib/portal/staff";
import { listInventory } from "@/app/actions/inventory/balances";
import { listLots } from "@/app/actions/inventory/lots";

export default async function InventoryPage() {
  await requireModule("Inventory");
  const [inventory, lots] = await Promise.all([
    listInventory("pageSize=1000"), listLots("status=Available&pageSize=500"),
  ]);
  if (!inventory.success || !lots.success) throw new Error("Inventory could not be loaded. Please retry.");
  return <ViewInventory initialInventories={inventory.data.items} initialLots={lots.data.items} initialTotal={inventory.data.totalCount} asOf={new Date().toISOString()} />;
}
