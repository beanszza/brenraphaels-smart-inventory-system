import { redirect } from "next/navigation";
import { requireModule } from "@/lib/portal/staff";
import { getProductionRequest } from "@/app/actions/production/request-detail";
import ProductionRequestPage from "@/components/production/ProductionRequestPage";
import type { ProductionRequestEntity } from "@/components/production/types";

export default async function ViewProductionRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("Production & Quality");
  const { id } = await params;
  const res = await getProductionRequest(id);

  if (!res.success || !res.data) {
    redirect("/production-quality?tab=requests");
  }

  return (
    <ProductionRequestPage
      mode="view"
      initialRequest={res.data as ProductionRequestEntity}
    />
  );
}
