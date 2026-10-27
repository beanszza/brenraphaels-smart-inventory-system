"use client";

import React from "react";
import { Package, Calendar, User, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProductionRequest } from "./types";

interface ProductionBatchDetailsModalProps {
  open: boolean;
  onClose: () => void;
  batch: ProductionRequest | null;
}

export default function ProductionBatchDetailsModal({
  open,
  onClose,
  batch,
}: ProductionBatchDetailsModalProps) {
  if (!batch) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto bg-card border-border p-6 shadow-2xl">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Package size={16} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Batch Details: {batch.batchNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {batch.productName} &bull; {batch.variant || "Standard"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="space-y-4 pt-2 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/10">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Current Status
              </span>
              <div className="mt-1">
                <StatusBadge status={batch.status} />
              </div>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Production Stage
              </span>
              <span className="font-semibold text-foreground mt-1 block">
                {batch.stage || "Preparation"}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Target Output
              </span>
              <span className="font-mono font-bold text-foreground mt-1 block">
                {batch.targetYield} {batch.yieldUnit || "PCS"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-card">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Scheduled Date
              </span>
              <span className="font-medium text-foreground mt-0.5 block flex items-center gap-1.5">
                <Calendar size={13} className="text-muted-foreground" />
                {batch.scheduleDate
                  ? new Date(batch.scheduleDate).toLocaleDateString()
                  : "—"}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                Assigned Cook / In-Charge
              </span>
              <span className="font-medium text-foreground mt-0.5 block flex items-center gap-1.5">
                <User size={13} className="text-muted-foreground" />
                {batch.assignedCook || "Unassigned"}
              </span>
            </div>

            {batch.recipeName && (
              <div className="col-span-2">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                  Recipe / BOM Used
                </span>
                <span className="font-medium text-foreground mt-0.5 block">
                  {batch.recipeName}{" "}
                  {batch.batchMultiplier
                    ? `(${batch.batchMultiplier}x multiplier)`
                    : ""}
                </span>
              </div>
            )}

            {batch.actualQuantity !== undefined && batch.actualQuantity > 0 && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                  Actual Good Output
                </span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">
                  {batch.actualQuantity} PCS
                </span>
              </div>
            )}

            {batch.scrapQuantity !== undefined && batch.scrapQuantity > 0 && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                  Scrap / Waste
                </span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">
                  {batch.scrapQuantity} PCS
                </span>
              </div>
            )}
          </div>

          {/* Purpose / Notes */}
          {batch.purpose && (
            <div className="p-3 rounded-xl border border-border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-1 flex items-center gap-1.5">
                <FileText size={12} /> Purpose &amp; Notes
              </span>
              <p className="text-foreground whitespace-pre-wrap">{batch.purpose}</p>
            </div>
          )}

          {/* Rejection reason if rejected */}
          {batch.status === "Rejected" && batch.rejectionReason && (
            <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive">
              <span className="text-[10px] uppercase font-bold block mb-1 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Rejection Reason
              </span>
              <p className="font-medium">{batch.rejectionReason}</p>
            </div>
          )}

          {/* Image preview if any */}
          {batch.imageUrl && (
            <div className="p-3 rounded-xl border border-border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-2">
                Production Batch Photo
              </span>
              <div className="max-h-48 rounded-lg overflow-hidden border border-border bg-muted/20 flex items-center justify-center">
                <img
                  src={batch.imageUrl}
                  alt={batch.batchNumber}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-border">
          <Button
            size="sm"
            onClick={onClose}
            className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
