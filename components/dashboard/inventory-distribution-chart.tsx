"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CategorySlice } from "@/lib/dashboard/types";
import { EmptyChart } from "./EmptyChart";

const PURPLE_SERIES = [
  "var(--brand-primary)",
  "var(--brand-ai)",
  "var(--brand-border-selected)",
  "var(--brand-focus)",
  "var(--brand-tint-tab)",
] as const;

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { fillColor: string } }>;
}) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-surface border border-border rounded-inner px-3 py-2 shadow-modal">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: item.payload.fillColor }}
          />
          <span className="type-caption font-semibold text-ink">
            {item.name}
          </span>
        </div>
        <p className="type-caption font-semibold text-ink mt-1">
          {item.value.toLocaleString()} items
        </p>
      </div>
    );
  }
  return null;
}

export default function InventoryDistributionChart({
  data: inventoryDistribution,
}: {
  data: CategorySlice[];
}) {
  const total = inventoryDistribution.reduce((s, d) => s + d.value, 0);
  if (!total) return <EmptyChart title="Inventory Distribution" subtitle="Active items grouped by category" />;

  const coloredData = inventoryDistribution.map((entry, index) => ({
    ...entry,
    fillColor: PURPLE_SERIES[index % PURPLE_SERIES.length],
  }));

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full">
      <div>
        <h3 className="type-card-title text-ink">
          Inventory Distribution
        </h3>
        <p className="type-caption text-ink-muted mt-0.5">
          {total.toLocaleString()} active items across {inventoryDistribution.length} categories
        </p>
      </div>

      <div className="h-[180px] w-full my-3">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={coloredData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={76}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={2}
              stroke="var(--bg-surface)"
              isAnimationActive={false}
            >
              {coloredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fillColor} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <text
              x="50%"
              y="46%"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={22}
              fontWeight={600}
              fill="var(--ink)"
            >
              {total}
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fontWeight={500}
              fill="var(--ink-muted)"
            >
              Items
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="divide-y divide-divider">
        {coloredData.map((entry) => {
          const pct = Math.round((entry.value / total) * 100);
          return (
            <div
              key={entry.name}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: entry.fillColor }}
                />
                <span className="type-caption font-medium text-ink truncate">
                  {entry.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="type-caption font-semibold tabular-nums text-ink">
                  {entry.value}
                </span>
                <span className="type-caption font-medium tabular-nums text-ink-muted w-9 text-right">
                  ({pct}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
