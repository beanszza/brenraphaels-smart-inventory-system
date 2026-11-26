"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransferRequest } from "./types";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { Button } from "@/components/ui/button";
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

function formatDateDisplay(raw?: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
  const [previewImage, setPreviewImage] = useState<{ title: string; src: string } | null>(null);

  if (!open || !request) return null;

  const hasScheduledTransfer = request.transfers?.some((t) => t.status === "Scheduled") ?? false;
  const isFullyScheduledOrDispatched =
    request.status === "Scheduled" || request.status === "Dispatched" || hasScheduledTransfer;
  const displayStatus = hasScheduledTransfer && request.status === "Approved" ? "Scheduled" : request.status;
  const requesterName = resolveStaffName(request.requestedBy) || request.requestedBy;

  const showLogistics = Boolean(
    (request.status === "Scheduled" ||
      request.status === "Dispatched" ||
      request.status === "Completed" ||
      hasScheduledTransfer) &&
      request.transfers &&
      request.transfers.length > 0
  );

  let scheduledTransfer = null;
  let schedMeta: Record<string, any> = {};
  let dispatchMeta: Record<string, any> = {};
  if (showLogistics) {
    scheduledTransfer =
      request.transfers?.find(
        (t) => t.status === "Completed" || t.status === "Dispatched" || t.status === "Scheduled"
      ) || request.transfers?.[0];
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
          // ignore non-json note parts
        }
      }
    }
  }

  const bookingProofSrc = scheduledTransfer?.proofOfReceipt || schedMeta.attachmentData || "";
  const dispatchProofSrc = dispatchMeta.proofDataUrl || "";
  const isNegativeStatus = request.status === "Cancelled" || request.status === "Rejected";

  return (
    <>
      <ModalWrapper
        open={open}
        title={request.requestNumber}
        titleBadge={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={displayStatus} />
            {request.branchRequestNumber && (
              <span className="px-2.5 py-0.5 rounded-pill bg-status-purple-bg text-primary type-caption font-medium">
                POS: {request.branchRequestNumber}
              </span>
            )}
          </div>
        }
        subtitle={`To ${request.toLocationName} · requested by ${requesterName} · ${formatDateDisplay(request.requestDate)}`}
        onClose={onClose}
        confirmOnClose={false}
        maxWidthPx={960}
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-ink">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Review / Approval / Rejection Status Banner */}
            {request.reviewedBy ? (
              <div
                className={`rounded-inner px-3.5 py-2.5 flex items-start gap-2.5 type-body-secondary ${
                  isNegativeStatus
                    ? "bg-notice-danger-bg border border-notice-danger-border text-notice-danger-text"
                    : "bg-status-green-bg text-status-green-fg"
                }`}
              >
                {isNegativeStatus ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <span>
                    {request.status === "Rejected"
                      ? "Rejected by"
                      : request.status === "Approved" || request.status === "Scheduled" || request.status === "Dispatched" || request.status === "Completed"
                      ? "Approved by"
                      : "Reviewed by"}{" "}
                    <span className="font-medium">
                      {resolveStaffName(request.reviewedBy) || request.reviewedBy}
                    </span>
                    {request.reviewedAt ? ` on ${formatDateDisplay(request.reviewedAt)}` : ""}
                  </span>
                  {request.adminNotes && (
                    <span className="ml-1.5">— &ldquo;{request.adminNotes}&rdquo;</span>
                  )}
                </div>
              </div>
            ) : isNegativeStatus ? (
              <div className="rounded-inner border border-notice-danger-border bg-notice-danger-bg px-3.5 py-2.5 flex items-start gap-2.5 type-body-secondary text-notice-danger-text">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">
                    {request.status === "Cancelled" ? "Cancellation reason:" : "Rejection reason:"}
                  </span>{" "}
                  <span>{request.adminNotes || "No rejection or cancellation reason recorded."}</span>
                </div>
              </div>
            ) : null}

            {/* Section 1: Request details (clean 2-column typographic card) */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
              <h3 className="type-subsection text-ink">Request details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <div className="space-y-0.5">
                  <span className="block type-caption font-medium text-ink-muted">Destination branch</span>
                  <p className="type-body font-medium text-ink">{request.toLocationName}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="block type-caption font-medium text-ink-muted">Requested by</span>
                  <p className="type-body font-medium text-ink">{requesterName}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="block type-caption font-medium text-ink-muted">Request date · Required date</span>
                  <p className="type-body font-medium text-ink">
                    {formatDateDisplay(request.requestDate)} · {formatDateDisplay(request.requiredDate)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="block type-caption font-medium text-ink-muted">Priority · Reason</span>
                  <p className="type-body font-medium text-ink">
                    {request.priority || "Medium"} · {request.reason || "Branch Replenishment"}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Transportation & driver details + proofs */}
            {showLogistics && scheduledTransfer && (
              <div className="rounded-card border border-border bg-surface p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="type-subsection text-ink">Transportation &amp; driver details</h3>
                    <p className="type-caption text-ink-muted">
                      Scheduled courier, driver, and uploaded proof attachments.
                    </p>
                  </div>
                  <StatusBadge status={scheduledTransfer.status || "Scheduled"} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  <div className="space-y-0.5">
                    <span className="block type-caption font-medium text-ink-muted">Transport provider</span>
                    <p className="type-body font-medium text-ink">
                      {schedMeta.transportProvider || scheduledTransfer.courierName || "—"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block type-caption font-medium text-ink-muted">Vehicle type &amp; plate</span>
                    <p className="type-body font-medium text-ink">
                      {schedMeta.vehicleType ? `${schedMeta.vehicleType} · ` : ""}
                      {schedMeta.plateNumber || scheduledTransfer.vehiclePlate || "—"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block type-caption font-medium text-ink-muted">Driver &amp; contact</span>
                    <p className="type-body font-medium text-ink">
                      {schedMeta.driverName || scheduledTransfer.driverName || "—"}
                      {schedMeta.driverContact ? ` · ${schedMeta.driverContact}` : ""}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block type-caption font-medium text-ink-muted">Booking ref &amp; fee</span>
                    <p className="type-body font-medium text-ink">
                      {schedMeta.bookingReference && schedMeta.transferFee
                        ? `${schedMeta.bookingReference} · ₱${Number(schedMeta.transferFee).toLocaleString()}`
                        : schedMeta.bookingReference
                        ? schedMeta.bookingReference
                        : schedMeta.transferFee
                        ? `₱${Number(schedMeta.transferFee).toLocaleString()}`
                        : "—"}
                    </p>
                  </div>
                </div>

                {schedMeta.remarks && (
                  <p className="type-body-secondary text-ink-secondary pt-2 border-t border-divider">
                    <span className="font-medium text-ink">Logistics instructions:</span> {schedMeta.remarks}
                  </p>
                )}

                {(bookingProofSrc || dispatchProofSrc) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {bookingProofSrc && (
                      <TransferProofThumbnail
                        rawSrc={bookingProofSrc}
                        title="Booking receipt"
                        subtitle={schedMeta.attachmentName || "Uploaded when scheduling transfer"}
                        onPreview={setPreviewImage}
                        size="small"
                      />
                    )}
                    {dispatchProofSrc && (
                      <TransferProofThumbnail
                        rawSrc={dispatchProofSrc}
                        title="Dispatch proof"
                        subtitle={dispatchMeta.proofFileName || "Uploaded upon transfer departure"}
                        onPreview={setPreviewImage}
                        size="small"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Requested finished products (separate Lot & Expiry columns) */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
              <div className="space-y-0.5">
                <h3 className="type-subsection text-ink">
                  Requested finished products ({request.items?.length || 0})
                </h3>
                <p className="type-caption text-ink-muted">
                  Assigned FEFO lots and commissary stock status.
                </p>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="border-b border-divider">
                    <tr className="whitespace-nowrap">
                      <th className="pb-2.5 pr-3 type-caption font-medium text-ink-muted min-w-[175px]">Product</th>
                      <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[100px]">SKU</th>
                      <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[90px]">Variant</th>
                      <th className="pb-2.5 px-2.5 text-right type-caption font-medium text-ink-muted min-w-[68px]">Req. qty</th>
                      <th className="pb-2.5 px-2.5 text-right type-caption font-medium text-ink-muted min-w-[85px]">Commissary</th>
                      <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[95px]">Lot</th>
                      <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[105px]">Expiry date</th>
                      <th className="pb-2.5 pl-2.5 type-caption font-medium text-ink-muted min-w-[88px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {request.items?.map((item, idx) => (
                      <tr key={idx} className="align-middle">
                        <td className="py-2.5 pr-3 type-body font-medium text-ink">
                          {item.productName}
                        </td>
                        <td className="py-2.5 px-2.5 type-body-secondary text-ink-secondary whitespace-nowrap">
                          {item.sku || "—"}
                        </td>
                        <td className="py-2.5 px-2.5 type-body text-ink-secondary whitespace-nowrap">
                          {item.variant || "Standard"}
                        </td>
                        <td className="py-2.5 px-2.5 text-right type-body font-medium text-ink tabular-nums whitespace-nowrap">
                          {item.requestedQuantity}
                        </td>
                        <td className="py-2.5 px-2.5 text-right type-body text-ink tabular-nums whitespace-nowrap">
                          {item.availableQuantity}
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          {item.suggestedLots && item.suggestedLots.length > 0 ? (
                            <div className="space-y-1">
                              {item.suggestedLots.map((sl, slIdx) => (
                                <div key={slIdx} className="type-body-secondary text-ink-secondary">
                                  {sl.lotCode ? sl.lotCode.replace(/^FG-/i, "") : "—"}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="type-body-secondary text-ink-muted">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          {item.suggestedLots && item.suggestedLots.length > 0 ? (
                            <div className="space-y-1">
                              {item.suggestedLots.map((sl, slIdx) => (
                                <div key={slIdx} className="type-body text-ink">
                                  {sl.expiryDate ? formatDateDisplay(sl.expiryDate) : "No expiry"}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="type-body-secondary text-ink-muted">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-2.5 whitespace-nowrap">
                          {item.isInsufficient ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-status-red-bg text-status-red-fg type-caption font-medium">
                              Shortage
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-status-green-bg text-status-green-fg type-caption font-medium">
                              In stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pinned #fafafa Footer Bar */}
          <div className="shrink-0 bg-page border-t border-topbar px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <p className="type-caption text-ink-muted">
              Read-only transfer details · actions reflect your role and request status.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none transition-colors cursor-pointer"
              >
                Close
              </Button>

              {isAdmin ? (
                <>
                  {request.status === "Pending Approval" && onReject && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onClose();
                        onReject(request);
                      }}
                      className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none transition-colors cursor-pointer"
                    >
                      Reject request
                    </Button>
                  )}
                  {request.status === "Pending Approval" && onApprove && (
                    <Button
                      type="button"
                      onClick={() => {
                        onClose();
                        onApprove(request);
                      }}
                      className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none transition-colors cursor-pointer"
                    >
                      Approve request
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {!isFullyScheduledOrDispatched &&
                    (request.status === "Pending Approval" || request.status === "Approved") &&
                    (isImsManager || !isAdmin) &&
                    onCancel && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          onClose();
                          onCancel(request);
                        }}
                        className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none transition-colors cursor-pointer"
                      >
                        Cancel request
                      </Button>
                    )}

                  {hasScheduledTransfer && onDispatch && (
                    <Button
                      type="button"
                      onClick={() => {
                        onClose();
                        onDispatch(request);
                      }}
                      className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none transition-colors cursor-pointer"
                    >
                      Dispatch transfer
                    </Button>
                  )}

                  {!isFullyScheduledOrDispatched && request.status === "Approved" && onSchedule && (
                    <Button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSchedule(request);
                      }}
                      className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none transition-colors cursor-pointer"
                    >
                      Schedule transfer
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </ModalWrapper>

      {/* Full Image Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="font-sans fixed inset-0 z-[300] bg-scrim flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface text-ink rounded-modal max-w-2xl w-full border border-border p-4 space-y-3 shadow-modal animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-topbar pb-2.5">
              <h5 className="type-subsection text-ink truncate pr-4">{previewImage.title}</h5>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewImage(null)}
                className="h-8 px-3 rounded-control border-border bg-surface type-label-button-sm text-ink hover:bg-subtle shadow-none cursor-pointer"
              >
                Close
              </Button>
            </div>
            <div className="flex items-center justify-center bg-page rounded-control p-2 max-h-[70vh] overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[65vh] max-w-full object-contain rounded-control"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
