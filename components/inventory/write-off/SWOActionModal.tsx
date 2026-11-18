"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SWO_ACTION_NOTE_MAX } from "@/lib/inventory/write-off-validation";
import type { StockWriteOffDto } from "./types";

export type SWOActionType = "approve" | "reject" | "cancel" | "remove";

interface SWOActionModalProps {
  actionType: SWOActionType;
  writeOff: StockWriteOffDto;
  onConfirm: (notes?: string) => Promise<void> | void;
  onClose: () => void;
}

export function SWOActionModal({
  actionType,
  writeOff,
  onConfirm,
  onClose,
}: SWOActionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const requiresReason = actionType === "reject" || actionType === "cancel";
  const allowsOptionalNotes = actionType === "approve";

  const totalLotsCount = writeOff.items.reduce((acc, it) => acc + it.lines.length, 0);
  const fmtMoney = (n: number) =>
    `₱${Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const getTitle = () => {
    switch (actionType) {
      case "approve":
        return "Approve Stock Write-Off";
      case "reject":
        return "Reject Stock Write-Off";
      case "cancel":
        return "Cancel Stock Write-Off";
      case "remove":
        return "Remove Items from Inventory";
    }
  };

  const getDescription = () => {
    switch (actionType) {
      case "approve":
        return `Are you sure you want to approve Stock Write-Off ${writeOff.swoNumber}? Once approved, the Inventory Manager can proceed to remove these items from inventory.`;
      case "reject":
        return `Please provide a reason for rejecting Stock Write-Off ${writeOff.swoNumber}. The request will be closed as Rejected and ${writeOff.swoNumber} will be permanently blocked from reuse.`;
      case "cancel":
        return `Please provide a reason for cancelling Stock Write-Off ${writeOff.swoNumber}. This action cannot be undone and ${writeOff.swoNumber} will be permanently blocked from reuse.`;
      case "remove":
        return `Are you sure you want to remove the approved items in ${writeOff.swoNumber} from inventory? This will permanently deduct ${totalLotsCount} batch/lot line(s) across ${writeOff.items.length} item(s) and record the write-off in the stock ledger.`;
    }
  };

  const handleConfirm = async () => {
    if (requiresReason && !reason.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setSubmitError("");
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "The action could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="font-sans fixed inset-0 z-[300] flex items-center justify-center p-4 bg-scrim animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={getTitle()}
        className="w-full max-w-[480px] bg-surface rounded-modal shadow-modal border border-border overflow-hidden flex flex-col p-6 text-ink shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {submitError && (
          <p role="alert" className="mb-3 type-caption font-medium text-notice-danger text-center">
            {submitError}
          </p>
        )}
        <div className="flex flex-col items-center justify-center text-center">
          {/* Circular Alert Icon */}
          <div className="size-12 rounded-pill bg-subtle flex items-center justify-center mb-4 text-ink">
            <AlertTriangle className="size-6" />
          </div>

          {/* Title */}
          <h2 className="type-modal-title text-ink mb-1">{getTitle()}</h2>

          {/* SWO Number Subtitle */}
          <p className="type-caption font-semibold text-ink-muted mb-3">
            Stock Write-Off No: {writeOff.swoNumber}
          </p>

          {/* Message / Description */}
          <p className="type-body text-ink-muted mb-5 leading-relaxed">
            {getDescription()}
          </p>

          {/* Summary Box when removing items from inventory */}
          {actionType === "remove" && (
            <div className="w-full text-left rounded-inner border border-border bg-subtle p-3 mb-5 space-y-1.5 type-body">
              <div className="font-semibold text-ink mb-1">Items to Remove:</div>
              {writeOff.items.map((item) => {
                const totalItemQty = item.lines.reduce((s, l) => s + l.quantity, 0);
                return (
                  <div key={item.writeOffItemId} className="flex items-center justify-between gap-2 text-ink-muted">
                    <span className="truncate font-medium text-ink">
                      {item.itemName}
                      {item.variantName ? ` (${item.variantName})` : ""}
                    </span>
                    <span className="shrink-0 font-semibold text-ink tabular-nums">
                      {totalItemQty.toLocaleString()} {item.uomName} ({item.lines.length}{" "}
                      {item.lines.length === 1 ? "lot" : "lots"})
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reason / Notes Input */}
          {(requiresReason || allowsOptionalNotes) && (
            <div className="w-full text-left space-y-1.5 mb-5">
              <div className="flex items-center justify-between">
                <label className="type-label text-ink flex items-center gap-1">
                  {actionType === "approve"
                    ? "Approval Notes (Optional)"
                    : actionType === "cancel"
                    ? "Cancellation Reason"
                    : "Rejection Reason"}
                  {requiresReason && <span className="text-notice-danger">*</span>}
                </label>
                <span className="type-caption text-ink-muted">
                  {reason.length}/{SWO_ACTION_NOTE_MAX}
                </span>
              </div>
              <Textarea
                rows={3}
                maxLength={SWO_ACTION_NOTE_MAX}
                placeholder={
                  actionType === "reject"
                    ? "Explain why this Stock Write-Off request is rejected (required)..."
                    : actionType === "cancel"
                    ? "Explain why this Stock Write-Off request is being cancelled (required)..."
                    : "Optional remarks or instructions for the Inventory Manager..."
                }
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (e.target.value.trim()) setError(false);
                }}
                className={`type-body resize-none bg-surface rounded-control p-3 text-ink ${
                  error ? "border-notice-danger focus-visible:ring-destructive" : "border-border"
                }`}
              />
              {error && (
                <p className="type-caption text-notice-danger flex items-center gap-1 mt-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Reason is required for this action.
                </p>
              )}
            </div>
          )}

          {/* Uniform Action Buttons */}
          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-5 py-2.5 type-label-button text-ink border border-border bg-surface hover:bg-subtle rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-5 py-2.5 type-label-button text-primary-foreground bg-primary hover:bg-primary-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Processing..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
