"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, Upload, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { actionResponse } from "@/lib/resources/action-response";
import { scheduleTransfer } from "@/app/actions/stock-transfer/transfers";
import { uploadTransferAttachmentDirect } from "@/app/actions/stock-transfer/transfer-files";
import { StockTransferRequest } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransferConfirmModal } from "./StockTransferConfirmModal";

interface ScheduleTransferModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  request: StockTransferRequest | null;
}

const ALLOWED_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-.]+$/;
const PLATE_PATTERN = /^[A-Za-z0-9\s\-]{1,10}$/;
const BOOKING_REF_PATTERN = /^[A-Za-z0-9\-]{1,40}$/;
const CONTACT_PATTERN = /^09\d{9}$/;

const TRANSPORT_PROVIDERS = [
  "Company-owned Vehicle",
  "Company Logistics Fleet / Delivery Van",
  "Company Truck",
  "Lalamove Philippines",
  "GrabExpress",
  "J&T Express Philippines",
  "Ninja Van Philippines",
  "2GO Express",
  "LBC Express",
  "Flash Express",
  "Other Third-party Provider",
];

const VEHICLE_TYPES = [
  "Motorcycle",
  "Sedan",
  "MPV",
  "Van",
  "Pickup Truck",
  "Closed Van",
  "6-Wheeler Truck",
  "10-Wheeler Truck",
];

function formatDateDisplay(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ScheduleTransferModal({
  open,
  onClose,
  onSuccess,
  request,
}: ScheduleTransferModalProps) {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form State
  const [transportProvider, setTransportProvider] = useState<string>("Company-owned Vehicle");
  const [vehicleType, setVehicleType] = useState<string>("Van");
  const [plateNumber, setPlateNumber] = useState<string>("");
  const [bookingReference, setBookingReference] = useState<string>("");

  // Driver Information breakdown
  const [driverFirstName, setDriverFirstName] = useState<string>("");
  const [driverMiddleName, setDriverMiddleName] = useState<string>("");
  const [driverLastName, setDriverLastName] = useState<string>("");
  const [driverContact, setDriverContact] = useState<string>("");
  const [transferFee, setTransferFee] = useState<string>("");

  // Document attachment
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [schedulingRemarks, setSchedulingRemarks] = useState<string>("");

  useEffect(() => {
    if (open && request) {
      setTransportProvider("Company-owned Vehicle");
      setVehicleType("Van");
      setPlateNumber("");
      setBookingReference("");
      setDriverFirstName("");
      setDriverMiddleName("");
      setDriverLastName("");
      setDriverContact("");
      setTransferFee("");
      setAttachmentFile(null);
      setSchedulingRemarks("");
      setFormError(null);
      setShowConfirm(false);
    }
  }, [open, request]);

  if (!open || !request) return null;

  const fullDriverName = [driverFirstName.trim(), driverMiddleName.trim(), driverLastName.trim()]
    .filter(Boolean)
    .join(" ");

  const sanitizeNameInput = (val: string) => val.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'\-.]/g, "");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const validExt = ALLOWED_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!validExt) {
      setFormError("Invalid file format. Please upload a JPG, PNG, or PDF file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFormError("File size exceeds the 8MB limit.");
      e.target.value = "";
      return;
    }
    setAttachmentFile(file);
    setFormError(null);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !request) return;
    setFormError(null);

    if (!transportProvider) {
      setFormError("Please select a transport provider.");
      return;
    }
    if (!vehicleType) {
      setFormError("Please select a vehicle type.");
      return;
    }
    const trimmedPlate = plateNumber.trim();
    if (!trimmedPlate) {
      setFormError("Plate number is required.");
      return;
    }
    if (!PLATE_PATTERN.test(trimmedPlate)) {
      setFormError("Plate number must contain only letters, numbers, spaces, or dashes (max 10 characters).");
      return;
    }
    const trimmedBooking = bookingReference.trim();
    if (trimmedBooking && !BOOKING_REF_PATTERN.test(trimmedBooking)) {
      setFormError("Booking reference must contain only letters, numbers, or dashes.");
      return;
    }
    const trimmedFirst = driverFirstName.trim();
    if (!trimmedFirst) {
      setFormError("Driver first name is required.");
      return;
    }
    if (!NAME_PATTERN.test(trimmedFirst)) {
      setFormError("Driver first name must contain only letters and valid name characters (no numbers).");
      return;
    }
    const trimmedMiddle = driverMiddleName.trim();
    if (trimmedMiddle && !NAME_PATTERN.test(trimmedMiddle)) {
      setFormError("Driver middle name must contain only letters and valid name characters (no numbers).");
      return;
    }
    const trimmedLast = driverLastName.trim();
    if (!trimmedLast) {
      setFormError("Driver last name is required.");
      return;
    }
    if (!NAME_PATTERN.test(trimmedLast)) {
      setFormError("Driver last name must contain only letters and valid name characters (no numbers).");
      return;
    }
    const trimmedContact = driverContact.trim();
    if (!trimmedContact) {
      setFormError("Driver contact number is required.");
      return;
    }
    if (!CONTACT_PATTERN.test(trimmedContact)) {
      setFormError("Driver contact number must be a valid 11-digit PH mobile number starting with 09 (e.g., 09123456789).");
      return;
    }
    if (transferFee.trim() !== "") {
      const feeNum = Number(transferFee);
      if (isNaN(feeNum) || feeNum < 0 || !/^\d+(\.\d{1,2})?$/.test(transferFee.trim())) {
        setFormError("Transfer fee must be a valid non-negative amount (up to 2 decimal places).");
        return;
      }
    }
    if (!attachmentFile) {
      setFormError("Proof of Booking / Transaction Receipt is required.");
      return;
    }

    setShowConfirm(true);
  };

  const handleExecuteSchedule = async () => {
    if (loading || !request) return;
    setLoading(true);
    setFormError(null);

    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const scheduledDate = request.requiredDate ? request.requiredDate.split("T")[0] : todayStr;

      const itemsToSchedule = request.items && request.items.length > 0 ? request.items : [];
      if (itemsToSchedule.length === 0) {
        throw new Error("No products found in this request to schedule.");
      }

      let uploadedFileId: string | null = null;
      if (attachmentFile) {
        const fd = new FormData();
        fd.append("file", attachmentFile);
        const upRes = await uploadTransferAttachmentDirect(fd);
        if (!upRes.success || !upRes.data?.fileId) {
          setFormError(upRes.message || "Failed to upload transfer attachment to file storage.");
          setLoading(false);
          setShowConfirm(false);
          return;
        }
        uploadedFileId = upRes.data.fileId;
      }

      const scheduleMetadata = {
        transportProvider,
        vehicleType,
        plateNumber: plateNumber.trim(),
        bookingReference: bookingReference.trim() || null,
        driverFirstName: driverFirstName.trim(),
        driverMiddleName: driverMiddleName.trim() || null,
        driverLastName: driverLastName.trim(),
        driverName: fullDriverName,
        driverContact: driverContact.trim(),
        transferFee: transferFee ? Number(transferFee) : null,
        attachmentName: attachmentFile?.name || null,
        attachmentFileId: uploadedFileId,
        attachmentData: uploadedFileId,
        remarks: schedulingRemarks.trim() || null,
      };

      let scheduledCount = 0;
      let lastErrorMessage = "";

      for (const item of itemsToSchedule) {
        const alreadyScheduled = request.transfers
          ?.filter((t) => t.productId === item.productId && t.status !== "Cancelled")
          .reduce((sum, t) => sum + Number(t.transferQuantity), 0) || 0;
        const remQty = Math.max(0, item.requestedQuantity - alreadyScheduled);
        const qtyToSchedule = remQty > 0 ? remQty : item.requestedQuantity;

        const res = await actionResponse(
          scheduleTransfer({
            requestId: request.requestId,
            productId: item.productId,
            transferQuantity: qtyToSchedule,
            scheduledDate,
            courierName: transportProvider,
            driverName: fullDriverName,
            vehiclePlate: plateNumber.trim(),
            proofOfReceipt: uploadedFileId,
            notes: JSON.stringify(scheduleMetadata),
          })
        );

        if (res.data?.success) {
          scheduledCount++;
        } else if (res.data?.message) {
          lastErrorMessage = res.data.message;
        }
      }

      if (scheduledCount > 0) {
        toast.success("Stock transfer scheduled successfully.");
        setShowConfirm(false);
        onSuccess();
        onClose();
      } else {
        setFormError(lastErrorMessage || "Failed to schedule stock transfer.");
        setShowConfirm(false);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to schedule stock transfer.");
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const totalRequestedQty = (request.items || []).reduce((sum, i) => sum + Number(i.requestedQuantity || 0), 0);

  return (
    <ModalWrapper
      open={open}
      title="Schedule stock transfer"
      titleBadge={<StatusBadge status="Approved" />}
      subtitle={`${request.requestNumber} · to ${request.toLocationName || "—"} · required ${formatDateDisplay(request.requiredDate)}`}
      onClose={() => { if (!loading) onClose(); }}
      maxWidthPx={900}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <form onSubmit={handlePreSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden text-ink">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {formError && (
            <div className="rounded-control border border-notice-danger-border bg-notice-danger-bg px-3.5 py-2.5 type-body-secondary text-notice-danger-text flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
              <span role="alert">{formError}</span>
            </div>
          )}

          {/* Section 1: Finished products to transfer */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
            <div className="space-y-0.5">
              <h3 className="type-subsection text-ink">
                Finished products to transfer ({request.items?.length || 0})
              </h3>
              <p className="type-caption text-ink-muted">
                Approved items and assigned FEFO lots for this transfer.
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
                  {(request.items || []).map((item, idx) => (
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

          {/* Section 2: Transportation & driver (2-column clean inputs) */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            <div className="space-y-0.5">
              <h3 className="type-subsection text-ink">Transportation &amp; driver</h3>
              <p className="type-caption text-ink-muted">
                Log the courier, vehicle, and assigned driver details.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-4">
              {/* Transport provider */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Transport provider <span className="text-destructive">*</span>
                </label>
                <Select value={transportProvider} onValueChange={setTransportProvider}>
                  <SelectTrigger className="w-full h-10 px-3 rounded-control bg-surface border-input type-body text-ink">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border text-ink">
                    {TRANSPORT_PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider} className="type-body">
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vehicle type */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Vehicle type <span className="text-destructive">*</span>
                </label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger className="w-full h-10 px-3 rounded-control bg-surface border-input type-body text-ink">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border text-ink">
                    {VEHICLE_TYPES.map((vType) => (
                      <SelectItem key={vType} value={vType} className="type-body">
                        {vType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Plate number */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Plate number <span className="text-destructive">*</span>
                </label>
                <Input
                  value={plateNumber}
                  maxLength={10}
                  onChange={(e) => {
                    setPlateNumber(e.target.value.replace(/[^A-Za-z0-9\s\-]/g, "").slice(0, 10));
                    setFormError(null);
                  }}
                  placeholder="Enter plate number"
                  className="h-10 px-3 rounded-control bg-surface border-input type-body text-ink"
                />
              </div>

              {/* Booking reference */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Booking reference <span className="type-body-secondary font-normal text-ink-disabled">(optional)</span>
                </label>
                <Input
                  value={bookingReference}
                  maxLength={40}
                  onChange={(e) => {
                    setBookingReference(e.target.value.replace(/[^A-Za-z0-9\-]/g, "").slice(0, 40));
                    setFormError(null);
                  }}
                  placeholder="Enter booking reference"
                  className="h-10 px-3 rounded-control bg-surface border-input type-body text-ink"
                />
              </div>

              {/* Driver first name */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Driver first name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={driverFirstName}
                  maxLength={50}
                  onChange={(e) => {
                    setDriverFirstName(sanitizeNameInput(e.target.value));
                    setFormError(null);
                  }}
                  placeholder="Enter first name"
                  className="h-10 px-3 rounded-control bg-surface border-input type-body text-ink"
                />
              </div>

              {/* Driver last name */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Driver last name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={driverLastName}
                  maxLength={50}
                  onChange={(e) => {
                    setDriverLastName(sanitizeNameInput(e.target.value));
                    setFormError(null);
                  }}
                  placeholder="Enter last name"
                  className="h-10 px-3 rounded-control bg-surface border-input type-body text-ink"
                />
              </div>

              {/* Driver middle name */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Driver middle name <span className="type-body-secondary font-normal text-ink-disabled">(optional)</span>
                </label>
                <Input
                  value={driverMiddleName}
                  maxLength={50}
                  onChange={(e) => {
                    setDriverMiddleName(sanitizeNameInput(e.target.value));
                    setFormError(null);
                  }}
                  placeholder="Enter middle name"
                  className="h-10 px-3 rounded-control bg-surface border-input type-body text-ink"
                />
              </div>

              {/* Driver contact number */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Driver contact number <span className="text-destructive">*</span>
                </label>
                <Input
                  inputMode="numeric"
                  maxLength={11}
                  value={driverContact}
                  onChange={(e) => {
                    setDriverContact(e.target.value.replace(/\D/g, "").slice(0, 11));
                    setFormError(null);
                  }}
                  placeholder="09XXXXXXXXX"
                  className="h-10 px-3 rounded-control bg-surface border-input type-body text-ink"
                />
              </div>

              {/* Transfer fee */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Transfer fee <span className="type-body-secondary font-normal text-ink-disabled">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 type-body text-ink-muted">₱</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferFee}
                    onChange={(e) => {
                      setTransferFee(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="0.00"
                    className="h-10 pl-7 pr-3 rounded-control bg-surface border-input type-body text-ink"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Proof & remarks */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            <div className="space-y-0.5">
              <h3 className="type-subsection text-ink">Proof &amp; remarks</h3>
              <p className="type-caption text-ink-muted">
                Attach booking confirmation and any scheduling instructions.
              </p>
            </div>

            <div className="space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
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
                    Proof of booking / transaction receipt <span className="text-destructive">*</span>
                  </p>
                  <p className="type-caption text-ink-muted">
                    Lalamove/Grab screenshot or delivery receipt · JPG, PNG, PDF up to 8MB
                  </p>
                </div>
              </div>

              {attachmentFile && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-control border border-border bg-page">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCheck className="w-4 h-4 text-status-green-fg shrink-0" />
                    <span className="type-body-secondary text-ink truncate">
                      {attachmentFile.name} · {(attachmentFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttachmentFile(null);
                    }}
                    className="type-body-secondary font-medium text-destructive hover:underline px-2 py-0.5 cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block type-label-field text-ink-strong">
                Scheduling remarks <span className="type-body-secondary font-normal text-ink-disabled">(optional)</span>
              </label>
              <Textarea
                value={schedulingRemarks}
                onChange={(e) => setSchedulingRemarks(e.target.value)}
                placeholder="Additional scheduling instructions or notes..."
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
            Scheduling marks this request as Scheduled.
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
              Confirm schedule
            </Button>
          </div>
        </div>
      </form>

      {showConfirm && (
        <StockTransferConfirmModal
          open={showConfirm}
          title="Schedule Stock Transfer"
          subtitle={`Request No: ${request.requestNumber}`}
          description={`Are you sure you want to schedule this transfer of ${totalRequestedQty} units to ${request.toLocationName} with driver ${fullDriverName} via ${transportProvider}?`}
          confirmText={loading ? "Scheduling..." : "Confirm & Schedule"}
          loading={loading}
          onCancel={() => {
            if (!loading) setShowConfirm(false);
          }}
          onConfirm={handleExecuteSchedule}
        />
      )}
    </ModalWrapper>
  );
}
