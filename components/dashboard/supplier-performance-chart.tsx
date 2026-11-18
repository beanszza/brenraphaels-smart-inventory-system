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
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="type-card-title text-ink">
              Supplier Performance
            </h3>
            <p className="type-caption text-ink-muted mt-0.5">
              Compare suppliers by delivery punctuality, lead time, and quality
            </p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-inner bg-subtle p-1 self-start">
            {METRICS.map((m) => {
              const active = activeMetric === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveMetric(m.key)}
                  className={`px-3 py-1.5 rounded-control type-caption font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-surface text-ink shadow-xs"
                      : "text-ink-muted hover:text-ink"
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
          <div className="rounded-inner border border-border bg-subtle p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="success">Top Performer</Badge>
              </div>
              <p
                className="type-caption font-semibold text-ink mt-1.5 truncate"
                title={best.supplier}
              >
                {best.supplier}
              </p>
            </div>
            <p className="type-subsection font-semibold tabular-nums text-ink shrink-0">
              {best[activeMetric]}
              {metric.unit}
            </p>
          </div>

          <div className="rounded-inner border border-border bg-subtle p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Needs Attention</Badge>
              </div>
              <p
                className="type-caption font-semibold text-ink mt-1.5 truncate"
                title={worst.supplier}
              >
                {worst.supplier}
              </p>
            </div>
            <p className="type-subsection font-semibold tabular-nums text-ink shrink-0">
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
                  className="type-caption font-medium text-ink truncate"
                  title={s.supplier}
                >
                  {s.supplier}
                </span>
                <span className="type-caption font-semibold tabular-nums text-ink shrink-0">
                  {val}
                  {metric.unit}
                </span>
              </div>
              <div className="h-2 w-full rounded-pill bg-subtle overflow-hidden">
                <div
                  className={`h-full rounded-pill transition-all duration-300 ${metric.barClass}`}
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
