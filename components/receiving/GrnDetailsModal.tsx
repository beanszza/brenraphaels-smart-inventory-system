"use client";

import { receiving } from "@/lib/receiving/client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import NestedDialog from "./NestedDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GRN } from "./types";

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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to post Goods Receipt Note.");
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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to cancel Goods Receipt Note.");
    } finally {
      setLoading(false);
      setCancelModalOpen(false);
    }
  };

  const handleExport = async () => {
    try {
      const jspdfModule = await import("jspdf");
      const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default;
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = (autoTableModule as any).default || autoTableModule;

      const receivedDate = new Date(grn.receivedDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
      const printedAt = new Date().toLocaleString("en-PH");

      const doc = new jsPDF({ format: "a4", orientation: "portrait" });

      doc.setFontSize(18);
      doc.text("GOODS RECEIPT NOTE", 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Commissary / Warehouse Inbound Document", 14, 28);

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(grn.grnNumber, 196, 22, { align: "right" });

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Status: ${grn.status}`, 196, 28, { align: "right" });
      doc.text(`Exported: ${printedAt}`, 196, 33, { align: "right" });

      // Info box
      doc.setDrawColor(200);
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 40, 182, 28, "FD");

      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text(`Supplier: ${grn.supplierName}`, 18, 47);
      doc.text(`Delivery No.: ${grn.deliveryNumber || "—"}`, 18, 55);

      doc.text(`Received Date: ${receivedDate}`, 105, 47);
      doc.text(`Receiving Bay: ${grn.receivingBay || "Main Receiving Bay"}`, 105, 55);

      const tableData = grn.items.map((item) => {
        const variance = item.varianceType === "Short"
          ? `Short (${item.varianceQuantity})`
          : item.varianceType === "Over"
            ? `Over (+${item.varianceQuantity})`
            : "Match";

        const expiry = item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—";

        return [
          item.itemName,
          item.purchaseUomName,
          item.orderedQuantity,
          item.deliveredQuantity,
          variance,
          item.supplierLotCode || "—",
          expiry
        ];
      });

      autoTable(doc, {
        startY: 75,
        head: [["Item Name", "Unit of Measure", "Ordered Quantity", "Delivered Quantity", "Variance", "Supplier Lot #", "Expiry Date"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [244, 244, 245], textColor: 0, fontStyle: "bold" },
      });

      let finalY = (doc as any).lastAutoTable.finalY + 15;

      if (grn.notes) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, finalY, 182, 15, "FD");
        doc.text(`Notes: ${grn.notes}`, 18, finalY + 9);
        finalY += 25;
      }

      finalY += 20;
      doc.setFontSize(9);
      doc.text("Received By / Signature:", 14, finalY);
      doc.line(14, finalY + 15, 64, finalY + 15);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(grn.receivedBy || "Receiving Officer", 14, finalY + 20);

      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text("Quality Assurance Officer / Signature:", 75, finalY);
      doc.line(75, finalY + 15, 125, finalY + 15);

      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text("Authorized By / Signature:", 136, finalY);
      doc.line(136, finalY + 15, 196, finalY + 15);

      if (grn.postedBy) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(grn.postedBy, 136, finalY + 20);
      }

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`This document is a system-generated Goods Receipt Note: ${grn.grnNumber} · ${receivedDate}`, 105, finalY + 40, { align: "center" });

      doc.save(`${grn.grnNumber}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    }
  };

  return (
    <ModalWrapper open={open} title={`Goods Receipt Note — ${grn.grnNumber}`} onClose={onClose} size="max-w-4xl">
      <div className="space-y-5 text-foreground">
        {error && (
          <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl p-3">
            {error}
          </div>
        )}

        {/* HEADER SUMMARY CARD */}
        <div className="rounded-2xl border border-border bg-muted/20 p-4 text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Overview</span>
            <StatusBadge status={grn.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Delivery No.</span>
              <span className="font-mono font-semibold text-foreground">{grn.deliveryNumber || "—"}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Supplier</span>
              <span className="font-semibold text-foreground truncate block" title={grn.supplierName}>
                {grn.supplierName}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Received Date</span>
              <span className="font-medium text-foreground">
                {new Date(grn.receivedDate).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Receiving Bay</span>
              <span className="font-medium text-foreground">{grn.receivingBay || "Main Bay"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2.5 border-t border-border/60">
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Received By</span>
              <span className="font-medium text-foreground">{grn.receivedBy || "Warehouse Staff"}</span>
            </div>
            {grn.postedBy && grn.postedBy !== "System" && grn.postedBy !== "Not Posted" && (
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Posted By</span>
                <span className="font-medium text-foreground">{grn.postedBy}</span>
              </div>
            )}
            {grn.carrier && grn.carrier !== "N/A" && (
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Carrier / Vehicle</span>
                <span className="text-foreground">{grn.carrier}</span>
              </div>
            )}
            {grn.supplierDrNumber && grn.supplierDrNumber !== "N/A" && (
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Supplier DR #</span>
                <span className="font-mono text-foreground">{grn.supplierDrNumber}</span>
              </div>
            )}
            {grn.supplierInvoiceNumber && grn.supplierInvoiceNumber !== "N/A" && (
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Supplier Invoice #</span>
                <span className="font-mono text-foreground">{grn.supplierInvoiceNumber}</span>
              </div>
            )}
          </div>

          {grn.notes && (
            <div className="pt-2 border-t border-border/60 text-xs">
              <span className="font-bold text-foreground mr-1.5">Dock Notes:</span>
              <span className="text-muted-foreground">{grn.notes}</span>
            </div>
          )}
        </div>

        {/* WORKFLOW STATUS BANNER */}
        {(grn.status === "Received" || grn.status === "QaPending") && (
          <div className="bg-muted/30 border border-border text-foreground rounded-2xl p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-foreground shrink-0" />
              <div>
                <div className="font-semibold text-foreground">Awaiting Quality Assurance Review</div>
                <div className="text-muted-foreground text-[11px] mt-0.5">
                  Complete the QA review for {grn.grnNumber} to release accepted items for Stock-In.
                </div>
              </div>
            </div>
          </div>
        )}

        {(grn.status === "QaCompleted" || grn.status === "PartiallyPutAway" || grn.status === "FullyPutAway") && (
          <div className="bg-muted/30 border border-border text-foreground rounded-2xl p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-foreground shrink-0" />
              <div>
                <div className="font-semibold text-foreground">Quality Assurance Completed</div>
                <div className="text-muted-foreground text-[11px] mt-0.5">
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
          <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Received Line Items
          </div>
          <div className="overflow-x-auto border border-border rounded-2xl bg-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/30 uppercase text-muted-foreground font-bold tracking-wider text-[11px] border-b border-border">
                <tr>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-3 py-3 text-center">Unit of Measure</th>
                  <th className="px-3 py-3 text-right">Ordered</th>
                  <th className="px-3 py-3 text-right">Accepted / Received Qty</th>
                  <th className="px-3 py-3 text-center">Variance</th>
                  <th className="px-4 py-3">Supplier Lot #</th>
                  <th className="px-3 py-3 text-center">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grn.items.map((item) => (
                  <tr key={item.grnItemId} className="hover:bg-muted/15 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div>{item.itemName}</div>
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground">
                      {item.purchaseUomName}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                      {item.orderedQuantity.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">
                      {item.deliveredQuantity.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-center font-mono">
                      {item.varianceType === "Short" ? (
                        <span className="text-[11px] font-semibold text-foreground bg-muted/60 border border-border px-2 py-0.5 rounded">
                          Short ({item.varianceQuantity})
                        </span>
                      ) : item.varianceType === "Over" ? (
                        <span className="text-[11px] font-semibold text-foreground bg-muted/60 border border-border px-2 py-0.5 rounded">
                          Over (+{item.varianceQuantity})
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-muted-foreground">Match</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground font-mono text-xs whitespace-nowrap">
                      {item.supplierLotCode || "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground whitespace-nowrap">
                      {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border">
          {isDraft && (
            <button
              type="button"
              onClick={() => setCancelModalOpen(true)}
              disabled={loading}
              className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-5 py-2.5 text-sm font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel Draft
            </button>
          )}

          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Export Goods Receipt Note
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
          >
            Close
          </button>

          {isDraft && (
            <button
              type="button"
              onClick={handlePost}
              disabled={loading}
              className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? "Posting…" : "Post Goods Receipt Note"}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal: Cancel Draft GRN */}
      <NestedDialog
        open={cancelModalOpen}
        title="Cancel Goods Receipt Note"
        onClose={() => setCancelModalOpen(false)}
        maxWidth={440}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">
            Cancel Goods Receipt Note
          </h2>
          <p className="text-xs font-mono font-semibold text-muted-foreground mb-3">
            GRN No: {grn.grnNumber}
          </p>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Are you sure you want to cancel Draft Goods Receipt Note {grn.grnNumber}? This action cannot be undone.
          </p>
          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              disabled={loading}
              className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={executeCancel}
              className="flex-1 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/85 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Cancelling…" : "Confirm Cancel"}
            </button>
          </div>
        </div>
      </NestedDialog>
    </ModalWrapper>
  );
}
