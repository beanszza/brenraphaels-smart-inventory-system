import ViewOrdersProcurement from "@/components/pages/ViewOrdersProcurement";
import { requireModule } from "@/lib/portal/staff";

export default async function OrdersProcurementPage() {
  await requireModule("Orders & Procurement");
  return <ViewOrdersProcurement />;
}
