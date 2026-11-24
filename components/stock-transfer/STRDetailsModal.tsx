"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, MapPin, User, AlertCircle, CheckCircle, Package, Truck, FileText, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransferRequest } from "./types";
import { useConfirmedClose } from "@/components/shared/ModalCloseContext";
import { resolveStaffName } from "@/lib/orders/dto";
import { TransferProofThumbnail } from "./TransferProofThumbnail";

interface STRDetailsModalProps {
  request: StockTransferRequest | null;
  open: boolean;
  isAdmin?: boolean;
  isImsManager?: boolean;
  onClose: () => void;
  onApprove?: (req: StockTransferRequest) => void;
  onReject?: (req: StockTransferRequest) => void;
  onSchedule?: (req: StockTransferRequest) => void;
  onCancel?: (req: StockTransferRequest) => void;
  onDispatch?: (req: StockTransferRequest, transferId?: number) => void;
}

export function STRDetailsModal({
  request,
  open,
  isAdmin = false,
  isImsManager = false,
  onClose,
  onApprove,
  onReject,
  onSchedule,
  onCancel,
  onDispatch,
}: STRDetailsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ title: string; src: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  const { requestClose, confirmModal } = useConfirmedClose(onClose);

  if (!open || !mounted || !request) return null;

  const hasScheduledTransfer = request.transfers?.some((t) => t.status === "Scheduled") ?? false;
  const isFullyScheduledOrDispatched =
    request.status === "Scheduled" || request.status === "Dispatched" || hasScheduledTransfer;

  return createPortal(
    <div
      className="font-sans fixed inset-0 z-[200] flex items-center justify-center bg-backdrop p-4 sm:p-6 animate-in fade-in duration-150"
    >
      {confirmModal}
      <div
        style={{ width: "100%", maxWidth: "1000px" }}
        className="w-full max-h-[92vh] bg-surface rounded-panel shadow-2xl border border-divider overflow-hidden flex flex-col text-text-primary shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-divider px-6 py-5">
          <div className="flex items-center gap-2.5">
            <h2 className="type-modal-title text-text-primary">
              Stock Transfer Request Details
            </h2>
            <StatusBadge status={hasScheduledTransfer && request.status === "Approved" ? "Scheduled" : request.status} />
            {request.branchRequestNumber && (
              <span className="px-2.5 py-0.5 rounded-full bg-status-purple-bg text-primary type-caption font-semibold">
                POS: {request.branchRequestNumber}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-control p-2 text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Review Status Banner (Approved / Reviewed / Rejected) */}
          {request.reviewedBy ? (
            <div className="p-4 rounded-panel border border-divider bg-muted/20 space-y-1">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary">
                    {request.status === "Approved" ? "Approved by" : "Reviewed by"}:
                  </span>
                  <span className="text-text-primary font-semibold">
                    {resolveStaffName(request.reviewedBy) || request.reviewedBy}
                  </span>
                  {request.reviewedAt && (
                    <span className="text-text-muted">
                      on {new Date(request.reviewedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <StatusBadge status={request.status} />
              </div>
              {request.adminNotes && (
                <p className="text-xs text-text-muted pt-1 italic">
                  "{request.adminNotes}"
                </p>
              )}
            </div>
          ) : (request.status === "Cancelled" || request.status === "Rejected") ? (
            <div className="p-4 rounded-control border border-destructive/20 bg-destructive/5 space-y-1.5 text-destructive">
              <div className="flex items-center gap-2 type-caption font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{request.status === "Cancelled" ? "Cancellation Reason:" : "Rejection Reason:"}</span>
              </div>
              <p className="text-xs pl-6 text-text-muted italic">
                {request.adminNotes || "No rejection or cancellation reason recorded."}
              </p>
            </div>
          ) : null}

          {/* Structured Read-only Form matching PR & PO Details Modals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 rounded-panel bg-muted/20 border border-divider">
            {/* Request Number */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Request Number
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface-hover text-xs text-text-muted select-all font-mono font-medium">
                {request.requestNumber}
              </div>
            </div>

            {/* Destination Branch */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Destination Branch
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface-hover text-xs text-text-primary font-semibold">
                <MapPin className="w-3.5 h-3.5 mr-2 text-text-muted shrink-0" />
                <span className="truncate">{request.toLocationName}</span>
              </div>
            </div>

            {/* Requested By (Actual Full Name) */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Requested By
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface-hover text-xs text-text-primary font-semibold">
                <User className="w-3.5 h-3.5 mr-2 text-text-muted shrink-0" />
                <span>{resolveStaffName(request.requestedBy) || request.requestedBy}</span>
              </div>
            </div>

            {/* Request Date */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Request Date
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface-hover text-xs text-text-muted">
                <Calendar className="w-3.5 h-3.5 mr-2 text-text-muted shrink-0" />
                <span>{new Date(request.requestDate).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Required Date */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Required Date
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface-hover text-xs text-text-muted">
                <Calendar className="w-3.5 h-3.5 mr-2 text-text-muted shrink-0" />
                <span>{new Date(request.requiredDate).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Priority
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface-hover text-xs text-text-primary font-semibold">
                <span className="px-2 py-0.5 rounded-control bg-surface type-caption font-semibold border border-divider">
                  {request.priority}
                </span>
              </div>
            </div>

            {/* Reason / Purpose (Full Width) */}
            <div className="col-span-full">
              <label className="mb-1.5 block text-xs font-semibold text-text-primary">
                Reason / Purpose
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface-hover text-xs text-text-primary font-medium">
                {request.reason || "Branch Replenishment"}
              </div>
            </div>
          </div>

          {/* Scheduled Transportation Details Card */}
          {Boolean(
            (request.status === "Scheduled" || request.status === "Dispatched" || request.status === "Completed" || hasScheduledTransfer) &&
            request.transfers && request.transfers.length > 0
          ) && (() => {
            const scheduledTransfer =
              request.transfers?.find((t) => t.status === "Completed" || t.status === "Dispatched" || t.status === "Scheduled") ||
              request.transfers?.[0];
            let schedMeta: any = {};
            let dispatchMeta: any = {};
            if (scheduledTransfer?.notes) {
              const notesParts = scheduledTransfer.notes.split(" | ");
              for (const part of notesParts) {
                try {
                  const p = JSON.parse(part);
                  if (p.transportProvider || p.plateNumber || p.driverName || p.attachmentData || p.attachmentName) {
                    schedMeta = { ...schedMeta, ...p };
                  }
                  if (p.actualDispatchDate || p.proofDataUrl || p.proofFileName || p.releasedBy) {
                    dispatchMeta = { ...dispatchMeta, ...p };
                  }
                } catch {
                  // not json
                }
              }
            }

            const bookingProofSrc = scheduledTransfer?.proofOfReceipt || schedMeta.attachmentData || "";
            const dispatchProofSrc = dispatchMeta.proofDataUrl || "";

            return (
              <div className="p-5 rounded-panel bg-muted/20 border border-divider space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-text-primary" />
                    <h3 className="type-card-title text-text-primary">
                      Scheduled Transportation & Driver Details
                    </h3>
                  </div>
                  <span className="type-overline font-semibold uppercase tracking-wider text-text-muted bg-surface-hover px-2.5 py-1 rounded-full">
                    {scheduledTransfer?.status.toUpperCase() || "SCHEDULED"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                  <div>
                    <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Transport Provider</span>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{schedMeta.transportProvider || scheduledTransfer?.courierName || "—"}</p>
                  </div>
                  <div>
                    <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Vehicle Type & Plate</span>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">
                      {schedMeta.vehicleType ? `${schedMeta.vehicleType} • ` : ""}
                      {schedMeta.plateNumber || scheduledTransfer?.vehiclePlate || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Driver Name</span>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{schedMeta.driverName || scheduledTransfer?.driverName || "—"}</p>
                  </div>
                  <div>
                    <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Driver Contact</span>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{schedMeta.driverContact || "—"}</p>
                  </div>
                  <div>
                    <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Booking Reference / Fee</span>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">
                      {schedMeta.bookingReference ? `Ref: ${schedMeta.bookingReference}` : ""}
                      {schedMeta.transferFee ? ` (₱${Number(schedMeta.transferFee).toLocaleString()})` : (!schedMeta.bookingReference ? "—" : "")}
                    </p>
                  </div>
                </div>
                {schedMeta.remarks && (
                  <div className="pt-2 border-t border-divider/50 text-xs text-text-muted">
                    <strong className="text-text-primary">Logistics Instructions:</strong> {schedMeta.remarks}
                  </div>
                )}

                {/* Document Proofs & Attachments */}
                {(bookingProofSrc || dispatchProofSrc) && (
                  <div className="pt-3 border-t border-divider/60 space-y-2.5">
                    <h4 className="type-overline font-semibold uppercase tracking-wider text-text-muted">
                      Document Proofs &amp; Attachments
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {bookingProofSrc && (
                        <TransferProofThumbnail
                          rawSrc={bookingProofSrc}
                          title="Booking / Transaction Receipt"
                          subtitle={schedMeta.attachmentName || "Uploaded when scheduling transfer"}
                          onPreview={setPreviewImage}
                          size="small"
                        />
                      )}

                      {dispatchProofSrc && (
                        <TransferProofThumbnail
                          rawSrc={dispatchProofSrc}
                          title="Dispatch Proof Photo"
                          subtitle={dispatchMeta.proofFileName || "Uploaded upon transfer departure"}
                          onPreview={setPreviewImage}
                          size="small"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="type-card-title text-text-primary flex items-center gap-2">
                <Package className="w-4 h-4 text-text-muted" />
                Requested Finished Products ({request.items?.length || 0})
              </h3>
            </div>

            <div className="border border-divider rounded-panel overflow-hidden bg-surface shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-hover text-text-muted font-semibold border-b border-divider">
                    <tr>
                      <th className="px-5 py-3.5">Product Name</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">SKU</th>
                      <th className="px-5 py-3.5">Variant</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">Req. Qty</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">Commissary Stock</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">Expiry Date</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {request.items?.map((item, idx) => {
                      const firstLot = item.suggestedLots?.[0];
                      return (
                        <tr key={idx} className="hover:bg-surface-hover/20 transition-colors">
                          <td className="px-5 py-4 font-semibold text-text-primary">
                            {item.productName}
                          </td>
                          <td className="px-5 py-4 text-text-muted whitespace-nowrap">
                            {item.sku || "—"}
                          </td>
                          <td className="px-5 py-4 text-text-primary font-medium whitespace-nowrap">
                            {item.variant || "Standard"}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-text-primary type-table-cell">
                            {item.requestedQuantity}
                          </td>
                          <td className="px-5 py-4 text-right font-medium text-text-primary">
                            {item.availableQuantity}
                          </td>
                          <td className="px-5 py-4">
                            {item.suggestedLots && item.suggestedLots.length > 0 ? (
                              <div className="space-y-1.5 py-0.5">
                                {item.suggestedLots.map((sl, slIdx) => (
                                  <div key={slIdx} className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-text-primary text-xs">
                                        {sl.expiryDate
                                          ? new Date(sl.expiryDate).toLocaleDateString()
                                          : "No Expiry"}
                                      </span>
                                    </div>
                                    {sl.lotCode && (
                                      <div className="type-caption text-text-muted font-mono">
                                        Lot: {sl.lotCode.replace(/^FG-/i, "")}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-text-muted text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {item.isInsufficient ? (
                              <StatusBadge status="Shortage" className="gap-1">
                                <AlertCircle className="w-3 h-3" /> Shortage
                              </StatusBadge>
                            ) : (
                              <StatusBadge status="In Stock" className="gap-1">
                                <CheckCircle className="w-3 h-3" /> In Stock
                              </StatusBadge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-divider px-6 py-4.5 bg-muted/10">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={requestClose}
                className="rounded-control border border-divider bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Close
              </button>
              {request.status === "Pending Approval" && onReject && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onReject(request);
                  }}
                  className="rounded-control border border-divider bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Reject Request
                </button>
              )}
              {request.status === "Pending Approval" && onApprove && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onApprove(request);
                  }}
                  className="rounded-control bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
                >
                  Approve Request
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={requestClose}
                className="rounded-control border border-divider bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Close
              </button>

              {!isFullyScheduledOrDispatched &&
                (request.status === "Pending Approval" || request.status === "Approved") &&
                (isImsManager || !isAdmin) &&
                onCancel && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCancel(request);
                    }}
                    className="rounded-control border border-divider bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    Cancel Request
                  </button>
                )}

              {hasScheduledTransfer && onDispatch && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDispatch(request);
                  }}
                  className="rounded-control bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
                >
                  Dispatch Transfer
                </button>
              )}

              {!isFullyScheduledOrDispatched && request.status === "Approved" && onSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSchedule(request);
                  }}
                  className="rounded-control bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
                >
                  Schedule Transfer
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Full Image Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="font-sans fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface text-text-primary rounded-panel max-w-2xl w-full border border-divider p-4 space-y-3 shadow-2xl animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-divider pb-2">
              <h5 className="type-caption font-semibold text-text-primary uppercase truncate pr-4">{previewImage.title}</h5>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="h-7 px-3 text-xs rounded-lg border border-divider bg-surface text-text-primary hover:bg-surface-hover font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex items-center justify-center bg-muted/20 rounded-control p-2 max-h-[70vh] overflow-auto">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[65vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
