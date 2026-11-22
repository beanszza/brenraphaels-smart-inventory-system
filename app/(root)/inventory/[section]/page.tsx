import { notFound, redirect } from "next/navigation";
import ViewInventory, { type InventorySection } from "@/components/pages/ViewInventory";
import { requireModule } from "@/lib/portal/staff";
import { isAdminStaff, isImsManager } from "@/lib/auth-roles";
import { fetchInventoryScreenData } from "../page";

const VALID_SECTIONS: Record<string, InventorySection> = {
  "raw-materials": "raw-materials",
  tools: "tools",
  "finished-products": "finished-products",
  "write-off": "write-off",
};

export default async function InventorySectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: rawSection } = await params;
  const section = VALID_SECTIONS[rawSection];
  if (!section) {
    notFound();
  }

  const staff = await requireModule("Inventory");
  const canViewWriteOff = isAdminStaff(staff) || isImsManager(staff);

  if (section === "write-off" && !canViewWriteOff) {
    redirect("/no-access");
  }

  const { inventory, lots, categories, writeOffs } = await fetchInventoryScreenData(staff);

  return (
    <ViewInventory
      initialInventories={inventory.items}
      initialLots={lots.items}
      initialTotal={inventory.totalCount}
      initialCategories={categories}
      initialWriteOffs={writeOffs}
      asOf={new Date().toISOString()}
      section={section}
    />
  );
}
