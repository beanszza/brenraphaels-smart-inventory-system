"use client";

import { useState } from "react";
import type { SupplierScore } from "@/lib/dashboard/types";
import { EmptyChart } from "./EmptyChart";

type Metric = "onTimeRate" | "avgLeadDays" | "defectRate";

const METRICS: {
  key: Metric;
  label: string;
  unit: string;
  barClass: string;
}[] = [
  { key: "onTimeRate",  label: "On-Time Rate",  unit: "%", barClass: "bg-primary" },
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
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full">
      <div>
        <div className="mb-3">
          <h3 className="type-card-title text-ink">
            Supplier Performance
          </h3>
          <p className="type-caption text-ink-muted mt-0.5">
            Compare suppliers by delivery punctuality, lead time, and quality
          </p>
        </div>

        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1 sm:gap-1.5 mb-4">
          {METRICS.map((m) => {
            const active = activeMetric === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setActiveMetric(m.key)}
                className={`px-1.5 sm:px-2.5 py-1 rounded-control type-caption font-medium text-center transition-colors cursor-pointer truncate ${
                  active
                    ? "bg-primary text-on-brand border border-primary"
                    : "bg-surface text-ink-secondary border border-input hover:bg-page hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Summary Callouts — flat divider strip (no nested gray boxes) */}
        <div className="grid grid-cols-2 gap-4 pb-3.5 mb-4 border-b border-divider">
          <div className="min-w-0">
            <span className="type-caption font-medium text-success">
              Top Performer
            </span>
            <p
              className="type-body-secondary font-semibold text-ink mt-0.5 truncate"
              title={best.supplier}
            >
              {best.supplier}
            </p>
            <p className="type-caption tabular-nums text-ink-muted">
              {best[activeMetric]}
              {metric.unit}
            </p>
          </div>

          <div className="min-w-0">
            <span className="type-caption font-medium text-warning">
              Needs Attention
            </span>
            <p
              className="type-body-secondary font-semibold text-ink mt-0.5 truncate"
              title={worst.supplier}
            >
              {worst.supplier}
            </p>
            <p className="type-caption tabular-nums text-ink-muted">
              {worst[activeMetric]}
              {metric.unit}
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Supplier Bars */}
      <div className="space-y-3">
        {sorted.map((s) => {
          const val = s[activeMetric];
          const pct = Math.min(100, Math.round((val / maxVal) * 100));
          return (
            <div key={s.supplier} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="type-caption font-medium text-ink truncate"
                  title={s.supplier}
                >
                  {s.supplier}
                </span>
                <span className="type-caption font-semibold tabular-nums text-ink-muted shrink-0">
                  {val}
                  {metric.unit}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-pill bg-tint-tab overflow-hidden">
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
