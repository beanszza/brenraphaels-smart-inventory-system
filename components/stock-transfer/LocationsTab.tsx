"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { TransferLocation } from "@/lib/stock-transfer/screen-data";
import { TransferSkeleton } from "./TransferSkeleton";
import { MapPin, Warehouse, Store, Building, CheckCircle, RefreshCw, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import { useIsAdmin } from "@/context/StaffContext";

export function LocationsTab({ locations, loading, onRefresh }: {
  locations: TransferLocation[]; loading: boolean; onRefresh: () => void;
}) {
  const isAdmin = useIsAdmin();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const locationTypes = ["All", "Branch", "Bazaar", "Warehouse", "Finished Goods", "Production"];

  const filteredLocations = locations.filter((loc) => {
    if (typeFilter !== "All" && loc.locationType !== typeFilter) {
      return false;
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      const matchName = loc.locationName.toLowerCase().includes(s);
      const matchType = loc.locationType.toLowerCase().includes(s);
      const matchAddr = loc.address?.toLowerCase().includes(s);
      return matchName || matchType || matchAddr;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Type Filter Sub-tabs */}
      <div className="overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {locationTypes.map((t) => {
            const isSelected = typeFilter === t;
            const count = t === "All"
              ? locations.length
              : locations.filter((loc) => loc.locationType === t).length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-status-purple-bg text-primary"
                    : "text-ink-muted hover:text-ink hover:bg-subtle"
                }`}
              >
                <span>{t}</span>
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Standalone Search & Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchInput
          containerClassName="flex-none w-full sm:w-[320px] h-[38px]"
          placeholder="Search location, branch, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-9 px-3.5 py-2 rounded-control gap-1.5 bg-surface border border-border type-button text-ink hover:bg-subtle shadow-none cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>

          {isAdmin && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 px-3.5 py-2 rounded-control gap-1.5 bg-surface border border-border type-button text-ink hover:bg-subtle shadow-none cursor-pointer shrink-0"
            >
              <Link href="/stock-transfer/logs">
                <History className="w-3.5 h-3.5" /> Transaction History
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Locations Grid */}
      {loading ? (
        <TransferSkeleton />
      ) : filteredLocations.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-12 text-center type-body text-ink-muted">
          No distribution locations found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLocations.map((loc) => {
            const isCommissary = loc.isSystemLocation || loc.locationName.toLowerCase().includes("factory");
            return (
              <div
                key={loc.locationId}
                className="rounded-card border border-border bg-surface p-5 space-y-3.5 transition-colors hover:border-divider-strong flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-control bg-subtle text-primary">
                        {isCommissary ? (
                          <Warehouse className="w-4 h-4" />
                        ) : loc.locationType === "Branch" ? (
                          <Store className="w-4 h-4" />
                        ) : (
                          <Building className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h4 className="type-card-title text-ink leading-tight">
                          {loc.locationName}
                        </h4>
                        <span className="type-caption text-ink-muted">
                          ID: #{loc.locationId}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-control type-caption font-medium border border-border bg-subtle text-ink">
                      {loc.locationType}
                    </span>
                  </div>

                  {loc.address && (
                    <div className="flex items-start gap-1.5 type-caption text-ink-muted mt-3">
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{loc.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-divider pt-3 type-caption">
                  <span className="inline-flex items-center gap-1 font-medium text-ink">
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    {loc.status || "Active"}
                  </span>

                  {isCommissary && (
                    <span className="px-2 py-0.5 rounded-full type-caption font-medium bg-status-purple-bg text-primary">
                      Central Hub
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
