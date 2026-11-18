"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, Upload, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { actionResponse } from "@/lib/resources/action-response";
import { scheduleTransfer } from "@/app/actions/stock-transfer/transfers";
import { uploadTransferAttachmentDirect } from "@/app/actions/stock-transfer/transfer-files";
import { StockTransferRequest } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmedClose } from "@/components/shared/ModalCloseContext";
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

export function ScheduleTransferModal({
  open,
  onClose,
  onSuccess,
  request,
}: ScheduleTransferModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form State
  const [transportProvider, setTransportProvider] = useState<string>("");
  const [vehicleType, setVehicleType] = useState<string>("");
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
  const [attachmentBase64, setAttachmentBase64] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [schedulingRemarks, setSchedulingRemarks] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && request) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Reset form fields
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
      setAttachmentBase64("");
      setSchedulingRemarks("");
      setFormError(null);
      setShowConfirm(false);

      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open, request]);

  const { requestClose, confirmModal } = useConfirmedClose(onClose);

  if (!open || !mounted || !request) return null;

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
    setAttachmentBase64("");
    setFormError(null);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !request) return;
    setFormError(null);

    // Validations
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

  const formatDateDisplay = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US");
  };

  const totalRequestedQty = (request.items || []).reduce((sum, i) => sum + Number(i.requestedQuantity || 0), 0);

  return createPortal(
    <div className="font-sans fixed inset-0 z-[200] flex items-center justify-center bg-backdrop p-4 sm:p-6 animate-in fade-in duration-150">
      {confirmModal}
      <div
        style={{ width: "100%", maxWidth: "920px" }}
        className="w-full max-h-[92vh] bg-surface rounded-panel shadow-2xl border border-divider overflow-hidden flex flex-col text-text-primary shrink-0 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-divider px-6 py-5">
          <div>
            <h2 className="type-modal-title text-text-primary">Schedule Stock Transfer</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Set the transportation arrangements and delivery schedule for the approved stock transfer.
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

        {/* Form Body */}
        <form onSubmit={handlePreSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="rounded-control border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
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
                <p className="text-sm font-semibold text-text-primary mt-0.5">{request.requestNumber}</p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Destination Branch</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{request.toLocationName || "—"}</p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Required Date</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{formatDateDisplay(request.requiredDate)}</p>
              </div>
              <div>
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Priority</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{request.priority || "Medium"}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="type-overline font-semibold uppercase tracking-wider text-text-muted">Reason / Purpose</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{request.reason || "Branch Replenishment"}</p>
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
                  {(request.items || []).map((item, idx) => (
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
          <div className="rounded-panel border border-divider bg-surface p-5 space-y-4">
            <h3 className="type-card-title text-text-primary">Transportation Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Transport Provider */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Transport Provider <span className="text-destructive">*</span>
                </label>
                <Select value={transportProvider} onValueChange={setTransportProvider}>
                  <SelectTrigger className="h-10 rounded-control bg-surface border-divider text-text-primary">
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-divider text-text-primary">
                    {TRANSPORT_PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vehicle Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Vehicle Type <span className="text-destructive">*</span>
                </label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger className="h-10 rounded-control bg-surface border-divider text-text-primary">
                    <SelectValue placeholder="Select Vehicle Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-divider text-text-primary">
                    {VEHICLE_TYPES.map((vType) => (
                      <SelectItem key={vType} value={vType}>
                        {vType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Plate Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Plate Number <span className="text-destructive">*</span>
                </label>
                <Input
                  value={plateNumber}
                  maxLength={10}
                  onChange={(e) => {
                    setPlateNumber(e.target.value.replace(/[^A-Za-z0-9\s\-]/g, "").slice(0, 10));
                    setFormError(null);
                  }}
                  placeholder="Enter Plate Number"
                  className="h-10 rounded-control bg-surface border-divider text-text-primary text-xs"
                />
              </div>

              {/* Booking Reference */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Booking Reference <span className="type-caption text-text-muted font-normal">(Optional)</span>
                </label>
                <Input
                  value={bookingReference}
                  maxLength={40}
                  onChange={(e) => {
                    setBookingReference(e.target.value.replace(/[^A-Za-z0-9\-]/g, "").slice(0, 40));
                    setFormError(null);
                  }}
                  placeholder="Enter Booking Reference"
                  className="h-10 rounded-control bg-surface border-divider text-text-primary text-xs"
                />
              </div>
            </div>
          </div>

          {/* Driver & Delivery Information */}
          <div className="rounded-panel border border-divider bg-surface p-5 space-y-4">
            <h3 className="type-card-title text-text-primary">Driver & Delivery Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* First Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  First Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={driverFirstName}
                  maxLength={50}
                  onChange={(e) => {
                    setDriverFirstName(sanitizeNameInput(e.target.value));
                    setFormError(null);
                  }}
                  placeholder="Enter First Name"
                  className="h-10 rounded-control bg-surface border-divider text-text-primary text-xs"
                />
              </div>

              {/* Middle Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Middle Name <span className="type-caption text-text-muted font-normal">(Optional)</span>
                </label>
                <Input
                  value={driverMiddleName}
                  maxLength={50}
                  onChange={(e) => {
                    setDriverMiddleName(sanitizeNameInput(e.target.value));
                    setFormError(null);
                  }}
                  placeholder="Enter Middle Name"
                  className="h-10 rounded-control bg-surface border-divider text-text-primary text-xs"
                />
              </div>

              {/* Last Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={driverLastName}
                  maxLength={50}
                  onChange={(e) => {
                    setDriverLastName(sanitizeNameInput(e.target.value));
                    setFormError(null);
                  }}
                  placeholder="Enter Last Name"
                  className="h-10 rounded-control bg-surface border-divider text-text-primary text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Driver Contact Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Driver Contact Number <span className="text-destructive">*</span>
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
                  className="h-10 rounded-control bg-surface border-divider text-text-primary text-xs"
                />
              </div>

              {/* Transfer Fee */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Transfer Fee <span className="type-caption text-text-muted font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-text-muted font-semibold">₱</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferFee}
                    onChange={(e) => {
                      setTransferFee(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Enter Amount"
                    className="h-10 pl-7 rounded-control bg-surface border-divider text-text-primary text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Proof of Booking / Transaction Receipt */}
          <div className="rounded-panel border border-divider bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="type-card-title text-text-primary">
                Proof of Booking / Transaction Receipt <span className="text-destructive">*</span>
              </h3>
            </div>
            <p className="text-xs text-text-muted">
              Attach an image proof of receipt, Lalamove/Grab booking screenshot, or delivery transaction document.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
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
                Click to upload receipt or proof photo
              </p>
              <p className="type-caption text-text-muted mt-0.5">
                JPG, PNG, PDF up to 8MB
              </p>
            </div>
            {attachmentFile && (
              <div className="flex items-center justify-between p-3.5 rounded-control border border-divider bg-surface">
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-xs font-semibold text-text-primary truncate max-w-[280px]">
                      {attachmentFile.name}
                    </p>
                    <p className="type-caption text-text-muted">
                      {(attachmentFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachmentFile(null);
                    setAttachmentBase64("");
                  }}
                  className="text-xs text-text-muted hover:text-destructive px-2 py-1 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Scheduling Remarks */}
          <div className="rounded-panel border border-divider bg-surface p-5 space-y-2">
            <h3 className="type-card-title text-text-primary">Scheduling Remarks</h3>
            <Textarea
              value={schedulingRemarks}
              onChange={(e) => setSchedulingRemarks(e.target.value)}
              placeholder="Enter additional scheduling instructions or remarks (Optional)..."
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
              Confirm Schedule
            </button>
          </div>
        </form>

        {/* Confirmation Modal Overlay */}
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
      </div>
    </div>,
    document.body
  );
}
