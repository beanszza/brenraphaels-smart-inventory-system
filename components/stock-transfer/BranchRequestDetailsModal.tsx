"use client";

import React from "react";
import { MapPin, User, Calendar, Package, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
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

  return (
    <ModalWrapper
      open={open}
      title={`Branch Stock Request — ${request.requestNumber}`}
      onClose={onClose}
      size="max-w-3xl"
    >
      <div className="space-y-5 text-ink">
        {/* Status & Sync Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-divider">
          <div className="flex items-center gap-2">
            <StatusBadge status={request.subtab === "completed" ? "Completed" : request.status} />
            {request.subtab === "completed" && (
              <StatusBadge status={request.transferStage} />
            )}
          </div>
          {request.posSyncStatus && request.posSyncStatus !== "Synced" && (
            <div className="flex items-center gap-2 type-caption text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>POS Sync: {request.posSyncStatus}</span>
              <button
                type="button"
                onClick={() => onRetrySync(request)}
                className="underline font-medium text-primary hover:opacity-80 cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Retry Sync
              </button>
            </div>
          )}
        </div>

        {/* Request Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-card bg-subtle/60 border border-border">
          <div>
            <span className="type-caption text-ink-muted block mb-1">Branch</span>
            <div className="flex items-center gap-1.5 type-body font-medium text-ink">
              <MapPin className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <span>{request.branchName}</span>
            </div>
          </div>
          <div>
            <span className="type-caption text-ink-muted block mb-1">Requested By (POS)</span>
            <div className="flex items-center gap-1.5 type-body font-medium text-ink">
              <User className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <span>{request.requestedByName}</span>
            </div>
          </div>
          <div>
            <span className="type-caption text-ink-muted block mb-1">Requested At</span>
            <div className="flex items-center gap-1.5 type-body text-ink">
              <Calendar className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <span>{new Date(request.requestDate).toLocaleString()}</span>
            </div>
          </div>
          <div className="sm:col-span-3 pt-2 border-t border-divider">
            <span className="type-caption text-ink-muted block mb-1">Branch Request Notes</span>
            <p className="type-body-secondary text-ink">{request.notes || "—"}</p>
          </div>
          {request.status === "Cancelled" && (
            <div className="sm:col-span-3 pt-2 border-t border-divider space-y-1">
              <div>
                <span className="type-caption text-ink-muted">Cancelled by (POS): </span>
                <span className="type-body-secondary font-medium text-ink">
                  {request.cancelledByName || "Branch Staff"}
                </span>
                {request.cancelledAt && (
                  <span className="type-caption text-ink-muted">
                    {" "}on {new Date(request.cancelledAt).toLocaleString()}
                  </span>
                )}
              </div>
              {request.cancelReason && (
                <p className="type-body-secondary text-ink-secondary italic">
                  &ldquo;{request.cancelReason}&rdquo;
                </p>
              )}
            </div>
          )}
          {request.decidedByName && request.status !== "Cancelled" && (
            <div className="sm:col-span-3 pt-2 border-t border-divider flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="type-caption text-ink-muted">
                  {request.status === "Rejected" ? "Rejected by" : "Approved by"}:{" "}
                </span>
                <span className="type-body-secondary font-medium text-ink">
                  {request.decidedByName}
                </span>
                {request.decidedAt && (
                  <span className="type-caption text-ink-muted">
                    {" "}on {new Date(request.decidedAt).toLocaleString()}
                  </span>
                )}
              </div>
              {request.decisionRemarks && (
                <p className="w-full type-body-secondary text-ink-secondary italic">
                  &ldquo;{request.decisionRemarks}&rdquo;
                </p>
              )}
            </div>
          )}
        </div>

        {/* Requested Item(s) Table */}
        <div className="space-y-2">
          <h3 className="type-subsection text-ink flex items-center gap-2">
            <Package className="w-4 h-4 text-ink-muted" /> Requested Product
          </h3>
          <div className="rounded-card border border-border bg-surface overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-divider">
                <tr>
                  <th className="px-4 py-2.5 type-table-header text-ink-muted">Product &amp; SKU</th>
                  <th className="px-4 py-2.5 text-right type-table-header text-ink-muted">Branch Stock</th>
                  <th className="px-4 py-2.5 text-right type-table-header text-ink-muted">IMS Stock</th>
                  <th className="px-4 py-2.5 text-right type-table-header text-ink-muted">Requested</th>
                  <th className="px-4 py-2.5 text-right type-table-header text-ink-muted">Approved</th>
                  <th className="px-4 py-2.5 text-right type-table-header text-ink-muted">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {request.items.map((item) => (
                  <tr key={item.branchRequestItemId}>
                    <td className="px-4 py-3">
                      <div className="type-body font-medium text-ink">
                        {item.productName}
                        {item.variationName ? ` · ${item.variationName}` : ""}
                      </div>
                      <div className="type-caption text-ink-muted">{item.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right type-body tabular-nums text-status-amber-fg font-medium">
                      {item.branchCurrentStock}
                    </td>
                    <td className="px-4 py-3 text-right type-body tabular-nums text-ink">
                      {item.imsAvailableStock}
                    </td>
                    <td className="px-4 py-3 text-right type-body tabular-nums font-medium text-ink">
                      {item.requestedQuantity}
                    </td>
                    <td className="px-4 py-3 text-right type-body tabular-nums font-semibold text-primary">
                      {request.status === "Submitted" || request.status === "Cancelled"
                        ? "—"
                        : item.approvedQuantity}
                    </td>
                    <td className="px-4 py-3 text-right type-body tabular-nums font-semibold text-ink">
                      {request.status === "Submitted" ||
                      request.status === "Rejected" ||
                      request.status === "Cancelled"
                        ? "—"
                        : item.remainingQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Linked Stock Transfer Requests */}
        {request.linkedStrs.length > 0 && (
          <div className="space-y-2">
            <h3 className="type-subsection text-ink">
              Linked Stock Transfer Requests ({request.linkedStrs.length})
            </h3>
            <div className="rounded-card border border-border bg-surface divide-y divide-divider">
              {request.linkedStrs.map((str) => (
                <div
                  key={str.requestId}
                  className="px-4 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="type-body font-medium text-primary">{str.requestNumber}</span>
                    <span className="type-body-secondary text-ink tabular-nums">
                      {str.quantity} pcs
                    </span>
                  </div>
                  <StatusBadge status={str.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-divider">
          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle cursor-pointer"
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
                className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-subtle cursor-pointer"
              >
                Reject
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onApprove(request);
                }}
                className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover cursor-pointer"
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
              className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover gap-1.5 cursor-pointer"
            >
              <span>Transfer Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
