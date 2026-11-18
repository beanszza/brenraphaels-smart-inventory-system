"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

interface StockTransferConfirmModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StockTransferConfirmModal({
  open,
  title,
  subtitle,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: StockTransferConfirmModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="font-sans fixed inset-0 z-[100050] flex items-center justify-center p-4 bg-backdrop backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-[480px] bg-surface rounded-panel shadow-modal border border-divider overflow-hidden flex flex-col p-6 text-text-primary shrink-0 outline-none animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mb-4 text-text-primary">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>

          <h2 className="type-modal-title text-text-primary mb-1">
            {title}
          </h2>

          {subtitle && (
            <p className="type-caption font-semibold text-text-muted mb-3 font-mono">
              {subtitle}
            </p>
          )}

          <p className="type-body text-text-muted mb-6 leading-relaxed">
            {description}
          </p>

          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-5 py-2.5 type-button font-semibold text-text-primary border border-divider bg-surface hover:bg-surface-hover rounded-control transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-5 py-2.5 type-button font-semibold text-primary-foreground bg-primary hover:bg-primary-hover rounded-control transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? "Processing..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

