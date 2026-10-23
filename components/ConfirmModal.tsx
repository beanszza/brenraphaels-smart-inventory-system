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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={onCancel}>
      <div
        style={{ width: "100%", maxWidth: "420px" }}
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Confirmation Required</h2>
          <p className="text-sm text-muted-foreground mb-6">{message}</p>
          <div className="flex justify-center gap-3 w-full">
            <button onClick={onCancel} className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors">Cancel</button>
            <button onClick={onConfirm} className="flex-1 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/85 rounded-xl transition-colors">Confirm</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
