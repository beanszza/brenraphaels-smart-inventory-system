"use client";
import { actionResponse } from "@/lib/resources/action-response";
import { listTransfers, getTransfer } from "@/app/actions/stock-transfer/transfers";
import { cancelRequest } from "@/app/actions/stock-transfer/request-cancel";
import { reviewRequest } from "@/app/actions/stock-transfer/request-status";
import {
  reviewBranchRequest,
  retryBranchRequestPosSync,
} from "@/app/actions/stock-transfer/branch-requests";

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
  BranchStockRequest,
  CreateSTRPrefill,
} from "./types";
import StockTransferSummaryCards from "./StockTransferSummaryCards";
import { STRTable } from "./STRTable";
import { LocationsTab } from "./LocationsTab";
import { BranchRequestsTab } from "./BranchRequestsTab";
import { BranchRequestActionModal, type BranchRequestActionType } from "./BranchRequestActionModal";
import { BranchRequestDetailsModal } from "./BranchRequestDetailsModal";
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

export default function StockTransferModule({
  requests,
  metrics,
  locations,
  branchRequests = [],
  activeMainTab,
}: StockTransferScreen & { activeMainTab: "transfers" | "branch-requests" | "locations" }) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isImsManager = useIsImsManager();
  const canOperate = !isAdmin;
  const canReviewBranchRequests = isAdmin || isImsManager || canOperate;
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
  const [createStrPrefill, setCreateStrPrefill] = useState<CreateSTRPrefill | null>(null);
  const [scheduleTargetReq, setScheduleTargetReq] = useState<StockTransferRequest | null>(null);
  const [selectedSTRForDetails, setSelectedSTRForDetails] = useState<StockTransferRequest | null>(null);
  const [dispatchTargetTransfer, setDispatchTargetTransfer] = useState<StockTransfer | null>(null);

  const [strAction, setStrAction] = useState<{
    request: StockTransferRequest;
    type: STRActionType;
  } | null>(null);

  // Branch Stock Request Modal States
  const [selectedBranchReq, setSelectedBranchReq] = useState<BranchStockRequest | null>(null);
  const [branchReqAction, setBranchReqAction] = useState<{
    request: BranchStockRequest;
    type: BranchRequestActionType;
  } | null>(null);

  const pendingBranchReqCount = useMemo(
    () => branchRequests.filter((r) => r.subtab === "requests").length,
    [branchRequests]
  );

  const handleBranchRequestActionConfirm = async (payload: {
    approvedQuantity?: number;
    remarks?: string;
  }) => {
    if (!branchReqAction) return;
    const { request, type } = branchReqAction;
    const res = await actionResponse(
      reviewBranchRequest(request.branchRequestId, {
        action: type === "approve" ? "Approve" : "Reject",
        approvedQuantity: payload.approvedQuantity,
        remarks: payload.remarks,
      })
    );
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Unable to update branch stock request.");
    }
    toast.success(
      res.data?.message ||
        (type === "approve"
          ? `Approved ${request.requestNumber} and notified POS.`
          : `Rejected ${request.requestNumber} and notified POS.`)
    );
    refreshAll();
  };

  const handleRetryBranchSync = async (req: BranchStockRequest) => {
    startTransition(async () => {
      try {
        const res = await actionResponse(retryBranchRequestPosSync(req.branchRequestId));
        if (!res.data?.success) {
          toast.error(res.data?.message || "Unable to sync decision to POS.");
          return;
        }
        toast.success(res.data?.message || `Synced ${req.requestNumber} to POS.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to sync decision to POS.");
      }
    });
  };

  const handleTransferNow = (req: BranchStockRequest) => {
    const primaryItem = req.items[0];
    if (!primaryItem || req.totalRemaining <= 0) {
      toast.error("No remaining approved quantity available to transfer.");
      return;
    }
    setCreateStrPrefill({
      branchRequestId: req.branchRequestId,
      branchRequestNumber: req.requestNumber,
      branchId: req.branchId,
      branchName: req.branchName,
      productId: primaryItem.productId,
      productName: primaryItem.productName,
      variationName: primaryItem.variationName,
      sku: primaryItem.sku,
      approvedQuantity: primaryItem.approvedQuantity,
      remainingQuantity: primaryItem.remainingQuantity,
    });
    startTransition(() => router.push("/stock-transfer"));
    setOpenCreateSTR(true);
  };

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
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
      {/* Top Page Header */}
      <PageHeader
        title="Stock Transfers"
        description="Monitor, approve, schedule, and dispatch stock replenishment to branch stores"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={loading}
              className="h-9 px-3.5 py-2 rounded-control gap-1.5 bg-surface border border-border type-button text-ink hover:bg-subtle shadow-none cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>

            {isAdmin && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 px-3.5 py-2 rounded-control gap-1.5 bg-surface border border-border type-button text-ink hover:bg-subtle shadow-none cursor-pointer"
              >
                <Link href="/stock-transfer/logs">
                  <History className="w-3.5 h-3.5" /> Transaction History
                </Link>
              </Button>
            )}

            {canOperate && activeMainTab !== "branch-requests" && (
              <Button
                type="button"
                onClick={() => {
                  setCreateStrPrefill(null);
                  setOpenCreateSTR(true);
                }}
                className="h-9 px-3.5 py-2 rounded-control gap-1.5 bg-primary type-button text-on-brand hover:bg-primary-hover shadow-none cursor-pointer"
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
            className={`flex items-center gap-2 px-4 py-2.5 type-label-tab border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeMainTab === "transfers"
                ? "border-primary text-primary"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span>STOCK TRANSFERS</span>
            {statusCounts.All > 0 && (
              <span className="px-1.5 py-0.5 rounded-full type-caption tabular-nums bg-subtle text-ink-muted">
                {statusCounts.All}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => startTransition(() => router.push("/stock-transfer?tab=branch-requests"))}
            className={`flex items-center gap-2 px-4 py-2.5 type-label-tab border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeMainTab === "branch-requests"
                ? "border-primary text-primary"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span>BRANCH REQUESTS</span>
            {pendingBranchReqCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full type-caption tabular-nums bg-status-purple-bg text-primary font-semibold">
                {pendingBranchReqCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => startTransition(() => router.push("/stock-transfer?tab=locations"))}
            className={`flex items-center gap-2 px-4 py-2.5 type-label-tab border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeMainTab === "locations"
                ? "border-primary text-primary"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span>LOCATIONS</span>
          </button>
        </div>
      </div>

      {/* Content based on Primary Tab */}
      {activeMainTab === "locations" ? (
        <LocationsTab locations={locations} loading={loading} onRefresh={refreshAll} />
      ) : activeMainTab === "branch-requests" ? (
        <BranchRequestsTab
          branchRequests={branchRequests}
          loading={loading}
          canReview={canReviewBranchRequests}
          canTransfer={canOperate}
          onView={(req) => setSelectedBranchReq(req)}
          onApprove={(req) => setBranchReqAction({ request: req, type: "approve" })}
          onReject={(req) => setBranchReqAction({ request: req, type: "reject" })}
          onTransferNow={handleTransferNow}
          onRetrySync={handleRetryBranchSync}
        />
      ) : (
        <div className="space-y-4">
          {/* Sub-status Tabs Row (Admin Requests tab + Status Tabs) */}
          <div className="overflow-x-auto custom-scrollbar">
            <div className="flex items-center gap-1 min-w-max">
              {/* Admin Requests Tab (Visible ONLY to Admin) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStatusTab("Requests");
                    setPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
                    activeStatusTab === "Requests"
                      ? "bg-status-purple-bg text-primary"
                      : "text-ink-muted hover:text-ink hover:bg-subtle"
                  }`}
                >
                  <span>Requests</span>
                  <span className="tabular-nums">{statusCounts.Requests || 0}</span>
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

          {/* Standalone Search Row */}
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              containerClassName="flex-none w-full sm:w-[320px] h-[38px]"
              placeholder="Search request, branch, or product..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Unified Table Section with Embedded Pagination */}
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
            footer={
              totalCount > 0 ? (
                <Pagination
                  currentPage={Math.min(page, totalPages)}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  itemsPerPage={pageSize}
                  onPageChange={(p) => setPage(p)}
                  embedded
                />
              ) : null
            }
          />
        </div>
      )}

      {/* Modals */}
      {/* 1. Create STR Modal */}
      {openCreateSTR && <CreateSTRModal
        open
        prefill={createStrPrefill}
        onClose={() => {
          setOpenCreateSTR(false);
          setCreateStrPrefill(null);
        }}
        onSuccess={() => {
          setCreateStrPrefill(null);
          refreshAll();
        }}
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

      {/* 6. Branch Stock Request Details Modal */}
      <BranchRequestDetailsModal
        request={selectedBranchReq}
        open={Boolean(selectedBranchReq)}
        canReview={canReviewBranchRequests}
        canTransfer={canOperate}
        onClose={() => setSelectedBranchReq(null)}
        onApprove={(req) => setBranchReqAction({ request: req, type: "approve" })}
        onReject={(req) => setBranchReqAction({ request: req, type: "reject" })}
        onTransferNow={handleTransferNow}
        onRetrySync={handleRetryBranchSync}
      />

      {/* 7. Branch Stock Request Approve / Reject Confirmation Modal (reuses ActionConfirmModal) */}
      {branchReqAction && (
        <BranchRequestActionModal
          actionType={branchReqAction.type}
          request={branchReqAction.request}
          onConfirm={handleBranchRequestActionConfirm}
          onClose={() => setBranchReqAction(null)}
        />
      )}
    </div>
  );
}
