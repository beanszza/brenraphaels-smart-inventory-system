"use client";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React, { useState, useMemo, useTransition } from "react";
import { Search, MoreHorizontal, Eye, RefreshCw, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import Pagination from "@/components/Pagination";
import { StockIn } from "./types";

const CreateStockInModal = dynamic(() => import("./CreateStockInModal"), { ssr: false });
const StockInDetailsModal = dynamic(() => import("./StockInDetailsModal"), { ssr: false });

export default function StockInTab({ initialStockIns }: { initialStockIns: StockIn[] }) {
  const router = useRouter();
  const stockIns = initialStockIns;
  const [loading, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Action menu
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedStockIn, setSelectedStockIn] = useState<StockIn | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const fetchStockIns = () => startRefresh(() => router.refresh());

  // Active/Committed Stock-Ins (excluding rejected/cancelled records)
  const committedStockIns = useMemo(() => {
    return stockIns.filter((s) => s.status !== "Rejected" && s.status !== "Cancelled");
  }, [stockIns]);

  // Unique Suppliers
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    committedStockIns.forEach((s) => {
      if (s.supplierName) set.add(s.supplierName);
    });
    return Array.from(set).sort();
  }, [committedStockIns]);

  // Search & Supplier Filter
  const searchFiltered = useMemo(() => {
    let filtered = committedStockIns;

    if (supplierFilter !== "All") {
      filtered = filtered.filter((s) => s.supplierName === supplierFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((s) => {
        return (
          s.stockInNumber?.toLowerCase().includes(q) ||
          s.grnNumber?.toLowerCase().includes(q) ||
          s.supplierName?.toLowerCase().includes(q) ||
          s.createdBy?.toLowerCase().includes(q) ||
          s.committedBy?.toLowerCase().includes(q)
        );
      });
    }

    return filtered;
  }, [committedStockIns, search, supplierFilter]);

  // Pagination
  const totalCount = searchFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return searchFiltered.slice(start, start + pageSize);
  }, [searchFiltered, page, pageSize]);

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Committed Sub-Tab Pill */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage(1)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer bg-primary text-primary-foreground shadow-sm"
          >
            <span>Committed</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium bg-background text-foreground">
              {committedStockIns.length}
            </span>
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchStockIns}
            disabled={loading}
            className="h-10 px-4 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="h-10 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/85 flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Stock-In
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
            placeholder="Search by Stock-In number, Goods Receipt Note, or supplier..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-xs flex-1 text-foreground placeholder:text-muted-foreground"
          />
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

      {/* Table Section */}
      {loading ? (
        <ReceivingSkeleton />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-visible">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Stock-In No.</th>
                <th className="px-4 py-3">Goods Receipt Note No.</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-3 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No committed stock-in records found
                  </td>
                </tr>
              ) : (
                paginatedList.map((s) => (
                  <tr
                    key={s.stockInId}
                    onClick={() => {
                      setSelectedStockIn(s);
                      setDetailsModalOpen(true);
                    }}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-foreground whitespace-nowrap">
                      {s.stockInNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                      {s.grnNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate" title={s.supplierName}>
                      {s.supplierName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(s.committedAt || s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-foreground">
                      {s.lines.length}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-center relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === s.stockInId ? null : s.stockInId);
                        }}
                        className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {activeMenuId === s.stockInId && (
                        <div className="absolute right-6 top-2 z-[100] w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStockIn(s);
                              setDetailsModalOpen(true);
                              setActiveMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                          >
                            <Eye size={14} className="shrink-0" /> View &amp; QR Tags
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="p-4 border-t border-border">
              <Pagination currentPage={page} totalPages={totalPages} totalCount={totalCount} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {createModalOpen && (
        <CreateStockInModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            fetchStockIns();
            setPage(1);
          }}
        />
      )}

      {detailsModalOpen && selectedStockIn && (
        <StockInDetailsModal
          stockIn={selectedStockIn}
          open={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          onSuccess={() => {
            fetchStockIns();
          }}
        />
      )}
    </div>
  );
}
