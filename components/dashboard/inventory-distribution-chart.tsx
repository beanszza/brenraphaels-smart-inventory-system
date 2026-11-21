"use client";

import type { CategorySlice } from "@/lib/dashboard/types";
import { EmptyChart } from "./EmptyChart";

export default function InventoryDistributionChart({
  data: inventoryDistribution,
}: {
  data: CategorySlice[];
}) {
  const total = inventoryDistribution.reduce((s, d) => s + d.value, 0);
  if (!total) {
    return (
      <EmptyChart
        title="Inventory Distribution"
        subtitle="Active items grouped by category"
      />
    );
  }

  const sorted = [...inventoryDistribution].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const topPct = Math.round((top.value / total) * 100);
  const maxVal = top.value || 1;

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full gap-4">
      <div>
        <p className="type-caption font-medium text-ink-muted">
          Inventory Distribution
        </p>
        <h3 className="type-card-title text-ink mt-0.5 tracking-tight">
          {top.name} makes up {topPct}% of active stock.
        </h3>
      </div>

      <div className="space-y-3 flex-1">
        {sorted.map((entry) => {
          const sharePct = Math.round((entry.value / total) * 100);
          const barPct = Math.max(4, Math.round((entry.value / maxVal) * 100));
          return (
            <div key={entry.name} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="type-body-secondary font-medium text-ink truncate"
                  title={entry.name}
                >
                  {entry.name}
                </span>
                <span className="type-caption font-semibold tabular-nums text-ink shrink-0">
                  {entry.value.toLocaleString()}{" "}
                  <span className="font-normal text-ink-muted">
                    ({sharePct}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full rounded-pill bg-status-gray-bg overflow-hidden">
                <div
                  className="h-full rounded-pill bg-primary transition-all duration-300"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="type-caption text-ink-muted">
        {total.toLocaleString()} active items across {sorted.length}{" "}
        {sorted.length === 1 ? "category" : "categories"}.
      </p>
    </div>
  );
}
