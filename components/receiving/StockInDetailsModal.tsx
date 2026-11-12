"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockIn, StockInLine } from "./types";

interface Props {
  stockIn: StockIn | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockInDetailsModal({ stockIn, open, onClose }: Props) {
  if (!stockIn) return null;

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
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Download each item's QR label as an individual file
  const handleDownloadAllLabels = async () => {
    for (let idx = 0; idx < stockIn.lines.length; idx++) {
      handleDownloadLabel(stockIn.lines[idx]);
      if (idx < stockIn.lines.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
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

        {/* Header Summary */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-base font-bold text-foreground">
                {stockIn.stockInNumber}
              </span>
              <StatusBadge status={stockIn.status} />
            </div>
            {stockIn.lines.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadAllLabels}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>Download All QR Labels</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="block text-xs font-medium text-muted-foreground">GRN Reference</span>
              <span className="mt-0.5 block text-sm font-semibold text-foreground">{stockIn.grnNumber}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Supplier</span>
              <span className="mt-0.5 block text-sm font-semibold text-foreground truncate" title={stockIn.supplierName || "—"}>
                {stockIn.supplierName || "—"}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Committed By</span>
              <span className="mt-0.5 block text-sm font-semibold text-foreground">
                {stockIn.committedBy || stockIn.createdBy || "—"}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Committed On</span>
              <span className="mt-0.5 block text-sm font-semibold text-foreground">
                {new Date(stockIn.committedAt || stockIn.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Lines Table */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Items &amp; Traceability Lots
          </span>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
                  <th className="px-4 py-4">Supply Name</th>
                  <th className="px-4 py-4 text-center">Unit of Measure</th>
                  <th className="px-4 py-4 text-right">Stock Put In</th>
                  <th className="px-4 py-4 text-right">Previous Stock</th>
                  <th className="px-4 py-4">Lot No.</th>
                  <th className="px-4 py-4 text-center">Expiry Date</th>
                  <th className="px-4 py-4 text-center">Printable Tag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockIn.lines.map((line) => (
                  <tr key={line.stockInLineId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                      {line.itemName}
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-muted-foreground whitespace-nowrap">
                      {line.purchaseUomName}
                    </td>
                    <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">
                      {line.quantityToStock}
                    </td>
                    <td className="px-4 py-4 text-sm text-right text-muted-foreground whitespace-nowrap">
                      {line.currentStockBeforeCommit}
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground whitespace-nowrap">
                      {line.lotCode}
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-muted-foreground whitespace-nowrap">
                      {line.expiryDate ? new Date(line.expiryDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        title="Download Printable Tag"
                        onClick={() => handleDownloadLabel(line)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Close
          </ModalNativeCloseButton>
        </div>
      </div>
    </ModalWrapper>
  );
}
