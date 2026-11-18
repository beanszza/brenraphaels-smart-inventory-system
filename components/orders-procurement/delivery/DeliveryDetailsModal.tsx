"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, Check, FileText, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { Delivery } from "../types";
import CreateGrnModal from "@/components/receiving/CreateGrnModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { downloadDeliveryReportPdf } from "./downloadDeliveryReportPdf";
import { isFileId } from "@/lib/files";
import { resolveDeliveryAttachment } from "@/app/actions/orders/delivery-files";

interface DeliveryDetailsModalProps {
  delivery: Delivery | null;
  isAdmin?: boolean;
  onClose: () => void;
  onArrive?: (delivery: Delivery) => void;
  onCancel?: (delivery: Delivery) => void;
  onGrnCreated?: () => void;
}

export function DeliveryDetailsModal({
  delivery,
  isAdmin = false,
  onClose,
  onArrive,
  onCancel,
  onGrnCreated,
}: DeliveryDetailsModalProps) {
  const [showCreateGrnModal, setShowCreateGrnModal] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ title: string; src: string } | null>(null);

  if (!delivery) return null;

  const fmtDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const isScheduled = delivery.status === "Scheduled";
  const isArrived = delivery.status === "Arrived";
  const isCancelled = delivery.status === "Cancelled";
  const isCancellable = isScheduled;

  const steps = ["Scheduled", "Arrived", "Received (GRN)"];
  const currentStepIdx = isCancelled ? -1 : delivery.grnNumber ? 2 : isArrived ? 1 : 0;

  const receiptProofSrc = delivery.scheduledAttachment || delivery.attachmentUrl || "";
  const arrivalProofSrc = delivery.arrivalAttachment || "";

  const [resolvedReceiptUrl, setResolvedReceiptUrl] = useState<string>("");
  const [resolvedArrivalUrl, setResolvedArrivalUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    if (receiptProofSrc) {
      if (receiptProofSrc.startsWith("data:") || receiptProofSrc.startsWith("http")) {
        setResolvedReceiptUrl(receiptProofSrc);
      } else if (isFileId(receiptProofSrc)) {
        resolveDeliveryAttachment(receiptProofSrc)
          .then((res) => {
            if (active && res.data?.url) setResolvedReceiptUrl(res.data.url);
          })
          .catch(() => {});
      }
    } else {
      setResolvedReceiptUrl("");
    }

    if (arrivalProofSrc) {
      if (arrivalProofSrc.startsWith("data:") || arrivalProofSrc.startsWith("http")) {
        setResolvedArrivalUrl(arrivalProofSrc);
      } else if (isFileId(arrivalProofSrc)) {
        resolveDeliveryAttachment(arrivalProofSrc)
          .then((res) => {
            if (active && res.data?.url) setResolvedArrivalUrl(res.data.url);
          })
          .catch(() => {});
      }
    } else {
      setResolvedArrivalUrl("");
    }

    return () => {
      active = false;
    };
  }, [receiptProofSrc, arrivalProofSrc]);

  const displayReceiptSrc = resolvedReceiptUrl || receiptProofSrc;
  const displayArrivalSrc = resolvedArrivalUrl || arrivalProofSrc;

  const handleDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      await downloadDeliveryReportPdf(delivery);
    } finally {
      setDownloadingReport(false);
    }
  };

  return (
    <ModalWrapper
      open={!!delivery}
      title={`Delivery Order Details — ${delivery.deliveryNumber}`}
      onClose={onClose}
      size="max-w-[640px]"
    >
      <div className="space-y-4">
        {/* Compact Top Bar: Status, PO Reference, and Stepper */}
        <div className="rounded-card border border-divider bg-surface p-4 space-y-3.5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-divider">
            <StatusBadge status={delivery.status} />
            <div className="type-caption text-text-muted">
              Purchase Order Reference:{" "}
              <span className="font-bold text-text-primary type-body">
                {delivery.poNumber || "—"}
              </span>
            </div>
          </div>

          {!isCancelled && (
            <div className="px-2 pt-1">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-3.5 -translate-y-1/2 w-full h-1 bg-surface-muted rounded-pill overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-in-out"
                    style={{ width: `${(currentStepIdx / (steps.length - 1)) * 100}%` }}
                  />
                </div>
                {steps.map((s, i) => {
                  const isActive = i <= currentStepIdx;
                  const isLast = i === currentStepIdx;
                  return (
                    <div key={s} className="relative flex flex-col items-center gap-1.5 bg-surface px-2">
                      <div
                        className={`w-7 h-7 rounded-pill flex items-center justify-center border-2 type-caption font-bold transition-all duration-300 z-10 ${
                          isActive
                            ? "bg-primary border-primary text-text-inverse shadow-xs"
                            : "bg-surface border-divider text-text-muted"
                        }`}
                      >
                        {isActive && !isLast ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span
                        className={`type-caption uppercase tracking-wider font-bold ${
                          isActive ? "text-text-primary" : "text-text-muted"
                        }`}
                      >
                        {s}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cancellation Notice */}
        {isCancelled && delivery.notes && (
          <div className="p-3.5 rounded-card border border-status-red bg-status-red-bg text-status-red type-caption flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Order Cancelled</span>
              <span className="text-text-primary type-caption">{delivery.notes}</span>
            </div>
          </div>
        )}

        {/* Delivery Summary Card (2x4 organized grid) */}
        <div className="rounded-card border border-divider bg-surface-muted p-4 space-y-3">
          <h4 className="type-table-header font-bold text-text-primary uppercase tracking-wider">
            Delivery Summary
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 type-caption">
            <div>
              <span className="text-text-muted block type-caption mb-0.5">Purchase Order</span>
              <span className="font-bold text-text-primary type-body">{delivery.poNumber || "—"}</span>
            </div>
            <div>
              <span className="text-text-muted block type-caption mb-0.5">Supplier</span>
              <span className="font-semibold text-text-primary type-body truncate block">
                {delivery.supplierName || "—"}
              </span>
            </div>
            <div>
              <span className="text-text-muted block type-caption mb-0.5">Payment Terms</span>
              <span className="font-medium text-text-primary type-body">{delivery.paymentType || "Payable"}</span>
            </div>
            <div>
              <span className="text-text-muted block type-caption mb-0.5">Destination</span>
              <span className="font-medium text-text-primary type-body">
                {delivery.receivingLocationName || "Commissary (Receiving Bay)"}
              </span>
            </div>
            <div>
              <span className="text-text-muted block type-caption mb-0.5">Planned Dispatch Date</span>
              <span className="font-medium text-text-primary type-body">{fmtDate(delivery.scheduledDate)}</span>
            </div>
            <div>
              <span className="text-text-muted block type-caption mb-0.5">Actual Arrival Date</span>
              <span className="font-medium text-text-primary type-body">{fmtDate(delivery.actualArrivalDate)}</span>
            </div>
            <div>
              <span className="text-text-muted block type-caption mb-0.5">Received By</span>
              <span className="font-semibold text-text-primary type-body">
                {delivery.receivedBy || (isArrived ? "Vince Neil Madeja" : "Pending Arrival")}
              </span>
            </div>
            <div>
              <span className="text-text-muted block type-caption mb-0.5">Goods Receipt Note</span>
              <span className="font-semibold text-text-primary type-body">
                {delivery.grnNumber || (isArrived ? "Ready for GRN" : "—")}
              </span>
            </div>
          </div>
        </div>

        {/* Shipment Items Table (Placed directly after Summary so it is immediately visible) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="type-table-header font-bold text-text-primary uppercase tracking-wider">
              Shipment Items ({delivery.items?.length || 0})
            </h4>
            <span className="type-caption font-semibold text-text-muted">
              Total Shipment Qty:{" "}
              {delivery.items?.reduce((sum, it) => sum + (Number(it.declaredQuantity) || 0), 0) || 0}
            </span>
          </div>

          <div className="overflow-x-auto rounded-card border border-divider bg-surface">
            <table className="w-full type-table-cell text-left">
              <thead>
                <tr className="border-b border-divider bg-surface-muted text-text-muted font-semibold type-table-header uppercase table-head-row">
                  <th className="table-th px-3.5 py-2.5">Item Description</th>
                  <th className="table-th px-3.5 py-2.5">Supply No</th>
                  <th className="table-th px-3.5 py-2.5">Unit of Measure</th>
                  <th className="table-th px-3.5 py-2.5 text-right">Purchase Order Qty</th>
                  <th className="table-th px-3.5 py-2.5 text-right">Shipment Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {(delivery.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-hover table-row">
                    <td className="table-td px-3.5 py-2.5 font-semibold text-text-primary">
                      {item.itemName}
                    </td>
                    <td className="table-td px-3.5 py-2.5 type-caption font-semibold text-text-muted">
                      {item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`}
                    </td>
                    <td className="table-td px-3.5 py-2.5 text-text-muted">{item.purchaseUomName}</td>
                    <td className="table-td px-3.5 py-2.5 text-right text-text-muted">
                      {item.poOrderedQuantity || item.declaredQuantity}
                    </td>
                    <td className="table-td px-3.5 py-2.5 text-right font-bold text-text-primary">
                      {item.declaredQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compact Side-by-Side Document Proofs & Attachments */}
        {(displayReceiptSrc || displayArrivalSrc) && (
          <div className="rounded-card border border-divider bg-surface p-4 space-y-2.5">
            <h4 className="type-table-header font-bold text-text-primary uppercase tracking-wider">
              Document Proofs &amp; Attachments
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {displayReceiptSrc && (
                <div className="rounded-control border border-divider bg-surface-muted p-3 flex items-center gap-3">
                  <div className="w-20 h-20 rounded-control border border-divider bg-surface overflow-hidden flex items-center justify-center shrink-0">
                    {displayReceiptSrc.startsWith("data:image/") ||
                    displayReceiptSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                    displayReceiptSrc.includes("/files/") ? (
                      <img
                        src={displayReceiptSrc}
                        alt="Receipt Proof"
                        onClick={() => setPreviewImage({ title: "Receipt Proof", src: displayReceiptSrc })}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    ) : (
                      <FileText className="w-6 h-6 text-text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="type-label font-semibold text-text-primary">Schedule / Receipt Proof</p>
                    <p className="type-caption text-text-muted">
                      Uploaded when scheduling delivery
                    </p>
                    {(displayReceiptSrc.startsWith("data:image/") ||
                      displayReceiptSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                      displayReceiptSrc.includes("/files/")) && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ title: "Receipt Proof", src: displayReceiptSrc })}
                        className="type-caption font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" /> View Full Image
                      </button>
                    )}
                  </div>
                </div>
              )}

              {displayArrivalSrc && (
                <div className="rounded-control border border-divider bg-surface-muted p-3 flex items-center gap-3">
                  <div className="w-20 h-20 rounded-control border border-divider bg-surface overflow-hidden flex items-center justify-center shrink-0">
                    {displayArrivalSrc.startsWith("data:image/") ||
                    displayArrivalSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                    displayArrivalSrc.includes("/files/") ? (
                      <img
                        src={displayArrivalSrc}
                        alt="Arrival Proof"
                        onClick={() => setPreviewImage({ title: "Arrival Proof", src: displayArrivalSrc })}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    ) : (
                      <FileText className="w-6 h-6 text-text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="type-label font-semibold text-text-primary">Arrival Proof Photo</p>
                    <p className="type-caption text-text-muted">
                      Uploaded upon delivery arrival
                    </p>
                    {(displayArrivalSrc.startsWith("data:image/") ||
                      displayArrivalSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                      displayArrivalSrc.includes("/files/")) && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ title: "Arrival Proof", src: displayArrivalSrc })}
                        className="type-caption font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" /> View Full Image
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full Image Lightbox Modal when user clicks "View Full Image" */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="font-sans fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-divider rounded-card p-4 max-w-2xl w-full space-y-3 shadow-modal"
            >
              <div className="flex items-center justify-between border-b border-divider pb-2">
                <h5 className="type-label font-bold text-text-primary uppercase">{previewImage.title}</h5>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewImage(null)}
                  className="h-7 px-3 type-caption rounded-control cursor-pointer border-divider bg-surface text-text-primary hover:bg-surface-hover"
                >
                  Close Preview
                </Button>
              </div>
              <div className="flex items-center justify-center bg-surface-muted rounded-control p-2 max-h-[70vh] overflow-auto">
                <img
                  src={previewImage.src}
                  alt={previewImage.title}
                  className="max-h-[65vh] max-w-full object-contain rounded-control"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 pb-1 border-t border-divider mt-4">
          {(isArrived || Boolean(delivery.grnNumber)) && (
            <Button
              type="button"
              variant="outline"
              disabled={downloadingReport}
              onClick={handleDownloadReport}
              className="rounded-control border border-divider bg-surface px-4 py-2.5 h-auto type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-primary" />
              {downloadingReport ? "Downloading..." : "Download Delivery Report"}
            </Button>
          )}

          {!isAdmin && isCancellable && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onCancel(delivery);
              }}
              className="rounded-control border border-status-red text-status-red hover:bg-status-red-bg px-5 py-2.5 h-auto type-label-button font-semibold transition-colors cursor-pointer"
            >
              Cancel Delivery
            </Button>
          )}

          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border border-divider bg-surface px-5 py-2.5 h-auto type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Close
          </ModalCloseButton>

          {!isAdmin && isScheduled && onArrive && (
            <Button
              type="button"
              onClick={() => {
                onClose();
                onArrive(delivery);
              }}
              className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 h-auto type-label-button font-semibold hover:bg-button-primary-hover transition-colors shadow-sm cursor-pointer"
            >
              Confirm Arrival
            </Button>
          )}

          {!isAdmin && isArrived && !delivery.grnNumber && (
            <Button
              type="button"
              onClick={() => {
                setShowCreateGrnModal(true);
              }}
              className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 h-auto type-label-button font-semibold hover:bg-button-primary-hover transition-colors shadow-sm cursor-pointer"
            >
              Create Goods Receipt Note
            </Button>
          )}
        </div>
      </div>

      {showCreateGrnModal && (
        <CreateGrnModal
          open={showCreateGrnModal}
          initialDeliveryId={delivery.deliveryId}
          onClose={() => setShowCreateGrnModal(false)}
          onSuccess={() => {
            setShowCreateGrnModal(false);
            onClose();
            onGrnCreated?.();
          }}
        />
      )}
    </ModalWrapper>
  );
}
