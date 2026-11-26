"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import type { BranchStockRequest } from "./types";

interface BranchRequestDetailsModalProps {
  request: BranchStockRequest | null;
  open: boolean;
  canReview: boolean;
  canTransfer: boolean;
  onClose: () => void;
  onApprove: (req: BranchStockRequest) => void;
  onReject: (req: BranchStockRequest) => void;
  onTransferNow: (req: BranchStockRequest) => void;
  onRetrySync: (req: BranchStockRequest) => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BranchRequestDetailsModal({
  request,
  open,
  canReview,
  canTransfer,
  onClose,
  onApprove,
  onReject,
  onTransferNow,
  onRetrySync,
}: BranchRequestDetailsModalProps) {
  if (!open || !request) return null;

  const isPending = request.subtab === "requests";
  const canCreateStr = request.subtab === "approved" && request.totalRemaining > 0 && canTransfer;
  const headerStatus = request.subtab === "completed" ? "Completed" : request.status;
  const isCancelled = request.status === "Cancelled";
  const hasDecision = Boolean(request.decidedByName) && !isCancelled;
  const syncFailed = request.posSyncStatus && request.posSyncStatus !== "Synced";

  const hasNotes = Boolean(
    request.notes ||
      (isCancelled && request.cancelReason) ||
      (hasDecision && request.decisionRemarks)
  );

  return (
    <ModalWrapper
      open={open}
      title={`Branch Stock Request — ${request.requestNumber}`}
      titleBadge={<StatusBadge status={headerStatus} />}
      onClose={onClose}
      maxWidthPx={760}
      confirmOnClose={false}
    >
      <div className="space-y-5 text-ink">
        {/* Formal 4-Column Metadata Block (Matches StockInDetailsModal) */}
        <div className="rounded-control border border-divider bg-page p-4 space-y-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="block type-caption text-ink-muted">Request No.</span>
              <span className="mt-0.5 block type-body-secondary font-semibold text-ink tabular-nums">
                {request.requestNumber}
              </span>
            </div>
            <div>
              <span className="block type-caption text-ink-muted">Branch</span>
              <span
                className="mt-0.5 block type-body-secondary font-semibold text-ink truncate"
                title={request.branchName}
              >
                {request.branchName}
              </span>
            </div>
            <div>
              <span className="block type-caption text-ink-muted">Requested By</span>
              <span
                className="mt-0.5 block type-body-secondary font-semibold text-ink truncate"
                title={request.requestedByName}
              >
                {request.requestedByName}
              </span>
            </div>
            <div>
              <span className="block type-caption text-ink-muted">Requested Date</span>
              <span className="mt-0.5 block type-body-secondary font-semibold text-ink">
                {formatDate(request.requestDate)}
              </span>
            </div>
          </div>

          {hasDecision && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-divider pt-3">
              <div>
                <span className="block type-caption text-ink-muted">
                  {request.status === "Rejected" ? "Rejected By" : "Approved By"}
                </span>
                <span
                  className="mt-0.5 block type-body-secondary font-semibold text-ink truncate"
                  title={request.decidedByName || undefined}
                >
                  {request.decidedByName}
                </span>
              </div>
              <div>
                <span className="block type-caption text-ink-muted">Decision Date</span>
                <span className="mt-0.5 block type-body-secondary font-semibold text-ink">
                  {formatDate(request.decidedAt)}
                </span>
              </div>
              <div>
                <span className="block type-caption text-ink-muted">POS Sync</span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={`type-body-secondary font-semibold ${
                      syncFailed ? "text-destructive" : "text-ink"
                    }`}
                  >
                    {request.posSyncStatus || "Synced"}
                  </span>
                  {syncFailed && canReview && (
                    <button
                      type="button"
                      onClick={() => onRetrySync(request)}
                      className="inline-flex items-center gap-1 type-caption font-medium text-primary underline hover:opacity-80 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                </div>
              </div>
              <div>
                <span className="block type-caption text-ink-muted">
                  {request.status === "Rejected" ? "Requested" : "Allocated"}
                </span>
                <span className="mt-0.5 block type-body-secondary font-semibold text-ink tabular-nums">
                  {request.status === "Rejected"
                    ? `${request.totalRequested} pcs`
                    : `${request.totalAllocated} / ${request.totalApproved} pcs`}
                </span>
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-divider pt-3">
              <div>
                <span className="block type-caption text-ink-muted">Cancelled By</span>
                <span className="mt-0.5 block type-body-secondary font-semibold text-ink truncate">
                  {request.cancelledByName || "Branch Staff"}
                </span>
              </div>
              <div>
                <span className="block type-caption text-ink-muted">Cancelled Date</span>
                <span className="mt-0.5 block type-body-secondary font-semibold text-ink">
                  {formatDate(request.cancelledAt)}
                </span>
              </div>
              <div>
                <span className="block type-caption text-ink-muted">Source</span>
                <span className="mt-0.5 block type-body-secondary font-semibold text-ink">POS</span>
              </div>
              <div>
                <span className="block type-caption text-ink-muted">Requested</span>
                <span className="mt-0.5 block type-body-secondary font-semibold text-ink tabular-nums">
                  {request.totalRequested} pcs
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Requested Item Table */}
        <div className="space-y-2">
          <span className="block type-overline uppercase tracking-wider text-ink-muted">
            Requested Item
          </span>
          <div className="overflow-x-auto rounded-control border border-border bg-surface">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-divider bg-page">
                <tr>
                  <th className="px-3.5 py-2.5 type-table-header text-ink-muted whitespace-nowrap">
                    Product
                  </th>
                  <th className="px-3.5 py-2.5 type-table-header text-ink-muted whitespace-nowrap">
                    SKU
                  </th>
                  <th className="px-3.5 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                    Branch
                  </th>
                  <th className="px-3.5 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                    IMS
                  </th>
                  <th className="px-3.5 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                    Requested
                  </th>
                  <th className="px-3.5 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                    Approved
                  </th>
                  <th className="px-3.5 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {request.items.map((item) => {
                  const showApproved =
                    request.status !== "Submitted" && request.status !== "Cancelled";
                  const showRemaining =
                    request.status !== "Submitted" &&
                    request.status !== "Rejected" &&
                    request.status !== "Cancelled";
                  return (
                    <tr key={item.branchRequestItemId}>
                      <td className="px-3.5 py-3 type-body-secondary font-semibold text-ink whitespace-nowrap">
                        {item.productName}
                        {item.variationName ? ` · ${item.variationName}` : ""}
                      </td>
                      <td className="px-3.5 py-3 type-body-secondary text-ink-muted whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className="px-3.5 py-3 text-right type-body-secondary tabular-nums text-status-amber-fg font-medium whitespace-nowrap">
                        {item.branchCurrentStock}
                      </td>
                      <td className="px-3.5 py-3 text-right type-body-secondary tabular-nums text-ink whitespace-nowrap">
                        {item.imsAvailableStock}
                      </td>
                      <td className="px-3.5 py-3 text-right type-body-secondary tabular-nums font-semibold text-ink whitespace-nowrap">
                        {item.requestedQuantity}
                      </td>
                      <td className="px-3.5 py-3 text-right type-body-secondary tabular-nums font-semibold text-primary whitespace-nowrap">
                        {showApproved ? item.approvedQuantity : "—"}
                      </td>
                      <td className="px-3.5 py-3 text-right type-body-secondary tabular-nums text-ink whitespace-nowrap">
                        {showRemaining ? item.remainingQuantity : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Linked Stock Transfers Table */}
        {request.linkedStrs.length > 0 && (
          <div className="space-y-2">
            <span className="block type-overline uppercase tracking-wider text-ink-muted">
              Linked Stock Transfers
            </span>
            <div className="overflow-x-auto rounded-control border border-border bg-surface">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-divider bg-page">
                  <tr>
                    <th className="px-3.5 py-2.5 type-table-header text-ink-muted whitespace-nowrap">
                      Transfer Request No.
                    </th>
                    <th className="px-3.5 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                      Allocated Qty
                    </th>
                    <th className="px-3.5 py-2.5 text-right type-table-header text-ink-muted whitespace-nowrap">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {request.linkedStrs.map((str) => (
                    <tr key={str.requestId}>
                      <td className="px-3.5 py-2.5 type-body-secondary font-medium text-primary whitespace-nowrap tabular-nums">
                        {str.requestNumber}
                      </td>
                      <td className="px-3.5 py-2.5 text-right type-body-secondary font-medium text-ink whitespace-nowrap tabular-nums">
                        {str.quantity} pcs
                      </td>
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <StatusBadge status={str.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Formal Notes Section */}
        {hasNotes && (
          <div className="space-y-1.5">
            <span className="block type-overline uppercase tracking-wider text-ink-muted">
              Notes
            </span>
            {request.notes && (
              <p className="type-body-secondary text-ink-secondary">{request.notes}</p>
            )}
            {hasDecision && request.decisionRemarks && (
              <p className="type-body-secondary text-ink-muted">
                <span className="font-medium text-ink">
                  {request.status === "Rejected" ? "Rejection Remarks: " : "Decision Remarks: "}
                </span>
                {request.decisionRemarks}
              </p>
            )}
            {isCancelled && request.cancelReason && (
              <p className="type-body-secondary text-ink-muted">
                <span className="font-medium text-ink">Cancellation Reason: </span>
                {request.cancelReason}
              </p>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-divider">
          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border border-input bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle cursor-pointer"
          >
            Close
          </ModalCloseButton>

          {isPending && canReview && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  onReject(request);
                }}
                className="rounded-control border border-input bg-surface px-4 h-9 type-label-button text-destructive hover:bg-subtle shadow-none cursor-pointer"
              >
                Reject
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onApprove(request);
                }}
                className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
              >
                Approve
              </Button>
            </>
          )}

          {canCreateStr && (
            <Button
              type="button"
              onClick={() => {
                onClose();
                onTransferNow(request);
              }}
              className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
            >
              Transfer Now
            </Button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
