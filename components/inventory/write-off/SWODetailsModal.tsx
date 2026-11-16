"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { SWOStatusBadge } from "./SWOStatusBadge";
import { downloadStockWriteOffPdf } from "./downloadStockWriteOffPdf";
import { inventory } from "@/lib/inventory/client";
import type { StockWriteOffDto } from "./types";

interface SWODetailsModalProps {
  swo: StockWriteOffDto | null;
  isAdmin: boolean;
  isImsManager: boolean;
  isRequestsTab?: boolean;
  onClose: () => void;
  onApprove?: (swo: StockWriteOffDto) => void;
  onReject?: (swo: StockWriteOffDto) => void;
  onCancel?: (swo: StockWriteOffDto) => void;
  onRemoveFromInventory?: (swo: StockWriteOffDto) => void;
}

export function SWODetailsModal({
  swo,
  isAdmin,
  isImsManager,
  isRequestsTab = false,
  onClose,
  onApprove,
  onReject,
  onCancel,
  onRemoveFromInventory,
}: SWODetailsModalProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!swo) return;
    let active = true;
    const allPhotos = swo.items.flatMap((it) => it.photos);
    allPhotos.forEach((photo) => {
      if (photo.fileId.startsWith("data:image/")) {
        setPhotoUrls((prev) => ({ ...prev, [photo.photoId]: photo.fileId }));
        return;
      }
      inventory
        .resolveWriteOffPhoto(photo.photoId)
        .then((res) => {
          if (!active) return;
          const url = res.data?.data?.url;
          if (url) {
            setPhotoUrls((prev) => ({ ...prev, [photo.photoId]: url }));
          }
        })
        .catch(() => {});
    });
    return () => {
      active = false;
    };
  }, [swo]);

  if (!swo) return null;

  const isPending = swo.status === "Pending Approval";
  const isApproved = swo.status === "Approved";
  const isRemoved = swo.status === "Removed";
  const isRejected = swo.status === "Rejected";
  const isCancelled = swo.status === "Cancelled";

  // Admin can only approve/reject in the Requests tab (view-only in all other tabs)
  const canAdminReview = isAdmin && isRequestsTab && isPending;

  const fmtDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const fmtDateTime = (d?: string | null) =>
    d
      ? new Date(d).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      await downloadStockWriteOffPdf(swo);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <ModalWrapper
      open={!!swo}
      title={
        canAdminReview
          ? `Review Stock Write-Off — ${swo.swoNumber}`
          : `Stock Write-Off Details — ${swo.swoNumber}`
      }
      onClose={onClose}
      size="max-w-5xl"
      confirmOnClose={false}
    >
      <div className="space-y-6">
        {/* Top Header Row with Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <SWOStatusBadge status={swo.status} />
            {(isRejected || isCancelled) && (
              <span className="text-[11px] font-semibold text-destructive">
                SWO No. {swo.swoNumber} is permanently retired and cannot be reused.
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            {swo.items.length} Item(s)
          </div>
        </div>

        {/* Rejection / Cancellation / Approval Feedback Banner */}
        {(swo.rejectionReason || swo.cancelReason || swo.approvalNotes) && (
          <div
            className={`p-4 rounded-xl border space-y-1.5 ${
              isRejected || isCancelled
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-border bg-muted/40 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {isRejected
                  ? `Rejected by ${swo.rejectedByName || swo.rejectedBy || "Admin"} (${fmtDateTime(swo.rejectedAt)}):`
                  : isCancelled
                  ? `Cancelled by ${swo.cancelledByName || swo.cancelledBy || "IMS Manager"} (${fmtDateTime(swo.cancelledAt)}):`
                  : `Approval Notes from ${swo.approvedByName || swo.approvedBy || "Admin"} (${fmtDateTime(swo.approvedAt)}):`}
              </span>
            </div>
            <p className="text-xs pl-6 whitespace-pre-wrap leading-relaxed opacity-95">
              {swo.rejectionReason || swo.cancelReason || swo.approvalNotes}
            </p>
          </div>
        )}

        {/* Section 1: Stock Write-Off Information (Clean Grid Card matching CreateSWOModal) */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-bold text-foreground">
            Stock Write-Off Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Write-Off Number
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs font-semibold text-foreground select-all">
                {swo.swoNumber}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Request Date
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                {fmtDate(swo.requestedAt)}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Requested By
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                {swo.requestedByName || swo.requestedBy}
              </div>
            </div>

            {(swo.approvedByName || swo.approvedBy) && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Approved By
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                  {swo.approvedByName || swo.approvedBy} ({fmtDate(swo.approvedAt)})
                </div>
              </div>
            )}

            {(swo.removedByName || swo.removedBy) && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Removed From Inventory By
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                  {swo.removedByName || swo.removedBy} ({fmtDateTime(swo.removedAt)})
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Write-Off Items (Clean Item Cards matching CreateSWOModal layout) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Write-Off Items
            </h3>
          </div>

          {swo.items.map((item, idx) => {
            const isFinishedGood =
              (item.itemType || "").toLowerCase().includes("finished") ||
              Boolean(item.variantName) ||
              Boolean(item.productId);
            const line = item.lines[0];

            return (
              <div
                key={item.writeOffItemId}
                className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs"
              >
                {/* Item Card Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h4 className="text-xs font-bold text-foreground">
                    Item {idx + 1}
                  </h4>
                </div>

                {/* Sub-section 1: Item Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">
                      Item Type
                    </label>
                    <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs font-medium text-foreground">
                      {item.itemType}
                    </div>
                  </div>

                  <div className={isFinishedGood ? "sm:col-span-2" : ""}>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">
                      Item Name
                    </label>
                    <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs font-medium text-foreground">
                      {item.itemName}
                      {item.variantName ? ` — ${item.variantName}` : ""}
                    </div>
                  </div>

                  {!isFinishedGood && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Unit of Measurement
                      </label>
                      <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground">
                        {item.uomName || "—"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sub-section 2: Batch / Lot & Write-Off Details (1 Lot) */}
                {line && (
                  <div className="space-y-3.5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">
                          Batch / Lot Number
                        </label>
                        <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs font-semibold text-foreground">
                          {line.lotCode}
                        </div>
                      </div>

                      {item.hasExpiry && (
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-foreground">
                            Expiration Date
                          </label>
                          <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground">
                            {fmtDate(line.expiryDate)}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">
                          Available Quantity
                        </label>
                        <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground">
                          {line.availableBefore} {item.uomName}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">
                          Affected Quantity
                        </label>
                        <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs font-bold text-foreground">
                          {line.quantity} {item.uomName}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">
                          Write-Off Reason
                        </label>
                        <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground">
                          {line.reason === "Other" && line.reasonOther
                            ? `Other (${line.reasonOther})`
                            : line.reason}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">
                          Disposition Method
                        </label>
                        <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground">
                          {line.disposition === "Other" && line.dispositionOther
                            ? `Other (${line.dispositionOther})`
                            : line.disposition}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Item Remarks
                      </label>
                      <div className="min-h-20 p-3 rounded-xl border border-border bg-muted/40 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                        {line.remarks || "—"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-section 3: Item Supporting Evidence (Photos) */}
                <div className="space-y-2 pt-1 border-t border-border/50">
                  <label className="block text-xs font-semibold text-foreground">
                    Item Supporting Evidence
                  </label>
                  {item.photos && item.photos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {item.photos.map((p) => {
                        const url = photoUrls[p.photoId] || p.fileId;
                        return (
                          <div
                            key={p.photoId}
                            onClick={() => url && setPreviewUrl(url)}
                            className="group relative rounded-xl border border-border overflow-hidden bg-muted/20 cursor-pointer hover:border-primary transition-all aspect-video flex flex-col items-center justify-center p-2"
                          >
                            {url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={url}
                                alt={p.fileName || "Evidence photo"}
                                className="h-full w-full object-contain rounded-lg"
                              />
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ImageIcon className="w-4 h-4" />
                                <span>{p.fileName}</span>
                              </div>
                            )}
                            <span className="absolute bottom-1 right-1 text-[10px] font-semibold bg-background/80 px-1.5 py-0.5 rounded text-foreground backdrop-blur-xs">
                              Click to view
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No supporting evidence photos attached for this item.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Last updated: {fmtDateTime(swo.updatedAt)}
          </div>

          <div className="flex items-center gap-2.5">
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Close
            </ModalCloseButton>

            {/* Download PDF Report — STRICTLY in Removed tab only */}
            {isRemoved && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {downloadingPdf ? "Generating PDF..." : "Download SWO Report (PDF)"}
              </Button>
            )}

            {/* IMS Manager: Cancel while Pending Approval */}
            {isImsManager && isPending && onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onCancel(swo)}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                Cancel Request
              </Button>
            )}

            {/* IMS Manager: Remove Items from Inventory when Approved (NO ICON as requested) */}
            {isImsManager && isApproved && onRemoveFromInventory && (
              <Button
                type="button"
                onClick={() => onRemoveFromInventory(swo)}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm cursor-pointer"
              >
                Remove Items in Inventory
              </Button>
            )}

            {/* Admin (Requests tab only): Reject & Approve when Pending Approval */}
            {canAdminReview && (
              <>
                {onReject && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onReject(swo)}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Reject
                  </Button>
                )}
                {onApprove && (
                  <Button
                    type="button"
                    onClick={() => onApprove(swo)}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm cursor-pointer"
                  >
                    Approve
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox for Photo Preview */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 z-[350] bg-black/75 flex items-center justify-center p-4 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Evidence preview"
            className="max-h-[85vh] max-w-[90vw] rounded-2xl border border-border shadow-2xl object-contain bg-card"
          />
        </div>
      )}
    </ModalWrapper>
  );
}
