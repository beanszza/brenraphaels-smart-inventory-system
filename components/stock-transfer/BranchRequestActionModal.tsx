"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import type { BranchStockRequest } from "./types";

export type BranchRequestActionType = "approve" | "reject";

interface BranchRequestActionModalProps {
  actionType: BranchRequestActionType;
  request: BranchStockRequest;
  onConfirm: (payload: { approvedQuantity?: number; remarks?: string }) => Promise<void> | void;
  onClose: () => void;
}

/**
 * Confirmation modal for approving or rejecting an incoming POS Branch Stock Request.
 * Reuses the shared ActionConfirmModal (matching PO and PR confirmation modals).
 */
export function BranchRequestActionModal({
  actionType,
  request,
  onConfirm,
  onClose,
}: BranchRequestActionModalProps) {
  const primaryItem = request.items[0];
  const maxQty = primaryItem ? Math.max(1, Math.round(primaryItem.requestedQuantity)) : 1;

  const [approvedQty, setApprovedQty] = useState<string>(String(maxQty));
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isApprove = actionType === "approve";
  const productSummary = primaryItem
    ? `${primaryItem.productName}${primaryItem.variationName ? ` · ${primaryItem.variationName}` : ""}, ${maxQty} pcs`
    : `${request.totalRequested} pcs`;

  const title = isApprove ? "Approve Branch Request" : "Reject Branch Request";
  const subtitle = `Branch Stock Request No: ${request.requestNumber} · ${request.branchName}`;
  const description = isApprove
    ? `Are you sure you want to approve request ${request.requestNumber} (${productSummary})? This will sync Approved back to POS and move it to the Approved tab for stock transfer.`
    : `Please provide a reason for rejecting request ${request.requestNumber}. The request will be closed and marked as Rejected in POS with your remarks.`;

  const validate = (): { approvedQuantity?: number; remarks?: string } | null => {
    const trimmedRemarks = reason.trim();
    if (trimmedRemarks.length > 500 || /[<>]/.test(trimmedRemarks)) {
      setValidationError("Remarks must be at most 500 characters and cannot contain '<' or '>'.");
      return null;
    }

    if (isApprove) {
      const parsed = Number(approvedQty);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxQty) {
        setValidationError(`Approved quantity must be a whole number between 1 and ${maxQty}.`);
        return null;
      }
      return { approvedQuantity: parsed, remarks: trimmedRemarks || undefined };
    }

    if (!trimmedRemarks) {
      setValidationError("Reason is required for rejecting a branch stock request.");
      return null;
    }
    return { remarks: trimmedRemarks };
  };

  const handleConfirm = async () => {
    const payload = validate();
    if (!payload) return;
    setValidationError(null);
    setSubmitError(null);
    setLoading(true);
    try {
      await onConfirm(payload);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unable to update branch stock request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActionConfirmModal
      open={true}
      title={title}
      subtitle={subtitle}
      description={description}
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      loading={loading}
      confirmDisabled={!isApprove && !reason.trim()}
      errorMessage={submitError}
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      <div className="space-y-3">
        {isApprove && (
          <div className="space-y-1.5">
            <label className="type-label-field text-ink flex items-center gap-1">
              Approved Quantity <span className="text-destructive">*</span>
              <span className="type-caption font-normal text-ink-muted">(max {maxQty} pcs)</span>
            </label>
            <Input
              type="number"
              min={1}
              max={maxQty}
              step={1}
              value={approvedQty}
              onChange={(e) => {
                setApprovedQty(e.target.value);
                setValidationError(null);
              }}
              className="h-9 rounded-control bg-surface border-input type-body-secondary text-ink font-medium tabular-nums shadow-none"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="type-label-field text-ink flex items-center gap-1">
            {isApprove ? "Remarks for Branch" : "Reason / Feedback Notes"}
            {isApprove ? (
              <span className="type-caption font-normal text-ink-muted">(Optional)</span>
            ) : (
              <span className="text-destructive">*</span>
            )}
          </label>
          <Textarea
            rows={3}
            maxLength={500}
            placeholder={
              isApprove
                ? "Optional note shown to the branch in POS..."
                : "Explain why this request is rejected (required)..."
            }
            value={reason}
            aria-invalid={Boolean(validationError)}
            onChange={(e) => {
              setReason(e.target.value);
              setValidationError(null);
            }}
            className={`type-body-secondary resize-none bg-surface rounded-control p-3 border ${
              validationError ? "!border-destructive focus-visible:!ring-destructive" : "border-input"
            }`}
          />
          {validationError && (
            <p role="alert" className="type-caption text-destructive flex items-center gap-1 mt-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {validationError}
            </p>
          )}
        </div>
      </div>
    </ActionConfirmModal>
  );
}
