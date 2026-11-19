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

const QUALITY_COLOR: Record<string, string> = {
  Passed: "var(--semantic-success)",
  Rejected: "var(--semantic-danger)",
  Cancelled: "var(--ink-muted)",
  "In progress": "var(--brand-primary)",
};

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

  const coloredData = productionQuality.map((d) => ({
    ...d,
    fillColor: QUALITY_COLOR[d.name] ?? "var(--brand-focus)",
  }));

  const badgeStyle: Record<string, { bg: string; text: string }> = {
    Passed:        { bg: "bg-status-green-bg",  text: "text-status-green-fg" },
    Rejected:      { bg: "bg-status-red-bg",    text: "text-status-red-fg" },
    Cancelled:     { bg: "bg-status-gray-bg",   text: "text-status-gray-fg" },
    "In progress": { bg: "bg-status-purple-bg", text: "text-status-purple-fg" },
  };

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full">
      <div>
        <h3 className="type-card-title text-ink">
          Production Quality
        </h3>
        <p className="type-caption text-ink-muted mt-0.5">
          {total.toLocaleString()} total batches inspected
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
              {passRate}%
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
              Pass Rate
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="divide-y divide-divider">
        {coloredData.map((d) => {
          const style = badgeStyle[d.name] ?? { bg: "bg-subtle", text: "text-ink" };
          const pct = Math.round((d.value / total) * 100);
          return (
            <div
              key={d.name}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: d.fillColor }}
                />
                <span className="type-caption font-medium text-ink truncate">
                  {d.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-pill type-badge-compact tabular-nums ${style.bg} ${style.text}`}>
                  {d.value}
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
