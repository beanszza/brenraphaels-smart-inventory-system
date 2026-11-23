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

  const footerHelperText = isCancelled
    ? "This delivery order has been cancelled."
    : isScheduled
      ? "Step 1 of 2 · Review delivery before confirming arrival."
      : isArrived && !delivery.grnNumber
        ? "Delivery arrived · Create a Goods Receipt Note to complete receiving."
        : "Delivery received and recorded with GRN.";

  return (
    <ModalWrapper
      open={!!delivery}
      title="Delivery order details"
      titleBadge={<StatusBadge status={delivery.status} />}
      subtitle={`${delivery.deliveryNumber} · ${delivery.poNumber || "—"} · ${delivery.supplierName || "—"}`}
      onClose={onClose}
      maxWidthPx={700}
      bodyClassName="min-h-0 w-full min-w-0 flex-1 flex flex-col overflow-hidden p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Scrollable Body — Clean white surface matching Figma 67-4269 & 92-20 */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface px-6 py-5 space-y-4">
          {/* Progress Stepper Card */}
          {!isCancelled && (
            <div className="rounded-card border border-border bg-surface px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                {steps.map((s, i) => {
                  const isActive = i <= currentStepIdx;
                  const isLast = i === currentStepIdx;
                  return (
                    <React.Fragment key={s}>
                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          className={`size-6.5 rounded-pill flex items-center justify-center type-caption font-semibold transition-colors ${
                            isActive
                              ? "bg-primary text-on-brand"
                              : "bg-page border border-border text-ink-muted"
                          }`}
                        >
                          {isActive && !isLast ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <span
                          className={`type-body-secondary ${
                            isActive ? "font-semibold text-ink" : "font-medium text-ink-muted"
                          }`}
                        >
                          {s}
                        </span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className="h-0.5 flex-1 rounded-pill bg-divider overflow-hidden">
                          <div
                            className={`h-full bg-primary transition-all duration-300 ${
                              i < currentStepIdx ? "w-full" : "w-0"
                            }`}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cancellation Notice */}
          {isCancelled && delivery.notes && (
            <div className="p-3.5 rounded-inner border border-notice-danger-border bg-notice-danger-bg text-notice-danger-text type-caption flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
              <div>
                <span className="font-semibold block">Order Cancelled</span>
                <span className="text-ink type-caption">{delivery.notes}</span>
              </div>
            </div>
          )}

          {/* Delivery Summary Card (67-5207 flat lavender-bordered metadata card) */}
          <div className="rounded-card border border-border bg-surface px-4.5 py-4 space-y-3">
            <h4 className="type-card-title text-ink">Delivery summary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div>
                <span className="text-ink-muted block type-caption mb-0.5">Purchase order</span>
                <span className="font-medium text-ink type-body-secondary block">
                  {delivery.poNumber || "—"}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block type-caption mb-0.5">Supplier</span>
                <span className="font-medium text-ink type-body-secondary truncate block">
                  {delivery.supplierName || "—"}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block type-caption mb-0.5">Payment terms</span>
                <span className="font-medium text-ink type-body-secondary block">
                  {delivery.paymentType || "Payable"}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block type-caption mb-0.5">Destination</span>
                <span className="font-medium text-ink type-body-secondary block">
                  {delivery.receivingLocationName || "Commissary (Receiving Bay)"}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block type-caption mb-0.5">Planned dispatch</span>
                <span className="font-medium text-ink type-body-secondary block">
                  {fmtDate(delivery.scheduledDate)}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block type-caption mb-0.5">Actual arrival</span>
                <span className="font-medium text-ink type-body-secondary block">
                  {fmtDate(delivery.actualArrivalDate)}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block type-caption mb-0.5">Received by</span>
                <span className="font-medium text-ink type-body-secondary block">
                  {delivery.receivedBy || (isArrived ? "Vince Neil Madeja" : "Pending Arrival")}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block type-caption mb-0.5">GRN</span>
                <span className="font-medium text-ink type-body-secondary block">
                  {delivery.grnNumber || (isArrived ? "Ready for GRN" : "—")}
                </span>
              </div>
            </div>
          </div>

          {/* Shipment Items Card (67-5207 unshaded sentence-case table card) */}
          <div className="rounded-card border border-border bg-surface px-4.5 pt-4 pb-2.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="type-card-title text-ink">
                Shipment items ({delivery.items?.length || 0})
              </h4>
              <span className="type-caption font-medium text-ink-muted tabular-nums">
                Total shipment qty:{" "}
                {delivery.items?.reduce((sum, it) => sum + (Number(it.declaredQuantity) || 0), 0) || 0}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full type-table-cell text-left border-collapse">
                <thead>
                  <tr className="border-b border-divider text-ink-muted type-table-header">
                    <th className="py-2 pr-3 font-medium">Item description</th>
                    <th className="py-2 px-3 font-medium">Supply no.</th>
                    <th className="py-2 px-3 font-medium">UOM</th>
                    <th className="py-2 px-3 text-right font-medium">PO qty</th>
                    <th className="py-2 pl-3 text-right font-medium">Shipment qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {(delivery.items || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-page/60 transition-colors">
                      <td className="py-2.5 pr-3 font-medium text-ink">
                        {item.itemName}
                      </td>
                      <td className="py-2.5 px-3 type-caption text-ink-muted">
                        {item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`}
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted">{item.purchaseUomName}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted">
                        {item.poOrderedQuantity || item.declaredQuantity}
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums font-semibold text-ink">
                        {item.declaredQuantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Document Proofs & Attachments Card */}
          {(displayReceiptSrc || displayArrivalSrc) && (
            <div className="rounded-card border border-border bg-surface px-4.5 py-4 space-y-3">
              <h4 className="type-card-title text-ink">Document proofs &amp; attachments</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayReceiptSrc && (
                  <div className="rounded-inner border border-border bg-page p-3 flex items-center gap-3">
                    <div className="size-11 rounded-control border border-border bg-surface overflow-hidden flex items-center justify-center shrink-0">
                      {displayReceiptSrc.startsWith("data:image/") ||
                      displayReceiptSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                      displayReceiptSrc.includes("/files/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={displayReceiptSrc}
                          alt="Receipt Proof"
                          onClick={() => setPreviewImage({ title: "Receipt Proof", src: displayReceiptSrc })}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-ink-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="type-body-secondary font-medium text-ink truncate">
                        Schedule / Receipt Proof
                      </p>
                      <p className="type-caption text-ink-muted">
                        Uploaded when scheduling delivery
                      </p>
                      {(displayReceiptSrc.startsWith("data:image/") ||
                        displayReceiptSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                        displayReceiptSrc.includes("/files/")) && (
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ title: "Receipt Proof", src: displayReceiptSrc })}
                          className="type-caption font-medium text-primary hover:underline inline-flex items-center gap-1 cursor-pointer pt-0.5"
                        >
                          <span>View full image</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {displayArrivalSrc && (
                  <div className="rounded-inner border border-border bg-page p-3 flex items-center gap-3">
                    <div className="size-11 rounded-control border border-border bg-surface overflow-hidden flex items-center justify-center shrink-0">
                      {displayArrivalSrc.startsWith("data:image/") ||
                      displayArrivalSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                      displayArrivalSrc.includes("/files/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={displayArrivalSrc}
                          alt="Arrival Proof"
                          onClick={() => setPreviewImage({ title: "Arrival Proof", src: displayArrivalSrc })}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-ink-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="type-body-secondary font-medium text-ink truncate">
                        Arrival Proof Photo
                      </p>
                      <p className="type-caption text-ink-muted">
                        Uploaded upon delivery arrival
                      </p>
                      {(displayArrivalSrc.startsWith("data:image/") ||
                        displayArrivalSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                        displayArrivalSrc.includes("/files/")) && (
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ title: "Arrival Proof", src: displayArrivalSrc })}
                          className="type-caption font-medium text-primary hover:underline inline-flex items-center gap-1 cursor-pointer pt-0.5"
                        >
                          <span>View full image</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Full Image Lightbox Modal when user clicks "View full image" */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="font-sans fixed inset-0 z-50 bg-scrim flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-surface border border-border rounded-modal overflow-hidden max-w-2xl w-full shadow-modal"
            >
              <div className="flex items-center justify-between border-b border-topbar px-5 py-3.5">
                <h5 className="type-subsection text-ink">{previewImage.title}</h5>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewImage(null)}
                  className="h-8 px-3 type-caption rounded-control cursor-pointer border-border bg-surface text-ink hover:bg-subtle"
                >
                  Close Preview
                </Button>
              </div>
              <div className="flex items-center justify-center bg-page p-4 max-h-[70vh] overflow-auto">
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

        {/* Full-Bleed Tinted Footer Bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-topbar bg-page px-6 py-3.5">
          <span className="type-caption text-ink-muted">{footerHelperText}</span>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(isArrived || Boolean(delivery.grnNumber)) && (
              <Button
                type="button"
                variant="outline"
                disabled={downloadingReport}
                onClick={handleDownloadReport}
                className="h-9.5 rounded-control border border-border bg-surface px-3.5 type-label-button-sm text-ink hover:bg-subtle transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
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
                className="h-9.5 rounded-control border border-border bg-surface text-destructive hover:bg-notice-danger-bg px-3.5 type-label-button-sm transition-colors cursor-pointer"
              >
                Cancel Delivery
              </Button>
            )}

            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              className="h-9.5 rounded-control border border-border bg-surface px-3.5 type-label-button-sm text-ink hover:bg-subtle transition-colors cursor-pointer"
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
                className="h-9.5 rounded-control bg-primary text-on-brand px-4 type-label-button-sm hover:bg-primary-hover transition-colors cursor-pointer"
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
                className="h-9.5 rounded-control bg-primary text-on-brand px-4 type-label-button-sm hover:bg-primary-hover transition-colors cursor-pointer"
              >
                Create Goods Receipt Note
              </Button>
            )}
          </div>
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
