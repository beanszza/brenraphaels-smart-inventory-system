"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React, { useState, useMemo, useTransition } from "react";
import { MoreHorizontal, Eye, RefreshCw, Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import Pagination from "@/components/Pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";
import { StockIn } from "./types";

const CreateStockInModal = dynamic(() => import("./CreateStockInModal"), { ssr: false });
const StockInDetailsModal = dynamic(() => import("./StockInDetailsModal"), { ssr: false });

export default function StockInTab({ initialStockIns }: { initialStockIns: StockIn[] }) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);
  const stockIns = initialStockIns;
  const [loading, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
            className="flex items-center gap-2 px-3 py-1.5 rounded-control type-caption font-semibold transition-all cursor-pointer bg-button-primary text-text-inverse shadow-card"
          >
            <span>Committed</span>
            <span className="px-1.5 py-0.5 rounded-pill type-caption font-medium bg-surface text-text-primary">
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
            className="h-10 px-4 type-body font-semibold rounded-control border border-divider bg-surface hover:bg-surface-secondary text-text-primary flex items-center gap-2 cursor-pointer shadow-card"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          {isAdmin && (
            <Button
              asChild
              variant="outline"
              className="h-10 px-4 type-body font-semibold rounded-control border border-divider bg-surface hover:bg-surface-secondary text-text-primary flex items-center gap-2 cursor-pointer shadow-card"
            >
              <Link href="/goods-receiving/logs">
                <History className="w-4 h-4" />
                Transaction History
              </Link>
            </Button>
          )}
          <Button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="h-10 px-5 type-body font-semibold rounded-control bg-button-primary text-text-inverse hover:bg-button-primary/85 flex items-center gap-2 cursor-pointer shadow-card"
          >
            <Plus className="w-4 h-4" />
            Create Stock-In
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center rounded-card border border-divider bg-surface p-3">
        <SearchInput
          aria-label="Search records"
          containerClassName="flex-1"
          placeholder="Search by Stock-In number, Goods Receipt Note, or supplier..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

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

      {/* Table Section */}
      {loading ? (
        <ReceivingSkeleton />
      ) : (
        <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
          <table className="w-full border-collapse">
            <thead className="border-b border-divider bg-surface-secondary">
              <tr className="table-head-row text-left whitespace-nowrap">
                <th className="sticky left-0 z-20 bg-surface-secondary table-th px-4 py-3 min-w-[150px] w-40 whitespace-nowrap border-r border-divider shadow-sticky">Stock-In No.</th>
                <th className="table-th px-4 py-3 whitespace-nowrap">Goods Receipt Note No.</th>
                <th className="table-th px-4 py-3">Supplier</th>
                <th className="table-th px-4 py-3">Date</th>
                <th className="table-th px-4 py-3 text-center">Items</th>
                <th className="table-th px-4 py-3 text-center">Status</th>
                <th className="table-th w-16 px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center type-body text-text-muted">
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
                    className="table-row group hover:bg-surface-secondary/50 transition-colors cursor-pointer"
                  >
                    <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface-secondary/50 px-4 py-3 table-td font-semibold text-text-primary whitespace-nowrap min-w-[150px] w-40 border-r border-divider shadow-sticky transition-colors">
                      {s.stockInNumber}
                    </td>
                    <td className="px-4 py-3 table-td text-text-muted whitespace-nowrap">
                      {s.grnNumber}
                    </td>
                    <td className="px-4 py-3 table-td font-medium text-text-primary max-w-[200px] truncate" title={s.supplierName}>
                      {s.supplierName}
                    </td>
                    <td className="px-4 py-3 table-td text-text-muted whitespace-nowrap">
                      {new Date(s.committedAt || s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 table-td text-center font-semibold text-text-primary whitespace-nowrap">
                      {s.lines.length}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <StatusBadge status={s.status} />
                    </td>
                    <td
                      className="w-16 px-4 py-3 text-center relative whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Record actions"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-control text-text-primary hover:bg-surface-secondary transition-colors focus:outline-none cursor-pointer"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                          className="w-40 rounded-control border border-divider bg-surface shadow-modal py-1.5 text-left"
                        >
                          <DropdownMenuItem
                            onSelect={() => {
                              setSelectedStockIn(s);
                              setDetailsModalOpen(true);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary cursor-pointer"
                          >
                            <Eye size={14} className="shrink-0" /> View &amp; QR Tags
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="p-4 border-t border-divider">
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
