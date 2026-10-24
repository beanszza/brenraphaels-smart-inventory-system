import { redirect } from "next/navigation";
import { requireModule } from "@/lib/portal/staff";
export default async function DistributionPage() {
  await requireModule("Stock Transfer");
  redirect("/stock-transfer");
}
