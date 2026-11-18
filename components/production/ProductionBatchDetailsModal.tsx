"use client";

import React from "react";
import { Package, Calendar, User, FileText, AlertTriangle, ImageIcon } from "lucide-react";
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
import { FILE_PLACEHOLDER, isFileId } from "@/lib/files";

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
  const [lightboxError, setLightboxError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
    setLightboxError(false);
    if (!batch?.batchId) {
      setResolvedUrl(null);
      return;
    }
    const raw = batch.imageUrl?.trim();
    if (raw && (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:image/"))) {
      setResolvedUrl(raw);
      return;
    }
    if (raw && isFileId(raw)) {
      let active = true;
      resolveProductionImage("batch", batch.batchId, "large")
        .then((url) => {
          if (
            active &&
            url &&
            url !== FILE_PLACEHOLDER &&
            !url.includes("file-placeholder") &&
            (url.startsWith("data:image/") || url.startsWith("http://") || url.startsWith("https://"))
          ) {
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
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto bg-surface border-divider p-6 shadow-modal rounded-card">
        <DialogHeader className="border-b border-divider pb-3">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-8 h-8 rounded-control bg-brand text-text-inverse flex items-center justify-center shrink-0">
              <Package size={16} />
            </div>
            <div>
              <DialogTitle className="type-section-title text-text-primary">
                Batch Details: {batch.batchNumber}
              </DialogTitle>
              <DialogDescription className="type-caption text-text-muted mt-0.5">
                {batch.productName} &bull; {batch.variant || "Standard"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="space-y-4 pt-2 type-body">
          <div className="flex items-center justify-between p-3 rounded-control border border-divider bg-surface-secondary/40">
            <div>
              <span className="type-overline uppercase tracking-wider text-text-muted block">
                Current Status
              </span>
              <div className="mt-1">
                <StatusBadge status={batch.status} />
              </div>
            </div>

            <div>
              <span className="type-overline uppercase tracking-wider text-text-muted block">
                Production Stage
              </span>
              <span className="type-body font-semibold text-text-primary mt-1 block">
                {batch.stage || "Preparation"}
              </span>
            </div>

            <div>
              <span className="type-overline uppercase tracking-wider text-text-muted block">
                Target Output
              </span>
              <span className="type-body font-semibold text-text-primary mt-1 block">
                {batch.targetYield} {batch.yieldUnit || "PCS"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-control border border-divider bg-surface shadow-card">
            <div>
              <span className="type-overline uppercase tracking-wider text-text-muted block">
                Scheduled Date
              </span>
              <span className="type-body font-semibold text-text-primary mt-0.5 block flex items-center gap-1.5">
                <Calendar size={13} className="text-text-muted" />
                {batch.scheduleDate
                  ? new Date(batch.scheduleDate).toLocaleDateString()
                  : "—"}
              </span>
            </div>

            <div>
              <span className="type-overline uppercase tracking-wider text-text-muted block">
                Assigned Cook / In-Charge
              </span>
              <span className="type-body font-semibold text-text-primary mt-0.5 block flex items-center gap-1.5">
                <User size={13} className="text-text-muted" />
                {batch.assignedCook || "Unassigned"}
              </span>
            </div>

            {batch.recipeName && (
              <div className="col-span-2">
                <span className="type-overline uppercase tracking-wider text-text-muted block">
                  Recipe / BOM Used
                </span>
                <span className="type-body font-semibold text-text-primary mt-0.5 block">
                  {batch.recipeName}{" "}
                  {batch.batchMultiplier
                    ? `(${batch.batchMultiplier}x multiplier)`
                    : ""}
                </span>
              </div>
            )}

            {batch.actualQuantity !== undefined && batch.actualQuantity > 0 && (
              <div>
                <span className="type-overline uppercase tracking-wider text-text-muted block">
                  Actual Good Output
                </span>
                <span className="type-body font-semibold text-text-primary mt-0.5 block">
                  {batch.actualQuantity} PCS
                </span>
              </div>
            )}

            {batch.scrapQuantity !== undefined && batch.scrapQuantity > 0 && (
              <div>
                <span className="type-overline uppercase tracking-wider text-text-muted block">
                  Scrap / Waste
                </span>
                <span className="type-body font-semibold text-text-primary mt-0.5 block">
                  {batch.scrapQuantity} PCS
                </span>
              </div>
            )}
          </div>

          {/* Purpose / Notes */}
          {batch.purpose && (
            <div className="p-3 rounded-control border border-divider bg-surface shadow-card">
              <span className="type-overline uppercase tracking-wider text-text-muted block mb-1 flex items-center gap-1.5">
                <FileText size={12} /> Purpose &amp; Notes
              </span>
              <p className="type-body text-text-primary whitespace-pre-wrap">{batch.purpose}</p>
            </div>
          )}

          {/* Rejection reason if rejected */}
          {batch.status === "Rejected" && batch.rejectionReason && (
            <div className="p-3 rounded-control border border-status-danger/30 bg-status-danger/10 text-status-danger">
              <span className="type-overline uppercase tracking-wider font-semibold block mb-1 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Rejection Reason
              </span>
              <p className="type-body font-medium">{batch.rejectionReason}</p>
            </div>
          )}

          {/* Image preview if any */}
          {resolvedUrl && !imageError && (
            <div className="p-3 rounded-control border border-divider bg-surface shadow-card">
              <span className="type-overline uppercase tracking-wider text-text-muted block mb-2">
                Production Batch Photo
              </span>
              <div className="max-h-48 rounded-control overflow-hidden border border-divider bg-surface-secondary/40 flex items-center justify-center">
                <img
                  src={resolvedUrl}
                  alt={batch.batchNumber}
                  onError={() => setImageError(true)}
                  onClick={() => {
                    setLightboxError(false);
                    setPreviewImage(resolvedUrl);
                  }}
                  className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                />
              </div>
            </div>
          )}
        </div>

        {/* Full Lightbox */}
        {previewImage && (
          <div
            onClick={() => {
              setPreviewImage(null);
              setLightboxError(false);
            }}
            className="font-sans fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-surface text-text-primary rounded-card max-w-[640px] w-full border border-divider p-4 space-y-3 shadow-modal animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between border-b border-divider pb-2">
                <h5 className="type-table-header uppercase text-text-primary truncate pr-4">
                  {batch.batchNumber} — Photo
                </h5>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPreviewImage(null);
                    setLightboxError(false);
                  }}
                  className="h-7 px-3 type-caption font-semibold rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary cursor-pointer shrink-0"
                >
                  Close
                </Button>
              </div>
              <div className="flex items-center justify-center bg-surface-secondary/40 rounded-control p-4 min-h-[220px] max-h-[70vh] overflow-auto">
                {lightboxError ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                    <ImageIcon className="w-10 h-10 text-text-muted/50" />
                    <p className="type-body font-semibold text-text-primary">Photo Unavailable</p>
                    <p className="type-caption text-text-muted max-w-xs">
                      The image could not be loaded or the storage preview has expired.
                    </p>
                  </div>
                ) : (
                  <img
                    src={previewImage}
                    alt={batch.batchNumber}
                    onError={() => {
                      setImageError(true);
                      setLightboxError(true);
                    }}
                    className="max-h-[65vh] max-w-full object-contain rounded-control"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-divider">
          <ModalCloseButton
            fallbackOnClose={onClose}
            className="rounded-control bg-button-primary text-text-inverse px-5 py-2 type-caption font-semibold hover:bg-button-primary-hover shadow-card transition-colors cursor-pointer"
          >
            Close
          </ModalCloseButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
