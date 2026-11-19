"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ProcurementMonth } from "@/lib/dashboard/types";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border rounded-inner px-3 py-2.5 shadow-modal min-w-[150px]">
        <p className="type-caption font-semibold text-ink mb-1.5">
          {label}
        </p>
        <div className="space-y-1">
          {payload.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 type-caption text-ink-muted">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: p.color }}
                />
                {p.name}
              </span>
              <span className="type-caption font-semibold tabular-nums text-ink">
                {p.name === "Order Value (₱K)" ? `₱${p.value}K` : p.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function ProcurementTrendChart({
  data: procurementTrend,
}: {
  data: ProcurementMonth[];
}) {
  const totalOrders = procurementTrend.reduce((sum, m) => sum + m.orders, 0);
  const firstMonth = procurementTrend[0]?.month;
  const lastMonth = procurementTrend[procurementTrend.length - 1]?.month;
  const rangeText = firstMonth && lastMonth ? `${firstMonth} – ${lastMonth}` : "Last 6 months";

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="type-card-title text-ink">
            Procurement Trend
          </h3>
          <p className="type-caption text-ink-muted mt-0.5">
            {totalOrders.toLocaleString()} purchase orders over 6 months ({rangeText})
          </p>
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={procurementTrend}
            margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-divider)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "var(--ink-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "var(--ink-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "var(--ink-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: "8px" }}
              formatter={(value) => (
                <span className="type-caption font-medium text-ink pl-1">
                  {value}
                </span>
              )}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="orders"
              name="Purchase Orders"
              stroke="var(--brand-primary)"
              strokeWidth={2.5}
              dot={{ fill: "var(--brand-primary)", r: 4, strokeWidth: 2, stroke: "var(--bg-surface)" }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="valueK"
              name="Order Value (₱K)"
              stroke="var(--brand-focus)"
              strokeWidth={2.5}
              strokeDasharray="5 3"
              dot={{ fill: "var(--brand-focus)", r: 4, strokeWidth: 2, stroke: "var(--bg-surface)" }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
