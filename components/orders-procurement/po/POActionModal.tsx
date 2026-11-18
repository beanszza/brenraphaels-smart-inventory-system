"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const requiresReason = actionType === "reject" || actionType === "return" || actionType === "cancel";

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
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-auto font-sans fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        role="dialog" aria-modal="true" aria-label={getTitle()}
        style={{ width: "100%", maxWidth: "480px" }}
        className="w-full max-w-[480px] bg-surface rounded-card shadow-modal border border-divider overflow-hidden flex flex-col p-6 text-text-primary shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {submitError && <p role="alert" className="mb-3 type-body text-status-red">{submitError}</p>}
        <div className="flex flex-col items-center justify-center text-center">
          {/* Circular Alert Icon */}
          <div className="w-12 h-12 rounded-pill bg-surface-muted flex items-center justify-center mb-4 text-text-primary">
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Title */}
          <h2 className="type-card-title text-text-primary mb-1">
            {getTitle()}
          </h2>

          {/* PO Number / ID Subtitle */}
          <p className="type-caption font-semibold text-text-muted mb-3">
            Purchase Order No: {poNumber}
          </p>

          {/* Message / Description */}
          <p className="type-body text-text-muted mb-5 leading-relaxed">
            {getDescription()}
          </p>

          {/* Reason / Notes Input */}
          {requiresReason && (
            <div className="w-full text-left space-y-1.5 mb-5">
              <label className="type-label font-semibold text-text-primary flex items-center gap-1">
                Reason / Feedback Notes <span className="text-status-red">*</span>
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
                onChange={(e) => {
                  setReason(e.target.value);
                  if (e.target.value.trim()) setError(false);
                }}
                className={`type-body resize-none bg-surface rounded-control p-3 border ${
                  error ? "!border-status-red focus-visible:!ring-status-red" : "border-divider"
                }`}
              />
              {error && (
                <p className="type-caption text-status-red flex items-center gap-1 mt-1 font-medium">
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
              className="flex-1 px-5 py-2.5 type-label-button text-text-primary border border-divider bg-surface hover:bg-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || (requiresReason && !reason.trim())}
              className="flex-1 px-5 py-2.5 type-label-button text-button-primary-foreground bg-button-primary hover:bg-button-primary-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
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
