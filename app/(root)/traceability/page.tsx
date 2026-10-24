import { requireModule } from "@/lib/portal/staff";
import { notFound } from "next/navigation";

export default async function TraceabilityPage() {
  await requireModule("Inventory");
  notFound();
}

