import ViewProduction from "@/components/pages/ViewProduction";
import { requireModule } from "@/lib/portal/staff";
import { loadProductionScreen, productionTab } from "@/lib/production/screen-data";
import { isQaStaff, isHeadCook } from "@/lib/auth-roles";

export default async function ProductionPage({ searchParams }: { searchParams?: Promise<{ tab?: string; batch?: string; issuance?: string }> } = {}) {
  const staff = await requireModule("Production & Quality");
  const params = await searchParams;
  let tabParam = params?.tab;
  if (!tabParam) {
    if (isQaStaff(staff)) tabParam = "qa";
    else if (isHeadCook(staff)) tabParam = "tracking";
  }
  const tab = productionTab(tabParam);
  const data = await loadProductionScreen(tab);
  return <ViewProduction key={`${tab}:${params?.batch ?? ""}:${params?.issuance ?? ""}`} activeTab={tab} initialRows={data.rows} initialItems={data.items}
    initialBatchId={Number(params?.batch) || null} initialIssuanceId={Number(params?.issuance) || null} />;
}
