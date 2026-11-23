"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Printer,
  PackageCheck,
  Mail,
} from "lucide-react";
import { PurchaseOrderPO } from "../types";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { downloadPurchaseOrderPdf } from "./downloadPurchaseOrderPdf";

export interface PODetailsProps {
  po: PurchaseOrderPO | null;
  isAdmin?: boolean;
  onClose: () => void;
  onEdit?: (po: PurchaseOrderPO) => void;
  onApproveWithForm?: (po: PurchaseOrderPO) => void;
  onConfirmEmailSent?: (po: PurchaseOrderPO) => Promise<void> | void;
  onPrint?: (po: PurchaseOrderPO) => void;
  onCancel?: (po: PurchaseOrderPO) => void;
  onCreateDelivery?: (po: PurchaseOrderPO) => void;
}

interface PODetailsBodyProps extends PODetailsProps {
  variant: "page" | "modal";
  embedded?: boolean;
}

function PODetailsBody({
  po,
  isAdmin = false,
  onClose,
  onApproveWithForm,
  onConfirmEmailSent,
  onPrint,
  onCancel,
  onCreateDelivery,
  variant,
  embedded = false,
}: PODetailsBodyProps) {
  const [confirmEmailModalOpen, setConfirmEmailModalOpen] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);

  if (!po) return null;

  const isPending = po.status === "Pending Approval";
  const isEmailPending = isPending && po.emailConfirmed === false;
  const isApproved = po.status === "Approved";
  const isCancellable = po.status === "Pending Approval";
  const canScheduleDelivery =
    !isAdmin &&
    !!onCreateDelivery &&
    ["Approved", "Ordered", "Partially Delivered"].includes(po.status) &&
    (po.hasRemainingToSchedule ?? po.status === "Approved");

  const buildGmailUrl = () => {
    const orderDetailsLines = (po.items || [])
      .map((r, i) => `${i + 1}. ${r.itemName} - ${r.poItemQuantity} ${r.purchaseUomName || "Unit"}`)
      .join("\n");
    const contactName = po.supplierContactPerson
      ? `Mr./Ms. ${po.supplierContactPerson}`
      : po.supplierName || "Valued Supplier Partner";
    const supplierCompany = po.supplierName || "your company";
    const supplierEmail = po.supplierEmail?.trim() || "";
    const emailSubject = `Purchase Order ${po.poNumber} - Bren Raphael's Ube Jam & Halaya`;
    const emailBody =
      `Dear ${contactName},\n\n` +
      `Good day!\n\n` +
      `On behalf of Bren Raphael's Ube Jam & Halaya, we would like to formally place Purchase Order No. ${po.poNumber} (Ref. ${po.prNumber || "N/A"}) with ${supplierCompany}. Please find the official Purchase Order document (${po.poNumber}.pdf) attached to this email for your reference.\n\n` +
      `Requested Order Particulars:\n` +
      `${orderDetailsLines}\n\n` +
      `To confirm this order, kindly reply to this email with the following details:\n` +
      `1. The exact quantity you can accommodate for each requested item.\n` +
      `2. The total price for each item and the overall total order amount.\n` +
      `3. Your committed delivery date.\n` +
      `4. The full name, position, and contact number of the authorized representative confirming this order.\n\n` +
      `Should you have any questions, please feel free to reach out to us.\n\n` +
      `Thank you very much, and we look forward to your confirmation.\n\n` +
      `Respectfully,\n\n` +
      `${po.requestedBy || "Vince Neil Madeja"}\n` +
      `Inventory Management & Procurement\n` +
      `Bren Raphael's Ube Jam & Halaya`;
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supplierEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  };

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

  const contactSummary =
    [po.supplierContactPerson, po.supplierPhone || po.supplierEmail].filter(Boolean).join(" · ") ||
    "—";

  const containerClasses =
    variant === "page"
      ? embedded
        ? "space-y-5 pb-10 animate-page-in"
        : "page-container px-4 sm:px-8 w-full space-y-5 pb-10 animate-page-in"
      : "space-y-5";

  return (
    <div className={containerClasses}>
      {/* Top Header (Matches Figma: Purchase order · PO-2026-0151) */}
      <div className="space-y-2">
        {variant === "page" && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Purchase orders</span>
          </button>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {variant === "page" && (
                <h1 className="type-page-title text-ink tabular-nums">{po.poNumber}</h1>
              )}
              <StatusBadge status={po.status} />
            </div>
            <p className="type-body-secondary text-ink-muted">
              {po.supplierName || "—"} &middot; ordered {fmt(po.orderDate)} &middot; expected{" "}
              {fmt(po.expectedArrivalDate)}
            </p>
          </div>

          {/* Header Action Buttons (Page Mode — matches Figma top-right action bar) */}
          {variant === "page" && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isAdmin && isCancellable && onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onCancel(po)}
                  className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
                >
                  Cancel Purchase Order
                </Button>
              )}

              {onPrint && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onPrint(po)}
                  className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
              )}

              {!isAdmin && isPending && onApproveWithForm && (
                <Button
                  type="button"
                  disabled={isEmailPending}
                  title={
                    isEmailPending
                      ? "Confirm that the email was sent to the supplier before approving this order"
                      : undefined
                  }
                  onClick={() => onApproveWithForm(po)}
                  className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Approve Order
                </Button>
              )}

              {canScheduleDelivery && (
                <Button
                  type="button"
                  onClick={() => onCreateDelivery?.(po)}
                  className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer inline-flex items-center gap-1.5"
                >
                  <PackageCheck className="w-4 h-4" />
                  Schedule Delivery
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Clean Gmail Send Confirmation Card (shown in upper part when Pending Approval PO wasn't confirmed via Done yet) */}
      {!isAdmin && isEmailPending && (
        <div className="rounded-card border border-border bg-surface p-5 space-y-5">
          {/* Summary Card (2x2) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-inner bg-page border border-divider">
            <div>
              <span className="text-ink-muted block type-caption mb-1">Purchase Order Number</span>
              <span className="type-body-strong text-ink tabular-nums">{po.poNumber}</span>
            </div>
            <div>
              <span className="text-ink-muted block type-caption mb-1">Supplier</span>
              <span className="type-body-strong text-ink">{po.supplierName || "—"}</span>
            </div>
            <div>
              <span className="text-ink-muted block type-caption mb-1">Recipient Email</span>
              <span className="type-body-strong text-ink break-all">
                {po.supplierEmail || "No email registered"}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block type-caption mb-1">Contact person</span>
              <span className="type-body-strong text-ink">
                {po.supplierContactPerson || po.supplierName || "—"}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="table-card">
            <table className="w-full type-table-cell">
              <thead className="table-head-row border-b border-divider">
                <tr>
                  <th className="table-th text-left">Item</th>
                  <th className="table-th text-left">Unit</th>
                  <th className="table-th text-right">Order Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {(po.items || []).map((row, idx) => (
                  <tr key={idx} className="hover:bg-page table-row">
                    <td className="table-td font-medium text-ink">{row.itemName}</td>
                    <td className="table-td text-ink-muted">{row.purchaseUomName || "Unit"}</td>
                    <td className="table-td text-right font-semibold text-ink tabular-nums">
                      {Number(row.poItemQuantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Next Steps in Gmail */}
          <div className="p-4 rounded-inner bg-page border border-divider type-body-secondary space-y-2">
            <span className="type-subsection text-ink block">Next steps in Gmail</span>
            <ol className="list-decimal list-inside space-y-1 text-ink-secondary">
              <li>
                Attach the downloaded <strong className="text-ink">{po.poNumber}.pdf</strong> in the
                opened Gmail tab.
              </li>
              <li>Review the formal email message and supplier questionnaire.</li>
              <li>
                Click <strong className="text-ink">Send</strong> in Gmail, then click{" "}
                <strong className="text-ink">Done</strong> below.
              </li>
            </ol>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-divider">
            <Button
              type="button"
              variant="outline"
              disabled={confirmingEmail}
              onClick={onClose}
              className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
            >
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={confirmingEmail}
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.open(buildGmailUrl(), "_blank", "noopener,noreferrer");
                }
                void downloadPurchaseOrderPdf(po);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
            >
              <Mail className="w-4 h-4 text-primary" />
              Edit Gmail
            </Button>
            {onConfirmEmailSent && (
              <Button
                type="button"
                disabled={confirmingEmail}
                onClick={() => setConfirmEmailModalOpen(true)}
                className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer disabled:opacity-50"
              >
                {confirmingEmail ? "Confirming..." : "Done"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Conditional Status Banners */}
      {po.supplierApprovedBy && (
        <div className="p-3.5 rounded-inner border border-status-green-fg/20 bg-status-green-bg text-status-green-fg flex items-center justify-between flex-wrap gap-2 type-caption">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              <strong>Supplier Approved by:</strong> {po.supplierApprovedBy}
            </span>
          </div>
          {po.supplierApprovedDate && (
            <span className="font-medium">Date: {fmt(po.supplierApprovedDate)}</span>
          )}
        </div>
      )}

      {po.adminNotes && !po.supplierApprovedBy && (
        <div
          className={`p-3.5 rounded-inner border space-y-1 ${po.status === "Cancelled"
            ? "border-notice-danger-border bg-notice-danger-bg text-notice-danger-text"
            : "border-border bg-page text-ink"
            }`}
        >
          <div className="flex items-center gap-2 type-label-field">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {po.status === "Cancelled" ? "Cancellation Reason:" : "Notes / Remarks:"}
            </span>
          </div>
          <p className="type-body-secondary pl-6 whitespace-pre-wrap leading-relaxed">
            {po.adminNotes}
          </p>
        </div>
      )}

      {/* Main Two-Column Body (Matches Figma: Left = Items + Order details, Right = Summary + Activity) */}
      <div
        className={
          variant === "page"
            ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start"
            : "space-y-5"
        }
      >
        {/* Left Column */}
        <div className="min-w-0 space-y-5">
          {/* Card 1: Items */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="type-subsection text-ink">Items</h2>
              <span className="type-caption text-ink-muted tabular-nums">
                {po.items?.length || 0} item(s) listed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full type-table-cell border-collapse">
                <thead>
                  <tr className="border-b border-divider">
                    <th className="pb-2.5 pt-1 pr-3 text-left type-table-header text-ink-muted">
                      Item
                    </th>
                    <th className="pb-2.5 pt-1 px-3 text-right type-table-header text-ink-muted whitespace-nowrap">
                      Ordered
                    </th>
                    {!isPending && (
                      <>
                        <th className="pb-2.5 pt-1 px-3 text-right type-table-header text-ink-muted whitespace-nowrap">
                          Received
                        </th>
                        <th className="pb-2.5 pt-1 px-3 text-right type-table-header text-ink-muted whitespace-nowrap">
                          Remaining
                        </th>
                        <th className="pb-2.5 pt-1 px-3 text-right type-table-header text-ink-muted whitespace-nowrap">
                          UNIT PRICE
                        </th>
                        <th className="pb-2.5 pt-1 pl-3 text-right type-table-header text-ink-muted whitespace-nowrap">
                          Total
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {po.items && po.items.length > 0 ? (
                    po.items.map((item, idx) => {
                      const ordered = Number(item.poItemQuantity || 0);
                      const received = Number(item.receivedQuantity || 0);
                      const remaining = Math.max(0, ordered - received);
                      const unitPrice =
                        item.unitPrice || (ordered > 0 ? item.totalPrice / ordered : 0);
                      return (
                        <tr key={idx} className="hover:bg-page transition-colors">
                          <td className="py-3 pr-3 align-top">
                            <div className="font-medium text-ink">{item.itemName}</div>
                            <div className="type-caption text-ink-muted">
                              {item.purchaseUomName || "Unit"}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-ink tabular-nums align-top whitespace-nowrap">
                            {ordered.toLocaleString()}
                          </td>
                          {!isPending && (
                            <>
                              <td
                                className={`py-3 px-3 text-right tabular-nums align-top whitespace-nowrap ${received > 0 ? "text-ink" : "text-ink-disabled"
                                  }`}
                              >
                                {received.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-medium text-ink tabular-nums align-top whitespace-nowrap">
                                {remaining.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right text-ink-secondary tabular-nums align-top whitespace-nowrap">
                                {unitPrice > 0 ? fmtCurrency(unitPrice) : "Pending Confirmation"}
                              </td>
                              <td className="py-3 pl-3 text-right font-semibold text-ink tabular-nums align-top whitespace-nowrap">
                                {item.totalPrice > 0 ? fmtCurrency(Number(item.totalPrice)) : "—"}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={isPending ? 2 : 6}
                        className="py-8 text-center type-body-secondary text-ink-muted"
                      >
                        No items in this purchase order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: Order details (3-column × 2-row metadata grid matching Figma) */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            <h2 className="type-subsection text-ink">Order details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <div className="type-caption text-ink-muted mb-1">Supplier</div>
                <div className="type-body-secondary font-medium text-ink">
                  {po.supplierName || "—"}
                </div>
              </div>

              <div>
                <div className="type-caption text-ink-muted mb-1">Contact</div>
                <div className="type-body-secondary font-medium text-ink break-words">
                  {contactSummary}
                </div>
              </div>

              <div>
                <div className="type-caption text-ink-muted mb-1">Purchase Requisition</div>
                <div className="type-body-secondary font-medium text-primary tabular-nums">
                  {po.prNumber || "—"}
                </div>
              </div>

              <div>
                <div className="type-caption text-ink-muted mb-1">Order Date</div>
                <div className="type-body-secondary font-medium text-ink">
                  {fmt(po.orderDate)}
                </div>
              </div>

              <div>
                <div className="type-caption text-ink-muted mb-1">Created by</div>
                <div className="type-body-secondary font-medium text-ink">
                  {po.requestedBy || "—"}
                </div>
              </div>

              <div>
                <div className="type-caption text-ink-muted mb-1">Expected Arrival Date</div>
                <div className="type-body-secondary font-medium text-ink">
                  {fmt(po.expectedArrivalDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Summary + Activity */}
        <div className="space-y-5">
          {/* Card 1: Summary (hidden while Pending Approval before supplier confirmation) */}
          {!isPending && (
            <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
              <h2 className="type-subsection text-ink">Summary</h2>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3 type-body-secondary">
                  <span className="text-ink-muted">
                    Subtotal &middot; {po.items?.length || 0}{" "}
                    {(po.items?.length || 0) === 1 ? "item" : "items"}
                  </span>
                  <span className="font-medium text-ink tabular-nums">
                    {po.totalAmount > 0 ? fmtCurrency(po.totalAmount) : "₱0.00"}
                  </span>
                </div>
              </div>

              <div className="border-t border-divider pt-3 flex items-center justify-between gap-3">
                <span className="type-subsection text-ink">TOTAL AMOUNT DUE</span>
                <span className="type-modal-title text-ink tabular-nums">
                  {po.totalAmount > 0
                    ? fmtCurrency(po.totalAmount)
                    : isApproved
                      ? "₱0.00"
                      : "Pending Confirmation"}
                </span>
              </div>
            </div>
          )}

          {/* Card 2: Activity Timeline (Matches Figma right-rail Activity card) */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
            <h2 className="type-subsection text-ink">Activity</h2>

            <div className="space-y-3.5">
              {po.supplierApprovedBy && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 rounded-pill bg-success shrink-0" />
                  <div className="min-w-0">
                    <div className="type-body-secondary font-medium text-ink">
                      Supplier confirmed order
                    </div>
                    <div className="type-caption text-ink-muted">
                      {fmt(po.supplierApprovedDate)} &middot; {po.supplierApprovedBy}
                    </div>
                  </div>
                </div>
              )}

              {po.status === "Cancelled" && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 rounded-pill bg-destructive shrink-0" />
                  <div className="min-w-0">
                    <div className="type-body-secondary font-medium text-ink">
                      Purchase order cancelled
                    </div>
                    <div className="type-caption text-ink-muted">
                      {po.adminNotes || "Order was cancelled"}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 rounded-pill bg-info shrink-0" />
                <div className="min-w-0">
                  <div className="type-body-secondary font-medium text-ink">
                    Order emailed to supplier
                  </div>
                  <div className="type-caption text-ink-muted break-all">
                    {fmt(po.orderDate)} &middot; {po.supplierEmail || po.supplierName}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 rounded-pill bg-primary shrink-0" />
                <div className="min-w-0">
                  <div className="type-body-secondary font-medium text-ink">Order created</div>
                  <div className="type-caption text-ink-muted">
                    {fmt(po.orderDate)} &middot; by {po.requestedBy || "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Footer Actions (Modal Mode Only — preserves backward compatibility) */}
      {variant === "modal" && (
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-divider flex-wrap">
          {!isAdmin && isCancellable && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel(po)}
              className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
            >
              Cancel Purchase Order
            </Button>
          )}

          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
          >
            Close
          </ModalCloseButton>

          {!isAdmin && isPending && onApproveWithForm && (
            <Button
              type="button"
              disabled={isEmailPending}
              onClick={() => onApproveWithForm(po)}
              className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Approve Order
            </Button>
          )}

          {canScheduleDelivery && (
            <Button
              type="button"
              onClick={() => onCreateDelivery?.(po)}
              className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
            >
              Schedule Delivery
            </Button>
          )}
        </div>
      )}

      <ActionConfirmModal
        open={confirmEmailModalOpen}
        title="Confirm Purchase Order Sent"
        subtitle={`Purchase Order Number: ${po.poNumber}`}
        description={`Have you sent the email with ${po.poNumber}.pdf attached to ${po.supplierEmail || po.supplierName} in Gmail? Confirming will unlock Approve Order so you can confirm the order when the supplier replies.`}
        confirmLabel="Confirm Sent"
        submitting={confirmingEmail}
        onCancel={() => setConfirmEmailModalOpen(false)}
        onConfirm={async () => {
          if (!onConfirmEmailSent) return;
          setConfirmEmailModalOpen(false);
          setConfirmingEmail(true);
          try {
            await onConfirmEmailSent(po);
          } finally {
            setConfirmingEmail(false);
          }
        }}
      />
    </div>
  );
}

/**
 * Full-page Purchase Order details view matching Figma "Purchase order · PO-2026-0151".
 */
export function PODetailsView(props: PODetailsProps & { embedded?: boolean }) {
  return <PODetailsBody {...props} variant="page" />;
}

/**
 * Backward-compatible modal wrapper for tests or modal triggers.
 */
export function PODetailsModal(props: PODetailsProps) {
  if (!props.po) return null;
  return (
    <ModalWrapper
      open={!!props.po}
      title={`Purchase Order Details — ${props.po.poNumber}`}
      onClose={props.onClose}
      size="max-w-[760px]"
    >
      <PODetailsBody {...props} variant="modal" />
    </ModalWrapper>
  );
}
