"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[100002] flex items-center justify-center p-4 bg-scrim">
      <div
        role="alertdialog"
        aria-modal="true"
        style={{ width: "100%", maxWidth: "440px" }}
        className="w-full max-w-md bg-surface rounded-modal shadow-modal border border-border overflow-hidden flex flex-col p-6 text-ink shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="size-12 rounded-pill bg-subtle flex items-center justify-center mb-4 text-ink">
            <AlertTriangle className="size-6 text-status-amber-fg" />
          </div>
          <h2 className="type-modal-title text-ink mb-2">Confirmation Required</h2>
          <p className="type-body text-ink-secondary mb-6">{message}</p>
          <div className="flex justify-center gap-3 w-full">
            <button onClick={onCancel} className="flex-1 h-10 px-4 type-label-button text-ink border border-input bg-surface hover:bg-subtle rounded-control transition-colors cursor-pointer">Cancel</button>
            <button onClick={onConfirm} className="flex-1 h-10 px-4 type-label-button text-on-brand bg-primary hover:bg-primary-hover rounded-control transition-colors cursor-pointer">Confirm</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
