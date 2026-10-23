import { redirect } from "next/navigation";
import { CreatePRForm } from "@/components/orders-procurement/pr/CreatePRForm";
import { getRequisition } from "@/app/actions/orders/requisitions";
import { requireModule } from "@/lib/portal/staff";

export default async function EditPRPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("Orders & Procurement");
  const { id } = await params;
  const requisition = await getRequisition(id);
  if (!requisition.success || !requisition.data) redirect("/orders-procurement");
  return <CreatePRForm initialData={requisition.data} isEdit={true} />;
}
