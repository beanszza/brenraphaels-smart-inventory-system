import { loadProcurementScreen } from "@/app/actions/orders/screens";
import ViewOrdersProcurement from "@/components/pages/ViewOrdersProcurement";
import { requireModule } from "@/lib/portal/staff";

export default async function OrdersProcurementPage() {
  await requireModule("Orders & Procurement");
  const data = await loadProcurementScreen();
  return <ViewOrdersProcurement data={data} />;
}
