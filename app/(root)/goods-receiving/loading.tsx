import ViewGoodsReceiving from "@/components/pages/ViewGoodsReceiving";
import { ReceivingSkeleton } from "@/components/receiving/ReceivingSkeleton";

export default function Loading() {
  return (
    <ViewGoodsReceiving activeTab="grn">
      <ReceivingSkeleton />
    </ViewGoodsReceiving>
  );
}
