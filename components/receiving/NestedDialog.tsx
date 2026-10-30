"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface NestedDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}

export default function NestedDialog({ open, title, onClose, children, maxWidth = 460 }: NestedDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs animate-in fade-in duration-150" />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ width: "100%", maxWidth }}
          className="fixed left-1/2 top-1/2 z-[301] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground outline-none animate-in fade-in duration-150"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

