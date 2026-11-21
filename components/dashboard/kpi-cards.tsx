"use client";

import type { DashboardKpis } from "@/lib/dashboard/types";
import { ArrowDown, ArrowUp } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number;
  subtitle: string;
  trend: number | null;
  trendComparisonLabel?: string;
  isAlert?: boolean;
}

function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendComparisonLabel = "vs last month",
  isAlert,
}: KpiCardProps) {
  const isPositive = (trend ?? 0) >= 0;
  const TrendIcon = isPositive ? ArrowUp : ArrowDown;

  return (
    <div className="rounded-card border border-border bg-surface px-5 py-4 flex flex-col justify-between gap-1">
      <span className="type-caption font-medium text-ink-muted">{title}</span>

      <div className="type-stat-value text-ink tabular-nums tracking-tight">
        {value.toLocaleString()}
      </div>

      {trend !== null ? (
        <p
          className={`inline-flex items-center gap-1 type-caption font-medium tabular-nums ${
            isPositive ? "text-success" : "text-destructive"
          }`}
        >
          <TrendIcon className="size-3 shrink-0" />
          <span>
            {Math.abs(trend)}% {trendComparisonLabel}
          </span>
        </p>
      ) : (
        <p
          className={`type-caption font-medium ${
            isAlert && value > 0 ? "text-status-amber-fg" : "text-ink-muted"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default function KpiCards({
  kpis: kpiData,
  isRangeFiltered = false,
}: {
  kpis: DashboardKpis;
  isRangeFiltered?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {kpiData.activeInventory && (
        <KpiCard
          title="Active Inventory"
          value={kpiData.activeInventory.value}
          subtitle="Active items across categories"
          trend={kpiData.activeInventory.trend}
        />
      )}
      {kpiData.lowStockAlerts && (
        <KpiCard
          title="Low Stock Alerts"
          value={kpiData.lowStockAlerts.value}
          subtitle="At or below minimum level"
          trend={kpiData.lowStockAlerts.trend}
          isAlert
        />
      )}
      {kpiData.productionBatches && (
        <KpiCard
          title="Production Batches"
          value={kpiData.productionBatches.value}
          subtitle={
            isRangeFiltered
              ? "Scheduled or completed in selected range"
              : "Scheduled or completed this month"
          }
          trend={kpiData.productionBatches.trend}
          trendComparisonLabel={
            isRangeFiltered ? "vs prior period" : "vs last month"
          }
        />
      )}
      {kpiData.activeSuppliers && (
        <KpiCard
          title="Active Suppliers"
          value={kpiData.activeSuppliers.value}
          subtitle="Registered vendor partners"
          trend={kpiData.activeSuppliers.trend}
        />
      )}
    </div>
  );
}
