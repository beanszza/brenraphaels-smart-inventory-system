"use client";

import React from "react";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";

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
  return (
    <ActionConfirmModal
      open={open}
      title={title}
      subtitle={subtitle}
      description={description}
      confirmText={confirmText}
      cancelText={cancelText}
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

