"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, AlertCircle, CheckCircle, XCircle } from "lucide-react";
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const requiresReason = actionType === "reject";

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
        return `Are you sure you want to cancel request ${requestNumber}? Any transfers scheduled under this request will also be cancelled.`;
    }
  };

  const handleConfirm = async () => {
    if (requiresReason && !reason.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: "440px" }}
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center justify-center text-center">
          {/* Circular Alert Icon */}
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
            {actionType === "approve" ? (
              <CheckCircle className="w-6 h-6" />
            ) : actionType === "reject" ? (
              <XCircle className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-1">
            {getTitle()}
          </h2>

          {/* Request Number Subtitle */}
          <p className="text-xs font-mono font-semibold text-muted-foreground mb-3">
            Request No: {requestNumber}
          </p>

          {/* Message / Description */}
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            {getDescription()}
          </p>

          {/* Required / Optional Reason Input */}
          {(requiresReason || actionType === "cancel") && (
            <div className="w-full text-left space-y-1.5 mb-5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                {actionType === "reject" ? "Rejection Reason" : "Cancellation Reason"}{" "}
                {requiresReason && <span className="text-destructive">*</span>}
              </label>
              <Textarea
                rows={3}
                placeholder={
                  actionType === "reject"
                    ? "Explain why this request is rejected (required)..."
                    : "Specify reason for cancellation (optional)..."
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

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl bg-card border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:bg-foreground/85 transition-colors shadow-sm disabled:opacity-50"
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
