"use client";

import { receiving } from "@/lib/receiving/client";

import React, { useState } from "react";
import { AlertTriangle, ChevronLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import NestedDialog from "./NestedDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GRN } from "./types";
import { downloadGrnReportPdf } from "./downloadGrnReportPdf";

export interface GrnDetailsProps {
  grn: GRN | null;
  onClose: () => void;
  onUpdated: () => void;
  onPosted: () => void;
}

export interface GrnDetailsModalProps extends GrnDetailsProps {
  open: boolean;
}

interface GrnDetailsBodyProps extends GrnDetailsProps {
  variant: "page" | "modal";
  embedded?: boolean;
}

function formatDisplayDate(raw?: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatGrnStatusLabel(status?: string | null): string {
  if (!status) return "—";
  switch (status) {
    case "QaPending":
      return "Pending QA";
    case "QaCompleted":
      return "Completed";
    case "PartiallyPutAway":
      return "Partially Put Away";
    case "FullyPutAway":
      return "Fully Put Away";
    default:
      return status;
  }
}

function GrnDetailsBody({
  grn,
  onClose,
  onUpdated,
  onPosted,
  variant,
  embedded = false,
}: GrnDetailsBodyProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);

  if (!grn) return null;

  const isDraft = grn.status === "Draft";
  const items = grn.items || [];
  const hasAnyExpiry = items.some((i) => Boolean(i.expiryDate));
  const totalAcceptedQty = items.reduce((sum, i) => sum + Number(i.deliveredQuantity || 0), 0);
  const formattedReceivedDate = formatDisplayDate(grn.receivedDate);

  const handlePost = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await receiving.postReceipt(grn.grnId);
      if (res.data?.success) {
        onUpdated();
        onClose();
        onPosted();
      } else {
        setError(res.data?.message || "Failed to post Goods Receipt Note.");
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
          ? err.message
          : "Failed to post Goods Receipt Note.";
      setError(msg || "Failed to post Goods Receipt Note.");
    } finally {
      setLoading(false);
    }
  };

  const executeCancel = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await receiving.cancelReceipt(grn.grnId);
      if (res.data?.success) {
        setCancelModalOpen(false);
        onUpdated();
        onClose();
      } else {
        setError(res.data?.message || "Failed to cancel Goods Receipt Note.");
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
          ? err.message
          : "Failed to cancel Goods Receipt Note.";
      setError(msg || "Failed to cancel Goods Receipt Note.");
    } finally {
      setLoading(false);
      setCancelModalOpen(false);
    }
  };

  const handleExport = async () => {
    try {
      await downloadGrnReportPdf({
        grnNumber: grn.grnNumber,
        deliveryNumber: grn.deliveryNumber,
        poNumber: grn.poNumber,
        supplierName: grn.supplierName,
        carrier: grn.carrier,
        deliveryNoteNumber: grn.deliveryNoteNumber,
        receivedDate: grn.receivedDate,
        status: grn.status,
        receivedBy: grn.receivedBy || "Commissary Warehouse Staff",
        inspectorName: "Quality Assurance Department",
        notes: grn.notes,
        items: items.map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          purchaseUomName: item.purchaseUomName,
          declaredQuantity: item.declaredQuantity ?? item.orderedQuantity,
          deliveredQuantity: item.deliveredQuantity,
          acceptedQuantity: item.deliveredQuantity,
          rejectedQuantity: 0,
          supplierLotCode: item.supplierLotCode,
          expiryDate: item.expiryDate,
          notes: item.notes,
        })),
      });
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    }
  };

  const containerClasses =
    variant === "page"
      ? embedded
        ? "space-y-6 pb-12 animate-page-in"
        : "page-container px-4 sm:px-8 w-full space-y-6 pb-12 animate-page-in"
      : "space-y-5";

  const statusHelperText =
    grn.status === "FullyPutAway"
      ? "Status: Quality Assurance Completed · All accepted items stocked into inventory."
      : grn.status === "QaCompleted" || grn.status === "PartiallyPutAway"
      ? "Status: Quality Assurance Completed · Accepted items are ready for Stock-In."
      : grn.status === "Received" || grn.status === "QaPending"
      ? "Status: Awaiting Quality Assurance review."
      : grn.status === "Rejected"
      ? "Status: Goods Receipt Note rejected."
      : `Status: ${grn.status}`;

  return (
    <>
      <div className={containerClasses}>
        {/* Top Back Breadcrumb, Page Title, Status Badge & Top-Right Actions (Page Mode) */}
        {variant === "page" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Goods receipt notes</span>
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="type-page-title text-ink tabular-nums">{grn.grnNumber}</h1>
                  <StatusBadge status={grn.status} />
                </div>
                <p className="type-body text-ink-muted">
                  Goods receipt note details
                  {grn.deliveryNumber ? ` · ${grn.deliveryNumber}` : ""}
                  {grn.supplierName ? ` · ${grn.supplierName}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isDraft && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCancelModalOpen(true)}
                    disabled={loading}
                    className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
                  >
                    Cancel Draft
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExport}
                  disabled={loading}
                  className="rounded-control border border-border bg-surface px-4 h-9 type-label-button-sm text-ink hover:bg-subtle shadow-none cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4 text-primary" />
                  <span>Export Goods Receipt Note</span>
                </Button>

                {isDraft && (
                  <Button
                    type="button"
                    onClick={() => setPostModalOpen(true)}
                    disabled={loading}
                    className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
                  >
                    {loading ? "Posting…" : "Post Goods Receipt Note"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal-only compact status bar (backward-compatible GrnDetailsModal) */}
        {variant === "modal" && (
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-divider">
            <div className="flex items-center gap-3">
              <StatusBadge status={grn.status} />
              <span className="type-caption text-ink-muted">
                {grn.deliveryNumber || "—"}
                {grn.supplierName ? ` · ${grn.supplierName}` : ""}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-control border border-notice-danger-border bg-notice-danger-bg text-notice-danger-text type-body p-3"
          >
            {error}
          </div>
        )}

        {/* Main 2-Column Layout (Matching CreateGrnForm & Figma Page 2 New PO) */}
        <div
          className={
            variant === "page"
              ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start"
              : "space-y-5"
          }
        >
          {/* Left Column */}
          <div className="min-w-0 space-y-6">
            {/* Workflow Status Banner */}
            {(grn.status === "Received" || grn.status === "QaPending") && (
              <div className="rounded-inner border border-border bg-surface px-4 py-3.5 flex items-center gap-3">
                <span className="w-2 h-2 rounded-pill bg-status-amber-fg shrink-0" />
                <div>
                  <div className="type-body-secondary font-semibold text-ink">
                    Awaiting Quality Assurance Review
                  </div>
                  <div className="type-caption text-ink-muted mt-0.5">
                    Complete the Quality Assurance review for {grn.grnNumber} to release accepted
                    items for Stock-In.
                  </div>
                </div>
              </div>
            )}

            {(grn.status === "QaCompleted" ||
              grn.status === "PartiallyPutAway" ||
              grn.status === "FullyPutAway") && (
              <div className="rounded-inner border border-border bg-surface px-4 py-3.5 flex items-center gap-3">
                <span className="w-2 h-2 rounded-pill bg-success shrink-0" />
                <div>
                  <div className="type-body-secondary font-semibold text-ink">
                    Quality Assurance Completed
                  </div>
                  <div className="type-caption text-ink-muted mt-0.5">
                    {grn.status === "FullyPutAway"
                      ? "All accepted items from this Goods Receipt Note have been stocked into inventory."
                      : "Accepted items from this Goods Receipt Note are ready for Stock-In."}
                  </div>
                </div>
              </div>
            )}

            {grn.status === "Rejected" && (
              <div className="rounded-inner border border-notice-danger-border bg-notice-danger-bg px-4 py-3.5 flex items-center gap-3 text-notice-danger-text">
                <span className="w-2 h-2 rounded-pill bg-destructive shrink-0" />
                <div>
                  <div className="type-body-secondary font-semibold">Shipment Rejected</div>
                  <div className="type-caption mt-0.5">
                    {grn.rejectionReason ||
                      "This Goods Receipt Note was rejected and logged for discrepancy resolution."}
                  </div>
                </div>
              </div>
            )}

            {/* Card 1: Receipt details (2-column read-only text boxes matching Create GRN & New PO) */}
            <div className="rounded-card border border-border bg-surface p-6 space-y-5">
              <h2 className="type-subsection text-ink">Receipt details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 items-end">
                <div>
                  <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                    Goods Receipt Note No.
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary select-all tabular-nums">
                    {grn.grnNumber}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                    Delivery No.
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary tabular-nums">
                    {grn.deliveryNumber || "—"}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                    Received Date
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary">
                    {formattedReceivedDate}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                    Supplier
                  </label>
                  <div
                    className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary truncate"
                    title={grn.supplierName}
                  >
                    {grn.supplierName || "—"}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                    Receiving Bay
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary">
                    {grn.receivingBay || "Main Bay"}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                    Received By
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary truncate">
                    {grn.receivedBy || "Warehouse Staff"}
                  </div>
                </div>

                {grn.poNumber && (
                  <div>
                    <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                      Purchase Order Ref.
                    </label>
                    <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary tabular-nums">
                      {grn.poNumber}
                    </div>
                  </div>
                )}

                {grn.postedBy &&
                  grn.postedBy !== "System" &&
                  grn.postedBy !== "Not Posted" && (
                    <div>
                      <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                        Posted By
                      </label>
                      <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary truncate">
                        {grn.postedBy}
                      </div>
                    </div>
                  )}

                {grn.carrier && grn.carrier !== "N/A" && (
                  <div>
                    <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                      Carrier / Vehicle
                    </label>
                    <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary truncate">
                      {grn.carrier}
                    </div>
                  </div>
                )}

                {grn.supplierDrNumber && grn.supplierDrNumber !== "N/A" && (
                  <div>
                    <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                      Supplier DR #
                    </label>
                    <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary tabular-nums">
                      {grn.supplierDrNumber}
                    </div>
                  </div>
                )}

                {grn.supplierInvoiceNumber && grn.supplierInvoiceNumber !== "N/A" && (
                  <div>
                    <label className="mb-1.5 block type-label-field text-ink-strong whitespace-nowrap">
                      Supplier Invoice #
                    </label>
                    <div className="flex items-center h-10 px-3.5 rounded-control border border-input bg-page type-body-secondary text-ink-secondary tabular-nums">
                      {grn.supplierInvoiceNumber}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Received line items */}
            <div className="rounded-card border border-border bg-surface p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="type-subsection text-ink">Received line items</h2>
                  <p className="mt-0.5 type-caption text-ink-muted">
                    Verified quantities accepted after Quality Assurance inspection.
                  </p>
                </div>
                <span className="type-caption font-medium text-ink-muted tabular-nums">
                  {items.length} item(s) listed
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full type-table-cell text-left border-collapse">
                  <thead>
                    <tr className="border-b border-divider">
                      <th className="pb-2.5 pt-1 pr-2 type-table-header text-ink-muted font-medium whitespace-nowrap">
                        Item
                      </th>
                      <th className="pb-2.5 pt-1 px-2 type-table-header text-ink-muted font-medium whitespace-nowrap">
                        Unit
                      </th>
                      <th className="pb-2.5 pt-1 px-2 text-right type-table-header text-ink-muted font-medium whitespace-nowrap">
                        Ordered
                      </th>
                      <th className="pb-2.5 pt-1 px-2 text-right type-table-header text-ink-muted font-medium whitespace-nowrap">
                        Accepted
                      </th>
                      <th className="pb-2.5 pt-1 px-2 text-center type-table-header text-ink-muted font-medium whitespace-nowrap">
                        Variance
                      </th>
                      <th className="pb-2.5 pt-1 px-2 type-table-header text-ink-muted font-medium whitespace-nowrap">
                        Lot #
                      </th>
                      {hasAnyExpiry && (
                        <th className="pb-2.5 pt-1 pl-2 text-right type-table-header text-ink-muted font-medium whitespace-nowrap">
                          Expiry Date
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {items.length > 0 ? (
                      items.map((item, idx) => {
                        const itemRows = items.filter((i) => i.itemId === item.itemId);
                        const isMultiBatch = itemRows.length > 1;
                        const totalDeliveredForItem = itemRows.reduce(
                          (sum, r) => sum + Number(r.deliveredQuantity || 0),
                          0
                        );
                        const declaredForItem = Number(
                          item.declaredQuantity ?? item.orderedQuantity ?? 0
                        );
                        const netVariance = totalDeliveredForItem - declaredForItem;

                        const isExact =
                          netVariance === 0 ||
                          item.varianceType === "Exact" ||
                          (isMultiBatch && netVariance === 0);
                        const isShort =
                          !isExact && (netVariance < 0 || item.varianceType === "Short");
                        const isOver =
                          !isExact && (netVariance > 0 || item.varianceType === "Over");
                        const displayVarianceQty = Math.abs(
                          netVariance !== 0 ? netVariance : item.varianceQuantity
                        );

                        return (
                          <tr
                            key={item.grnItemId ?? `${item.itemId}-${idx}`}
                            className="hover:bg-page transition-colors"
                          >
                            <td className="py-3 pr-2 font-medium text-ink leading-snug">
                              {item.itemName}
                            </td>
                            <td className="py-3 px-2 text-ink-secondary whitespace-nowrap">
                              {item.purchaseUomName}
                            </td>
                            <td className="py-3 px-2 text-right text-ink-secondary tabular-nums whitespace-nowrap">
                              {Number(item.orderedQuantity || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-ink tabular-nums whitespace-nowrap">
                              {Number(item.deliveredQuantity || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-2 text-center whitespace-nowrap">
                              {isShort ? (
                                <span className="inline-flex items-center rounded-pill bg-status-red-bg px-2 py-0.5 type-badge text-status-red-fg">
                                  Short ({displayVarianceQty})
                                </span>
                              ) : isOver ? (
                                <span className="inline-flex items-center rounded-pill bg-status-green-bg px-2 py-0.5 type-badge text-status-green-fg">
                                  Over (+{displayVarianceQty})
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-pill bg-status-green-bg px-2 py-0.5 type-badge text-status-green-fg">
                                  Match
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-2 text-ink-secondary whitespace-nowrap tabular-nums">
                              {item.supplierLotCode || "—"}
                            </td>
                            {hasAnyExpiry && (
                              <td className="py-3 pl-2 text-right text-ink-secondary whitespace-nowrap">
                                {item.expiryDate
                                  ? formatDisplayDate(item.expiryDate)
                                  : "No Expiry"}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={hasAnyExpiry ? 7 : 6}
                          className="py-8 text-center type-body-secondary text-ink-muted"
                        >
                          No line items recorded on this Goods Receipt Note.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card 3: Receiving gate notes (Modal mode keeps it inline; Page mode moves it to right rail matching Create GRN & New PO) */}
            {variant === "modal" && (
              <div className="rounded-card border border-border bg-surface p-5 space-y-3">
                <h2 className="type-subsection text-ink">Receiving gate notes</h2>
                <div
                  className={`w-full rounded-control border border-input bg-page px-3.5 py-2.5 type-body-secondary leading-relaxed whitespace-pre-wrap ${
                    grn.notes && grn.notes.trim() ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  {grn.notes && grn.notes.trim() ? grn.notes : "No additional dock notes provided."}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Receipt Summary + Receiving Gate Notes (Page Mode — Identical to CreateGrnForm & New PO) */}
          {variant === "page" && (
            <div className="space-y-6 xl:sticky xl:top-5">
              <div className="rounded-card border border-border bg-surface p-6 space-y-4">
                <h2 className="type-subsection text-ink">Receipt summary</h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">GRN No.</span>
                    <span className="font-medium text-ink tabular-nums">{grn.grnNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Status</span>
                    <span className="font-medium text-ink">{formatGrnStatusLabel(grn.status)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Delivery No.</span>
                    <span className="font-medium text-ink tabular-nums">
                      {grn.deliveryNumber || "—"}
                    </span>
                  </div>
                  {grn.poNumber && (
                    <div className="flex items-center justify-between gap-3 type-body-secondary">
                      <span className="text-ink-muted">Purchase Order</span>
                      <span className="font-medium text-ink tabular-nums">{grn.poNumber}</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted shrink-0">Supplier</span>
                    <span className="font-medium text-ink text-right break-words">
                      {grn.supplierName || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Received Date</span>
                    <span className="font-medium text-ink">{formattedReceivedDate}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Receiving Bay</span>
                    <span className="font-medium text-ink">{grn.receivingBay || "Main Bay"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Received By</span>
                    <span className="font-medium text-ink truncate max-w-[170px]">
                      {grn.receivedBy || "Warehouse Staff"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-divider pt-3.5 flex items-center justify-between gap-3">
                  <span className="type-subsection text-ink">Total accepted qty</span>
                  <span className="type-card-title text-primary tabular-nums">
                    {totalAcceptedQty.toLocaleString()}{" "}
                    {totalAcceptedQty === 1 ? "unit" : "units"}
                  </span>
                </div>
              </div>

              {/* Right Rail Card 2: Receiving gate notes */}
              <div className="rounded-card border border-border bg-surface p-6 space-y-3.5">
                <h2 className="type-subsection text-ink">Receiving gate notes</h2>
                <div
                  className={`w-full rounded-control border border-input bg-page px-3.5 py-2.5 type-body-secondary leading-relaxed whitespace-pre-wrap ${
                    grn.notes && grn.notes.trim() ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  {grn.notes && grn.notes.trim() ? grn.notes : "No additional dock notes provided."}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div
          className={
            variant === "page"
              ? "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-divider pt-4"
              : "flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-divider"
          }
        >
          {variant === "page" && (
            <p className="type-caption text-ink-muted">{statusHelperText}</p>
          )}

          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            {variant === "modal" && isDraft && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelModalOpen(true)}
                disabled={loading}
                className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
              >
                Cancel Draft
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={loading}
              className="rounded-control border border-border bg-surface px-4 h-9 type-label-button-sm text-ink hover:bg-subtle shadow-none cursor-pointer inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-primary" />
              <span>Export Goods Receipt Note</span>
            </Button>

            {variant === "modal" ? (
              <ModalNativeCloseButton
                fallbackOnClose={onClose}
                disabled={loading}
                className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Close
              </ModalNativeCloseButton>
            ) : (
              <Button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
              >
                Close
              </Button>
            )}

            {variant === "modal" && isDraft && (
              <Button
                type="button"
                onClick={() => setPostModalOpen(true)}
                disabled={loading}
                className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
              >
                {loading ? "Posting…" : "Post Goods Receipt Note"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Post Draft GRN (Preserved) */}
      <NestedDialog
        open={postModalOpen}
        title="Post Goods Receipt Note"
        onClose={() => setPostModalOpen(false)}
        maxWidth={480}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-pill bg-subtle flex items-center justify-center mb-4 text-status-amber-fg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="type-modal-title text-ink mb-1">Post Goods Receipt Note</h2>
          <p className="type-caption font-semibold text-ink-muted mb-3">
            GRN No: {grn.grnNumber}
          </p>
          <p className="type-body text-ink-secondary mb-6 leading-relaxed">
            Are you sure you want to post Draft Goods Receipt Note {grn.grnNumber} and submit it
            for Quality Assurance review?
          </p>
          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setPostModalOpen(false)}
              disabled={loading}
              className="flex-1 h-10 px-4 type-label-button text-ink border border-input bg-surface hover:bg-subtle rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setPostModalOpen(false);
                await handlePost();
              }}
              className="flex-1 h-10 px-4 type-label-button bg-primary text-on-brand hover:bg-primary-hover rounded-control transition-colors shadow-none disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Posting…" : "Confirm & Post"}
            </button>
          </div>
        </div>
      </NestedDialog>

      {/* Confirmation Modal: Cancel Draft GRN (Preserved) */}
      <NestedDialog
        open={cancelModalOpen}
        title="Cancel Goods Receipt Note"
        onClose={() => setCancelModalOpen(false)}
        maxWidth={480}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-pill bg-subtle flex items-center justify-center mb-4 text-status-amber-fg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="type-modal-title text-ink mb-1">Cancel Goods Receipt Note</h2>
          <p className="type-caption font-semibold text-ink-muted mb-3">
            GRN No: {grn.grnNumber}
          </p>
          <p className="type-body text-ink-secondary mb-6 leading-relaxed">
            Are you sure you want to cancel Draft Goods Receipt Note {grn.grnNumber}? This action
            cannot be undone.
          </p>
          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              disabled={loading}
              className="flex-1 h-10 px-4 type-label-button text-ink border border-input bg-surface hover:bg-subtle rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={executeCancel}
              className="flex-1 h-10 px-4 type-label-button bg-primary text-on-brand hover:bg-primary-hover rounded-control transition-colors shadow-none disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Cancelling…" : "Confirm Cancel"}
            </button>
          </div>
        </div>
      </NestedDialog>
    </>
  );
}

/**
 * Full-page Goods Receipt Note details view matching CreateGrnForm & Figma 142:433.
 */
export function GrnDetailsView(props: GrnDetailsProps & { embedded?: boolean }) {
  return <GrnDetailsBody {...props} variant="page" />;
}

/**
 * Backward-compatible modal wrapper for tests or standalone modal callers.
 */
export default function GrnDetailsModal({
  grn,
  open,
  onClose,
  onUpdated,
  onPosted,
}: GrnDetailsModalProps) {
  if (!grn) return null;

  return (
    <ModalWrapper
      open={open}
      title={`Goods Receipt Note — ${grn.grnNumber}`}
      onClose={onClose}
      size="max-w-3xl"
      confirmOnClose={false}
    >
      <GrnDetailsBody
        grn={grn}
        onClose={onClose}
        onUpdated={onUpdated}
        onPosted={onPosted}
        variant="modal"
      />
    </ModalWrapper>
  );
}
