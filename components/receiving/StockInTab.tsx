"use client";
import { useRouter } from "next/navigation";
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
import CreateStockInModal from "./CreateStockInModal";
import StockInDetailsModal from "./StockInDetailsModal";

type SubTab = "pending" | "approved" | "committed" | "draft" | "rejected";

export default function StockInTab({ initialStockIns }: { initialStockIns: StockIn[] }) {
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("pending");
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

  // SubTab counts
  const counts = useMemo(() => {
    return {
      draft: stockIns.filter((s) => s.status === "Draft").length,
      pending: stockIns.filter((s) => s.status === "PendingApproval" || s.status === "Pending").length,
      approved: stockIns.filter((s) => s.status === "Approved").length,
      committed: stockIns.filter((s) => s.status === "Committed").length,
      rejected: stockIns.filter((s) => s.status === "Rejected").length,
    };
  }, [stockIns]);

  // Filter by SubTab
  const tabFiltered = useMemo(() => {
    return stockIns.filter((s) => {
      if (activeSubTab === "draft") return s.status === "Draft";
      if (activeSubTab === "pending") return s.status === "PendingApproval" || s.status === "Pending";
      if (activeSubTab === "approved") return s.status === "Approved";
      if (activeSubTab === "committed") return s.status === "Committed";
      if (activeSubTab === "rejected") return s.status === "Rejected";
      return true;
    });
  }, [stockIns, activeSubTab]);

  // Unique Suppliers
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    stockIns.forEach((s) => {
      if (s.supplierName) set.add(s.supplierName);
    });
    return Array.from(set).sort();
  }, [stockIns]);

  // Search & Supplier Filter
  const searchFiltered = useMemo(() => {
    let filtered = tabFiltered;

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
          s.approvedBy?.toLowerCase().includes(q) ||
          s.committedBy?.toLowerCase().includes(q)
        );
      });
    }

    return filtered;
  }, [tabFiltered, search, supplierFilter]);

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
        {/* Sub-Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab("pending");
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeSubTab === "pending"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Pending Approval</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeSubTab === "pending"
                  ? "bg-background text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("approved");
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeSubTab === "approved"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Approved</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeSubTab === "approved"
                  ? "bg-background text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {counts.approved}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("committed");
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeSubTab === "committed"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Committed</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeSubTab === "committed"
                  ? "bg-background text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {counts.committed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("draft");
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeSubTab === "draft"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Drafts</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeSubTab === "draft"
                  ? "bg-background text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {counts.draft}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("rejected");
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeSubTab === "rejected"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Rejected</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeSubTab === "rejected"
                  ? "bg-background text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {counts.rejected}
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
            <RefreshCw className={`w-3.5 h-3.5 `} />
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
                    No records found
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
                      {new Date(s.createdAt).toLocaleDateString()}
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
                        onClick={() => setActiveMenuId(activeMenuId === s.stockInId ? null : s.stockInId)}
                        className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {activeMenuId === s.stockInId && (
                        <div className="absolute right-6 top-2 z-[100] w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStockIn(s);
                              setDetailsModalOpen(true);
                              setActiveMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                          >
                            <Eye size={14} className="shrink-0" /> View Details
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
          onSuccess={(newStockIn) => {
            fetchStockIns();
            if (newStockIn.status === "PendingApproval" || newStockIn.status === "Pending") {
              setActiveSubTab("pending");
            } else if (newStockIn.status === "Draft") {
              setActiveSubTab("draft");
            }
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
