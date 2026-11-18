import { InventorySkeleton } from "@/components/inventory/InventorySkeleton";

export default function Loading() {
  return (
    <div className="page-container w-full bg-page">
      <InventorySkeleton />
    </div>
  );
}
