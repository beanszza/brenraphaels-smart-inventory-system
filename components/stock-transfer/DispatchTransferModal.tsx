"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Truck, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { StockTransfer } from "./types";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DispatchTransferModalProps {
  transfer: StockTransfer | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

export function DispatchTransferModal({
  transfer,
  open,
  onClose,
  onSuccess,
}: DispatchTransferModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [courierName, setCourierName] = useState("Lalamove");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && transfer) {
      setDriverName(transfer.driverName || "");
      setVehiclePlate(transfer.vehiclePlate || "");
      setCourierName(transfer.courierName || "Lalamove");
      setNotes("");
      setError(null);
    }
  }, [open, transfer]);

  if (!open || !mounted || !transfer) return null;

  const handleDispatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.put(`/api/stock-transfers/${transfer.transferId}/dispatch`, {
        driverName: driverName.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        courierName: courierName.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.data?.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.data?.message || "Failed to dispatch transfer.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to dispatch transfer.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: "640px" }}
        className="w-full bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-foreground" />
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Dispatch Stock Transfer
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deduct commissary stock and release transfer goods
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Transfer Summary Box (Source location removed per user instruction!) */}
          <div className="rounded-2xl border border-border bg-muted/20 p-4.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-sm text-foreground">
                {transfer.transferNumber}
              </span>
              <span className="text-muted-foreground text-[11px]">
                Ref: {transfer.requestNumber || "Direct"}
              </span>
            </div>
            <div className="pt-1 flex items-center justify-between font-medium">
              <span className="text-foreground text-sm font-semibold">
                {transfer.productName} ({transfer.variant || "Standard"})
              </span>
              <span className="font-extrabold text-foreground text-base">
                Qty: {transfer.transferQuantity}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground pt-1">
              Destination Branch: <strong className="text-foreground">{transfer.destLocationName}</strong>
            </div>
          </div>

          {/* Inventory Deduction Alert */}
          <div className="rounded-2xl border border-border bg-card p-4 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-muted-foreground leading-relaxed">
              Dispatching will immediately deduct <strong className="text-foreground">{transfer.transferQuantity} units</strong> from Commissary stock following First-Expiry-First-Out (FEFO) lots.
            </div>
          </div>

          {/* Logistics Fields */}
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Courier Partner
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

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Driver Name
                </label>
                <Input
                  type="text"
                  placeholder="Driver name"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card text-xs text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Vehicle Plate
                </label>
                <Input
                  type="text"
                  placeholder="Plate number"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card text-xs text-foreground font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4.5 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDispatch}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Deducting & Dispatching..." : "Confirm Dispatch"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
