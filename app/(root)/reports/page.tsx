import ViewReports from "@/components/pages/ViewReports";
import { requireModule } from "@/lib/portal/staff";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await requireModule("Orders & Procurement");
  const resolvedParams = await searchParams;
  const tab = typeof resolvedParams.tab === 'string' ? resolvedParams.tab : 'inventory';

  return <ViewReports initialTab={tab} />;
}

// Trigger hot reload
