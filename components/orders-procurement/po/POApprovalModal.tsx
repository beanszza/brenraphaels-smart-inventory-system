"use client";

import React, { useState, useMemo } from "react";
import { CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { PurchaseOrderPO } from "../types";
import { approvePurchaseOrder } from "@/app/actions/orders/orders";
import { actionResponse } from "@/lib/resources/action-response";

interface POApprovalModalProps {
  po: PurchaseOrderPO | null;
  onClose: () => void;
  onSuccess: (updatedPO: PurchaseOrderPO) => void;
}

export function POApprovalModal({ po, onClose, onSuccess }: POApprovalModalProps) {
  if (!po) return null;

  // Initialize lines state with existing items (using Total Price directly)
  const [items, setItems] = useState(() =>
    po.items.map((item) => ({
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
    po.supplierApprovedBy || po.supplierContactPerson || ""
  );
  const [supplierApprovedDate, setSupplierApprovedDate] = useState(
    po.supplierApprovedDate
      ? new Date(po.supplierApprovedDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [expectedArrivalDate, setExpectedArrivalDate] = useState(
    po.expectedArrivalDate
      ? new Date(po.expectedArrivalDate).toISOString().split("T")[0]
      : ""
  );
  const [notes, setNotes] = useState(po.adminNotes || "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
  };

  // Auto-calculated grand total from item total prices
  const calculatedGrandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
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
    if (!validate()) return;

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
        expectedArrivalDate: expectedArrivalDate || undefined,
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
    } catch (err: any) {
      console.error("Failed to approve purchase order:", err);
      setErrors((prev) => ({
        ...prev,
        submit: err?.response?.data?.message || "An unexpected error occurred during approval.",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      open={true}
      title={`Confirm Supplier Approval — ${po.poNumber}`}
      onClose={onClose}
      size="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Helper Banner */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Enter the confirmed accommodated quantities, total prices, and authorized supplier representative details from the supplier&apos;s reply.
          </span>
        </div>

        {errors.submit && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium">
            {errors.submit}
          </div>
        )}

        {/* Purchase Order Summary Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-xl bg-muted/20 border border-border text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px] mb-1">Supplier / Vendor</span>
            <span className="font-bold text-foreground text-xs">{po.supplierName}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] mb-1">Purchase Requisition Reference</span>
            <span className="font-mono font-semibold text-foreground text-xs">{po.prNumber || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] mb-1">Original Order Date</span>
            <span className="font-semibold text-foreground text-xs">
              {new Date(po.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Confirmed Particulars Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider">
              Confirmed Particulars &amp; Total Pricing
            </label>
            <span className="text-[11px] text-muted-foreground">
              {items.length} item(s)
            </span>
          </div>

          <div className="border border-border rounded-xl overflow-x-auto bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[11px]">
                <tr>
                  <th className="px-3.5 py-2.5 text-left font-bold">PARTICULARS</th>
                  <th className="px-3 py-2.5 text-center font-bold">SENT QTY</th>
                  <th className="px-3 py-2.5 text-center font-bold w-36">CONFIRMED QTY *</th>
                  <th className="px-3.5 py-2.5 text-right font-bold w-40">TOTAL PRICE (₱) *</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => {
                  const isReduced = item.confirmedQuantity < item.sentQuantity;
                  return (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      <td className="px-3.5 py-2.5 font-semibold text-foreground">
                        {item.itemName}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          Unit of Measure: {item.purchaseUomName}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">
                        {item.sentQuantity}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Input
                          type="number"
                          min={1}
                          step="any"
                          value={item.confirmedQuantity || ""}
                          onChange={(e) => handleQuantityChange(idx, e.target.value)}
                          className={`h-8 w-24 mx-auto text-center font-mono font-bold text-xs bg-card ${
                            errors[`qty_${idx}`] ? "border-destructive" : "border-border"
                          } ${isReduced ? "text-amber-600 dark:text-amber-400" : ""}`}
                        />
                        {errors[`qty_${idx}`] && (
                          <p className="text-[10px] text-destructive mt-0.5">{errors[`qty_${idx}`]}</p>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <Input
                          type="number"
                          min={0.01}
                          step="any"
                          placeholder="0.00"
                          value={item.totalPrice || ""}
                          onChange={(e) => handleTotalPriceChange(idx, e.target.value)}
                          className={`h-8 w-32 ml-auto text-right font-mono font-bold text-xs bg-card ${
                            errors[`price_${idx}`] ? "border-destructive" : "border-border"
                          }`}
                        />
                        {errors[`price_${idx}`] && (
                          <p className="text-[10px] text-destructive mt-0.5">{errors[`price_${idx}`]}</p>
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
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Partial Accommodation Notice:</strong> One or more items were accommodated with a lower quantity than requested. The remaining balance will stay available on Purchase Requisition <strong>{po.prNumber}</strong> so you can create another Purchase Order for the remaining quantity.
              </span>
            </div>
          )}
        </div>

        {/* Total Summary Row */}
        <div className="flex justify-between items-center p-4 rounded-xl bg-muted/40 border border-border">
          <span className="text-xs font-black uppercase tracking-wider text-foreground">
            TOTAL AMOUNT DUE
          </span>
          <span className="text-xl font-mono font-black text-foreground">
            ₱{calculatedGrandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Supplier Approval Meta Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border text-xs">
          {/* Supplier Approver Name */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Supplier Representative <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Maria Santos (Sales Mgr)"
              value={supplierApprovedBy}
              onChange={(e) => setSupplierApprovedBy(e.target.value)}
              className={`h-10 text-xs bg-card ${
                errors.supplierApprovedBy ? "border-destructive" : "border-border"
              }`}
            />
            {errors.supplierApprovedBy && (
              <p className="text-[10px] text-destructive mt-1">{errors.supplierApprovedBy}</p>
            )}
          </div>

          {/* Approval Date */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Date Approved by Supplier <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type="date"
                value={supplierApprovedDate}
                onChange={(e) => setSupplierApprovedDate(e.target.value)}
                className={`h-10 text-xs bg-card pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
                  errors.supplierApprovedDate ? "border-destructive" : "border-border"
                }`}
              />
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            {errors.supplierApprovedDate && (
              <p className="text-[10px] text-destructive mt-1">{errors.supplierApprovedDate}</p>
            )}
          </div>

          {/* Expected Arrival Date */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Expected Arrival Date
            </label>
            <div className="relative">
              <Input
                type="date"
                value={expectedArrivalDate}
                onChange={(e) => setExpectedArrivalDate(e.target.value)}
                className="h-10 text-xs bg-card border-border pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Notes (Optional) */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            Supplier Confirmation Notes (Optional)
          </label>
          <Textarea
            rows={2}
            placeholder="Enter any notes from supplier's reply (e.g., delivery batching, payment terms, or terms agreed)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-5 font-semibold border-border bg-card hover:bg-muted text-foreground cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmApproval}
            disabled={submitting}
            className="rounded-xl px-6 font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Approving..." : "Confirm & Approve Order"}
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
}
