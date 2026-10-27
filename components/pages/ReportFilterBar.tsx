"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Calendar, Upload, RotateCcw } from "lucide-react";

interface ReportFilterBarProps {
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
  initialTab: string;
  allSuppliers: any[];
  selectedSupplierFilter: string;
  setSelectedSupplierFilter: (s: string) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onExportCSV: () => void;
}

export default function ReportFilterBar({
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
  initialTab,
  allSuppliers,
  selectedSupplierFilter,
  setSelectedSupplierFilter,
  onApplyFilters,
  onResetFilters,
  onExportCSV,
}: ReportFilterBarProps) {
  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
        {/* Filter Mode Selector & Supplier Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
            Filter By:
          </span>
          <div className="flex p-1 bg-muted rounded-xl border border-border text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === "all"
                  ? "bg-primary text-primary-foreground shadow-sm font-bold"
                  : "text-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              All History
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("specific")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === "specific"
                  ? "bg-primary text-primary-foreground shadow-sm font-bold"
                  : "text-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              Specific Date
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("range")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterMode === "range"
                  ? "bg-primary text-primary-foreground shadow-sm font-bold"
                  : "text-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              Date Range
            </button>
          </div>

          {/* Supplier Dropdown (Visible on Supplier Tab) */}
          {initialTab === "supplier" && allSuppliers.length > 0 && (
            <select
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
              className="h-10 min-w-[180px] rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Suppliers ({allSuppliers.length})</option>
              {allSuppliers.map((s: any, idx: number) => (
                <option key={idx} value={s.supplierName}>
                  {s.supplierName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Search Input & CSV Export Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:flex-none min-w-[180px]">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
            <Input
              type="text"
              placeholder="Search by ID, name, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <Button
            onClick={onExportCSV}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 h-[38px] text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
          >
            <Upload size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Conditional Date Pickers */}
      {filterMode === "specific" && (
        <div className="pt-3 border-t border-border flex items-center gap-3">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Calendar size={14} className="text-foreground" /> Select Specific Date:
          </label>
          <Input
            type="date"
            value={specificDate}
            onChange={(e) => setSpecificDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-xl bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            onClick={onApplyFilters}
            className="h-[34px] px-4 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Apply Date
          </Button>
        </div>
      )}

      {filterMode === "range" && (
        <div className="pt-3 border-t border-border flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar size={14} className="text-foreground" /> Start Date:
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-xl bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">End Date:</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-xl bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button
            onClick={onApplyFilters}
            className="h-[34px] px-4 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Apply Range
          </Button>
          {(startDate || endDate || specificDate || searchQuery) && (
            <Button
              onClick={onResetFilters}
              className="flex items-center gap-1 text-xs text-rose-600 hover:underline font-semibold"
            >
              <RotateCcw size={12} /> Reset Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
