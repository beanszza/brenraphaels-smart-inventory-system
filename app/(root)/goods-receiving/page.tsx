import { Suspense } from "react";
import ViewGoodsReceiving, { type ReceivingTab } from "@/components/pages/ViewGoodsReceiving";
import { requireModule } from "@/lib/portal/staff";
import { listReceipts } from "@/app/actions/receiving/receipts";
import { listDeliveriesForReceiving } from "@/app/actions/receiving/procurement-reads";
import { listDiscrepancies } from "@/app/actions/receiving/discrepancies";
import { listStockIns } from "@/app/actions/receiving/stock-ins";
import { listReturns } from "@/app/actions/receiving/returns";
import { listLossReports } from "@/app/actions/receiving/losses";
import { receivingData, receivingDeliveries } from "@/lib/receiving/screen-data";
import { ReceivingSkeleton } from "@/components/receiving/ReceivingSkeleton";
import GrnTab from "@/components/receiving/GrnTab";
import DiscrepancyTab from "@/components/receiving/DiscrepancyTab";
import StockInTab from "@/components/receiving/StockInTab";
import RtvTab from "@/components/receiving/RtvTab";
import LossReportTab from "@/components/receiving/LossReportTab";

async function GrnPanel() {
  const [receipts, deliveries] = await Promise.all([
    listReceipts(),
    receivingDeliveries(listDeliveriesForReceiving),
  ]);
  return <GrnTab initialReceipts={receivingData(receipts)} initialDeliveries={deliveries} />;
}

async function DiscrepancyPanel() {
  return <DiscrepancyTab initialDiscrepancies={receivingData(await listDiscrepancies())} />;
}

async function StockInPanel() {
  return <StockInTab initialStockIns={receivingData(await listStockIns())} />;
}

async function RtvPanel() {
  return <RtvTab initialReturns={receivingData(await listReturns())} />;
}

async function LossPanel() {
  return <LossReportTab initialLossReports={receivingData(await listLossReports())} />;
}

export default async function GoodsReceivingPage({ searchParams }: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  await requireModule("Goods Receiving");
  const { tab } = await searchParams;
  const activeTab: ReceivingTab =
    typeof tab === "string" && ["discrepancies", "stockin", "rtv", "loss"].includes(tab)
      ? (tab as ReceivingTab)
      : "grn";

  return (
    <ViewGoodsReceiving
      activeTab={activeTab}
      panels={{
        grn: (
          <Suspense fallback={<ReceivingSkeleton />}>
            <GrnPanel />
          </Suspense>
        ),
        discrepancies: (
          <Suspense fallback={<ReceivingSkeleton />}>
            <DiscrepancyPanel />
          </Suspense>
        ),
        stockin: (
          <Suspense fallback={<ReceivingSkeleton />}>
            <StockInPanel />
          </Suspense>
        ),
        rtv: (
          <Suspense fallback={<ReceivingSkeleton />}>
            <RtvPanel />
          </Suspense>
        ),
        loss: (
          <Suspense fallback={<ReceivingSkeleton />}>
            <LossPanel />
          </Suspense>
        ),
      }}
    />
  );
}
