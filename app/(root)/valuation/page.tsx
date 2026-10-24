import { requireModule } from "@/lib/portal/staff";
import { notFound } from "next/navigation";

export default async function ValuationPage() {
  await requireModule("Inventory");
  notFound();
}

