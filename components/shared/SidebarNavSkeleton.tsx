"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface SidebarNavSkeletonProps {
  /** Number of top-level nav rows to render as placeholders. */
  rows?: number;
}

/**
 * Loading placeholder for the sidebar nav tabs.
 *
 * Rendered until the client has mounted, so the nav fades in as a set of shimmering rows instead of
 * popping in item-by-item.
 */
export function SidebarNavSkeleton({ rows = 7 }: SidebarNavSkeletonProps) {
  return (
    <div
      className="animate-in fade-in duration-300"
      role="status"
      aria-label="Loading navigation"
      data-testid="sidebar-nav-skeleton"
    >
      {/* Dashboard placeholder */}
      <div className="flex items-center gap-3 px-2.5 py-2">
        <Skeleton className="size-4.5 rounded-control" />
        <Skeleton className="h-4 w-24 rounded-control" />
      </div>

      {/* Nav group placeholders */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2.5 py-2 mt-1">
          <Skeleton className="size-4.5 rounded-control" />
          <Skeleton className="h-4 flex-1 rounded-control" style={{ maxWidth: `${60 + ((i * 17) % 40)}%` }} />
          <Skeleton className="size-4 rounded-control" />
        </div>
      ))}

      <span className="sr-only">Loading navigation&#x2026;</span>
    </div>
  );
}
