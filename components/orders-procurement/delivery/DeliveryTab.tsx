"use client";
import { OrdersSkeleton } from "@/components/orders-procurement/OrdersSkeleton";

import { procurement } from "@/lib/orders/client";

import React, { useState, useMemo, useTransition } from "react";
import { Plus, Search, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Delivery, DeliveryStatus } from "../types";
import { DeliveryTable } from "./DeliveryTable";
import { CreateDeliveryModal } from "./CreateDeliveryModal";
import { DeliveryDetailsModal } from "./DeliveryDetailsModal";
import { MarkDispatchedModal } from "./MarkDispatchedModal";
import { MarkArrivedModal } from "./MarkArrivedModal";
import { CancelDeliveryModal } from "./CancelDeliveryModal";
import Pagination from "@/components/Pagination";
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";
import { useRouter } from "next/navigation";

const STATUS_TABS: (DeliveryStatus | "All")[] = [
  "All",
  "Scheduled",
  "In Transit",
  "Arrived",
  "Cancelled",
];

export function DeliveryTab({ initialDeliveries }: { initialDeliveries: Delivery[] }) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);

  const deliveries = initialDeliveries.map(d => ({ ...d, status: (String(d.status) === "InTransit" ? "In Transit" : d.status) as DeliveryStatus }));
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

  // Modals state
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [dispatchDelivery, setDispatchDelivery] = useState<Delivery | null>(null);
  const [arriveDelivery, setArriveDelivery] = useState<Delivery | null>(null);
  const [cancelDelivery, setCancelDelivery] = useState<Delivery | null>(null);

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

  return (
    <div className="space-y-6 animate-page-in">
      {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{notice}</p>}
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Delivery Shipments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track planned consignments, carrier dispatch, and warehouse arrival milestones
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDeliveries}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors h-10"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>

          {!isAdmin && (
          <Button
            type="button"
            onClick={() => setOpenCreateModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm h-10"
          >
            <Plus className="w-4 h-4" /> Create Delivery Order
          </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="mb-6 border border-border rounded-xl overflow-hidden bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-3 flex-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by Delivery No., Purchase Order No., Supplier, Carrier, Driver, or Tracking No..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-sm flex-1 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-border/50">
            <div className="flex items-center">
              <Select
                value={supplierFilter === "" ? "all" : supplierFilter}
                onValueChange={(val) => {
                  setSupplierFilter(val === "all" ? "" : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 min-w-[210px] w-auto rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent className="min-w-[210px]">
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {uniqueSuppliers.map((sup) => (
                    <SelectItem key={sup} value={sup}>
                      {sup}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max pb-2">
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    isSelected
                      ? "bg-background text-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Delivery Table */}
      {loading ? <OrdersSkeleton /> : (<DeliveryTable
        deliveries={paginatedList}
        onView={(d) => setSelectedDelivery(d)}
        onDispatch={(d) => setDispatchDelivery(d)}
        onArrive={(d) => setArriveDelivery(d)}
        onCancel={(d) => setCancelDelivery(d)}
        onCreateGrn={(d) => handleCreateGrn(d)}
      />)}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, totalCount)} of {totalCount} deliveries
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* CREATE DELIVERY MODAL */}
      {openCreateModal && (
        <CreateDeliveryModal
          open={openCreateModal}
          onClose={() => setOpenCreateModal(false)}
          onSuccess={() => {
            setOpenCreateModal(false);
            setNotice("Saved successfully.");
            fetchDeliveries();
          }}
        />
      )}

      {/* DELIVERY DETAILS MODAL */}
      {selectedDelivery && (
        <DeliveryDetailsModal
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          onArrive={(d) => {
            setSelectedDelivery(null);
            setArriveDelivery(d);
          }}
          onCancel={(d) => {
            setSelectedDelivery(null);
            setCancelDelivery(d);
          }}
          onGrnCreated={fetchDeliveries}
        />
      )}

      {/* MARK AS ARRIVED MODAL */}
      {arriveDelivery && (
        <MarkArrivedModal
          delivery={arriveDelivery}
          onClose={() => setArriveDelivery(null)}
          onSuccess={() => {
            setArriveDelivery(null);
            setNotice("Saved successfully.");
            fetchDeliveries();
          }}
        />
      )}

      {/* CANCEL DELIVERY MODAL */}
      {cancelDelivery && (
        <CancelDeliveryModal
          delivery={cancelDelivery}
          onClose={() => setCancelDelivery(null)}
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
