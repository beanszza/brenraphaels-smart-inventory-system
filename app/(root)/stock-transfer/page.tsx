import { loadStockTransferScreen } from "@/lib/stock-transfer/screen-data";
import StockTransferModule from "@/components/stock-transfer/StockTransferModule";
import { requireModule } from "@/lib/portal/staff";
export default async function StockTransferPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> } = {}) {
  await requireModule("Stock Transfer");
  const data = await loadStockTransferScreen();
  const params = await searchParams;
  return <StockTransferModule {...data} activeMainTab={params?.tab === "locations" ? "locations" : "transfers"} />;
}
