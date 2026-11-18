"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";

export interface ActionConfirmModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  description: React.ReactNode;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  loading?: boolean;
  submitting?: boolean;
  loadingText?: string;
  confirmDisabled?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void | Promise<void>;
  onClose?: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}

export function ActionConfirmModal({
  open,
  title,
  subtitle,
  description,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  loading,
  submitting,
  loadingText = "Processing...",
  confirmDisabled = false,
  errorMessage,
  onConfirm,
  onClose,
  onCancel,
  children,
}: ActionConfirmModalProps) {
  if (!open) return null;

  const isBusy = Boolean(loading ?? submitting);
  const resolvedConfirmText = confirmText ?? confirmLabel ?? "Confirm";
  const resolvedCancelText = cancelText ?? cancelLabel ?? "Cancel";
  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !isBusy) handleClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pointer-events-auto fixed inset-0 z-[100050] bg-scrim animate-in fade-in duration-150" />
        <Dialog.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            if (!isBusy) handleClose();
          }}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            if (!isBusy) handleClose();
          }}
          style={{ width: "100%", maxWidth: "440px" }}
          className="pointer-events-auto fixed left-1/2 top-1/2 z-[100051] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 bg-surface rounded-modal shadow-modal border border-border overflow-hidden flex flex-col p-6 text-ink shrink-0 outline-none animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>

          {errorMessage && (
            <p role="alert" className="mb-3 type-body text-semantic-danger text-center">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-col items-center justify-center text-center">
            {/* Circular Alert Icon */}
            <div className="size-12 rounded-pill bg-subtle flex items-center justify-center mb-4 text-ink">
              <AlertTriangle className="size-6 text-status-amber-fg" />
            </div>

            {/* Title */}
            <h2 className="type-modal-title text-ink mb-1">{title}</h2>

            {/* Reference Subtitle */}
            {subtitle && (
              <p className="type-caption font-semibold text-ink-muted mb-3">
                {subtitle}
              </p>
            )}

            {/* Description */}
            <div
              className={`type-body text-ink-secondary leading-relaxed ${
                children ? "mb-5" : "mb-6"
              }`}
            >
              {description}
            </div>

            {/* Optional Custom Content (e.g., Reason / Feedback Notes input) */}
            {children && <div className="w-full text-left mb-5">{children}</div>}

            {/* Uniform Action Buttons */}
            <div className="flex justify-center gap-3 w-full">
              <button
                type="button"
                onClick={handleClose}
                disabled={isBusy}
                className="flex-1 h-10 px-4 type-label-button text-ink border border-input bg-surface hover:bg-subtle rounded-control transition-colors cursor-pointer disabled:opacity-50"
              >
                {resolvedCancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isBusy || confirmDisabled}
                className="flex-1 h-10 px-4 type-label-button text-on-brand bg-primary hover:bg-primary-hover rounded-control transition-colors shadow-none cursor-pointer disabled:opacity-50"
              >
                {isBusy ? loadingText : resolvedConfirmText}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ActionConfirmModal;
