import ViewReports from "@/components/pages/ViewReports";
import { requireModule } from "@/lib/portal/staff";
import { loadReport } from "@/app/actions/orders/reports";
import { resultData } from "@/lib/orders/screen-data";
export default async function ReportsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule("Orders & Procurement");
  const params = await searchParams;
  const tab = typeof params.tab === "string" ? params.tab : "inventory";
  const query = new URLSearchParams();
  for (const key of ["startDate", "endDate"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  const data = resultData(await loadReport(tab, query.toString()));
  return <ViewReports key={`${tab}:${query}`} initialTab={tab} initialData={data} initialDates={{ start: query.get("startDate") || "", end: query.get("endDate") || "" }} />;
}
