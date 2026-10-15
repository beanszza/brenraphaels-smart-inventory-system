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
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Total Requests
          </span>
          <svg
            className="w-20 h-6 text-foreground"
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
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {metrics.totalRequests}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            All stock transfer requests submitted
          </p>
        </div>
      </div>

      {/* Card 2: Pending Approval */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Pending Approval
          </span>
          <svg
            className="w-20 h-6 text-muted-foreground/70"
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
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {metrics.pendingApproval}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Requests awaiting Admin review
          </p>
        </div>
      </div>

      {/* Card 3: Dispatched Transfers */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Dispatched Transfers
          </span>
          <svg
            className="w-20 h-6 text-foreground"
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
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {metrics.dispatchedTransfers}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Transfers en route or received at branches
          </p>
        </div>
      </div>
    </div>
  );
}
