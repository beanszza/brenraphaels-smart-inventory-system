import { getDashboardAnalytics } from "@/app/actions/dashboard";
import { PageHeader } from "@/components/shared/PageHeader";
import AiRecommendations from "@/components/dashboard/ai-recommendations";
import DistributionAnalyticsChart from "@/components/dashboard/distribution-analytics-chart";
import InventoryDistributionChart from "@/components/dashboard/inventory-distribution-chart";
import KpiCards from "@/components/dashboard/kpi-cards";
import ProcurementTrendChart from "@/components/dashboard/procurement-trend-chart";
import ProductionQualityChart from "@/components/dashboard/production-quality-chart";
import SupplierPerformanceChart from "@/components/dashboard/supplier-performance-chart";

export default async function AnalyticsDashboardPage() {
  const analytics = await getDashboardAnalytics();
  const hasKpis = Object.values(analytics.kpis).some(Boolean);
  const hasRecommendations =
    analytics.procurementRecommendations || analytics.inventoryForecasts;

  return (
    <div className="w-full min-h-full py-7 px-4 sm:px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Dashboard"
        description="Overview of inventory, procurement, production, and distribution metrics."
      />

      {hasKpis && <KpiCards kpis={analytics.kpis} />}

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {analytics.inventoryDistribution && (
          <InventoryDistributionChart data={analytics.inventoryDistribution} />
        )}
        {analytics.productionQuality && (
          <ProductionQualityChart data={analytics.productionQuality} />
        )}
        {analytics.procurementTrend && (
          <ProcurementTrendChart data={analytics.procurementTrend} />
        )}
        {analytics.supplierPerformance && (
          <SupplierPerformanceChart data={analytics.supplierPerformance} />
        )}
      </div>

      {analytics.distribution && (
        <DistributionAnalyticsChart data={analytics.distribution} />
      )}

      {hasRecommendations && (
        <AiRecommendations
          procurement={analytics.procurementRecommendations}
          forecasts={analytics.inventoryForecasts}
        />
      )}
    </div>
  );
}
