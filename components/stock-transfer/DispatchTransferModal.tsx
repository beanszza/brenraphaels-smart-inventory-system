"use client";

import React, { useState, useEffect, useRef } from "react";
import { Calendar, Clock, Upload, AlertCircle, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { actionResponse } from "@/lib/resources/action-response";
import { dispatchTransfer } from "@/app/actions/stock-transfer/dispatch";
import { uploadTransferAttachmentDirect } from "@/app/actions/stock-transfer/transfer-files";
import { StockTransfer, StockTransferRequest } from "./types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useOptionalStaff } from "@/context/StaffContext";
import { StockTransferConfirmModal } from "./StockTransferConfirmModal";

interface DispatchTransferModalProps {
  transfer: StockTransfer | null;
  request?: StockTransferRequest | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ALLOWED_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function formatDateDisplay(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function DispatchTransferModal({
  transfer,
  request,
  open,
  onClose,
  onSuccess,
}: DispatchTransferModalProps) {
  const staff = useOptionalStaff();
  const currentStaffName = staff?.name?.trim() || staff?.username?.trim() || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form states
  const [actualDispatchDate, setActualDispatchDate] = useState<string>("");
  const [actualDispatchTime, setActualDispatchTime] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dispatchRemarks, setDispatchRemarks] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split("T")[0];

  useEffect(() => {
    if (open && transfer) {
      const now = new Date();
      const currentToday = now.toISOString().split("T")[0];
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${hours}:${minutes}`;

      setActualDispatchDate(currentToday);
      setActualDispatchTime(timeStr);
      setSelectedFile(null);
      setDispatchRemarks("");
      setError(null);
      setShowConfirm(false);
    }
  }, [open, transfer, currentStaffName]);

  if (!open || !transfer) return null;

  // Extract scheduled information from transfer.notes or fields
  const scheduledInfo = {
    transportProvider: transfer.courierName || "—",
    vehicleType: "—",
    plateNumber: transfer.vehiclePlate || "—",
    bookingReference: "—",
    transferFee: "—",
    driverName: transfer.driverName || "—",
    driverContact: "—",
  };

  try {
    if (transfer.notes) {
      const parsed = JSON.parse(transfer.notes);
      if (parsed && typeof parsed === "object") {
        if (parsed.transportProvider) scheduledInfo.transportProvider = parsed.transportProvider;
        if (parsed.vehicleType) scheduledInfo.vehicleType = parsed.vehicleType;
        if (parsed.plateNumber) scheduledInfo.plateNumber = parsed.plateNumber;
        if (parsed.bookingReference) scheduledInfo.bookingReference = parsed.bookingReference;
        if (parsed.transferFee) scheduledInfo.transferFee = `₱${Number(parsed.transferFee).toLocaleString()}`;
        if (parsed.driverName) scheduledInfo.driverName = parsed.driverName;
        if (parsed.driverContact) scheduledInfo.driverContact = parsed.driverContact;
      }
    }
  } catch {
    // If not JSON, use raw values
  }

  const handleDateChange = (val: string) => {
    if (val) {
      const parts = val.split("-");
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].slice(0, 4);
        val = parts.join("-");
      }
    }
    setActualDispatchDate(val);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const validExt = ALLOWED_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!validExt) {
      setError("Invalid file format. Please upload a JPG, PNG, or PDF file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("File size exceeds the 8MB limit.");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !transfer) return;
    setError(null);

    if (!actualDispatchDate) {
      setError("Actual dispatch date is required.");
      return;
    }

    if (actualDispatchDate < todayStr) {
      setError("Actual dispatch date cannot be in the past.");
      return;
    }

    const yearParts = actualDispatchDate.split("-");
    const year = parseInt(yearParts[0], 10);
    const currentYear = new Date().getFullYear();
    if (year < currentYear || year > currentYear + 1) {
      setError(`Please enter a valid dispatch date between ${currentYear} and ${currentYear + 1}.`);
      return;
    }

    if (!actualDispatchTime) {
      setError("Actual dispatch time is required.");
      return;
    }

    if (actualDispatchDate === todayStr) {
      const now = new Date();
      const nowHours = String(now.getHours()).padStart(2, "0");
      const nowMinutes = String(now.getMinutes()).padStart(2, "0");
      const nowTimeStr = `${nowHours}:${nowMinutes}`;
      if (actualDispatchTime < nowTimeStr) {
        setError("Actual dispatch time cannot be earlier than the current time today.");
        return;
      }
    }

    if (!selectedFile) {
      setError("Dispatch proof document or photo is required.");
      return;
    }

    setShowConfirm(true);
  };

  const handleExecuteDispatch = async () => {
    if (loading || !transfer) return;
    setLoading(true);
    setError(null);
    try {
      let uploadedFileId: string | null = null;
      if (selectedFile) {
        const fd = new FormData();
        fd.append("file", selectedFile);
        const upRes = await uploadTransferAttachmentDirect(fd);
        if (!upRes.success || !upRes.data?.fileId) {
          setError(upRes.message || "Failed to upload dispatch proof to file storage.");
          setLoading(false);
          setShowConfirm(false);
          return;
        }
        uploadedFileId = upRes.data.fileId;
      }

      const dispatchMetadata = {
        actualDispatchDate,
        actualDispatchTime,
        releasedBy: currentStaffName,
        proofFileName: selectedFile?.name || null,
        proofFileId: uploadedFileId,
        proofDataUrl: uploadedFileId,
        remarks: dispatchRemarks.trim() || null,
      };

      const res = await actionResponse(
        dispatchTransfer(transfer.transferId, {
          driverName: scheduledInfo.driverName !== "—" ? scheduledInfo.driverName : transfer.driverName,
          vehiclePlate: scheduledInfo.plateNumber !== "—" ? scheduledInfo.plateNumber : transfer.vehiclePlate,
          courierName: scheduledInfo.transportProvider !== "—" ? scheduledInfo.transportProvider : transfer.courierName,
          actualDispatchDate,
          actualDispatchTime,
          proofFileName: selectedFile?.name || "",
          proofDataUrl: uploadedFileId,
          notes: JSON.stringify(dispatchMetadata),
        })
      );

      if (res.data?.success) {
        toast.success("Stock transfer dispatched successfully and commissary stock deducted.");
        setShowConfirm(false);
        onSuccess();
        onClose();
      } else {
        setError(res.data?.message || "Failed to dispatch stock transfer.");
        setShowConfirm(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to dispatch stock transfer.");
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const displayItems =
    request?.items && request.items.length > 0
      ? request.items
      : [
          {
            requestItemId: 1,
            productName: transfer.productName,
            variant: transfer.variant,
            sku: transfer.sku,
            availableQuantity: transfer.transferQuantity,
            requestedQuantity: transfer.transferQuantity,
            suggestedLots: [],
          },
        ];

  const reqNoDisplay = request?.requestNumber || transfer.requestNumber || transfer.transferNumber;
  const destDisplay = request?.toLocationName || transfer.destLocationName || "—";
  const vehicleDisplay =
    scheduledInfo.vehicleType !== "—"
      ? `${scheduledInfo.vehicleType} · ${scheduledInfo.plateNumber}`
      : scheduledInfo.plateNumber;
  const driverDisplay =
    scheduledInfo.driverContact !== "—"
      ? `${scheduledInfo.driverName} · ${scheduledInfo.driverContact}`
      : scheduledInfo.driverName;
  const bookingDisplay =
    scheduledInfo.bookingReference !== "—" && scheduledInfo.transferFee !== "—"
      ? `${scheduledInfo.bookingReference} · ${scheduledInfo.transferFee}`
      : scheduledInfo.bookingReference !== "—"
      ? scheduledInfo.bookingReference
      : scheduledInfo.transferFee;

  return (
    <ModalWrapper
      open={open}
      title="Dispatch stock transfer"
      titleBadge={<StatusBadge status="Scheduled" />}
      subtitle={`${reqNoDisplay} · to ${destDisplay} · via ${scheduledInfo.transportProvider}`}
      onClose={() => { if (!loading) onClose(); }}
      maxWidthPx={900}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <form onSubmit={handlePreSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden text-ink">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-control border border-notice-danger-border bg-notice-danger-bg px-3.5 py-2.5 type-body-secondary text-notice-danger-text flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
              <span role="alert">{error}</span>
            </div>
          )}

          {/* Section 1: Scheduled transfer summary (2-col clean key-value card) */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
            <div className="space-y-0.5">
              <h3 className="type-subsection text-ink">Scheduled transfer summary</h3>
              <p className="type-caption text-ink-muted">
                Review the scheduled logistics before releasing stock.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-0.5">
                <span className="block type-caption font-medium text-ink-muted">Transport provider</span>
                <p className="type-body font-medium text-ink">{scheduledInfo.transportProvider}</p>
              </div>
              <div className="space-y-0.5">
                <span className="block type-caption font-medium text-ink-muted">Vehicle &amp; plate</span>
                <p className="type-body font-medium text-ink">{vehicleDisplay}</p>
              </div>
              <div className="space-y-0.5">
                <span className="block type-caption font-medium text-ink-muted">Driver &amp; contact</span>
                <p className="type-body font-medium text-ink">{driverDisplay}</p>
              </div>
              <div className="space-y-0.5">
                <span className="block type-caption font-medium text-ink-muted">Booking ref &amp; fee</span>
                <p className="type-body font-medium text-ink">{bookingDisplay}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Finished products to dispatch (separate Lot & Expiry columns) */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
            <div className="space-y-0.5">
              <h3 className="type-subsection text-ink">
                Finished products to dispatch ({displayItems.length})
              </h3>
              <p className="type-caption text-ink-muted">
                Commissary stock will be deducted from these FEFO lots.
              </p>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="border-b border-divider">
                  <tr className="whitespace-nowrap">
                    <th className="pb-2.5 pr-3 type-caption font-medium text-ink-muted min-w-[200px]">Product &amp; variant</th>
                    <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[105px]">SKU</th>
                    <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[125px]">Commissary</th>
                    <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[105px]">Lot</th>
                    <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[105px]">Expiry date</th>
                    <th className="pb-2.5 pl-2.5 text-right type-caption font-medium text-ink-muted min-w-[72px]">Req. qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {displayItems.map((item, idx) => (
                    <tr key={item.requestItemId || idx} className="align-middle">
                      <td className="py-2.5 pr-3">
                        <div className="type-body font-medium text-ink">{item.productName}</div>
                        {item.variant && <div className="type-caption text-ink-secondary">{item.variant}</div>}
                      </td>
                      <td className="py-2.5 px-2.5 type-body-secondary text-ink-secondary whitespace-nowrap">
                        {item.sku || "—"}
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="type-body text-ink tabular-nums">{item.availableQuantity ?? "—"}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-status-green-bg text-status-green-fg type-caption font-medium">
                            In stock
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        {item.suggestedLots && item.suggestedLots.length > 0 ? (
                          <div className="space-y-1">
                            {item.suggestedLots.map((lot, lIdx) => (
                              <div key={lIdx} className="type-body-secondary text-ink-secondary">
                                {lot.lotCode.replace(/^FG-/i, "")}
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
                            {item.suggestedLots.map((lot, lIdx) => (
                              <div key={lIdx} className="type-body text-ink">
                                {formatDateDisplay(lot.expiryDate)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="type-body-secondary text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pl-2.5 text-right type-body font-medium text-ink tabular-nums whitespace-nowrap">
                        {item.requestedQuantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Dispatch details & proof */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            <div className="space-y-0.5">
              <h3 className="type-subsection text-ink">Dispatch details &amp; proof</h3>
              <p className="type-caption text-ink-muted">
                Record the actual release time and upload proof of dispatch.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-4">
              {/* Actual dispatch date */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Actual dispatch date <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    min={todayStr}
                    max={maxDateStr}
                    value={actualDispatchDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full h-10 rounded-control border-input bg-surface px-3 pr-10 type-body text-ink cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                </div>
              </div>

              {/* Actual dispatch time */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Actual dispatch time <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="time"
                    value={actualDispatchTime}
                    onChange={(e) => {
                      setActualDispatchTime(e.target.value);
                      setError(null);
                    }}
                    className="w-full h-10 rounded-control border-input bg-surface px-3 pr-10 type-body text-ink cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Clock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                </div>
              </div>

              {/* Released by (locked to current user) */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Released by <span className="text-destructive">*</span>
                </label>
                <Input
                  readOnly
                  disabled
                  value={currentStaffName}
                  className="h-10 px-3 rounded-control bg-page border-input type-body text-ink-secondary cursor-not-allowed select-none disabled:opacity-100"
                />
              </div>
            </div>

            {/* Compact horizontal upload dropzone */}
            <div className="space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-inner border border-dashed border-input hover:border-primary/50 bg-surface hover:bg-page px-3.5 py-3 flex items-center gap-3 cursor-pointer transition-colors"
              >
                <Upload className="w-4.5 h-4.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="type-body font-medium text-ink">
                    Dispatch documents or proof photo <span className="text-destructive">*</span>
                  </p>
                  <p className="type-caption text-ink-muted">
                    Delivery receipt, loading photo, or signed slip · JPG, PNG, PDF up to 8MB
                  </p>
                </div>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-control border border-border bg-page">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCheck className="w-4 h-4 text-status-green-fg shrink-0" />
                    <span className="type-body-secondary text-ink truncate">
                      {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="type-body-secondary font-medium text-destructive hover:underline px-2 py-0.5 cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Dispatch remarks */}
            <div className="space-y-1.5">
              <label className="block type-label-field text-ink-strong">
                Dispatch remarks <span className="type-body-secondary font-normal text-ink-disabled">(optional)</span>
              </label>
              <Textarea
                value={dispatchRemarks}
                onChange={(e) => setDispatchRemarks(e.target.value)}
                placeholder="Additional dispatch instructions or notes..."
                maxLength={250}
                rows={2}
                className="rounded-control bg-surface border-input type-body text-ink resize-none"
              />
            </div>
          </div>
        </div>

        {/* Pinned #fafafa Footer Bar */}
        <div className="shrink-0 bg-page border-t border-topbar px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="type-caption text-ink-muted">
            Commissary stock deducts when you confirm dispatch.
          </p>
          <div className="flex items-center gap-2">
            <ModalCloseButton
              type="button"
              variant="outline"
              disabled={loading}
              fallbackOnClose={onClose}
              className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none transition-colors cursor-pointer"
            >
              Close
            </ModalCloseButton>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Confirm dispatch
            </Button>
          </div>
        </div>
      </form>

      {showConfirm && (
        <StockTransferConfirmModal
          open={showConfirm}
          title="Dispatch Stock Transfer"
          subtitle={`Request No: ${request?.requestNumber || transfer.requestNumber || transfer.transferNumber || `STR-${transfer.transferId}`}`}
          description={`Are you sure you want to record the actual dispatch of ${transfer.transferQuantity} units to ${request?.toLocationName || transfer.destLocationName}? Commissary stock will be deducted accordingly.`}
          confirmText={loading ? "Dispatching..." : "Confirm & Dispatch"}
          loading={loading}
          onCancel={() => {
            if (!loading) setShowConfirm(false);
          }}
          onConfirm={handleExecuteDispatch}
        />
      )}
    </ModalWrapper>
  );
}
