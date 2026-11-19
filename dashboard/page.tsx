import { Download } from "lucide-react";
import { getDashboardAnalytics } from "@/app/actions/dashboard";
import AiRecommendations from "@/components/dashboard/ai-recommendations";
import DistributionAnalyticsChart from "@/components/dashboard/distribution-analytics-chart";
import InventoryDistributionChart from "@/components/dashboard/inventory-distribution-chart";
import KpiCards from "@/components/dashboard/kpi-cards";
import ProcurementTrendChart from "@/components/dashboard/procurement-trend-chart";
import ProductionQualityChart from "@/components/dashboard/production-quality-chart";
import SupplierPerformanceChart from "@/components/dashboard/supplier-performance-chart";

const DATE_FILTERS = [
  { label: "Today", active: false },
  { label: "7 days", active: true },
  { label: "This month", active: false },
  { label: "Last month", active: false },
  { label: "90 days", active: false },
] as const;

export default async function AnalyticsDashboardPage() {
  const analytics = await getDashboardAnalytics();
  const hasKpis = Object.values(analytics.kpis).some(Boolean);
  const hasRecommendations =
    analytics.procurementRecommendations || analytics.inventoryForecasts;
  const hasTrends =
    analytics.procurementTrend || analytics.supplierPerformance;
  const hasOverview =
    analytics.inventoryDistribution ||
    analytics.productionQuality ||
    analytics.distribution;

  return (
    <div className="page-container w-full min-h-full space-y-5 animate-page-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-page-title text-ink">Dashboard</h1>
          <p className="mt-1 type-body-secondary text-ink-secondary">
            Overview of inventory, procurement, production, and distribution metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {DATE_FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              aria-pressed={filter.active}
              className={
                filter.active
                  ? "h-8 px-3 rounded-control type-label-button-sm bg-primary text-on-brand border border-primary transition-colors cursor-pointer"
                  : "h-8 px-3 rounded-control type-label-button-sm bg-surface text-ink border border-input hover:bg-page transition-colors cursor-pointer"
              }
            >
              {filter.label}
            </button>
          ))}
          <button
            type="button"
            className="h-8 px-3 rounded-control type-label-button-sm bg-surface text-ink border border-input hover:bg-page transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="size-3.5 text-ink-secondary" />
            Export
          </button>
        </div>
      </div>

      {hasKpis && <KpiCards kpis={analytics.kpis} />}

      {hasRecommendations && (
        <AiRecommendations
          procurement={analytics.procurementRecommendations}
          forecasts={analytics.inventoryForecasts}
        />
      )}

      {hasTrends && (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
          {analytics.procurementTrend && (
            <div
              className={
                analytics.supplierPerformance
                  ? "min-w-0 xl:col-span-7"
                  : "min-w-0 xl:col-span-12"
              }
            >
              <ProcurementTrendChart data={analytics.procurementTrend} />
            </div>
          )}
          {analytics.supplierPerformance && (
            <div
              className={
                analytics.procurementTrend
                  ? "min-w-0 xl:col-span-5"
                  : "min-w-0 xl:col-span-12"
              }
            >
              <SupplierPerformanceChart data={analytics.supplierPerformance} />
            </div>
          )}
        </div>
      )}

      {hasOverview && (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
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
