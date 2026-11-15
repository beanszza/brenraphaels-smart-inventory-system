"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const requiresReason = actionType === "reject" || actionType === "cancel";

  const getTitle = () => {
    switch (actionType) {
      case "approve":
        return "Approve Stock Transfer Request";
      case "reject":
        return "Reject Stock Transfer Request";
      case "cancel":
        return "Cancel Stock Transfer Request";
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
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to update request.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="font-sans fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={getTitle()}
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

          {/* Request Number Subtitle */}
          <p className="text-xs font-semibold text-muted-foreground mb-3">
            Stock Transfer Request No: {requestNumber}
          </p>

          {/* Message / Description */}
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            {getDescription()}
          </p>

          {/* Required Reason Input */}
          {requiresReason && (
            <div className="w-full text-left space-y-1.5 mb-5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                Reason / Feedback Notes <span className="text-destructive">*</span>
              </label>
              <Textarea
                rows={3}
                placeholder={
                  actionType === "reject"
                    ? "Explain why this request is rejected (required)..."
                    : "Please state the reason for cancellation (required)..."
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
              onClick={() => { if (!loading) onClose(); }}
              disabled={loading}
              className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/85 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
