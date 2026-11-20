"use client";
import { actionResponse } from "@/lib/resources/action-response";
import { listTransfers, getTransfer, scheduleTransfer } from "@/app/actions/stock-transfer/transfers";
import { cancelRequest } from "@/app/actions/stock-transfer/request-cancel";

import { reviewRequest } from "@/app/actions/stock-transfer/request-status";

import type { StockTransferScreen } from "@/lib/stock-transfer/screen-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import React, { useState, useTransition, useMemo } from "react";
import { Plus, RefreshCw, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import {
  StockTransferRequest,
  StockTransfer,
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
import { useIsAdmin, useIsImsManager } from "@/context/StaffContext";

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

export default function StockTransferModule({ requests, metrics, locations, activeMainTab }: StockTransferScreen & { activeMainTab: "transfers" | "locations" }) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isImsManager = useIsImsManager();
  const canOperate = !isAdmin;
  const [loading, startTransition] = useTransition();
  const refreshAll = () => startTransition(() => router.refresh());

  // Status Filter within Transfers tab (can be "Requests" for Admin or standard statuses)
  const [activeStatusTab, setActiveStatusTab] = useState<string>("All");

  React.useEffect(() => {
    if (!isAdmin && activeStatusTab === "Requests") {
      setActiveStatusTab("All");
    }
  }, [isAdmin, activeStatusTab]);

  // Search & Pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modal Visibility States
  const [openCreateSTR, setOpenCreateSTR] = useState(false);
  const [scheduleTargetReq, setScheduleTargetReq] = useState<StockTransferRequest | null>(null);
  const [selectedSTRForDetails, setSelectedSTRForDetails] = useState<StockTransferRequest | null>(null);
  const [dispatchTargetTransfer, setDispatchTargetTransfer] = useState<StockTransfer | null>(null);

  const [strAction, setStrAction] = useState<{
    request: StockTransferRequest;
    type: STRActionType;
  } | null>(null);

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
        const s = search.trim().toLowerCase();
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
    const start = (Math.min(page, totalPages) - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page, pageSize, totalPages]);

  // STR Action Handlers
  const handleSTRActionConfirm = async (notes?: string) => {
    if (!strAction) return;
    const { request, type } = strAction;

    if (type === "approve" || type === "reject") {
      const res = await actionResponse(reviewRequest(request.requestId, {
        action: type === "approve" ? "Approve" : "Reject", adminNotes: notes,
      }));
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Unable to review request.");
      }
      toast.success(type === "approve" ? "Request approved successfully." : "Request rejected.");
    } else {
      const res = await actionResponse(cancelRequest(request.requestId, { reason: notes }));
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Unable to cancel request.");
      }
      toast.success("Request cancelled successfully and reserved stock released.");
    }
    refreshAll();
  };

  const handleOpenDispatch = (req: StockTransferRequest, explicitTransferId?: number) => {
    const targetTransfer = explicitTransferId
      ? req.transfers?.find((t) => t.transferId === explicitTransferId)
      : req.transfers?.find((transfer) => transfer.status === "Scheduled");

    if (!targetTransfer) {
      toast.error("No scheduled transfer is available to dispatch.");
      return;
    }
    startTransition(async () => {
      try {
        const directRes = await actionResponse(getTransfer(targetTransfer.transferId));
        if (directRes.data?.success && directRes.data?.data) {
          setSelectedSTRForDetails(null);
          setDispatchTargetTransfer(directRes.data.data);
          return;
        }

        const result = await actionResponse(
          listTransfers(
            new URLSearchParams({ search: targetTransfer.transferNumber, pageSize: "100" }).toString()
          )
        );
        const transfer: StockTransfer | undefined = result.data.data?.find(
          (row: StockTransfer) => row.transferId === targetTransfer.transferId
        );
        if (!transfer || transfer.status !== "Scheduled")
          throw new Error("This transfer is no longer scheduled. Refresh and retry.");
        setSelectedSTRForDetails(null);
        setDispatchTargetTransfer(transfer);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load transfer.");
      }
    });
  };

  return (
    <div className="w-full min-h-full py-6 px-4 sm:py-8 sm:px-6 md:px-8 space-y-6 animate-page-in">
      {/* Top Page Header (matches Inventory module allowance) */}
      <PageHeader
        title="Stock Transfers"
        description="Monitor, approve, schedule, and dispatch stock replenishment to branch stores"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={loading}
              className="flex items-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-button font-semibold text-text-primary hover:bg-surface-hover transition-colors h-10 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>

            {isAdmin && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="flex items-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-button font-semibold text-text-primary hover:bg-surface-hover transition-colors h-10 cursor-pointer"
              >
                <Link href="/stock-transfer/logs">
                  <History className="w-3.5 h-3.5" /> Transaction History
                </Link>
              </Button>
            )}

            {canOperate && (
              <Button
                type="button"
                onClick={() => setOpenCreateSTR(true)}
                className="flex items-center gap-2 rounded-control bg-primary px-5 py-2.5 type-button font-semibold text-primary-foreground hover:bg-primary-hover transition-colors shadow-sm h-10 cursor-pointer"
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
      <div className="border-b border-divider">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => startTransition(() => router.push("/stock-transfer"))}
            className={`flex items-center gap-2 px-4 py-2.5 type-caption font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeMainTab === "transfers"
                ? "border-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary hover:border-divider"
            }`}
          >
            <span>STOCK TRANSFERS</span>
            {statusCounts.All > 0 && (
              <span className="px-1.5 py-0.5 rounded-full type-caption font-semibold bg-surface-hover text-text-primary border border-divider">
                {statusCounts.All}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => startTransition(() => router.push("/stock-transfer?tab=locations"))}
            className={`flex items-center gap-2 px-4 py-2.5 type-caption font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeMainTab === "locations"
                ? "border-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary hover:border-divider"
            }`}
          >
            <span>LOCATIONS</span>
          </button>
        </div>
      </div>

      {/* Content based on Primary Tab */}
      {activeMainTab === "locations" ? (
        <LocationsTab locations={locations} loading={loading} onRefresh={refreshAll} />
      ) : (
        <div className="space-y-5">
          {/* Search Filter Bar */}
          <div className="rounded-control border border-divider bg-surface p-3">
            <SearchInput
              placeholder="Search by Request No., Transfer No., Destination Branch, Product, or Courier..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="type-input"
            />
          </div>

          {/* Sub-status Tabs Row (Admin Requests tab + Status Tabs) */}
          <div className="border-b border-divider overflow-x-auto pb-2">
            <div className="flex items-center gap-1.5 min-w-max">
              {/* Admin Requests Tab (Visible ONLY to Admin) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStatusTab("Requests");
                    setPage(1);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-control type-caption font-semibold transition-all cursor-pointer ${
                    activeStatusTab === "Requests"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-surface-hover text-text-muted hover:text-text-primary hover:bg-surface-hover"
                  }`}
                >
                  <span>Requests</span>
                  {statusCounts.Requests > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full type-caption font-semibold ${
                        activeStatusTab === "Requests"
                          ? "bg-surface text-text-primary"
                          : "bg-surface-hover text-text-primary border border-divider"
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
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-control type-caption font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-surface-hover text-text-muted hover:text-text-primary hover:bg-surface-hover"
                    }`}
                  >
                    <span>{tab}</span>
                    {count > 0 && tab !== "All" && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full type-caption font-semibold ${
                          isSelected
                            ? "bg-surface text-text-primary"
                            : "bg-surface-hover text-text-primary border border-divider"
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
            isAdmin={isAdmin}
            activeStatusTab={activeStatusTab}
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
                currentPage={Math.min(page, totalPages)}
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
      {openCreateSTR && <CreateSTRModal
        open
        onClose={() => setOpenCreateSTR(false)}
        onSuccess={refreshAll}
      />}

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
        request={
          dispatchTargetTransfer
            ? requests.find((r) => r.requestId === dispatchTargetTransfer.requestId) || null
            : null
        }
        open={!!dispatchTargetTransfer}
        onClose={() => setDispatchTargetTransfer(null)}
        onSuccess={refreshAll}
      />

      {/* 4. STR Details Modal */}
      <STRDetailsModal
        request={selectedSTRForDetails}
        open={!!selectedSTRForDetails}
        isAdmin={isAdmin}
        isImsManager={isImsManager || canOperate}
        onClose={() => setSelectedSTRForDetails(null)}
        onApprove={isAdmin ? (req) => setStrAction({ request: req, type: "approve" }) : undefined}
        onReject={isAdmin ? (req) => setStrAction({ request: req, type: "reject" }) : undefined}
        onSchedule={
          canOperate
            ? (req) => {
                setSelectedSTRForDetails(null);
                setScheduleTargetReq(req);
              }
            : undefined
        }
        onDispatch={canOperate ? (req, transferId) => handleOpenDispatch(req, transferId) : undefined}
        onCancel={canOperate ? (req) => setStrAction({ request: req, type: "cancel" }) : undefined}
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
