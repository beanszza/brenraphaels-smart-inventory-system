"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, Check, ChevronLeft, FileText, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { Delivery } from "../types";
import CreateGrnModal from "@/components/receiving/CreateGrnModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { downloadDeliveryReportPdf } from "./downloadDeliveryReportPdf";
import { isFileId } from "@/lib/files";
import { resolveDeliveryAttachment } from "@/app/actions/orders/delivery-files";

export interface DeliveryDetailsModalProps {
  delivery: Delivery | null;
  isAdmin?: boolean;
  poTotalAmount?: number | null;
  embedded?: boolean;
  onClose: () => void;
  onArrive?: (delivery: Delivery) => void;
  onCancel?: (delivery: Delivery) => void;
  onGrnCreated?: () => void;
}

interface DeliveryDetailsBodyProps extends DeliveryDetailsModalProps {
  variant: "page" | "modal";
}

function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return "—";
  return `₱${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function DeliveryDetailsBody({
  delivery,
  isAdmin = false,
  poTotalAmount,
  embedded = false,
  onClose,
  onArrive,
  onCancel,
  onGrnCreated,
  variant,
}: DeliveryDetailsBodyProps) {
  const [showCreateGrnModal, setShowCreateGrnModal] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ title: string; src: string } | null>(null);

  const receiptProofSrc = delivery?.scheduledAttachment || delivery?.attachmentUrl || "";
  const arrivalProofSrc = delivery?.arrivalAttachment || "";

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

  const steps = ["Scheduled", "Arrived", "Received (Goods Receipt Note)"];
  const currentStepIdx = isCancelled ? -1 : delivery.grnNumber ? 2 : isArrived ? 1 : 0;

  const displayReceiptSrc = resolvedReceiptUrl || receiptProofSrc;
  const displayArrivalSrc = resolvedArrivalUrl || arrivalProofSrc;

  const totalShipmentQty =
    delivery.items?.reduce((sum, it) => sum + (Number(it.declaredQuantity) || 0), 0) || 0;
  const itemCount = delivery.items?.length || 0;

  const handleDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      await downloadDeliveryReportPdf(delivery);
    } finally {
      setDownloadingReport(false);
    }
  };

  const renderActionButtons = (isModalMode: boolean) => (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {(isArrived || Boolean(delivery.grnNumber)) && (
        <Button
          type="button"
          variant="outline"
          disabled={downloadingReport}
          onClick={handleDownloadReport}
          className="h-9 rounded-control border border-border bg-surface px-3.5 type-label-button-sm text-ink hover:bg-subtle transition-colors inline-flex items-center gap-1.5 shadow-none cursor-pointer"
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
            if (isModalMode) onClose();
            onCancel(delivery);
          }}
          className="h-9 rounded-control border border-border bg-surface text-destructive hover:bg-notice-danger-bg px-3.5 type-label-button-sm transition-colors shadow-none cursor-pointer"
        >
          Cancel Delivery
        </Button>
      )}

      {isModalMode ? (
        <ModalCloseButton
          type="button"
          variant="outline"
          fallbackOnClose={onClose}
          className="h-9 rounded-control border border-border bg-surface px-3.5 type-label-button-sm text-ink hover:bg-subtle transition-colors shadow-none cursor-pointer"
        >
          Close
        </ModalCloseButton>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-9 rounded-control border border-border bg-surface px-3.5 type-label-button-sm text-ink hover:bg-subtle transition-colors shadow-none cursor-pointer"
        >
          Close
        </Button>
      )}

      {!isAdmin && isScheduled && onArrive && (
        <Button
          type="button"
          onClick={() => {
            if (isModalMode) onClose();
            onArrive(delivery);
          }}
          className="h-9 rounded-control bg-primary text-on-brand px-4 type-label-button-sm hover:bg-primary-hover transition-colors shadow-none cursor-pointer"
        >
          Confirm Arrival
        </Button>
      )}

      {!isAdmin && isArrived && !delivery.grnNumber && (
        <Button
          type="button"
          onClick={() => setShowCreateGrnModal(true)}
          className="h-9 rounded-control bg-primary text-on-brand px-4 type-label-button-sm hover:bg-primary-hover transition-colors shadow-none cursor-pointer"
        >
          Create Goods Receipt Note
        </Button>
      )}
    </div>
  );

  const renderLeftCards = () => (
    <div className="min-w-0 space-y-4">
      {/* Progress Stepper Card */}
      {!isCancelled && (
        <section className="rounded-card border border-border bg-surface px-5 py-3.5">
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
        </section>
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

      {/* Delivery Details Card (3-column structured read-only fields) */}
      <section className="rounded-card border border-border bg-surface p-5 space-y-4">
        <h2 className="type-subsection text-ink">Delivery details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink-strong">Purchase Order</label>
            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary tabular-nums">
              {delivery.poNumber || "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink-strong">Supplier</label>
            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
              {delivery.supplierName || "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink-strong">Payment Terms</label>
            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
              {delivery.paymentType || "Payable"}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink-strong">Destination</label>
            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
              {delivery.receivingLocationName || "Commissary (Receiving Bay)"}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink-strong">Planned Dispatch</label>
            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
              {fmtDate(delivery.scheduledDate)}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink-strong">Actual Arrival</label>
            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
              {fmtDate(delivery.actualArrivalDate)}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink-strong">Received By</label>
            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
              {delivery.receivedBy || (isArrived ? "Vince Neil Madeja" : "Pending Arrival")}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink-strong">Goods Receipt Note</label>
            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
              {delivery.grnNumber || (isArrived ? "Ready for Goods Receipt Note" : "—")}
            </div>
          </div>
        </div>
      </section>

      {/* Shipment Items Card (compact rows, no abbreviations) */}
      <section className="rounded-card border border-border bg-surface p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="type-subsection text-ink">Shipment items ({itemCount})</h2>
            <p className="mt-0.5 type-caption text-ink-muted">
              Declared quantities scheduled under this delivery order.
            </p>
          </div>
          <span className="type-caption font-medium text-ink-muted tabular-nums">
            Total shipment quantity: {totalShipmentQty}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full type-table-cell text-left border-collapse">
            <thead>
              <tr className="border-b border-divider text-ink-muted type-table-header">
                <th className="py-1.5 pr-3 font-medium">Item Description</th>
                <th className="py-1.5 px-3 font-medium whitespace-nowrap">Supply Number</th>
                <th className="py-1.5 px-3 font-medium whitespace-nowrap">Unit of Measure</th>
                <th className="py-1.5 px-3 text-right font-medium whitespace-nowrap">
                  Order Quantity
                </th>
                <th className="py-1.5 pl-3 text-right font-medium whitespace-nowrap">
                  Shipment Quantity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {(delivery.items || []).length > 0 ? (
                (delivery.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-page transition-colors">
                    <td className="py-2 pr-3 font-medium text-ink">{item.itemName}</td>
                    <td className="py-2 px-3 type-caption text-ink-muted whitespace-nowrap tabular-nums">
                      {item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`}
                    </td>
                    <td className="py-2 px-3 text-ink-muted whitespace-nowrap">
                      {item.purchaseUomName}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-ink-muted">
                      {item.poOrderedQuantity || item.declaredQuantity}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums font-semibold text-ink">
                      {item.declaredQuantity}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center type-body-secondary text-ink-muted">
                    No items listed for this delivery order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Document Proofs & Attachments Card */}
      {(displayReceiptSrc || displayArrivalSrc) && (
        <section className="rounded-card border border-border bg-surface p-5 space-y-3">
          <h2 className="type-subsection text-ink">Document proofs &amp; attachments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {displayReceiptSrc && (
              <div className="rounded-inner border border-border bg-page p-3.5 flex items-center gap-3.5">
                <div className="size-13 rounded-control border border-border bg-surface overflow-hidden flex items-center justify-center shrink-0">
                  {displayReceiptSrc.startsWith("data:image/") ||
                  displayReceiptSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                  displayReceiptSrc.includes("/files/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayReceiptSrc}
                      alt="Receipt Proof"
                      onClick={() =>
                        setPreviewImage({ title: "Receipt Proof", src: displayReceiptSrc })
                      }
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <FileText className="w-5 h-5 text-primary" />
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
                      onClick={() =>
                        setPreviewImage({ title: "Receipt Proof", src: displayReceiptSrc })
                      }
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
              <div className="rounded-inner border border-border bg-page p-3.5 flex items-center gap-3.5">
                <div className="size-13 rounded-control border border-border bg-surface overflow-hidden flex items-center justify-center shrink-0">
                  {displayArrivalSrc.startsWith("data:image/") ||
                  displayArrivalSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                  displayArrivalSrc.includes("/files/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayArrivalSrc}
                      alt="Arrival Proof"
                      onClick={() =>
                        setPreviewImage({ title: "Arrival Proof", src: displayArrivalSrc })
                      }
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <FileText className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="type-body-secondary font-medium text-ink truncate">
                    Arrival Proof Photo
                  </p>
                  <p className="type-caption text-ink-muted">Uploaded upon delivery arrival</p>
                  {(displayArrivalSrc.startsWith("data:image/") ||
                    displayArrivalSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
                    displayArrivalSrc.includes("/files/")) && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({ title: "Arrival Proof", src: displayArrivalSrc })
                      }
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
        </section>
      )}
    </div>
  );

  const renderSummarySidebar = () => (
    <aside className="xl:sticky xl:top-5">
      <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
        <h2 className="type-subsection text-ink">Delivery summary</h2>

        <div className="space-y-2.5 type-body-secondary">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Delivery Number</span>
            <span className="font-medium text-ink tabular-nums">{delivery.deliveryNumber}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Status</span>
            <span className="font-medium text-ink">{delivery.status}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Purchase Order</span>
            <span className="font-medium text-ink tabular-nums">{delivery.poNumber || "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Supplier</span>
            <span className="font-medium text-ink text-right truncate max-w-[180px]">
              {delivery.supplierName || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Payment Terms</span>
            <span className="font-medium text-ink">{delivery.paymentType || "Payable"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Planned Dispatch</span>
            <span className="font-medium text-ink">{fmtDate(delivery.scheduledDate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Actual Arrival</span>
            <span className="font-medium text-ink">{fmtDate(delivery.actualArrivalDate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Received By</span>
            <span className="font-medium text-ink text-right truncate max-w-[170px]">
              {delivery.receivedBy || (isArrived ? "Vince Neil Madeja" : "Pending Arrival")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Total Shipment Quantity</span>
            <span className="font-medium text-ink tabular-nums">
              {totalShipmentQty} ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
          </div>
        </div>

        <div className="border-t border-divider pt-3 flex items-center justify-between gap-3">
          <span className="type-subsection text-ink">Total Purchase Order Amount</span>
          <span className="type-card-title font-bold text-primary tabular-nums">
            {formatCurrency(poTotalAmount)}
          </span>
        </div>
      </div>
    </aside>
  );

  const renderOverlays = () => (
    <>
      {/* Full Image Lightbox Modal */}
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
    </>
  );

  if (variant === "page") {
    const containerClasses = embedded
      ? "space-y-5 pb-10 animate-page-in"
      : "page-container px-4 sm:px-8 w-full space-y-5 pb-10 animate-page-in";

    return (
      <div className={containerClasses}>
        {/* Top Breadcrumb, Title & Header Action Buttons (matching Figma 124:168 & PODetailsView) */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Delivery shipments</span>
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="type-page-title text-ink tabular-nums">
                  {delivery.deliveryNumber}
                </h1>
                <StatusBadge status={delivery.status} />
              </div>
              <p className="type-body text-ink-muted">
                Delivery order details &middot; {delivery.poNumber || "—"} &middot;{" "}
                {delivery.supplierName || "—"}
              </p>
            </div>

            {renderActionButtons(false)}
          </div>
        </div>

        {/* 2-Column Layout matching Figma 124:168 */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          {renderLeftCards()}
          {renderSummarySidebar()}
        </div>

        {renderOverlays()}
      </div>
    );
  }

  // Backward-compatible Modal Wrapper
  const footerHelperText = isCancelled
    ? "This delivery order has been cancelled."
    : isScheduled
      ? "Review delivery details or confirm arrival."
      : isArrived && !delivery.grnNumber
        ? "Delivery arrived · Ready for Goods Receipt Note."
        : "Delivery received and recorded with Goods Receipt Note.";

  return (
    <ModalWrapper
      open={!!delivery}
      title="Delivery order details"
      titleBadge={<StatusBadge status={delivery.status} />}
      subtitle={`${delivery.deliveryNumber} · ${delivery.poNumber || "—"} · ${delivery.supplierName || "—"}`}
      onClose={onClose}
      maxWidthPx={760}
      bodyClassName="min-h-0 w-full min-w-0 flex-1 flex flex-col overflow-hidden p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-page px-6 py-5 space-y-4">
          {renderLeftCards()}
        </div>

        <div className="flex shrink-0 flex-wrap sm:flex-nowrap items-center justify-between gap-3 border-t border-topbar bg-surface px-6 py-3.5">
          <span className="type-caption text-ink-muted min-w-0 truncate">{footerHelperText}</span>
          <div className="ml-auto">{renderActionButtons(true)}</div>
        </div>
      </div>

      {renderOverlays()}
    </ModalWrapper>
  );
}

/**
 * Full-page Delivery Order Details view matching Figma Delivery · Full-Page Redesign (124:168).
 */
export function DeliveryDetailsView(props: DeliveryDetailsModalProps) {
  return <DeliveryDetailsBody {...props} variant="page" />;
}

/**
 * Backward-compatible modal wrapper for tests or standalone modal callers.
 */
export function DeliveryDetailsModal(props: DeliveryDetailsModalProps) {
  return <DeliveryDetailsBody {...props} variant="modal" />;
}
