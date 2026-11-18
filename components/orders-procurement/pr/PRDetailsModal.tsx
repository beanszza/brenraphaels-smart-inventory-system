"use client";

import React, { useState } from "react";
import { AlertCircle, Download } from "lucide-react";
import { PurchaseRequisition } from "../types";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { procurement } from "@/lib/orders/client";
import { normalizePrPriority } from "@/lib/orders/requisition-lifecycle";
import { downloadRequisitionReportPdf } from "./downloadRequisitionReportPdf";

interface PRDetailsModalProps {
  isAdmin?: boolean;
  pr: PurchaseRequisition | null;
  onClose: () => void;
  onApprove?: (pr: PurchaseRequisition) => void;
  onReject?: (pr: PurchaseRequisition) => void;
  onReturn?: (pr: PurchaseRequisition) => void;
  onCreatePo?: (pr: PurchaseRequisition) => void;
}

export function PRDetailsModal({
  pr,
  isAdmin = false,
  onClose,
  onApprove,
  onReject,
  onReturn,
  onCreatePo,
}: PRDetailsModalProps) {
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  if (!pr) return null;

  const isPending = pr.status === "Pending Approval" || (pr.status as string) === "Pending";
  const isApproved = pr.status === "Approved";
  const isClosed = pr.status === "Closed";
  const displayPriority = normalizePrPriority(pr.priority);

  const handleDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      setReportError("");
      const res = await procurement.getRequisitionLifecycleReport(pr.prId);
      if (res.data?.success && res.data.data) {
        await downloadRequisitionReportPdf(res.data.data);
      } else {
        setReportError(res.data?.message || "Unable to generate report.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setReportError(e?.response?.data?.message || e?.message || "Unable to download lifecycle report.");
    } finally {
      setDownloadingReport(false);
    }
  };
  const duplicateItemIds = new Set(
    (pr.items || [])
      .filter((item, index, items) => items.findIndex((candidate) => candidate.itemId === item.itemId) !== index)
      .map((item) => item.itemId)
  );
  const duplicateNames = Array.from(
    new Set((pr.items || []).filter((item) => duplicateItemIds.has(item.itemId)).map((item) => item.itemName))
  );

  const formattedRequestDate = pr.requestDate
    ? new Date(pr.requestDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "-";

  const formattedRequiredDate = pr.requiredDate
    ? new Date(pr.requiredDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "-";

  return (
    <ModalWrapper
      open={!!pr}
      title={isAdmin && isPending ? `Review Product Requisition — ${pr.prNumber}` : `Product Requisition Details — ${pr.prNumber}`}
      onClose={onClose}
      size="max-w-[640px]"
    >
      <div className="space-y-6">
        {/* Top Header Row with Status Badge */}
        <div className="flex items-center justify-between pb-3 border-b border-divider">
          <div className="flex items-center gap-3">
            <StatusBadge status={pr.status} />
          </div>
          <div className="type-caption text-text-muted">
            {pr.department} · {displayPriority} Priority
          </div>
        </div>

        {/* Feedback / Rejection / Return / Cancellation Reason */}
        {pr.adminNotes ? (
          <div className={`p-4 rounded-card border space-y-1.5 ${
            pr.status === "Cancelled" || pr.status === "Rejected"
              ? "border-status-red/30 bg-status-red/5 text-status-red"
              : pr.status === "Returned"
              ? "border-status-amber/30 bg-status-amber/5 text-status-amber"
              : "border-divider bg-surface-muted text-text-primary"
          }`}>
            <div className="flex items-center gap-2 type-caption font-bold">
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
            <p className="type-caption pl-6 whitespace-pre-wrap leading-relaxed opacity-95">{pr.adminNotes}</p>
          </div>
        ) : (pr.status === "Cancelled" || pr.status === "Rejected") ? (
          <div className="p-4 rounded-card border border-status-red/20 bg-status-red/5 space-y-1.5 text-status-red">
            <div className="flex items-center gap-2 type-caption font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pr.status === "Cancelled" ? "Cancellation Reason:" : "Rejection Reason:"}</span>
            </div>
            <p className="type-caption pl-6 text-text-muted italic">No rejection or cancellation reason was recorded.</p>
          </div>
        ) : null}

        {/* Read-only Form matching CreatePRForm (3 columns per row) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 rounded-card bg-surface-muted border border-divider">
          {/* PR Number */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Purchase Requisition Number
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted select-all">
              {pr.prNumber}
            </div>
          </div>

          {/* Request Date */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Request Date
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted">
              {formattedRequestDate}
            </div>
          </div>

          {/* Required Date */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Required Date
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted">
              {formattedRequiredDate}
            </div>
          </div>

          {/* Requested By */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Requested By
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted">
              {pr.requestedBy && pr.requestedBy !== "Unauthenticated" ? pr.requestedBy : "Inventory Manager"}
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Department
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted">
              {pr.department || "Inventory"}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Purpose
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted">
              {pr.purpose || pr.requestType || "Stock Replenishment"}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1.5 block type-label font-semibold text-text-primary">
              Priority
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted">
              {displayPriority}
            </div>
          </div>
        </div>

        {/* Requested Supplies & Ingredients Table */}
        <div className="space-y-3">
          {duplicateNames.map((name) => (
            <div key={name} className="flex items-start gap-2 rounded-card border border-status-red/40 bg-status-red/10 p-3 type-caption font-semibold text-status-red">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Warning: Duplicate ingredient detected - {name}. Please review and consolidate before proceeding.</span>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <h3 className="type-subsection text-text-primary">
              Requested Items
            </h3>
            <span className="type-caption text-text-muted">
              {pr.items?.length || 0} item(s) listed
            </span>
          </div>

          <div className="overflow-x-auto rounded-card border border-divider bg-surface">
            <table className="w-full text-left">
              <thead className="border-b border-divider bg-surface-muted uppercase text-text-muted table-head-row type-table-header">
                <tr>
                  <th className="table-th px-4 py-3 font-semibold">SUPPLY NAME</th>
                  <th className="table-th px-4 py-3 font-semibold">SUPPLY NO.</th>
                  <th className="table-th px-4 py-3 font-semibold">Unit of Measure</th>
                  <th className="table-th px-4 py-3 text-right font-semibold">ACTUAL INVENTORY</th>
                  <th className="table-th px-4 py-3 text-right font-semibold">QUANTITY (TO ORDER)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {pr.items && pr.items.length > 0 ? (
                  pr.items.map((item, idx) => (
                    <tr
                      key={idx}
                      className={duplicateItemIds.has(item.itemId)
                        ? "bg-status-red/10 text-status-red table-row"
                        : "table-row hover:bg-hover transition-colors"}
                    >
                      <td className="table-td px-4 py-3 font-medium text-text-primary">
                        {item.itemName}
                      </td>
                      <td className="table-td px-4 py-3 text-text-muted">
                        {item.itemCode || `SPL-${item.itemId}`}
                      </td>
                      <td className="table-td px-4 py-3 text-text-muted">
                        {item.uomName || "Unit"}
                      </td>
                      <td className="table-td px-4 py-3 text-right text-text-muted">
                        {Number(item.actualInventory || 0).toLocaleString()}
                      </td>
                      <td className="table-td px-4 py-3 text-right font-bold text-text-primary">
                        {Number(item.requestedQuantity || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="table-td px-4 py-8 text-center type-body text-text-muted">
                      No supplies or ingredients found in this requisition.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes on bottom left */}
        {pr.notes && (
          <div className="flex justify-start pt-2 border-t border-divider">
            <div className="w-full sm:w-1/2 lg:w-5/12 space-y-1.5">
              <label className="block type-label font-semibold text-text-primary">
                Notes
              </label>
              <div className="w-full rounded-control border border-divider bg-surface-muted p-3 type-body text-text-primary leading-relaxed whitespace-pre-wrap">
                {pr.notes}
              </div>
            </div>
          </div>
        )}

        {/* Report download error */}
        {reportError && (
          <p role="alert" className="type-caption font-medium text-status-red">
            {reportError}
          </p>
        )}

        {/* Modal Footer with Operations */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 pb-3 border-t border-divider mt-6 mb-2">
          <div className="type-caption text-text-muted">
            {pr.updatedAt ? `Last modified: ${new Date(pr.updatedAt).toLocaleString()}` : ""}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Close Button */}
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              className="rounded-control border border-divider bg-surface px-5 py-2.5 type-label-button text-text-primary hover:bg-hover transition-colors"
            >
              Close
            </ModalCloseButton>

            {/* Full Lifecycle Report Download (Closed PRs) */}
            {isClosed && (
              <Button
                type="button"
                onClick={handleDownloadReport}
                disabled={downloadingReport}
                className="rounded-control bg-button-primary text-button-primary-foreground px-5 py-2.5 type-label-button hover:bg-button-primary-hover transition-colors shadow-sm inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {downloadingReport ? "Generating PDF..." : "Download Full Report (PDF)"}
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
                    className="rounded-control border border-divider bg-surface px-5 py-2.5 type-label-button text-text-primary hover:bg-hover transition-colors"
                  >
                    Return for Revision
                  </Button>
                )}

                {onReject && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onReject(pr)}
                    className="rounded-control border border-divider bg-surface px-5 py-2.5 type-label-button text-text-primary hover:bg-hover transition-colors"
                  >
                    Reject
                  </Button>
                )}

                {onApprove && (
                  <Button
                    type="button"
                    onClick={() => onApprove(pr)}
                    className="rounded-control bg-button-primary text-button-primary-foreground px-5 py-2.5 type-label-button hover:bg-button-primary-hover transition-colors shadow-sm"
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
                className="rounded-control bg-button-primary text-button-primary-foreground px-5 py-2.5 type-label-button hover:bg-button-primary-hover transition-colors shadow-sm"
              >
                Create Purchase Order
              </Button>
            )}
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}
