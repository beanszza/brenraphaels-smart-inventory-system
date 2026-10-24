import ViewProduction from "@/components/pages/ViewProduction";
import { requireModule } from "@/lib/portal/staff";

export default async function ProductionPage() {
  await requireModule("Production & Quality");
  return <ViewProduction />;
}
