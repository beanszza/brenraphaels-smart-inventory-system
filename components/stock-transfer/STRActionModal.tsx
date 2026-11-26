"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { STRActionType } from "./types";

export type { STRActionType };

interface STRActionModalProps {
  actionType: STRActionType;
  requestNumber: string;
  onConfirm: (notes?: string) => Promise<void> | void;
  onClose: () => void;
}

export function STRActionModal({
  actionType,
  requestNumber,
  onConfirm,
  onClose,
}: STRActionModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requiresReason = actionType === "reject" || actionType === "cancel";

  const getTitle = () => {
    switch (actionType) {
      case "approve":
        return "Approve stock transfer request";
      case "reject":
        return "Reject stock transfer request";
      case "cancel":
        return "Cancel stock transfer request";
    }
  };

  const getDescription = () => {
    switch (actionType) {
      case "approve":
        return `Are you sure you want to approve request ${requestNumber}? This will mark it as Approved, allowing the Inventory Manager to schedule the physical transfer.`;
      case "reject":
        return `Please provide a reason for rejecting request ${requestNumber}. Once rejected, this request cannot be reused or revised, and a new request number must be generated if needed.`;
      case "cancel":
        return `Are you sure you want to cancel request ${requestNumber}? This action cannot be undone. Reserved stock will be released and this request number will be permanently marked as cancelled and cannot be reused.`;
    }
  };

  const getConfirmLabel = () => {
    switch (actionType) {
      case "approve":
        return "Approve";
      case "reject":
        return "Confirm rejection";
      case "cancel":
        return "Confirm cancellation";
    }
  };

  const handleConfirm = async () => {
    if (requiresReason && !reason.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setSubmitError(null);
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unable to update request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActionConfirmModal
      open={true}
      title={getTitle()}
      subtitle={`Stock Transfer Request No: ${requestNumber}`}
      description={getDescription()}
      confirmLabel={getConfirmLabel()}
      cancelLabel="Cancel"
      loading={loading}
      errorMessage={submitError}
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      {requiresReason && (
        <div className="space-y-1.5">
          <label className="type-label-field text-ink-strong flex items-center gap-1">
            Reason / Feedback notes <span className="text-destructive">*</span>
          </label>
          <Textarea
            rows={3}
            placeholder={
              actionType === "reject"
                ? "Explain why this request is rejected (required)..."
                : "Please state the reason for cancellation (required)..."
            }
            value={reason}
            aria-invalid={error}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError(false);
            }}
            className={`type-body resize-none bg-surface rounded-control p-3 text-ink border ${
              error ? "!border-destructive focus-visible:!ring-destructive" : "border-input"
            }`}
          />
          {error && (
            <p role="alert" className="type-caption text-destructive flex items-center gap-1 mt-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Reason is required for this action.
            </p>
          )}
        </div>
      )}
    </ActionConfirmModal>
  );
}
