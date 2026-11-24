"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { RefreshCw, Plus, History } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import GrnTable from "./GrnTable";
import PendingReceivingTable from "./PendingReceivingTable";
import { CreateGrnForm } from "./CreateGrnModal";
import { GrnDetailsView } from "./GrnDetailsModal";
import { useReceivingFullPage } from "./ReceivingFullPageContext";
import Pagination from "@/components/Pagination";
import { useStaff } from "@/context/StaffContext";
import { isQaStaff, isAdminStaff } from "@/lib/auth-roles";
import { GRN, ArrivedDelivery } from "./types";

const DeliveryDetailsModal = dynamic(() => import("./DeliveryDetailsModal"), { ssr: false });

type SubTab = "pending" | "posted";

interface GrnTabProps {
  initialReceipts: GRN[];
  initialDeliveries: ArrivedDelivery[];
}

export default function GrnTab({ initialReceipts, initialDeliveries }: GrnTabProps) {
  const router = useRouter();
  const staff = useStaff();
  const isQa = isQaStaff(staff);
  const isAdmin = isAdminStaff(staff);
  const onPosted = () => {
    if (isQa) {
      setActiveSubTab("posted");
      startRefresh(() => router.refresh());
    } else {
      window.dispatchEvent(new CustomEvent("receiving:switch-tab", { detail: "stockin" }));
    }
  };
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("pending");
  const [loading, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Data states
  const postedGrns = useMemo(
    () => initialReceipts.filter((g) => g.status !== "Draft" && g.status !== "Cancelled"),
    [initialReceipts]
  );
  const pendingDeliveries = useMemo(() => {
    const postedDeliveryIds = new Set(postedGrns.map((g) => g.deliveryId));
    return initialDeliveries.filter(
      (d) => d.status === "Arrived" && !postedDeliveryIds.has(d.deliveryId)
    );
  }, [initialDeliveries, postedGrns]);

  // Full-page Create GRN / View GRN state
  const { setFullPageActive } = useReceivingFullPage();
  const [createPageOpen, setCreatePageOpen] = useState(false);
  const [targetDeliveryId, setTargetDeliveryId] = useState<number | undefined>(undefined);
  const [selectedGrn, setSelectedGrn] = useState<GRN | null>(null);
  const [detailsPageOpen, setDetailsPageOpen] = useState(false);

  // Delivery details modal
  const [viewDelivery, setViewDelivery] = useState<ArrivedDelivery | null>(null);
  const [deliveryDetailsOpen, setDeliveryDetailsOpen] = useState(false);

  useEffect(() => {
    setFullPageActive(createPageOpen || (detailsPageOpen && !!selectedGrn));
    return () => setFullPageActive(false);
  }, [createPageOpen, detailsPageOpen, selectedGrn, setFullPageActive]);

  const fetchData = () => startRefresh(() => router.refresh());

  // Counts
  const counts = useMemo(
    () => ({
      pending: pendingDeliveries.length,
      posted: postedGrns.length,
    }),
    [pendingDeliveries, postedGrns]
  );

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
    setDetailsPageOpen(false);
    setCreatePageOpen(true);
  };

  const handleSelectGrn = (grn: GRN) => {
    setSelectedGrn(grn);
    setCreatePageOpen(false);
    setDetailsPageOpen(true);
  };

  // Full-page Unified Create GRN + QA view (matching Figma Form · New goods receipt note 142:21)
  if (createPageOpen) {
    return (
      <CreateGrnForm
        embedded
        initialDeliveryId={targetDeliveryId}
        initialDeliveries={pendingDeliveries}
        initialReceipts={initialReceipts}
        onClose={() => {
          setCreatePageOpen(false);
          setTargetDeliveryId(undefined);
        }}
        onSuccess={(grn) => {
          fetchData();
          setCreatePageOpen(false);
          setTargetDeliveryId(undefined);
          setActiveSubTab("posted");
          setSelectedGrn(grn);
          setDetailsPageOpen(true);
        }}
      />
    );
  }

  // Full-page GRN Details view (matching CreateGrnForm & Figma 142:433)
  if (detailsPageOpen && selectedGrn) {
    const latestGrn =
      initialReceipts.find((r) => r.grnId === selectedGrn.grnId) || selectedGrn;
    return (
      <GrnDetailsView
        embedded
        grn={latestGrn}
        onClose={() => {
          setDetailsPageOpen(false);
          setSelectedGrn(null);
        }}
        onUpdated={() => {
          fetchData();
        }}
        onPosted={onPosted}
      />
    );
  }

  return (
    <div className="space-y-5 animate-page-in">
      {/* Top Header Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-ink">Receive Deliveries</h2>
          <p className="mt-1 type-body text-ink-muted">
            Record physical counts and complete Quality Assurance review for incoming deliveries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-control bg-surface border border-border px-3.5 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-9 shadow-none cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>

          {isAdmin && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex items-center justify-center gap-1.5 rounded-control bg-surface border border-border px-3.5 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-9 shadow-none cursor-pointer"
            >
              <Link href="/goods-receiving/logs">
                <History className="w-4 h-4" /> Transaction History
              </Link>
            </Button>
          )}

          <Button
            type="button"
            onClick={() => handleCreateGrn(undefined)}
            className="flex items-center justify-center gap-1.5 rounded-control bg-primary px-3.5 py-2 type-label-button text-on-brand hover:bg-primary-hover transition-colors h-9 shadow-none cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Goods Receipt Note
          </Button>
        </div>
      </div>

      {/* Subtab Pill Navigation */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab("pending");
              setPage(1);
            }}
            aria-pressed={activeSubTab === "pending"}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === "pending"
                ? "bg-status-purple-bg text-primary"
                : "text-ink-muted hover:text-ink hover:bg-subtle"
            }`}
          >
            <span>Pending Receiving</span>
            <span className="tabular-nums">{counts.pending}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("posted");
              setPage(1);
            }}
            aria-pressed={activeSubTab === "posted"}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === "posted"
                ? "bg-status-purple-bg text-primary"
                : "text-ink-muted hover:text-ink hover:bg-subtle"
            }`}
          >
            <span>Posted GRNs</span>
            <span className="tabular-nums">{counts.posted}</span>
          </button>
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
          placeholder={
            activeSubTab === "pending"
              ? "Search delivery or supplier..."
              : "Search GRN, delivery, or supplier..."
          }
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
            className="type-caption text-ink-muted hover:text-ink font-medium px-2 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Padded Table Card */}
      <div className="rounded-card border border-border bg-surface p-5">
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

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={setPage}
          embedded
        />
      </div>

      {/* Delivery Details Modal (read-only) */}
      {deliveryDetailsOpen && (
        <DeliveryDetailsModal
          open={deliveryDetailsOpen}
          delivery={viewDelivery}
          onClose={() => setDeliveryDetailsOpen(false)}
          onCreateGrn={(deliveryId) => handleCreateGrn(deliveryId)}
        />
      )}
    </div>
  );
}
