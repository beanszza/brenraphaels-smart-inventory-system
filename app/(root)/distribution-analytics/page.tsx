import ViewDistribution from "@/components/pages/ViewDistribution";
import { requireModule } from "@/lib/portal/staff";
export default async function DistributionPage() {
  await requireModule("Stock Transfer");
  return <ViewDistribution />;
}
