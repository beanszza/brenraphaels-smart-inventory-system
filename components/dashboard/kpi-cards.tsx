"use client";

import type { DashboardKpis } from "@/lib/dashboard/types";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  AlertTriangle,
  Factory,
  Handshake,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface KpiCardProps {
  title: string;
  value: number;
  subtitle: string;
  trend: number | null;
  icon: React.ReactNode;
}

function KpiCard({ title, value, subtitle, trend, icon }: KpiCardProps) {
  const isPositive = (trend ?? 0) >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="type-nav-group text-ink-muted">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {trend !== null && (
            <Badge variant={isPositive ? "success" : "destructive"} className="gap-1">
              <TrendIcon className="size-3" />
              {Math.abs(trend)}%
            </Badge>
          )}
          <div className="size-9 rounded-control bg-subtle flex items-center justify-center text-ink shrink-0">
            {icon}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="type-stat-value text-ink tabular-nums">
          {value.toLocaleString()}
        </div>
        <p className="type-caption text-ink-muted mt-1">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export default function KpiCards({ kpis: kpiData }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {kpiData.activeInventory && (
        <KpiCard
          title="Active Inventory"
          value={kpiData.activeInventory.value}
          subtitle="Active items across all categories"
          trend={kpiData.activeInventory.trend}
          icon={<Package className="size-4 text-primary" />}
        />
      )}
      {kpiData.lowStockAlerts && (
        <KpiCard
          title="Low Stock Alerts"
          value={kpiData.lowStockAlerts.value}
          subtitle="Items at or below minimum stock level"
          trend={kpiData.lowStockAlerts.trend}
          icon={<AlertTriangle className="size-4 text-destructive" />}
        />
      )}
      {kpiData.productionBatches && (
        <KpiCard
          title="Production Batches"
          value={kpiData.productionBatches.value}
          subtitle="Batches scheduled or completed this month"
          trend={kpiData.productionBatches.trend}
          icon={<Factory className="size-4 text-primary" />}
        />
      )}
      {kpiData.activeSuppliers && (
        <KpiCard
          title="Active Suppliers"
          value={kpiData.activeSuppliers.value}
          subtitle="Registered and active vendor partners"
          trend={kpiData.activeSuppliers.trend}
          icon={<Handshake className="size-4 text-primary" />}
        />
      )}
    </div>
  );
}
