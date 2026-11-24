"use client";
import Link from "next/link";
import { OrdersSkeleton } from "@/components/orders-procurement/OrdersSkeleton";

import { procurement } from "@/lib/orders/client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  RefreshCw,
  Inbox,
  History,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import { PurchaseRequisition, PRStatus } from "../types";
import { PRTable } from "./PRTable";
import { PRDetailsView } from "./PRDetailsModal";
import { PRActionModal, PRActionType } from "./PRActionModal";
import { CreatePRForm } from "./CreatePRForm";
import Pagination from "@/components/Pagination";
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";
import { sortRequisitionsByPriority } from "@/lib/orders/requisition-lifecycle";

const STATUS_TABS: (PRStatus | "All")[] = [
  "All",
  "Draft",
  "Pending Approval",
  "Returned",
  "Approved",
  "Rejected",
  "Cancelled",
  "Closed",
];

export function PRTab({
  initialRequisitions,
  onCreatePo,
  onCreateNew,
  onEditPr,
  onViewPr,
}: {
  initialRequisitions: PurchaseRequisition[];
  onCreatePo?: (prId: number) => void;
  onCreateNew?: () => void;
  onEditPr?: (pr: PurchaseRequisition) => void;
  onViewPr?: (pr: PurchaseRequisition) => void;
}) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);

  const requisitions = useMemo(
    () => (isAdmin ? initialRequisitions.filter((pr) => pr.status !== "Draft") : initialRequisitions),
    [initialRequisitions, isAdmin]
  );
  const visibleStatusTabs = useMemo(
    () => (isAdmin ? STATUS_TABS.filter((tab) => tab !== "Draft") : STATUS_TABS),
    [isAdmin]
  );
  const [loading, startRefresh] = useTransition();
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selected PR for details view
  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);

  // Active action modal
  const [actionModal, setActionModal] = useState<{
    pr: PurchaseRequisition;
    type: PRActionType;
  } | null>(null);

  // Create and Edit PR Modals
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [editingPR, setEditingPR] = useState<PurchaseRequisition | null>(null);
  const [prefillPR, setPrefillPR] = useState<PurchaseRequisition | null>(null);

  // Check for prefilled PR data from Production Request Shortfall
  useEffect(() => {
    const rawPrefill = sessionStorage.getItem("prefill_pr");
    if (rawPrefill) {
      try {
        const parsed = JSON.parse(rawPrefill);
        sessionStorage.removeItem("prefill_pr");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefillPR(parsed as PurchaseRequisition);
        setOpenCreateModal(true);
      } catch (e) {
        console.error("Failed to parse prefill_pr:", e);
      }
    }
  }, []);

  // Fetch Requisitions
  const fetchRequisitions = () => startRefresh(() => router.refresh());



  // Counts for each tab
  const counts = useMemo(() => {
    const map: Record<string, number> = { All: requisitions.length, Requests: 0 };
    STATUS_TABS.forEach((t) => { map[t] = 0; });
    requisitions.forEach((pr) => {
      const st = pr.status;
      if (map[st] !== undefined) map[st]++;
      if (st === "Pending Approval") map.Requests++;
    });
    map.All = requisitions.length;
    return map;
  }, [requisitions]);

  // Filtered & Priority-Sorted List (High -> Medium -> Low)
  const filteredList = useMemo(() => {
    const filtered = requisitions.filter((pr) => {
      // Tab filter
      if (activeTab === "Requests") {
        if (pr.status !== "Pending Approval") return false;
      } else if (activeTab !== "All") {
        if (pr.status !== activeTab) return false;
      }

      // Department filter
      if (deptFilter && pr.department !== deptFilter) return false;

      // Search filter
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchNumber = pr.prNumber?.toLowerCase().includes(s);
        const matchRequester = pr.requestedBy?.toLowerCase().includes(s);
        const matchDept = pr.department?.toLowerCase().includes(s);
        const matchPurpose = pr.purpose?.toLowerCase().includes(s);
        const matchItem = pr.items?.some((i) => i.itemName?.toLowerCase().includes(s) || i.itemCode?.toLowerCase().includes(s));
        return matchNumber || matchRequester || matchDept || matchPurpose || matchItem;
      }

      return true;
    });
    return sortRequisitionsByPriority(filtered);
  }, [requisitions, activeTab, search, deptFilter]);

  // Paginated List
  const totalCount = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Action handlers
  const handleStatusUpdate = async (prId: number, status: string, notes?: string) => {
    await procurement.setRequisitionStatus(prId, {
      status,
      adminNotes: notes || null,
    });
    toast.success("Status updated successfully.");
    fetchRequisitions();
  };


  // Standalone inline fallback when PRTab is rendered without ViewOrdersProcurement's onViewPr
  if (!onViewPr && selectedPR) {
    const latestPr = requisitions.find((r) => r.prId === selectedPR.prId) || selectedPR;
    return (
      <>
        <PRDetailsView
          embedded
          pr={latestPr}
          isAdmin={isAdmin}
          onClose={() => setSelectedPR(null)}
          onApprove={(pr) => setActionModal({ pr, type: "approve" })}
          onReject={(pr) => setActionModal({ pr, type: "reject" })}
          onReturn={(pr) => setActionModal({ pr, type: "return" })}
          onCancel={(pr) => setActionModal({ pr, type: "cancel" })}
          onCreatePo={
            onCreatePo
              ? (pr) => {
                  setSelectedPR(null);
                  onCreatePo(pr.prId);
                }
              : undefined
          }
        />

        {actionModal && (
          <PRActionModal
            actionType={actionModal.type}
            prNumber={actionModal.pr.prNumber}
            onClose={() => setActionModal(null)}
            onConfirm={async (notes) => {
              const { pr, type } = actionModal;
              if (type === "approve") {
                await handleStatusUpdate(pr.prId, "Approved", notes);
              } else if (type === "reject") {
                await handleStatusUpdate(pr.prId, "Rejected", notes);
              } else if (type === "return") {
                await handleStatusUpdate(pr.prId, "Returned", notes);
              } else if (type === "cancel") {
                await handleStatusUpdate(pr.prId, "Cancelled", notes);
              }
              setSelectedPR(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-5 animate-page-in">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-ink">Purchase Requisitions</h2>
          <p className="mt-1 type-body text-ink-muted">Manage raw material and ingredient purchase requisitions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequisitions}
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
              onClick={() => (onCreateNew ? onCreateNew() : setOpenCreateModal(true))}
              className="flex items-center justify-center gap-1.5 rounded-control bg-primary px-3.5 py-2 type-label-button text-on-brand hover:bg-primary-hover transition-colors h-9 shadow-none cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Purchase Requisition
            </Button>
          )}
        </div>
      </div>

      {/* Status Sub-tabs */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {/* Requests Tab (Visible to Admin only) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("Requests");
                setPage(1);
              }}
              aria-pressed={activeTab === "Requests"}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "Requests"
                  ? "bg-status-purple-bg text-primary"
                  : "text-ink-muted hover:text-ink hover:bg-subtle"
              }`}
            >
              <span>Requests</span>
              {counts.Requests > 0 && (
                <span className="tabular-nums">{counts.Requests}</span>
              )}
            </button>
          )}

          {/* Standard Status Tabs */}
          {visibleStatusTabs.map((tab) => {
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
          value={deptFilter === "" ? "all" : deptFilter}
          onValueChange={(val) => {
            setDeptFilter(val === "all" ? "" : val);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-[38px] w-full sm:w-auto sm:min-w-[230px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
            <span className="truncate">
              <span className="text-ink-muted font-normal mr-1.5">Department:</span>
              <span className="font-medium text-ink">
                <SelectValue placeholder="All Departments" />
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
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="Inventory">Inventory</SelectItem>
            <SelectItem value="Production">Production</SelectItem>
            <SelectItem value="Warehouse">Warehouse</SelectItem>
            <SelectItem value="Quality Assurance">Quality Assurance</SelectItem>
            <SelectItem value="Administration">Administration</SelectItem>
          </SelectContent>
        </Select>

        <SearchInput
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search PR No., requester, or dept..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Active Tab Subtitle for Requests tab */}
      {isAdmin && activeTab === "Requests" && (
        <div className="p-3 rounded-card border border-border bg-subtle type-caption text-ink flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary shrink-0" />
          <span>Showing all product requisitions pending your review. Approve, Reject, or Return for Revision with mandatory notes.</span>
        </div>
      )}

      {/* Padded Table Card */}
      {loading ? (
        <OrdersSkeleton />
      ) : (
        <div className="rounded-card border border-border bg-surface p-5">
          <PRTable
            requisitions={paginatedList}
            isAdmin={isAdmin}
            isRequestsTab={activeTab === "Requests"}
            onView={(pr) => (onViewPr ? onViewPr(pr) : setSelectedPR(pr))}
            onEdit={(pr) => (onEditPr ? onEditPr(pr) : setEditingPR(pr))}
            onCancel={(pr) => setActionModal({ pr, type: "cancel" })}
            onApprove={(pr) => setActionModal({ pr, type: "approve" })}
            onReject={(pr) => setActionModal({ pr, type: "reject" })}
            onReturn={(pr) => setActionModal({ pr, type: "return" })}
            onCreatePo={(pr) => onCreatePo?.(pr.prId)}
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

      {/* Action Confirmation Modal */}
      {actionModal && (
        <PRActionModal
          actionType={actionModal.type}
          prNumber={actionModal.pr.prNumber}
          onClose={() => setActionModal(null)}
          onConfirm={async (notes) => {
            const { pr, type } = actionModal;
            if (type === "approve") {
              await handleStatusUpdate(pr.prId, "Approved", notes);
            } else if (type === "reject") {
              await handleStatusUpdate(pr.prId, "Rejected", notes);
            } else if (type === "return") {
              await handleStatusUpdate(pr.prId, "Returned", notes);
            } else if (type === "cancel") {
              await handleStatusUpdate(pr.prId, "Cancelled", notes);
            }
            setSelectedPR(null);
          }}
        />
      )}

      {/* Standalone fallback if PRTab is rendered outside ViewOrdersProcurement */}
      {!onCreateNew && openCreateModal && (
        <CreatePRForm
          embedded
          initialData={prefillPR || undefined}
          isEdit={false}
          onClose={() => {
            setOpenCreateModal(false);
            setPrefillPR(null);
          }}
          onSuccess={() => {
            setOpenCreateModal(false);
            setPrefillPR(null);
            toast.success("Saved successfully.");
            fetchRequisitions();
          }}
        />
      )}

      {!onEditPr && editingPR && (
        <CreatePRForm
          embedded
          initialData={editingPR}
          isEdit={true}
          onClose={() => setEditingPR(null)}
          onSuccess={() => {
            setEditingPR(null);
            toast.success("Saved successfully.");
            fetchRequisitions();
          }}
        />
      )}
    </div>
  );
}
