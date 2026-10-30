"use client";

import React, { useState } from "react";
import { AlertCircle, Check, FileText, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { Delivery } from "../types";
import CreateGrnModal from "@/components/receiving/CreateGrnModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { downloadDeliveryReportPdf } from "./downloadDeliveryReportPdf";

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
  const isInTransit = delivery.status === "In Transit";
  const isArrived = delivery.status === "Arrived";
  const isCancelled = delivery.status === "Cancelled";
  const isCancellable = isScheduled || isInTransit;

  const steps = ["Scheduled", "Arrived", "Received (GRN)"];
  const currentStepIdx = isCancelled ? -1 : delivery.grnNumber ? 2 : isArrived ? 1 : 0;

  const receiptProofSrc = delivery.scheduledAttachment || delivery.attachmentUrl || "";
  const arrivalProofSrc = delivery.arrivalAttachment || "";

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
      size="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Compact Top Bar: Status, Delivery No, PO Reference, and Stepper */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <StatusBadge status={delivery.status} />
              <span className="font-mono text-sm font-bold text-foreground">
                {delivery.deliveryNumber}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Purchase Order Reference:{" "}
              <span className="font-mono font-bold text-foreground">
                {delivery.poNumber || "—"}
              </span>
            </div>
          </div>

          {!isCancelled && (
            <div className="px-2 pt-1">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-3.5 -translate-y-1/2 w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-in-out"
                    style={{ width: `${(currentStepIdx / (steps.length - 1)) * 100}%` }}
                  />
                </div>
                {steps.map((s, i) => {
                  const isActive = i <= currentStepIdx;
                  const isLast = i === currentStepIdx;
                  return (
                    <div key={s} className="relative flex flex-col items-center gap-1.5 bg-card px-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all duration-300 z-10 ${
                          isActive
                            ? "bg-primary border-primary text-primary-foreground shadow-xs"
                            : "bg-background border-muted text-muted-foreground"
                        }`}
                      >
                        {isActive && !isLast ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-bold ${
                          isActive ? "text-foreground" : "text-muted-foreground"
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
          <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Order Cancelled</span>
              <span className="text-foreground text-[11px]">{delivery.notes}</span>
            </div>
          </div>
        )}

        {/* Delivery Summary Card (2x4 organized grid) */}
        <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Delivery Summary
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Purchase Order</span>
              <span className="font-mono font-bold text-foreground">{delivery.poNumber || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Supplier</span>
              <span className="font-semibold text-foreground truncate block">
                {delivery.supplierName || "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Payment Terms</span>
              <span className="font-medium text-foreground">{delivery.paymentType || "Payable"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Destination</span>
              <span className="font-medium text-foreground">
                {delivery.receivingLocationName || "Commissary (Receiving Bay)"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Scheduled Date</span>
              <span className="font-medium text-foreground">{fmtDate(delivery.scheduledDate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Actual Arrival Date</span>
              <span className="font-medium text-foreground">{fmtDate(delivery.actualArrivalDate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Received By</span>
              <span className="font-semibold text-foreground">
                {delivery.receivedBy || (isArrived ? "Vince Neil Madeja" : "Pending Arrival")}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px] mb-0.5">Goods Receipt Note</span>
              <span className="font-mono font-semibold text-foreground">
                {delivery.grnNumber || (isArrived ? "Ready for GRN" : "—")}
              </span>
            </div>
          </div>
        </div>

        {/* Shipment Items Table (Placed directly after Summary so it is immediately visible) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Shipment Items ({delivery.items?.length || 0})
            </h4>
            <span className="text-xs font-mono font-semibold text-muted-foreground">
              Total Shipment Qty:{" "}
              {delivery.items?.reduce((sum, it) => sum + (Number(it.declaredQuantity) || 0), 0) || 0}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-[11px] uppercase">
                  <th className="px-3.5 py-2.5">Item Description</th>
                  <th className="px-3.5 py-2.5">Supply No</th>
                  <th className="px-3.5 py-2.5">Unit of Measure</th>
                  <th className="px-3.5 py-2.5 text-right">Purchase Order Qty</th>
                  <th className="px-3.5 py-2.5 text-right">Shipment Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(delivery.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/10">
                    <td className="px-3.5 py-2.5 font-semibold text-foreground">
                      {item.itemName}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] font-semibold text-muted-foreground">
                      {item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`}
                    </td>
                    <td className="px-3.5 py-2.5 text-muted-foreground">{item.purchaseUomName}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-muted-foreground">
                      {item.poOrderedQuantity || item.declaredQuantity}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-foreground">
                      {item.declaredQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compact Side-by-Side Document Proofs & Attachments */}
        {(receiptProofSrc || arrivalProofSrc) && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Document Proofs &amp; Attachments
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {receiptProofSrc && (
                <div className="rounded-xl border border-border bg-muted/10 p-3 flex items-center gap-3">
                  <div className="w-20 h-20 rounded-lg border border-border bg-background overflow-hidden flex items-center justify-center shrink-0">
                    {receiptProofSrc.startsWith("data:image/") ||
                    receiptProofSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ? (
                      <img
                        src={receiptProofSrc}
                        alt="Receipt Proof"
                        onClick={() => setPreviewImage({ title: "Receipt Proof", src: receiptProofSrc })}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    ) : (
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-semibold text-foreground">Schedule / Receipt Proof</p>
                    <p className="text-[11px] text-muted-foreground">
                      Uploaded when scheduling delivery
                    </p>
                    {(receiptProofSrc.startsWith("data:image/") ||
                      receiptProofSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i)) && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ title: "Receipt Proof", src: receiptProofSrc })}
                        className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" /> View Full Image
                      </button>
                    )}
                  </div>
                </div>
              )}

              {arrivalProofSrc && (
                <div className="rounded-xl border border-border bg-muted/10 p-3 flex items-center gap-3">
                  <div className="w-20 h-20 rounded-lg border border-border bg-background overflow-hidden flex items-center justify-center shrink-0">
                    {arrivalProofSrc.startsWith("data:image/") ||
                    arrivalProofSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ? (
                      <img
                        src={arrivalProofSrc}
                        alt="Arrival Proof"
                        onClick={() => setPreviewImage({ title: "Arrival Proof", src: arrivalProofSrc })}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    ) : (
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-semibold text-foreground">Arrival Proof Photo</p>
                    <p className="text-[11px] text-muted-foreground">
                      Uploaded upon delivery arrival
                    </p>
                    {(arrivalProofSrc.startsWith("data:image/") ||
                      arrivalProofSrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i)) && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ title: "Arrival Proof", src: arrivalProofSrc })}
                        className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
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
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-4 max-w-2xl w-full space-y-3 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h5 className="text-xs font-bold text-foreground uppercase">{previewImage.title}</h5>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewImage(null)}
                  className="h-7 px-3 text-xs rounded-lg cursor-pointer"
                >
                  Close Preview
                </Button>
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

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-1 border-t border-border mt-4">
          <div>
            {!isAdmin && isCancellable && onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onClose();
                  onCancel(delivery);
                }}
                className="rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel Delivery
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {(isArrived || Boolean(delivery.grnNumber)) && (
              <Button
                type="button"
                variant="outline"
                disabled={downloadingReport}
                onClick={handleDownloadReport}
                className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-primary" />
                {downloadingReport ? "Downloading..." : "Download Delivery Report"}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Close
            </Button>

            {!isAdmin && (isScheduled || isInTransit) && onArrive && (
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onArrive(delivery);
                }}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm cursor-pointer"
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
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm cursor-pointer"
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
