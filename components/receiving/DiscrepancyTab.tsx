"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceivingSkeleton } from "./ReceivingSkeleton";
import { History } from "lucide-react";
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";

import React, { useState, useMemo, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import DiscrepancyTable from "./DiscrepancyTable";
import DiscrepancyDetailsModal from "./DiscrepancyDetailsModal";
import Pagination from "@/components/Pagination";
import { Discrepancy } from "./types";

type DiscrepancySubTab = "short" | "rejected" | "over";

export default function DiscrepancyTab({ initialDiscrepancies }: { initialDiscrepancies: Discrepancy[] }) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);
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
        <div className="flex flex-wrap items-center gap-1.5">
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-control type-caption font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-button-primary text-text-inverse shadow-card"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-secondary/50"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-pill type-caption font-medium ${
                    isActive ? "bg-surface text-text-primary" : "bg-surface-secondary text-text-muted"
                  }`}
                >
                  {t.count}
                </span>
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
            className="h-10 rounded-control border border-divider bg-surface px-4 py-2 type-body font-semibold text-text-primary hover:bg-surface-secondary cursor-pointer"
          >
            Refresh
          </Button>
          {isAdmin && (
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-control border border-divider bg-surface px-4 py-2 type-body font-semibold text-text-primary hover:bg-surface-secondary cursor-pointer"
            >
              <Link href="/goods-receiving/logs">
                <History className="w-4 h-4 mr-1.5" />
                Transaction History
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center rounded-card border border-divider bg-surface p-3">
        <div className="flex flex-1 items-center gap-2">
          <SearchInput
            aria-label="Search records"
            containerClassName="flex-1"
            placeholder="Search by discrepancy, Goods Receipt Note, Purchase Order, item, or supplier..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="type-caption text-text-muted hover:text-text-primary font-medium px-2"
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
              <SelectTrigger aria-label="Filter by supplier" className="h-10 w-[180px] rounded-control border border-divider bg-surface px-3 type-body font-medium text-text-primary shadow-card focus:border-border-focus">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent align="end" className="type-caption z-[9999]">
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
        <div className="p-4 border-t border-divider">
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
