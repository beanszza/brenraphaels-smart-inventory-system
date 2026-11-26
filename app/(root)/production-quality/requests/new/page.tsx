import { requireModule } from "@/lib/portal/staff";
import ProductionRequestPage, {
  type ProductionRequestPrefill,
} from "@/components/production/ProductionRequestPage";

export default async function NewProductionRequestPage({
  searchParams,
}: {
  searchParams?: Promise<{
    productId?: string;
    productName?: string;
    variant?: string;
    quantity?: string;
    priority?: string;
    reason?: string;
  }>;
} = {}) {
  await requireModule("Production & Quality");
  const params = await searchParams;

  const hasPrefill = Boolean(params?.productId || params?.productName);
  const priorityParam =
    params?.priority === "Low" || params?.priority === "High" || params?.priority === "Medium"
      ? params.priority
      : undefined;

  const prefillData: ProductionRequestPrefill | null = hasPrefill
    ? {
        productId: params?.productId ? Number(params.productId) : undefined,
        productName: params?.productName || undefined,
        variant: params?.variant || undefined,
        quantity: params?.quantity ? Number(params.quantity) : undefined,
        priority: priorityParam,
        reason: params?.reason || undefined,
      }
    : null;

  return <ProductionRequestPage mode="create" prefillData={prefillData} />;
}
