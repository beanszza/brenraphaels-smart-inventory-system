"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Clock, Upload, AlertCircle, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { actionResponse } from "@/lib/resources/action-response";
import { dispatchTransfer } from "@/app/actions/stock-transfer/dispatch";
import { uploadTransferAttachmentDirect } from "@/app/actions/stock-transfer/transfer-files";
import { StockTransfer, StockTransferRequest } from "./types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmedClose } from "@/components/shared/ModalCloseContext";
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

export function DispatchTransferModal({
  transfer,
  request,
  open,
  onClose,
  onSuccess,
}: DispatchTransferModalProps) {
  const staff = useOptionalStaff();
  const currentStaffName = staff?.name?.trim() || staff?.username?.trim() || "";

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form states
  const [actualDispatchDate, setActualDispatchDate] = useState<string>("");
  const [actualDispatchTime, setActualDispatchTime] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [proofBase64, setProofBase64] = useState<string>("");
  const [dispatchRemarks, setDispatchRemarks] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split("T")[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && transfer) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const now = new Date();
      const currentToday = now.toISOString().split("T")[0];
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${hours}:${minutes}`;

      setActualDispatchDate(currentToday);
      setActualDispatchTime(timeStr);
      setSelectedFile(null);
      setProofBase64("");
      setDispatchRemarks("");
      setError(null);
      setShowConfirm(false);

      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open, transfer, currentStaffName]);

  const { requestClose, confirmModal } = useConfirmedClose(onClose);

  if (!open || !mounted || !transfer) return null;

  // Extract scheduled information from transfer.notes or fields
  let scheduledInfo = {
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

  const formatDateDisplay = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US");
  };

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
    setProofBase64("");
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

  return createPortal(
    <div className="font-sans fixed inset-0 z-[200] flex items-center justify-center bg-backdrop p-4 sm:p-6 animate-in fade-in duration-150">
      {confirmModal}
      <div
        style={{ width: "100%", maxWidth: "960px" }}
        className="w-full max-h-[92vh] bg-surface rounded-panel shadow-2xl border border-divider overflow-hidden flex flex-col text-text-primary shrink-0 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-divider px-6 py-5">
          <div>
            <h2 className="type-modal-title text-text-primary">Dispatch Stock Transfer</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Confirm the actual release of products from the commissary. Review the original stock transfer request and scheduled transportation details before recording the dispatch.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-control p-2 text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handlePreSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-control border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Stock Transfer Information */}
          <div className="rounded-panel border border-divider bg-muted/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="type-card-title text-text-primary">Stock Transfer Information</h3>
              <span className="type-overline font-semibold uppercase tracking-wider text-text-muted bg-surface-hover px-2.5 py-1 rounded-full">
                REQUEST INFORMATION · READ-ONLY
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Request Number</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">
                  {request?.requestNumber || transfer.requestNumber || transfer.transferNumber}
                </p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Destination Branch</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">
                  {request?.toLocationName || transfer.destLocationName || "—"}
                </p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Required Date</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">
                  {formatDateDisplay(request?.requiredDate || transfer.scheduledDate || transfer.transferDate)}
                </p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Priority</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">
                  {request?.priority || transfer.priority || "Medium"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Reason / Purpose</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">
                  {request?.reason || "Branch Replenishment"}
                </p>
              </div>
            </div>
          </div>

          {/* Finished Products to Transfer */}
          <div className="rounded-panel border border-divider bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="type-card-title text-text-primary">Finished Products to Transfer</h3>
              <span className="type-overline font-semibold uppercase tracking-wider text-text-muted bg-surface-hover px-2.5 py-1 rounded-full">
                PRODUCT DETAILS · READ-ONLY
              </span>
            </div>
            <div className="overflow-x-auto rounded-control border border-divider">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-hover border-b border-divider type-table-header font-semibold text-text-muted uppercase tracking-wider">
                    <th className="py-2.5 px-4">Product & Variant</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Commissary Stock</th>
                    <th className="py-2.5 px-3">Expiry Date / Lot</th>
                    <th className="py-2.5 px-4 text-right">Requested Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayItems.map((item, idx) => (
                    <tr key={item.requestItemId || idx} className="hover:bg-surface-hover/10 transition-colors">
                      <td className="py-3 px-4 font-semibold text-text-primary">
                        {item.productName}
                        {item.variant ? <span className="block type-caption font-normal text-text-muted">{item.variant}</span> : null}
                      </td>
                      <td className="py-3 px-3 font-mono type-caption text-text-muted">{item.sku || "—"}</td>
                      <td className="py-3 px-3 font-medium text-text-primary">
                        {item.availableQuantity ?? "—"}{" "}
                        <span className="type-caption text-text-muted font-normal">(In Stock)</span>
                      </td>
                      <td className="py-3 px-3">
                        {item.suggestedLots && item.suggestedLots.length > 0 ? (
                          <div className="space-y-1">
                            {item.suggestedLots.map((lot, lIdx) => (
                              <div key={lIdx} className="type-caption">
                                <span className="font-semibold text-text-primary">{formatDateDisplay(lot.expiryDate)}</span>
                                <span className="block type-caption text-text-muted font-mono">Lot: {lot.lotCode}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-text-primary type-table-cell">{item.requestedQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transportation Details */}
          <div className="rounded-panel border border-divider bg-muted/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="type-card-title text-text-primary">Transportation Details</h3>
              <span className="type-overline font-semibold uppercase tracking-wider text-text-muted bg-surface-hover px-2.5 py-1 rounded-full">
                SCHEDULED INFORMATION · READ-ONLY
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Transport Provider</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{scheduledInfo.transportProvider}</p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Vehicle Type</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{scheduledInfo.vehicleType}</p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Plate Number</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{scheduledInfo.plateNumber}</p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Booking Reference</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{scheduledInfo.bookingReference}</p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Transfer Fee</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{scheduledInfo.transferFee}</p>
              </div>
            </div>
          </div>

          {/* Driver Information */}
          <div className="rounded-panel border border-divider bg-muted/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="type-card-title text-text-primary">Driver Information</h3>
              <span className="type-overline font-semibold uppercase tracking-wider text-text-muted bg-surface-hover px-2.5 py-1 rounded-full">
                SCHEDULED INFORMATION · READ-ONLY
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Driver Name</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{scheduledInfo.driverName}</p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Driver Contact Number</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{scheduledInfo.driverContact}</p>
              </div>
            </div>
          </div>

          {/* Dispatch Details */}
          <div className="rounded-panel border border-divider bg-surface p-5 space-y-4">
            <h3 className="type-card-title text-text-primary">Dispatch Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Actual Dispatch Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Actual Dispatch Date <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    min={todayStr}
                    max={maxDateStr}
                    value={actualDispatchDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full h-10 rounded-control border border-divider bg-surface px-3.5 pr-10 text-xs text-text-primary cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                </div>
              </div>

              {/* Actual Dispatch Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Actual Dispatch Time <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="time"
                    value={actualDispatchTime}
                    onChange={(e) => {
                      setActualDispatchTime(e.target.value);
                      setError(null);
                    }}
                    className="w-full h-10 rounded-control border border-divider bg-surface px-3.5 pr-10 text-xs text-text-primary cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Clock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                </div>
              </div>

              {/* Released By (Locked to Current Account User) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Released By <span className="text-destructive">*</span>
                </label>
                <Input
                  readOnly
                  disabled
                  value={currentStaffName}
                  className="h-10 rounded-control bg-surface-hover border-divider text-text-primary font-medium text-xs cursor-not-allowed select-none disabled:opacity-100"
                />
              </div>
            </div>
          </div>

          {/* Dispatch Documents */}
          <div className="rounded-panel border border-divider bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="type-card-title text-text-primary">
                Dispatch Documents <span className="text-destructive">*</span>
              </h3>
            </div>
            <p className="text-xs text-text-muted">
              Upload delivery receipts, loading photos, or signed dispatch documents.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-divider hover:border-foreground/40 rounded-panel p-7 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-hover/20 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2.5 text-text-muted group-hover:text-text-primary group-hover:scale-105 transition-all">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-text-primary">
                Click to upload dispatch documents or proof photo
              </p>
              <p className="type-caption text-text-muted mt-0.5">
                JPG, PNG, PDF up to 8MB
              </p>
            </div>
            {selectedFile && (
              <div className="flex items-center justify-between p-3.5 rounded-control border border-divider bg-surface">
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-xs font-semibold text-text-primary truncate max-w-[280px]">
                      {selectedFile.name}
                    </p>
                    <p className="type-caption text-text-muted">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setProofBase64("");
                  }}
                  className="text-xs text-text-muted hover:text-destructive px-2 py-1 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Dispatch Remarks */}
          <div className="rounded-panel border border-divider bg-surface p-5 space-y-2">
            <h3 className="type-card-title text-text-primary">Dispatch Remarks</h3>
            <Textarea
              value={dispatchRemarks}
              onChange={(e) => setDispatchRemarks(e.target.value)}
              placeholder="Enter additional dispatch instructions or remarks (Optional)..."
              maxLength={250}
              rows={3}
              className="rounded-control bg-surface border-divider text-text-primary text-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-divider">
            <button
              type="button"
              onClick={requestClose}
              disabled={loading}
              className="rounded-control border border-divider bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-control bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Dispatch
            </button>
          </div>
        </form>

        {/* Confirmation Modal Overlay */}
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
      </div>
    </div>,
    document.body
  );
}
