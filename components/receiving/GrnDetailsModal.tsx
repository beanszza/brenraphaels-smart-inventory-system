"use client";

import { receiving } from "@/lib/receiving/client";

import React, { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import NestedDialog from "./NestedDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GRN } from "./types";
import { downloadGrnReportPdf } from "./downloadGrnReportPdf";

interface GrnDetailsModalProps {
  grn: GRN | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onPosted: () => void;
}

export default function GrnDetailsModal({ grn, open, onClose, onUpdated, onPosted }: GrnDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);

  if (!grn) return null;

  const isDraft = grn.status === "Draft";

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
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : err instanceof Error ? err.message : "Failed to post Goods Receipt Note.";
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
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : err instanceof Error ? err.message : "Failed to cancel Goods Receipt Note.";
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
        items: (grn.items || []).map((item) => ({
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

  return (
    <ModalWrapper open={open} title={`Goods Receipt Note — ${grn.grnNumber}`} onClose={onClose} size="max-w-[640px]">
      <div className="space-y-5 text-text-primary">
        {error && (
          <div role="alert" className="bg-status-red/10 border border-status-red/20 text-status-red type-body rounded-control p-3">
            {error}
          </div>
        )}

        {/* HEADER SUMMARY CARD */}
        <div className="rounded-card border border-divider bg-surface-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <span className="type-table-header uppercase text-text-muted">Receipt Overview</span>
            <StatusBadge status={grn.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="type-caption text-text-muted block">Delivery No.</span>
              <span className="type-body font-semibold text-text-primary mt-0.5 block">{grn.deliveryNumber || "—"}</span>
            </div>
            <div>
              <span className="type-caption text-text-muted block">Supplier</span>
              <span className="type-body font-semibold text-text-primary mt-0.5 truncate block" title={grn.supplierName}>
                {grn.supplierName}
              </span>
            </div>
            <div>
              <span className="type-caption text-text-muted block">Received Date</span>
              <span className="type-body font-semibold text-text-primary mt-0.5 block">
                {new Date(grn.receivedDate).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="type-caption text-text-muted block">Receiving Bay</span>
              <span className="type-body font-semibold text-text-primary mt-0.5 block">{grn.receivingBay || "Main Bay"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-divider">
            <div>
              <span className="type-caption text-text-muted block">Received By</span>
              <span className="type-body font-semibold text-text-primary mt-0.5 block">{grn.receivedBy || "Warehouse Staff"}</span>
            </div>
            {grn.postedBy && grn.postedBy !== "System" && grn.postedBy !== "Not Posted" && (
              <div>
                <span className="type-caption text-text-muted block">Posted By</span>
                <span className="type-body font-semibold text-text-primary mt-0.5 block">{grn.postedBy}</span>
              </div>
            )}
            {grn.carrier && grn.carrier !== "N/A" && (
              <div>
                <span className="type-caption text-text-muted block">Carrier / Vehicle</span>
                <span className="type-body font-semibold text-text-primary mt-0.5 block">{grn.carrier}</span>
              </div>
            )}
            {grn.supplierDrNumber && grn.supplierDrNumber !== "N/A" && (
              <div>
                <span className="type-caption text-text-muted block">Supplier DR #</span>
                <span className="type-body font-semibold text-text-primary mt-0.5 block">{grn.supplierDrNumber}</span>
              </div>
            )}
            {grn.supplierInvoiceNumber && grn.supplierInvoiceNumber !== "N/A" && (
              <div>
                <span className="type-caption text-text-muted block">Supplier Invoice #</span>
                <span className="type-body font-semibold text-text-primary mt-0.5 block">{grn.supplierInvoiceNumber}</span>
              </div>
            )}
          </div>

          {grn.notes && (
            <div className="pt-2 border-t border-divider type-body">
              <span className="font-semibold text-text-primary mr-1.5">Dock Notes:</span>
              <span className="text-text-muted">{grn.notes}</span>
            </div>
          )}
        </div>

        {/* WORKFLOW STATUS BANNER */}
        {(grn.status === "Received" || grn.status === "QaPending") && (
          <div className="bg-surface-muted border border-divider text-text-primary rounded-control p-3.5 flex items-center justify-between type-body">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-pill bg-text-primary shrink-0" />
              <div>
                <div className="font-semibold text-text-primary">Awaiting Quality Assurance Review</div>
                <div className="text-text-muted type-caption mt-0.5">
                  Complete the Quality Assurance review for {grn.grnNumber} to release accepted items for Stock-In.
                </div>
              </div>
            </div>
          </div>
        )}

        {(grn.status === "QaCompleted" || grn.status === "PartiallyPutAway" || grn.status === "FullyPutAway") && (
          <div className="bg-surface-muted border border-divider text-text-primary rounded-control p-3.5 flex items-center justify-between type-body">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-pill bg-text-primary shrink-0" />
              <div>
                <div className="font-semibold text-text-primary">Quality Assurance Completed</div>
                <div className="text-text-muted type-caption mt-0.5">
                  {grn.status === "FullyPutAway"
                    ? "All accepted items from this Goods Receipt Note have been stocked into inventory."
                    : "Accepted items from this Goods Receipt Note are ready for Stock-In."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ITEMS TABLE */}
        <div className="space-y-2">
          <div className="type-table-header uppercase text-text-muted">
            Received Line Items
          </div>
          <div className="overflow-x-auto rounded-control border border-divider bg-surface shadow-card">
            <table className="w-full border-collapse">
              <thead className="table-head-row border-b border-divider bg-surface-muted/30">
                <tr className="text-left table-th text-text-muted whitespace-nowrap">
                  <th className="px-4 py-4">Item Name</th>
                  <th className="px-4 py-4 text-center">Unit of Measure</th>
                  <th className="px-4 py-4 text-right">Ordered</th>
                  <th className="px-4 py-4 text-right">Accepted Qty</th>
                  <th className="px-4 py-4 text-center">Variance</th>
                  <th className="px-4 py-4">Supplier Lot #</th>
                  {grn.items.some((i) => Boolean(i.expiryDate)) && (
                    <th className="px-4 py-4 text-center">Expiry Date</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {grn.items.map((item) => {
                  const itemRows = grn.items.filter((i) => i.itemId === item.itemId);
                  const isMultiBatch = itemRows.length > 1;
                  const totalDeliveredForItem = itemRows.reduce((sum, r) => sum + Number(r.deliveredQuantity || 0), 0);
                  const declaredForItem = Number(item.declaredQuantity ?? item.orderedQuantity ?? 0);
                  const netVariance = totalDeliveredForItem - declaredForItem;

                  const isExact = netVariance === 0 || item.varianceType === "Exact" || (isMultiBatch && netVariance === 0);
                  const isShort = !isExact && (netVariance < 0 || item.varianceType === "Short");
                  const isOver = !isExact && (netVariance > 0 || item.varianceType === "Over");
                  const displayVarianceQty = Math.abs(netVariance !== 0 ? netVariance : item.varianceQuantity);

                  return (
                    <tr key={item.grnItemId} className="table-row hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-4 table-td font-semibold text-text-primary whitespace-nowrap">
                        {item.itemName}
                      </td>
                      <td className="px-4 py-4 table-td text-center text-text-muted whitespace-nowrap">
                        {item.purchaseUomName}
                      </td>
                      <td className="px-4 py-4 table-td text-right text-text-muted whitespace-nowrap">
                        {item.orderedQuantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 table-td text-right font-semibold text-text-primary whitespace-nowrap">
                        {item.deliveredQuantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {isShort ? (
                          <span className="type-caption font-semibold text-status-red bg-status-red/10 border border-status-red/20 px-2 py-0.5 rounded-control">
                            Short ({displayVarianceQty})
                          </span>
                        ) : isOver ? (
                          <span className="type-caption font-semibold text-status-green bg-status-green/10 border border-status-green/20 px-2 py-0.5 rounded-control">
                            Over (+{displayVarianceQty})
                          </span>
                        ) : (
                          <span className="type-caption font-semibold text-text-muted">Match</span>
                        )}
                      </td>
                      <td className="px-4 py-4 table-td text-text-primary whitespace-nowrap">
                        {item.supplierLotCode || "—"}
                      </td>
                      {grn.items.some((i) => Boolean(i.expiryDate)) && (
                        <td className="px-4 py-4 table-td text-center text-text-muted whitespace-nowrap">
                          {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "No Expiry"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-divider">
          {isDraft && (
            <button
              type="button"
              onClick={() => setCancelModalOpen(true)}
              disabled={loading}
              className="rounded-control border border-status-red/30 bg-status-red/10 text-status-red px-5 py-2.5 type-label-button font-semibold hover:bg-status-red/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel Draft
            </button>
          )}

          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-control border border-divider bg-surface px-5 py-2.5 type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Goods Receipt Note
          </button>

          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            disabled={loading}
            className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-label-button font-semibold hover:bg-button-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
          >
            Close
          </ModalNativeCloseButton>

          {isDraft && (
            <button
              type="button"
              onClick={() => setPostModalOpen(true)}
              disabled={loading}
              className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-label-button font-semibold hover:bg-button-primary-hover transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? "Posting…" : "Post Goods Receipt Note"}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal: Post Draft GRN */}
      <NestedDialog
        open={postModalOpen}
        title="Post Goods Receipt Note"
        onClose={() => setPostModalOpen(false)}
        maxWidth={480}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-pill bg-surface-muted flex items-center justify-center mb-4 text-text-primary">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="type-card-title text-text-primary mb-1">
            Post Goods Receipt Note
          </h2>
          <p className="type-caption font-semibold text-text-muted mb-3">
            GRN No: {grn.grnNumber}
          </p>
          <p className="type-body text-text-muted mb-6 leading-relaxed">
            Are you sure you want to post Draft Goods Receipt Note {grn.grnNumber} and submit it for Quality Assurance review?
          </p>
          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setPostModalOpen(false)}
              disabled={loading}
              className="flex-1 px-5 py-2.5 type-label-button font-semibold text-text-primary border border-divider bg-surface hover:bg-surface-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer"
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
              className="flex-1 px-5 py-2.5 type-label-button font-semibold bg-button-primary text-text-inverse hover:bg-button-primary-hover rounded-control transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Posting…" : "Confirm & Post"}
            </button>
          </div>
        </div>
      </NestedDialog>

      {/* Confirmation Modal: Cancel Draft GRN */}
      <NestedDialog
        open={cancelModalOpen}
        title="Cancel Goods Receipt Note"
        onClose={() => setCancelModalOpen(false)}
        maxWidth={480}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-pill bg-surface-muted flex items-center justify-center mb-4 text-text-primary">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="type-card-title text-text-primary mb-1">
            Cancel Goods Receipt Note
          </h2>
          <p className="type-caption font-semibold text-text-muted mb-3">
            GRN No: {grn.grnNumber}
          </p>
          <p className="type-body text-text-muted mb-6 leading-relaxed">
            Are you sure you want to cancel Draft Goods Receipt Note {grn.grnNumber}? This action cannot be undone.
          </p>
          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              disabled={loading}
              className="flex-1 px-5 py-2.5 type-label-button font-semibold text-text-primary border border-divider bg-surface hover:bg-surface-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={executeCancel}
              className="flex-1 px-5 py-2.5 type-label-button font-semibold bg-button-primary text-text-inverse hover:bg-button-primary-hover rounded-control transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Cancelling…" : "Confirm Cancel"}
            </button>
          </div>
        </div>
      </NestedDialog>
    </ModalWrapper>
  );
}
