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
import ProductionRequestModal from "./ProductionRequestModal";
import PrSummaryModal from "./PrSummaryModal";
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
  currentUser: string;
}

export default function ProductionRequestsTab({
  initialRows,
  onNavigateToIssuance,
  onStartBatchAndTrack,
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
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<ProductionRequestEntity | null>(null);
  const [prSummaryData, setPrSummaryData] = useState<any | null>(null);
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

  const handleOpenNewModal = () => {
    setSelectedRequest(null);
    setIsModalOpen(true);
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
    setSelectedRequest(req);
    setIsModalOpen(true);
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
    <div className="space-y-6">
      {/* Header & New Request Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-text-primary">Production Requests</h2>
          <p className="mt-1 type-body text-text-muted">
            Plan production volumes, verify automated BOM lot reservations, review and approve requests, and start kitchen batches.
          </p>
        </div>
        {isImsManager && (
          <Button
            onClick={handleOpenNewModal}
            className="flex items-center justify-center gap-2 rounded-control bg-button-primary px-5 py-2.5 type-body font-semibold text-text-inverse hover:bg-button-primary/85 transition-colors shadow-card cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Production Request</span>
          </Button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="mb-6 rounded-card border border-divider bg-surface p-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SearchInput
            containerClassName="flex-1"
            placeholder="Search by Request No., Product, or Variant..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />

          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <Select
                value={priorityFilter}
                onValueChange={(val) => {
                  setPriorityFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-10 min-w-[180px] w-auto rounded-control border border-divider bg-surface px-3.5 type-body font-medium text-text-primary shadow-card focus:border-border-focus">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent className="min-w-[180px] bg-surface border-divider type-caption">
                  <SelectItem value="All">All Priorities</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Top Status Tabs */}
      <div className="border-b border-divider overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max pb-2">
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
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-control type-caption font-semibold transition-all cursor-pointer ${isSelected
                    ? "bg-button-primary text-text-inverse shadow-card"
                    : "bg-surface-secondary text-text-muted hover:text-text-primary hover:bg-surface-secondary/80"
                  }`}
              >
                <span>{tab}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-pill type-caption font-semibold ${isSelected ? "bg-surface text-text-primary" : "bg-surface-secondary text-text-muted"
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Requests Table */}
      <div className="border border-divider rounded-card overflow-hidden bg-surface shadow-card">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-divider bg-surface-secondary">
              <tr className="table-head-row text-left whitespace-nowrap">
                <th className="sticky left-0 z-20 bg-surface-secondary table-th px-4 py-3 whitespace-nowrap min-w-[170px] w-44 border-r border-divider shadow-sticky">
                  {activeTab === "In Progress" || activeTab === "Completed"
                    ? "Batch Number"
                    : activeTab === "All"
                      ? "Request / Batch No."
                      : "Request Number"}
                </th>
                <th className="table-th px-4 py-3 whitespace-nowrap min-w-[180px]">
                  Product
                </th>
                <th className="table-th px-4 py-3 whitespace-nowrap">Variant</th>
                <th className="table-th px-4 py-3 text-right whitespace-nowrap">Target Output</th>
                <th className="table-th px-4 py-3 text-center whitespace-nowrap">Priority</th>
                <th className="table-th px-4 py-3 text-center whitespace-nowrap">Status</th>
                <th className="table-th px-4 py-3 whitespace-nowrap">Required Date</th>
                <th className="table-th w-16 px-4 py-3 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center type-body text-text-muted animate-pulse">
                    <ProductionSkeleton />
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center type-body text-text-muted">
                    No production requests found in this view.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => {
                  const isHigh = req.priority === "High" || req.priority === "Priority";
                  const isLow = req.priority === "Low";
                  const displayPriority = isHigh ? "High" : isLow ? "Low" : "Medium";
                  const hasPr = Boolean(req.linkedPrId);
                  const isMenuOpen = openDropdownId === req.prodReqId;

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
                      className={`table-row group hover:bg-surface-secondary/50 transition-colors cursor-pointer ${isHigh ? "bg-surface-secondary/20 border-l-2 border-l-brand" : ""
                        }`}
                    >
                      {/* Request / Batch Number */}
                      <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface-secondary/50 px-4 py-3 table-td font-semibold text-text-primary whitespace-nowrap min-w-[170px] w-44 border-r border-divider shadow-sticky transition-colors">
                        {(isInProd || isCompleted) && req.batches?.[0]?.batchNumber
                          ? req.batches[0].batchNumber
                          : req.reqNumber}
                      </td>

                      {/* Product (Product name only) */}
                      <td className="px-4 py-3 table-td text-text-primary whitespace-nowrap min-w-[180px]">
                        {req.productName}
                      </td>

                      {/* Variant (Dedicated column) */}
                      <td className="px-4 py-3 table-td text-text-muted whitespace-nowrap">
                        {req.variant || "Standard"}
                      </td>

                      {/* Target Output */}
                      <td className="px-4 py-3 table-td text-right font-semibold text-text-primary whitespace-nowrap">
                        {req.quantity} {req.yieldUom}
                      </td>

                      {/* Priority (Monochromatic badge - No red) */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`type-caption font-semibold px-2.5 py-0.5 rounded-pill border ${isHigh
                              ? "bg-button-primary text-text-inverse border-button-primary"
                              : isLow
                                ? "bg-surface-secondary text-text-muted border-divider"
                                : "bg-surface-secondary text-text-primary border-divider"
                            }`}
                        >
                          {displayPriority}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <StatusBadge status={displayStatus} />
                      </td>

                      {/* Required Schedule (Date only) */}
                      <td className="px-4 py-3 table-td text-text-muted whitespace-nowrap">
                        <div>{req.requiredDate ? new Date(req.requiredDate).toLocaleDateString() : "—"}</div>
                      </td>

                      {/* Actions */}
                      <td className="w-16 px-4 py-3 text-center relative whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1.5 rounded-control text-text-primary hover:bg-surface-secondary transition-colors cursor-pointer focus:outline-none"
                                title="Actions"
                              >
                                <MoreHorizontal size={18} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-control border border-divider bg-surface shadow-modal p-1.5 text-left z-[100]">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setIsModalOpen(true);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary focus:text-text-primary cursor-pointer rounded-control transition-colors outline-none"
                              >
                                <Eye size={14} className="shrink-0 text-text-muted" />
                                <span>View Details</span>
                              </DropdownMenuItem>

                              {req.batches?.[0]?.batchId && (
                                <DropdownMenuItem
                                  onClick={() => setSummaryBatchId(req.batches[0].batchId)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary focus:text-text-primary cursor-pointer rounded-control transition-colors outline-none"
                                >
                                  <FileText size={14} className="shrink-0 text-text-muted" />
                                  <span>Batch Summary &amp; PDF</span>
                                </DropdownMenuItem>
                              )}

                              {isImsManager && req.status === "Approved" && onNavigateToIssuance && (
                                <DropdownMenuItem
                                  onClick={() => onNavigateToIssuance(req.prodReqId)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary focus:text-text-primary cursor-pointer rounded-control transition-colors outline-none"
                                >
                                  <Layers size={14} className="shrink-0 text-text-muted" />
                                  <span>Issue Materials</span>
                                </DropdownMenuItem>
                              )}

                              {isHeadCook && isReadyForProd && (
                                <DropdownMenuItem
                                  onClick={() => handleStartProduction(req)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-semibold text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary focus:text-text-primary cursor-pointer rounded-control transition-colors outline-none"
                                >
                                  <Play size={14} className="shrink-0 text-text-muted" />
                                  <span>Start Production</span>
                                </DropdownMenuItem>
                              )}

                              {isAdmin && req.status === "Pending Approval" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => setAdminActionModal({ open: true, type: "approve", request: req })}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary focus:text-text-primary cursor-pointer rounded-control transition-colors outline-none"
                                  >
                                    <CheckCircle size={14} className="shrink-0 text-badge-success-text" />
                                    <span>Approve</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setAdminActionModal({ open: true, type: "reject", request: req })}
                                    className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-medium text-badge-danger-text hover:bg-badge-danger-bg focus:bg-badge-danger-bg focus:text-badge-danger-text cursor-pointer rounded-control transition-colors outline-none"
                                  >
                                    <XCircle size={14} className="shrink-0 text-badge-danger-text" />
                                    <span>Reject</span>
                                  </DropdownMenuItem>
                                </>
                              )}

                              {isInProd && onStartBatchAndTrack && req.batches?.[0]?.batchId && (isHeadCook || isAdmin) && (
                                <DropdownMenuItem
                                  onClick={() => onStartBatchAndTrack(req.batches[0].batchId)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary focus:text-text-primary cursor-pointer rounded-control transition-colors outline-none"
                                >
                                  <Activity size={14} className="shrink-0 text-text-muted" />
                                  <span>Track Batch</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-divider bg-surface flex justify-end">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Production Request Modal (Create / View) */}
      <ProductionRequestModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(created) => {
          fetchRequests();
          if (created && onNavigateToIssuance && created.status === "Approved") {
            onNavigateToIssuance(created.prodReqId);
          }
        }}
        initialRequest={selectedRequest}
        onProceedToIssuance={(id) => onNavigateToIssuance && onNavigateToIssuance(id)}
        onViewPrSummary={(data) => setPrSummaryData(data)}
        onStartProduction={handleStartProduction}
      />

      {/* PR Summary Modal */}
      <PrSummaryModal
        open={Boolean(prSummaryData)}
        onClose={() => setPrSummaryData(null)}
        prData={prSummaryData}
      />

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
