import ViewMRP from "@/components/pages/ViewMrp";
import { requireModule } from "@/lib/portal/staff";
import { procurementRecipes } from "@/app/actions/orders/screens";
import { resultData } from "@/lib/orders/screen-data";
export default async function MrpPage() {
  await requireModule("Orders & Procurement");
  const recipes = resultData(await procurementRecipes());
  return <ViewMRP initialRecipes={recipes} />;
}
