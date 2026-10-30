"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, CheckCircle2 } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
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
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download all labels package HTML
  const handleDownloadAllLabels = () => {
    const allHtml = stockIn.lines.map((line) => buildSingleLabelHtml(line)).join("\n");
    const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>QR Labels Package - ${stockIn.stockInNumber}</title>
  <style>
    body { margin: 20px; background: #fafafa; }
    @media print {
      body { margin: 0; background: #fff; }
    }
  </style>
</head>
<body>
  ${allHtml}
</body>
</html>`;

    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Labels-${stockIn.stockInNumber}.html`;
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

        {/* Header Summary */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-base font-bold text-foreground">
                {stockIn.stockInNumber}
              </span>
              <StatusBadge status={stockIn.status} />
            </div>
            {stockIn.lines.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadAllLabels}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Download All QR Tags</span>
              </button>
            )}
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

          {(stockIn.committedBy || stockIn.createdBy) && (
            <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2 text-xs text-foreground font-medium">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>
                Committed to Inventory by <strong>{stockIn.committedBy || stockIn.createdBy}</strong> on{" "}
                {new Date(stockIn.committedAt || stockIn.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Lines Table */}
        <div className="space-y-2">
          <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block">
            Items &amp; Traceability Lots
          </span>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Supply Name</th>
                  <th className="px-3 py-3 text-center">Unit of Measure</th>
                  <th className="px-3 py-3 text-right">Stock Put In</th>
                  <th className="px-3 py-3 text-right">Previous Stock</th>
                  <th className="px-4 py-3 whitespace-nowrap">Lot No.</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Expiry Date</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Printable Tag</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
