"use client";

import { listLocations } from "@/app/actions/stock-transfer/locations";
import { actionResponse } from "@/lib/resources/action-response";


import React, { useState, useEffect } from "react";
import { Search, MapPin, Warehouse, Store, Building, CheckCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LocationData {
  locationId: number;
  locationName: string;
  locationType: string;
  status: string;
  address: string;
  isSystemLocation: boolean;
}

export function LocationsTab() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await actionResponse(listLocations());
      if (res.data?.success) {
        setLocations(res.data.data || []);
      }
    } catch (e) {
      console.error("Failed to load locations:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

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
        <div className="border border-border rounded-xl overflow-hidden bg-card flex-1">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/20">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by location name, branch, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-xs flex-1 text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLocations}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors h-10 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Type Filter Pills */}
      <div className="border-b border-border pb-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {locationTypes.map((t) => {
            const isSelected = typeFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
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
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-xs text-muted-foreground animate-pulse">
          Loading distribution locations...
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-xs text-muted-foreground">
          No distribution locations found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLocations.map((loc) => {
            const isCommissary = loc.isSystemLocation || loc.locationName.toLowerCase().includes("commissary");
            return (
              <div
                key={loc.locationId}
                className="rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-xs hover:border-foreground/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-muted/60 text-foreground">
                        {isCommissary ? (
                          <Warehouse className="w-4 h-4" />
                        ) : loc.locationType === "Branch" ? (
                          <Store className="w-4 h-4" />
                        ) : (
                          <Building className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-tight">
                          {loc.locationName}
                        </h4>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          ID: #{loc.locationId}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-border bg-muted/50 text-foreground">
                      {loc.locationType}
                    </span>
                  </div>

                  {loc.address && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-3">
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{loc.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3 text-[11px]">
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-foreground" />
                    {loc.status || "Active"}
                  </span>

                  {isCommissary && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-foreground/10 text-foreground">
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
