import ResourcesSuppliers from "@/components/pages/ViewSuppliers";
import { getResources } from "@/lib/resources-suppliers/data";
import { requireModule } from "@/lib/portal/staff";

export default async function Page() {
  await requireModule("Resources & Suppliers");
  const data = await getResources();
  return <ResourcesSuppliers data={data} />;
}
