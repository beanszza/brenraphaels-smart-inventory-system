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
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {trend !== null && (
            <Badge variant={isPositive ? "success" : "destructive"} className="gap-1">
              <TrendIcon className="w-3 h-3" />
              {Math.abs(trend)}%
            </Badge>
          )}
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-foreground shrink-0">
            {icon}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground tabular-nums">
          {value.toLocaleString()}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
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
          icon={<Package className="w-4 h-4 text-primary" />}
        />
      )}
      {kpiData.lowStockAlerts && (
        <KpiCard
          title="Low Stock Alerts"
          value={kpiData.lowStockAlerts.value}
          subtitle="Items at or below minimum stock level"
          trend={kpiData.lowStockAlerts.trend}
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
        />
      )}
      {kpiData.productionBatches && (
        <KpiCard
          title="Production Batches"
          value={kpiData.productionBatches.value}
          subtitle="Batches scheduled or completed this month"
          trend={kpiData.productionBatches.trend}
          icon={<Factory className="w-4 h-4 text-primary" />}
        />
      )}
      {kpiData.activeSuppliers && (
        <KpiCard
          title="Active Suppliers"
          value={kpiData.activeSuppliers.value}
          subtitle="Registered and active vendor partners"
          trend={kpiData.activeSuppliers.trend}
          icon={<Handshake className="w-4 h-4 text-primary" />}
        />
      )}
    </div>
  );
}
