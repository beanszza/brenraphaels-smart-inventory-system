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
import { SWODetailsView } from "./SWODetailsModal";
import { SWOActionModal, type SWOActionType } from "./SWOActionModal";
import { CreateSWOForm } from "./CreateSWOModal";
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

  // Full-page Create Stock Write-Off view (replaces modal, matching CreatePRForm)
  if (openCreateModal) {
    return (
      <CreateSWOForm
        embedded
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
    );
  }

  // Full-page Stock Write-Off Details / Admin Review view (replaces modal, matching PRDetailsView)
  if (selectedSWO) {
    const latestSwo =
      initialWriteOffs.find((w) => w.writeOffId === selectedSWO.writeOffId) || selectedSWO;
    return (
      <>
        <SWODetailsView
          embedded
          swo={latestSwo}
          isAdmin={isAdmin}
          isImsManager={isImsManager}
          isRequestsTab={activeTab === "Requests"}
          onClose={() => setSelectedSWO(null)}
          onApprove={(swo) => setActionModal({ swo, type: "approve" })}
          onReject={(swo) => setActionModal({ swo, type: "reject" })}
          onCancel={(swo) => setActionModal({ swo, type: "cancel" })}
          onRemoveFromInventory={(swo) => setActionModal({ swo, type: "remove" })}
        />

        {actionModal && (
          <SWOActionModal
            actionType={actionModal.type}
            writeOff={actionModal.swo}
            onClose={() => setActionModal(null)}
            onConfirm={handleConfirmAction}
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
          <h2 className="type-page-title text-ink">Stock Write-Off</h2>
          <p className="mt-1 type-body text-ink-muted">
            Request, review, and remove expired, damaged, spoiled, or lost inventory items per batch / lot
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-control bg-surface border border-border px-3.5 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-9 shadow-none cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          {isAdmin && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex items-center justify-center gap-1.5 rounded-control bg-surface border border-border px-3.5 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-9 shadow-none cursor-pointer"
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
              className="flex items-center justify-center gap-1.5 rounded-control bg-primary px-3.5 py-2 type-label-button text-on-brand hover:bg-primary-hover transition-colors h-9 shadow-none cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Stock Write-Off
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
          value={reasonFilter === "" ? "all" : reasonFilter}
          onValueChange={(val) => {
            setReasonFilter(val === "all" ? "" : val);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-[38px] w-full sm:w-auto sm:min-w-[240px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
            <span className="truncate">
              <span className="text-ink-muted font-normal mr-1.5">Reason:</span>
              <span className="font-medium text-ink">
                <SelectValue placeholder="All Write-Off Reasons" />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            sideOffset={4}
            align="start"
            avoidCollisions={false}
            className="min-w-[240px] max-h-72"
          >
            <SelectItem value="all">All Write-Off Reasons</SelectItem>
            {SWO_REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchInput
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search SWO No., item, or lot..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Active Tab Helper Banner */}
      {isAdmin && activeTab === "Requests" && (
        <div className="p-3 rounded-card border border-border bg-subtle type-caption text-ink flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary shrink-0" />
          <span>
            Showing all Stock Write-Off requests pending your review. Approve or Reject requests here. Rejected SWO numbers are permanently retired.
          </span>
        </div>
      )}

      {isAdmin && activeTab !== "Requests" && (
        <div className="p-3 rounded-card border border-border bg-subtle type-caption text-ink-muted flex items-center gap-2">
          <Inbox className="w-4 h-4 text-ink-muted shrink-0" />
          <span>
            Viewing mode only. Switch to the <strong className="text-ink font-semibold">Requests</strong> tab to approve or reject pending Stock Write-Off requests.
          </span>
        </div>
      )}

      {/* Padded Table Card */}
      <div className="rounded-card border border-border bg-surface p-5">
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

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={setPage}
          embedded
        />
      </div>

      {/* Confirmation Action Modal (Approve / Reject / Cancel / Remove Items in Inventory) */}
      {actionModal && (
        <SWOActionModal
          actionType={actionModal.type}
          writeOff={actionModal.swo}
          onClose={() => setActionModal(null)}
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  );
}
