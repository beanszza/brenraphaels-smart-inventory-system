import ResourcesSuppliers from "@/components/pages/ViewSuppliers";
import { requireModule } from "@/lib/portal/staff";
import { loadResources } from "@/app/actions/resources/page-data";

export default async function Page() {
  await requireModule("Resources & Suppliers");
  return <ResourcesSuppliers initialData={await loadResources()} />;
}
