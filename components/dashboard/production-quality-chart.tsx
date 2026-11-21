"use client";

import type { QualitySlice } from "@/lib/dashboard/types";
import { EmptyChart } from "./EmptyChart";

const QUALITY_STYLES: Record<
  string,
  { bar: string; dot: string; bg: string; text: string }
> = {
  Passed: {
    bar: "bg-success",
    dot: "bg-success",
    bg: "bg-status-green-bg",
    text: "text-status-green-fg",
  },
  "In progress": {
    bar: "bg-primary",
    dot: "bg-primary",
    bg: "bg-status-purple-bg",
    text: "text-status-purple-fg",
  },
  Rejected: {
    bar: "bg-destructive",
    dot: "bg-destructive",
    bg: "bg-status-red-bg",
    text: "text-status-red-fg",
  },
  Cancelled: {
    bar: "bg-ink-muted",
    dot: "bg-ink-muted",
    bg: "bg-status-gray-bg",
    text: "text-status-gray-fg",
  },
};

export default function ProductionQualityChart({
  data: productionQuality,
}: {
  data: QualitySlice[];
}) {
  const total = productionQuality.reduce((s, d) => s + d.value, 0);
  if (!total) {
    return (
      <EmptyChart
        title="Production Quality"
        subtitle="Batch quality inspection outcomes"
      />
    );
  }

  const passed = productionQuality.find((d) => d.name === "Passed")?.value ?? 0;
  const passRate = Math.round((passed / total) * 100);

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full gap-4">
      <div>
        <p className="type-caption font-medium text-ink-muted">
          Production Quality
        </p>
        <h3 className="type-card-title text-ink mt-0.5 tracking-tight">
          {passRate}% pass rate across {total.toLocaleString()} inspected{" "}
          {total === 1 ? "batch" : "batches"}.
        </h3>
      </div>

      <div className="space-y-4 flex-1">
        <div
          className="h-2 w-full rounded-pill bg-status-gray-bg overflow-hidden flex gap-0.5"
          role="img"
          aria-label={`Production quality breakdown: ${passRate}% passed`}
        >
          {productionQuality.map((d) => {
            const style = QUALITY_STYLES[d.name] ?? {
              bar: "bg-primary",
              dot: "bg-primary",
              bg: "bg-subtle",
              text: "text-ink",
            };
            const widthPct = (d.value / total) * 100;
            return (
              <div
                key={d.name}
                className={`h-full first:rounded-l-pill last:rounded-r-pill ${style.bar}`}
                style={{ width: `${widthPct}%` }}
                title={`${d.name}: ${d.value} (${Math.round(widthPct)}%)`}
              />
            );
          })}
        </div>

        <div className="space-y-2.5">
          {productionQuality.map((d) => {
            const style = QUALITY_STYLES[d.name] ?? {
              bar: "bg-primary",
              dot: "bg-primary",
              bg: "bg-subtle",
              text: "text-ink",
            };
            const pct = Math.round((d.value / total) * 100);
            return (
              <div
                key={d.name}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`size-2 rounded-full shrink-0 ${style.dot}`}
                  />
                  <span className="type-body-secondary font-medium text-ink truncate">
                    {d.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-pill type-badge-compact tabular-nums ${style.bg} ${style.text}`}
                  >
                    {d.value.toLocaleString()}
                  </span>
                  <span className="type-caption font-medium tabular-nums text-ink-muted w-9 text-right">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
