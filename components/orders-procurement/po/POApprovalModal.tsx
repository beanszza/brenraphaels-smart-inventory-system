"use client";

import React, { useState, useMemo } from "react";
import { CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { PurchaseOrderPO } from "../types";
import { approvePurchaseOrder } from "@/app/actions/orders/orders";
import { actionResponse } from "@/lib/resources/action-response";
import { getTodayDateString } from "@/lib/date-limits";

interface POApprovalModalProps {
  po: PurchaseOrderPO | null;
  onClose: () => void;
  onSuccess: (updatedPO: PurchaseOrderPO) => void;
}

export function POApprovalModal({ po, onClose, onSuccess }: POApprovalModalProps) {
  // Initialize lines state with existing items (using Total Price directly)
  const [items, setItems] = useState(() =>
    (po?.items || []).map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      purchaseUomName: item.purchaseUomName || "Unit",
      sentQuantity: Number(item.poItemQuantity),
      confirmedQuantity: Number(item.poItemQuantity),
      totalPrice: Number(
        item.totalPrice || (Number(item.poItemQuantity) * Number(item.unitPrice || 0)) || 0
      ),
    }))
  );

  const [supplierApprovedBy, setSupplierApprovedBy] = useState(
    po?.supplierApprovedBy || po?.supplierContactPerson || ""
  );
  const [supplierApprovedDate, setSupplierApprovedDate] = useState(
    po?.supplierApprovedDate
      ? new Date(po.supplierApprovedDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState(po?.adminNotes || "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  // Handle quantity modification
  const handleQuantityChange = (index: number, value: string) => {
    const clean = value.replace(/[-+e]/gi, "");
    const num = parseFloat(clean);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        confirmedQuantity: isNaN(num) ? 0 : Math.max(0, num),
      };
      return copy;
    });
    setErrors((prev) => {
      if (!prev[`qty_${index}`]) return prev;
      const copy = { ...prev };
      delete copy[`qty_${index}`];
      return copy;
    });
  };

  // Handle total price modification
  const handleTotalPriceChange = (index: number, value: string) => {
    const clean = value.replace(/[-+e]/gi, "");
    const num = parseFloat(clean);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        totalPrice: isNaN(num) ? 0 : Math.max(0, num),
      };
      return copy;
    });
    setErrors((prev) => {
      if (!prev[`price_${index}`]) return prev;
      const copy = { ...prev };
      delete copy[`price_${index}`];
      return copy;
    });
  };

  // Auto-calculated grand total from item total prices
  const calculatedGrandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  }, [items]);

  const hasMissingPriceOrQty = useMemo(() => {
    return items.some((item) => !(Number(item.confirmedQuantity) > 0) || !(Number(item.totalPrice) > 0));
  }, [items]);

  // Check if any item quantity was reduced (partial fulfillment)
  const hasPartialFulfillment = useMemo(() => {
    return items.some((item) => item.confirmedQuantity < item.sentQuantity);
  }, [items]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!supplierApprovedBy.trim()) {
      newErrors.supplierApprovedBy = "Supplier Approver Representative name is required.";
    }
    if (!supplierApprovedDate) {
      newErrors.supplierApprovedDate = "Approval date is required.";
    }

    items.forEach((item, idx) => {
      if (item.confirmedQuantity <= 0) {
        newErrors[`qty_${idx}`] = "Confirmed quantity must be greater than 0.";
      }
      if (item.totalPrice <= 0) {
        newErrors[`price_${idx}`] = "Total price must be greater than ₱0.00.";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirmApproval = async () => {
    if (!po || !validate()) return;

    try {
      setSubmitting(true);
      const payload = {
        confirmedItems: items.map((i) => ({
          itemId: i.itemId,
          poItemQuantity: i.confirmedQuantity,
          unitPrice: i.confirmedQuantity > 0 ? i.totalPrice / i.confirmedQuantity : 0,
          totalPrice: i.totalPrice,
        })),
        supplierApprovedBy: supplierApprovedBy.trim(),
        supplierApprovedDate,
        notes: notes.trim() || undefined,
      };

      const res = await actionResponse(approvePurchaseOrder(po.poId, payload));
      if (res.data?.success) {
        onSuccess(res.data.data);
      } else {
        setErrors((prev) => ({
          ...prev,
          submit: res.data?.message || "Failed to approve purchase order.",
        }));
      }
    } catch (err: unknown) {
      console.error("Failed to approve purchase order:", err);
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message || "An unexpected error occurred during approval."
          : err instanceof Error
          ? err.message
          : "An unexpected error occurred during approval.";
      setErrors((prev) => ({
        ...prev,
        submit: message,
      }));
    } finally {
      setSubmitting(false);
    }
  };

  if (!po) return null;

  return (
    <ModalWrapper
      open={true}
      title={`Confirm Supplier Approval — ${po.poNumber}`}
      onClose={() => setConfirmCloseOpen(true)}
      size="max-w-[640px]"
    >
      <div className="space-y-5">
        {/* Helper Banner */}
        <div className="p-3.5 rounded-inner bg-page border border-border type-caption text-ink-secondary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-status-green-fg shrink-0" />
          <span>
            Enter the confirmed accommodated quantities, total prices, and authorized supplier representative details from the supplier&apos;s reply.
          </span>
        </div>

        {errors.submit && (
          <div className="p-3 rounded-inner bg-notice-danger-bg border border-notice-danger-border type-caption text-notice-danger-text font-medium">
            {errors.submit}
          </div>
        )}

        {/* Purchase Order Summary Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-inner bg-page border border-border type-caption">
          <div>
            <span className="text-ink-muted block type-caption mb-1">Supplier / Vendor</span>
            <span className="font-semibold text-ink type-body">{po.supplierName}</span>
          </div>
          <div>
            <span className="text-ink-muted block type-caption mb-1">Purchase Requisition Reference</span>
            <span className="font-semibold text-ink type-body">{po.prNumber || "—"}</span>
          </div>
          <div>
            <span className="text-ink-muted block type-caption mb-1">Original Order Date</span>
            <span className="font-semibold text-ink type-body">
              {new Date(po.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Confirmed Particulars Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="type-table-header font-semibold text-text-primary uppercase tracking-wider">
              Confirmed Particulars &amp; Total Pricing
            </label>
            <span className="type-caption text-text-muted">
              {items.length} item(s)
            </span>
          </div>

          <div className="border border-divider rounded-card overflow-x-auto bg-surface">
            <table className="w-full type-table-cell">
              <thead className="table-head-row border-b border-divider text-text-muted uppercase type-table-header">
                <tr>
                  <th className="table-th px-3.5 py-2.5 text-left font-semibold">PARTICULARS</th>
                  <th className="table-th px-3 py-2.5 text-center font-semibold">SENT QTY</th>
                  <th className="table-th px-3 py-2.5 text-center font-semibold w-36">CONFIRMED QTY *</th>
                  <th className="table-th px-3.5 py-2.5 text-right font-semibold w-40">TOTAL PRICE (₱) *</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {items.map((item, idx) => {
                  const isReduced = item.confirmedQuantity < item.sentQuantity;
                  return (
                    <tr key={idx} className="hover:bg-surface-hover transition-colors table-row">
                      <td className="table-td px-3.5 py-2.5 font-semibold text-text-primary">
                        {item.itemName}
                        <span className="block type-caption font-normal text-text-muted">
                          Unit of Measure: {item.purchaseUomName}
                        </span>
                      </td>
                      <td className="table-td px-3 py-2.5 text-center text-text-muted">
                        {item.sentQuantity}
                      </td>
                      <td className="table-td px-3 py-2.5 text-center">
                        <Input
                          type="number"
                          min={1}
                          step="any"
                          value={item.confirmedQuantity || ""}
                          onChange={(e) => handleQuantityChange(idx, e.target.value)}
                          className={`h-8 w-24 mx-auto text-center font-semibold type-body bg-surface rounded-control ${
                            errors[`qty_${idx}`] ? "border-status-red" : "border-divider"
                          } ${isReduced ? "text-status-amber" : "text-text-primary"}`}
                        />
                        {errors[`qty_${idx}`] && (
                          <p className="type-caption text-status-red mt-0.5">{errors[`qty_${idx}`]}</p>
                        )}
                      </td>
                      <td className="table-td px-3.5 py-2.5 text-right">
                        <Input
                          type="number"
                          min={0.01}
                          step="any"
                          placeholder="0.00"
                          value={item.totalPrice || ""}
                          onChange={(e) => handleTotalPriceChange(idx, e.target.value)}
                          className={`h-8 w-32 ml-auto text-right font-semibold type-body bg-surface rounded-control text-text-primary ${
                            errors[`price_${idx}`] ? "border-status-red" : "border-divider"
                          }`}
                        />
                        {errors[`price_${idx}`] && (
                          <p className="type-caption text-status-red mt-0.5">{errors[`price_${idx}`]}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Partial Fulfillment Notification */}
          {hasPartialFulfillment && (
            <div className="flex items-start gap-2 p-3 rounded-card bg-status-amber-bg border border-status-amber text-status-amber type-caption">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Partial Accommodation Notice:</strong> One or more items were accommodated with a lower quantity than requested. The remaining balance will stay available on Purchase Requisition <strong>{po.prNumber}</strong> so you can create another Purchase Order for the remaining quantity.
              </span>
            </div>
          )}
        </div>

        {/* Total Summary Row */}
        <div className="flex justify-between items-center p-4 rounded-card bg-surface-muted border border-divider">
          <span className="type-table-header font-semibold uppercase tracking-wider text-text-primary">
            TOTAL AMOUNT DUE
          </span>
          <span className="type-stat-value font-semibold text-text-primary">
            ₱{calculatedGrandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Supplier Approval Meta Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-card bg-surface-muted border border-divider type-caption">
          {/* Supplier Approver Name */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Supplier Representative <span className="text-status-red">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Maria Santos (Sales Mgr)"
              value={supplierApprovedBy}
              onChange={(e) => setSupplierApprovedBy(e.target.value)}
              className={`h-10 type-body bg-surface rounded-control text-text-primary placeholder:text-text-muted ${
                errors.supplierApprovedBy ? "border-status-red" : "border-divider"
              }`}
            />
            {errors.supplierApprovedBy && (
              <p className="type-caption text-status-red mt-1">{errors.supplierApprovedBy}</p>
            )}
          </div>

          {/* Approval Date */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Date Approved by Supplier <span className="text-status-red">*</span>
            </label>
            <div className="relative">
              <Input
                type="date"
                max={getTodayDateString()}
                value={supplierApprovedDate}
                onChange={(e) => setSupplierApprovedDate(e.target.value)}
                className={`h-10 type-body bg-surface rounded-control pr-10 cursor-pointer text-text-primary [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
                  errors.supplierApprovedDate ? "border-status-red" : "border-divider"
                }`}
              />
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
            {errors.supplierApprovedDate && (
              <p className="type-caption text-status-red mt-1">{errors.supplierApprovedDate}</p>
            )}
          </div>
        </div>

        {/* Notes (Optional) */}
        <div>
          <label className="mb-1 block type-label font-semibold text-text-primary">
            Supplier Confirmation Notes (Optional)
          </label>
          <Textarea
            rows={2}
            placeholder="Enter any notes from supplier's reply (e.g., delivery batching, payment terms, or terms agreed)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-control border border-divider bg-surface px-3 py-2 type-body text-text-primary placeholder:text-text-muted resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-divider flex-wrap">
          {hasMissingPriceOrQty ? (
            <span className="type-caption text-destructive font-medium">
              Enter a confirmed quantity and total price greater than ₱0.00 for every item to confirm.
            </span>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-3 ml-auto">
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={() => setConfirmCloseOpen(true)}
              disabled={submitting}
              className="rounded-control px-5 py-2.5 h-auto type-label-button border-input bg-surface hover:bg-subtle text-ink cursor-pointer shadow-none"
            >
              Close
            </ModalCloseButton>
            <Button
              type="button"
              onClick={() => {
                if (validate()) {
                  setConfirmApproveOpen(true);
                }
              }}
              disabled={submitting || hasMissingPriceOrQty}
              className="rounded-control px-6 py-2.5 h-auto type-label-button shadow-none bg-primary text-on-brand hover:bg-primary-hover cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Approving..." : "Confirm & Approve Order"}
            </Button>
          </div>
        </div>
      </div>

      <ActionConfirmModal
        open={confirmApproveOpen}
        title="Approve Purchase Order"
        subtitle={`Purchase Order Number: ${po.poNumber} • Supplier: ${po.supplierName}`}
        description={`Are you sure you want to confirm supplier approval and finalize pricing (Total: ₱${calculatedGrandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) for ${po.poNumber}?`}
        confirmLabel="Confirm & Approve"
        submitting={submitting}
        onCancel={() => setConfirmApproveOpen(false)}
        onConfirm={async () => {
          setConfirmApproveOpen(false);
          await handleConfirmApproval();
        }}
      />

      <ActionConfirmModal
        open={confirmCloseOpen}
        title="Discard Supplier Approval?"
        subtitle={`Purchase Order Number: ${po.poNumber}`}
        description="Are you sure you want to close this approval form? Any entered quantities or prices will not be saved."
        confirmLabel="Discard & Close"
        cancelLabel="Stay"
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          onClose();
        }}
      />
    </ModalWrapper>
  );
}
