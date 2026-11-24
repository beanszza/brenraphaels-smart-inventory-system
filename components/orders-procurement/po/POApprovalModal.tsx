"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { PurchaseOrderPO } from "../types";
import { approvePurchaseOrder } from "@/app/actions/orders/orders";
import { actionResponse } from "@/lib/resources/action-response";
import { getFutureDateError, getMaxFutureDateString, getTodayDateString } from "@/lib/date-limits";

export interface POApprovalModalProps {
  po: PurchaseOrderPO | null;
  onClose: () => void;
  onSuccess: (updatedPO: PurchaseOrderPO) => void;
}

interface POApprovalBodyProps extends POApprovalModalProps {
  variant: "page" | "modal";
  embedded?: boolean;
}

function POApprovalBody({
  po,
  onClose,
  onSuccess,
  variant,
  embedded = false,
}: POApprovalBodyProps) {
  const [items, setItems] = useState(() =>
    (po?.items || []).map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      purchaseUomName: item.purchaseUomName || "Unit",
      sentQuantity: Number(item.poItemQuantity),
      confirmedQuantity: Number(item.poItemQuantity),
      totalPrice: Number(
        item.totalPrice || Number(item.poItemQuantity) * Number(item.unitPrice || 0) || 0
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

  const handleQuantityChange = (index: number, value: string) => {
    const clean = value.replace(/[-+e]/gi, "");
    const num = parseFloat(clean);
    const nextQty = isNaN(num) ? 0 : Math.max(0, num);
    const sentQty = items[index]?.sentQuantity ?? 0;
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        confirmedQuantity: nextQty,
      };
      return copy;
    });
    setErrors((prev) => {
      const copy = { ...prev };
      if (nextQty <= 0) {
        copy[`qty_${index}`] = "Must be greater than 0.";
      } else if (nextQty > sentQty) {
        copy[`qty_${index}`] = `Cannot exceed sent quantity (${sentQty}).`;
      } else {
        delete copy[`qty_${index}`];
      }
      return copy;
    });
  };

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

  const calculatedGrandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  }, [items]);

  const hasInvalidPriceOrQty = useMemo(() => {
    return items.some(
      (item) =>
        !(Number(item.confirmedQuantity) > 0) ||
        Number(item.confirmedQuantity) > Number(item.sentQuantity) ||
        !(Number(item.totalPrice) > 0)
    );
  }, [items]);

  const hasInvalidDate = useMemo(() => {
    return Boolean(getFutureDateError(supplierApprovedDate, "Approval date", { allowToday: true }));
  }, [supplierApprovedDate]);

  const hasPartialFulfillment = useMemo(() => {
    return items.some((item) => item.confirmedQuantity < item.sentQuantity);
  }, [items]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!supplierApprovedBy.trim()) {
      newErrors.supplierApprovedBy = "Supplier Representative name is required.";
    }
    const dateErr = getFutureDateError(supplierApprovedDate, "Approval date", {
      allowToday: true,
    });
    if (dateErr) {
      newErrors.supplierApprovedDate = dateErr;
    }

    items.forEach((item, idx) => {
      if (item.confirmedQuantity <= 0) {
        newErrors[`qty_${idx}`] = "Must be greater than 0.";
      } else if (item.confirmedQuantity > item.sentQuantity) {
        newErrors[`qty_${idx}`] = `Cannot exceed sent quantity (${item.sentQuantity}).`;
      }
      if (item.totalPrice <= 0) {
        newErrors[`price_${idx}`] = "Must be greater than ₱0.00.";
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
          submit: res.data?.message || "Failed to confirm purchase order.",
        }));
      }
    } catch (err: unknown) {
      console.error("Failed to approve purchase order:", err);
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
          "An unexpected error occurred during confirmation."
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred during confirmation.";
      setErrors((prev) => ({
        ...prev,
        submit: message,
      }));
    } finally {
      setSubmitting(false);
    }
  };

  if (!po) return null;

  const formattedOrderDate = po.orderDate
    ? new Date(po.orderDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    : "—";

  const containerClasses =
    variant === "page"
      ? embedded
        ? "space-y-5 pb-10 animate-page-in"
        : "page-container px-4 sm:px-8 w-full space-y-5 pb-10 animate-page-in"
      : "space-y-5";

  return (
    <div className={containerClasses}>
      {/* Page Header (Page Mode — with Close & Confirm Order buttons in top right) */}
      {variant === "page" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setConfirmCloseOpen(true)}
            className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{po.poNumber}</span>
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h1 className="type-page-title text-ink">Confirm order</h1>
              <p className="type-body text-ink-muted">
                Enter the confirmed accommodated quantities, total prices, and authorized supplier
                representative details from the supplier&apos;s reply.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setConfirmCloseOpen(true)}
                className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (validate()) {
                    setConfirmApproveOpen(true);
                  }
                }}
                disabled={submitting || hasInvalidPriceOrQty || hasInvalidDate}
                className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Confirming..." : "Confirm Order"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {errors.submit && (
        <div
          role="alert"
          className="p-3 rounded-inner bg-notice-danger-bg border border-notice-danger-border type-caption text-notice-danger-text font-medium"
        >
          {errors.submit}
        </div>
      )}

      {/* Main 2-Column Layout (Matches CreatePOForm) */}
      <div
        className={
          variant === "page"
            ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start"
            : "space-y-5"
        }
      >
        {/* Left Column: Supplier confirmation details + Confirmed items & pricing */}
        <div className="min-w-0 space-y-5">
          {/* Card 1: Supplier confirmation details */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            <h2 className="type-subsection text-ink">Supplier confirmation details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block type-label-field text-ink-strong">
                  Supplier Representative <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Maria Santos (Sales Mgr)"
                  value={supplierApprovedBy}
                  aria-invalid={!!errors.supplierApprovedBy}
                  onChange={(e) => {
                    setSupplierApprovedBy(e.target.value);
                    if (errors.supplierApprovedBy) {
                      setErrors((p) => {
                        const c = { ...p };
                        delete c.supplierApprovedBy;
                        return c;
                      });
                    }
                  }}
                  className={`h-9 type-body-secondary bg-surface rounded-control text-ink shadow-none ${errors.supplierApprovedBy ? "!border-destructive" : "border-input"
                    }`}
                />
                {errors.supplierApprovedBy && (
                  <p className="type-caption text-destructive mt-1">{errors.supplierApprovedBy}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block type-label-field text-ink-strong">
                  Date Approved by Supplier <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    min={getTodayDateString()}
                    max={getMaxFutureDateString()}
                    value={supplierApprovedDate}
                    aria-invalid={!!errors.supplierApprovedDate || hasInvalidDate}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setSupplierApprovedDate(nextVal);
                      const errMsg = getFutureDateError(nextVal, "Approval date", {
                        allowToday: true,
                      });
                      setErrors((p) => {
                        const c = { ...p };
                        if (errMsg) c.supplierApprovedDate = errMsg;
                        else delete c.supplierApprovedDate;
                        return c;
                      });
                    }}
                    className={`h-9 type-body-secondary bg-surface rounded-control pr-9 cursor-pointer text-ink shadow-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
                      errors.supplierApprovedDate || hasInvalidDate
                        ? "!border-destructive"
                        : "border-input"
                    }`}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                </div>
                {(errors.supplierApprovedDate || hasInvalidDate) && (
                  <p role="alert" className="type-caption font-medium text-destructive mt-1">
                    {errors.supplierApprovedDate ||
                      getFutureDateError(supplierApprovedDate, "Approval date", {
                        allowToday: true,
                      })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Confirmed items & pricing */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="type-subsection text-ink">Confirmed items &amp; pricing</h2>
                <p className="mt-0.5 type-caption text-ink-muted">
                  Update confirmed quantities and enter the total price quoted by the supplier for
                  each item.
                </p>
              </div>
              <span className="type-caption text-ink-muted tabular-nums">
                {items.length} item(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[520px] space-y-2.5">
                <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 items-center pb-1 border-b border-divider">
                  <div className="type-table-header text-ink-muted">Items</div>
                  <div className="type-table-header text-ink-muted text-right">Sent Qty</div>
                  <div className="type-table-header text-ink-muted text-right">
                    Confirmed Qty <span className="text-destructive">*</span>
                  </div>
                  <div className="type-table-header text-ink-muted text-right">
                    Total Price (₱) <span className="text-destructive">*</span>
                  </div>
                </div>

                {items.map((item, idx) => {
                  const isReduced = item.confirmedQuantity < item.sentQuantity;
                  const isExceeded = item.confirmedQuantity > item.sentQuantity;
                  const liveQtyError =
                    errors[`qty_${idx}`] ||
                    (isExceeded ? `Cannot exceed sent quantity (${item.sentQuantity}).` : "");
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 items-center">
                        <div className="min-w-0">
                          <div className="type-body-secondary font-medium text-ink truncate">
                            {item.itemName}
                          </div>
                          <div className="type-caption text-ink-muted">
                            {item.purchaseUomName}
                          </div>
                        </div>

                        <div className="flex items-center justify-end h-9 px-3 rounded-control border border-input bg-page type-body-secondary text-ink-secondary tabular-nums">
                          {item.sentQuantity.toLocaleString()}
                        </div>

                        <div className="min-w-0">
                          <Input
                            type="number"
                            min={1}
                            max={item.sentQuantity}
                            step="any"
                            value={item.confirmedQuantity || ""}
                            aria-invalid={!!liveQtyError}
                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                            className={`h-9 w-full text-right font-semibold type-body-secondary bg-surface rounded-control shadow-none tabular-nums ${
                              liveQtyError
                                ? "!border-destructive focus-visible:!ring-destructive"
                                : "border-input"
                            } ${isReduced ? "text-status-amber-fg" : "text-ink"}`}
                          />
                        </div>

                        <div className="min-w-0">
                          <Input
                            type="number"
                            min={0.01}
                            step="any"
                            placeholder="0.00"
                            value={item.totalPrice || ""}
                            aria-invalid={!!errors[`price_${idx}`]}
                            onChange={(e) => handleTotalPriceChange(idx, e.target.value)}
                            className={`h-9 w-full text-right font-semibold type-body-secondary bg-surface rounded-control text-ink shadow-none tabular-nums ${
                              errors[`price_${idx}`] ? "!border-destructive" : "border-input"
                            }`}
                          />
                        </div>
                      </div>
                      {(liveQtyError || errors[`price_${idx}`]) && (
                        <p role="alert" className="type-caption font-medium text-destructive text-right">
                          {liveQtyError || errors[`price_${idx}`]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {hasPartialFulfillment && (
              <div className="flex items-start gap-2 p-3 rounded-inner bg-notice-warning-bg border border-notice-warning-border text-notice-warning-text type-caption">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
                <span>
                  <strong>Partial Accommodation Notice:</strong> One or more items were accommodated
                  with a lower quantity than requested. The remaining balance will stay available on
                  Purchase Requisition <strong>{po.prNumber}</strong> so you can create another
                  Purchase Order for the remaining quantity.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order summary + Notes */}
        <div className="space-y-5">
          {/* Card 1: Order summary */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
            <h2 className="type-subsection text-ink">Order summary</h2>

            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-3 type-body-secondary">
                <span className="text-ink-muted shrink-0">Purchase Order Number</span>
                <span className="font-medium text-ink tabular-nums text-right">{po.poNumber}</span>
              </div>
              <div className="flex items-start justify-between gap-3 type-body-secondary">
                <span className="text-ink-muted shrink-0">Purchase Requisition</span>
                <span className="font-medium text-primary tabular-nums text-right">
                  {po.prNumber || "—"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 type-body-secondary">
                <span className="text-ink-muted shrink-0">Supplier</span>
                <span className="font-medium text-ink text-right break-words">
                  {po.supplierName || "—"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 type-body-secondary">
                <span className="text-ink-muted shrink-0">Order Date</span>
                <span className="font-medium text-ink text-right">{formattedOrderDate}</span>
              </div>
            </div>

            <div className="border-t border-divider pt-3 flex items-center justify-between gap-3">
              <span className="type-subsection text-ink">TOTAL AMOUNT DUE</span>
              <span className="type-modal-title text-ink tabular-nums">
                ₱
                {calculatedGrandTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Card 2: Notes */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-3">
            <h2 className="type-subsection text-ink">
              Notes <span className="type-caption font-normal text-ink-muted">(Optional)</span>
            </h2>
            <Textarea
              rows={3}
              placeholder="Enter any notes from supplier's reply (e.g., delivery batching, payment terms, or terms agreed)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-control border border-input bg-surface px-3 py-2.5 type-body-secondary text-ink shadow-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar (Modal mode only — in Page mode, Close & Confirm Order sit in the top-right header) */}
      {variant === "modal" && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-divider">
          {hasInvalidPriceOrQty ? (
            <span className="type-caption text-destructive font-medium">
              Enter a confirmed quantity and total price greater than ₱0.00 for every item to confirm.
            </span>
          ) : (
            <span className="type-caption text-ink-muted">
              Confirming finalizes pricing and moves this Purchase Order to Approved.
            </span>
          )}
          <div className="flex items-center justify-end gap-2.5 ml-auto">
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              disabled={submitting}
              className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
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
              disabled={submitting || hasInvalidPriceOrQty || hasInvalidDate}
              className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Confirming..." : "Confirm Order"}
            </Button>
          </div>
        </div>
      )}

      <ActionConfirmModal
        open={confirmApproveOpen}
        title="Confirm Purchase Order"
        subtitle={`Purchase Order Number: ${po.poNumber} • Supplier: ${po.supplierName}`}
        description={`Are you sure you want to confirm supplier approval and finalize pricing (Total: ₱${calculatedGrandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) for ${po.poNumber}?`}
        confirmLabel="Confirm Order"
        submitting={submitting}
        onCancel={() => setConfirmApproveOpen(false)}
        onConfirm={async () => {
          setConfirmApproveOpen(false);
          await handleConfirmApproval();
        }}
      />

      {/* Single close confirmation (Page mode only — avoids double confirmation with ModalWrapper) */}
      {variant === "page" && (
        <ActionConfirmModal
          open={confirmCloseOpen}
          title="Discard Supplier Confirmation?"
          subtitle={`Purchase Order Number: ${po.poNumber}`}
          description="Are you sure you want to leave this page? Any entered quantities or prices will not be saved."
          confirmLabel="Discard & Leave"
          cancelLabel="Stay"
          onCancel={() => setConfirmCloseOpen(false)}
          onConfirm={() => {
            setConfirmCloseOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}

/**
 * Full-page Supplier Confirmation view matching CreatePOForm layout.
 */
export function POApprovalView(props: POApprovalModalProps & { embedded?: boolean }) {
  return <POApprovalBody {...props} variant="page" />;
}

/**
 * Backward-compatible modal wrapper for unit tests.
 */
export function POApprovalModal(props: POApprovalModalProps) {
  if (!props.po) return null;
  return (
    <ModalWrapper
      open={true}
      title={`Confirm Order — ${props.po.poNumber}`}
      onClose={props.onClose}
      size="max-w-[760px]"
    >
      <POApprovalBody {...props} variant="modal" />
    </ModalWrapper>
  );
}
