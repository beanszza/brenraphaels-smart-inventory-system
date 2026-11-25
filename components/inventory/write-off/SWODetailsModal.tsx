"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ChevronLeft, Download, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { SWOStatusBadge } from "./SWOStatusBadge";
import { downloadStockWriteOffPdf } from "./downloadStockWriteOffPdf";
import { inventory } from "@/lib/inventory/client";
import type { StockWriteOffDto } from "./types";

export interface SWODetailsProps {
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

interface SWODetailsBodyProps extends SWODetailsProps {
  variant: "page" | "modal";
  embedded?: boolean;
}

function SWODetailsBody({
  swo,
  isAdmin,
  isImsManager,
  isRequestsTab = false,
  onClose,
  onApprove,
  onReject,
  onCancel,
  onRemoveFromInventory,
  variant,
  embedded = false,
}: SWODetailsBodyProps) {
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

  useEffect(() => {
    if (!previewUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [previewUrl]);

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

  const totalLotsCount = swo.items.reduce((acc, it) => acc + it.lines.length, 0);
  const totalPhotosCount = swo.items.reduce((acc, it) => acc + (it.photos?.length || 0), 0);

  const distinctReasons = Array.from(
    new Set(
      swo.items.flatMap((it) =>
        it.lines.map((l) =>
          l.reason === "Other" && l.reasonOther ? `Other (${l.reasonOther})` : l.reason
        )
      )
    )
  );

  const distinctDispositions = Array.from(
    new Set(
      swo.items.flatMap((it) =>
        it.lines.map((l) =>
          l.disposition === "Other" && l.dispositionOther
            ? `Other (${l.dispositionOther})`
            : l.disposition
        )
      )
    )
  );

  const summaryTotalLabel = (() => {
    const itemCount = swo.items.length;
    const itemWord = itemCount === 1 ? "item" : "items";
    if (itemCount === 1 && swo.items[0].lines[0]) {
      const qty = swo.items[0].lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
      return `${itemCount} ${itemWord} (${qty.toLocaleString()} ${swo.items[0].uomName})`;
    }
    if (itemCount > 1) {
      const sameUom = swo.items.every((it) => it.uomName === swo.items[0].uomName);
      if (sameUom) {
        const sum = swo.items.reduce(
          (s, it) => s + it.lines.reduce((ls, l) => ls + Number(l.quantity || 0), 0),
          0
        );
        return `${itemCount} ${itemWord} (${sum.toLocaleString()} ${swo.items[0].uomName})`;
      }
    }
    return `${itemCount} ${itemWord}`;
  })();

  const containerClasses =
    variant === "page"
      ? embedded
        ? "space-y-6 pb-12 animate-page-in"
        : "page-container px-4 sm:px-8 w-full space-y-6 pb-12 animate-page-in"
      : "space-y-5";

  return (
    <>
      <div className={containerClasses}>
        {/* Top Back Link, SWO Number + Status Badge & Top-Right Actions (Page Mode) */}
        {variant === "page" && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Stock write-offs</span>
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="type-page-title text-ink tabular-nums">{swo.swoNumber}</h1>
                  <SWOStatusBadge status={swo.status} />
                </div>
                <p className="type-body text-ink-muted">
                  {canAdminReview ? "Review stock write-off request" : "Stock write-off details"} &middot;{" "}
                  {swo.items.length} {swo.items.length === 1 ? "item" : "items"} &middot;{" "}
                  {totalLotsCount} {totalLotsCount === 1 ? "lot" : "lots"}
                  {isApproved && isImsManager ? " · Ready for inventory removal" : ""}
                </p>
              </div>

              {/* Top-Right Action Buttons (Close, Remove Items in Inventory, PDF Export, Cancel, Reject, Approve) */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
                >
                  Close
                </Button>

                {/* Download PDF Report — STRICTLY when Removed */}
                {isRemoved && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    className="rounded-control border border-border bg-surface px-4 h-9 type-label-button-sm text-ink hover:bg-subtle shadow-none inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-primary" />
                    <span>{downloadingPdf ? "Generating PDF..." : "Download SWO Report (PDF)"}</span>
                  </Button>
                )}

                {/* IMS Manager: Cancel Request while Pending Approval */}
                {isImsManager && isPending && onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onCancel(swo)}
                    className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
                  >
                    Cancel Request
                  </Button>
                )}

                {/* IMS Manager: Remove Items in Inventory when Approved (with confirmation modal) */}
                {isImsManager && isApproved && onRemoveFromInventory && (
                  <Button
                    type="button"
                    onClick={() => onRemoveFromInventory(swo)}
                    className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
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
                        className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
                      >
                        Reject
                      </Button>
                    )}
                    {onApprove && (
                      <Button
                        type="button"
                        onClick={() => onApprove(swo)}
                        className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
                      >
                        Approve
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal-only compact header bar */}
        {variant === "modal" && (
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-divider">
            <div className="flex items-center gap-3">
              <SWOStatusBadge status={swo.status} />
              {(isRejected || isCancelled) && (
                <span className="type-caption font-semibold text-destructive">
                  SWO No. {swo.swoNumber} is permanently retired and cannot be reused.
                </span>
              )}
            </div>
            <div className="type-caption text-ink-muted font-medium">
              {swo.items.length} Item(s)
            </div>
          </div>
        )}

        {/* Permanently Retired Notice (Page Mode) */}
        {variant === "page" && (isRejected || isCancelled) && (
          <div className="p-3.5 rounded-inner border border-notice-danger-border bg-notice-danger-bg text-notice-danger-text type-caption font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              SWO No. {swo.swoNumber} is permanently retired and cannot be reused.
            </span>
          </div>
        )}

        {/* Rejection / Cancellation / Approval Feedback Banner */}
        {(swo.rejectionReason || swo.cancelReason || swo.approvalNotes) && (
          <div
            className={`p-4 rounded-inner border space-y-1.5 ${
              isRejected || isCancelled
                ? "border-notice-danger-border bg-notice-danger-bg text-notice-danger-text"
                : "border-border bg-page text-ink"
            }`}
          >
            <div className="flex items-center gap-2 type-label-field font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {isRejected
                  ? `Rejected by ${swo.rejectedByName || swo.rejectedBy || "Admin"} (${fmtDateTime(swo.rejectedAt)}):`
                  : isCancelled
                  ? `Cancelled by ${swo.cancelledByName || swo.cancelledBy || "IMS Manager"} (${fmtDateTime(swo.cancelledAt)}):`
                  : `Approval Notes from ${swo.approvedByName || swo.approvedBy || "Admin"} (${fmtDateTime(swo.approvedAt)}):`}
              </span>
            </div>
            <p className="type-body-secondary pl-6 whitespace-pre-wrap leading-relaxed opacity-95">
              {swo.rejectionReason || swo.cancelReason || swo.approvalNotes}
            </p>
          </div>
        )}

        {/* Main 2-Column Layout (Matching Figma Page 2 New Purchase Order spacing & structure) */}
        <div
          className={
            variant === "page"
              ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start"
              : "space-y-6"
          }
        >
          {/* Left Column: Write-off details & Write-off items */}
          <div className="min-w-0 space-y-6">
            {/* Card 1: Write-off details (2-column spacious grid) */}
            <div className="rounded-card border border-border bg-surface p-6 space-y-5">
              <h2 className="type-subsection text-ink">Write-off details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
                <div>
                  <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                    Write-Off Number
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary font-semibold text-ink select-all tabular-nums">
                    {swo.swoNumber}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                    Request Date
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
                    {fmtDate(swo.requestedAt)}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                    Requested By
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
                    {swo.requestedByName || swo.requestedBy}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                    Status
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
                    {swo.status}
                  </div>
                </div>

                {(swo.approvedByName || swo.approvedBy) && (
                  <div className={swo.removedByName || swo.removedBy ? "" : "sm:col-span-2"}>
                    <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                      Approved By
                    </label>
                    <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
                      {swo.approvedByName || swo.approvedBy} ({fmtDate(swo.approvedAt)})
                    </div>
                  </div>
                )}

                {(swo.removedByName || swo.removedBy) && (
                  <div>
                    <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                      Removed From Inventory By
                    </label>
                    <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
                      {swo.removedByName || swo.removedBy} ({fmtDateTime(swo.removedAt)})
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Write-off items */}
            <div className="rounded-card border border-border bg-surface p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="type-subsection text-ink">Write-off items</h2>
                  <p className="mt-1 type-caption text-ink-muted">
                    Inventory items, batches / lots, reasons, and evidence recorded for write-off.
                  </p>
                </div>
                <span className="type-caption font-medium text-ink-muted tabular-nums whitespace-nowrap">
                  {swo.items.length} {swo.items.length === 1 ? "item" : "items"} listed · {totalLotsCount} {totalLotsCount === 1 ? "lot" : "lots"}
                </span>
              </div>

              <div className="space-y-5">
                {swo.items.map((item, idx) => {
                  const isFinishedGood =
                    (item.itemType || "").toLowerCase().includes("finished") ||
                    Boolean(item.variantName) ||
                    Boolean(item.productId);
                  const line = item.lines[0];
                  const fullWidthLotRow = !isFinishedGood && item.hasExpiry;

                  return (
                    <div
                      key={item.writeOffItemId}
                      className="rounded-inner border border-border bg-surface p-5 space-y-5"
                    >
                      {/* Item Sub-Card Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-divider">
                        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-status-purple-bg text-primary type-badge-compact font-semibold">
                            Item {idx + 1}
                          </span>
                          <span className="type-caption font-medium text-ink-secondary truncate">
                            {item.itemName}
                            {item.variantName ? ` — ${item.variantName}` : ""}
                            {line ? ` · ${line.lotCode}` : ""}
                          </span>
                        </div>
                        {line && (
                          <span className="type-caption font-semibold text-ink tabular-nums shrink-0">
                            {line.quantity.toLocaleString()} {item.uomName} to write off
                          </span>
                        )}
                      </div>

                      {/* Spacious 2-Column Fields Grid per Lot */}
                      {item.lines.map((lotLine) => {
                        const isLotExpired =
                          lotLine.expiryDate &&
                          new Date(lotLine.expiryDate).getTime() < new Date(swo.requestedAt).getTime();

                        return (
                          <div key={lotLine.lineId} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
                              <div>
                                <label className="mb-2 block type-label-field text-ink">
                                  Item Type
                                </label>
                                <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary font-medium text-ink truncate">
                                  {item.itemType}
                                </div>
                              </div>

                              <div>
                                <label className="mb-2 block type-label-field text-ink">
                                  Item Name
                                </label>
                                <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary font-medium text-ink truncate">
                                  {item.itemName}
                                  {item.variantName ? ` — ${item.variantName}` : ""}
                                </div>
                              </div>

                              <div className={fullWidthLotRow ? "sm:col-span-2" : ""}>
                                <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                                  Batch / Lot Number
                                </label>
                                <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary font-semibold text-ink tabular-nums truncate">
                                  {lotLine.lotCode}
                                </div>
                              </div>

                              {!isFinishedGood && (
                                <div>
                                  <label className="mb-2 block type-label-field text-ink">
                                    Unit of Measurement
                                  </label>
                                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
                                    {item.uomName || "—"}
                                  </div>
                                </div>
                              )}

                              {item.hasExpiry && (
                                <div>
                                  <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                                    Expiration Date
                                  </label>
                                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary">
                                    <span
                                      className={
                                        isLotExpired
                                          ? "font-semibold text-destructive"
                                          : "text-ink-secondary"
                                      }
                                    >
                                      {fmtDate(lotLine.expiryDate)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div>
                                <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                                  Available Quantity
                                </label>
                                <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary text-ink-secondary tabular-nums truncate">
                                  {lotLine.availableBefore.toLocaleString()} {item.uomName}
                                </div>
                              </div>

                              <div>
                                <label className="mb-2 block type-label-field text-ink whitespace-nowrap">
                                  Affected Quantity
                                </label>
                                <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body-secondary font-semibold text-ink tabular-nums truncate">
                                  {lotLine.quantity.toLocaleString()} {item.uomName}
                                </div>
                              </div>

                              <div>
                                <label className="mb-2 block type-label-field text-ink">
                                  Write-Off Reason
                                </label>
                                <div className="flex items-center min-h-10 px-3.5 py-2 rounded-control border border-border bg-page type-body-secondary text-ink">
                                  {lotLine.reason === "Other" && lotLine.reasonOther
                                    ? `Other (${lotLine.reasonOther})`
                                    : lotLine.reason}
                                </div>
                              </div>

                              <div>
                                <label className="mb-2 block type-label-field text-ink">
                                  Disposition Method
                                </label>
                                <div className="flex items-center min-h-10 px-3.5 py-2 rounded-control border border-border bg-page type-body-secondary text-ink">
                                  {lotLine.disposition === "Other" && lotLine.dispositionOther
                                    ? `Other (${lotLine.dispositionOther})`
                                    : lotLine.disposition}
                                </div>
                              </div>
                            </div>

                            <div className="pt-1 border-t border-divider">
                              <label className="mb-2 pt-3 block type-label-field text-ink">
                                Item Remarks
                              </label>
                              <div className="min-h-14 px-3.5 py-2.5 rounded-control border border-border bg-page type-body-secondary text-ink whitespace-pre-wrap leading-relaxed">
                                {lotLine.remarks || "—"}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Supporting Evidence Photos */}
                      <div className="space-y-2">
                        <label className="block type-label-field text-ink">
                          Item Supporting Evidence
                        </label>
                        {item.photos && item.photos.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {item.photos.map((p) => {
                              const url = photoUrls[p.photoId] || (p.fileId.startsWith("data:image/") ? p.fileId : "");
                              return (
                                <button
                                  key={p.photoId}
                                  type="button"
                                  onClick={() => url && setPreviewUrl(url)}
                                  className="group flex items-center gap-3 p-2.5 rounded-control border border-border bg-page hover:border-primary transition-colors text-left cursor-pointer"
                                >
                                  <div className="size-12 rounded-sm border border-border bg-surface overflow-hidden flex items-center justify-center shrink-0">
                                    {url ? (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img
                                        src={url}
                                        alt={p.fileName || "Evidence photo"}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <ImageIcon className="w-4 h-4 text-ink-muted" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="type-caption font-medium text-ink truncate">
                                      {p.fileName || "Evidence photo"}
                                    </div>
                                    <div className="type-caption text-primary group-hover:underline">
                                      Click to preview
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="type-caption text-ink-muted">
                            No supporting evidence photos attached for this item.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal-only General remarks */}
            {variant === "modal" && (
              <div className="rounded-card border border-border bg-surface p-6 space-y-3">
                <h2 className="type-subsection text-ink">General remarks</h2>
                <div
                  className={`w-full rounded-control border border-border bg-page px-3.5 py-2.5 type-body-secondary leading-relaxed whitespace-pre-wrap ${
                    swo.generalRemarks && swo.generalRemarks.trim()
                      ? "text-ink"
                      : "text-ink-muted"
                  }`}
                >
                  {swo.generalRemarks && swo.generalRemarks.trim()
                    ? swo.generalRemarks
                    : "No general remarks provided."}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Write-off Summary + General Remarks (Matching Figma Page 2 New Purchase Order right rail) */}
          {variant === "page" && (
            <div className="space-y-6">
              <div className="rounded-card border border-border bg-surface p-6 space-y-4">
                <h2 className="type-subsection text-ink">Write-off summary</h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Write-Off No.</span>
                    <span className="font-medium text-ink tabular-nums">{swo.swoNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Status</span>
                    <span className="font-medium text-ink">{swo.status}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Request Date</span>
                    <span className="font-medium text-ink">{fmtDate(swo.requestedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Requested By</span>
                    <span className="font-medium text-ink truncate max-w-[180px]">
                      {swo.requestedByName || swo.requestedBy}
                    </span>
                  </div>
                  {(swo.approvedByName || swo.approvedBy) && (
                    <div className="flex items-center justify-between gap-3 type-body-secondary">
                      <span className="text-ink-muted">Approved By</span>
                      <span className="font-medium text-ink truncate max-w-[180px]">
                        {swo.approvedByName || swo.approvedBy}
                      </span>
                    </div>
                  )}
                  {(swo.removedByName || swo.removedBy) && (
                    <div className="flex items-center justify-between gap-3 type-body-secondary">
                      <span className="text-ink-muted">Removed By</span>
                      <span className="font-medium text-ink truncate max-w-[180px]">
                        {swo.removedByName || swo.removedBy}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Items Listed</span>
                    <span className="font-medium text-ink tabular-nums">
                      {swo.items.length} {swo.items.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Batches / Lots</span>
                    <span className="font-medium text-ink tabular-nums">
                      {totalLotsCount} {totalLotsCount === 1 ? "lot" : "lots"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted shrink-0">Primary Reason</span>
                    <span className="font-medium text-ink text-right break-words">
                      {distinctReasons.join(", ") || "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted shrink-0">Disposition</span>
                    <span className="font-medium text-ink text-right break-words">
                      {distinctDispositions.join(", ") || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Evidence Photos</span>
                    <span className="font-medium text-ink tabular-nums">
                      {totalPhotosCount} attached
                    </span>
                  </div>
                </div>

                <div className="border-t border-divider pt-3.5 flex items-center justify-between gap-3">
                  <span className="type-subsection text-ink">Total items to write off</span>
                  <span className="type-card-title text-primary tabular-nums text-right">
                    {summaryTotalLabel}
                  </span>
                </div>
              </div>

              {/* General Remarks Card in Right Rail (Matching PO "Notes to supplier" card) */}
              <div className="rounded-card border border-border bg-surface p-6 space-y-3.5">
                <h2 className="type-subsection text-ink">General remarks</h2>
                <div
                  className={`w-full rounded-control border border-border bg-page px-3.5 py-2.5 type-body-secondary leading-relaxed whitespace-pre-wrap ${
                    swo.generalRemarks && swo.generalRemarks.trim()
                      ? "text-ink"
                      : "text-ink-muted"
                  }`}
                >
                  {swo.generalRemarks && swo.generalRemarks.trim()
                    ? swo.generalRemarks
                    : "No general remarks provided."}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Metadata Bar (Page Mode keeps only Last Updated; Modal Mode keeps footer buttons) */}
        {variant === "page" ? (
          <div className="border-t border-divider pt-4">
            <div className="type-caption text-ink-muted">
              Last updated: {fmtDateTime(swo.updatedAt)}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-divider">
            <div className="type-caption text-ink-muted">
              Last updated: {fmtDateTime(swo.updatedAt)}
            </div>
            <div className="flex items-center gap-2.5">
              <ModalCloseButton
                type="button"
                variant="outline"
                fallbackOnClose={onClose}
                className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
              >
                Close
              </ModalCloseButton>
              {isRemoved && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-ink hover:bg-subtle inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {downloadingPdf ? "Generating PDF..." : "Download SWO Report (PDF)"}
                </Button>
              )}
              {isImsManager && isPending && onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onCancel(swo)}
                  className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-destructive hover:bg-notice-danger-bg cursor-pointer"
                >
                  Cancel Request
                </Button>
              )}
              {isImsManager && isApproved && onRemoveFromInventory && (
                <Button
                  type="button"
                  onClick={() => onRemoveFromInventory(swo)}
                  className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover cursor-pointer"
                >
                  Remove Items in Inventory
                </Button>
              )}
              {canAdminReview && (
                <>
                  {onReject && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onReject(swo)}
                      className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-destructive hover:bg-notice-danger-bg cursor-pointer"
                    >
                      Reject
                    </Button>
                  )}
                  {onApprove && (
                    <Button
                      type="button"
                      onClick={() => onApprove(swo)}
                      className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover cursor-pointer"
                    >
                      Approve
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox for Photo Preview (Portaled to document.body with Escape support) */}
      {previewUrl &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Evidence photo preview"
            onClick={() => setPreviewUrl(null)}
            className="fixed inset-0 z-[100060] bg-scrim flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-150"
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              aria-label="Close preview"
              className="fixed top-4 right-4 p-2 rounded-pill bg-surface/90 text-ink border border-border hover:bg-surface transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Evidence preview"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[90vw] rounded-modal border border-border shadow-modal object-contain bg-surface cursor-default"
            />
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * Full-page Stock Write-Off Details / Admin Review view matching Figma Stock Write-Off · Redesign.
 */
export function SWODetailsView(props: SWODetailsProps & { embedded?: boolean }) {
  return <SWODetailsBody {...props} variant="page" />;
}

/**
 * Backward-compatible modal wrapper for Stock Write-Off Details.
 */
export function SWODetailsModal(props: SWODetailsProps) {
  if (!props.swo) return null;
  const canAdminReview =
    props.isAdmin && Boolean(props.isRequestsTab) && props.swo.status === "Pending Approval";

  return (
    <ModalWrapper
      open={!!props.swo}
      title={
        canAdminReview
          ? `Review Stock Write-Off — ${props.swo.swoNumber}`
          : `Stock Write-Off Details — ${props.swo.swoNumber}`
      }
      onClose={props.onClose}
      size="max-w-5xl"
      confirmOnClose={false}
    >
      <SWODetailsBody {...props} variant="modal" />
    </ModalWrapper>
  );
}
