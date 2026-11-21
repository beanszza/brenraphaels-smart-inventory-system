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
    <div className="space-y-5 animate-page-in">
      {/* Top action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Committed Sub-Tab Pill */}
        <div className="overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            <button
              type="button"
              onClick={() => setPage(1)}
              aria-pressed={true}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap bg-status-purple-bg text-primary"
            >
              <span>Committed</span>
              <span className="tabular-nums">{committedStockIns.length}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchStockIns}
            disabled={loading}
            className="h-9 px-3.5 py-2 type-label-button rounded-control border border-border bg-surface hover:bg-subtle text-ink flex items-center gap-1.5 cursor-pointer shadow-none"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          {isAdmin && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 px-3.5 py-2 type-label-button rounded-control border border-border bg-surface hover:bg-subtle text-ink flex items-center gap-1.5 cursor-pointer shadow-none"
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
            className="h-9 px-3.5 py-2 type-label-button rounded-control bg-primary text-on-brand hover:bg-primary-hover flex items-center gap-1.5 cursor-pointer shadow-none"
          >
            <Plus className="w-4 h-4" />
            Create Stock-In
          </Button>
        </div>
      </div>

      {/* Standalone Filters & Search Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={supplierFilter}
          onValueChange={(val) => {
            setSupplierFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter by supplier" className="h-[38px] w-full sm:w-auto sm:min-w-[230px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
            <span className="truncate">
              <span className="text-ink-muted font-normal mr-1.5">Supplier:</span>
              <span className="font-medium text-ink">
                <SelectValue placeholder="All Suppliers" />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            sideOffset={4}
            avoidCollisions={false}
            className="min-w-[230px] max-h-72"
          >
            <SelectItem value="All">All Suppliers</SelectItem>
            {uniqueSuppliers.map((supp) => (
              <SelectItem key={supp} value={supp}>
                {supp}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchInput
          aria-label="Search records"
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search stock-in, GRN, or supplier..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Padded Table Card */}
      {loading ? (
        <ReceivingSkeleton />
      ) : (
        <div className="rounded-card border border-border bg-surface p-5">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-divider">
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[150px]">Stock-In No.</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Goods Receipt Note No.</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Supplier</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Date</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-center whitespace-nowrap">Items</th>
                  <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
                  <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center type-body text-ink-muted">
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
                      className="group hover:bg-page transition-colors cursor-pointer"
                    >
                      <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[150px]">
                        {s.stockInNumber}
                      </td>
                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap tabular-nums">
                        {s.grnNumber}
                      </td>
                      <td className="py-3 pr-4 type-body text-ink max-w-[200px] truncate" title={s.supplierName}>
                        {s.supplierName}
                      </td>
                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                        {new Date(s.committedAt || s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 type-body text-ink text-center whitespace-nowrap tabular-nums">
                        {s.lines.length}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <StatusBadge status={s.status} />
                      </td>
                      <td
                        className="w-16 py-3 pl-4 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Record actions"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                            className="w-44"
                          >
                            <DropdownMenuItem
                              onSelect={() => {
                                setSelectedStockIn(s);
                                setDetailsModalOpen(true);
                              }}
                              className="cursor-pointer type-body-secondary"
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
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
            embedded
          />
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
