"use client";
import { ProductionSkeleton } from "./ProductionSkeleton";
import { listProductionRequests as productionListProductionRequests } from "@/app/actions/production/requests";
import { createBatch as productionCreateBatch } from "@/app/actions/production/batches";
import { updateProductionRequest as productionUpdateProductionRequest } from "@/app/actions/production/request-detail";
import { actionResponse } from "@/lib/resources/action-response";
import { useIsAdmin, useIsImsManager, useIsHeadCook } from "@/context/StaffContext";
import { ProductionActionModal } from "./ProductionActionModal";
import ActionConfirmModal from "@/components/shared/ActionConfirmModal";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Plus, MoreHorizontal, FileText, Play, Eye, Layers, Activity, CheckCircle, XCircle } from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";
import Pagination from "@/components/Pagination";
import { toast } from "sonner";
import { ProductionRequestEntity } from "./types";
import BatchLifecycleSummaryModal from "./BatchLifecycleSummaryModal";
import { filterProductionRequests } from "@/lib/production/filters";

const STATUS_TABS = [
  "All",
  "Pending Approval",
  "Approved",
  "Ready for Production",
  "In Progress",
  "Completed",
  "Rejected",
];

interface ProductionRequestsTabProps {
  initialRows: ProductionRequestEntity[];
  onNavigateToIssuance?: (prodReqId?: number) => void;
  onStartBatchAndTrack?: (batchId: number) => void;
  onNavigateToRequest?: (prodReqId: number) => void;
  currentUser: string;
}

export default function ProductionRequestsTab({
  initialRows,
  onNavigateToIssuance,
  onStartBatchAndTrack,
  onNavigateToRequest,
  currentUser,
}: ProductionRequestsTabProps) {
  const isAdmin = useIsAdmin();
  const isImsManager = useIsImsManager();
  const isHeadCook = useIsHeadCook();

  const [requests, setRequests] = useState<ProductionRequestEntity[]>(initialRows);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);

  // Sub-tabs based on role
  const statusTabs = useMemo(() => {
    if (isAdmin) {
      return ["Requests", ...STATUS_TABS];
    }
    if (isHeadCook) {
      return ["Ready for Production", "In Progress", "Completed", "All"];
    }
    return STATUS_TABS;
  }, [isAdmin, isHeadCook]);

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (isAdmin) return "Requests";
    if (isHeadCook) return "Ready for Production";
    return "All";
  });

  useEffect(() => {
    if (isAdmin && !["Requests", ...STATUS_TABS].includes(activeTab)) {
      setActiveTab("Requests");
    } else if (isHeadCook && !["Ready for Production", "In Progress", "Completed", "All"].includes(activeTab)) {
      setActiveTab("Ready for Production");
    }
  }, [isAdmin, isHeadCook, activeTab]);

  // Modals state
  const [summaryBatchId, setSummaryBatchId] = useState<number | null>(null);
  const [adminActionModal, setAdminActionModal] = useState<{
    open: boolean;
    type: "approve" | "reject";
    request: ProductionRequestEntity;
  } | null>(null);
  const [startProdConfirmReq, setStartProdConfirmReq] = useState<ProductionRequestEntity | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".action-menu-container")) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch Requests (background refresh without blanking table)
  const fetchRequests = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await actionResponse(productionListProductionRequests());
      if (res.data?.success && Array.isArray(res.data.data)) {
        setRequests(res.data.data);
      }
    } catch (err: unknown) {
      console.error("Error fetching production requests:", err);
      toast.error("Failed to load production requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Status helper mapping
  const matchesTab = (reqStatus: string, tabName: string) => {
    if (tabName === "Requests") return reqStatus === "Pending Approval";
    if (tabName === "All") return true;
    if (tabName === "Ready for Production") {
      return reqStatus === "Materials Issued" || reqStatus === "Ready for Production";
    }
    if (tabName === "In Progress") {
      return reqStatus === "In Production" || reqStatus === "In Progress" || reqStatus === "For QA";
    }
    if (tabName === "Completed") {
      return reqStatus === "Completed" || reqStatus === "For Stock-in" || reqStatus === "Stocked In";
    }
    return reqStatus === tabName;
  };

  // Status counts for status tabs
  const visibleRequests = useMemo(() => filterProductionRequests(requests, searchQuery, priorityFilter), [requests, searchQuery, priorityFilter]);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    statusTabs.forEach((st) => {
      counts[st] = visibleRequests.filter((r) => matchesTab(r.status, st)).length;
    });
    return counts;
  }, [visibleRequests, statusTabs]);

  // Filter by active status tab
  const filteredRequests = useMemo(() => {
    return visibleRequests.filter(r => matchesTab(r.status, activeTab));
  }, [visibleRequests, activeTab]);

  const openRequestDetail = (prodReqId: number) => {
    if (onNavigateToRequest) {
      onNavigateToRequest(prodReqId);
    } else if (typeof window !== "undefined") {
      window.location.href = `/production-quality/requests/${prodReqId}`;
    }
  };

  const handleViewRequest = (req: ProductionRequestEntity) => {
    const isCompletedRow =
      req.status === "Completed" ||
      req.status === "For Stock-in" ||
      req.status === "Stocked In";
    const batchId = req.batches?.[0]?.batchId;
    if (isCompletedRow && batchId) {
      setSummaryBatchId(batchId);
      return;
    }
    openRequestDetail(req.prodReqId);
  };

  // Admin Accept / Reject with Confirmation
  const handleAdminAction = async (notes?: string) => {
    if (!adminActionModal) return;
    const { type, request } = adminActionModal;
    try {
      const payload: any = { action: type };
      if (type === "reject") {
        payload.rejectionReason = notes || "Requirements not met";
      } else {
        payload.adminNotes = notes || "Approved";
      }
      const res = await actionResponse(productionUpdateProductionRequest(request.prodReqId, payload));
      if (res.data?.success) {
        toast.success(`Production Request ${request.reqNumber} ${type === "approve" ? "approved" : "rejected"}!`);
        setAdminActionModal(null);
        fetchRequests();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || `Failed to ${type} request.`);
    }
  };

  // Prompt confirmation before starting production
  const handleStartProduction = (req: ProductionRequestEntity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStartProdConfirmReq(req);
  };

  // Start Production -> Creates batch and navigates straight to Production Tracking
  const executeStartProduction = async () => {
    if (!startProdConfirmReq) return;
    const req = startProdConfirmReq;

    setStartingId(req.prodReqId);
    try {
      const res = await actionResponse(productionCreateBatch({
        prodReqId: req.prodReqId,
        assignedCook: currentUser,
        notes: `Started from Request ${req.reqNumber}`,
      }));

      if (res.data?.success && res.data.data) {
        toast.success(`Production batch ${res.data.data.batchNumber} started!`);
        setStartProdConfirmReq(null);
        await fetchRequests();
        if (onStartBatchAndTrack && res.data.data.batchId) {
          onStartBatchAndTrack(res.data.data.batchId);
        }
      } else {
        toast.error(res.data?.message || "Failed to start batch.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start batch.");
    } finally {
      setStartingId(null);
    }
  };

  // Pagination
  const pageSize = 10;
  const totalCount = filteredRequests.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5 animate-page-in">
      {/* Header & New Request Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-ink">Production Requests</h2>
          <p className="mt-1 type-body text-ink-muted">
            Plan production volumes, verify automated BOM lot reservations, review and approve requests, and start kitchen batches.
          </p>
        </div>
        {isImsManager && (
          <Button
            asChild
            className="flex items-center justify-center gap-1.5 rounded-control bg-primary px-3.5 py-2 type-label-button text-on-brand hover:bg-primary-hover transition-colors h-9 shadow-none cursor-pointer shrink-0"
          >
            <Link href="/production-quality/requests/new">
              <Plus className="w-4 h-4" />
              <span>New Production Request</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Status Sub-tabs */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {statusTabs.map((tab) => {
            const isSelected = activeTab === tab;
            const count = statusCounts[tab] || 0;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setCurrentPage(1);
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
          value={priorityFilter}
          onValueChange={(val) => {
            setPriorityFilter(val);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="h-[38px] w-full sm:w-auto sm:min-w-[210px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
            <span className="truncate">
              <span className="text-ink-muted font-normal mr-1.5">Priority:</span>
              <span className="font-medium text-ink">
                <SelectValue placeholder="All Priorities" />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            sideOffset={4}
            avoidCollisions={false}
            className="min-w-[210px] max-h-72"
          >
            <SelectItem value="All">All Priorities</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
          </SelectContent>
        </Select>

        <SearchInput
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search request, product, or variant..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Padded Table Card */}
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead>
              <tr className="border-b border-divider">
                <th className="sticky left-0 z-20 bg-surface pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[160px]">
                  {activeTab === "In Progress" || activeTab === "Completed"
                    ? "Batch Number"
                    : activeTab === "All"
                      ? "Request / Batch No."
                      : "Request Number"}
                </th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[180px]">
                  Product
                </th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Variant</th>
                <th className="pb-2.5 pt-1 pr-6 type-table-header text-ink-muted text-right whitespace-nowrap">Target Output</th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Priority</th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Required Date</th>
                <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center type-body text-ink-muted">
                    <ProductionSkeleton />
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center type-body text-ink-muted">
                    No production requests found in this view.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => {
                  const isHigh = req.priority === "High" || req.priority === "Priority";
                  const isLow = req.priority === "Low";
                  const displayPriority = isHigh ? "High" : isLow ? "Low" : "Medium";

                  const isReadyForProd = req.status === "Materials Issued" || req.status === "Ready for Production";
                  const isInProd = req.status === "In Production" || req.status === "In Progress" || req.status === "For QA";
                  const isCompleted = req.status === "For Stock-in" || req.status === "Stocked In" || req.status === "Completed";
                  const displayStatus = isReadyForProd
                    ? "Ready for Production"
                    : isInProd
                      ? "In Progress"
                      : isCompleted
                        ? "Completed"
                        : req.status;

                  return (
                    <tr
                      key={req.prodReqId}
                      onClick={() => handleViewRequest(req)}
                      className="group hover:bg-page transition-colors cursor-pointer"
                    >
                      {/* Request / Batch Number */}
                      <td className="sticky left-0 z-10 bg-surface group-hover:bg-page transition-colors py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[160px]">
                        {(isInProd || isCompleted) && req.batches?.[0]?.batchNumber
                          ? req.batches[0].batchNumber
                          : req.reqNumber}
                      </td>

                      {/* Product (Product name only) */}
                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap min-w-[180px]">
                        {req.productName}
                      </td>

                      {/* Variant (Dedicated column) */}
                      <td className="py-3 pr-4 type-body text-ink-muted whitespace-nowrap">
                        {req.variant || "Standard"}
                      </td>

                      {/* Target Output */}
                      <td className="py-3 pr-6 type-body font-medium text-ink text-right whitespace-nowrap tabular-nums">
                        {req.quantity} {req.yieldUom}
                      </td>

                      {/* Priority */}
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span
                          className={`inline-flex h-[22px] items-center rounded-pill px-2.5 py-[3px] type-badge ${
                            isHigh
                              ? "bg-status-amber-bg text-status-amber-fg"
                              : isLow
                                ? "bg-status-gray-bg text-status-gray-fg"
                                : "bg-status-blue-bg text-status-blue-fg"
                          }`}
                        >
                          {displayPriority}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <StatusBadge status={displayStatus} />
                      </td>

                      {/* Required Schedule (Date only) */}
                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                        {req.requiredDate ? new Date(req.requiredDate).toLocaleDateString() : "—"}
                      </td>

                      {/* Actions */}
                      <td className="w-16 py-3 pl-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer focus:outline-none"
                              title="Actions"
                              aria-label="Actions"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => openRequestDetail(req.prodReqId)}
                              className="cursor-pointer type-body-secondary"
                            >
                              <Eye size={14} className="shrink-0" />
                              <span>View Details</span>
                            </DropdownMenuItem>

                            {req.batches?.[0]?.batchId && (
                              <DropdownMenuItem
                                onClick={() => setSummaryBatchId(req.batches[0].batchId)}
                                className="cursor-pointer type-body-secondary"
                              >
                                <FileText size={14} className="shrink-0" />
                                <span>Batch Summary &amp; PDF</span>
                              </DropdownMenuItem>
                            )}

                            {isImsManager && req.status === "Approved" && onNavigateToIssuance && (
                              <DropdownMenuItem
                                onClick={() => onNavigateToIssuance(req.prodReqId)}
                                className="cursor-pointer type-body-secondary"
                              >
                                <Layers size={14} className="shrink-0" />
                                <span>Issue Materials</span>
                              </DropdownMenuItem>
                            )}

                            {isHeadCook && isReadyForProd && (
                              <DropdownMenuItem
                                onClick={() => handleStartProduction(req)}
                                className="cursor-pointer type-body-secondary font-medium"
                              >
                                <Play size={14} className="shrink-0" />
                                <span>Start Production</span>
                              </DropdownMenuItem>
                            )}

                            {isAdmin && req.status === "Pending Approval" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setAdminActionModal({ open: true, type: "approve", request: req })}
                                  className="cursor-pointer type-body-secondary"
                                >
                                  <CheckCircle size={14} className="shrink-0 text-success" />
                                  <span>Approve</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setAdminActionModal({ open: true, type: "reject", request: req })}
                                  className="cursor-pointer type-body-secondary text-destructive focus:text-destructive"
                                >
                                  <XCircle size={14} className="shrink-0" />
                                  <span>Reject</span>
                                </DropdownMenuItem>
                              </>
                            )}

                            {isInProd && onStartBatchAndTrack && req.batches?.[0]?.batchId && (isHeadCook || isAdmin) && (
                              <DropdownMenuItem
                                onClick={() => onStartBatchAndTrack(req.batches[0].batchId)}
                                className="cursor-pointer type-body-secondary"
                              >
                                <Activity size={14} className="shrink-0" />
                                <span>Track Batch</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
          embedded
        />
      </div>

      {/* Batch Lifecycle Summary & PDF Modal */}
      <BatchLifecycleSummaryModal
        open={Boolean(summaryBatchId)}
        onClose={() => setSummaryBatchId(null)}
        batchId={summaryBatchId}
      />

      {/* Admin Approve / Reject Confirmation Modal */}
      {adminActionModal && (
        <ProductionActionModal
          open={adminActionModal.open}
          actionType={adminActionModal.type}
          reqNumber={adminActionModal.request.reqNumber}
          onConfirm={handleAdminAction}
          onClose={() => setAdminActionModal(null)}
        />
      )}

      {/* Head Cook Start Production Confirmation Modal */}
      <ActionConfirmModal
        open={Boolean(startProdConfirmReq)}
        title="Confirm Start Production"
        subtitle={startProdConfirmReq ? `Production Request No: ${startProdConfirmReq.reqNumber}` : undefined}
        description={
          startProdConfirmReq
            ? `Are you sure you want to start a kitchen production batch for ${startProdConfirmReq.productName} (${startProdConfirmReq.variant || "Standard"}) with a target output of ${startProdConfirmReq.quantity} ${startProdConfirmReq.yieldUom}?`
            : ""
        }
        confirmText="Start Production"
        loading={Boolean(startingId)}
        loadingText="Starting..."
        onConfirm={executeStartProduction}
        onClose={() => setStartProdConfirmReq(null)}
      />
    </div>
  );
}
