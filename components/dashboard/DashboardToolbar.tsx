"use client";

import { Calendar, Download } from "lucide-react";
import type { DashboardAnalytics } from "@/lib/dashboard/types";

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatSnapshotDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Live";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function buildDashboardCsv(analytics: DashboardAnalytics): string {
  const lines: string[] = [];
  const row = (...cells: (string | number | null | undefined)[]) => {
    lines.push(cells.map(escapeCsvCell).join(","));
  };

  row("IMS Dashboard Export", analytics.generatedAt);
  lines.push("");

  const kpiEntries = [
    ["Active Inventory", analytics.kpis.activeInventory],
    ["Low Stock Alerts", analytics.kpis.lowStockAlerts],
    ["Production Batches", analytics.kpis.productionBatches],
    ["Active Suppliers", analytics.kpis.activeSuppliers],
  ] as const;

  if (kpiEntries.some(([, k]) => k !== null)) {
    row("Section", "Metric", "Value", "Unit", "Trend (%)");
    for (const [label, kpi] of kpiEntries) {
      if (kpi) row("KPI", label, kpi.value, kpi.unit, kpi.trend ?? "");
    }
    lines.push("");
  }

  if (analytics.procurementTrend?.length) {
    row("Procurement Trend", "Month", "Purchase Orders", "Order Value (PHP K)");
    for (const m of analytics.procurementTrend) {
      row("Procurement Trend", m.month, m.orders, m.valueK);
    }
    lines.push("");
  }

  if (analytics.inventoryForecasts?.length) {
    row("Inventory Demand Forecast", "SKU", "Item", "Current Stock", "30-Day Demand", "Unit", "Days Remaining", "Urgency");
    for (const fc of analytics.inventoryForecasts) {
      row("Inventory Demand Forecast", fc.sku, fc.item, fc.currentStock, fc.forecastedDemand, fc.unit, fc.daysRemaining, fc.urgency);
    }
    lines.push("");
  }

  if (analytics.procurementRecommendations?.length) {
    row("Procurement Recommendations", "Code", "Item", "Preferred Supplier", "Recommended Qty", "Unit", "Urgency", "Reason");
    for (const rec of analytics.procurementRecommendations) {
      row("Procurement Recommendations", rec.id, rec.item, rec.supplier, rec.recommendedQty, rec.unit, rec.urgency, rec.reason);
    }
    lines.push("");
  }

  if (analytics.supplierPerformance?.length) {
    row("Supplier Performance", "Supplier", "On-Time Rate (%)", "Avg Lead Time (d)", "Defect Rate (%)");
    for (const sup of analytics.supplierPerformance) {
      row("Supplier Performance", sup.supplier, sup.onTimeRate, sup.avgLeadDays, sup.defectRate);
    }
    lines.push("");
  }

  if (analytics.inventoryDistribution?.length) {
    row("Inventory Distribution", "Category", "Active Items");
    for (const cat of analytics.inventoryDistribution) {
      row("Inventory Distribution", cat.name, cat.value);
    }
    lines.push("");
  }

  if (analytics.productionQuality?.length) {
    row("Production Quality", "Outcome", "Batches");
    for (const q of analytics.productionQuality) {
      row("Production Quality", q.name, q.value);
    }
    lines.push("");
  }

  if (analytics.distribution?.length) {
    row("Distribution Analytics", "Branch", "Received", "Transfers");
    for (const d of analytics.distribution) {
      row("Distribution Analytics", d.branch, d.received, d.transfers);
    }
  }

  return lines.join("\r\n");
}

export function DashboardToolbar({ analytics }: { analytics: DashboardAnalytics }) {
  const snapshotLabel = formatSnapshotDate(analytics.generatedAt);

  const handleExport = () => {
    const csv = buildDashboardCsv(analytics);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const dateStamp = analytics.generatedAt.slice(0, 10) || "export";
    const link = document.createElement("a");
    link.href = url;
    link.download = `ims-dashboard-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <div
        className="h-8 px-3 rounded-control border border-input bg-surface text-ink type-label-button-sm inline-flex items-center gap-2 whitespace-nowrap"
        title={`Live data snapshot generated at ${analytics.generatedAt}`}
      >
        <Calendar className="size-3.5 text-ink-muted shrink-0" />
        <span>Live · {snapshotLabel}</span>
      </div>

      <button
        type="button"
        onClick={handleExport}
        className="h-8 px-3 rounded-control border border-input bg-surface text-ink type-label-button-sm hover:bg-page transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
      >
        <Download className="size-3.5 text-ink-secondary shrink-0" />
        Export
      </button>
    </div>
  );
}
