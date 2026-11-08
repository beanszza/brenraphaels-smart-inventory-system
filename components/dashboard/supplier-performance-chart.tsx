"use client";

import { useState } from "react";
import type { SupplierScore } from "@/lib/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { EmptyChart } from "./EmptyChart";

type Metric = "onTimeRate" | "avgLeadDays" | "defectRate";

const METRICS: {
  key: Metric;
  label: string;
  unit: string;
  barClass: string;
}[] = [
  { key: "onTimeRate",  label: "On-Time Rate",  unit: "%", barClass: "bg-success" },
  { key: "avgLeadDays", label: "Avg Lead Time", unit: "d", barClass: "bg-primary" },
  { key: "defectRate",  label: "Defect Rate",   unit: "%", barClass: "bg-destructive" },
];

export default function SupplierPerformanceChart({
  data: supplierPerformance,
}: {
  data: SupplierScore[];
}) {
  const [activeMetric, setActiveMetric] = useState<Metric>("onTimeRate");
  const metric = METRICS.find((m) => m.key === activeMetric)!;

  const sorted = [...supplierPerformance].sort((a, b) =>
    activeMetric === "onTimeRate"
      ? b[activeMetric] - a[activeMetric]
      : a[activeMetric] - b[activeMetric],
  );

  if (!sorted.length) {
    return (
      <EmptyChart
        title="Supplier Performance"
        subtitle="Compare suppliers by delivery punctuality, lead time, and quality"
      />
    );
  }

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const maxVal = Math.max(
    activeMetric === "avgLeadDays" ? 1 : 100,
    ...sorted.map((s) => s[activeMetric]),
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Supplier Performance
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare suppliers by delivery punctuality, lead time, and quality
            </p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1 self-start">
            {METRICS.map((m) => {
              const active = activeMetric === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveMetric(m.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary Callouts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="success">Top Performer</Badge>
              </div>
              <p
                className="text-xs font-semibold text-foreground mt-1.5 truncate"
                title={best.supplier}
              >
                {best.supplier}
              </p>
            </div>
            <p className="text-lg font-extrabold tabular-nums text-foreground shrink-0">
              {best[activeMetric]}
              {metric.unit}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Needs Attention</Badge>
              </div>
              <p
                className="text-xs font-semibold text-foreground mt-1.5 truncate"
                title={worst.supplier}
              >
                {worst.supplier}
              </p>
            </div>
            <p className="text-lg font-extrabold tabular-nums text-foreground shrink-0">
              {worst[activeMetric]}
              {metric.unit}
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Supplier Bars — keeps every supplier name and figure clearly legible */}
      <div className="space-y-3">
        {sorted.map((s) => {
          const val = s[activeMetric];
          const pct = Math.min(100, Math.round((val / maxVal) * 100));
          return (
            <div key={s.supplier} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="text-xs font-medium text-foreground truncate"
                  title={s.supplier}
                >
                  {s.supplier}
                </span>
                <span className="text-xs font-bold tabular-nums text-foreground shrink-0">
                  {val}
                  {metric.unit}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${metric.barClass}`}
                  style={{ width: `${Math.max(val > 0 ? 4 : 0, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
