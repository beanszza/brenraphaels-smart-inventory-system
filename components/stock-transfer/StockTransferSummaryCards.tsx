"use client";

import React from "react";
import { DashboardMetrics } from "./types";

interface StockTransferSummaryCardsProps {
  metrics: DashboardMetrics;
}

export default function StockTransferSummaryCards({
  metrics,
}: StockTransferSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Total Requests */}
      <div className="rounded-panel border border-divider bg-surface p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="type-overline font-semibold uppercase text-text-muted">
            Total Requests
          </span>
          <svg
            className="w-20 h-6 text-text-primary"
            viewBox="0 0 80 24"
            fill="none"
          >
            <path
              d="M 2 18 C 14 22, 24 8, 38 14 C 52 20, 62 4, 76 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="76" cy="6" r="2.5" fill="currentColor" />
          </svg>
        </div>

        <div className="mt-4">
          <div className="type-kpi font-semibold text-text-primary">
            {metrics.totalRequests}
          </div>
          <p className="type-caption text-text-muted mt-1">
            All stock transfer requests submitted
          </p>
        </div>
      </div>

      {/* Card 2: Pending Approval */}
      <div className="rounded-panel border border-divider bg-surface p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="type-overline font-semibold uppercase text-text-muted">
            Pending Approval
          </span>
          <svg
            className="w-20 h-6 text-text-muted/70"
            viewBox="0 0 80 24"
            fill="none"
          >
            <path
              d="M 2 16 C 14 18, 26 8, 40 14 C 54 18, 64 6, 76 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="76" cy="6" r="2.5" fill="currentColor" />
          </svg>
        </div>

        <div className="mt-4">
          <div className="type-kpi font-semibold text-text-primary">
            {metrics.pendingApproval}
          </div>
          <p className="type-caption text-text-muted mt-1">
            Requests awaiting Admin review
          </p>
        </div>
      </div>

      {/* Card 3: Dispatched Transfers */}
      <div className="rounded-panel border border-divider bg-surface p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="type-overline font-semibold uppercase text-text-muted">
            Dispatched Transfers
          </span>
          <svg
            className="w-20 h-6 text-text-primary"
            viewBox="0 0 80 24"
            fill="none"
          >
            <path
              d="M 2 12 C 16 16, 28 6, 44 10 C 60 14, 68 8, 76 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="76" cy="4" r="2.5" fill="currentColor" />
          </svg>
        </div>

        <div className="mt-4">
          <div className="type-kpi font-semibold text-text-primary">
            {metrics.dispatchedTransfers}
          </div>
          <p className="type-caption text-text-muted mt-1">
            Transfers en route or received at branches
          </p>
        </div>
      </div>
    </div>
  );
}
