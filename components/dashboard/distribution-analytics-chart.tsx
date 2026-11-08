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
      <div className="bg-card border border-border rounded-xl px-3.5 py-2.5 shadow-md min-w-[180px]">
        <p className="text-xs font-bold text-foreground mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: p.color }}
                />
                {p.name}
              </span>
              <span className="text-xs font-bold tabular-nums text-foreground">
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
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Distribution Analytics
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Transfers received and dispatched across branch locations
          </p>
        </div>
      </div>

      {/* Top receiver callout */}
      <div className="mb-5 p-4 rounded-xl border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <Badge variant="purple">Top Receiver</Badge>
          <h4 className="text-sm font-bold text-foreground mt-1.5 truncate">
            {topBranch.branch}
          </h4>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 min-w-[110px]">
            <div className="p-1.5 rounded-lg bg-muted text-foreground">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Received
              </p>
              <p className="text-sm font-bold tabular-nums text-foreground">
                {topBranch.received}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 min-w-[110px]">
            <div className="p-1.5 rounded-lg bg-muted text-foreground">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Transfers
              </p>
              <p className="text-sm font-bold tabular-nums text-foreground">
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
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="branch"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                fill: isDarkMode ? "#2a2236" : "#f7f5fa",
                opacity: 0.5,
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: "12px" }}
              formatter={(value) => (
                <span className="text-xs font-medium text-foreground pl-1">
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
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  fontWeight: 600,
                }}
                dx={6}
              />
            </Bar>
            <Bar
              dataKey="transfers"
              name="Transfers"
              fill="#16a34a"
              radius={[0, 4, 4, 0]}
            >
              <LabelList
                dataKey="transfers"
                position="right"
                style={{
                  fontSize: 11,
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
