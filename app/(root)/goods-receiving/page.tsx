import ViewGoodsReceiving, { type ReceivingTab } from "@/components/pages/ViewGoodsReceiving";
import { requireModule } from "@/lib/portal/staff";
import { getReceivingCounts } from "@/app/actions/receiving/lookups";
import { listReceipts } from "@/app/actions/receiving/receipts";
import { listDeliveriesForReceiving } from "@/app/actions/receiving/procurement-reads";
import { listDiscrepancies } from "@/app/actions/receiving/discrepancies";
import { listStockIns } from "@/app/actions/receiving/stock-ins";
import { listReturns } from "@/app/actions/receiving/returns";
import { listLossReports } from "@/app/actions/receiving/losses";
import { receivingData, receivingDeliveries } from "@/lib/receiving/screen-data";
import GrnTab from "@/components/receiving/GrnTab";
import DiscrepancyTab from "@/components/receiving/DiscrepancyTab";
import StockInTab from "@/components/receiving/StockInTab";
import RtvTab from "@/components/receiving/RtvTab";
import LossReportTab from "@/components/receiving/LossReportTab";

export default async function GoodsReceivingPage({ searchParams }: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  await requireModule("Goods Receiving");
  const { tab } = await searchParams;
  const activeTab: ReceivingTab = typeof tab === "string" && ["discrepancies", "stockin", "rtv", "loss"].includes(tab)
    ? tab as ReceivingTab : "grn";
  const loadContent = async () => {
    switch (activeTab) {
      case "discrepancies": return <DiscrepancyTab initialDiscrepancies={receivingData(await listDiscrepancies())} />;
      case "stockin": return <StockInTab initialStockIns={receivingData(await listStockIns())} />;
      case "rtv": return <RtvTab initialReturns={receivingData(await listReturns())} />;
      case "loss": return <LossReportTab initialLossReports={receivingData(await listLossReports())} />;
      default: {
        const [receipts, deliveries] = await Promise.all([listReceipts(), receivingDeliveries(listDeliveriesForReceiving)]);
        return <GrnTab initialReceipts={receivingData(receipts)} initialDeliveries={deliveries} />;
      }
    }
  };
  const [counts, content] = await Promise.all([getReceivingCounts(), loadContent()]);
  return <ViewGoodsReceiving counts={receivingData(counts)} activeTab={activeTab}>{content}</ViewGoodsReceiving>;
}
