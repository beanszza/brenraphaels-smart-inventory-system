import { loadDistributionScreen } from "@/lib/stock-transfer/screen-data";
import ViewDistribution from "@/components/pages/ViewDistribution";
import { requireModule } from "@/lib/portal/staff";
export default async function DistributionPage() {
  await requireModule("Stock Transfer");
  const data = await loadDistributionScreen();
  return <ViewDistribution {...data} />;
}
