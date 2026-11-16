"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, Download, Image as ImageIcon, PackageMinus } from "lucide-react";
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

  const fmtMoney = (n: number) =>
    `₱${Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      await downloadStockWriteOffPdf(swo);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const totalLotsCount = swo.items.reduce((acc, it) => acc + it.lines.length, 0);

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
                SWO No. {swo.swoNumber} is permanently blocked and cannot be reused.
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {swo.items.length} Item(s) · {totalLotsCount} Batch / Lot Line(s) · Total Value:{" "}
            <span className="font-bold text-foreground">{fmtMoney(swo.totalValue)}</span>
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

        {/* Stock Write-Off Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border">
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
              {fmtDateTime(swo.requestedAt)}
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
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Removed From Inventory By
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                {swo.removedByName || swo.removedBy} ({fmtDateTime(swo.removedAt)})
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Total Write-Off Value
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs font-bold text-foreground">
              {fmtMoney(swo.totalValue)}
            </div>
          </div>
        </div>

        {/* Write-Off Items Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Write-Off Items ({swo.items.length})
            </h3>
          </div>

          {swo.items.map((item, idx) => (
            <div
              key={item.writeOffItemId}
              className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-xs"
            >
              {/* Item Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                    Item {idx + 1}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {item.itemName}
                      {item.variantName ? ` — ${item.variantName}` : ""}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({item.itemCode})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Item Type: <span className="font-semibold text-foreground">{item.itemType}</span> · Unit of Measurement:{" "}
                      <span className="font-semibold text-foreground">{item.uomName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lots Table for this Item */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3.5 py-2.5 text-left font-bold text-muted-foreground whitespace-nowrap">
                        BATCH / LOT NO.
                      </th>
                      {item.hasExpiry && (
                        <th className="px-3.5 py-2.5 text-left font-bold text-muted-foreground whitespace-nowrap">
                          EXPIRATION DATE
                        </th>
                      )}
                      <th className="px-3.5 py-2.5 text-right font-bold text-muted-foreground whitespace-nowrap">
                        AVAILABLE BEFORE
                      </th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-muted-foreground whitespace-nowrap">
                        AFFECTED QTY
                      </th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-muted-foreground whitespace-nowrap">
                        UNIT COST
                      </th>
                      <th className="px-3.5 py-2.5 text-right font-bold text-muted-foreground whitespace-nowrap">
                        LINE VALUE
                      </th>
                      <th className="px-3.5 py-2.5 text-left font-bold text-muted-foreground whitespace-nowrap">
                        WRITE-OFF REASON
                      </th>
                      <th className="px-3.5 py-2.5 text-left font-bold text-muted-foreground whitespace-nowrap">
                        DISPOSITION METHOD
                      </th>
                      <th className="px-3.5 py-2.5 text-left font-bold text-muted-foreground">
                        ITEM REMARKS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {item.lines.map((line) => {
                      const reasonText =
                        line.reason === "Other" && line.reasonOther
                          ? `Other (${line.reasonOther})`
                          : line.reason;
                      const dispositionText =
                        line.disposition === "Other" && line.dispositionOther
                          ? `Other (${line.dispositionOther})`
                          : line.disposition;
                      return (
                        <tr key={line.lineId} className="hover:bg-muted/20">
                          <td className="px-3.5 py-2.5 font-mono font-semibold text-foreground whitespace-nowrap">
                            {line.lotCode}
                          </td>
                          {item.hasExpiry && (
                            <td className="px-3.5 py-2.5 text-muted-foreground whitespace-nowrap">
                              {fmtDate(line.expiryDate)}
                            </td>
                          )}
                          <td className="px-3.5 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                            {line.availableBefore.toLocaleString()} {item.uomName}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-bold text-foreground whitespace-nowrap">
                            {line.quantity.toLocaleString()} {item.uomName}
                          </td>
                          <td className="px-3.5 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                            {fmtMoney(line.unitCost)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">
                            {fmtMoney(line.lineValue)}
                          </td>
                          <td className="px-3.5 py-2.5 text-foreground whitespace-nowrap">
                            {reasonText}
                          </td>
                          <td className="px-3.5 py-2.5 text-foreground whitespace-nowrap">
                            {dispositionText}
                          </td>
                          <td className="px-3.5 py-2.5 text-muted-foreground min-w-[180px]">
                            {line.remarks || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Supporting Evidence Photos (Optional) */}
              {item.photos && item.photos.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    Supporting Evidence Photos ({item.photos.length})
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {item.photos.map((photo) => {
                      const resolvedUrl = photoUrls[photo.photoId];
                      return (
                        <button
                          key={photo.photoId}
                          type="button"
                          onClick={() => resolvedUrl && setPreviewUrl(resolvedUrl)}
                          className="group relative flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2 hover:bg-muted transition-colors text-left cursor-pointer"
                        >
                          {resolvedUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolvedUrl}
                              alt={photo.fileName}
                              className="w-12 h-12 rounded-lg object-cover border border-border"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="max-w-[140px]">
                            <div className="text-xs font-medium text-foreground truncate">
                              {photo.fileName}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {Math.max(1, Math.round(photo.fileSize / 1024))} KB
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* General Remarks */}
        {swo.generalRemarks && (
          <div className="flex justify-start pt-2 border-t border-border">
            <div className="w-full sm:w-2/3 lg:w-1/2 space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                General Remarks
              </label>
              <div className="w-full rounded-xl border border-border bg-muted/40 p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {swo.generalRemarks}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
          <div className="text-xs text-muted-foreground">
            {swo.updatedAt ? `Last updated: ${fmtDateTime(swo.updatedAt)}` : ""}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Close
            </ModalCloseButton>

            {/* Download PDF Report (Available on Removed, Approved, Rejected, Cancelled) */}
            {(isRemoved || isApproved || isRejected || isCancelled) && (
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

            {/* IMS Manager: Remove Items from Inventory when Approved */}
            {isImsManager && isApproved && onRemoveFromInventory && (
              <Button
                type="button"
                onClick={() => onRemoveFromInventory(swo)}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <PackageMinus className="w-4 h-4" />
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
