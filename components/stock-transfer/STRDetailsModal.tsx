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
      className="font-sans fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 sm:p-6 animate-in fade-in duration-150"
    >
      {confirmModal}
      <div
        style={{ width: "100%", maxWidth: "1000px" }}
        className="w-full max-h-[92vh] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-foreground">
              Stock Transfer Request Details
            </h2>
            <StatusBadge status={hasScheduledTransfer && request.status === "Approved" ? "Scheduled" : request.status} />
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Review Status Banner (Approved / Reviewed / Rejected) */}
          {request.reviewedBy ? (
            <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-1">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">
                    {request.status === "Approved" ? "Approved by" : "Reviewed by"}:
                  </span>
                  <span className="text-foreground font-semibold">
                    {resolveStaffName(request.reviewedBy) || request.reviewedBy}
                  </span>
                  {request.reviewedAt && (
                    <span className="text-muted-foreground">
                      on {new Date(request.reviewedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <StatusBadge status={request.status} />
              </div>
              {request.adminNotes && (
                <p className="text-xs text-muted-foreground pt-1 italic">
                  "{request.adminNotes}"
                </p>
              )}
            </div>
          ) : (request.status === "Cancelled" || request.status === "Rejected") ? (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-1.5 text-destructive">
              <div className="flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{request.status === "Cancelled" ? "Cancellation Reason:" : "Rejection Reason:"}</span>
              </div>
              <p className="text-xs pl-6 text-muted-foreground italic">
                {request.adminNotes || "No rejection or cancellation reason recorded."}
              </p>
            </div>
          ) : null}

          {/* Structured Read-only Form matching PR & PO Details Modals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border">
            {/* Request Number */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Request Number
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground select-all font-mono font-medium">
                {request.requestNumber}
              </div>
            </div>

            {/* Destination Branch */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Destination Branch
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground font-semibold">
                <MapPin className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
                <span className="truncate">{request.toLocationName}</span>
              </div>
            </div>

            {/* Requested By (Actual Full Name) */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Requested By
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground font-semibold">
                <User className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
                <span>{resolveStaffName(request.requestedBy) || request.requestedBy}</span>
              </div>
            </div>

            {/* Request Date */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Request Date
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
                <span>{new Date(request.requestDate).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Required Date */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Required Date
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
                <span>{new Date(request.requiredDate).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Priority
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground font-semibold">
                <span className="px-2 py-0.5 rounded-md bg-card text-[11px] font-bold border border-border">
                  {request.priority}
                </span>
              </div>
            </div>

            {/* Reason / Purpose (Full Width) */}
            <div className="col-span-full">
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Reason / Purpose
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground font-medium">
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
              <div className="p-5 rounded-2xl bg-muted/20 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-foreground" />
                    <h3 className="text-sm font-bold text-foreground">
                      Scheduled Transportation & Driver Details
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
                    {scheduledTransfer?.status.toUpperCase() || "SCHEDULED"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transport Provider</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{schedMeta.transportProvider || scheduledTransfer?.courierName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle Type & Plate</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {schedMeta.vehicleType ? `${schedMeta.vehicleType} • ` : ""}
                      {schedMeta.plateNumber || scheduledTransfer?.vehiclePlate || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Driver Name</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{schedMeta.driverName || scheduledTransfer?.driverName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Driver Contact</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{schedMeta.driverContact || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Booking Reference / Fee</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {schedMeta.bookingReference ? `Ref: ${schedMeta.bookingReference}` : ""}
                      {schedMeta.transferFee ? ` (₱${Number(schedMeta.transferFee).toLocaleString()})` : (!schedMeta.bookingReference ? "—" : "")}
                    </p>
                  </div>
                </div>
                {schedMeta.remarks && (
                  <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
                    <strong className="text-foreground">Logistics Instructions:</strong> {schedMeta.remarks}
                  </div>
                )}

                {/* Document Proofs & Attachments */}
                {(bookingProofSrc || dispatchProofSrc) && (
                  <div className="pt-3 border-t border-border/60 space-y-2.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
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
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                Requested Finished Products ({request.items?.length || 0})
              </h3>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
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
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-4 font-bold text-foreground">
                            {item.productName}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                            {item.sku || "—"}
                          </td>
                          <td className="px-5 py-4 text-foreground font-medium whitespace-nowrap">
                            {item.variant || "Standard"}
                          </td>
                          <td className="px-5 py-4 text-right font-extrabold text-foreground text-sm">
                            {item.requestedQuantity}
                          </td>
                          <td className="px-5 py-4 text-right font-medium text-foreground">
                            {item.availableQuantity}
                          </td>
                          <td className="px-5 py-4">
                            {item.suggestedLots && item.suggestedLots.length > 0 ? (
                              <div className="space-y-1.5 py-0.5">
                                {item.suggestedLots.map((sl, slIdx) => (
                                  <div key={slIdx} className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-foreground text-xs">
                                        {sl.expiryDate
                                          ? new Date(sl.expiryDate).toLocaleDateString()
                                          : "No Expiry"}
                                      </span>
                                    </div>
                                    {sl.lotCode && (
                                      <div className="text-[10px] text-muted-foreground font-mono">
                                        Lot: {sl.lotCode.replace(/^FG-/i, "")}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
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
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4.5 bg-muted/10">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={requestClose}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
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
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
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
                  className="rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:bg-foreground/85 transition-colors shadow-sm cursor-pointer"
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
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
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
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
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
                  className="rounded-xl bg-foreground text-background px-6 py-2.5 text-sm font-semibold hover:bg-foreground/85 transition-colors shadow-sm cursor-pointer"
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
                  className="rounded-xl bg-foreground text-background px-6 py-2.5 text-sm font-semibold hover:bg-foreground/85 transition-colors shadow-sm cursor-pointer"
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
            className="bg-card text-foreground rounded-2xl max-w-2xl w-full border border-border p-4 space-y-3 shadow-2xl animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h5 className="text-xs font-bold text-foreground uppercase truncate pr-4">{previewImage.title}</h5>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="h-7 px-3 text-xs rounded-lg border border-border bg-card text-foreground hover:bg-muted font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex items-center justify-center bg-muted/20 rounded-xl p-2 max-h-[70vh] overflow-auto">
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
