import { loadStockTransferScreen } from "@/lib/stock-transfer/screen-data";
import StockTransferModule from "@/components/stock-transfer/StockTransferModule";
import { requireModule } from "@/lib/portal/staff";
export default async function StockTransferPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> } = {}) {
  await requireModule("Stock Transfer");
  const data = await loadStockTransferScreen();
  const params = await searchParams;
  const activeMainTab =
    params?.tab === "locations"
      ? "locations"
      : params?.tab === "branch-requests"
      ? "branch-requests"
      : "transfers";
  return <StockTransferModule {...data} activeMainTab={activeMainTab} />;
}
