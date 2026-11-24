"use client";

import React, { useMemo, useState } from "react";
import { Check, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
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
  { key: "completed", label: "Completed" },
];

const FOOTER_MESSAGES: Record<BranchRequestSubtab, string> = {
  requests:
    "Incoming POS branch requests appear here automatically (read-only intake). Approving or rejecting immediately syncs the verdict back to POS.",
  approved:
    "Click Transfer Now to open Create Stock Transfer Request pre-filled with remaining units. Cancelled or rejected STRs automatically release their quantity back here.",
  rejected:
    "Rejected requests are final in POS. The branch immediately sees your rejection remarks and can submit a fresh request if needed.",
  completed:
    "Branch requests move here automatically once 100% of approved units reach the Scheduled stage (or beyond) in Stock Transfers.",
};

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
      {/* 4 Subtabs + Search Row (Matching Figma Prototype) */}
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
              : "No completed branch stock requests yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-divider">
                <tr>
                  <th className="py-2.5 pr-4 text-left type-table-header text-ink-muted whitespace-nowrap">
                    Request ID
                  </th>
                  <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                    Branch
                  </th>
                  <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                    Product &amp; SKU
                  </th>

                  {activeSubtab === "requests" && (
                    <>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Branch Stock
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Req. Qty
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Requested by
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Status
                      </th>
                      <th className="pl-3 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Actions
                      </th>
                    </>
                  )}

                  {activeSubtab === "approved" && (
                    <>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Approved
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Transfer Progress
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Linked STRs
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Status
                      </th>
                      <th className="pl-3 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Actions
                      </th>
                    </>
                  )}

                  {activeSubtab === "rejected" && (
                    <>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Req. Qty
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Rejection Remarks
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Rejected by
                      </th>
                      <th className="pl-3 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Status
                      </th>
                    </>
                  )}

                  {activeSubtab === "completed" && (
                    <>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Approved Qty
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Fulfilled via STRs
                      </th>
                      <th className="px-3 py-2.5 text-left type-table-header text-ink-muted whitespace-nowrap">
                        Transfer Stage
                      </th>
                      <th className="pl-3 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                        Status
                      </th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-divider">
                {paginated.map((req) => {
                  const first = req.items[0];
                  const progressPct =
                    req.totalApproved > 0
                      ? Math.min(100, Math.round((req.totalAllocated / req.totalApproved) * 100))
                      : 0;
                  const activeStrs = req.linkedStrs.filter(
                    (s) => s.status !== "Cancelled" && s.status !== "Rejected"
                  );
                  const cancelledStrs = req.linkedStrs.filter(
                    (s) => s.status === "Cancelled" || s.status === "Rejected"
                  );
                  const syncFailed = req.posSyncStatus === "Failed";

                  return (
                    <tr
                      key={req.branchRequestId}
                      onClick={() => onView(req)}
                      className="group hover:bg-page transition-colors cursor-pointer"
                    >
                      {/* Request ID */}
                      <td className="py-3.5 pr-4 type-body font-medium text-primary whitespace-nowrap">
                        <span className="group-hover:underline">{req.requestNumber}</span>
                      </td>

                      {/* Branch */}
                      <td className="px-3 py-3.5 type-body text-ink whitespace-nowrap">
                        {req.branchName}
                      </td>

                      {/* Product & SKU */}
                      <td className="px-3 py-3.5 min-w-[200px]">
                        {first ? (
                          <div>
                            <div className="type-body text-ink">
                              {first.productName}
                              {first.variationName ? ` · ${first.variationName}` : ""}
                            </div>
                            <div className="type-caption text-ink-muted">{first.sku}</div>
                          </div>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>

                      {/* REQUESTS SUBTAB CELLS */}
                      {activeSubtab === "requests" && (
                        <>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <span className="type-body-secondary font-medium text-status-amber-fg tabular-nums">
                              {first ? `${first.branchCurrentStock} on-hand` : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <div className="type-body font-semibold text-ink tabular-nums">
                              {req.totalRequested} pcs
                            </div>
                            {first && (
                              <div className="type-caption text-ink-muted tabular-nums">
                                IMS: {first.imsAvailableStock} avail
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <div className="type-body text-ink">{req.requestedByName}</div>
                            <div className="type-caption text-ink-muted">
                              {formatShortDate(req.requestDate)}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <StatusBadge status="Submitted" />
                          </td>
                          <td
                            className="pl-3 py-3.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canReview ? (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onReject(req)}
                                  className="h-8 px-3 rounded-control border border-border bg-surface type-label-button-sm text-destructive hover:bg-subtle transition-colors cursor-pointer"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onApprove(req)}
                                  className="inline-flex items-center gap-1 h-8 px-3 rounded-control border border-border bg-surface type-label-button-sm text-ink hover:bg-subtle transition-colors cursor-pointer"
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
                          <td className="px-3 py-3.5 whitespace-nowrap type-body font-semibold text-ink tabular-nums">
                            {req.totalApproved} pcs
                          </td>
                          <td className="px-3 py-3.5 min-w-[185px]">
                            <div className="space-y-1.5">
                              <div className="type-caption font-medium text-ink tabular-nums">
                                {req.totalRemaining > 0 ? (
                                  <>
                                    {req.totalAllocated} / {req.totalApproved} transferred ·{" "}
                                    <span className="text-primary font-semibold">
                                      {req.totalRemaining} left
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-primary font-semibold">
                                    {req.totalAllocated} / {req.totalApproved} allocated · 0 left
                                  </span>
                                )}
                              </div>
                              <div className="h-1.5 w-40 rounded-full bg-status-purple-bg overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${Math.max(progressPct > 0 ? 4 : 0, progressPct)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 max-w-[200px]">
                            {activeStrs.length > 0 ? (
                              <div className="space-y-0.5">
                                {activeStrs.map((s) => (
                                  <div key={s.requestId} className="type-caption text-ink-muted">
                                    <span className="font-medium text-primary">{s.requestNumber}</span>{" "}
                                    ({s.quantity} · {s.status})
                                  </div>
                                ))}
                              </div>
                            ) : cancelledStrs.length > 0 ? (
                              <span className="type-caption text-ink-muted">
                                {cancelledStrs[0].requestNumber} cancelled ({cancelledStrs[0].quantity}{" "}
                                released)
                              </span>
                            ) : (
                              <span className="type-caption text-ink-muted">None yet</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <StatusBadge status="Approved" />
                              {syncFailed && (
                                <span className="inline-flex items-center gap-1 type-caption text-destructive">
                                  <AlertCircle className="w-3 h-3" /> POS unsynced
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="pl-3 py-3.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {syncFailed && canReview && (
                                <button
                                  type="button"
                                  onClick={() => onRetrySync(req)}
                                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-control border border-border bg-surface type-caption text-ink hover:bg-subtle cursor-pointer"
                                  title="Retry syncing approval decision to POS"
                                >
                                  <RefreshCw className="w-3 h-3" /> Retry Sync
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
                                <span className="inline-flex items-center h-8 px-3 rounded-control border border-border bg-subtle type-caption text-ink-muted">
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
                          <td className="px-3 py-3.5 whitespace-nowrap type-body font-medium text-ink tabular-nums">
                            {req.totalRequested} pcs
                          </td>
                          <td className="px-3 py-3.5 max-w-[300px]">
                            <p className="type-body-secondary text-ink line-clamp-2">
                              {req.decisionRemarks || "—"}
                            </p>
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <div className="type-body text-ink">{req.decidedByName || "—"}</div>
                            <div className="type-caption text-ink-muted">
                              {formatShortDate(req.decidedAt)}
                            </div>
                          </td>
                          <td
                            className="pl-3 py-3.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-2">
                              {syncFailed && canReview && (
                                <button
                                  type="button"
                                  onClick={() => onRetrySync(req)}
                                  className="inline-flex items-center gap-1 h-7 px-2 rounded-control border border-border bg-surface type-caption text-ink hover:bg-subtle cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" /> Retry Sync
                                </button>
                              )}
                              <StatusBadge status="Rejected" />
                            </div>
                          </td>
                        </>
                      )}

                      {/* COMPLETED SUBTAB CELLS */}
                      {activeSubtab === "completed" && (
                        <>
                          <td className="px-3 py-3.5 whitespace-nowrap type-body font-semibold text-ink tabular-nums">
                            {req.totalScheduled > 0 ? req.totalApproved : req.totalAllocated} /{" "}
                            {req.totalApproved} pcs
                          </td>
                          <td className="px-3 py-3.5 max-w-[240px]">
                            <div className="type-body-secondary text-primary">
                              {activeStrs.length > 0
                                ? activeStrs.map((s) => `${s.requestNumber} (${s.quantity})`).join(" · ")
                                : "—"}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <StatusBadge status={req.transferStage} />
                          </td>
                          <td className="pl-3 py-3.5 text-right whitespace-nowrap">
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

          {/* Contextual Info Strip (Matching Figma) */}
          <div className="rounded-control bg-subtle px-3 py-2.5 type-caption text-ink-muted">
            {FOOTER_MESSAGES[activeSubtab]}
          </div>
        </div>
      )}
    </div>
  );
}
