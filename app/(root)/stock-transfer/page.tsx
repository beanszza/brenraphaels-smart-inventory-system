import { loadStockTransferScreen, loadBranchRequestPrefill } from "@/lib/stock-transfer/screen-data";
import StockTransferModule from "@/components/stock-transfer/StockTransferModule";
import { requireModule } from "@/lib/portal/staff";
export default async function StockTransferPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; branchRequestId?: string }>;
} = {}) {
  await requireModule("Stock Transfer");
  const [data, params] = await Promise.all([loadStockTransferScreen(), searchParams]);
  const parsedBrId = params?.branchRequestId ? Number(params.branchRequestId) : NaN;
  const initialCreateStrPrefill =
    Number.isSafeInteger(parsedBrId) && parsedBrId > 0
      ? await loadBranchRequestPrefill(parsedBrId)
      : null;
  return (
    <StockTransferModule
      {...data}
      activeMainTab={params?.tab === "locations" ? "locations" : "transfers"}
      initialCreateStrPrefill={initialCreateStrPrefill}
    />
  );
}
