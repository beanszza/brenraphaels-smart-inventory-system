"use client";
import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { OrdersSkeleton } from "@/components/orders-procurement/OrdersSkeleton";
import { Plus, RefreshCw, History } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import { Delivery, DeliveryStatus, PurchaseOrderPO } from "../types";
import { DeliveryTable } from "./DeliveryTable";
import { CreateDeliveryForm } from "./CreateDeliveryModal";
import { DeliveryDetailsView } from "./DeliveryDetailsModal";
import { MarkArrivedView } from "./MarkArrivedModal";
import { CancelDeliveryModal } from "./CancelDeliveryModal";
import Pagination from "@/components/Pagination";
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";
import { useRouter } from "next/navigation";

const STATUS_TABS: (DeliveryStatus | "All")[] = [
  "All",
  "Scheduled",
  "Arrived",
  "Cancelled",
];

interface DeliveryTabProps {
  initialDeliveries: Delivery[];
  orders?: PurchaseOrderPO[];
  onCreateDelivery?: () => void;
  onViewDelivery?: (delivery: Delivery) => void;
  onArriveDelivery?: (delivery: Delivery) => void;
}

export function DeliveryTab({
  initialDeliveries,
  orders = [],
  onCreateDelivery,
  onViewDelivery,
  onArriveDelivery,
}: DeliveryTabProps) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);

  const deliveries = initialDeliveries;
  const [loading, startRefresh] = useTransition();
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set(deliveries.map((d) => d.supplierName).filter(Boolean));
    return Array.from(suppliers).sort();
  }, [deliveries]);

  // Local fallback states when DeliveryTab is rendered standalone without ViewOrdersProcurement callbacks
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [arriveDelivery, setArriveDelivery] = useState<Delivery | null>(null);
  const [cancelDelivery, setCancelDelivery] = useState<{ delivery: Delivery; returnToDetails?: boolean } | null>(null);

  const fetchDeliveries = () => startRefresh(() => router.refresh());

  // Counts per tab
  const counts = useMemo(() => {
    const map: Record<string, number> = { All: deliveries.length };
    STATUS_TABS.forEach((t) => {
      map[t] = 0;
    });
    deliveries.forEach((d) => {
      const st = d.status;
      if (map[st] !== undefined) map[st]++;
    });
    map.All = deliveries.length;
    return map;
  }, [deliveries]);

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (activeTab !== "All" && d.status !== activeTab) {
        return false;
      }

      if (supplierFilter && d.supplierName !== supplierFilter) {
        return false;
      }

      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          d.deliveryNumber?.toLowerCase().includes(s) ||
          d.poNumber?.toLowerCase().includes(s) ||
          d.supplierName?.toLowerCase().includes(s) ||
          d.carrier?.toLowerCase().includes(s) ||
          d.driverName?.toLowerCase().includes(s) ||
          d.vehiclePlateNumber?.toLowerCase().includes(s) ||
          d.deliveryNoteNumber?.toLowerCase().includes(s) ||
          d.trackingNumber?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [deliveries, activeTab, search, supplierFilter]);

  const totalCount = filteredDeliveries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDeliveries.slice(start, start + pageSize);
  }, [filteredDeliveries, page, pageSize]);

  const handleCreateGrn = (d: Delivery) => {
    setSelectedDelivery(null);
    router.push(`/goods-receiving?deliveryId=${d.deliveryId}&poId=${d.poId}`);
  };

  const resolvePoTotalAmount = (d: Delivery | null): number | null => {
    if (!d || !orders.length) return null;
    const matched = orders.find(
      (o) => (d.poId && o.poId === d.poId) || (d.poNumber && o.poNumber === d.poNumber)
    );
    return matched ? Number(matched.totalAmount ?? 0) : null;
  };

  // Full-page inline fallbacks when rendered standalone
  if (openCreateModal) {
    return (
      <CreateDeliveryForm
        embedded
        onClose={() => setOpenCreateModal(false)}
        onSuccess={() => {
          setOpenCreateModal(false);
          setNotice("Saved successfully.");
          fetchDeliveries();
        }}
      />
    );
  }

  if (arriveDelivery) {
    return (
      <MarkArrivedView
        embedded
        delivery={arriveDelivery}
        poTotalAmount={resolvePoTotalAmount(arriveDelivery)}
        onClose={() => setArriveDelivery(null)}
        onSuccess={() => {
          setArriveDelivery(null);
          setNotice("Saved successfully.");
          fetchDeliveries();
        }}
      />
    );
  }

  if (selectedDelivery) {
    return (
      <>
        <DeliveryDetailsView
          embedded
          delivery={selectedDelivery}
          isAdmin={isAdmin}
          poTotalAmount={resolvePoTotalAmount(selectedDelivery)}
          onClose={() => setSelectedDelivery(null)}
          onArrive={(d) => {
            setSelectedDelivery(null);
            setArriveDelivery(d);
          }}
          onCancel={(d) => {
            setCancelDelivery({ delivery: d, returnToDetails: true });
          }}
          onGrnCreated={fetchDeliveries}
        />
        {cancelDelivery && (
          <CancelDeliveryModal
            delivery={cancelDelivery.delivery}
            onClose={() => setCancelDelivery(null)}
            onSuccess={() => {
              setCancelDelivery(null);
              setSelectedDelivery(null);
              setNotice("Saved successfully.");
              fetchDeliveries();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-5 animate-page-in">
      {notice && (
        <p role="status" className="rounded-control bg-subtle border border-border p-3 type-body text-primary">
          {notice}
        </p>
      )}
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-ink">Delivery Shipments</h2>
          <p className="mt-1 type-body text-ink-muted">
            Track planned consignments, carrier dispatch, and warehouse arrival milestones
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDeliveries}
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
              <Link href="/orders-procurement/logs">
                <History className="w-4 h-4" /> Transaction History
              </Link>
            </Button>
          )}

          {!isAdmin && (
            <Button
              type="button"
              onClick={() => (onCreateDelivery ? onCreateDelivery() : setOpenCreateModal(true))}
              className="flex items-center justify-center gap-1.5 rounded-control bg-primary px-3.5 py-2 type-label-button text-on-brand hover:bg-primary-hover transition-colors h-9 shadow-none cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Delivery Order
            </Button>
          )}
        </div>
      </div>

      {/* Status Sub-tabs */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {STATUS_TABS.map((tab) => {
            const count = counts[tab] || 0;
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
                aria-pressed={isSelected}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-status-purple-bg text-primary"
                    : "text-ink-muted hover:text-ink hover:bg-subtle"
                }`}
              >
                <span>{tab}</span>
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Standalone Filters & Search Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={supplierFilter === "" ? "all" : supplierFilter}
          onValueChange={(val) => {
            setSupplierFilter(val === "all" ? "" : val);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-[38px] w-full sm:w-auto sm:min-w-[230px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
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
            <SelectItem value="all">All Suppliers</SelectItem>
            {uniqueSuppliers.map((sup) => (
              <SelectItem key={sup} value={sup}>
                {sup}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchInput
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search delivery, PO, or carrier..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Padded Table Card */}
      {loading ? (
        <OrdersSkeleton />
      ) : (
        <div className="rounded-card border border-border bg-surface p-5">
          <DeliveryTable
            deliveries={paginatedList}
            onView={(d) => (onViewDelivery ? onViewDelivery(d) : setSelectedDelivery(d))}
            onArrive={
              !isAdmin
                ? (d) => (onArriveDelivery ? onArriveDelivery(d) : setArriveDelivery(d))
                : undefined
            }
            onCancel={!isAdmin ? (d) => setCancelDelivery({ delivery: d }) : undefined}
            onCreateGrn={!isAdmin ? (d) => handleCreateGrn(d) : undefined}
          />

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
            embedded
          />
        </div>
      )}

      {/* CANCEL DELIVERY MODAL */}
      {cancelDelivery && (
        <CancelDeliveryModal
          delivery={cancelDelivery.delivery}
          onClose={() => {
            if (cancelDelivery.returnToDetails) {
              setSelectedDelivery(cancelDelivery.delivery);
            }
            setCancelDelivery(null);
          }}
          onSuccess={() => {
            setCancelDelivery(null);
            setNotice("Saved successfully.");
            fetchDeliveries();
          }}
        />
      )}
    </div>
  );
}
