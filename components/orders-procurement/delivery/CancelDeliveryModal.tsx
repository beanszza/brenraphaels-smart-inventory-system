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
    } catch (err: unknown) {
      console.error("Cancel error:", err);
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message || "An unexpected error occurred while cancelling the delivery."
          : err instanceof Error
          ? err.message
          : "An unexpected error occurred while cancelling the delivery.";
      setSubmitError(message);
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
        style={{ width: "100%", maxWidth: "480px" }}
        className="w-full max-w-[480px] bg-surface rounded-card shadow-modal border border-divider overflow-hidden flex flex-col p-6 text-text-primary shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {submitError && (
          <p role="alert" className="mb-3 type-body text-status-red">
            {submitError}
          </p>
        )}

        <div className="flex flex-col items-center justify-center text-center">
          {/* Circular Alert Icon */}
          <div className="w-12 h-12 rounded-pill bg-surface-muted flex items-center justify-center mb-4 text-text-primary">
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Title */}
          <h2 className="type-card-title text-text-primary mb-1">
            Cancel Delivery Order
          </h2>

          {/* Delivery Number Subtitle */}
          <p className="type-caption font-semibold text-text-muted mb-3">
            Delivery No: {delivery.deliveryNumber}
          </p>

          {/* Message / Description */}
          <p className="type-body text-text-muted mb-5 leading-relaxed">
            Are you sure you want to cancel delivery order {delivery.deliveryNumber}? Cancelling will release the declared items back to the Purchase Order available balance.
          </p>

          {/* Reason Input */}
          <div className="w-full text-left space-y-1.5 mb-5">
            <label className="type-label font-semibold text-text-primary flex items-center gap-1">
              Cancellation Reason <span className="text-status-red">*</span>
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
              className={`type-body resize-none bg-surface rounded-control p-3 text-text-primary ${
                reasonError ? "border-status-red focus-visible:ring-status-red" : "border-divider"
              }`}
            />
            {reasonError && (
              <p className="type-caption text-status-red flex items-center gap-1 mt-1 font-medium">
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
              className="flex-1 px-5 py-2.5 h-auto type-label-button font-semibold text-text-primary border border-divider bg-surface hover:bg-surface-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !reason.trim()}
              className="flex-1 px-5 py-2.5 h-auto type-label-button font-semibold text-text-inverse bg-button-primary hover:bg-button-primary-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
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
