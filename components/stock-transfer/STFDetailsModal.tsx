"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, MapPin, Truck, Package, User } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransfer } from "./types";
import { useAuth } from "@/context/AuthContext";

interface STFDetailsModalProps {
  transfer: StockTransfer | null;
  open: boolean;
  onClose: () => void;
  onDispatch?: (transfer: StockTransfer) => void;
  onCancel?: (transfer: StockTransfer) => void;
}

export function STFDetailsModal({
  transfer,
  open,
  onClose,
  onDispatch,
  onCancel,
}: STFDetailsModalProps) {
  const [mounted, setMounted] = useState(false);
  const { isAdmin } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  if (!open || !mounted || !transfer) return null;

  const isScheduled = transfer.status === "Scheduled";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: "720px" }}
        className="w-full max-h-[90vh] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">
                Stock Transfer Details
              </h2>
              <StatusBadge status={transfer.status} />
            </div>
            <p className="text-xs font-mono font-semibold text-muted-foreground mt-0.5">
              {transfer.transferNumber}{" "}
              {transfer.requestNumber && `(Ref: ${transfer.requestNumber})`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border bg-muted/20 p-4 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Origin Location
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{transfer.sourceLocationName || "Commissary (Central Kitchen)"}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Destination Branch
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{transfer.destLocationName}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Scheduled Date
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>
                  {transfer.scheduledDate
                    ? new Date(transfer.scheduledDate).toLocaleDateString()
                    : "Not Scheduled"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Dispatched Date
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>
                  {transfer.dispatchedDate
                    ? new Date(transfer.dispatchedDate).toLocaleString()
                    : "Not Dispatched"}
                </span>
              </div>
            </div>
          </div>

          {/* Product & Quantity Card */}
          <div className="rounded-xl border border-border bg-card p-4 text-xs space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              Transfer Item Information
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  Product
                </span>
                <p className="font-bold text-foreground mt-0.5">{transfer.productName}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  Variant
                </span>
                <p className="text-foreground mt-0.5">{transfer.variant || "Standard"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  SKU
                </span>
                <p className="font-mono text-muted-foreground mt-0.5">{transfer.sku || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  Transfer Qty
                </span>
                <p className="text-base font-extrabold text-foreground mt-0.5">
                  {transfer.transferQuantity}
                </p>
              </div>
            </div>
          </div>

          {/* Logistics Details */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-muted-foreground" />
              Logistics & Courier Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  Driver Name
                </span>
                <p className="font-medium text-foreground mt-0.5">{transfer.driverName || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  Vehicle Plate
                </span>
                <p className="font-mono text-foreground mt-0.5">{transfer.vehiclePlate || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  Courier Company
                </span>
                <p className="font-medium text-foreground mt-0.5">{transfer.courierName || "In-House"}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div className="rounded-xl border border-border bg-card p-4 text-xs space-y-1">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Notes & Instructions
              </span>
              <p className="text-foreground leading-relaxed">{transfer.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-card border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Close
          </button>

          {/* Only Inventory Manager can dispatch or cancel (Admin is view-only here!) */}
          {!isAdmin && isScheduled && (
            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCancel(transfer);
                  }}
                  className="rounded-xl bg-card border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Cancel Transfer
                </button>
              )}
              {onDispatch && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDispatch(transfer);
                  }}
                  className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:bg-foreground/85 transition-colors shadow-sm"
                >
                  Dispatch Transfer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
