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
      <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-md min-w-[150px]">
        <p className="text-xs font-bold text-foreground mb-1.5">
          {label}
        </p>
        <div className="space-y-1">
          {payload.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: p.color }}
                />
                {p.name}
              </span>
              <span className="text-xs font-bold tabular-nums text-foreground">
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
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Procurement Trend
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
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
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: "8px" }}
              formatter={(value) => (
                <span className="text-xs font-medium text-foreground pl-1">
                  {value}
                </span>
              )}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="orders"
              name="Purchase Orders"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={{ fill: "var(--primary)", r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="valueK"
              name="Order Value (₱K)"
              stroke="#16a34a"
              strokeWidth={2.5}
              strokeDasharray="5 3"
              dot={{ fill: "#16a34a", r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
