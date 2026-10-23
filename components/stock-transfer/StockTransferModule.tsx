"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  StockTransferRequest,
  StockTransfer,
  DashboardMetrics,
  STRActionType,
} from "./types";
import StockTransferSummaryCards from "./StockTransferSummaryCards";
import { STRTable } from "./STRTable";
import { LocationsTab } from "./LocationsTab";
import { STRDetailsModal } from "./STRDetailsModal";
import { CreateSTRModal } from "./CreateSTRModal";
import { ScheduleTransferModal } from "./ScheduleTransferModal";
import { DispatchTransferModal } from "./DispatchTransferModal";
import { STRActionModal } from "./STRActionModal";
import Pagination from "@/components/Pagination";

const STATUS_TABS = [
  "All",
  "Pending Approval",
  "Approved",
  "Scheduled",
  "Dispatched",
  "Completed",
  "Cancelled",
  "Rejected",
];

export default function StockTransferModule() {
  const { isAdmin } = useAuth();

  // Primary navigation tab: "transfers" | "locations"
  const [activeMainTab, setActiveMainTab] = useState<"transfers" | "locations">("transfers");

  // Status Filter within Transfers tab (can be "Requests" for Admin or standard statuses)
  const [activeStatusTab, setActiveStatusTab] = useState<string>("All");

  // Search & Pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Data State
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<StockTransferRequest[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRequests: 0,
    pendingApproval: 0,
    approvedRequests: 0,
    dispatchedTransfers: 0,
    scheduledTransfers: 0,
  });

  // Modal Visibility States
  const [openCreateSTR, setOpenCreateSTR] = useState(false);
  const [scheduleTargetReq, setScheduleTargetReq] = useState<StockTransferRequest | null>(null);
  const [selectedSTRForDetails, setSelectedSTRForDetails] = useState<StockTransferRequest | null>(null);
  const [dispatchTargetTransfer, setDispatchTargetTransfer] = useState<StockTransfer | null>(null);

  const [strAction, setStrAction] = useState<{
    request: StockTransferRequest;
    type: STRActionType;
  } | null>(null);

  // Fetch Dashboard Metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await api.get("/api/stock-transfer-requests/dashboard");
      if (res.data?.success) {
        setMetrics(res.data.data);
      }
    } catch (e) {
      console.error("Failed to load dashboard metrics:", e);
    }
  }, []);

  // Fetch STR Requests with full transfers
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/stock-transfer-requests?pageSize=100");
      if (res.data?.success) {
        setRequests(res.data.data || []);
      }
    } catch (e) {
      console.error("Failed to load requests:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchMetrics();
    fetchRequests();
  }, [fetchMetrics, fetchRequests]);

  useEffect(() => {
    fetchMetrics();
    fetchRequests();
  }, [fetchMetrics, fetchRequests]);

  // Compute status counts for tab badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Requests: 0,
      All: requests.length,
    };
    requests.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (r.status === "Pending Approval") {
        counts.Requests = (counts.Requests || 0) + 1;
      }
    });
    return counts;
  }, [requests]);

  // Filtered List
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Tab filter
      if (activeStatusTab === "Requests") {
        if (r.status !== "Pending Approval") return false;
      } else if (activeStatusTab !== "All") {
        if (r.status !== activeStatusTab) return false;
      }

      // Search filter
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchReqNum = r.requestNumber?.toLowerCase().includes(s);
        const matchTransferNum = r.transfers?.some((t) => t.transferNumber?.toLowerCase().includes(s));
        const matchLoc = r.toLocationName?.toLowerCase().includes(s);
        const matchUser = r.requestedBy?.toLowerCase().includes(s);
        const matchCourier = r.transfers?.some(
          (t) => t.courierName?.toLowerCase().includes(s) || t.driverName?.toLowerCase().includes(s)
        );
        const matchItem = r.items?.some(
          (i) => i.productName?.toLowerCase().includes(s) || i.sku?.toLowerCase().includes(s)
        );
        return matchReqNum || matchTransferNum || matchLoc || matchUser || matchCourier || matchItem;
      }
      return true;
    });
  }, [requests, activeStatusTab, search]);

  // Paginated List
  const totalCount = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page, pageSize]);

  // STR Action Handlers
  const handleSTRActionConfirm = async (notes?: string) => {
    if (!strAction) return;
    const { request, type } = strAction;

    try {
      if (type === "approve" || type === "reject") {
        await api.put(`/api/stock-transfer-requests/${request.requestId}/status`, {
          action: type === "approve" ? "Approve" : "Reject",
          adminNotes: notes,
          reviewedBy: "Admin",
        });
      } else if (type === "cancel") {
        await api.put(`/api/stock-transfer-requests/${request.requestId}/cancel`, {
          reason: notes,
        });
      }
      refreshAll();
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to process request action.");
    }
  };

  const handleOpenDispatch = (req: StockTransferRequest) => {
    const transferRef = req.transfers && req.transfers.length > 0 ? req.transfers[0] : null;
    const firstItem = req.items?.[0];

    const transferPayload: StockTransfer = {
      transferId: transferRef ? transferRef.transferId : 0,
      transferNumber: transferRef ? transferRef.transferNumber : "",
      requestId: req.requestId,
      requestNumber: req.requestNumber,
      productId: firstItem ? firstItem.productId : 0,
      productName: firstItem ? firstItem.productName : "Product",
      variant: firstItem ? firstItem.variant : "",
      sku: firstItem ? firstItem.sku : "",
      sourceLocationId: 4,
      sourceLocationName: "Commissary (Central Kitchen)",
      destLocationId: req.toLocationId,
      destLocationName: req.toLocationName,
      transferQuantity: transferRef ? transferRef.transferQuantity : (firstItem?.requestedQuantity || 0),
      status: transferRef ? (transferRef.status as any) : "Scheduled",
      scheduledDate: transferRef?.scheduledDate || null,
      transferDate: null,
      dispatchedDate: null,
      receivedDate: null,
      driverName: transferRef?.driverName || "",
      vehiclePlate: transferRef?.vehiclePlate || "",
      courierName: transferRef?.courierName || "Lalamove",
      proofOfReceipt: "",
      priority: req.priority,
      notes: "",
      receivedBy: "",
      createdAt: null,
    };

    setDispatchTargetTransfer(transferPayload);
  };

  return (
    <div className="w-full min-h-full py-8 px-6 md:px-8 space-y-6 animate-page-in">
      {/* Top Page Header (matches Inventory module allowance) */}
      <PageHeader
        title="Stock Transfers"
        description="Monitor, approve, schedule, and dispatch stock replenishment to branch stores"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors h-10 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>

            {!isAdmin && (
              <Button
                type="button"
                onClick={() => setOpenCreateSTR(true)}
                className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-xs font-semibold text-background hover:bg-foreground/85 transition-colors shadow-sm h-10 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Transfer Request
              </Button>
            )}
          </div>
        }
      />

      {/* 3 Summary Cards with SVG Sparklines */}
      <StockTransferSummaryCards metrics={metrics} />

      {/* Primary Section Tabs (Stock Transfers vs Locations) */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveMainTab("transfers")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeMainTab === "transfers"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <span>STOCK TRANSFERS</span>
            {statusCounts.All > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-muted text-foreground">
                {statusCounts.All}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("locations")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeMainTab === "locations"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <span>LOCATIONS</span>
          </button>
        </div>
      </div>

      {/* Content based on Primary Tab */}
      {activeMainTab === "locations" ? (
        <LocationsTab />
      ) : (
        <div className="space-y-5">
          {/* Search Filter Bar */}
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-muted/20">
              <div className="flex items-center gap-3 flex-1">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  type="text"
                  placeholder="Search by Request No., Transfer No., Destination Branch, Product, or Courier..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-xs flex-1 text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* Sub-status Tabs Row (Admin Requests tab + Status Tabs) */}
          <div className="border-b border-border overflow-x-auto pb-2">
            <div className="flex items-center gap-1.5 min-w-max">
              {/* Admin Requests Tab (Identical to Orders & Procurement PRTab!) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStatusTab("Requests");
                    setPage(1);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeStatusTab === "Requests"
                      ? "bg-foreground text-background shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span>Requests</span>
                  {statusCounts.Requests > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        activeStatusTab === "Requests"
                          ? "bg-background text-foreground"
                          : "bg-foreground/20 text-foreground"
                      }`}
                    >
                      {statusCounts.Requests}
                    </span>
                  )}
                </button>
              )}

              {/* Standard Status Tabs */}
              {STATUS_TABS.map((tab) => {
                const count = statusCounts[tab] || 0;
                const isSelected = activeStatusTab === tab;

                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setActiveStatusTab(tab);
                      setPage(1);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-foreground text-background shadow-xs"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{tab}</span>
                    {count > 0 && tab !== "All" && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isSelected
                            ? "bg-background text-foreground"
                            : "bg-foreground/10 text-foreground"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unified Table Section */}
          <STRTable
            requests={paginatedRequests}
            loading={loading}
            onView={(req) => setSelectedSTRForDetails(req)}
            onApprove={(req) => setStrAction({ request: req, type: "approve" })}
            onReject={(req) => setStrAction({ request: req, type: "reject" })}
            onSchedule={(req) => setScheduleTargetReq(req)}
            onDispatch={(req) => handleOpenDispatch(req)}
            onCancel={(req) => setStrAction({ request: req, type: "cancel" })}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount}
                itemsPerPage={pageSize}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {/* 1. Create STR Modal */}
      <CreateSTRModal
        open={openCreateSTR}
        onClose={() => setOpenCreateSTR(false)}
        onSuccess={refreshAll}
      />

      {/* 2. Schedule Transfer Modal */}
      <ScheduleTransferModal
        open={!!scheduleTargetReq}
        request={scheduleTargetReq}
        onClose={() => setScheduleTargetReq(null)}
        onSuccess={refreshAll}
      />

      {/* 3. Dispatch Transfer Modal */}
      <DispatchTransferModal
        transfer={dispatchTargetTransfer}
        open={!!dispatchTargetTransfer}
        onClose={() => setDispatchTargetTransfer(null)}
        onSuccess={refreshAll}
      />

      {/* 4. STR Details Modal */}
      <STRDetailsModal
        request={selectedSTRForDetails}
        open={!!selectedSTRForDetails}
        onClose={() => setSelectedSTRForDetails(null)}
        onApprove={(req) => setStrAction({ request: req, type: "approve" })}
        onReject={(req) => setStrAction({ request: req, type: "reject" })}
        onSchedule={(req) => setScheduleTargetReq(req)}
        onCancel={(req) => setStrAction({ request: req, type: "cancel" })}
      />

      {/* 5. STR Action Confirmation Modal (Approve / Reject / Cancel) */}
      {strAction && (
        <STRActionModal
          actionType={strAction.type}
          requestNumber={strAction.request.requestNumber}
          onConfirm={handleSTRActionConfirm}
          onClose={() => setStrAction(null)}
        />
      )}
    </div>
  );
}
