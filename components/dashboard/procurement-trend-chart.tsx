"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { ProcurementMonth } from "@/lib/dashboard/types";
import { EmptyChart } from "./EmptyChart";

type TrendMetric = "orders" | "valueK";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: ProcurementMonth }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    const row = payload[0].payload;
    return (
      <div className="bg-surface border border-border rounded-inner px-3 py-2.5 shadow-modal min-w-[164px]">
        <p className="type-caption font-semibold text-ink mb-1.5">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="type-caption text-ink-muted">Purchase orders</span>
            <span className="type-caption font-semibold tabular-nums text-ink">
              {row.orders.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="type-caption text-ink-muted">Order value</span>
            <span className="type-caption font-semibold tabular-nums text-ink">
              ₱{row.valueK.toLocaleString()}K
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function ProcurementTrendChart({
  data: procurementTrend,
  isRangeFiltered = false,
}: {
  data: ProcurementMonth[];
  isRangeFiltered?: boolean;
}) {
  const [metric, setMetric] = useState<TrendMetric>("orders");

  const totalOrders = procurementTrend.reduce((sum, m) => sum + m.orders, 0);
  const totalValueK =
    Math.round(procurementTrend.reduce((sum, m) => sum + m.valueK, 0) * 10) / 10;

  if (!procurementTrend.length || (totalOrders === 0 && totalValueK === 0)) {
    return (
      <EmptyChart
        title="Procurement Trend"
        subtitle={
          isRangeFiltered
            ? "Purchase orders in selected period"
            : "Purchase orders over the last 6 months"
        }
        message="No purchase orders recorded for this period."
      />
    );
  }

  const firstMonth = procurementTrend[0]?.month;
  const lastMonth = procurementTrend[procurementTrend.length - 1]?.month;
  const rangeText =
    firstMonth && lastMonth && firstMonth !== lastMonth
      ? `${firstMonth} – ${lastMonth}`
      : firstMonth || "selected period";

  const headline =
    metric === "orders"
      ? isRangeFiltered
        ? `${totalOrders.toLocaleString()} purchase ${totalOrders === 1 ? "order" : "orders"} in selected period.`
        : `${totalOrders.toLocaleString()} purchase orders placed over the last 6 months.`
      : `₱${totalValueK.toLocaleString()}K total order value across ${rangeText}.`;

  const footerCaption =
    metric === "orders"
      ? `Total order value of ₱${totalValueK.toLocaleString()}K across ${rangeText} · Hover any bar for ₱K breakdown.`
      : `${totalOrders.toLocaleString()} purchase orders across ${rangeText} · Hover any bar for order count.`;

  const lastIndex = procurementTrend.length - 1;

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-caption font-medium text-ink-muted">
            Procurement Trend
          </p>
          <h3 className="type-card-title text-ink mt-0.5 tracking-tight">
            {headline}
          </h3>
        </div>

        <div
          role="group"
          aria-label="Procurement chart metric"
          className="inline-flex items-center p-0.5 rounded-control border border-input bg-page shrink-0"
        >
          {(
            [
              { key: "orders", label: "Orders" },
              { key: "valueK", label: "Value (₱K)" },
            ] as const
          ).map((opt) => {
            const active = metric === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                aria-pressed={active}
                onClick={() => setMetric(opt.key)}
                className={`px-2.5 py-1 rounded-sm type-caption font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-primary text-on-brand"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[224px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={procurementTrend}
            margin={{ top: 24, right: 6, left: 6, bottom: 2 }}
            barCategoryGap="16%"
          >
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={(props) => {
                const { x, y, payload, index } = props;
                const isLatest = index === lastIndex;
                return (
                  <text
                    x={x}
                    y={Number(y) + 12}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={isLatest ? 600 : 400}
                    fill={isLatest ? "var(--brand-primary)" : "var(--ink-muted)"}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "var(--bg-subtle)", opacity: 0.45, radius: 8 }}
            />
            <Bar
              dataKey={metric}
              radius={[8, 8, 2, 2]}
              isAnimationActive={false}
            >
              {procurementTrend.map((entry, idx) => (
                <Cell
                  key={entry.month}
                  fill={
                    idx === lastIndex
                      ? "var(--brand-primary)"
                      : "var(--brand-focus)"
                  }
                  fillOpacity={idx === lastIndex ? 1 : 0.45}
                />
              ))}
              <LabelList
                dataKey={metric}
                position="top"
                offset={8}
                formatter={(val) => {
                  const n = Number(val ?? 0);
                  return metric === "valueK" ? `₱${n}K` : n.toLocaleString();
                }}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fill: "var(--ink-secondary)",
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="type-caption text-ink-muted">{footerCaption}</p>
    </div>
  );
}
