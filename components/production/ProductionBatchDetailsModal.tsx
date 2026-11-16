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
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ProductionRequest } from "./types";
import { resolveProductionImage } from "@/lib/production/image-client";
import { FILE_PLACEHOLDER } from "@/lib/files";

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
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = React.useState<string | null>(null);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
    if (!batch?.batchId) {
      setResolvedUrl(null);
      return;
    }
    const raw = batch.imageUrl?.trim();
    if (raw && (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:image/") || raw.startsWith("/"))) {
      setResolvedUrl(raw);
      return;
    }
    if (raw) {
      let active = true;
      resolveProductionImage("batch", batch.batchId, "large")
        .then((url) => {
          if (active && url && url !== FILE_PLACEHOLDER && !url.includes("file-placeholder")) {
            setResolvedUrl(url);
          } else if (active) {
            setResolvedUrl(null);
          }
        })
        .catch(() => {
          if (active) setResolvedUrl(null);
        });
      return () => {
        active = false;
      };
    } else {
      setResolvedUrl(null);
    }
  }, [batch?.batchId, batch?.imageUrl]);

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
              <span className="font-bold text-foreground mt-1 block">
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
                <span className="font-bold text-foreground mt-0.5 block">
                  {batch.actualQuantity} PCS
                </span>
              </div>
            )}

            {batch.scrapQuantity !== undefined && batch.scrapQuantity > 0 && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                  Scrap / Waste
                </span>
                <span className="font-bold text-foreground mt-0.5 block">
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
          {resolvedUrl && !imageError && (
            <div className="p-3 rounded-xl border border-border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-2">
                Production Batch Photo
              </span>
              <div className="max-h-48 rounded-lg overflow-hidden border border-border bg-muted/20 flex items-center justify-center">
                <img
                  src={resolvedUrl}
                  alt={batch.batchNumber}
                  onError={() => setImageError(true)}
                  onClick={() => setPreviewImage(resolvedUrl)}
                  className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                />
              </div>
            </div>
          )}
        </div>

        {/* Full Lightbox */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="font-sans fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-card text-foreground rounded-2xl max-w-2xl w-full border border-border p-4 space-y-3 shadow-2xl animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h5 className="text-xs font-bold text-foreground uppercase truncate pr-4">
                  {batch.batchNumber} — Photo
                </h5>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewImage(null)}
                  className="h-7 px-3 text-xs rounded-lg cursor-pointer shrink-0"
                >
                  Close
                </Button>
              </div>
              <div className="flex items-center justify-center bg-muted/20 rounded-xl p-2 max-h-[70vh] overflow-auto">
                <img
                  src={previewImage}
                  alt={batch.batchNumber}
                  className="max-h-[65vh] max-w-full object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-border">
          <ModalCloseButton
            size="sm"
            fallbackOnClose={onClose}
            className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            Close
          </ModalCloseButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
