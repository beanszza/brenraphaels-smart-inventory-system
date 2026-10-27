import { requireModule } from "@/lib/portal/staff";
import { notFound } from "next/navigation";

export default async function CycleCountsPage() {
  await requireModule("Inventory");
  notFound();
}

