"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, MapPin, User, AlertCircle, CheckCircle, Package, Truck } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransferRequest } from "./types";
import { useAuth } from "@/context/AuthContext";

interface STRDetailsModalProps {
  request: StockTransferRequest | null;
  open: boolean;
  onClose: () => void;
  onApprove?: (req: StockTransferRequest) => void;
  onReject?: (req: StockTransferRequest) => void;
  onSchedule?: (req: StockTransferRequest) => void;
  onCancel?: (req: StockTransferRequest) => void;
}

export function STRDetailsModal({
  request,
  open,
  onClose,
  onApprove,
  onReject,
  onSchedule,
  onCancel,
}: STRDetailsModalProps) {
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

  if (!open || !mounted || !request) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: "1000px" }}
        className="w-full max-h-[92vh] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-foreground">
                  Stock Transfer Request Details
                </h2>
                <StatusBadge status={request.status} />
              </div>
              <p className="text-xs font-mono font-semibold text-muted-foreground mt-0.5">
                {request.requestNumber}
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid (Source origin removed per user instruction!) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-2xl border border-border bg-muted/20 p-5 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Destination Branch
              </span>
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{request.toLocationName}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Requester & Priority
              </span>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{request.requestedBy}</span>
                <span className="px-2 py-0.5 rounded-md bg-card text-[10px] font-bold border border-border">
                  {request.priority}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Request Date
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{new Date(request.requestDate).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Required Date
              </span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>{new Date(request.requiredDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Reason / Remarks */}
          {request.reason && (
            <div className="rounded-2xl border border-border bg-card p-4.5 text-xs space-y-1">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Requester Reason / Purpose
              </span>
              <p className="text-foreground leading-relaxed font-medium">{request.reason}</p>
            </div>
          )}

          {/* Admin Review Notes (if any) */}
          {request.adminNotes && (
            <div className="rounded-2xl border border-border bg-muted/40 p-4.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground uppercase tracking-wider text-[10px]">
                  Admin Review Remarks
                </span>
                {request.reviewedBy && (
                  <span className="text-muted-foreground text-[10px]">
                    Reviewed by {request.reviewedBy}{" "}
                    {request.reviewedAt && `on ${new Date(request.reviewedAt).toLocaleDateString()}`}
                  </span>
                )}
              </div>
              <p className="text-foreground font-semibold">{request.adminNotes}</p>
            </div>
          )}

          {/* Items Table with Explicit Expiry Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                Requested Finished Products ({request.items?.length || 0})
              </h3>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Product Name</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">SKU</th>
                      <th className="px-5 py-3.5">Variant</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">Req. Qty</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">Commissary Stock</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">Expiry Date</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {request.items?.map((item, idx) => {
                      const firstLot = item.suggestedLots?.[0];
                      return (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-4 font-bold text-foreground">
                            {item.productName}
                            {item.notes && (
                              <p className="text-[11px] text-muted-foreground font-normal mt-0.5">
                                Note: {item.notes}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4 font-mono text-muted-foreground whitespace-nowrap">
                            {item.sku || "—"}
                          </td>
                          <td className="px-5 py-4 text-foreground font-medium whitespace-nowrap">
                            {item.variant || "Standard"}
                          </td>
                          <td className="px-5 py-4 text-right font-extrabold text-foreground text-sm">
                            {item.requestedQuantity}
                          </td>
                          <td className="px-5 py-4 text-right font-medium text-foreground">
                            {item.availableQuantity}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {firstLot ? (
                              <div className="space-y-0.5">
                                <span className="font-semibold text-foreground text-xs">
                                  {firstLot.expiryDate
                                    ? new Date(firstLot.expiryDate).toLocaleDateString()
                                    : "No Expiry"}
                                </span>
                                {firstLot.lotCode && (
                                  <div className="font-mono text-[10px] text-muted-foreground">
                                    Lot: {firstLot.lotCode}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {item.isInsufficient ? (
                              <StatusBadge status="Shortage" className="gap-1">
                                <AlertCircle className="w-3 h-3" /> Shortage
                              </StatusBadge>
                            ) : (
                              <StatusBadge status="In Stock" className="gap-1">
                                <CheckCircle className="w-3 h-3" /> In Stock
                              </StatusBadge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Associated Scheduled / Dispatched Formal Transfers */}
          {request.transfers && request.transfers.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                Associated Formal Stock Transfers ({request.transfers.length})
              </h3>
              <div className="border border-border rounded-2xl overflow-hidden bg-card divide-y divide-border text-xs">
                {request.transfers.map((st) => (
                  <div key={st.transferId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground text-sm">{st.transferNumber}</span>
                        <StatusBadge status={st.status} />
                      </div>
                      <div className="text-muted-foreground text-[11px] mt-0.5">
                        Quantity: <strong className="text-foreground">{st.transferQuantity}</strong>
                        {st.courierName && ` • Courier: ${st.courierName}`}
                        {st.driverName && ` • Driver: ${st.driverName}`}
                        {st.vehiclePlate && ` [${st.vehiclePlate}]`}
                      </div>
                    </div>
                    {st.scheduledDate && (
                      <span className="text-muted-foreground text-[11px]">
                        Scheduled: {new Date(st.scheduledDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4.5 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2.5">
            {/* Admin-only Approve / Reject */}
            {isAdmin && request.status === "Pending Approval" && (
              <>
                {onReject && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onReject(request);
                    }}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Reject Request
                  </button>
                )}
                {onApprove && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onApprove(request);
                    }}
                    className="rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm cursor-pointer"
                  >
                    Approve Request
                  </button>
                )}
              </>
            )}

            {/* Inventory Manager actions */}
            {!isAdmin && (
              <>
                {request.status === "Approved" && onSchedule && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSchedule(request);
                    }}
                    className="rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm cursor-pointer"
                  >
                    Schedule Transfer
                  </button>
                )}

                {["Pending Approval", "Approved"].includes(request.status) && onCancel && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCancel(request);
                    }}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel Request
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
