"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";

export type PRActionType = "approve" | "reject" | "return" | "cancel" | "convert";

interface PRActionModalProps {
  actionType: PRActionType;
  prNumber: string;
  onConfirm: (notes?: string) => Promise<void> | void;
  onClose: () => void;
}

export function PRActionModal({
  actionType,
  prNumber,
  onConfirm,
  onClose,
}: PRActionModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const requiresReason = actionType === "reject" || actionType === "return";

  const getTitle = () => {
    switch (actionType) {
      case "approve":
        return "Approve Requisition";
      case "reject":
        return "Reject Requisition";
      case "return":
        return "Return for Revision";
      case "cancel":
        return "Cancel Requisition";
      case "convert":
        return "Convert to Purchase Order";
    }
  };

  const getDescription = () => {
    switch (actionType) {
      case "approve":
        return `Are you sure you want to approve requisition ${prNumber}? This will mark it as Approved and allow it to be converted into Purchase Order(s).`;
      case "reject":
        return `Please provide a reason for rejecting requisition ${prNumber}. The requisition will be closed and marked as Rejected.`;
      case "return":
        return `Please provide instructions or reasons for returning requisition ${prNumber}. The Inventory Manager will be able to revise and re-submit it.`;
      case "cancel":
        return `Are you sure you want to cancel requisition ${prNumber}? This action cannot be undone.`;
      case "convert":
        return `Are you sure you want to convert approved requisition ${prNumber} into Purchase Order(s)? Items will be mapped to registered suppliers.`;
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

  return (
    <ActionConfirmModal
      open={true}
      title={getTitle()}
      subtitle={`Purchase Requisition Number: ${prNumber}`}
      description={getDescription()}
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      loading={loading}
      errorMessage={submitError || null}
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      {requiresReason && (
        <div className="space-y-1.5">
          <label className="type-label-field text-ink flex items-center gap-1">
            Reason / Feedback Notes <span className="text-destructive">*</span>
          </label>
          <Textarea
            rows={3}
            placeholder={
              actionType === "reject"
                ? "Explain why this requisition is rejected (required)..."
                : "Specify adjustments or items needed for revision (required)..."
            }
            value={reason}
            aria-invalid={error}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError(false);
            }}
            className={`type-body-secondary resize-none bg-surface rounded-control p-3 border ${
              error ? "!border-destructive focus-visible:!ring-destructive" : "border-input"
            }`}
          />
          {error && (
            <p
              role="alert"
              className="type-caption text-destructive flex items-center gap-1 mt-1 font-medium"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Reason is required for this action.
            </p>
          )}
        </div>
      )}
    </ActionConfirmModal>
  );
}
