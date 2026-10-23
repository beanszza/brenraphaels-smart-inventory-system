"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { productionQuality } from "./mock-data";

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
        <p className="text-sm font-bold text-foreground mt-0.5">
          {item.value} Batches
        </p>
      </div>
    );
  }
  return null;
}

export default function ProductionQualityChart() {
  const total = productionQuality.reduce((s, d) => s + d.value, 0);
  const passed = productionQuality.find((d) => d.name === "Passed")?.value ?? 0;
  const passRate = Math.round((passed / total) * 100);

  // Badge styles matching Orders & Procurement palette
  const badgeStyle: Record<string, { bg: string; text: string }> = {
    Passed:    { bg: "bg-badge-success",  text: "text-badge-success-foreground" },
    Rejected:  { bg: "bg-badge-destructive",   text: "text-badge-destructive-foreground" },
    Cancelled: { bg: "bg-badge-orange",     text: "text-badge-orange-foreground" },
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-foreground/90">
            Production Quality
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} total batches · current period
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-badge-success text-badge-success-foreground text-xs font-semibold">
          In Cycle
        </span>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie
            data={productionQuality}
            cx="50%"
            cy="46%"
            innerRadius={68}
            outerRadius={98}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={2}
            stroke="#fff"
          >
            {productionQuality.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-foreground">{value}</span>
            )}
          />
          {/* Center pass-rate label */}
          <text
            x="50%"
            y="43%"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={26}
            fontWeight={700}
            fill="#101828"
          >
            {passRate}%
          </text>
          <text
            x="50%"
            y="51%"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={500}
            fill="#98a2b3"
          >
            Pass Rate
          </text>
        </PieChart>
      </ResponsiveContainer>

      {/* Stat row — Passed / Rejected / Cancelled */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {productionQuality.map((d) => {
          const style = badgeStyle[d.name] ?? { bg: "bg-muted", text: "text-foreground" };
          return (
            <div
              key={d.name}
              className={`rounded-xl p-3 text-center ${style.bg}`}
            >
              <p className={`text-xl font-bold ${style.text}`}>{d.value}</p>
              <p className={`text-xs font-semibold mt-0.5 ${style.text} opacity-80`}>
                {d.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {Math.round((d.value / total) * 100)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
