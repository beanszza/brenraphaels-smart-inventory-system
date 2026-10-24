"use client";
import { useRouter } from "next/navigation";
import { ReceivingSkeleton } from "./ReceivingSkeleton";



import React, { useState, useMemo, useTransition } from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DiscrepancyTable from "./DiscrepancyTable";
import DiscrepancyDetailsModal from "./DiscrepancyDetailsModal";
import Pagination from "@/components/Pagination";
import { Discrepancy } from "./types";

type DiscrepancySubTab = "short" | "rejected" | "over";

export default function DiscrepancyTab({ initialDiscrepancies }: { initialDiscrepancies: Discrepancy[] }) {
  const router = useRouter();
  const discrepancies = initialDiscrepancies;
  const [loading, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [activeSubTab, setActiveSubTab] = useState<DiscrepancySubTab>("short");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchDiscrepancies = () => startRefresh(() => router.refresh());

  // Counts for each subtab
  const counts = useMemo(() => {
    let shortCount = 0;
    let rejectedCount = 0;
    let overCount = 0;

    discrepancies.forEach((d) => {
      const t = d.discrepancyType;
      if (t === "PartialShort" || t === "Short") shortCount++;
      else if (t === "Rejected") rejectedCount++;
      else if (t === "OverSupply" || t === "Over") overCount++;
    });

    return {
      short: shortCount,
      rejected: rejectedCount,
      over: overCount,
      all: discrepancies.length,
    };
  }, [discrepancies]);

  // Unique Suppliers
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    discrepancies.forEach((d) => {
      if (d.supplierName) set.add(d.supplierName);
    });
    return Array.from(set).sort();
  }, [discrepancies]);

  // Filtered list
  const filteredDiscrepancies = useMemo(() => {
    return discrepancies.filter((d) => {
      const t = d.discrepancyType;
      if (activeSubTab === "short" && t !== "PartialShort" && t !== "Short") return false;
      if (activeSubTab === "rejected" && t !== "Rejected") return false;
      if (activeSubTab === "over" && t !== "OverSupply" && t !== "Over") return false;

      // Supplier filter
      if (supplierFilter !== "All" && d.supplierName !== supplierFilter) return false;

      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          d.discrepancyNumber?.toLowerCase().includes(s) ||
          d.grnNumber?.toLowerCase().includes(s) ||
          d.poNumber?.toLowerCase().includes(s) ||
          d.prNumber?.toLowerCase().includes(s) ||
          d.supplierName?.toLowerCase().includes(s) ||
          d.itemName?.toLowerCase().includes(s) ||
          d.resolutionType?.toLowerCase().includes(s) ||
          d.lossReportNumber?.toLowerCase().includes(s) ||
          d.rtvNumber?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [discrepancies, activeSubTab, search, supplierFilter]);

  const totalCount = filteredDiscrepancies.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDiscrepancies.slice(start, start + pageSize);
  }, [filteredDiscrepancies, page, pageSize]);

  const handleSelect = (item: Discrepancy) => {
    setSelectedDiscrepancy(item);
    setModalOpen(true);
  };

  const tabs = [
    { id: "short" as DiscrepancySubTab, label: "Partial / Short", count: counts.short },
    { id: "rejected" as DiscrepancySubTab, label: "Rejected", count: counts.rejected },
    { id: "over" as DiscrepancySubTab, label: "Over Supply", count: counts.over },
  ];

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Subtab Pill Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => {
            const isActive = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveSubTab(t.id);
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? "bg-background text-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchDiscrepancies}
            disabled={loading}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center border border-border rounded-md bg-card px-2 py-2">
        <div className="flex flex-1 items-center gap-2 px-2 bg-muted/20 h-full rounded-md">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            aria-label="Search records"
            type="text"
            placeholder="Search by discrepancy, Goods Receipt Note, Purchase Order, item, or supplier..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-xs flex-1 text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="text-xs text-muted-foreground hover:text-foreground font-medium pr-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <Select
              value={supplierFilter}
              onValueChange={(val) => {
                setSupplierFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by supplier" className="h-10 w-[180px] rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent align="end" className="text-xs z-[9999]">
                <SelectItem value="All">All Suppliers</SelectItem>
                {uniqueSuppliers.map((supp) => (
                  <SelectItem key={supp} value={supp}>
                    {supp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <DiscrepancyTable
        discrepancies={paginatedList}
        loading={loading}
        onSelectDiscrepancy={handleSelect}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-border">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Details / Resolution Modal */}
      <DiscrepancyDetailsModal
        discrepancy={selectedDiscrepancy}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onResolved={() => {
          fetchDiscrepancies();
        }}
      />
    </div>
  );
}
