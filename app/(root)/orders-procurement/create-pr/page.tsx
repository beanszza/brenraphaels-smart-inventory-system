import { CreatePRForm } from "@/components/orders-procurement/pr/CreatePRForm";
import { requireModule } from "@/lib/portal/staff";

export default async function CreatePRPage() {
  await requireModule("Orders & Procurement");
  return <CreatePRForm />;
}
