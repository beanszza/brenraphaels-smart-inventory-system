import ViewGoodsReceiving from "@/components/pages/ViewGoodsReceiving";
import { requireModule } from "@/lib/portal/staff";
import { getReceivingCounts } from "@/app/actions/receiving/lookups";

export default async function GoodsReceivingPage() {
  await requireModule("Goods Receiving");
  const counts = await getReceivingCounts();
  if (!counts.success) throw new Error(counts.message);
  return <ViewGoodsReceiving initialCounts={counts.data} />;
}
