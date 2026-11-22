import ViewRecipes from "@/components/pages/ViewRecipes";
import { getResources } from "@/lib/resources-suppliers/data";
import { requireModule } from "@/lib/portal/staff";
import { isImsManager } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

export default async function RecipesPage() {
  const staff = await requireModule("Resources & Suppliers");
  if (isImsManager(staff)) {
    redirect("/no-access");
  }
  const data = await getResources();
  return <ViewRecipes data={data} />;
}
