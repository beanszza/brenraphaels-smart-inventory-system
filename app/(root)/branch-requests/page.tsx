import { loadBranchRequestsScreen } from "@/lib/stock-transfer/screen-data";
import BranchRequestsModule from "@/components/stock-transfer/BranchRequestsModule";
import { requireModule } from "@/lib/portal/staff";

export default async function BranchRequestsPage() {
  await requireModule("Stock Transfer");
  const data = await loadBranchRequestsScreen();
  return <BranchRequestsModule {...data} />;
}
