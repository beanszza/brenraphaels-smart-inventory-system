"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { getMaxFutureDateString } from "@/lib/date-limits";
import { SearchInput } from "@/components/shared/SearchInput";
import { Button } from "@/components/ui/button";
import { Calendar, RotateCcw, Download } from "lucide-react";

interface AuditLogsFilterBarProps {
  filterMode: "all" | "specific" | "range";
  setFilterMode: (mode: "all" | "specific" | "range") => void;
  specificDate: string;
  setSpecificDate: (d: string) => void;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  entityOptions?: string[];
  entityFilter?: string;
  setEntityFilter?: (entity: string) => void;
  onResetFilters: () => void;
  onDownloadPdf: () => void;
  downloadingPdf?: boolean;
}

export default function AuditLogsFilterBar({
  filterMode,
  setFilterMode,
  specificDate,
  setSpecificDate,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  searchQuery,
  setSearchQuery,
  entityOptions,
  entityFilter,
  setEntityFilter,
  onResetFilters: _onResetFilters,
  onDownloadPdf,
  downloadingPdf = false,
}: AuditLogsFilterBarProps) {
  return (
    <div className="space-y-4">
      {/* 1. Entity Subtabs Row (standard module pill tabs styling) */}
      {entityOptions && entityOptions.length > 1 && setEntityFilter && (
        <div className="border-b border-border overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max pb-2">
            {entityOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setEntityFilter(opt)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  entityFilter === opt
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Search & Controls Toolbar Card */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <SearchInput
            containerClassName="flex-1 min-w-[240px]"
            placeholder="Search by ID, activity, items, staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Date Range Selector Segmented Pills */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border border-border text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === "all"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              All History
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("specific")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === "specific"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              Specific Date
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("range")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === "range"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              Date Range
            </button>
          </div>

          {/* Download Report Button (Generates Bren Raphael's Official PDF) */}
          <Button
            type="button"
            onClick={onDownloadPdf}
            disabled={downloadingPdf}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 h-10 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs whitespace-nowrap cursor-pointer shrink-0"
          >
            <Download size={14} />
            {downloadingPdf ? "Generating PDF..." : "Download Report (PDF)"}
          </Button>
        </div>

        {/* 3. Compact Date Picker Row (Appears neatly inline without stretching full width) */}
        {filterMode === "specific" && (
          <div className="pt-2.5 border-t border-border/50 flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-2xs">
              <Calendar size={14} className="text-muted-foreground shrink-0" />
              <span className="font-semibold text-muted-foreground shrink-0">Select Date:</span>
              <Input
                type="date"
                max={getMaxFutureDateString()}
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="h-7 w-36 border-0 p-0 text-xs bg-transparent focus-visible:ring-0 focus:outline-none"
              />
            </div>
            {specificDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSpecificDate("")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold h-8 px-2 cursor-pointer"
              >
                <RotateCcw size={12} /> Clear Date
              </Button>
            )}
          </div>
        )}

        {filterMode === "range" && (
          <div className="pt-2.5 border-t border-border/50 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-2xs">
              <Calendar size={14} className="text-muted-foreground shrink-0" />
              <span className="font-semibold text-muted-foreground shrink-0">Start Date:</span>
              <Input
                type="date"
                max={getMaxFutureDateString()}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-7 w-36 border-0 p-0 text-xs bg-transparent focus-visible:ring-0 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-2xs">
              <Calendar size={14} className="text-muted-foreground shrink-0" />
              <span className="font-semibold text-muted-foreground shrink-0">End Date:</span>
              <Input
                type="date"
                max={getMaxFutureDateString()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-7 w-36 border-0 p-0 text-xs bg-transparent focus-visible:ring-0 focus:outline-none"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold h-8 px-2 cursor-pointer"
              >
                <RotateCcw size={12} /> Clear Range
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
