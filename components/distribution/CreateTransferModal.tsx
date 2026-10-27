"use client";
import { CreateSTRModal } from "@/components/stock-transfer/CreateSTRModal";
import type { LocationItem } from "./types";

// Distribution uses the same approval-first request flow as Stock Transfer.
export default function CreateTransferModal({ open, onClose, onCreated }: {
  open: boolean; locations: LocationItem[]; onClose: () => void; onCreated: () => void;
}) {
  return open ? <CreateSTRModal open={open} onClose={onClose} onSuccess={onCreated} /> : null;
}
