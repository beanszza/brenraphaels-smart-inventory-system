"use client";

import React from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockIn, StockInLine } from "./types";
import { downloadStockInLabelPdf } from "./downloadStockInLabelPdf";

interface Props {
  stockIn: StockIn | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockInDetailsModal({ stockIn, open, onClose }: Props) {
  if (!stockIn) return null;

  // Download individual label PDF
  const handleDownloadLabel = async (line: StockInLine) => {
    await downloadStockInLabelPdf({
      canvasId: `stockin-qr-canvas-${line.stockInLineId}`,
      headerTitle: "COMMISSARY INVENTORY LABEL",
      headerSubtitle: "Receiving Lot Traceability Tag",
      headerCode: stockIn.stockInNumber,
      grnNumber: stockIn.grnNumber,
      itemName: line.itemName,
      quantityToStock: line.quantityToStock,
      purchaseUomName: line.purchaseUomName,
      supplierName: stockIn.supplierName || "—",
      lotCode: line.lotCode,
      expiryDate: line.expiryDate,
      fallbackFileId: line.stockInLineId,
    });
  };

  // Download each item's QR label as an individual PDF file
  const handleDownloadAllLabels = async () => {
    for (let idx = 0; idx < stockIn.lines.length; idx++) {
      await handleDownloadLabel(stockIn.lines[idx]);
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
                <QRCodeCanvas
                  id={`stockin-qr-canvas-${line.stockInLineId}`}
                  value={qrPayload}
                  size={240}
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
