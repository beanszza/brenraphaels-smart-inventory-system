"use client";

import type { BranchFlow } from "@/lib/dashboard/types";
import { EmptyChart } from "./EmptyChart";

export default function DistributionAnalyticsChart({
  data,
}: {
  data: BranchFlow[];
}) {
  const sorted = [...data].sort(
    (a, b) => b.received - a.received || b.transfers - a.transfers,
  );

  const topBranch = sorted[0];
  if (!topBranch) {
    return (
      <EmptyChart
        title="Distribution Analytics"
        subtitle="Stock transfers sent and received by destination location"
      />
    );
  }

  const maxTransfers = Math.max(1, ...sorted.map((b) => Math.max(b.transfers, b.received)));
  const totalTransfers = sorted.reduce((sum, b) => sum + b.transfers, 0);
  const totalReceived = sorted.reduce((sum, b) => sum + b.received, 0);

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full gap-4">
      <div>
        <p className="type-caption font-medium text-ink-muted">
          Distribution Analytics
        </p>
        <h3 className="type-card-title text-ink mt-0.5 tracking-tight">
          {topBranch.branch} received the most transfers.
        </h3>
      </div>

      <div className="space-y-3 flex-1">
        {sorted.map((branch) => {
          const barPct = Math.max(
            branch.received > 0 ? 4 : 0,
            Math.round((branch.received / maxTransfers) * 100),
          );
          return (
            <div key={branch.branch} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="type-body-secondary font-medium text-ink truncate"
                  title={branch.branch}
                >
                  {branch.branch}
                </span>
                <span className="type-caption font-semibold tabular-nums text-ink shrink-0">
                  {branch.received.toLocaleString()}{" "}
                  <span className="font-normal text-ink-muted">
                    / {branch.transfers.toLocaleString()} transfers
                  </span>
                </span>
              </div>
              <div className="h-2 w-full rounded-pill bg-status-gray-bg overflow-hidden">
                <div
                  className="h-full rounded-pill bg-primary transition-all duration-300"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="type-caption text-ink-muted">
        {totalReceived.toLocaleString()} received out of{" "}
        {totalTransfers.toLocaleString()} total transfers across {sorted.length}{" "}
        {sorted.length === 1 ? "location" : "locations"}.
      </p>
    </div>
  );
}
