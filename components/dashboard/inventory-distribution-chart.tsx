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

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-surface border border-border rounded-inner px-3 py-2 shadow-modal">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: item.payload.color }}
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

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col justify-between">
      <div>
        <h3 className="type-card-title text-ink">
          Inventory Distribution
        </h3>
        <p className="type-caption text-ink-muted mt-0.5">
          {total.toLocaleString()} active items across {inventoryDistribution.length} categories
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 mt-4">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={inventoryDistribution}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={88}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={2}
                stroke="var(--surface)"
              >
                {inventoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <text
                x="50%"
                y="47%"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={24}
                fontWeight={700}
                fill="var(--ink)"
              >
                {total}
              </text>
              <text
                x="50%"
                y="57%"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={500}
                fill="var(--ink-muted)"
              >
                Items
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2.5">
          {inventoryDistribution.map((entry) => {
            const pct = Math.round((entry.value / total) * 100);
            return (
              <div
                key={entry.name}
                className="flex items-center justify-between gap-3 rounded-inner border border-border bg-subtle px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: entry.color }}
                  />
                  <span className="type-caption font-semibold text-ink truncate">
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
    </div>
  );
}
