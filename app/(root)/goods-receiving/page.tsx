import ViewGoodsReceiving, { type ReceivingTab } from "@/components/pages/ViewGoodsReceiving";
import { requireModule } from "@/lib/portal/staff";
import { isQaStaff, isImsManager, isAdminStaff } from "@/lib/auth-roles";
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
  const staff = await requireModule("Goods Receiving");
  const isQa = isQaStaff(staff);
  const isManager = isImsManager(staff);
  const isAdmin = isAdminStaff(staff);

  const { tab } = await searchParams;
  const requestedTab = typeof tab === "string" ? tab : undefined;

  let activeTab: ReceivingTab;
  if (isQa && !isAdmin) {
    // Quality Assurance Officer (2026-JP-008) operates Goods Receipt Notes / Receive
    activeTab = "grn";
  } else if (isManager && !isAdmin) {
    // IMS Manager (2026-VM-007) operates Discrepancies, Stock In, Supplier Returns, Loss / Disposal
    if (requestedTab && ["discrepancies", "stockin", "rtv", "loss"].includes(requestedTab)) {
      activeTab = requestedTab as ReceivingTab;
    } else {
      activeTab = "stockin";
    }
  } else {
    // Admin or test staff access
    activeTab =
      requestedTab && ["discrepancies", "stockin", "rtv", "loss", "grn"].includes(requestedTab)
        ? (requestedTab as ReceivingTab)
        : "grn";
  }

  const loadContent = async () => {
    switch (activeTab) {
      case "discrepancies":
        return <DiscrepancyTab initialDiscrepancies={receivingData(await listDiscrepancies())} />;
      case "stockin":
        return <StockInTab initialStockIns={receivingData(await listStockIns())} />;
      case "rtv":
        return <RtvTab initialReturns={receivingData(await listReturns())} />;
      case "loss":
        return <LossReportTab initialLossReports={receivingData(await listLossReports())} />;
      default: {
        const [receipts, deliveries] = await Promise.all([
          listReceipts(),
          receivingDeliveries(listDeliveriesForReceiving),
        ]);
        return <GrnTab initialReceipts={receivingData(receipts)} initialDeliveries={deliveries} />;
      }
    }
  };

  const [counts, content] = await Promise.all([getReceivingCounts(), loadContent()]);
  return (
    <ViewGoodsReceiving
      counts={receivingData(counts)}
      activeTab={activeTab}
      isQa={isQa}
      isManager={isManager}
      isAdmin={isAdmin}
    >
      {content}
    </ViewGoodsReceiving>
  );
}
