"use client";
import { useRouter } from "next/navigation";

import React, { useState, useMemo, useTransition } from "react";
import { Search, RefreshCw, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import GrnTable from "./GrnTable";
import PendingReceivingTable from "./PendingReceivingTable";
import CreateGrnModal from "./CreateGrnModal";
import GrnDetailsModal from "./GrnDetailsModal";
import DeliveryDetailsModal from "./DeliveryDetailsModal";
import Pagination from "@/components/Pagination";
import { GRN, ArrivedDelivery } from "./types";

type SubTab = "pending" | "posted";

interface GrnTabProps {
  initialReceipts: GRN[];
  initialDeliveries: ArrivedDelivery[];
}

export default function GrnTab({ initialReceipts, initialDeliveries }: GrnTabProps) {
  const router = useRouter();
  const onPosted = () => router.push("/goods-receiving?tab=stockin");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("pending");
  const [loading, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Data states
  const postedGrns = useMemo(() => initialReceipts.filter(g => g.status !== "Draft"), [initialReceipts]);
  const pendingDeliveries = useMemo(() => {
    const postedDeliveryIds = new Set(postedGrns.map(g => g.deliveryId));
    return initialDeliveries.filter(d => d.status === "Arrived" && !postedDeliveryIds.has(d.deliveryId));
  }, [initialDeliveries, postedGrns]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [targetDeliveryId, setTargetDeliveryId] = useState<number | undefined>(undefined);
  const [selectedGrn, setSelectedGrn] = useState<GRN | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Delivery details modal
  const [viewDelivery, setViewDelivery] = useState<ArrivedDelivery | null>(null);
  const [deliveryDetailsOpen, setDeliveryDetailsOpen] = useState(false);

  const fetchData = () => startRefresh(() => router.refresh());

  // Counts
  const counts = useMemo(() => ({
    pending: pendingDeliveries.length,
    posted: postedGrns.length,
  }), [pendingDeliveries, postedGrns]);

  // Unique Suppliers from both pending deliveries and posted GRNs
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    pendingDeliveries.forEach((d) => {
      if (d.supplierName) set.add(d.supplierName);
    });
    postedGrns.forEach((g) => {
      if (g.supplierName) set.add(g.supplierName);
    });
    return Array.from(set).sort();
  }, [pendingDeliveries, postedGrns]);

  // Filter pending deliveries
  const filteredDeliveries = useMemo(() => {
    let filtered = pendingDeliveries;

    if (supplierFilter !== "All") {
      filtered = filtered.filter((d) => d.supplierName === supplierFilter);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter((d) => {
        return (
          d.deliveryNumber?.toLowerCase().includes(s) ||
          d.poNumber?.toLowerCase().includes(s) ||
          d.prNumber?.toLowerCase().includes(s) ||
          d.supplierName?.toLowerCase().includes(s) ||
          d.carrier?.toLowerCase().includes(s)
        );
      });
    }

    return filtered;
  }, [pendingDeliveries, search, supplierFilter]);

  // Filter posted GRNs
  const filteredGrns = useMemo(() => {
    let filtered = postedGrns;

    if (supplierFilter !== "All") {
      filtered = filtered.filter((g) => g.supplierName === supplierFilter);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter((g) => {
        return (
          g.grnNumber?.toLowerCase().includes(s) ||
          g.poNumber?.toLowerCase().includes(s) ||
          g.prNumber?.toLowerCase().includes(s) ||
          g.deliveryNumber?.toLowerCase().includes(s) ||
          g.supplierName?.toLowerCase().includes(s)
        );
      });
    }

    return filtered;
  }, [postedGrns, search, supplierFilter]);

  // Pagination for active list
  const currentList = activeSubTab === "pending" ? filteredDeliveries : filteredGrns;
  const totalCount = currentList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const paginatedDeliveries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDeliveries.slice(start, start + pageSize);
  }, [filteredDeliveries, page, pageSize]);

  const paginatedGrns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredGrns.slice(start, start + pageSize);
  }, [filteredGrns, page, pageSize]);

  // Handlers
  const handleViewDelivery = (del: ArrivedDelivery) => {
    setViewDelivery(del);
    setDeliveryDetailsOpen(true);
  };

  const handleCreateGrn = (deliveryId?: number) => {
    setTargetDeliveryId(deliveryId);
    setCreateModalOpen(true);
  };

  const handleSelectGrn = (grn: GRN) => {
    setSelectedGrn(grn);
    setDetailsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-page-in">
      {/* Top Header Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Receive deliveries</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Record physical counts and send received goods to Quality Assurance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors h-10"
          >
            <RefreshCw className={`w-4 h-4 `} /> Refresh
          </Button>

          <Button
            type="button"
            onClick={() => handleCreateGrn(undefined)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm h-10"
          >
            <Plus className="w-4 h-4" /> Create Goods Receipt Note
          </Button>
        </div>
      </div>

      {/* Full-width Search Bar & Filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center border border-border rounded-md bg-card px-2 py-2">
        <div className="flex flex-1 items-center gap-2 px-2 bg-muted/20 h-full rounded-md">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            aria-label="Search records"
            type="text"
            placeholder={
              activeSubTab === "pending"
                ? "Search arrived deliveries by Delivery# or Supplier..."
                : "Search posted receipts by Goods Receipt Note#, Delivery#, or Supplier..."
            }
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

      {/* Subtab Pill Navigation */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max pb-2">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab("pending");
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "pending"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span>Pending Receiving</span>
            {counts.pending > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeSubTab === "pending"
                    ? "bg-background text-foreground"
                    : "bg-foreground/20 text-foreground"
                }`}
              >
                {counts.pending}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("posted");
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "posted"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span>Posted GRNs</span>
            {counts.posted > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeSubTab === "posted"
                    ? "bg-background text-foreground"
                    : "bg-foreground/20 text-foreground"
                }`}
              >
                {counts.posted}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active Table Content */}
      {activeSubTab === "pending" ? (
        <PendingReceivingTable
          deliveries={paginatedDeliveries}
          loading={loading}
          onViewDelivery={handleViewDelivery}
        />
      ) : (
        <GrnTable
          grns={paginatedGrns}
          loading={loading}
          onSelectGrn={handleSelectGrn}
        />
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      {/* Delivery Details Modal (read-only) */}
      <DeliveryDetailsModal
        open={deliveryDetailsOpen}
        delivery={viewDelivery}
        onClose={() => setDeliveryDetailsOpen(false)}
        onCreateGrn={(deliveryId) => handleCreateGrn(deliveryId)}
      />

      {/* Create / Count GRN Modal */}
      <CreateGrnModal
        open={createModalOpen}
        initialDeliveryId={targetDeliveryId}
        onClose={() => {
          setCreateModalOpen(false);
          setTargetDeliveryId(undefined);
        }}
        onSuccess={(grn) => {
          fetchData();
          setActiveSubTab("posted");
          // Open the details modal so the user can post & print
          setSelectedGrn(grn);
          setDetailsModalOpen(true);
        }}
      />

      {/* GRN Details Modal */}
      <GrnDetailsModal
        open={detailsModalOpen}
        grn={selectedGrn}
        onClose={() => setDetailsModalOpen(false)}
        onUpdated={() => {
          fetchData();
        }}
        onPosted={onPosted}
      />
    </div>
  );
}
