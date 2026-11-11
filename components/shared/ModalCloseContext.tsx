"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { Button, type ButtonProps } from "@/components/ui/button";

const ModalCloseContext = createContext<(() => void) | null>(null);

export const ModalCloseProvider = ModalCloseContext.Provider;

export function useModalRequestClose(fallback?: () => void) {
  const ctxClose = useContext(ModalCloseContext);
  return ctxClose ?? fallback ?? (() => {});
}

export function ModalCloseButton({
  fallbackOnClose,
  onClick,
  ...props
}: ButtonProps & { fallbackOnClose?: () => void }) {
  const requestClose = useModalRequestClose(fallbackOnClose);
  return (
    <Button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          requestClose();
        }
      }}
      {...props}
    />
  );
}

export function ModalNativeCloseButton({
  fallbackOnClose,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { fallbackOnClose?: () => void }) {
  const requestClose = useModalRequestClose(fallbackOnClose);
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          requestClose();
        }
      }}
      {...props}
    />
  );
}

export function useConfirmedClose(
  onClose: () => void,
  message = "Are you sure you want to close? Any unsaved changes will be discarded."
) {
  const [showConfirm, setShowConfirm] = useState(false);
  const requestClose = useCallback(() => setShowConfirm(true), []);
  const cancelClose = useCallback(() => setShowConfirm(false), []);
  const confirmModal = showConfirm ? (
    <ConfirmModal
      message={message}
      onConfirm={() => {
        setShowConfirm(false);
        onClose();
      }}
      onCancel={cancelClose}
    />
  ) : null;
  return { requestClose, confirmModal };
}
