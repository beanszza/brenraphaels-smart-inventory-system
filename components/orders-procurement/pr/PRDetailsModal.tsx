"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { PurchaseRequisition } from "../types";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";

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
  if (!pr) return null;

  const isPending = pr.status === "Pending Approval" || (pr.status as any) === "Pending";
  const isApproved = pr.status === "Approved";
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
      size="max-w-5xl"
    >
      <div className="space-y-6">
        {/* Top Header Row with Status Badge */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <StatusBadge status={pr.status} />
          </div>
          <div className="text-xs text-muted-foreground">
            {pr.department} · {pr.priority} Priority
          </div>
        </div>

        {/* Feedback / Rejection / Return / Cancellation Reason */}
        {pr.adminNotes ? (
          <div className={`p-4 rounded-xl border space-y-1.5 ${
            pr.status === "Cancelled" || pr.status === "Rejected"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : pr.status === "Returned"
              ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
              : "border-border bg-muted/40 text-foreground"
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold">
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
            <p className="text-xs pl-6 whitespace-pre-wrap leading-relaxed opacity-95">{pr.adminNotes}</p>
          </div>
        ) : (pr.status === "Cancelled" || pr.status === "Rejected") ? (
          <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-1.5 text-destructive">
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pr.status === "Cancelled" ? "Cancellation Reason:" : "Rejection Reason:"}</span>
            </div>
            <p className="text-xs pl-6 text-muted-foreground italic">No rejection or cancellation reason was recorded.</p>
          </div>
        ) : null}

        {/* Read-only Form matching CreatePRForm (3 columns per row) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border">
          {/* PR Number */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Purchase Requisition Number
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 font-mono text-xs text-muted-foreground select-all">
              {pr.prNumber}
            </div>
          </div>

          {/* Request Date */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Request Date
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
              {formattedRequestDate}
            </div>
          </div>

          {/* Required Date */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Required Date
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
              {formattedRequiredDate}
            </div>
          </div>

          {/* Requested By */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Requested By
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
              {pr.requestedBy && pr.requestedBy !== "Unauthenticated" ? pr.requestedBy : "Inventory Manager"}
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Department
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
              {pr.department || "Inventory"}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Purpose
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
              {pr.purpose || pr.requestType || "Stock Replenishment"}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Priority
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
              {pr.priority || "Normal"}
            </div>
          </div>
        </div>

        {/* Requested Supplies & Ingredients Table */}
        <div className="space-y-3">
          {duplicateNames.map((name) => (
            <div key={name} className="flex items-start gap-2 rounded-xl border border-red-400 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Warning: Duplicate ingredient detected - {name}. Please review and consolidate before proceeding.</span>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Requested Items
            </h3>
            <span className="text-xs text-muted-foreground">
              {pr.items?.length || 0} item(s) listed
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">SUPPLY NAME</th>
                  <th className="px-4 py-3 font-semibold">SUPPLY NO.</th>
                  <th className="px-4 py-3 font-semibold">Unit of Measure</th>
                  <th className="px-4 py-3 text-right font-semibold">ACTUAL INVENTORY</th>
                  <th className="px-4 py-3 text-right font-semibold">QUANTITY (TO ORDER)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pr.items && pr.items.length > 0 ? (
                  pr.items.map((item, idx) => (
                    <tr
                      key={idx}
                      className={duplicateItemIds.has(item.itemId)
                        ? "bg-red-50 text-red-800 dark:bg-red-950/50"
                        : "hover:bg-muted/20 transition-colors"}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {item.itemName}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {item.itemCode || `SPL-${item.itemId}`}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.uomName || "Unit"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {Number(item.actualInventory || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        {Number(item.requestedQuantity || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
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
          <div className="flex justify-start pt-2 border-t border-border">
            <div className="w-full sm:w-1/2 lg:w-5/12 space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Notes
              </label>
              <div className="w-full rounded-xl border border-border bg-muted/40 p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {pr.notes}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer with Operations */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
          <div className="text-xs text-muted-foreground">
            {pr.updatedAt ? `Last modified: ${new Date(pr.updatedAt).toLocaleString()}` : ""}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Close Button */}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Close
            </Button>

            {/* Admin Operations for Pending PRs */}
            {isAdmin && isPending && (
              <>
                {onReturn && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onReturn(pr)}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    Return for Revision
                  </Button>
                )}

                {onReject && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onReject(pr)}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    Reject
                  </Button>
                )}

                {onApprove && (
                  <Button
                    type="button"
                    onClick={() => onApprove(pr)}
                    className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm"
                  >
                    Approve
                  </Button>
                )}
              </>
            )}

            {/* Create PO for Approved PRs */}
            {!isAdmin && isApproved && onCreatePo && (
              <Button
                type="button"
                onClick={() => onCreatePo(pr)}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm"
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
