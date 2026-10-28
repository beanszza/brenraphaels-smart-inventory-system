"use client";

import React from "react";
import {
  Calendar,
  AlertCircle,
  Truck,
} from "lucide-react";
import { PurchaseOrderPO } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface PODetailsModalProps {
  po: PurchaseOrderPO | null;
  isAdmin?: boolean;
  onClose: () => void;
  onEdit?: (po: PurchaseOrderPO) => void;
  onApprove?: (po: PurchaseOrderPO) => void;
  onReject?: (po: PurchaseOrderPO) => void;
  onReturn?: (po: PurchaseOrderPO) => void;
  onOrder?: (po: PurchaseOrderPO) => void;
  onCancel?: (po: PurchaseOrderPO) => void;
  onCreateDelivery?: (po: PurchaseOrderPO) => void;
}

export function PODetailsModal({
  po,
  isAdmin = false,
  onClose,
  onEdit,
  onApprove,
  onReject,
  onReturn,
  onOrder,
  onCancel,
  onCreateDelivery,
}: PODetailsModalProps) {
  if (!po) return null;

  const isPending = po.status === "Pending Approval";
  const isApproved = po.status === "Approved";
  const isCancellable = po.status === "Draft" || po.status === "Pending Approval" || po.status === "Returned";

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
      title={
        isAdmin && isPending
          ? `Review Purchase Order — ${po.poNumber}`
          : `Purchase Order Details — ${po.poNumber}`
      }
      onClose={onClose}
      size="max-w-5xl"
    >
      <div className="space-y-6">
        {/* Top Header Row with Status Badge & Document No */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <StatusBadge status={po.status} />
          </div>
          <div className="text-xs text-muted-foreground">
            Supplier: <span className="font-medium text-foreground">{po.supplierName || "—"}</span>
          </div>
        </div>

        {/* Admin Notes / Return / Rejection / Cancellation Reason */}
        {po.adminNotes && (
          <div
            className={`p-4 rounded-xl border space-y-1.5 ${
              po.status === "Rejected"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : po.status === "Cancelled"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border bg-muted/40 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {po.status === "Rejected"
                  ? "Admin Rejection Reason:"
                  : po.status === "Cancelled"
                  ? "Cancellation Reason:"
                  : "Admin Feedback / Revision Reason:"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-6 whitespace-pre-wrap">{po.adminNotes}</p>
          </div>
        )}

        {/* Header Details — 3-column / 2-column clean grid */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Purchase Order Number</label>
              <Input
                readOnly
                value={po.poNumber}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2.5 font-mono text-sm text-foreground cursor-not-allowed shadow-none focus-visible:ring-0"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Purchase Requisition Reference</label>
              <Input
                readOnly
                value={po.prNumber || "— (No PR reference)"}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2.5 font-mono text-sm text-foreground cursor-not-allowed shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Supplier</label>
              <Input
                readOnly
                value={po.supplierName || "—"}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-foreground cursor-not-allowed shadow-none focus-visible:ring-0"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Requested By</label>
              <Input
                readOnly
                value={po.requestedBy || "—"}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-foreground cursor-not-allowed shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Order Date</label>
              <Input
                readOnly
                value={fmt(po.orderDate)}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-foreground cursor-not-allowed shadow-none focus-visible:ring-0"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Payment Type</label>
              <Input
                readOnly
                value={po.paymentType || "Payable"}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-foreground cursor-not-allowed shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Order Items</h3>
            <span className="text-xs text-muted-foreground">
              {po.items?.length || 0} item(s)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">ITEM NAME</th>
                  <th className="px-4 py-3 font-semibold">Unit of Measure</th>
                  <th className="px-4 py-3 text-right font-semibold">QTY TO ORDER</th>
                  <th className="px-4 py-3 text-right font-semibold">UNIT PRICE</th>
                  <th className="px-4 py-3 text-right font-semibold">TOTAL PRICE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {po.items && po.items.length > 0 ? (
                  po.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{item.itemName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.purchaseUomName || "Unit"}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {Number(item.poItemQuantity || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {fmtCurrency(Number(item.unitPrice || 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        {fmtCurrency(Number(item.totalPrice ?? item.lineTotal ?? item.poItemQuantity * (item.unitPrice || 0)))}
                      </td>
                    </tr>
                  ))
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
              <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
              <p className="text-lg font-bold text-foreground font-mono">
                {fmtCurrency(po.totalAmount || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Close
          </Button>

          {/* Admin review buttons for Pending Approval */}
          {isAdmin && isPending && (
            <>
              {onReturn && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onReturn(po)}
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Return for Revision
                </Button>
              )}
              {onReject && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onReject(po)}
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Reject
                </Button>
              )}
              {onApprove && (
                <Button
                  type="button"
                  onClick={() => onApprove(po)}
                  className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm"
                >
                  Approve
                </Button>
              )}
            </>
          )}

          {/* Inventory Manager: Edit Draft or Returned PO */}
          {!isAdmin && (po.status === "Draft" || po.status === "Returned") && onEdit && (
            <Button
              type="button"
              onClick={() => onEdit(po)}
              className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm"
            >
              {po.status === "Returned" ? "Edit & Re-Submit" : "Edit Draft"}
            </Button>
          )}

          {/* Inventory Manager: Cancel PO for Draft/Pending/Returned PO */}
          {!isAdmin && isCancellable && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel(po)}
              className="rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Cancel Purchase Order
            </Button>
          )}

          {/* Inventory Manager: Schedule Delivery for Approved or Ordered PO */}
          {!isAdmin && (po.status === "Approved" || po.status === "Ordered" || po.status === "Partially Delivered") && onCreateDelivery && (
            <Button
              type="button"
              onClick={() => onCreateDelivery(po)}
              className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm"
            >
              <Truck className="w-4 h-4" />
              Schedule Delivery
            </Button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
