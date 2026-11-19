"use client";

import type { DashboardKpis } from "@/lib/dashboard/types";
import { ArrowDown, ArrowUp } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number;
  subtitle: string;
  trend: number | null;
  isAlert?: boolean;
}

function KpiCard({ title, value, subtitle, trend, isAlert }: KpiCardProps) {
  const isPositive = (trend ?? 0) >= 0;
  const TrendIcon = isPositive ? ArrowUp : ArrowDown;

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <span className="type-body-secondary text-ink-muted">{title}</span>
        {trend !== null && (
          <span
            className={`inline-flex items-center gap-0.5 type-caption font-medium tabular-nums shrink-0 ${
              isPositive ? "text-success" : "text-destructive"
            }`}
          >
            <TrendIcon className="size-3" />
            {Math.abs(trend)}%
          </span>
        )}
      </div>

      <div className="type-stat-value text-ink tabular-nums mt-1.5">
        {value.toLocaleString()}
      </div>
      <p
        className={`type-caption mt-2 ${
          isAlert && value > 0 ? "text-destructive" : "text-ink-muted"
        }`}
      >
        {subtitle}
      </p>
    </div>
  );
}

export default function KpiCards({ kpis: kpiData }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiData.activeInventory && (
        <KpiCard
          title="Active Inventory"
          value={kpiData.activeInventory.value}
          subtitle="Active items across all categories"
          trend={kpiData.activeInventory.trend}
        />
      )}
      {kpiData.lowStockAlerts && (
        <KpiCard
          title="Low Stock Alerts"
          value={kpiData.lowStockAlerts.value}
          subtitle="Items at or below minimum stock level"
          trend={kpiData.lowStockAlerts.trend}
          isAlert
        />
      )}
      {kpiData.productionBatches && (
        <KpiCard
          title="Production Batches"
          value={kpiData.productionBatches.value}
          subtitle="Batches scheduled or completed this month"
          trend={kpiData.productionBatches.trend}
        />
      )}
      {kpiData.activeSuppliers && (
        <KpiCard
          title="Active Suppliers"
          value={kpiData.activeSuppliers.value}
          subtitle="Registered and active vendor partners"
          trend={kpiData.activeSuppliers.trend}
        />
      )}
    </div>
  );
}
