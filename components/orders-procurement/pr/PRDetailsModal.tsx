"use client";

import React, { useState } from "react";
import { AlertCircle, ChevronLeft, Download } from "lucide-react";
import { PurchaseRequisition } from "../types";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { normalizePrPriority } from "@/lib/orders/requisition-lifecycle";
import { downloadApprovedPrPdf } from "./downloadApprovedPrPdf";

export interface PRDetailsProps {
  isAdmin?: boolean;
  pr: PurchaseRequisition | null;
  onClose: () => void;
  onApprove?: (pr: PurchaseRequisition) => void;
  onReject?: (pr: PurchaseRequisition) => void;
  onReturn?: (pr: PurchaseRequisition) => void;
  onCancel?: (pr: PurchaseRequisition) => void;
  onCreatePo?: (pr: PurchaseRequisition) => void;
}

interface PRDetailsBodyProps extends PRDetailsProps {
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

function PRDetailsBody({
  pr,
  isAdmin = false,
  onClose,
  onApprove,
  onReject,
  onReturn,
  onCancel,
  onCreatePo,
  variant,
  embedded = false,
}: PRDetailsBodyProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  if (!pr) return null;

  const isPending = pr.status === "Pending Approval" || (pr.status as string) === "Pending";
  const isApproved = pr.status === "Approved";
  const displayPriority = normalizePrPriority(pr.priority);
  const requestedBy =
    pr.requestedBy && pr.requestedBy !== "Unauthenticated"
      ? pr.requestedBy
      : "Inventory Manager";
  const department = pr.department || "Inventory";
  const purpose = pr.purpose || pr.requestType || "Stock Replenishment";
  const formattedRequestDate = formatDisplayDate(pr.requestDate);
  const formattedRequiredDate = formatDisplayDate(pr.requiredDate);
  const items = pr.items || [];

  const duplicateItemIds = new Set(
    items
      .filter((item, index, list) => list.findIndex((candidate) => candidate.itemId === item.itemId) !== index)
      .map((item) => item.itemId)
  );
  const duplicateNames = Array.from(
    new Set(items.filter((item) => duplicateItemIds.has(item.itemId)).map((item) => item.itemName))
  );

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      setExportError("");
      await downloadApprovedPrPdf(pr);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setExportError(e?.message || "Unable to export Purchase Requisition PDF.");
    } finally {
      setExporting(false);
    }
  };

  const containerClasses =
    variant === "page"
      ? embedded
        ? "space-y-5 pb-10 animate-page-in"
        : "page-container px-4 sm:px-8 w-full space-y-5 pb-10 animate-page-in"
      : "space-y-5";

  return (
    <div className={containerClasses}>
      {/* Top Back Link, Page Title, Status Badge & Conditional Export Button (Approved Only) */}
      {variant === "page" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Purchase requisitions</span>
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="type-page-title text-ink tabular-nums">{pr.prNumber}</h1>
                <StatusBadge status={pr.status} />
              </div>
              <p className="type-body text-ink-muted">
                {isAdmin && isPending ? "Review purchase requisition" : "Purchase requisition details"} &middot;{" "}
                {department} &middot; {displayPriority} Priority
              </p>
            </div>

            {(isApproved || (!isAdmin && isPending && onCancel)) && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isAdmin && isPending && onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onCancel(pr)}
                    className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
                  >
                    Cancel Requisition
                  </Button>
                )}

                {isApproved && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportPdf}
                    disabled={exporting}
                    className="rounded-control border border-border bg-surface px-4 h-9 type-label-button-sm text-ink hover:bg-subtle shadow-none cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4 text-primary" />
                    <span>{exporting ? "Exporting..." : "Export"}</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal-only compact status bar (for backward-compatible PRDetailsModal) */}
      {variant === "modal" && (
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-divider">
          <div className="flex items-center gap-3">
            <StatusBadge status={pr.status} />
            <span className="type-caption text-ink-muted">
              {department} &middot; {displayPriority} Priority
            </span>
          </div>
          {isApproved && (
            <Button
              type="button"
              variant="outline"
              onClick={handleExportPdf}
              disabled={exporting}
              className="rounded-control border border-border bg-surface px-3.5 h-8 type-label-button-sm text-ink hover:bg-subtle shadow-none cursor-pointer inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>{exporting ? "Exporting..." : "Export"}</span>
            </Button>
          )}
        </div>
      )}

      {/* Export Error Banner */}
      {exportError && (
        <div
          role="alert"
          className="rounded-inner border border-notice-danger-border bg-notice-danger-bg p-3.5 type-caption font-medium text-notice-danger-text flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Feedback / Rejection / Return / Cancellation Reason Banner */}
      {pr.adminNotes ? (
        <div
          className={`p-4 rounded-inner border space-y-1.5 ${
            pr.status === "Cancelled" || pr.status === "Rejected"
              ? "border-notice-danger-border bg-notice-danger-bg text-notice-danger-text"
              : pr.status === "Returned"
                ? "border-notice-warning-border bg-notice-warning-bg text-notice-warning-text"
                : "border-border bg-page text-ink"
          }`}
        >
          <div className="flex items-center gap-2 type-label-field font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {pr.status === "Cancelled"
                ? "Cancellation Reason:"
                : pr.status === "Rejected"
                  ? "Rejection Reason:"
                  : pr.status === "Returned"
                    ? "Return / Revision Reason:"
                    : "Admin Feedback:"}
            </span>
          </div>
          <p className="type-body-secondary pl-6 whitespace-pre-wrap leading-relaxed">
            {pr.adminNotes}
          </p>
        </div>
      ) : pr.status === "Cancelled" || pr.status === "Rejected" ? (
        <div className="p-4 rounded-inner border border-notice-danger-border bg-notice-danger-bg space-y-1.5 text-notice-danger-text">
          <div className="flex items-center gap-2 type-label-field font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pr.status === "Cancelled" ? "Cancellation Reason:" : "Rejection Reason:"}</span>
          </div>
          <p className="type-body-secondary pl-6 text-ink-muted italic">
            No rejection or cancellation reason was recorded.
          </p>
        </div>
      ) : null}

      {/* Main 2-Column Layout (Matching CreatePRForm & Approved Figma 115:168 / 115:463 / 115:732) */}
      <div
        className={
          variant === "page"
            ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start"
            : "space-y-5"
        }
      >
        {/* Left Column: Requisition Details, Requested Items, Notes */}
        <div className="min-w-0 space-y-5">
          {/* Card 1: Requisition details */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            <h2 className="type-subsection text-ink">Requisition details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              {/* Purchase Requisition Number */}
              <div>
                <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                  Purchase Requisition No.
                </label>
                <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary select-all tabular-nums">
                  {pr.prNumber}
                </div>
              </div>

              {/* Request Date */}
              <div>
                <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                  Request Date
                </label>
                <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
                  {formattedRequestDate}
                </div>
              </div>

              {/* Required Date */}
              <div>
                <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                  Required Date
                </label>
                <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
                  {formattedRequiredDate}
                </div>
              </div>

              {/* Requested By */}
              <div>
                <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                  Requested By
                </label>
                <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
                  {requestedBy}
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                  Department
                </label>
                <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
                  {department}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                  Priority
                </label>
                <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
                  {displayPriority}
                </div>
              </div>

              {/* Purpose (Full width matching CreatePRForm) */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                  Purpose
                </label>
                <div className="flex items-center min-h-9 px-3 py-1.5 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
                  {purpose}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Requested items */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            {duplicateNames.map((name) => (
              <div
                key={name}
                className="flex items-start gap-2 rounded-inner border border-notice-danger-border bg-notice-danger-bg p-3 type-caption font-semibold text-notice-danger-text"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Warning: Duplicate ingredient detected - {name}. Please review and consolidate
                  before proceeding.
                </span>
              </div>
            ))}

            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="type-subsection text-ink">Requested items</h2>
                <p className="mt-0.5 type-caption text-ink-muted">
                  Raw materials, ingredients, or supplies requested for procurement.
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
                    <th className="pb-2.5 pt-1 pr-3 type-table-header text-ink-muted font-medium">
                      Supply Name
                    </th>
                    <th className="pb-2.5 pt-1 px-3 type-table-header text-ink-muted font-medium whitespace-nowrap">
                      Supply No.
                    </th>
                    <th className="pb-2.5 pt-1 px-3 type-table-header text-ink-muted font-medium whitespace-nowrap">
                      Unit
                    </th>
                    <th className="pb-2.5 pt-1 px-3 text-right type-table-header text-ink-muted font-medium whitespace-nowrap">
                      Actual Inv.
                    </th>
                    <th className="pb-2.5 pt-1 pl-3 text-right type-table-header text-ink-muted font-medium whitespace-nowrap">
                      Qty (To Order)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {items.length > 0 ? (
                    items.map((item, idx) => (
                      <tr
                        key={item.prItemId || `${item.itemId}-${idx}`}
                        className={
                          duplicateItemIds.has(item.itemId)
                            ? "bg-notice-danger-bg text-notice-danger-text"
                            : "hover:bg-page transition-colors"
                        }
                      >
                        <td className="py-3 pr-3 font-medium text-ink">{item.itemName}</td>
                        <td className="py-3 px-3 text-ink-secondary whitespace-nowrap tabular-nums">
                          {item.itemCode || `SPL-${item.itemId}`}
                        </td>
                        <td className="py-3 px-3 text-ink-secondary whitespace-nowrap">
                          {item.uomName || "Unit"}
                        </td>
                        <td className="py-3 px-3 text-right text-ink-secondary tabular-nums whitespace-nowrap">
                          {Number(item.actualInventory || 0).toLocaleString()}
                        </td>
                        <td className="py-3 pl-3 text-right font-semibold text-ink tabular-nums whitespace-nowrap">
                          {Number(item.requestedQuantity || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center type-body-secondary text-ink-muted"
                      >
                        No supplies or ingredients found in this requisition.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Notes */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-3">
            <h2 className="type-subsection text-ink">Notes</h2>
            <div
              className={`w-full rounded-control border border-border bg-page px-3 py-2.5 type-body-secondary leading-relaxed whitespace-pre-wrap ${
                pr.notes && pr.notes.trim() ? "text-ink" : "text-ink-muted"
              }`}
            >
              {pr.notes && pr.notes.trim() ? pr.notes : "No additional notes provided."}
            </div>
          </div>
        </div>

        {/* Right Column: Requisition Summary Card (Page Mode — identical to CreatePRForm) */}
        {variant === "page" && (
          <div className="space-y-5">
            <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
              <h2 className="type-subsection text-ink">Requisition summary</h2>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3 type-body-secondary">
                  <span className="text-ink-muted">Requisition No.</span>
                  <span className="font-medium text-ink tabular-nums">{pr.prNumber}</span>
                </div>
                <div className="flex items-center justify-between gap-3 type-body-secondary">
                  <span className="text-ink-muted">Status</span>
                  <span className="font-medium text-ink">{pr.status}</span>
                </div>
                <div className="flex items-center justify-between gap-3 type-body-secondary">
                  <span className="text-ink-muted">Request Date</span>
                  <span className="font-medium text-ink">{formattedRequestDate}</span>
                </div>
                <div className="flex items-center justify-between gap-3 type-body-secondary">
                  <span className="text-ink-muted">Required Date</span>
                  <span className="font-medium text-ink">{formattedRequiredDate}</span>
                </div>
                <div className="flex items-center justify-between gap-3 type-body-secondary">
                  <span className="text-ink-muted">Requested By</span>
                  <span className="font-medium text-ink truncate max-w-[170px]">{requestedBy}</span>
                </div>
                <div className="flex items-center justify-between gap-3 type-body-secondary">
                  <span className="text-ink-muted">Department</span>
                  <span className="font-medium text-ink">{department}</span>
                </div>
                <div className="flex items-center justify-between gap-3 type-body-secondary">
                  <span className="text-ink-muted">Priority</span>
                  <span className="font-medium text-ink">{displayPriority}</span>
                </div>
                <div className="flex items-start justify-between gap-3 type-body-secondary">
                  <span className="text-ink-muted shrink-0">Purpose</span>
                  <span className="font-medium text-ink text-right break-words">{purpose}</span>
                </div>
              </div>

              <div className="border-t border-divider pt-3 flex items-center justify-between gap-3">
                <span className="type-subsection text-ink">Total items requested</span>
                <span className="type-card-title text-primary tabular-nums">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar (Matching CreatePRForm) */}
      <div
        className={
          variant === "page"
            ? "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-divider pt-4"
            : "flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-divider"
        }
      >
        <div className="type-caption text-ink-muted">
          {pr.updatedAt ? `Last modified: ${new Date(pr.updatedAt).toLocaleString()}` : ""}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 ml-auto">
          {/* Modal-only Cancel action (Page Mode renders Cancel in the top header bar, matching PODetailsView) */}
          {variant === "modal" && !isAdmin && isPending && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel(pr)}
              className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
            >
              Cancel Requisition
            </Button>
          )}

          {variant === "modal" ? (
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
            >
              Close
            </ModalCloseButton>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
            >
              Close
            </Button>
          )}

          {/* Admin Operations for Pending PRs */}
          {isAdmin && isPending && (
            <>
              {onReturn && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onReturn(pr)}
                  className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
                >
                  Return for Revision
                </Button>
              )}

              {onReject && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onReject(pr)}
                  className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-destructive hover:bg-notice-danger-bg shadow-none cursor-pointer"
                >
                  Reject
                </Button>
              )}

              {onApprove && (
                <Button
                  type="button"
                  onClick={() => onApprove(pr)}
                  className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
                >
                  Approve
                </Button>
              )}
            </>
          )}

          {/* Create PO for Approved PRs with remaining items */}
          {!isAdmin && isApproved && !pr.isFullyConvertedToPo && onCreatePo && (
            <Button
              type="button"
              onClick={() => onCreatePo(pr)}
              className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none cursor-pointer"
            >
              Create Purchase Order
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Full-page Purchase Requisition details view matching CreatePRForm & Figma 115:168 / 115:463 / 115:732.
 */
export function PRDetailsView(props: PRDetailsProps & { embedded?: boolean }) {
  return <PRDetailsBody {...props} variant="page" />;
}

/**
 * Backward-compatible modal wrapper for tests or standalone modal callers.
 */
export function PRDetailsModal(props: PRDetailsProps) {
  if (!props.pr) return null;
  const isPending =
    props.pr.status === "Pending Approval" || (props.pr.status as string) === "Pending";

  return (
    <ModalWrapper
      open={!!props.pr}
      title={
        props.isAdmin && isPending
          ? `Review Product Requisition — ${props.pr.prNumber}`
          : `Product Requisition Details — ${props.pr.prNumber}`
      }
      onClose={props.onClose}
      size="max-w-3xl"
      confirmOnClose={false}
    >
      <PRDetailsBody {...props} variant="modal" />
    </ModalWrapper>
  );
}
