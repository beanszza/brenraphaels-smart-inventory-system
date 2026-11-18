"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, AlertCircle, ArrowLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface STFActionModalProps {
  transferNumber: string;
  onConfirm: (reason?: string) => Promise<void> | void;
  onClose: () => void;
}

export function STFActionModal({
  transferNumber,
  onConfirm,
  onClose,
}: STFActionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="font-sans fixed inset-0 z-[300] flex items-center justify-center p-4 bg-backdrop backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-[480px] bg-surface rounded-panel shadow-modal border border-divider overflow-hidden flex flex-col p-6 text-text-primary shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-text-primary">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>

          <h2 className="type-modal-title text-text-primary mb-1">
            Cancel Stock Transfer
          </h2>

          <p className="type-caption font-semibold text-text-muted mb-3">
            Transfer No: {transferNumber}
          </p>

          <p className="type-body text-text-muted mb-5 leading-relaxed">
            Are you sure you want to cancel this scheduled stock transfer? This action cannot be undone.
          </p>

          <div className="w-full text-left space-y-1.5 mb-5">
            <label className="type-caption font-semibold text-text-primary">
              Cancellation Reason (Optional)
            </label>
            <Textarea
              rows={3}
              placeholder="State reason for cancellation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="type-input resize-none bg-surface rounded-control p-3 border-divider text-text-primary"
            />
          </div>

          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-control bg-surface border border-divider px-5 py-2.5 type-button font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 rounded-control bg-primary text-primary-foreground px-5 py-2.5 type-button font-semibold hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? "Cancelling..." : "Confirm Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
