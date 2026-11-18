"use client";

import { procurement } from "@/lib/orders/client";
import { uploadDeliveryAttachmentDirect } from "@/app/actions/orders/delivery-files";

import React, { useState } from "react";
import { AlertCircle, Upload, Trash2, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  return (
    <ModalWrapper
      open={!!delivery}
      title={`Confirm Delivery Arrival — ${delivery.deliveryNumber}`}
      onClose={onClose}
      size="max-w-[640px]"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3.5 rounded-card border border-status-red bg-status-red-bg text-status-red type-caption flex items-start gap-2.5 animate-in fade-in-50">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Quick Reference Summary Card with Status */}
        <div className="rounded-card border border-divider bg-surface-muted p-4 type-caption grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
          <div>
            <span className="text-text-muted block type-caption mb-0.5">Delivery No</span>
            <span className="font-semibold text-text-primary type-body">{delivery.deliveryNumber}</span>
          </div>
          <div>
            <span className="text-text-muted block type-caption mb-0.5">Purchase Order Ref</span>
            <span className="font-medium text-text-primary type-body">{delivery.poNumber}</span>
          </div>
          <div>
            <span className="text-text-muted block type-caption mb-0.5">Supplier</span>
            <span className="font-semibold text-text-primary type-body truncate block">{delivery.supplierName || "—"}</span>
          </div>
          <div>
            <span className="text-text-muted block type-caption mb-0.5">Current Status</span>
            <StatusBadge status={delivery.status} />
          </div>
        </div>

        {/* Arriving Items Overview */}
        {delivery.items && delivery.items.length > 0 && (
          <div className="space-y-1.5">
            <label className="block type-label font-semibold text-text-primary">
              Arriving Items (will proceed to GRN after arrival)
            </label>
            <div className="overflow-x-auto rounded-card border border-divider">
              <table className="w-full type-table-cell text-left">
                <thead>
                  <tr className="border-b border-divider bg-surface-muted text-text-muted font-semibold type-table-header table-head-row">
                    <th className="table-th px-3.5 py-2">Item Name</th>
                    <th className="table-th px-3.5 py-2">Supply No</th>
                    <th className="table-th px-3.5 py-2">Unit of Measure</th>
                    <th className="table-th px-3.5 py-2 text-right">Shipment Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {delivery.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-hover table-row">
                      <td className="table-td px-3.5 py-2 font-medium text-text-primary">{item.itemName}</td>
                      <td className="table-td px-3.5 py-2 type-caption font-semibold text-text-muted">
                        {item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`}
                      </td>
                      <td className="table-td px-3.5 py-2 text-text-muted">{item.purchaseUomName}</td>
                      <td className="table-td px-3.5 py-2 text-right font-semibold text-text-primary">
                        {item.declaredQuantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Streamlined Arrival Details: Date & Read-Only Account Receiver */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Arrival Date <span className="text-status-red">*</span>
            </label>
            <div className="relative">
              <Input
                type="date"
                min={getTodayDateString()}
                max={getMaxFutureDateString()}
                value={actualArrivalDate}
                onChange={(e) => setActualArrivalDate(e.target.value)}
                className="w-full h-10 rounded-control border border-divider bg-surface px-3.5 py-2 pr-10 type-body text-text-primary cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Received By
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface-muted type-body font-semibold text-text-primary select-none">
              {receiverAccountName}
            </div>
          </div>
        </div>

        {/* Arrival Proof Photo (Required with Image Preview) */}
        <div>
          <label className="mb-1.5 block type-label font-semibold text-text-primary flex items-center justify-between">
            <span>
              Arrival Proof / Photo <span className="text-status-red">*</span>
            </span>
            {!arrivalFile && (
              <span className="type-caption text-status-red font-normal">
                Required to confirm arrival
              </span>
            )}
          </label>
          <div className="rounded-card border border-dashed border-divider bg-surface p-4 transition-colors">
            {arrivalFile ? (
              <div className="space-y-3">
                <div className="relative flex flex-col items-center justify-center p-3 bg-surface-muted rounded-control border border-divider">
                  {arrivalPreviewUrl ? (
                    <img
                      src={arrivalPreviewUrl}
                      alt="Arrival proof"
                      className="max-h-48 rounded-control object-contain border border-divider shadow-xs"
                    />
                  ) : (
                    <div className="flex items-center gap-2.5 p-4 type-body font-medium text-text-primary">
                      <FileText className="w-8 h-8 text-text-muted shrink-0" />
                      <span className="truncate">{attachmentFileName || "Uploaded document"}</span>
                    </div>
                  )}
                  <p className="mt-2 type-caption text-text-muted truncate max-w-xs text-center">
                    {attachmentFileName || "Arrival proof photo"}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <label className="cursor-pointer type-caption font-semibold px-3 py-1.5 rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary transition-colors flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Change File
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
                    className="type-caption font-semibold px-3 py-1.5 rounded-control border border-status-red text-status-red hover:bg-status-red-bg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center cursor-pointer py-4 hover:bg-surface-hover rounded-control transition-colors">
                <Upload className="w-6 h-6 text-text-muted mb-2" />
                <span className="type-body font-medium text-text-primary">
                  Click to upload arrival proof or photo <span className="text-status-red">*</span>
                </span>
                <span className="type-caption text-text-muted mt-0.5">
                  JPG, PNG, PDF up to 8MB
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

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-divider mt-4">
          <ModalCloseButton
            type="button"
            variant="outline"
            disabled={submitting}
            fallbackOnClose={onClose}
            className="rounded-control border border-divider bg-surface px-5 py-2.5 h-auto type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            Close
          </ModalCloseButton>
          <Button
            type="submit"
            disabled={submitting || !isFormValid}
            className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 h-auto type-label-button font-semibold hover:bg-button-primary-hover transition-colors shadow-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? "Confirming & Generating Report..." : "Confirm Arrival"}
          </Button>
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
