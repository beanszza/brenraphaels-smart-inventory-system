"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface ModalWrapperProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: string;
}

const widths: Record<string, number> = {
  "max-w-xl": 600, "max-w-2xl": 672, "max-w-3xl": 800,
  "max-w-4xl": 950, "max-w-5xl": 1050, "max-w-6xl": 1240, "max-w-7xl": 1380,
};

export default function ModalWrapper({ open, title, onClose, children, size }: ModalWrapperProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-foreground/45" />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ maxWidth: widths[size ?? ""] ?? 900 }}
          className="fixed left-1/2 top-1/2 z-[201] flex max-h-[90dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-6 py-5">
            <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
            <Dialog.Close aria-label="Close dialog" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              {/* Exact close asset from the reference dialog, at its native 18px size. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/resources/dialog-close.svg" width={18} height={18} alt="" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
