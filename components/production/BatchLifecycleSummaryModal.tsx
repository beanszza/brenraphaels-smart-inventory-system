"use client";

import React, { useEffect, useState } from "react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Download,
  FileText,
  PackageCheck,
  ClipboardCheck,
  Flame,
  ShieldCheck,
  Warehouse,
  Loader2,
} from "lucide-react";
import {
  getBatchLifecycleSummary,
  type BatchLifecycleSummaryData,
} from "@/app/actions/production/batch-detail";
import { actionResponse } from "@/lib/resources/action-response";
import { downloadProductionBatchPdf } from "./downloadProductionBatchPdf";
import { toast } from "sonner";

interface BatchLifecycleSummaryModalProps {
  open: boolean;
  onClose: () => void;
  batchId: number | null;
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—";

export default function BatchLifecycleSummaryModal({
  open,
  onClose,
  batchId,
}: BatchLifecycleSummaryModalProps) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [summary, setSummary] = useState<BatchLifecycleSummaryData | null>(null);

  useEffect(() => {
    if (!open || !batchId) {
      setSummary(null);
      return;
    }
    let active = true;
    setLoading(true);
    actionResponse(getBatchLifecycleSummary(batchId))
      .then((res) => {
        if (!active) return;
        if (res.data?.success && res.data.data) {
          setSummary(res.data.data);
        } else {
          toast.error(res.data?.message || "Failed to load batch summary.");
        }
      })
      .catch(() => {
        if (active) toast.error("Failed to load batch summary.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, batchId]);

  const handleDownloadPdf = async () => {
    if (!summary) return;
    setDownloading(true);
    try {
      await downloadProductionBatchPdf(summary);
      toast.success(`Downloaded ${summary.batchNumber}-Report.pdf`);
    } catch {
      toast.error("Failed to generate PDF report.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ModalWrapper
      open={open}
      title={summary ? summary.batchNumber : "Batch Production"}
      onClose={onClose}
      size="max-w-4xl"
    >
      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading full production lifecycle...</span>
        </div>
      ) : !summary ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No batch summary available.
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {/* Product & Status Summary Strip (no duplicate batch number header) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {summary.productName} ({summary.variant}) &bull;{" "}
              <span className="text-muted-foreground">Recipe: {summary.recipeName}</span>
            </p>
            <StatusBadge status={summary.status} />
          </div>

          {/* 1. Production Request */}
          <section className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span>1. Production Request ({summary.request.reqNumber})</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Requested By</span>
                <span className="text-sm font-semibold text-foreground">{summary.request.requestedBy}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Approved By</span>
                <span className="text-sm font-semibold text-foreground">{summary.request.approvedBy || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Target Output</span>
                <span className="text-sm font-semibold text-foreground">
                  {summary.request.targetQuantity} {summary.yieldUom}
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground block">Required Date</span>
                <span className="text-sm font-semibold text-foreground">{fmtDate(summary.request.requiredDate)}</span>
              </div>
            </div>
          </section>

          {/* 2. Material Issuance */}
          <section className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                <span>2. Material Issuance ({summary.issuance.issuanceNumber})</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Issued by <strong className="text-foreground">{summary.issuance.issuedBy}</strong> &bull; {fmtDateTime(summary.issuance.issuedAt)}
              </span>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-muted/40 border-b border-border text-xs">
                  <tr>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Ingredient</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground">Lot Code</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground text-right">Qty Used</th>
                    <th className="py-2 px-3 font-semibold text-muted-foreground text-center">QR Scan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.issuance.materials.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-center text-sm text-muted-foreground">
                        No material consumption records.
                      </td>
                    </tr>
                  ) : (
                    summary.issuance.materials.map((m, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-medium text-foreground">{m.itemName}</td>
                        <td className="py-2 px-3 text-foreground">{m.lotCode}</td>
                        <td className="py-2 px-3 text-right font-semibold text-foreground">
                          {m.quantityUsed} {m.uomAbbr}
                        </td>
                        <td className="py-2 px-3 text-center text-muted-foreground">
                          {m.verifiedByScan ? "Verified" : "Manual"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. Production Tracking */}
          <section className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Flame className="w-4 h-4 text-muted-foreground" />
                <span>3. Production Tracking</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Cook: <strong className="text-foreground">{summary.production.assignedCook}</strong> &bull; Started: {fmtDateTime(summary.production.startedAt)}
              </span>
            </div>
            {summary.production.stages.length > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-muted/40 border-b border-border text-xs">
                    <tr>
                      <th className="py-2 px-3 font-semibold text-muted-foreground">Stage</th>
                      <th className="py-2 px-3 font-semibold text-muted-foreground">Completed At</th>
                      <th className="py-2 px-3 font-semibold text-muted-foreground">Completed By</th>
                      <th className="py-2 px-3 font-semibold text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.production.stages.map((s, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-semibold text-foreground">{s.stage}</td>
                        <td className="py-2 px-3 text-muted-foreground">{s.endTime}</td>
                        <td className="py-2 px-3 text-foreground">{s.completedBy}</td>
                        <td className="py-2 px-3 text-muted-foreground">{s.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Current Stage: <strong className="text-foreground">{summary.currentStage}</strong>
              </p>
            )}
          </section>

          {/* 4. Packaging & 5. QA + Stock-In */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-xl border border-border p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PackageCheck className="w-4 h-4 text-muted-foreground" />
                <span>4. Packaging</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">FG Lot Code</span>
                  <span className="text-sm font-semibold text-foreground">{summary.packaging.fgLotCode}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">Packed Qty (Yield)</span>
                  <span className="text-sm font-semibold text-foreground">
                    {summary.packaging.finalQuantity} {summary.yieldUom} ({summary.packaging.yieldPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">Packaged By</span>
                  <span className="text-sm font-semibold text-foreground">{summary.packaging.packagedBy}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">Expiry Date</span>
                  <span className="text-sm font-semibold text-foreground">{fmtDate(summary.packaging.expiryDate)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <span>5. QA &amp; Stock-In</span>
              </div>
              {summary.qa ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block">QA Inspection</span>
                    <span className="text-sm font-semibold text-foreground">
                      {summary.qa.inspectionNumber} ({summary.qa.status})
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block">Inspector</span>
                    <span className="text-sm font-semibold text-foreground">{summary.qa.inspectorName}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block">Accepted / Rejected</span>
                    <span className="text-sm font-semibold text-foreground">
                      {summary.qa.totalAcceptedQuantity} / {summary.qa.totalRejectedQuantity} {summary.yieldUom}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block">Loss Report</span>
                    <span className="text-sm font-semibold text-foreground">
                      {summary.qa.lossReportNumber || "None"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Pending QA Inspection</p>
              )}

              {summary.stockIn && (
                <div className="pt-2 border-t border-border flex items-center gap-2 text-sm text-foreground">
                  <Warehouse className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>
                    Stocked in <strong>{summary.stockIn.quantity} {summary.yieldUom}</strong> to{" "}
                    <strong>{summary.stockIn.locationName}</strong> ({fmtDateTime(summary.stockIn.postedAt)})
                  </span>
                </div>
              )}
            </section>
          </div>

          {/* Footer: Download PDF before Close */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? "Generating..." : "Download PDF"}</span>
            </Button>
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Close
            </ModalCloseButton>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
}

