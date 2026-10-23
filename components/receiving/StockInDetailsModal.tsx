"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Download, CheckCircle2, ShieldCheck, AlertTriangle, AlertCircle } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { StockIn, StockInLine } from "./types";

interface Props {
  stockIn: StockIn | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockInDetailsModal({ stockIn, open, onClose, onSuccess }: Props) {
  const { user, isAdmin } = useAuth();
  const [approverName, setApproverName] = useState("System Admin");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState(false);

  useEffect(() => {
    if (user) {
      const name =
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.username || "System Admin";
      setApproverName(name);
    }
  }, [user]);

  if (!stockIn) return null;

  const isPending = stockIn.status === "PendingApproval" || stockIn.status === "Pending";
  const isDraft = stockIn.status === "Draft";
  const isApproved = stockIn.status === "Approved";
  const isCommitted = stockIn.status === "Committed";
  const isRejected = stockIn.status === "Rejected";

  const handleApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/api/StockIns/${stockIn.stockInId}/approve`, {
        approverName: approverName.trim() || "System Admin",
        notes: approvalNotes.trim() || undefined,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to approve Stock-In.");
      }

      setApproveModalOpen(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to approve Stock-In.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    setError(null);
    try {
      const res = await api.post(`/api/StockIns/${stockIn.stockInId}/commit`, {
        committerName: approverName.trim() || undefined,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to commit Stock-In to inventory.");
      }

      setCommitModalOpen(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to commit Stock-In to inventory.");
    } finally {
      setCommitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectionError(true);
      return;
    }
    setRejectionError(false);
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/api/StockIns/${stockIn.stockInId}/reject`, {
        rejectionReason: rejectionReason.trim(),
        rejectedBy: approverName.trim() || undefined,
        notes: approvalNotes.trim() || undefined,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to reject Stock-In.");
      }

      setRejectModalOpen(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to reject Stock-In.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDraft = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/api/StockIns/${stockIn.stockInId}/submit`);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to submit Stock-In.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to submit Stock-In.");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to extract SVG markup for a line
  const getLineSvgHtml = (lineId: number) => {
    const el = document.getElementById(`stockin-qr-svg-${lineId}`);
    return el ? el.outerHTML : "";
  };

  // Build single label HTML
  const buildSingleLabelHtml = (line: StockInLine) => {
    const svgHtml = getLineSvgHtml(line.stockInLineId);
    return `
      <div style="width:360px;margin:0 auto 20px auto;border:2px solid #000;border-radius:10px;padding:16px;font-family:sans-serif;color:#111;page-break-after:always;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px;">
          <div>
            <div style="font-size:13px;font-weight:900;letter-spacing:0.5px;text-transform:uppercase;">COMMISSARY INVENTORY LABEL</div>
            <div style="font-size:10px;color:#555;">Receiving Lot Traceability Tag</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;font-weight:bold;font-family:monospace;">${stockIn.stockInNumber}</div>
            <div style="font-size:9px;color:#777;">GRN: ${stockIn.grnNumber}</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;align-items:center;">
          <div style="flex-shrink:0;width:95px;height:95px;border:1px solid #ddd;padding:4px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#fff;">
            ${svgHtml || '<div style="font-size:9px;color:#999;text-align:center;">QR Code</div>'}
          </div>
          <div style="flex:1;font-size:11px;line-height:1.4;">
            <div style="font-size:13px;font-weight:bold;margin-bottom:2px;">${line.itemName}</div>
            ${line.itemCode ? `<div style="font-size:10px;color:#666;font-family:monospace;margin-bottom:4px;">SKU: ${line.itemCode}</div>` : ""}
            <div style="margin-top:4px;">
              <span style="color:#666;">Quantity:</span> <strong>${line.quantityToStock} ${line.purchaseUomName}</strong>
            </div>
            <div>
              <span style="color:#666;">Supplier:</span> <span>${stockIn.supplierName || "—"}</span>
            </div>
          </div>
        </div>

        <div style="margin-top:12px;padding-top:8px;border-top:1px dashed #ccc;display:flex;justify-content:space-between;font-size:10px;">
          <div>
            <div style="color:#666;font-size:9px;text-transform:uppercase;">Lot Number</div>
            <div style="font-family:monospace;font-weight:bold;font-size:11px;">${line.lotCode}</div>
          </div>
          <div style="text-align:right;">
            <div style="color:#666;font-size:9px;text-transform:uppercase;">Expiry Date</div>
            <div style="font-family:monospace;font-weight:bold;font-size:11px;">
              ${line.expiryDate ? new Date(line.expiryDate).toLocaleDateString() : "N/A"}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // Download individual label HTML
  const handleDownloadLabel = (line: StockInLine) => {
    const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Lot Label - ${line.lotCode}</title>
  <style>
    body { margin: 20px; background: #fafafa; }
    @media print {
      body { margin: 0; background: #fff; }
    }
  </style>
</head>
<body>
  ${buildSingleLabelHtml(line)}
</body>
</html>`;

    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Label-${line.lotCode || line.stockInLineId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalWrapper
      open={open}
      title={`Stock-In Details — ${stockIn.stockInNumber}`}
      onClose={onClose}
      size="max-w-5xl"
    >
      <div className="space-y-5 text-foreground">
        {/* Hidden QR Code SVGs for download extraction */}
        <div className="hidden" aria-hidden="true">
          {stockIn.lines.map((line) => {
            const qrPayload = JSON.stringify({
              stockIn: stockIn.stockInNumber,
              grn: stockIn.grnNumber,
              supply: line.itemName,
              supplier: stockIn.supplierName,
              lot: line.lotCode,
              expiry: line.expiryDate ? line.expiryDate.split("T")[0] : "N/A",
              qty: line.quantityToStock,
              uom: line.purchaseUomName,
            });
            return (
              <div key={line.stockInLineId}>
                <QRCodeSVG
                  id={`stockin-qr-svg-${line.stockInLineId}`}
                  value={qrPayload}
                  size={100}
                  level="M"
                />
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="font-bold text-xs hover:underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Clean Header Summary without PO and Created Date */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs">
          <div className="flex items-center gap-3 border-b border-border/60 pb-3 mb-3">
            <span className="font-mono text-base font-bold text-foreground">
              {stockIn.stockInNumber}
            </span>
            <StatusBadge status={stockIn.status} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Goods Receipt Note Reference</span>
              <span className="font-mono font-semibold text-foreground text-sm">{stockIn.grnNumber}</span>
            </div>
            {stockIn.supplierName && stockIn.supplierName !== "—" && (
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Supplier</span>
                <span className="font-semibold text-foreground text-sm">{stockIn.supplierName}</span>
              </div>
            )}
          </div>

          {stockIn.approvedBy && (
            <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2 text-xs text-foreground font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>
                Approved by <strong>{stockIn.approvedBy}</strong> on{" "}
                {stockIn.approvedAt ? new Date(stockIn.approvedAt).toLocaleDateString() : ""}
              </span>
            </div>
          )}

          {stockIn.committedBy && (
            <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-2 text-xs text-foreground font-medium">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>
                Committed to Inventory by <strong>{stockIn.committedBy}</strong> on{" "}
                {stockIn.committedAt ? new Date(stockIn.committedAt).toLocaleDateString() : ""}
              </span>
            </div>
          )}

          {isRejected && (
            <div className="mt-3 pt-2.5 border-t border-border/60 text-xs text-foreground space-y-1">
              <div className="font-semibold">
                Rejected by {stockIn.rejectedBy || "Admin"}
              </div>
              <div>
                <strong>Reason:</strong> {stockIn.rejectionReason}
              </div>
            </div>
          )}
        </div>

        {/* Lines Table */}
        <div className="space-y-2">
          <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block">
            Items & Traceability Lots
          </span>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Supply Name</th>
                  <th className="px-3 py-3 text-center">Unit of Measure</th>
                  <th className="px-3 py-3 text-right">Stock to Put In</th>
                  <th className="px-3 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 whitespace-nowrap">Lot No.</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Expiry Date</th>
                  {(isApproved || isCommitted) && (
                    <th className="px-4 py-3 text-center whitespace-nowrap">Printable Tag</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockIn.lines.map((line) => (
                  <tr key={line.stockInLineId} className="hover:bg-muted/15 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div>{line.itemName}</div>
                      {line.itemCode && (
                        <div className="text-[10px] font-mono text-muted-foreground">{line.itemCode}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground">
                      {line.purchaseUomName}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-foreground">
                      {line.quantityToStock}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-muted-foreground">
                      {line.currentStockBeforeCommit}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground whitespace-nowrap">
                      {line.lotCode}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {line.expiryDate ? new Date(line.expiryDate).toLocaleDateString() : "—"}
                    </td>
                    {(isApproved || isCommitted) && (
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          title="Download Printable Tag"
                          onClick={() => handleDownloadLabel(line)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Download</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            {isDraft && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitDraft}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
              >
                {submitting ? "Submitting…" : "Submit for Admin Approval"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || committing}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Close
            </button>
            {isPending && isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={submitting}
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setApproveModalOpen(true)}
                  disabled={submitting}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  Approve Stock-In
                </button>
              </>
            )}
            {isApproved && (
              <button
                type="button"
                disabled={committing}
                onClick={() => setCommitModalOpen(true)}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap cursor-pointer"
              >
                Commit to Inventory
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Commit to Inventory */}
      {commitModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setCommitModalOpen(false)}
          >
            <div
              style={{ width: "100%", maxWidth: "440px" }}
              className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  Commit to Inventory
                </h2>
                <p className="text-xs font-mono font-semibold text-muted-foreground mb-3">
                  Stock-In No: {stockIn.stockInNumber}
                </p>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Are you sure you want to commit this Stock-In to commissary inventory? This will update warehouse stock on hand, record {stockIn.lines.length} inventory lot item(s), and finalize this stock-in record. This action cannot be undone.
                </p>
                <div className="flex justify-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setCommitModalOpen(false)}
                    disabled={committing}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={committing}
                    onClick={handleCommit}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/85 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {committing ? "Committing…" : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirmation Modal: Approve Stock-In */}
      {approveModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setApproveModalOpen(false)}
          >
            <div
              style={{ width: "100%", maxWidth: "440px" }}
              className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  Approve Stock-In
                </h2>
                <p className="text-xs font-mono font-semibold text-muted-foreground mb-3">
                  Stock-In No: {stockIn.stockInNumber}
                </p>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Are you sure you want to approve this Stock-In report with {stockIn.lines.length} item(s)? Once approved, it can be committed to the inventory stock.
                </p>

                <div className="w-full text-left space-y-1.5 mb-5">
                  <label className="text-xs font-semibold text-foreground">
                    Approval Notes (Optional)
                  </label>
                  <Textarea
                    rows={2}
                    placeholder="Optional authorization remarks or warehouse location notes..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="text-xs resize-none bg-background rounded-xl p-3 border-border"
                  />
                </div>

                <div className="flex justify-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setApproveModalOpen(false)}
                    disabled={submitting}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleApprove}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/85 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Approving…" : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirmation Modal: Reject Stock-In */}
      {rejectModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setRejectModalOpen(false)}
          >
            <div
              style={{ width: "100%", maxWidth: "440px" }}
              className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  Reject Stock-In
                </h2>
                <p className="text-xs font-mono font-semibold text-muted-foreground mb-3">
                  Stock-In No: {stockIn.stockInNumber}
                </p>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Please provide a reason for rejecting this Stock-In request. The record will be marked as Rejected.
                </p>

                <div className="w-full text-left space-y-1.5 mb-5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    Rejection Reason <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="State the reason for rejecting this stock-in request (required)..."
                    value={rejectionReason}
                    onChange={(e) => {
                      setRejectionReason(e.target.value);
                      if (e.target.value.trim()) setRejectionError(false);
                    }}
                    className={`text-xs resize-none bg-background rounded-xl p-3 ${
                      rejectionError ? "border-destructive focus-visible:ring-destructive" : "border-border"
                    }`}
                  />
                  {rejectionError && (
                    <p className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Reason is required for this action.
                    </p>
                  )}
                </div>

                <div className="flex justify-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(false)}
                    disabled={submitting}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReject}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/85 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Rejecting…" : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ModalWrapper>
  );
}
