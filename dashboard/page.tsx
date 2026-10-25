import Link from "next/link";
import { getDashboardData } from "@/app/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AnalyticsDashboardPage() {
  const sections = await getDashboardData();

  return (
    <div className="w-full space-y-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Current figures for your assigned Modules.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.module}>
            <CardHeader>
              <CardTitle className="text-base">
                <Link className="hover:underline" href={section.href}>{section.module}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                {section.figures.map((figure) => (
                  <div key={figure.label} className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-muted-foreground">{figure.label}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{figure.value.toLocaleString("en-US")}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
