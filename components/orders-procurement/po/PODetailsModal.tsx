"use client";

import React from "react";
import {
  Calendar,
  AlertCircle,
  Truck,
  Printer,
  CheckCircle2,
} from "lucide-react";
import { PurchaseOrderPO } from "../types";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface PODetailsModalProps {
  po: PurchaseOrderPO | null;
  isAdmin?: boolean;
  onClose: () => void;
  onEdit?: (po: PurchaseOrderPO) => void;
  onApproveWithForm?: (po: PurchaseOrderPO) => void;
  onPrint?: (po: PurchaseOrderPO) => void;
  onCancel?: (po: PurchaseOrderPO) => void;
  onCreateDelivery?: (po: PurchaseOrderPO) => void;
}

export function PODetailsModal({
  po,
  isAdmin = false,
  onClose,
  onEdit,
  onApproveWithForm,
  onPrint,
  onCancel,
  onCreateDelivery,
}: PODetailsModalProps) {
  if (!po) return null;

  const isPending = po.status === "Pending Approval";
  const isApproved = po.status === "Approved";
  const isCancellable = po.status === "Pending Approval";

  const fmt = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(n);

  return (
    <ModalWrapper
      open={!!po}
      title={`Purchase Order Details — ${po.poNumber}`}
      onClose={onClose}
      size="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Top Header: Status and Quick Metadata */}
        <div className="flex items-center justify-between pb-3 border-b border-border flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <StatusBadge status={po.status} />
            <span className="text-xs text-muted-foreground font-mono">
              {po.poNumber}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Order Date: <span className="font-medium text-foreground">{fmt(po.orderDate)}</span>
          </div>
        </div>

        {/* Supplier Approval Confirmation Box */}
        {po.supplierApprovedBy && (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Supplier Approved by:</strong> {po.supplierApprovedBy}
              </span>
            </div>
            {po.supplierApprovedDate && (
              <span className="text-muted-foreground">
                Date: {fmt(po.supplierApprovedDate)}
              </span>
            )}
          </div>
        )}

        {/* Cancellation or Admin Notes */}
        {po.adminNotes && !po.supplierApprovedBy && (
          <div className={`p-4 rounded-xl border space-y-1.5 ${
            po.status === "Cancelled"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-border bg-muted/40 text-foreground"
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {po.status === "Cancelled" ? "Cancellation Reason:" : "Notes / Remarks:"}
              </span>
            </div>
            <p className="text-xs pl-6 whitespace-pre-wrap leading-relaxed opacity-95">{po.adminNotes}</p>
          </div>
        )}

        {/* 3-Column Info Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border">
          {/* Purchase Order Number */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Purchase Order Number
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 font-mono text-xs text-muted-foreground select-all">
              {po.poNumber}
            </div>
          </div>

          {/* Purchase Requisition Reference */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Purchase Requisition Reference
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 font-mono text-xs text-foreground select-all font-semibold">
              {po.prNumber || "—"}
            </div>
          </div>

          {/* Supplier */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Supplier / Vendor
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-foreground font-semibold">
              {po.supplierName}
            </div>
          </div>

          {/* Order Date */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Order Date
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
              {fmt(po.orderDate)}
            </div>
          </div>

          {/* Expected Arrival Date */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Expected Arrival Date
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              {fmt(po.expectedArrivalDate)}
            </div>
          </div>

          {/* Requested By */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Requested By
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
              {po.requestedBy}
            </div>
          </div>
        </div>

        {/* Ordered Particulars Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Ordered Particulars
            </label>
            <span className="text-[11px] text-muted-foreground">
              {po.items?.length || 0} item(s) listed
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-bold">PARTICULARS</th>
                  <th className="px-4 py-2.5 text-left font-bold">Unit of Measure</th>
                  <th className="px-4 py-2.5 text-right font-bold">ORDER QUANTITY</th>
                  <th className="px-4 py-2.5 text-right font-bold">UNIT PRICE</th>
                  <th className="px-4 py-2.5 text-right font-bold">TOTAL AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {po.items && po.items.length > 0 ? (
                  po.items.map((item, idx) => {
                    const unitPrice = item.unitPrice || (item.poItemQuantity > 0 ? item.totalPrice / item.poItemQuantity : 0);
                    return (
                      <tr key={idx} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground uppercase">
                          {item.itemName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.purchaseUomName || "Unit"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                          {Number(item.poItemQuantity).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {unitPrice > 0 ? fmtCurrency(unitPrice) : "Pending Confirmation"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                          {item.totalPrice > 0 ? fmtCurrency(Number(item.totalPrice)) : "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No items in this purchase order.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total Amount Summary */}
          <div className="flex items-center justify-end">
            <div className="rounded-xl border border-border bg-muted/30 px-5 py-3 text-right min-w-[220px]">
              <p className="text-xs text-muted-foreground mb-1">TOTAL AMOUNT DUE</p>
              <p className="text-lg font-bold text-foreground font-mono">
                {po.totalAmount > 0 ? fmtCurrency(po.totalAmount) : (isApproved ? "₱0.00" : "Pending Confirmation")}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2 flex-wrap">
          {/* Print / Save as PDF Button */}
          {onPrint && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onPrint(po)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print Purchase Order
            </Button>
          )}

          {/* Close Button */}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Close
          </Button>

          {/* IMS Manager: Approve Order with Supplier Details (Pending Approval only) */}
          {!isAdmin && isPending && onApproveWithForm && (
            <Button
              type="button"
              onClick={() => onApproveWithForm(po)}
              className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve Order
            </Button>
          )}

          {/* IMS Manager: Cancel Purchase Order */}
          {!isAdmin && isCancellable && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel(po)}
              className="rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 px-5 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel Purchase Order
            </Button>
          )}

          {/* IMS Manager: Schedule Delivery for Approved Orders */}
          {!isAdmin && (po.status === "Approved" || po.status === "Ordered" || po.status === "Partially Delivered") && onCreateDelivery && (
            <Button
              type="button"
              onClick={() => onCreateDelivery(po)}
              className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              <Truck className="w-4 h-4" /> Schedule Delivery
            </Button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
