import ViewProduction from "@/components/pages/ViewProduction";
import { requireModule } from "@/lib/portal/staff";
import { loadProductionScreen, productionTab } from "@/lib/production/screen-data";

export default async function ProductionPage({ searchParams }: { searchParams?: Promise<{ tab?: string; batch?: string; issuance?: string }> } = {}) {
  await requireModule("Production & Quality");
  const params = await searchParams;
  const tab = productionTab(params?.tab);
  const data = await loadProductionScreen(tab);
  return <ViewProduction key={`${tab}:${params?.batch ?? ""}:${params?.issuance ?? ""}`} activeTab={tab} initialRows={data.rows} initialItems={data.items}
    initialBatchId={Number(params?.batch) || null} initialIssuanceId={Number(params?.issuance) || null} />;
}
