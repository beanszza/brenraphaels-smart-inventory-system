import StockTransferModule from "@/components/stock-transfer/StockTransferModule";
import { requireModule } from "@/lib/portal/staff";
export default async function StockTransferPage() {
  await requireModule("Stock Transfer");
  return <StockTransferModule />;
}
