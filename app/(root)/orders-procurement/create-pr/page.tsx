import { requisitionSupplies } from "@/app/actions/orders/screens";
import { resultData } from "@/lib/orders/screen-data";
import { CreatePRForm } from "@/components/orders-procurement/pr/CreatePRForm";
import { requireModule } from "@/lib/portal/staff";

export default async function CreatePRPage() {
  await requireModule("Orders & Procurement");
  const supplies = resultData(await requisitionSupplies());
  return <CreatePRForm initialSupplies={supplies} />;
}
