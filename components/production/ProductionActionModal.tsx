"use client";

import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ProductionActionType = "approve" | "reject";

interface ProductionActionModalProps {
  open: boolean;
  actionType: ProductionActionType;
  reqNumber: string;
  onConfirm: (notes?: string) => Promise<void> | void;
  onClose: () => void;
}

export function ProductionActionModal({
  open,
  actionType,
  reqNumber,
  onConfirm,
  onClose,
}: ProductionActionModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(false);
      setLoading(false);
    }
  }, [open]);

  const isReject = actionType === "reject";

  const getTitle = () => {
    return isReject ? "Reject Production Request" : "Approve Production Request";
  };

  const getDescription = () => {
    return isReject
      ? `Please provide a reason for rejecting production request ${reqNumber}. The request will be marked as Rejected and any reserved material lots will be released.`
      : `Are you sure you want to approve production request ${reqNumber}? This will mark it as Approved and authorize material issuance for inventory staging.`;
  };

  const handleConfirm = async () => {
    if (isReject && !reason.trim()) {
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

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(val) => { if (!val && !loading) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="pointer-events-auto font-sans fixed inset-0 z-[100050] bg-black/60 backdrop-blur-xs animate-in fade-in duration-150" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          style={{ width: "100%", maxWidth: "480px" }}
          className="pointer-events-auto font-sans fixed left-1/2 top-1/2 z-[100051] w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 bg-surface rounded-card shadow-modal border border-divider overflow-hidden flex flex-col p-6 text-text-primary shrink-0 outline-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex flex-col items-center justify-center text-center">
            {/* Circular Alert Icon */}
            <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mb-4 text-text-primary">
              <AlertTriangle className="w-6 h-6 text-text-primary" />
            </div>

            {/* Title */}
            <DialogPrimitive.Title className="type-section-title text-text-primary mb-1">
              {getTitle()}
            </DialogPrimitive.Title>

            {/* Reference Subtitle */}
            <p className="type-caption font-semibold text-text-muted mb-3">
              Production Request No: {reqNumber}
            </p>

            {/* Description */}
            <p className="type-body text-text-muted mb-5 leading-relaxed">
              {getDescription()}
            </p>

            {/* Reason Textarea (Required for Reject) */}
            {isReject && (
              <div className="w-full text-left mb-5">
                <label className="type-table-header text-text-primary mb-1.5 block">
                  Rejection Reason <span className="text-status-danger">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (error && e.target.value.trim()) setError(false);
                  }}
                  placeholder="State the reason why this production request is being rejected..."
                  rows={3}
                  className={`w-full type-body p-3 rounded-control border bg-surface text-text-primary resize-none focus:outline-none transition-colors ${
                    error
                      ? "border-status-danger focus:ring-1 focus:ring-status-danger"
                      : "border-divider focus:ring-1 focus:ring-brand"
                  }`}
                />
                {error && (
                  <p className="type-caption text-status-danger mt-1 font-medium">
                    A rejection reason is required before confirming.
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons matching PR / PO confirmation */}
            <div className="flex justify-center gap-3 w-full">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-5 py-2.5 type-body font-semibold text-text-primary border border-divider bg-surface hover:bg-surface-hover rounded-control transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className={`flex-1 px-5 py-2.5 type-body font-semibold text-text-inverse ${
                  isReject
                    ? "bg-status-danger hover:bg-status-danger/85"
                    : "bg-button-primary hover:bg-button-primary-hover"
                } rounded-control transition-colors shadow-card cursor-pointer disabled:opacity-50`}
              >
                {loading ? "Processing..." : isReject ? "Confirm Rejection" : "Confirm Approval"}
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
