"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, AlertCircle } from "lucide-react";
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
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: "440px" }}
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-1">
            Cancel Stock Transfer
          </h2>

          <p className="text-xs font-mono font-semibold text-muted-foreground mb-3">
            Transfer No: {transferNumber}
          </p>

          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Are you sure you want to cancel this scheduled stock transfer? This action cannot be undone.
          </p>

          <div className="w-full text-left space-y-1.5 mb-5">
            <label className="text-xs font-semibold text-foreground">
              Cancellation Reason (Optional)
            </label>
            <Textarea
              rows={3}
              placeholder="State reason for cancellation..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs resize-none bg-background rounded-xl p-3 border-border"
            />
          </div>

          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl bg-card border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50"
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
