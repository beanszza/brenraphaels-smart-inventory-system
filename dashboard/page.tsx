import { getDashboardAnalytics } from "@/app/actions/dashboard";
import {
  InventoryForecastCard,
  ProcurementRecommendationCard,
} from "@/components/dashboard/ai-recommendations";
import { DashboardToolbar } from "@/components/dashboard/DashboardToolbar";
import DistributionAnalyticsChart from "@/components/dashboard/distribution-analytics-chart";
import InventoryDistributionChart from "@/components/dashboard/inventory-distribution-chart";
import KpiCards from "@/components/dashboard/kpi-cards";
import ProcurementTrendChart from "@/components/dashboard/procurement-trend-chart";
import ProductionQualityChart from "@/components/dashboard/production-quality-chart";
import SupplierPerformanceChart from "@/components/dashboard/supplier-performance-chart";
import type { DashboardDateRange } from "@/lib/dashboard/types";

type DashboardSearchParams = {
  from?: string | string[];
  to?: string | string[];
  preset?: string | string[];
};

const pickParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function AnalyticsDashboardPage(props?: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const params = props?.searchParams ? await props.searchParams : undefined;
  const from = pickParam(params?.from);
  const to = pickParam(params?.to);
  const preset = pickParam(params?.preset);
  const range: DashboardDateRange | null =
    from && to ? { from, to, ...(preset ? { label: preset } : {}) } : null;

  const analytics = range
    ? await getDashboardAnalytics(range)
    : await getDashboardAnalytics();

  const isRangeFiltered = Boolean(analytics.dateRange);
  const hasKpis = Object.values(analytics.kpis).some(Boolean);
  const hasPrimaryBand =
    analytics.procurementTrend || analytics.inventoryForecasts;
  const hasActionBand =
    analytics.procurementRecommendations || analytics.supplierPerformance;
  const hasOverviewBand =
    analytics.inventoryDistribution ||
    analytics.productionQuality ||
    analytics.distribution;

  return (
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-page-title text-ink tracking-tight">Dashboard</h1>
          <p className="mt-0.5 type-body-secondary text-ink-muted">
            Overview of inventory, procurement, production, and distribution metrics.
          </p>
        </div>

        <DashboardToolbar analytics={analytics} />
      </div>

      {hasKpis && (
        <KpiCards kpis={analytics.kpis} isRangeFiltered={isRangeFiltered} />
      )}

      {hasPrimaryBand && (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12 items-stretch">
          {analytics.procurementTrend && (
            <div
              className={
                analytics.inventoryForecasts
                  ? "min-w-0 xl:col-span-7"
                  : "min-w-0 xl:col-span-12"
              }
            >
              <ProcurementTrendChart
                data={analytics.procurementTrend}
                isRangeFiltered={isRangeFiltered}
              />
            </div>
          )}
          {analytics.inventoryForecasts && (
            <div
              className={
                analytics.procurementTrend
                  ? "min-w-0 xl:col-span-5"
                  : "min-w-0 xl:col-span-12"
              }
            >
              <InventoryForecastCard inventoryForecasts={analytics.inventoryForecasts} />
            </div>
          )}
        </div>
      )}

      {hasActionBand && (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12 items-stretch">
          {analytics.procurementRecommendations && (
            <div
              className={
                analytics.supplierPerformance
                  ? "min-w-0 xl:col-span-7"
                  : "min-w-0 xl:col-span-12"
              }
            >
              <ProcurementRecommendationCard
                procurementRecommendations={analytics.procurementRecommendations}
              />
            </div>
          )}
          {analytics.supplierPerformance && (
            <div
              className={
                analytics.procurementRecommendations
                  ? "min-w-0 xl:col-span-5"
                  : "min-w-0 xl:col-span-12"
              }
            >
              <SupplierPerformanceChart data={analytics.supplierPerformance} />
            </div>
          )}
        </div>
      )}

      {hasOverviewBand && (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3 items-stretch">
          {analytics.inventoryDistribution && (
            <InventoryDistributionChart data={analytics.inventoryDistribution} />
          )}
          {analytics.productionQuality && (
            <ProductionQualityChart data={analytics.productionQuality} />
          )}
          {analytics.distribution && (
            <DistributionAnalyticsChart data={analytics.distribution} />
          )}
        </div>
      )}
    </div>
  );
}
