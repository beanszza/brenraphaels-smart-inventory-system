"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, MapPin, AlertCircle, Package, Truck, Phone, FileText, Upload, FileCheck, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { actionResponse } from "@/lib/resources/action-response";
import { scheduleTransfer } from "@/app/actions/stock-transfer/transfers";
import { StockTransferRequest, STRItem } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmedClose } from "@/components/shared/ModalCloseContext";

interface ScheduleTransferModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  request: StockTransferRequest | null;
}

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
    if (!plateNumber.trim()) {
      setFormError("Plate number is required.");
      return;
    }
    if (!driverFirstName.trim()) {
      setFormError("Driver first name is required.");
      return;
    }
    if (!driverLastName.trim()) {
      setFormError("Driver last name is required.");
      return;
    }
    if (!driverContact.trim()) {
      setFormError("Driver contact number is required.");
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
    <div className="font-sans fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 sm:p-6 animate-in fade-in duration-150">
      {confirmModal}
      <div
        style={{ width: "100%", maxWidth: "920px" }}
        className="w-full max-h-[92vh] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col text-foreground shrink-0 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Schedule Stock Transfer</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set the transportation arrangements and delivery schedule for the approved stock transfer.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handlePreSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Stock Transfer Information */}
          <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Stock Transfer Information</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
                REQUEST INFORMATION · READ-ONLY
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Request Number</span>
                <p className="text-sm font-semibold text-foreground mt-0.5">{request.requestNumber}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Destination Branch</span>
                <p className="text-sm font-semibold text-foreground mt-0.5">{request.toLocationName || "—"}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Required Date</span>
                <p className="text-sm font-semibold text-foreground mt-0.5">{formatDateDisplay(request.requiredDate)}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Priority</span>
                <p className="text-sm font-semibold text-foreground mt-0.5">{request.priority || "Medium"}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reason / Purpose</span>
                <p className="text-sm font-semibold text-foreground mt-0.5">{request.reason || "Branch Replenishment"}</p>
              </div>
            </div>
          </div>

          {/* Finished Products to Transfer */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Finished Products to Transfer</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
                PRODUCT DETAILS · READ-ONLY
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 px-4">Product & Variant</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Commissary Stock</th>
                    <th className="py-2.5 px-3">Expiry Date / Lot</th>
                    <th className="py-2.5 px-4 text-right">Requested Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(request.items || []).map((item, idx) => (
                    <tr key={item.requestItemId || idx} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {item.productName}
                        {item.variant ? <span className="block text-[11px] font-normal text-muted-foreground">{item.variant}</span> : null}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">{item.sku || "—"}</td>
                      <td className="py-3 px-3 font-medium text-foreground">
                        {item.availableQuantity ?? "—"}{" "}
                        <span className="text-[10px] text-muted-foreground font-normal">(In Stock)</span>
                      </td>
                      <td className="py-3 px-3">
                        {item.suggestedLots && item.suggestedLots.length > 0 ? (
                          <div className="space-y-1">
                            {item.suggestedLots.map((lot, lIdx) => (
                              <div key={lIdx} className="text-[11px]">
                                <span className="font-semibold text-foreground">{formatDateDisplay(lot.expiryDate)}</span>
                                <span className="ml-1.5 inline-block bg-muted px-1.5 py-0.2 rounded text-[10px] font-semibold">
                                  {lot.qty} pcs
                                </span>
                                <span className="block text-[10px] text-muted-foreground font-mono">Lot: {lot.lotCode}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-foreground text-sm">{item.requestedQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transportation Details */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Transportation Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Transport Provider */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Transport Provider <span className="text-destructive">*</span>
                </label>
                <Select value={transportProvider} onValueChange={setTransportProvider}>
                  <SelectTrigger className="h-10 rounded-xl bg-card border-border text-foreground">
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-foreground">
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
                <label className="text-xs font-semibold text-foreground">
                  Vehicle Type <span className="text-destructive">*</span>
                </label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger className="h-10 rounded-xl bg-card border-border text-foreground">
                    <SelectValue placeholder="Select Vehicle Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-foreground">
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
                <label className="text-xs font-semibold text-foreground">
                  Plate Number <span className="text-destructive">*</span>
                </label>
                <Input
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="Enter Plate Number"
                  className="h-10 rounded-xl bg-card border-border text-foreground text-xs"
                />
              </div>

              {/* Booking Reference */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Booking Reference <span className="text-[11px] text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Input
                  value={bookingReference}
                  onChange={(e) => setBookingReference(e.target.value)}
                  placeholder="Enter Booking Reference"
                  className="h-10 rounded-xl bg-card border-border text-foreground text-xs"
                />
              </div>
            </div>
          </div>

          {/* Driver & Delivery Information */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Driver & Delivery Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* First Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  First Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={driverFirstName}
                  onChange={(e) => setDriverFirstName(e.target.value)}
                  placeholder="Enter First Name"
                  className="h-10 rounded-xl bg-card border-border text-foreground text-xs"
                />
              </div>

              {/* Middle Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Middle Name <span className="text-[11px] text-muted-foreground font-normal">(Optional)</span>
                </label>
                <Input
                  value={driverMiddleName}
                  onChange={(e) => setDriverMiddleName(e.target.value)}
                  placeholder="Enter Middle Name"
                  className="h-10 rounded-xl bg-card border-border text-foreground text-xs"
                />
              </div>

              {/* Last Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={driverLastName}
                  onChange={(e) => setDriverLastName(e.target.value)}
                  placeholder="Enter Last Name"
                  className="h-10 rounded-xl bg-card border-border text-foreground text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Driver Contact Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Driver Contact Number <span className="text-destructive">*</span>
                </label>
                <Input
                  value={driverContact}
                  onChange={(e) => setDriverContact(e.target.value)}
                  placeholder="Enter Contact Number"
                  className="h-10 rounded-xl bg-card border-border text-foreground text-xs"
                />
              </div>

              {/* Transfer Fee */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Transfer Fee <span className="text-[11px] text-muted-foreground font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">₱</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferFee}
                    onChange={(e) => setTransferFee(e.target.value)}
                    placeholder="Enter Amount"
                    className="h-10 pl-7 rounded-xl bg-card border-border text-foreground text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Driver & Vehicle Photo / Attachment */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Driver & Vehicle Photo / Proof</h3>
              <span className="text-[10px] font-semibold text-muted-foreground">Optional</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Attach a photo of the driver's license, delivery vehicle, or courier booking confirmation.
            </p>
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAttachmentFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-muted-foreground" />
                Upload Photo / Document
              </button>
              {attachmentFile ? (
                <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-muted/40 px-3 py-2 rounded-xl border border-border">
                  <FileCheck className="w-4 h-4 text-emerald-500" />
                  <span className="truncate max-w-[240px]">{attachmentFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachmentFile(null)}
                    className="text-muted-foreground hover:text-destructive text-xs ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Accepted files: JPG, PNG, PDF</span>
              )}
            </div>
          </div>

          {/* Scheduling Remarks */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <h3 className="text-sm font-bold text-foreground">Scheduling Remarks</h3>
            <Textarea
              value={schedulingRemarks}
              onChange={(e) => setSchedulingRemarks(e.target.value)}
              placeholder="Enter additional scheduling instructions or remarks (Optional)..."
              rows={3}
              className="rounded-xl bg-card border-border text-foreground text-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={requestClose}
              disabled={loading}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-foreground text-background px-6 py-2.5 text-sm font-semibold hover:bg-foreground/85 transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Schedule
            </button>
          </div>
        </form>

        {/* Confirmation Modal Overlay */}
        {showConfirm && (
          <div
            className="font-sans fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => {
              if (!loading) setShowConfirm(false);
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              style={{ width: "100%", maxWidth: "440px" }}
              className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0 outline-none animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
                  <CheckCircle className="w-6 h-6" />
                </div>

                <h2 className="text-xl font-bold text-foreground mb-1">
                  Schedule Stock Transfer
                </h2>

                <p className="text-xs font-semibold text-muted-foreground mb-3 font-mono">
                  Request No: {request.requestNumber}
                </p>

                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Are you sure you want to schedule this transfer of <strong className="text-foreground">{totalRequestedQty} units</strong> to <strong className="text-foreground">{request.toLocationName}</strong> with driver <strong className="text-foreground">{fullDriverName}</strong> via <strong className="text-foreground">{transportProvider}</strong>?
                </p>

                <div className="flex justify-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    disabled={loading}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSchedule}
                    disabled={loading}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold text-background bg-foreground hover:bg-foreground/85 rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {loading ? "Scheduling..." : "Confirm & Schedule"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
