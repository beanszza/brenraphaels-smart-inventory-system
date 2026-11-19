"use client";

import { useSyncExternalStore } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Package, ArrowRightLeft } from "lucide-react";
import type { BranchFlow } from "@/lib/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { EmptyChart } from "./EmptyChart";

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
      <div className="bg-surface border border-border rounded-inner px-3.5 py-2.5 shadow-modal min-w-[180px]">
        <p className="type-caption font-semibold text-ink mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 type-caption text-ink-muted">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: p.color }}
                />
                {p.name}
              </span>
              <span className="type-caption font-semibold tabular-nums text-ink">
                {p.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

/** Follows the html "dark" class so chart colours match the active theme. */
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");

export default function DistributionAnalyticsChart({ data }: { data: BranchFlow[] }) {
  const sorted = [...data].sort((a, b) => b.received - a.received || b.transfers - a.transfers);
  const isDarkMode = useSyncExternalStore(subscribeToTheme, isDark, () => false);

  const topBranch = sorted[0];
  if (!topBranch) {
    return (
      <EmptyChart
        title="Distribution Analytics"
        subtitle="Stock transfers sent and received by destination location"
      />
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="type-card-title text-ink">
            Distribution Analytics
          </h3>
          <p className="type-caption text-ink-muted mt-0.5">
            Transfers received and dispatched across branch locations
          </p>
        </div>
      </div>

      {/* Top receiver callout */}
      <div className="mb-5 p-4 rounded-inner border border-border bg-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <Badge variant="purple">Top Receiver</Badge>
          <h4 className="type-body font-semibold text-ink mt-1.5 truncate">
            {topBranch.branch}
          </h4>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-inner border border-border bg-surface px-3 py-2 min-w-[110px]">
            <div className="p-1.5 rounded-sm bg-subtle text-ink">
              <Package className="size-4" />
            </div>
            <div>
              <p className="type-nav-group text-ink-muted">
                Received
              </p>
              <p className="type-body font-semibold tabular-nums text-ink">
                {topBranch.received}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-inner border border-border bg-surface px-3 py-2 min-w-[110px]">
            <div className="p-1.5 rounded-sm bg-subtle text-ink">
              <ArrowRightLeft className="size-4" />
            </div>
            <div>
              <p className="type-nav-group text-ink-muted">
                Transfers
              </p>
              <p className="type-body font-semibold tabular-nums text-ink">
                {topBranch.transfers}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 0, right: 36, left: 8, bottom: 0 }}
            barCategoryGap="28%"
            barGap={3}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              horizontal={false}
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="branch"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                fill: isDarkMode ? "var(--color-surface)" : "var(--color-page)",
                opacity: 0.5,
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: "12px" }}
              formatter={(value) => (
                <span className="type-caption font-medium text-ink pl-1">
                  {value}
                </span>
              )}
            />
            <Bar
              dataKey="received"
              name="Received"
              fill="var(--primary)"
              radius={[0, 4, 4, 0]}
            >
              <LabelList
                dataKey="received"
                position="right"
                style={{
                  fontSize: 12,
                  fill: "var(--muted-foreground)",
                  fontWeight: 600,
                }}
                dx={6}
              />
            </Bar>
            <Bar
              dataKey="transfers"
              name="Transfers"
              fill="var(--color-success)"
              radius={[0, 4, 4, 0]}
            >
              <LabelList
                dataKey="transfers"
                position="right"
                style={{
                  fontSize: 12,
                  fill: "var(--muted-foreground)",
                  fontWeight: 600,
                }}
                dx={6}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
