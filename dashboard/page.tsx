import Link from "next/link";
import { getDashboardData } from "@/app/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AnalyticsDashboardPage() {
  const sections = await getDashboardData();

  return (
    <div className="min-w-0 w-full space-y-5 p-4 sm:px-8 sm:py-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your inventory operations at a glance.
        </p>
      </header>
      <section aria-label="Module overview" className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.module} className="min-w-0 shadow-none">
            <CardHeader className="p-5">
              <CardTitle className="text-base leading-6">
                <Link className="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={section.href}>{section.module}</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <dl className="space-y-4">
                {section.figures.map((figure) => (
                  <div key={figure.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <dt className="text-sm text-muted-foreground">{figure.label}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{figure.value.toLocaleString("en-US")}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
