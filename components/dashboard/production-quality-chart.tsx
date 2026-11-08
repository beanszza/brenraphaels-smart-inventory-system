"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { QualitySlice } from "@/lib/dashboard/types";
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
      <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-md">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: item.payload.color }}
          />
          <span className="text-xs font-semibold text-foreground">
            {item.name}
          </span>
        </div>
        <p className="text-xs font-bold text-foreground mt-1">
          {item.value} batches
        </p>
      </div>
    );
  }
  return null;
}

export default function ProductionQualityChart({
  data: productionQuality,
}: {
  data: QualitySlice[];
}) {
  const total = productionQuality.reduce((s, d) => s + d.value, 0);
  if (!total) return <EmptyChart title="Production Quality" subtitle="Batch quality inspection outcomes" />;
  const passed = productionQuality.find((d) => d.name === "Passed")?.value ?? 0;
  const passRate = Math.round((passed / total) * 100);

  const badgeStyle: Record<string, { bg: string; text: string }> = {
    Passed:        { bg: "bg-badge-success",     text: "text-badge-success-foreground" },
    Rejected:      { bg: "bg-badge-destructive", text: "text-badge-destructive-foreground" },
    Cancelled:     { bg: "bg-badge-orange",      text: "text-badge-orange-foreground" },
    "In progress": { bg: "bg-badge-warning",     text: "text-badge-warning-foreground" },
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-foreground">
          Production Quality
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {total.toLocaleString()} total batches inspected
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 mt-4">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={productionQuality}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={88}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={2}
                stroke="var(--card)"
              >
                {productionQuality.map((entry, index) => (
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
                fill="var(--foreground)"
              >
                {passRate}%
              </text>
              <text
                x="50%"
                y="57%"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={500}
                fill="var(--muted-foreground)"
              >
                Pass Rate
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2.5">
          {productionQuality.map((d) => {
            const style = badgeStyle[d.name] ?? { bg: "bg-muted", text: "text-foreground" };
            const pct = Math.round((d.value / total) * 100);
            return (
              <div
                key={d.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: d.color }}
                  />
                  <span className="text-xs font-semibold text-foreground truncate">
                    {d.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${style.bg} ${style.text}`}>
                    {d.value}
                  </span>
                  <span className="text-[11px] font-medium tabular-nums text-muted-foreground w-9 text-right">
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
