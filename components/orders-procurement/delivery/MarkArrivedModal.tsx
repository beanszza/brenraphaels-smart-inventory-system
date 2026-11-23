"use client";

import { procurement } from "@/lib/orders/client";
import { uploadDeliveryAttachmentDirect } from "@/app/actions/orders/delivery-files";

import React, { useState } from "react";
import { AlertCircle, Upload, Trash2, Calendar, FileText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { Delivery } from "../types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useStaff } from "@/context/StaffContext";
import { getFutureDateError, getMaxFutureDateString, getTodayDateString } from "@/lib/date-limits";
import { downloadDeliveryReportPdf } from "./downloadDeliveryReportPdf";

interface MarkArrivedModalProps {
  delivery: Delivery | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkArrivedModal({
  delivery,
  onClose,
  onSuccess,
}: MarkArrivedModalProps) {
  const staff = useStaff();
  const receiverAccountName = staff.name || "Vince Neil Madeja";

  const [actualArrivalDate, setActualArrivalDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [arrivalFile, setArrivalFile] = useState<File | null>(null);
  const [arrivalPreviewUrl, setArrivalPreviewUrl] = useState<string>("");
  const [attachmentFileName, setAttachmentFileName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!delivery) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB limit.");
      return;
    }

    setArrivalFile(file);
    setAttachmentFileName(file.name);
    if (file.type.startsWith("image/")) {
      setArrivalPreviewUrl(URL.createObjectURL(file));
    } else {
      setArrivalPreviewUrl("");
    }
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!actualArrivalDate) {
      setError("Please specify the actual arrival date.");
      return;
    }
    const arrivalDateErr = getFutureDateError(actualArrivalDate, "Arrival Date", { allowToday: true });
    if (arrivalDateErr) {
      setError(arrivalDateErr);
      return;
    }

    if (!arrivalFile) {
      setError("Arrival proof photo is required before confirming arrival.");
      return;
    }

    setConfirmOpen(true);
  };

  const executeConfirmArrival = async () => {
    setConfirmOpen(false);
    try {
      setSubmitting(true);
      let uploadedFileId: string | null = null;
      if (arrivalFile) {
        const fd = new FormData();
        fd.append("file", arrivalFile);
        const upRes = await uploadDeliveryAttachmentDirect(fd);
        if (!upRes.success || !upRes.data?.fileId) {
          setError(upRes.message || "Failed to upload arrival attachment to file storage.");
          setSubmitting(false);
          return;
        }
        uploadedFileId = upRes.data.fileId;
      }

      const combinedDateTime = new Date(`${actualArrivalDate}T12:00:00Z`).toISOString();

      const payload = {
        actualArrivalDate: combinedDateTime,
        receivedBy: receiverAccountName,
        arrivalAttachmentBase64: uploadedFileId,
        attachmentUrl: uploadedFileId,
      };

      const res = await procurement.arriveDelivery(delivery.deliveryId, payload);

      if (res?.data?.success) {
        // Generate & download official Delivery Arrival Report PDF upon arrival confirmation
        try {
          await downloadDeliveryReportPdf({
            ...delivery,
            status: "Arrived",
            actualArrivalDate: combinedDateTime,
            receivedBy: receiverAccountName,
            arrivalAttachment: uploadedFileId || arrivalPreviewUrl,
          });
        } catch (pdfErr) {
          console.error("Failed to auto-download delivery report PDF:", pdfErr);
        }
        onSuccess();
        onClose();
      } else {
        setError(res?.data?.message || "Failed to confirm arrival.");
      }
    } catch (err: unknown) {
      console.error("Arrival confirmation error:", err);
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message || "An unexpected error occurred while confirming delivery arrival."
          : err instanceof Error
          ? err.message
          : "An unexpected error occurred while confirming delivery arrival.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = Boolean(
    actualArrivalDate &&
    arrivalFile
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <ModalWrapper
      open={!!delivery}
      title="Confirm delivery arrival"
      titleBadge={<StatusBadge status={delivery.status} />}
      subtitle={`${delivery.deliveryNumber} · ${delivery.poNumber || "—"} · ${delivery.supplierName || "—"}`}
      onClose={onClose}
      maxWidthPx={640}
      bodyClassName="min-h-0 w-full min-w-0 flex-1 flex flex-col overflow-hidden p-0"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        {/* Scrollable Body — Clean white surface matching Figma 91-21 & 91-111 */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface px-6 py-5 space-y-4">
          {error && (
            <div className="p-3.5 rounded-inner border border-notice-danger-border bg-notice-danger-bg text-notice-danger-text type-caption flex items-start gap-2.5 animate-in fade-in-50">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Delivery Reference Card (67-5207 flat lavender-bordered card) */}
          <div className="rounded-card border border-border bg-surface px-4 py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-ink-muted block type-caption mb-0.5">Delivery no.</span>
              <span className="font-medium text-ink type-body-secondary block">
                {delivery.deliveryNumber}
              </span>
            </div>
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
          </div>

          {/* Arriving Items Card (67-5207 unshaded sentence-case table) */}
          {delivery.items && delivery.items.length > 0 && (
            <div className="rounded-card border border-border bg-surface px-4.5 pt-4 pb-2.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="type-card-title text-ink">
                  Arriving items ({delivery.items.length})
                </h4>
                <span className="type-caption text-ink-muted">
                  Proceeds to GRN after arrival
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full type-table-cell text-left border-collapse">
                  <thead>
                    <tr className="border-b border-divider text-ink-muted type-table-header">
                      <th className="py-2 pr-3 font-medium">Item</th>
                      <th className="py-2 px-3 font-medium">Supply no.</th>
                      <th className="py-2 px-3 font-medium">UOM</th>
                      <th className="py-2 pl-3 text-right font-medium">Shipment qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {delivery.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-page/60 transition-colors">
                        <td className="py-2.5 pr-3 font-medium text-ink">{item.itemName}</td>
                        <td className="py-2.5 px-3 type-caption text-ink-muted">
                          {item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`}
                        </td>
                        <td className="py-2.5 px-3 text-ink-muted">{item.purchaseUomName}</td>
                        <td className="py-2.5 pl-3 text-right tabular-nums font-semibold text-ink">
                          {item.declaredQuantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Arrival Date & Read-Only Account Receiver */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="actual-arrival-date"
                className="flex items-center gap-1 type-label-field text-ink-strong"
              >
                <span>Arrival date</span>
                <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  id="actual-arrival-date"
                  type="date"
                  min={getTodayDateString()}
                  max={getMaxFutureDateString()}
                  value={actualArrivalDate}
                  onChange={(e) => setActualArrivalDate(e.target.value)}
                  className="w-full h-9.5 rounded-control border border-input bg-surface px-3 pr-9 type-body text-ink cursor-pointer focus:outline-none focus:border-primary focus:ring-2 focus:ring-focus/30 transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 type-label-field text-ink-strong">
                <span>Received by</span>
                <span className="type-caption text-ink-disabled">(auto-assigned)</span>
              </label>
              <div className="flex items-center gap-2 h-9.5 px-3 rounded-control border border-input bg-page type-body font-medium text-ink select-none">
                <User className="w-4 h-4 text-ink-muted shrink-0" />
                <span className="truncate">{receiverAccountName}</span>
              </div>
            </div>
          </div>

          {/* Arrival Proof / Photo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1 type-label-field text-ink-strong">
                <span>Arrival proof / photo</span>
                <span className="text-destructive">*</span>
              </label>
              {!arrivalFile ? (
                <span className="type-caption text-destructive">
                  Required to confirm arrival
                </span>
              ) : (
                <span className="type-caption text-ink-disabled">
                  JPG, PNG, or PDF up to 10 MB
                </span>
              )}
            </div>

            {arrivalFile ? (
              <div className="rounded-inner border border-border bg-page p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-9 rounded-control bg-status-purple-bg text-status-purple-fg flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="type-body-secondary font-medium text-ink truncate">
                        {attachmentFileName || "Arrival proof photo"}
                      </p>
                      <p className="type-caption text-ink-muted">
                        {formatFileSize(arrivalFile.size)} · Ready to upload
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="cursor-pointer h-8 px-2.5 rounded-control border border-border bg-surface hover:bg-subtle type-caption font-medium text-ink transition-colors inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Change</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setArrivalFile(null);
                        setAttachmentFileName("");
                        if (arrivalPreviewUrl) URL.revokeObjectURL(arrivalPreviewUrl);
                        setArrivalPreviewUrl("");
                      }}
                      className="h-8 px-2.5 rounded-control border border-border bg-surface text-destructive hover:bg-notice-danger-bg type-caption font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                {arrivalPreviewUrl && (
                  <div className="flex justify-center rounded-control border border-topbar bg-surface p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={arrivalPreviewUrl}
                      alt="Arrival proof"
                      className="max-h-48 rounded-control object-contain"
                    />
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-inner border border-dashed border-border bg-page py-5 px-4 text-center hover:border-primary hover:bg-tint-selected/40 transition-colors cursor-pointer">
                <div className="size-9 rounded-pill border border-border bg-surface flex items-center justify-center text-ink-muted mb-2">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="type-body-secondary font-medium text-ink">
                  Click to upload arrival proof or photo
                </span>
                <span className="type-caption text-ink-muted mt-0.5">
                  JPG, PNG, or PDF up to 10 MB
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Full-Bleed Tinted Footer Bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-topbar bg-page px-6 py-3.5">
          <span className="type-caption text-ink-muted">
            {arrivalFile
              ? "Ready to confirm · Arrival report PDF downloads automatically."
              : "Upload arrival proof to confirm arrival."}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <ModalCloseButton
              type="button"
              variant="outline"
              disabled={submitting}
              fallbackOnClose={onClose}
              className="h-9.5 rounded-control border border-border bg-surface px-3.5 type-label-button-sm text-ink hover:bg-subtle transition-colors disabled:opacity-50 cursor-pointer"
            >
              Close
            </ModalCloseButton>
            <Button
              type="submit"
              disabled={submitting || !isFormValid}
              className="h-9.5 rounded-control bg-primary text-on-brand px-4 type-label-button-sm hover:bg-primary-hover transition-colors disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? "Confirming & Generating Report..." : "Confirm Arrival"}
            </Button>
          </div>
        </div>
      </form>

      <ActionConfirmModal
        open={confirmOpen}
        title="Confirm Delivery Arrival"
        subtitle={`Delivery No: ${delivery.deliveryNumber} • PO: ${delivery.poNumber}`}
        description={`Are you sure you want to confirm arrival for ${delivery.deliveryNumber} on ${actualArrivalDate} and generate the official Delivery Arrival Report?`}
        confirmLabel="Confirm Arrival"
        submitting={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeConfirmArrival}
      />
    </ModalWrapper>
  );
}
