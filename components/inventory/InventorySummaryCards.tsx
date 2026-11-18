"use client";

import React from "react";

interface InventorySummaryCardsProps {
  totalItems: number;
  lowStockCount: number;
  expiringSoonCount: number;
  categoryCounts?: Record<string, number>;
}

export default function InventorySummaryCards({
  totalItems,
  lowStockCount,
  expiringSoonCount,
}: InventorySummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Total Inventory */}
      <div className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="type-nav-group text-ink-muted uppercase">
            Total Inventory
          </span>
          <svg
            className="w-20 h-6 text-ink"
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
          <div className="type-stat-value text-ink tabular-nums">
            {totalItems}
          </div>
          <p className="type-caption text-ink-muted mt-1">
            Active items across all categories
          </p>
        </div>
      </div>

      {/* Card 2: Low Stock */}
      <div className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="type-nav-group text-ink-muted uppercase">
            Low Stock
          </span>
          <svg
            className="w-20 h-6 text-ink-muted"
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
          <div className="type-stat-value text-ink tabular-nums">
            {lowStockCount}
          </div>
          <p className="type-caption text-ink-muted mt-1">
            Items below minimum reorder point
          </p>
        </div>
      </div>

      {/* Card 3: Expiring Soon */}
      <div className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="type-nav-group text-ink-muted uppercase">
            Expiring Soon
          </span>
          <svg
            className="w-20 h-6 text-ink-muted"
            viewBox="0 0 80 24"
            fill="none"
          >
            <path
              d="M 2 18 C 16 20, 28 10, 42 16 C 56 20, 66 8, 76 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="76" cy="8" r="2.5" fill="currentColor" />
          </svg>
        </div>

        <div className="mt-4">
          <div className="type-stat-value text-ink tabular-nums">
            {expiringSoonCount}
          </div>
          <p className="type-caption text-ink-muted mt-1">
            Available lots expiring within 30 days
          </p>
        </div>
      </div>
    </div>
  );
}
