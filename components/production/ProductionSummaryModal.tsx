"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, FileText, Printer, Package, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductionSummaryReport } from "./types";
import { useConfirmedClose } from "@/components/shared/ModalCloseContext";

interface ProductionSummaryModalProps {
  open: boolean;
  onClose: () => void;
  report: ProductionSummaryReport;
}

export default function ProductionSummaryModal({
  open,
  onClose,
  report,
}: ProductionSummaryModalProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const { requestClose, confirmModal } = useConfirmedClose(onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="font-sans fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6"
    >
      {confirmModal}
      <div
        className="bg-surface border border-divider rounded-card w-full max-w-[640px] shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-divider bg-surface-secondary/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-control bg-brand text-text-inverse flex items-center justify-center">
              <FileText size={16} />
            </div>
            <div>
              <h3 className="type-section-title text-text-primary">
                Batch Production Summary Report
              </h3>
              <p className="type-caption text-text-muted">
                {report.batchNumber} &mdash; {report.productName} ({report.variant})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 type-caption font-semibold rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary cursor-pointer"
            >
              <Printer size={13} className="mr-1.5" /> Print
            </Button>
            <button
              type="button"
              onClick={requestClose}
              className="p-1 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible type-body">
          {/* Top Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-control border border-divider bg-surface-secondary/40 type-body">
            <div>
              <span className="type-overline uppercase tracking-wider text-text-muted block">
                Target Output
              </span>
              <span className="font-semibold text-text-primary block">{report.targetYield} PCS</span>
            </div>
            <div>
              <span className="type-overline uppercase tracking-wider text-text-muted block">
                Actual Good Yield
              </span>
              <span className="font-semibold text-text-primary block">{report.actualGoodOutput} PCS</span>
            </div>
            <div>
              <span className="type-overline uppercase tracking-wider text-text-muted block">
                Approved By
              </span>
              <span className="font-semibold text-text-primary block">{report.approvedBy}</span>
            </div>
            <div>
              <span className="type-overline uppercase tracking-wider text-text-muted block">
                Completed Date
              </span>
              <span className="font-semibold text-text-primary block">
                {new Date(report.completedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Finished Product Lot & Expiry Banner */}
          <div className="p-4 rounded-control border border-divider bg-surface-secondary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-control bg-brand text-text-inverse flex items-center justify-center shrink-0">
                <Package size={18} />
              </div>
              <div>
                <p className="type-overline uppercase tracking-wider text-text-muted">
                  Final System Generated Finished Good Lot
                </p>
                <p className="type-body font-semibold text-text-primary">
                  {report.packaging.fgLotNumber}
                </p>
              </div>
            </div>
            <div className="text-right sm:text-right">
              <p className="type-overline uppercase tracking-wider text-text-muted">
                Assigned Expiry Date
              </p>
              <p className="type-caption font-semibold text-text-primary">
                {report.packaging.expiryDate}
              </p>
            </div>
          </div>

          {/* Section 1: Materials & Lots Consumed */}
          <div className="space-y-2">
            <h4 className="type-table-header uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-text-primary" /> Raw Materials &amp; Lots Issued
            </h4>
            <div className="border border-divider rounded-control overflow-hidden">
              <table className="w-full type-body text-left border-collapse">
                <thead className="bg-surface-secondary text-text-muted font-semibold uppercase tracking-wider type-caption border-b border-divider">
                  <tr className="table-head-row text-left whitespace-nowrap">
                    <th className="table-th py-2.5 px-3">Ingredient</th>
                    <th className="table-th py-2.5 px-3">Supplier</th>
                    <th className="table-th py-2.5 px-3">Lot Number</th>
                    <th className="table-th py-2.5 px-3">Quantity</th>
                    <th className="table-th py-2.5 px-3 text-right">Lot Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {report.materialsUsed.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 px-3 text-center type-caption text-text-muted">
                        Standard Bill of Materials recipe ingredients consumed
                      </td>
                    </tr>
                  ) : (
                    report.materialsUsed.map((m: any, idx: number) => (
                      <tr key={idx} className="table-row hover:bg-surface-hover/50">
                        <td className="table-td py-2 px-3 font-semibold text-text-primary">{m.itemName}</td>
                        <td className="table-td py-2 px-3 text-text-muted">{m.supplierName || "Default Supplier"}</td>
                        <td className="table-td py-2 px-3 font-semibold text-text-primary">{m.lotNumber}</td>
                        <td className="table-td py-2 px-3 text-text-primary">
                          {m.quantity} {m.uom}
                        </td>
                        <td className="table-td py-2 px-3 text-right text-text-muted">
                          {m.expiryDate || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Production Stages Timeline */}
          <div className="space-y-2">
            <h4 className="type-table-header uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Clock size={13} className="text-text-primary" /> Production Stages Execution
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {report.stageLogs.map((log: any) => (
                <div
                  key={log.stageName}
                  className="rounded-control border border-divider bg-surface p-3 space-y-2 type-caption shadow-card"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">{log.stageName}</span>
                    <span className="type-caption font-semibold uppercase px-1.5 py-0.5 rounded-control bg-brand text-text-inverse">
                      Done
                    </span>
                  </div>
                  {log.photoUrl && (
                    <div className="w-full h-24 rounded-control border border-divider bg-surface-secondary/40 overflow-hidden">
                      <img
                        src={log.photoUrl}
                        alt={log.stageName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="type-caption text-text-muted">
                    <p>In-Charge: <span className="font-medium text-text-primary">{log.inCharge}</span></p>
                    <p className="type-caption text-text-muted/70 mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: QA Results */}
          <div className="space-y-2">
            <h4 className="type-table-header uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-text-primary" /> Quality Assurance Evaluation &amp; Sensory Checklist
            </h4>
            <div className="p-4 rounded-control border border-divider bg-surface-secondary/40 grid grid-cols-2 sm:grid-cols-5 gap-3 type-caption text-center">
              <div className="p-2 rounded-control border border-divider bg-surface shadow-card">
                <span className="type-overline text-text-muted uppercase block font-semibold">Appearance</span>
                <span className="font-semibold text-text-primary mt-0.5 block">{report.qaResults.overallAppearance}</span>
              </div>
              <div className="p-2 rounded-control border border-divider bg-surface shadow-card">
                <span className="type-overline text-text-muted uppercase block font-semibold">Aroma</span>
                <span className="font-semibold text-text-primary mt-0.5 block">{report.qaResults.aroma}</span>
              </div>
              <div className="p-2 rounded-control border border-divider bg-surface shadow-card">
                <span className="type-overline text-text-muted uppercase block font-semibold">Texture</span>
                <span className="font-semibold text-text-primary mt-0.5 block">{report.qaResults.texture}</span>
              </div>
              <div className="p-2 rounded-control border border-divider bg-surface shadow-card">
                <span className="type-overline text-text-muted uppercase block font-semibold">Taste Test</span>
                <span className="font-semibold text-text-primary mt-0.5 block">{report.qaResults.tasteTest}</span>
              </div>
              <div className="p-2 rounded-control border border-divider bg-surface shadow-card">
                <span className="type-overline text-text-muted uppercase block font-semibold">Consistency</span>
                <span className="font-semibold text-text-primary mt-0.5 block">{report.qaResults.consistency}</span>
              </div>
            </div>
            <div className="p-3 rounded-control border border-divider bg-surface-secondary/40 type-caption text-text-muted">
              <p>Inspector: <span className="font-semibold text-text-primary">{report.qaResults.inspector}</span></p>
              {report.qaResults.notes && <p className="italic mt-0.5">"{report.qaResults.notes}"</p>}
            </div>
          </div>

          {/* Section 4: Packaging Breakdown */}
          <div className="space-y-2">
            <h4 className="type-table-header uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Package size={13} className="text-text-primary" /> Packaging Output Breakdown
            </h4>
            <div className="grid grid-cols-3 gap-3 text-center type-caption">
              <div className="p-3 rounded-control border border-divider bg-surface shadow-card">
                <span className="type-overline text-text-muted uppercase font-semibold block">Good Output</span>
                <span className="type-kpi font-semibold text-text-primary mt-0.5 block">{report.packaging.goodQty} PCS</span>
              </div>
              <div className="p-3 rounded-control border border-divider bg-surface shadow-card">
                <span className="type-overline text-text-muted uppercase font-semibold block">Damaged</span>
                <span className="type-kpi font-semibold text-text-primary mt-0.5 block">{report.packaging.damagedQty} PCS</span>
              </div>
              <div className="p-3 rounded-control border border-divider bg-surface shadow-card">
                <span className="type-overline text-text-muted uppercase font-semibold block">Waste</span>
                <span className="type-kpi font-semibold text-text-primary mt-0.5 block">{report.packaging.wasteQty} PCS</span>
              </div>
            </div>
            <p className="type-caption text-text-muted pt-1">
              Packaged by: <span className="font-semibold text-text-primary">{report.packaging.packagerName}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-divider bg-surface-secondary/40">
          <Button
            type="button"
            variant="outline"
            onClick={requestClose}
            className="type-caption font-semibold rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary cursor-pointer px-5 py-2"
          >
            Close Report
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
