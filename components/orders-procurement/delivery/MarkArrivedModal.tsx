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
  if (!delivery) return null;

  const [actualArrivalDate, setActualArrivalDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [arrivalFile, setArrivalFile] = useState<File | null>(null);
  const [arrivalPreviewUrl, setArrivalPreviewUrl] = useState<string>("");
  const [attachmentFileName, setAttachmentFileName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    } catch (err: any) {
      console.error("Arrival confirmation error:", err);
      setError(
        err?.response?.data?.message ||
          "An unexpected error occurred while confirming delivery arrival."
      );
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
      size="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in-50">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Quick Reference Summary Card with Status */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
          <div>
            <span className="text-muted-foreground block text-[11px] mb-0.5">Delivery No</span>
            <span className="font-bold text-foreground">{delivery.deliveryNumber}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] mb-0.5">Purchase Order Ref</span>
            <span className="font-medium text-foreground">{delivery.poNumber}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] mb-0.5">Supplier</span>
            <span className="font-semibold text-foreground truncate block">{delivery.supplierName || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] mb-0.5">Current Status</span>
            <StatusBadge status={delivery.status} />
          </div>
        </div>

        {/* Arriving Items Overview */}
        {delivery.items && delivery.items.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground">
              Arriving Items (will proceed to GRN after arrival)
            </label>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-xs">
                    <th className="px-3.5 py-2">Item Name</th>
                    <th className="px-3.5 py-2">Supply No</th>
                    <th className="px-3.5 py-2">Unit of Measure</th>
                    <th className="px-3.5 py-2 text-right">Shipment Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {delivery.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/10">
                      <td className="px-3.5 py-2 font-medium text-foreground">{item.itemName}</td>
                      <td className="px-3.5 py-2 text-[11px] font-semibold text-muted-foreground">
                        {item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`}
                      </td>
                      <td className="px-3.5 py-2 text-muted-foreground">{item.purchaseUomName}</td>
                      <td className="px-3.5 py-2 text-right font-bold text-foreground">
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
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Arrival Date <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type="date"
                min={getTodayDateString()}
                max={getMaxFutureDateString()}
                value={actualArrivalDate}
                onChange={(e) => setActualArrivalDate(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-card px-3.5 py-2 pr-10 text-xs text-foreground cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Received By
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs font-semibold text-foreground select-none">
              {receiverAccountName}
            </div>
          </div>
        </div>

        {/* Arrival Proof Photo (Required with Image Preview) */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground flex items-center justify-between">
            <span>
              Arrival Proof / Photo <span className="text-destructive">*</span>
            </span>
            {!arrivalFile && (
              <span className="text-[11px] text-destructive font-normal">
                Required to confirm arrival
              </span>
            )}
          </label>
          <div className="rounded-xl border border-dashed border-border bg-card p-4 transition-colors">
            {arrivalFile ? (
              <div className="space-y-3">
                <div className="relative flex flex-col items-center justify-center p-3 bg-muted/20 rounded-xl border border-border">
                  {arrivalPreviewUrl ? (
                    <img
                      src={arrivalPreviewUrl}
                      alt="Arrival proof"
                      className="max-h-48 rounded-lg object-contain border border-border shadow-xs"
                    />
                  ) : (
                    <div className="flex items-center gap-2.5 p-4 text-xs font-medium text-foreground">
                      <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
                      <span className="truncate">{attachmentFileName || "Uploaded document"}</span>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground truncate max-w-xs text-center">
                    {attachmentFileName || "Arrival proof photo"}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1.5">
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
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center cursor-pointer py-4 hover:bg-muted/30 rounded-xl transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                <span className="text-xs font-medium text-foreground">
                  Click to upload arrival proof or photo <span className="text-destructive">*</span>
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
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
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-4">
          <ModalCloseButton
            type="button"
            variant="outline"
            disabled={submitting}
            fallbackOnClose={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Close
          </ModalCloseButton>
          <Button
            type="submit"
            disabled={submitting || !isFormValid}
            className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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
