"use client";

import React, { useMemo, useState } from "react";
import { Check, ArrowRight, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SearchInput } from "@/components/shared/SearchInput";
import Pagination from "@/components/Pagination";
import { TransferSkeleton } from "./TransferSkeleton";
import type { BranchRequestSubtab, BranchStockRequest } from "./types";

interface BranchRequestsTabProps {
  branchRequests: BranchStockRequest[];
  loading: boolean;
  canReview: boolean;
  canTransfer: boolean;
  onView: (req: BranchStockRequest) => void;
  onApprove: (req: BranchStockRequest) => void;
  onReject: (req: BranchStockRequest) => void;
  onTransferNow: (req: BranchStockRequest) => void;
  onRetrySync: (req: BranchStockRequest) => void;
}

const SUBTABS: Array<{ key: BranchRequestSubtab; label: string }> = [
  { key: "requests", label: "Requests" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
];

const FOOTER_MESSAGES: Record<BranchRequestSubtab, string> = {
  requests:
    "Incoming POS branch requests appear here automatically (read-only intake). Click any row to inspect stock levels & SKU details, or approve/reject inline.",
  approved:
    "Click Transfer Now to open Create Stock Transfer Request pre-filled with remaining units. Click any row to inspect linked STRs and fulfillment details.",
  rejected:
    "Rejected requests are final in POS. Click any row to view full rejection remarks and reviewer details.",
  cancelled:
    "Requests cancelled by the branch in POS before IMS decided appear here. Click any row to view the cancellation reason.",
  completed:
    "Branch requests move here automatically once 100% of approved units reach the Scheduled stage (or beyond) in Stock Transfers.",
};

function formatDisplayDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BranchRequestsTab({
  branchRequests,
  loading,
  canReview,
  canTransfer,
  onView,
  onApprove,
  onReject,
  onTransferNow,
  onRetrySync,
}: BranchRequestsTabProps) {
  const [activeSubtab, setActiveSubtab] = useState<BranchRequestSubtab>("requests");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const counts = useMemo(() => {
    const map: Record<BranchRequestSubtab, number> = {
      requests: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      completed: 0,
    };
    for (const r of branchRequests) {
      map[r.subtab] = (map[r.subtab] || 0) + 1;
    }
    return map;
  }, [branchRequests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branchRequests.filter((r) => {
      if (r.subtab !== activeSubtab) return false;
      if (!q) return true;
      return (
        r.requestNumber.toLowerCase().includes(q) ||
        r.branchName.toLowerCase().includes(q) ||
        r.requestedByName.toLowerCase().includes(q) ||
        r.items.some(
          (i) =>
            i.productName.toLowerCase().includes(q) ||
            i.variationName.toLowerCase().includes(q) ||
            i.sku.toLowerCase().includes(q)
        ) ||
        r.linkedStrs.some((s) => s.requestNumber.toLowerCase().includes(q))
      );
    });
  }, [branchRequests, activeSubtab, search]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginated = useMemo(() => {
    const start = (Math.min(page, totalPages) - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, totalPages]);

  return (
    <div className="space-y-4">
      {/* Subtabs + Search Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-1 min-w-max">
            {SUBTABS.map((tab) => {
              const isSelected = activeSubtab === tab.key;
              const count = counts[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveSubtab(tab.key);
                    setPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-control type-label-tab transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-status-purple-bg text-primary"
                      : "text-ink-muted hover:text-ink hover:bg-subtle"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <SearchInput
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search SR ID, branch, SKU..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Table Card */}
      {loading ? (
        <TransferSkeleton />
      ) : paginated.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-12 text-center space-y-2">
          <p className="type-body text-ink-muted">
            {activeSubtab === "requests"
              ? "No incoming branch stock requests waiting for review."
              : activeSubtab === "approved"
              ? "No approved branch stock requests awaiting transfer."
              : activeSubtab === "rejected"
              ? "No rejected branch stock requests."
              : activeSubtab === "cancelled"
              ? "No cancelled branch stock requests."
              : "No completed branch stock requests yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
          <div className="w-full overflow-x-auto lg:overflow-x-visible">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="border-b border-divider">
                <tr>
                  <th className="w-[11%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                    Request ID
                  </th>
                  <th className="w-[17%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                    Branch
                  </th>
                  <th
                    className={`${
                      activeSubtab === "completed" ? "w-[28%]" : "w-[22%]"
                    } pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap`}
                  >
                    Product
                  </th>

                  {activeSubtab === "requests" && (
                    <>
                      <th className="w-[9%] pb-2.5 pt-1 pr-5 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Req. Qty
                      </th>
                      <th className="w-[14%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Requested By
                      </th>
                      <th className="w-[10%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Status
                      </th>
                      <th className="w-[17%] pb-2.5 pt-1 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Actions
                      </th>
                    </>
                  )}

                  {activeSubtab === "approved" && (
                    <>
                      <th className="w-[9%] pb-2.5 pt-1 pr-4 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Approved
                      </th>
                      <th className="w-[11%] pb-2.5 pt-1 pr-5 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Remaining
                      </th>
                      <th className="w-[11%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Status
                      </th>
                      <th className="w-[19%] pb-2.5 pt-1 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Actions
                      </th>
                    </>
                  )}

                  {activeSubtab === "rejected" && (
                    <>
                      <th className="w-[10%] pb-2.5 pt-1 pr-5 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Req. Qty
                      </th>
                      <th className="w-[16%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Rejected By
                      </th>
                      <th className="w-[12%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Date
                      </th>
                      <th className="w-[12%] pb-2.5 pt-1 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Status
                      </th>
                    </>
                  )}

                  {activeSubtab === "cancelled" && (
                    <>
                      <th className="w-[10%] pb-2.5 pt-1 pr-5 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Req. Qty
                      </th>
                      <th className="w-[16%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Cancelled By
                      </th>
                      <th className="w-[12%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Date
                      </th>
                      <th className="w-[12%] pb-2.5 pt-1 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Status
                      </th>
                    </>
                  )}

                  {activeSubtab === "completed" && (
                    <>
                      <th className="w-[13%] pb-2.5 pt-1 pr-5 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Fulfilled Qty
                      </th>
                      <th className="w-[16%] pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Transfer Stage
                      </th>
                      <th className="w-[15%] pb-2.5 pt-1 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Status
                      </th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-divider">
                {paginated.map((req) => {
                  const first = req.items[0];
                  const productDisplay = first
                    ? `${first.productName}${first.variationName ? ` · ${first.variationName}` : ""}`
                    : "—";
                  const syncFailed = req.posSyncStatus === "Failed";

                  return (
                    <tr
                      key={req.branchRequestId}
                      onClick={() => onView(req)}
                      className="group hover:bg-page transition-colors cursor-pointer"
                    >
                      {/* Request ID */}
                      <td className="py-3.5 pr-3 type-body font-medium text-primary whitespace-nowrap tabular-nums">
                        <span className="group-hover:underline">{req.requestNumber}</span>
                      </td>

                      {/* Branch */}
                      <td
                        className="py-3.5 pr-3 type-body text-ink truncate"
                        title={req.branchName}
                      >
                        {req.branchName}
                      </td>

                      {/* Product (strictly single-line) */}
                      <td
                        className="py-3.5 pr-3 type-body text-ink truncate"
                        title={first ? `${productDisplay} (${first.sku})` : undefined}
                      >
                        {productDisplay}
                      </td>

                      {/* REQUESTS SUBTAB CELLS */}
                      {activeSubtab === "requests" && (
                        <>
                          <td className="py-3.5 pr-5 text-right type-body font-medium text-ink whitespace-nowrap tabular-nums">
                            {req.totalRequested} pcs
                          </td>
                          <td
                            className="py-3.5 pr-3 type-body text-ink truncate"
                            title={req.requestedByName}
                          >
                            {req.requestedByName}
                          </td>
                          <td className="py-3.5 pr-3 whitespace-nowrap">
                            <StatusBadge status="Submitted" />
                          </td>
                          <td
                            className="py-3.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canReview ? (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onReject(req)}
                                  className="h-8 px-2.5 rounded-control border border-input bg-surface type-label-button-sm text-destructive hover:bg-subtle transition-colors cursor-pointer"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onApprove(req)}
                                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-control border border-input bg-surface type-label-button-sm text-ink hover:bg-subtle transition-colors cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                              </div>
                            ) : (
                              <span className="type-caption text-ink-muted">View only</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* APPROVED SUBTAB CELLS */}
                      {activeSubtab === "approved" && (
                        <>
                          <td className="py-3.5 pr-4 text-right type-body font-medium text-ink whitespace-nowrap tabular-nums">
                            {req.totalApproved} pcs
                          </td>
                          <td className="py-3.5 pr-5 text-right type-body font-semibold text-primary whitespace-nowrap tabular-nums">
                            {req.totalRemaining} pcs left
                          </td>
                          <td className="py-3.5 pr-3 whitespace-nowrap">
                            <StatusBadge status="Approved" />
                          </td>
                          <td
                            className="py-3.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {syncFailed && canReview && (
                                <button
                                  type="button"
                                  onClick={() => onRetrySync(req)}
                                  className="inline-flex items-center gap-1 h-8 px-2 rounded-control border border-input bg-surface type-caption text-destructive hover:bg-subtle cursor-pointer"
                                  title="POS sync failed — click to retry"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Sync</span>
                                </button>
                              )}
                              {req.totalRemaining > 0 ? (
                                canTransfer ? (
                                  <button
                                    type="button"
                                    onClick={() => onTransferNow(req)}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-control bg-primary text-on-brand type-label-button-sm hover:bg-primary-hover transition-colors cursor-pointer"
                                  >
                                    <span>Transfer Now</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="type-caption text-ink-muted">
                                    Awaiting Transfer
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center h-8 px-2.5 rounded-control border border-border bg-subtle type-caption text-ink-muted">
                                  Pending Schedule
                                </span>
                              )}
                            </div>
                          </td>
                        </>
                      )}

                      {/* REJECTED SUBTAB CELLS */}
                      {activeSubtab === "rejected" && (
                        <>
                          <td className="py-3.5 pr-5 text-right type-body font-medium text-ink whitespace-nowrap tabular-nums">
                            {req.totalRequested} pcs
                          </td>
                          <td
                            className="py-3.5 pr-3 type-body text-ink truncate"
                            title={req.decidedByName || undefined}
                          >
                            {req.decidedByName || "—"}
                          </td>
                          <td className="py-3.5 pr-3 type-body text-ink whitespace-nowrap">
                            {formatDisplayDate(req.decidedAt)}
                          </td>
                          <td
                            className="py-3.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {syncFailed && canReview && (
                                <button
                                  type="button"
                                  onClick={() => onRetrySync(req)}
                                  className="inline-flex items-center gap-1 h-7 px-2 rounded-control border border-input bg-surface type-caption text-destructive hover:bg-subtle cursor-pointer"
                                  title="POS sync failed — click to retry"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              )}
                              <StatusBadge status="Rejected" />
                            </div>
                          </td>
                        </>
                      )}

                      {/* CANCELLED SUBTAB CELLS */}
                      {activeSubtab === "cancelled" && (
                        <>
                          <td className="py-3.5 pr-5 text-right type-body font-medium text-ink whitespace-nowrap tabular-nums">
                            {req.totalRequested} pcs
                          </td>
                          <td
                            className="py-3.5 pr-3 type-body text-ink truncate"
                            title={req.cancelledByName || "Branch Staff"}
                          >
                            {req.cancelledByName || "Branch Staff"}
                          </td>
                          <td className="py-3.5 pr-3 type-body text-ink whitespace-nowrap">
                            {formatDisplayDate(req.cancelledAt || null)}
                          </td>
                          <td className="py-3.5 text-right whitespace-nowrap">
                            <StatusBadge status="Cancelled" />
                          </td>
                        </>
                      )}

                      {/* COMPLETED SUBTAB CELLS */}
                      {activeSubtab === "completed" && (
                        <>
                          <td className="py-3.5 pr-5 text-right type-body font-medium text-ink whitespace-nowrap tabular-nums">
                            {req.totalScheduled > 0 ? req.totalApproved : req.totalAllocated} /{" "}
                            {req.totalApproved} pcs
                          </td>
                          <td className="py-3.5 pr-3 whitespace-nowrap">
                            <StatusBadge status={req.transferStage} />
                          </td>
                          <td className="py-3.5 text-right whitespace-nowrap">
                            <StatusBadge status="Completed" />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Embedded Pagination */}
          {totalCount > pageSize && (
            <Pagination
              currentPage={Math.min(page, totalPages)}
              totalPages={totalPages}
              totalCount={totalCount}
              itemsPerPage={pageSize}
              onPageChange={(p) => setPage(p)}
              embedded
            />
          )}

          {/* Contextual Info Strip */}
          <div className="rounded-control bg-subtle px-3 py-2.5 type-caption text-ink-muted">
            {FOOTER_MESSAGES[activeSubtab]}
          </div>
        </div>
      )}
    </div>
  );
}
