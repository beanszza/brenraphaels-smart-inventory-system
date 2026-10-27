"use client";
import { cancelTransfer } from "@/app/actions/stock-transfer/transfer-cancel";
import { dispatchTransfer } from "@/app/actions/stock-transfer/dispatch";

import { updateTransferStatus } from "@/app/actions/stock-transfer/transfer-status";

import { createLocation, updateLocation } from "@/app/actions/stock-transfer/locations";
import { actionResponse } from "@/lib/resources/action-response";

import type { DistributionScreen } from "@/lib/stock-transfer/screen-data";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TransferSkeleton } from "@/components/stock-transfer/TransferSkeleton";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Pagination from "@/components/Pagination";
import { TransferItem, LocationItem } from "@/components/distribution/types";
import DistributionSummaryCards from "@/components/distribution/DistributionSummaryCards";
import StockTransferTable from "@/components/distribution/StockTransferTable";
import LocationTable from "@/components/distribution/LocationTable";
import CreateTransferModal from "@/components/distribution/CreateTransferModal";
import LocationModal from "@/components/distribution/LocationModal";
import LocationDetailsModal from "@/components/distribution/LocationDetailsModal";
import { PageHeader } from "@/components/shared/PageHeader";

export default function DistributionPage({ transfers: initialTransfers, locations: initialLocations, stats }: DistributionScreen) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fetchData = () => startTransition(() => router.refresh());
  const [activeTab, setActiveTab] = useState<"Stock Transfer" | "Locations">("Stock Transfer");
  const transfers: TransferItem[] = initialTransfers.map(t => ({
    id: t.transferNumber, transferId: t.transferId, product: t.productName,
    from: t.sourceLocationName, to: t.destLocationName, quantity: t.transferQuantity,
    date: t.transferDate ? new Date(t.transferDate).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" }) : "",
    status: t.status,
  }));
  const locations: LocationItem[] = initialLocations.map(l => ({ id: String(l.locationId), locationId: l.locationId,
    name: l.locationName, type: l.locationType, address: l.address || "", status: l.status }));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const filtered = transfers.filter(t => (statusFilter === "All" || t.status === statusFilter) &&
    [t.id, t.product, t.from, t.to].some(value => value.toLowerCase().includes(search.trim().toLowerCase())));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const visibleTransfers = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  const [showCreateTransfer, setShowCreateTransfer] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [viewLocation, setViewLocation] = useState<LocationItem | null>(null);

  const updateStatus = async (t: TransferItem, status: string) => {
    try {
      if (status === "Dispatched") await actionResponse(dispatchTransfer(t.transferId!));
      else if (status === "Cancelled") await actionResponse(cancelTransfer(t.transferId!));
      else await actionResponse(updateTransferStatus(t.transferId!, { status }));
      toast.success("Transfer updated successfully.");
      fetchData();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update transfer status."); }
  };

  const handleSaveLocation = async (data: { name: string; type: string; address: string; isActive: boolean }) => {
    const body = { locationName: data.name, locationType: data.type, address: data.address,
      isActive: data.isActive, status: data.isActive ? "Active" : "Inactive" };
    if (editingLocation?.locationId) await actionResponse(updateLocation(editingLocation.locationId, body));
    else await actionResponse(createLocation(body));
    toast.success("Location saved.");
    setShowLocationModal(false);
    setEditingLocation(null);
    fetchData();
  };

  return (
    <div className="w-full min-h-full py-6 px-4 sm:py-8 sm:px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Stock Transfer"
        description="Manage internal stock transfers, warehouse movements, and facility locations."
        actions={
          <>
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link href="/reports?tab=distribution">
                <FileText className="w-4 h-4" /> Reports
              </Link>
            </Button>
            {activeTab === "Stock Transfer" ? (
              <Button size="sm" onClick={() => setShowCreateTransfer(true)} className="gap-1.5">
                <Plus className="w-4 h-4" /> New Request
              </Button>
            ) : (
              <Button size="sm" onClick={() => { setEditingLocation(null); setShowLocationModal(true); }} className="gap-1.5">
                <Plus className="w-4 h-4" /> Add Location
              </Button>
            )}
          </>
        }
      />

      {pending ? <TransferSkeleton /> : <DistributionSummaryCards stats={stats} />}

      {/* Process Tabs */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: "Stock Transfer", label: "STOCK TRANSFERS" },
            { id: "Locations", label: "LOCATIONS" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id as "Stock Transfer" | "Locations"); setPage(1); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "Stock Transfer" && (
        <>
          <div className="mb-6 border border-border rounded-md overflow-hidden bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm px-md py-sm bg-muted/20">
              <div className="flex items-center gap-sm flex-1">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  type="text"
                  placeholder="Search by Transfer ID (e.g. TR-...), Item, or Location..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-body-sm flex-1 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-sm shrink-0">
                <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                  <SelectTrigger className="h-10 w-[180px] rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {["All", "Scheduled", "Dispatched", "Received", "Cancelled"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <StockTransferTable transfers={visibleTransfers} onDispatch={(t) => updateStatus(t, "Dispatched")} onReceive={(t) => updateStatus(t, "Received")} onCancel={(t) => updateStatus(t, "Cancelled")} />
          <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={filtered.length} onPageChange={setPage} />
        </>
      )}

      {activeTab === "Locations" && (
        <LocationTable locations={locations} onEdit={(l) => { setEditingLocation(l); setShowLocationModal(true); }} onView={(l) => setViewLocation(l)} />
      )}

      <CreateTransferModal open={showCreateTransfer} locations={locations} onClose={() => setShowCreateTransfer(false)} onCreated={fetchData} />
      <LocationModal open={showLocationModal} editingLocation={editingLocation} onClose={() => { setShowLocationModal(false); setEditingLocation(null); }} onSave={handleSaveLocation} />
      <LocationDetailsModal location={viewLocation} onClose={() => setViewLocation(null)} />
    </div>
  );
}
