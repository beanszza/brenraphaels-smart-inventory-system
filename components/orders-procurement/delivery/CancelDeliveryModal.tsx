"use client";

import { procurement } from "@/lib/orders/client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Delivery } from "../types";

interface CancelDeliveryModalProps {
  delivery: Delivery | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelDeliveryModal({
  delivery,
  onClose,
  onSuccess,
}: CancelDeliveryModalProps) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!delivery || !mounted) return null;

  const handleConfirm = async () => {
    setSubmitError(null);

    if (delivery.status === "Arrived") {
      setSubmitError("An arrived delivery cannot be cancelled as it has already reached the facility.");
      return;
    }

    if (!reason.trim()) {
      setReasonError(true);
      return;
    }

    try {
      setSubmitting(true);
      const res = await procurement.cancelDelivery(delivery.deliveryId, {
        reason: reason.trim(),
      });

      if (res.data?.success) {
        onSuccess();
      } else {
        setSubmitError(res.data?.message || "Failed to cancel delivery.");
      }
    } catch (err: any) {
      console.error("Cancel error:", err);
      setSubmitError(
        err?.response?.data?.message ||
          "An unexpected error occurred while cancelling the delivery."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="pointer-events-auto font-sans fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cancel Delivery Order"
        style={{ width: "100%", maxWidth: "440px" }}
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {submitError && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {submitError}
          </p>
        )}

        <div className="flex flex-col items-center justify-center text-center">
          {/* Circular Alert Icon */}
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-1">
            Cancel Delivery Order
          </h2>

          {/* Delivery Number Subtitle */}
          <p className="text-xs font-semibold text-muted-foreground mb-3">
            Delivery No: {delivery.deliveryNumber}
          </p>

          {/* Message / Description */}
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Are you sure you want to cancel delivery order {delivery.deliveryNumber}? Cancelling will release the declared items back to the Purchase Order available balance.
          </p>

          {/* Reason Input */}
          <div className="w-full text-left space-y-1.5 mb-5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Cancellation Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              rows={3}
              placeholder="Please state the reason for cancellation (required)..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setReasonError(false);
                if (submitError) setSubmitError(null);
              }}
              className={`text-xs resize-none bg-background rounded-xl p-3 ${
                reasonError ? "border-destructive focus-visible:ring-destructive" : "border-border"
              }`}
            />
            {reasonError && (
              <p className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Reason is required for this action.
              </p>
            )}
          </div>

          {/* Uniform Action Buttons */}
          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !reason.trim()}
              className="flex-1 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/85 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {submitting ? "Processing..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
