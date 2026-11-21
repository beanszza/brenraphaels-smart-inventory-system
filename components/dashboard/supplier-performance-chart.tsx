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
  { key: "onTimeRate", label: "On-Time Rate", unit: "%", barClass: "bg-primary" },
  { key: "avgLeadDays", label: "Avg Lead Time", unit: "d", barClass: "bg-primary" },
  { key: "defectRate", label: "Defect Rate", unit: "%", barClass: "bg-destructive" },
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

  const headline =
    activeMetric === "onTimeRate"
      ? `${best.supplier} leads at ${best.onTimeRate}% on-time.`
      : activeMetric === "avgLeadDays"
        ? `${best.supplier} has the fastest lead time (${best.avgLeadDays}d).`
        : `${best.supplier} holds the lowest defect rate (${best.defectRate}%).`;

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full gap-4">
      <div className="space-y-3">
        <div>
          <p className="type-caption font-medium text-ink-muted">
            Supplier Performance
          </p>
          <h3 className="type-card-title text-ink mt-0.5 tracking-tight">
            {headline}
          </h3>
        </div>

        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5">
          {METRICS.map((m) => {
            const active = activeMetric === m.key;
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveMetric(m.key)}
                className={`px-2.5 py-1 rounded-control type-caption font-medium text-center transition-colors cursor-pointer truncate ${
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
      </div>

      <div className="space-y-3 flex-1">
        {sorted.map((s) => {
          const val = s[activeMetric];
          const pct = Math.min(100, Math.round((val / maxVal) * 100));
          return (
            <div key={s.supplier} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="type-body-secondary font-medium text-ink truncate"
                  title={s.supplier}
                >
                  {s.supplier}
                </span>
                <span className="type-body-secondary font-semibold tabular-nums text-ink shrink-0">
                  {val}
                  {metric.unit}
                </span>
              </div>
              <div className="h-2 w-full rounded-pill bg-status-gray-bg overflow-hidden">
                <div
                  className={`h-full rounded-pill transition-all duration-300 ${metric.barClass}`}
                  style={{ width: `${Math.max(val > 0 ? 4 : 0, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length > 1 && (
        <p className="type-caption text-ink-muted">
          Needs attention:{" "}
          <span className="font-medium text-status-amber-fg">
            {worst.supplier} ({worst[activeMetric]}
            {metric.unit})
          </span>
        </p>
      )}
    </div>
  );
}
