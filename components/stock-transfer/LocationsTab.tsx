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
    <div className="space-y-5">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput
          containerClassName="flex-1"
          placeholder="Search by location name, branch, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="type-input"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-button font-semibold text-text-primary hover:bg-surface-hover transition-colors h-10 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>

        {isAdmin && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex items-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-button font-semibold text-text-primary hover:bg-surface-hover transition-colors h-10 shrink-0"
          >
            <Link href="/stock-transfer/logs">
              <History className="w-3.5 h-3.5" /> Transaction History
            </Link>
          </Button>
        )}
      </div>

      {/* Type Filter Pills */}
      <div className="border-b border-divider pb-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {locationTypes.map((t) => {
            const isSelected = typeFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 rounded-control type-caption font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-surface-hover text-text-muted hover:text-text-primary hover:bg-surface-hover"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Locations Grid */}
      {loading ? (
        <TransferSkeleton />
      ) : filteredLocations.length === 0 ? (
        <div className="rounded-panel border border-divider bg-surface p-12 text-center type-body text-text-muted">
          No distribution locations found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLocations.map((loc) => {
            const isCommissary = loc.isSystemLocation || loc.locationName.toLowerCase().includes("factory");
            return (
              <div
                key={loc.locationId}
                className="rounded-panel border border-divider bg-surface p-5 space-y-3.5 shadow-xs hover:border-divider-strong transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-control bg-surface-hover text-text-primary">
                        {isCommissary ? (
                          <Warehouse className="w-4 h-4" />
                        ) : loc.locationType === "Branch" ? (
                          <Store className="w-4 h-4" />
                        ) : (
                          <Building className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h4 className="type-card-title text-text-primary leading-tight">
                          {loc.locationName}
                        </h4>
                        <span className="type-overline font-semibold text-text-muted uppercase tracking-wider">
                          ID: #{loc.locationId}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-control type-caption font-semibold border border-divider bg-surface-hover text-text-primary">
                      {loc.locationType}
                    </span>
                  </div>

                  {loc.address && (
                    <div className="flex items-start gap-1.5 type-caption text-text-muted mt-3">
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{loc.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-divider pt-3 type-caption">
                  <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
                    <CheckCircle className="w-3.5 h-3.5 text-text-primary" />
                    {loc.status || "Active"}
                  </span>

                  {isCommissary && (
                    <span className="px-2 py-0.5 rounded-full type-caption font-semibold bg-surface-hover text-text-primary border border-divider">
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
