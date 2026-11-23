"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";

export type POActionType = "approve" | "reject" | "return" | "cancel" | "order";

interface POActionModalProps {
  actionType: POActionType;
  poNumber: string;
  onConfirm: (notes?: string) => Promise<void> | void;
  onClose: () => void;
}

export function POActionModal({ actionType, poNumber, onClose, onConfirm }: POActionModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const requiresReason =
    actionType === "reject" || actionType === "return" || actionType === "cancel";

  const getTitle = () => {
    switch (actionType) {
      case "approve":
        return "Approve Purchase Order";
      case "reject":
        return "Reject Purchase Order";
      case "return":
        return "Return for Revision";
      case "cancel":
        return "Cancel Purchase Order";
      case "order":
        return "Mark as Ordered";
    }
  };

  const getDescription = () => {
    switch (actionType) {
      case "approve":
        return `Are you sure you want to approve purchase order ${poNumber}? This will mark it as Approved and allow delivery shipments to be scheduled.`;
      case "reject":
        return `Please provide a reason for rejecting purchase order ${poNumber}. The purchase order will be closed and marked as Rejected.`;
      case "return":
        return `Please provide instructions or reasons for returning purchase order ${poNumber}. The requester will be able to revise and re-submit it.`;
      case "cancel":
        return `Are you sure you want to cancel purchase order ${poNumber}? This action cannot be undone.`;
      case "order":
        return `Mark purchase order ${poNumber} as ordered and send it to the supplier?`;
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
      await onConfirm(reason.trim() || undefined);
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
      subtitle={`Purchase Order Number: ${poNumber}`}
      description={getDescription()}
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      loading={loading}
      confirmDisabled={requiresReason && !reason.trim()}
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
                ? "Explain why this purchase order is rejected (required)..."
                : actionType === "return"
                ? "Specify adjustments or items needed for revision (required)..."
                : "Please state the reason for cancellation (required)..."
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
