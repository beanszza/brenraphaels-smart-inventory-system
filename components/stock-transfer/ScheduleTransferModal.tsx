"use client";
import { stockTransfer } from "@/lib/stock-transfer/client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Truck, AlertCircle, Package } from "lucide-react";
import { StockTransferRequest, STRItem } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ScheduleTransferModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  request: StockTransferRequest | null;
}

const COURIER_OPTIONS = [
  "Lalamove",
  "Transportify",
  "Grab Express",
  "Ninja Van",
  "J&T Express",
  "In-House Fleet / Driver",
  "Branch Pickup",
  "Other Third-Party",
];

export function ScheduleTransferModal({
  open,
  onClose,
  onSuccess,
  request,
}: ScheduleTransferModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Selected Product within the request (if multiple items)
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [transferQuantity, setTransferQuantity] = useState<number | "">("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [courierName, setCourierName] = useState<string>("Lalamove");
  const [driverName, setDriverName] = useState<string>("");
  const [vehiclePlate, setVehiclePlate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && request) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Prefill product and quantity
      if (request.items && request.items.length > 0) {
        const first = request.items[0];
        setSelectedProductId(String(first.productId));
        setTransferQuantity(first.requestedQuantity);
      }
      setScheduledDate(new Date().toISOString().split("T")[0]);
      setCourierName("Lalamove");
      setDriverName("");
      setVehiclePlate("");
      setNotes("");
      setFormError(null);

      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open, request]);

  if (!open || !mounted || !request) return null;

  const selectedItem: STRItem | undefined = request.items?.find(
    (i) => String(i.productId) === selectedProductId
  );

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const itm = request.items.find((i) => String(i.productId) === prodId);
    if (itm) {
      setTransferQuantity(itm.requestedQuantity);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProductId) {
      setFormError("Please select the product to transfer.");
      return;
    }
    if (typeof transferQuantity !== "number" || transferQuantity <= 0) {
      setFormError("Transfer quantity must be greater than zero.");
      return;
    }
    if (!scheduledDate) {
      setFormError("Please select a scheduled transfer date.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        requestId: request.requestId,
        productId: parseInt(selectedProductId, 10),
        transferQuantity: Number(transferQuantity),
        scheduledDate,
        courierName: courierName || null,
        driverName: driverName.trim() || null,
        vehiclePlate: vehiclePlate.trim() || null,
        notes: notes.trim() || null,
      };

      const res = await stockTransfer.scheduleTransfer(payload);
      if (res.data?.success) {
        onSuccess();
        onClose();
      } else {
        setFormError(res.data?.message || "Failed to schedule transfer.");
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || "Failed to schedule transfer.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: "780px" }}
        className="w-full max-h-[92vh] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Schedule Formal Stock Transfer
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assign dispatch logistics and schedule transfer for Request {request.requestNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Request Context Banner (Automatic link, not dropdown!) */}
          <div className="rounded-2xl border border-border bg-muted/20 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Originating Request
              </span>
              <div className="text-base font-mono font-bold text-foreground mt-0.5">
                {request.requestNumber}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Destination: <strong className="text-foreground">{request.toLocationName}</strong>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Transfer Record
              </span>
              <div className="text-sm font-mono font-semibold text-foreground mt-0.5">
                STF-YYYY-XXXX (Auto-assigned)
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Priority: <span className="font-semibold text-foreground">{request.priority}</span>
              </div>
            </div>
          </div>

          {/* Product & Variant Highlight */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                Product & Variant to Schedule
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Product selector if request has multiple items */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Finished Product <span className="text-destructive">*</span>
                </label>
                {request.items && request.items.length > 1 ? (
                  <Select value={selectedProductId} onValueChange={handleProductChange}>
                    <SelectTrigger className="h-10 rounded-xl border border-border bg-card text-xs font-medium text-foreground">
                      <SelectValue placeholder="Select Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {request.items.map((i) => (
                        <SelectItem key={i.productId} value={String(i.productId)}>
                          {i.productName} ({i.variant || "Standard"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-10 px-3.5 flex items-center rounded-xl border border-border bg-muted/40 text-xs font-semibold text-foreground">
                    {selectedItem?.productName || "Product"}
                  </div>
                )}
              </div>

              {/* Variant Display */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Product Variant
                </label>
                <div className="h-10 px-3.5 flex items-center justify-between rounded-xl border border-border bg-muted/40 text-xs">
                  <span className="font-bold text-foreground">
                    {selectedItem?.variant || "Standard"}
                  </span>
                  <span className="font-mono text-muted-foreground text-[11px]">
                    SKU: {selectedItem?.sku || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Transfer Quantity */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Transfer Quantity <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={transferQuantity}
                  onChange={(e) =>
                    setTransferQuantity(e.target.value === "" ? "" : parseFloat(e.target.value))
                  }
                  className="h-10 rounded-xl border border-border bg-card text-xs text-foreground font-semibold"
                />
              </div>

              {/* Scheduled Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Scheduled Transfer Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card text-xs text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Logistics & Courier Section with DROPDOWN */}
          <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-muted-foreground" />
              Logistics & Courier Assignment
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Courier Company Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Courier Partner <span className="text-destructive">*</span>
                </label>
                <Select value={courierName} onValueChange={setCourierName}>
                  <SelectTrigger className="h-10 rounded-xl border border-border bg-card text-xs font-medium text-foreground">
                    <SelectValue placeholder="Select Courier Partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURIER_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Driver Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Driver Name (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Juan dela Cruz"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card text-xs text-foreground"
                />
              </div>

              {/* Vehicle Plate */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Vehicle Plate (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. NBD-9021"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card text-xs text-foreground font-mono"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Transfer Notes / Instructions
            </label>
            <Textarea
              rows={2}
              placeholder="e.g. Handle with care, keep frozen during transit, deliver before 11 AM..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs resize-none bg-background border-border rounded-xl p-3"
            />
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Scheduling..." : "Confirm & Schedule Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
