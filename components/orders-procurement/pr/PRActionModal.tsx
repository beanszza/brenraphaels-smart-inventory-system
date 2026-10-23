"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

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
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => { if (!loading) onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={getTitle()}
        style={{ width: "100%", maxWidth: "440px" }}
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {submitError && <p role="alert" className="mb-3 text-sm text-destructive">{submitError}</p>}
        <div className="flex flex-col items-center justify-center text-center">
          {/* Circular Alert Icon */}
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-1">
            {getTitle()}
          </h2>

          {/* PR Number / ID Subtitle */}
          <p className="text-xs font-mono font-semibold text-muted-foreground mb-3">
            Purchase Requisition No: {prNumber}
          </p>

          {/* Message / Description */}
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            {getDescription()}
          </p>

          {/* Optional Reason / Feedback Notes Input */}
          {requiresReason && (
            <div className="w-full text-left space-y-1.5 mb-5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
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
                onChange={(e) => {
                  setReason(e.target.value);
                  if (e.target.value.trim()) setError(false);
                }}
                className={`text-xs resize-none bg-background rounded-xl p-3 ${
                  error ? "border-destructive focus-visible:ring-destructive" : "border-border"
                }`}
              />
              {error && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-medium">
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
              className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/85 rounded-xl transition-colors disabled:opacity-50"
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
