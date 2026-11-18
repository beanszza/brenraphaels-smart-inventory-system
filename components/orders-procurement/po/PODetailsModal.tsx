"use client";

import React from "react";
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { PurchaseOrderPO } from "../types";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
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
  onApproveWithForm,
  onCancel,
  onCreateDelivery,
}: PODetailsModalProps) {
  if (!po) return null;

  const isPending = po.status === "Pending Approval";
  const isApproved = po.status === "Approved";
  const isCancellable = po.status === "Pending Approval";
  const canScheduleDelivery =
    !isAdmin &&
    !!onCreateDelivery &&
    ["Approved", "Ordered", "Partially Delivered"].includes(po.status) &&
    (po.hasRemainingToSchedule ?? po.status === "Approved");

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
      size="max-w-[640px]"
    >
      <div className="space-y-6">
        {/* Top Header: Status and Order Date */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <StatusBadge status={po.status} />
          </div>
          <div className="type-caption text-text-muted">
            Order Date: <span className="font-medium text-text-primary">{fmt(po.orderDate)}</span>
          </div>
        </div>

        {/* Supplier Approval Confirmation Box */}
        {po.supplierApprovedBy && (
          <div className="p-3.5 rounded-card border border-status-green bg-status-green-bg text-status-green flex items-center justify-between flex-wrap gap-2 type-caption">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-status-green shrink-0" />
              <span>
                <strong>Supplier Approved by:</strong> {po.supplierApprovedBy}
              </span>
            </div>
            {po.supplierApprovedDate && (
              <span className="text-text-muted">
                Date: {fmt(po.supplierApprovedDate)}
              </span>
            )}
          </div>
        )}

        {/* Cancellation or Admin Notes */}
        {po.adminNotes && !po.supplierApprovedBy && (
          <div className={`p-4 rounded-card border space-y-1.5 ${
            po.status === "Cancelled"
              ? "border-status-red bg-status-red-bg text-status-red"
              : "border-divider bg-surface-muted text-text-primary"
          }`}>
            <div className="flex items-center gap-2 type-label font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {po.status === "Cancelled" ? "Cancellation Reason:" : "Notes / Remarks:"}
              </span>
            </div>
            <p className="type-body pl-6 whitespace-pre-wrap leading-relaxed opacity-95">{po.adminNotes}</p>
          </div>
        )}

        {/* 3-Column Info Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 rounded-card bg-surface-muted border border-divider">
          {/* Purchase Order Number */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Purchase Order Number
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted select-all">
              {po.poNumber}
            </div>
          </div>

          {/* Purchase Requisition Reference */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Purchase Requisition Reference
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-primary select-all font-semibold">
              {po.prNumber || "—"}
            </div>
          </div>

          {/* Supplier */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Supplier / Vendor
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-primary font-semibold">
              {po.supplierName}
            </div>
          </div>

          {/* Order Date */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Order Date
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted">
              {fmt(po.orderDate)}
            </div>
          </div>

          {/* Expected Arrival Date */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Expected Arrival Date
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted">
              <Calendar className="w-3.5 h-3.5 mr-2 text-text-muted" />
              {fmt(po.expectedArrivalDate)}
            </div>
          </div>

          {/* Requested By */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Requested By
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted">
              {po.requestedBy}
            </div>
          </div>
        </div>

        {/* Ordered Particulars Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="type-table-header font-semibold text-text-primary">
              Ordered Particulars
            </label>
            <span className="type-caption text-text-muted">
              {po.items?.length || 0} item(s) listed
            </span>
          </div>

          <div className="overflow-x-auto rounded-card border border-divider bg-surface">
            <table className="w-full type-table-cell">
              <thead className="border-b border-divider bg-surface-muted uppercase text-text-muted table-head-row type-table-header">
                <tr>
                  <th className="table-th px-4 py-2.5 text-left font-semibold">PARTICULARS</th>
                  <th className="table-th px-4 py-2.5 text-left font-semibold">Unit of Measure</th>
                  <th className="table-th px-4 py-2.5 text-right font-semibold">ORDER QUANTITY</th>
                  {!isPending && (
                    <>
                      <th className="table-th px-4 py-2.5 text-right font-semibold">UNIT PRICE</th>
                      <th className="table-th px-4 py-2.5 text-right font-semibold">TOTAL AMOUNT</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {po.items && po.items.length > 0 ? (
                  po.items.map((item, idx) => {
                    const unitPrice = item.unitPrice || (item.poItemQuantity > 0 ? item.totalPrice / item.poItemQuantity : 0);
                    return (
                      <tr key={idx} className="hover:bg-surface-hover transition-colors table-row">
                        <td className="table-td px-4 py-3 font-semibold text-text-primary uppercase">
                          {item.itemName}
                        </td>
                        <td className="table-td px-4 py-3 text-text-muted">
                          {item.purchaseUomName || "Unit"}
                        </td>
                        <td className="table-td px-4 py-3 text-right font-semibold text-text-primary">
                          {Number(item.poItemQuantity).toLocaleString()}
                        </td>
                        {!isPending && (
                          <>
                            <td className="table-td px-4 py-3 text-right text-text-muted">
                              {unitPrice > 0 ? fmtCurrency(unitPrice) : "Pending Confirmation"}
                            </td>
                            <td className="table-td px-4 py-3 text-right font-semibold text-text-primary">
                              {item.totalPrice > 0 ? fmtCurrency(Number(item.totalPrice)) : "—"}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isPending ? 3 : 5} className="px-4 py-8 text-center type-body text-text-muted">
                      No items in this purchase order.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total Amount Summary (hidden while Pending Approval before supplier confirmation) */}
          {!isPending && (
            <div className="flex items-center justify-end">
              <div className="rounded-card border border-divider bg-surface-muted px-5 py-3 text-right min-w-[220px]">
                <p className="type-caption text-text-muted mb-1">TOTAL AMOUNT DUE</p>
                <p className="type-section-title font-semibold text-text-primary">
                  {po.totalAmount > 0 ? fmtCurrency(po.totalAmount) : (isApproved ? "₱0.00" : "Pending Confirmation")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions: Styled matching Resources & Suppliers */}
        <div className="flex items-center justify-end gap-3 pt-5 pb-3 border-t border-divider mt-6 mb-2 flex-wrap">
          {!isAdmin && isCancellable && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel(po)}
              className="rounded-control border border-status-red text-status-red hover:bg-status-red-bg px-5 py-2.5 h-auto type-label-button font-semibold transition-colors cursor-pointer"
            >
              Cancel Purchase Order
            </Button>
          )}

          {/* Close Button */}
          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border border-divider bg-surface px-5 py-2.5 h-auto type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Close
          </ModalCloseButton>

          {/* IMS Manager: Approve Order (Far Right!) */}
          {!isAdmin && isPending && onApproveWithForm && (
            <Button
              type="button"
              onClick={() => onApproveWithForm(po)}
              className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 h-auto type-label-button font-semibold hover:bg-button-primary-hover transition-colors shadow-sm cursor-pointer"
            >
              Approve Order
            </Button>
          )}

          {/* IMS Manager: Schedule Delivery only while PO still has unscheduled balance (Far Right) */}
          {canScheduleDelivery && (
            <Button
              type="button"
              onClick={() => onCreateDelivery?.(po)}
              className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 h-auto type-label-button font-semibold hover:bg-button-primary-hover transition-colors shadow-sm cursor-pointer"
            >
              Schedule Delivery
            </Button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
