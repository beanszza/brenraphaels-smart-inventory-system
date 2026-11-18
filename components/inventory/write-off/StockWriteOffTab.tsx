"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Inbox, History } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
import Pagination from "@/components/Pagination";
import { useIsAdmin, useIsImsManager } from "@/context/StaffContext";
import { inventory } from "@/lib/inventory/client";
import { SWO_REASONS } from "@/lib/inventory/write-off-validation";
import { SWOTable } from "./SWOTable";
import { SWODetailsModal } from "./SWODetailsModal";
import { SWOActionModal, type SWOActionType } from "./SWOActionModal";
import { CreateSWOModal } from "./CreateSWOModal";
import type { InventoryItem } from "@/components/inventory/types";
import type { LotItem } from "@/components/lots/types";
import type { StockWriteOffDto, SwoStatus } from "./types";

const STATUS_TABS: (SwoStatus | "All")[] = [
  "All",
  "Pending Approval",
  "Approved",
  "Removed",
  "Rejected",
  "Cancelled",
];

interface StockWriteOffTabProps {
  initialWriteOffs: StockWriteOffDto[];
  initialInventories?: InventoryItem[];
  initialLots?: LotItem[];
  initialCategories?: { categoryId: number; categoryName: string }[];
}

export function StockWriteOffTab({
  initialWriteOffs,
  initialInventories = [],
  initialLots = [],
  initialCategories = [],
}: StockWriteOffTabProps) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isImsManager = useIsImsManager();

  const [loading, startRefresh] = useTransition();
  const [activeTab, setActiveTab] = useState<string>(isAdmin ? "Requests" : "All");
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modals state
  const [selectedSWO, setSelectedSWO] = useState<StockWriteOffDto | null>(null);
  const [actionModal, setActionModal] = useState<{
    swo: StockWriteOffDto;
    type: SWOActionType;
  } | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);

  const refreshData = () => startRefresh(() => router.refresh());

  // Counts per tab
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      All: initialWriteOffs.length,
      Requests: 0,
    };
    STATUS_TABS.forEach((t) => {
      if (t !== "All") map[t] = 0;
    });
    initialWriteOffs.forEach((swo) => {
      if (map[swo.status] !== undefined) map[swo.status]++;
      if (swo.status === "Pending Approval") map.Requests++;
    });
    return map;
  }, [initialWriteOffs]);

  // Filtered list
  const filteredList = useMemo(() => {
    return initialWriteOffs.filter((swo) => {
      // Status / Requests tab filter
      if (activeTab === "Requests") {
        if (swo.status !== "Pending Approval") return false;
      } else if (activeTab !== "All") {
        if (swo.status !== activeTab) return false;
      }

      // Reason filter
      if (reasonFilter) {
        const hasReason = swo.items.some((it) =>
          it.lines.some((l) => l.reason === reasonFilter)
        );
        if (!hasReason) return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchNumber = swo.swoNumber.toLowerCase().includes(q);
        const matchRequester =
          swo.requestedByName?.toLowerCase().includes(q) ||
          swo.requestedBy?.toLowerCase().includes(q);
        const matchItem = swo.items.some(
          (it) =>
            it.itemName.toLowerCase().includes(q) ||
            it.itemCode.toLowerCase().includes(q) ||
            it.variantName.toLowerCase().includes(q) ||
            it.lines.some((l) => l.lotCode.toLowerCase().includes(q))
        );
        return matchNumber || matchRequester || matchItem;
      }

      return true;
    });
  }, [initialWriteOffs, activeTab, reasonFilter, search]);

  const totalCount = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  const handleConfirmAction = async (notes?: string) => {
    if (!actionModal) return;
    const { swo, type } = actionModal;
    let res;
    if (type === "approve") {
      res = await inventory.approveWriteOff(swo.writeOffId, notes);
    } else if (type === "reject") {
      res = await inventory.rejectWriteOff(swo.writeOffId, notes || "");
    } else if (type === "cancel") {
      res = await inventory.cancelWriteOff(swo.writeOffId, notes || "");
    } else if (type === "remove") {
      res = await inventory.removeWriteOffFromInventory(swo.writeOffId);
    }

    if (!res?.data?.success) {
      throw new Error(res?.data?.message || "Action failed.");
    }

    toast.success(res.data.message || "Action completed successfully.");
    setSelectedSWO(null);
    if (type === "remove") {
      setActiveTab("Removed");
      setPage(1);
    }
    refreshData();
  };

  return (
    <div className="space-y-6 animate-page-in">
      {/* Top Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-ink">Stock Write-Off</h2>
          <p className="mt-1 type-body text-ink-muted">
            Request, review, and remove expired, damaged, spoiled, or lost inventory items per batch / lot
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-control bg-surface border border-border px-4 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-10 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          {isAdmin && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex items-center justify-center gap-2 rounded-control bg-surface border border-border px-4 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-10 cursor-pointer"
            >
              <Link href="/inventory/logs">
                <History className="w-4 h-4" /> Transaction History
              </Link>
            </Button>
          )}

          {isImsManager && (
            <Button
              type="button"
              onClick={() => setOpenCreateModal(true)}
              className="flex items-center justify-center gap-2 rounded-control bg-primary px-5 py-2.5 type-label-button text-primary-foreground hover:bg-primary-hover transition-colors shadow-xs h-10 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Stock Write-Off
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="mb-6 rounded-card border border-border bg-surface p-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SearchInput
            containerClassName="flex-1"
            placeholder="Search by SWO No. (e.g. SWO-2026-0001), Item Name, Batch/Lot, or Requester..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <div className="flex items-center gap-3">
            <Select
              value={reasonFilter === "" ? "all" : reasonFilter}
              onValueChange={(val) => {
                setReasonFilter(val === "all" ? "" : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 min-w-[210px] w-auto rounded-control border border-border bg-surface px-3.5 type-body text-ink shadow-xs focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="All Write-Off Reasons" />
              </SelectTrigger>
              <SelectContent side="bottom" sideOffset={4} align="end" avoidCollisions={false} className="min-w-[210px]">
                <SelectItem value="all">All Write-Off Reasons</SelectItem>
                {SWO_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Status Tabs Row (Matches PRTab pill tabs) */}
      <div className="border-b border-divider overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max pb-2">
          {/* Requests Tab (Visible to Admin only) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("Requests");
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-pill type-label-tab font-semibold transition-all cursor-pointer ${
                activeTab === "Requests"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-subtle text-ink-muted hover:text-ink"
              }`}
            >
              <span>Requests</span>
              {counts.Requests > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-pill type-caption font-semibold ${
                    activeTab === "Requests"
                      ? "bg-surface text-ink"
                      : "bg-subtle text-ink"
                  }`}
                >
                  {counts.Requests}
                </span>
              )}
            </button>
          )}

          {/* Standard Status Tabs: All, Pending Approval, Approved, Removed, Rejected, Cancelled */}
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-pill type-label-tab font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-ink-muted hover:text-ink hover:bg-subtle"
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-pill type-caption font-mono font-medium ${
                    isSelected
                      ? "bg-surface text-ink"
                      : "bg-subtle text-ink-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Helper Banner */}
      {isAdmin && activeTab === "Requests" && (
        <div className="p-3 rounded-control border border-border bg-subtle type-body text-ink flex items-center gap-2">
          <Inbox className="w-4 h-4 text-ink shrink-0" />
          <span>
            Showing all Stock Write-Off requests pending your review. Approve or Reject requests here. Rejected SWO numbers are permanently retired.
          </span>
        </div>
      )}

      {isAdmin && activeTab !== "Requests" && (
        <div className="p-3 rounded-control border border-border bg-subtle type-body text-ink-muted flex items-center gap-2">
          <Inbox className="w-4 h-4 text-ink-muted shrink-0" />
          <span>
            Viewing mode only. Switch to the <strong className="text-ink font-semibold">Requests</strong> tab to approve or reject pending Stock Write-Off requests.
          </span>
        </div>
      )}

      {/* SWO Table */}
      <SWOTable
        writeOffs={paginatedList}
        isAdmin={isAdmin}
        isImsManager={isImsManager}
        isRequestsTab={activeTab === "Requests"}
        onView={(swo) => setSelectedSWO(swo)}
        onApprove={(swo) => setActionModal({ swo, type: "approve" })}
        onReject={(swo) => setActionModal({ swo, type: "reject" })}
        onCancel={(swo) => setActionModal({ swo, type: "cancel" })}
        onRemoveFromInventory={(swo) => setActionModal({ swo, type: "remove" })}
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      {/* Details / Review Modal */}
      <SWODetailsModal
        swo={selectedSWO}
        isAdmin={isAdmin}
        isImsManager={isImsManager}
        isRequestsTab={activeTab === "Requests"}
        onClose={() => setSelectedSWO(null)}
        onApprove={(swo) => {
          setSelectedSWO(null);
          setActionModal({ swo, type: "approve" });
        }}
        onReject={(swo) => {
          setSelectedSWO(null);
          setActionModal({ swo, type: "reject" });
        }}
        onCancel={(swo) => {
          setSelectedSWO(null);
          setActionModal({ swo, type: "cancel" });
        }}
        onRemoveFromInventory={(swo) => {
          setSelectedSWO(null);
          setActionModal({ swo, type: "remove" });
        }}
      />

      {/* Confirmation Action Modal (Approve / Reject / Cancel / Remove Items in Inventory) */}
      {actionModal && (
        <SWOActionModal
          actionType={actionModal.type}
          writeOff={actionModal.swo}
          onClose={() => setActionModal(null)}
          onConfirm={handleConfirmAction}
        />
      )}

      {/* Create Stock Write-Off Modal */}
      {openCreateModal && (
        <CreateSWOModal
          open={openCreateModal}
          onClose={() => setOpenCreateModal(false)}
          onSuccess={(msg) => {
            setOpenCreateModal(false);
            toast.success(msg || "Stock Write-Off request submitted.");
            refreshData();
          }}
          initialWriteOffs={initialWriteOffs}
          initialInventories={initialInventories}
          initialLots={initialLots}
          initialCategories={initialCategories}
        />
      )}
    </div>
  );
}
