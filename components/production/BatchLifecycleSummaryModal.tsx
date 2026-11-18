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
  ExternalLink,
  ImageIcon,
} from "lucide-react";
import {
  getBatchLifecycleSummary,
  type BatchLifecycleSummaryData,
} from "@/app/actions/production/batch-detail";
import { actionResponse } from "@/lib/resources/action-response";
import { downloadProductionBatchPdf } from "./downloadProductionBatchPdf";
import { resolveProductionImage } from "@/lib/production/image-client";
import { FILE_PLACEHOLDER, isFileId } from "@/lib/files";
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
  const [previewImage, setPreviewImage] = useState<{ title: string; src: string } | null>(null);
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | null>(null);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const [lightboxError, setLightboxError] = useState(false);

  useEffect(() => {
    setPhotoLoadError(false);
    setLightboxError(false);
    if (!summary?.batchId) {
      setResolvedPhotoUrl(null);
      return;
    }

    const raw = summary.packaging?.imageUrl?.trim();
    if (raw && (raw.startsWith("data:image/") || raw.startsWith("http://") || raw.startsWith("https://"))) {
      setResolvedPhotoUrl(raw);
      return;
    }

    if (raw && isFileId(raw)) {
      let active = true;
      resolveProductionImage("batch", summary.batchId, "large")
        .then((url) => {
          if (
            active &&
            url &&
            url !== FILE_PLACEHOLDER &&
            !url.includes("file-placeholder") &&
            (url.startsWith("data:image/") || url.startsWith("http://") || url.startsWith("https://"))
          ) {
            setResolvedPhotoUrl(url);
          } else if (active) {
            setResolvedPhotoUrl(null);
          }
        })
        .catch(() => {
          if (active) setResolvedPhotoUrl(null);
        });
      return () => {
        active = false;
      };
    } else {
      setResolvedPhotoUrl(null);
    }
  }, [summary?.batchId, summary?.packaging?.imageUrl]);

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
      size="max-w-[640px]"
    >
      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 type-body text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
          <span>Loading full production lifecycle...</span>
        </div>
      ) : !summary ? (
        <div className="py-10 text-center type-body text-text-muted">
          No batch summary available.
        </div>
      ) : (
        <div className="space-y-4 type-body">
          {/* Product & Status Summary Strip (no duplicate batch number header) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-divider bg-surface-secondary/40 px-4 py-3">
            <p className="type-body font-medium text-text-primary">
              {summary.productName} ({summary.variant}) &bull;{" "}
              <span className="text-text-muted">Recipe: {summary.recipeName}</span>
            </p>
            <StatusBadge status={summary.status} />
          </div>

          {/* 1. Production Request */}
          <section className="rounded-control border border-divider p-4 space-y-3">
            <div className="flex items-center gap-2 type-body font-semibold text-text-primary">
              <FileText className="w-4 h-4 text-text-muted" />
              <span>1. Production Request ({summary.request.reqNumber})</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="type-caption font-semibold text-text-muted block">Requested By</span>
                <span className="type-body font-semibold text-text-primary">{summary.request.requestedBy}</span>
              </div>
              <div>
                <span className="type-caption font-semibold text-text-muted block">Approved By</span>
                <span className="type-body font-semibold text-text-primary">{summary.request.approvedBy || "—"}</span>
              </div>
              <div>
                <span className="type-caption font-semibold text-text-muted block">Target Output</span>
                <span className="type-body font-semibold text-text-primary">
                  {summary.request.targetQuantity} {summary.yieldUom}
                </span>
              </div>
              <div>
                <span className="type-caption font-semibold text-text-muted block">Required Date</span>
                <span className="type-body font-semibold text-text-primary">{fmtDate(summary.request.requiredDate)}</span>
              </div>
            </div>
          </section>

          {/* 2. Material Issuance */}
          <section className="rounded-control border border-divider p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 type-body font-semibold text-text-primary">
                <ClipboardCheck className="w-4 h-4 text-text-muted" />
                <span>2. Material Issuance ({summary.issuance.issuanceNumber})</span>
              </div>
              <span className="type-caption text-text-muted">
                Issued by <strong className="text-text-primary">{summary.issuance.issuedBy}</strong> &bull; {fmtDateTime(summary.issuance.issuedAt)}
              </span>
            </div>
            <div className="border border-divider rounded-control overflow-hidden">
              <table className="w-full text-left border-collapse type-body">
                <thead className="bg-surface-secondary border-b border-divider type-caption">
                  <tr className="table-head-row text-left whitespace-nowrap">
                    <th className="table-th py-2 px-3 text-text-muted">Ingredient</th>
                    <th className="table-th py-2 px-3 text-text-muted">Lot Code</th>
                    <th className="table-th py-2 px-3 text-text-muted text-right">Qty Used</th>
                    <th className="table-th py-2 px-3 text-text-muted text-center">QR Scan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {summary.issuance.materials.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-center type-caption text-text-muted">
                        No material consumption records.
                      </td>
                    </tr>
                  ) : (
                    summary.issuance.materials.map((m, i) => (
                      <tr key={i} className="table-row">
                        <td className="table-td py-2 px-3 font-medium text-text-primary">{m.itemName}</td>
                        <td className="table-td py-2 px-3 text-text-primary">{m.lotCode}</td>
                        <td className="table-td py-2 px-3 text-right font-semibold text-text-primary">
                          {m.quantityUsed} {m.uomAbbr}
                        </td>
                        <td className="table-td py-2 px-3 text-center text-text-muted">
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
          <section className="rounded-control border border-divider p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 type-body font-semibold text-text-primary">
                <Flame className="w-4 h-4 text-text-muted" />
                <span>3. Production Tracking</span>
              </div>
              <span className="type-caption text-text-muted">
                Cook: <strong className="text-text-primary">{summary.production.assignedCook}</strong> &bull; Started: {fmtDateTime(summary.production.startedAt)}
              </span>
            </div>
            {summary.production.stages.length > 0 ? (
              <div className="border border-divider rounded-control overflow-hidden">
                <table className="w-full text-left border-collapse type-body">
                  <thead className="bg-surface-secondary border-b border-divider type-caption">
                    <tr className="table-head-row text-left whitespace-nowrap">
                      <th className="table-th py-2 px-3 text-text-muted">Stage</th>
                      <th className="table-th py-2 px-3 text-text-muted">Completed At</th>
                      <th className="table-th py-2 px-3 text-text-muted">Completed By</th>
                      <th className="table-th py-2 px-3 text-text-muted">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {summary.production.stages.map((s, idx) => (
                      <tr key={idx} className="table-row">
                        <td className="table-td py-2 px-3 font-semibold text-text-primary">{s.stage}</td>
                        <td className="table-td py-2 px-3 text-text-muted">{s.endTime}</td>
                        <td className="table-td py-2 px-3 text-text-primary">{s.completedBy}</td>
                        <td className="table-td py-2 px-3 text-text-muted">{s.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="type-body text-text-muted">
                Current Stage: <strong className="text-text-primary">{summary.currentStage}</strong>
              </p>
            )}
          </section>

          {/* 4. Packaging & 5. QA + Stock-In */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-control border border-divider p-4 space-y-2.5">
              <div className="flex items-center gap-2 type-body font-semibold text-text-primary">
                <PackageCheck className="w-4 h-4 text-text-muted" />
                <span>4. Packaging</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="type-caption font-semibold text-text-muted block">FG Lot Code</span>
                  <span className="type-body font-semibold text-text-primary">{(summary.packaging.fgLotCode || "").replace(/^FG-/i, "") || "—"}</span>
                </div>
                <div>
                  <span className="type-caption font-semibold text-text-muted block">Packed Qty (Yield)</span>
                  <span className="type-body font-semibold text-text-primary">
                    {summary.packaging.finalQuantity} {summary.yieldUom} ({summary.packaging.yieldPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div>
                  <span className="type-caption font-semibold text-text-muted block">Packaged By</span>
                  <span className="type-body font-semibold text-text-primary">{summary.packaging.packagedBy}</span>
                </div>
                <div>
                  <span className="type-caption font-semibold text-text-muted block">Expiry Date</span>
                  <span className="type-body font-semibold text-text-primary">{fmtDate(summary.packaging.expiryDate)}</span>
                </div>
              </div>

              {resolvedPhotoUrl && !photoLoadError && (
                <div className="pt-2 border-t border-divider mt-1">
                  <span className="type-overline uppercase tracking-wider text-text-muted block mb-2">
                    Packaging Verification Photo
                  </span>
                  <div className="flex items-center gap-3 p-2.5 rounded-control border border-divider bg-surface-secondary/40">
                    <div className="w-16 h-16 rounded-control border border-divider bg-surface overflow-hidden flex items-center justify-center shrink-0">
                      <img
                        src={resolvedPhotoUrl}
                        alt="Packaging Proof"
                        onError={() => setPhotoLoadError(true)}
                        onClick={() => {
                          setLightboxError(false);
                          setPreviewImage({
                            title: `${summary.batchNumber} — Packaging Verification Proof`,
                            src: resolvedPhotoUrl,
                          });
                        }}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="type-caption font-semibold text-text-primary">Packaging &amp; QC Photo</p>
                      <p className="type-caption text-text-muted">Uploaded during packaging verification</p>
                      <button
                        type="button"
                        onClick={() => {
                          setLightboxError(false);
                          setPreviewImage({
                            title: `${summary.batchNumber} — Packaging Verification Proof`,
                            src: resolvedPhotoUrl,
                          });
                        }}
                        className="type-caption font-semibold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" /> View Full Image
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-control border border-divider p-4 space-y-2.5">
              <div className="flex items-center gap-2 type-body font-semibold text-text-primary">
                <ShieldCheck className="w-4 h-4 text-text-muted" />
                <span>5. QA &amp; Stock-In</span>
              </div>
              {summary.qa ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="type-caption font-semibold text-text-muted block">QA Inspection</span>
                    <span className="type-body font-semibold text-text-primary">
                      {summary.qa.inspectionNumber} ({summary.qa.status})
                    </span>
                  </div>
                  <div>
                    <span className="type-caption font-semibold text-text-muted block">Inspector</span>
                    <span className="type-body font-semibold text-text-primary">{summary.qa.inspectorName}</span>
                  </div>
                  <div>
                    <span className="type-caption font-semibold text-text-muted block">Accepted / Rejected</span>
                    <span className="type-body font-semibold text-text-primary">
                      {summary.qa.totalAcceptedQuantity} / {summary.qa.totalRejectedQuantity} {summary.yieldUom}
                    </span>
                  </div>
                  <div>
                    <span className="type-caption font-semibold text-text-muted block">Loss Report</span>
                    <span className="type-body font-semibold text-text-primary">
                      {summary.qa.lossReportNumber || "None"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="type-body text-text-muted">Pending QA Inspection</p>
              )}

              {summary.stockIn && (
                <div className="pt-2 border-t border-divider flex items-center gap-2 type-body text-text-primary">
                  <Warehouse className="w-4 h-4 text-text-muted shrink-0" />
                  <span>
                    Stocked in <strong>{summary.stockIn.quantity} {summary.yieldUom}</strong> to{" "}
                    <strong>{summary.stockIn.locationName}</strong> ({fmtDateTime(summary.stockIn.postedAt)})
                  </span>
                </div>
              )}
            </section>
          </div>

          {/* Footer: Download PDF before Close */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-divider">
            <Button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary-hover shadow-card transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? "Generating..." : "Download PDF"}</span>
            </Button>
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              className="rounded-control border border-divider bg-surface px-5 py-2.5 type-body font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Close
            </ModalCloseButton>
          </div>
        </div>
      )}

      {/* Full Image Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => {
            setPreviewImage(null);
            setLightboxError(false);
          }}
          className="font-sans fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface text-text-primary rounded-card max-w-[640px] w-full border border-divider p-4 space-y-3 shadow-modal animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-divider pb-2">
              <h5 className="type-table-header uppercase text-text-primary truncate pr-4">{previewImage.title}</h5>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewImage(null);
                  setLightboxError(false);
                }}
                className="h-7 px-3 type-caption font-semibold rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary cursor-pointer shrink-0"
              >
                Close
              </Button>
            </div>
            <div className="flex items-center justify-center bg-surface-secondary/40 rounded-control p-4 min-h-[220px] max-h-[70vh] overflow-auto">
              {lightboxError ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                  <ImageIcon className="w-10 h-10 text-text-muted/50" />
                  <p className="type-body font-semibold text-text-primary">Photo Unavailable</p>
                  <p className="type-caption text-text-muted max-w-xs">
                    The image could not be loaded or the storage preview has expired.
                  </p>
                </div>
              ) : (
                <img
                  src={previewImage.src}
                  alt={previewImage.title}
                  onError={() => {
                    setLightboxError(true);
                    setPhotoLoadError(true);
                  }}
                  className="max-h-[65vh] max-w-full object-contain rounded-control"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
}

