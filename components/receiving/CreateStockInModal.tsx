"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";
import { receiving } from "@/lib/receiving/client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import NestedDialog from "./NestedDialog";
import { GRN, StockIn } from "./types";
import { downloadStockInLabelPdf } from "./downloadStockInLabelPdf";
import { formatLotCode } from "@/lib/inventory/lot-code";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (stockIn: StockIn) => void;
}

interface StockInLineDraft {
  grnItemId?: number;
  itemId: number;
  itemName: string;
  categoryName?: string;
  purchaseUomId?: number;
  purchaseUomName: string;
  quantityToStock: number;
  currentStock: number;
  lotCode: string;
  expiryDate: string;
  notes: string;
}

export default function CreateStockInModal({ open, onClose, onSuccess }: Props) {
  const [grns, setGrns] = useState<GRN[]>([]);
  const [selectedGrnId, setSelectedGrnId] = useState<number | "">("");
  const [selectedGrn, setSelectedGrn] = useState<GRN | null>(null);
  const [lines, setLines] = useState<StockInLineDraft[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedGrnId("");
    setSelectedGrn(null);
    setLines([]);
    setNotes("");
    setError(null);
    setConfirmOpen(false);
    setLoading(true);

    receiving.listReceipts()
      .then(({ data }) => {
        const list: GRN[] = Array.isArray(data?.data) ? data.data : [];
        const eligible = list.filter(
          (g) =>
            (g.status === "QaCompleted" ||
              g.status === "Received" ||
              g.status === "PartiallyPutAway") &&
            (g.items || []).some((item) => Number(item.deliveredQuantity) > 0)
        );
        setGrns(eligible);
      })
      .catch(() => setError("Unable to load Goods Receipt Notes."))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSelectGrn = async (grnId: number) => {
    setSelectedGrnId(grnId);
    const grn = grns.find((g) => g.grnId === grnId);
    if (!grn) return;
    setSelectedGrn(grn);
    setLoading(true);
    setError(null);

    try {
      const [grnDetailRes, invRes] = await Promise.all([
        receiving.getReceipt(grnId),
        receiving.listStockBalances().catch(() => ({ data: { data: [] } })),
      ]);

      const fullGrn: GRN = grnDetailRes.data?.data || grn;
      const invList = Array.isArray(invRes.data?.data?.items)
        ? invRes.data.data.items
        : Array.isArray(invRes.data?.data)
        ? invRes.data.data
        : [];

      const now = new Date();
      let seq = 1;

      const draftedLines: StockInLineDraft[] = (fullGrn.items || [])
        .filter((item) => Number(item.deliveredQuantity) > 0)
        .map((item) => {
          const invMatch = invList.find((i: { itemId: number }) => i.itemId === item.itemId);
          const currentStock = Number(invMatch?.currentStock ?? invMatch?.quantityOnHand ?? 0);
          const categoryName = invMatch?.categoryName || item.categoryName || "Raw Material";
          const generatedLot = formatLotCode(categoryName, item.itemName, now, seq);
          seq++;

          return {
            grnItemId: item.grnItemId,
            itemId: item.itemId,
            itemName: item.itemName || `Item #${item.itemId}`,
            categoryName,
            purchaseUomId: item.purchaseUomId,
            purchaseUomName: item.purchaseUomName || "Unit",
            quantityToStock: Number(item.deliveredQuantity) || 0,
            currentStock,
            lotCode: generatedLot,
            expiryDate: item.expiryDate ? item.expiryDate.split("T")[0] : "",
            notes: item.notes || "",
          };
        });

      setLines(draftedLines);
    } catch {
      setError("Failed to load Goods Receipt Note items and stock data.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLabel = async (line: StockInLineDraft, index: number) => {
    await downloadStockInLabelPdf({
      canvasId: `create-stockin-qr-canvas-${index}`,
      headerTitle: "BREN RAPHAEL'S",
      headerSubtitle: "INVENTORY IDENTIFICATION LABEL",
      headerCode: line.lotCode,
      grnNumber: selectedGrn?.grnNumber || "GRN",
      itemName: line.itemName,
      quantityToStock: line.quantityToStock,
      purchaseUomName: line.purchaseUomName,
      supplierName: selectedGrn?.supplierName || "—",
      lotCode: line.lotCode,
      expiryDate: line.expiryDate,
      fallbackFileId: `item-${line.itemId}`,
    });
  };

  const handleDownloadAllLabels = async () => {
    for (let idx = 0; idx < lines.length; idx++) {
      await handleDownloadLabel(lines[idx], idx);
      if (idx < lines.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  };

  const handleTryCommit = () => {
    if (!selectedGrnId || lines.length === 0) {
      setError("Please select a valid Goods Receipt Note with item lines.");
      return;
    }

    const invalidQty = lines.some((l) => Number(l.quantityToStock) <= 0);
    if (invalidQty) {
      setError("Every line item must have a quantity to stock greater than zero.");
      return;
    }

    const invalidLot = lines.some((l) => !l.lotCode.trim());
    if (invalidLot) {
      setError("Every line item must have a valid lot number.");
      return;
    }

    setConfirmOpen(true);
  };

  const executeCommit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        grnId: Number(selectedGrnId),
        notes: notes.trim() || undefined,
        submitForApproval: false,
        lines: lines.map((l) => ({
          grnItemId: l.grnItemId,
          itemId: l.itemId,
          purchaseUomId: l.purchaseUomId,
          quantityToStock: Number(l.quantityToStock),
          currentStockBeforeCommit: Number(l.currentStock),
          lotCode: l.lotCode.trim(),
          expiryDate: l.expiryDate ? `${l.expiryDate.split("T")[0]}T12:00:00Z` : undefined,
          notes: l.notes.trim() || undefined,
        })),
      };

      const { data } = await receiving.createStockIn(payload);
      if (!data?.success) {
        throw new Error(data?.message || "Failed to create and commit Stock-In record.");
      }

      setConfirmOpen(false);
      onSuccess(data.data);
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        e.response?.data?.message ||
          e.message ||
          "An unexpected error occurred while committing Stock-In."
      );
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      open={open}
      title="Create & Commit Stock-In"
      onClose={onClose}
      size="max-w-[640px]"
    >
      <div className="space-y-5 text-text-primary">
        {/* Hidden QR Code SVGs for printable label generation */}
        <div className="hidden" aria-hidden="true">
          {lines.map((line, idx) => {
            const qrPayload = JSON.stringify({
              lot: line.lotCode,
              supply: line.itemName,
              grn: selectedGrn?.grnNumber || "GRN",
              supplier: selectedGrn?.supplierName || "—",
              qty: line.quantityToStock,
              uom: line.purchaseUomName,
              ...(line.expiryDate ? { expiry: line.expiryDate } : {}),
            });
            return (
              <div key={`qr-${line.itemId}-${idx}`}>
                <QRCodeCanvas
                  id={`create-stockin-qr-canvas-${idx}`}
                  value={qrPayload}
                  size={240}
                  level="M"
                />
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-control border border-badge-danger-border bg-badge-danger-bg px-4 py-3 type-caption text-badge-danger-text flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-text-primary font-semibold type-caption hover:underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* GRN Selection */}
        <div className="space-y-1.5">
          <label className="block type-caption font-semibold text-text-primary">
            Select Goods Receipt Note
          </label>
          <div>
            <select
              value={selectedGrnId}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) handleSelectGrn(id);
              }}
              className="w-full rounded-control border border-divider bg-surface px-3.5 py-2.5 type-body font-medium text-text-primary focus:outline-none focus:border-border-focus"
            >
              <option value="" disabled>
                Select Goods Receipt Note
              </option>
              {grns.map((g) => (
                <option key={g.grnId} value={g.grnId}>
                  {g.grnNumber} — {g.supplierName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <ReceivingSkeleton />}

        {/* Stock-In Items Table */}
        {selectedGrn && !loading && lines.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="type-overline uppercase text-text-muted">
                Items to Commit to Inventory ({lines.length})
              </span>
              <button
                type="button"
                onClick={handleDownloadAllLabels}
                className="inline-flex items-center gap-1.5 rounded-control border border-divider bg-surface px-3 py-1.5 type-caption font-semibold text-text-primary hover:bg-surface-secondary transition-colors cursor-pointer shadow-card"
              >
                <Download className="w-3.5 h-3.5 text-brand" />
                <span>Download All QR Labels</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-card border border-divider bg-surface shadow-card">
              <table className="w-full border-collapse">
                <thead className="border-b border-divider bg-surface-secondary">
                  <tr className="table-head-row text-left whitespace-nowrap">
                    <th className="table-th px-4 py-3">Supply Name</th>
                    <th className="table-th px-4 py-3 text-center">Unit of Measure</th>
                    <th className="table-th px-4 py-3 text-right">Stock to Put In</th>
                    <th className="table-th px-4 py-3 text-right">Current Stock</th>
                    <th className="table-th px-4 py-3">Lot No.</th>
                    {lines.some((l) => Boolean(l.expiryDate)) && (
                      <th className="table-th px-4 py-3 text-center">Expiry Date</th>
                    )}
                    <th className="table-th px-4 py-3 text-center">QR Label</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {lines.map((line, lineIndex) => (
                    <tr
                      key={`${line.grnItemId || line.itemId}-${lineIndex}`}
                      className="table-row hover:bg-surface-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-3 table-td font-semibold text-text-primary whitespace-nowrap">
                        {line.itemName}
                      </td>
                      <td className="px-4 py-3 table-td text-center text-text-muted whitespace-nowrap">
                        {line.purchaseUomName}
                      </td>
                      <td className="px-4 py-3 table-td text-right font-semibold text-text-primary whitespace-nowrap">
                        {line.quantityToStock}
                      </td>
                      <td className="px-4 py-3 table-td text-right text-text-muted whitespace-nowrap">
                        {line.currentStock}
                      </td>
                      <td className="px-4 py-3 table-td text-text-primary whitespace-nowrap">
                        {line.lotCode}
                      </td>
                      {lines.some((l) => Boolean(l.expiryDate)) && (
                        <td className="px-4 py-3 table-td text-center text-text-muted whitespace-nowrap">
                          {line.expiryDate
                            ? new Date(line.expiryDate).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              })
                            : "No Expiry"}
                        </td>
                      )}
                      <td className="px-4 py-3 table-td text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDownloadLabel(line, lineIndex)}
                          className="inline-flex items-center gap-1.5 rounded-control border border-divider bg-surface px-3 py-1.5 type-caption font-semibold text-text-primary hover:bg-surface-secondary transition-colors cursor-pointer"
                          title="Download printable QR label"
                        >
                          <Download className="w-3.5 h-3.5 text-text-muted" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* General Notes */}
            <div className="space-y-1.5 pt-2">
              <label className="block type-caption font-semibold text-text-primary">
                Stock-In Notes / Storage Instructions
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Specify designated warehouse aisle, refrigeration, or special storage notes..."
                className="w-full rounded-control border border-divider bg-surface px-3.5 py-2.5 type-body text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-divider pt-4">
          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            disabled={submitting}
            className="rounded-control border border-divider bg-surface px-5 py-2.5 type-body font-semibold text-text-primary hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Cancel
          </ModalNativeCloseButton>
          <button
            type="button"
            disabled={lines.length === 0 || submitting}
            onClick={handleTryCommit}
            className="rounded-control bg-button-primary px-5 py-2.5 type-body font-semibold text-text-inverse hover:bg-button-primary/85 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-card cursor-pointer"
          >
            {submitting ? "Committing…" : "Commit to Inventory"}
          </button>
        </div>
      </div>

      {/* Confirmation Modal (Nested Radix Dialog) */}
      <NestedDialog
        open={confirmOpen}
        title="Commit Stock-In to Inventory"
        onClose={() => setConfirmOpen(false)}
        maxWidth={480}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mb-4 text-text-primary">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="type-section-title font-semibold text-text-primary mb-1">
            Commit Stock-In to Inventory
          </h2>

          <p className="type-caption font-semibold text-text-muted mb-3">
            GRN Reference: {grns.find((g) => g.grnId === Number(selectedGrnId))?.grnNumber || "N/A"}
          </p>

          <p className="type-body text-text-muted mb-6 leading-relaxed">
            Are you sure you want to commit this Stock-In with {lines.length} item{lines.length === 1 ? "" : "s"} directly to commissary inventory? Stock balances and traceability lots will be updated immediately, and QR labels will be ready for download.
          </p>

          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="flex-1 px-5 py-2.5 type-body font-semibold text-text-primary border border-divider bg-surface hover:bg-surface-secondary rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={executeCommit}
              className="flex-1 px-5 py-2.5 type-body font-semibold bg-button-primary text-text-inverse hover:bg-button-primary/85 rounded-control transition-colors shadow-card disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Committing…" : "Confirm & Commit"}
            </button>
          </div>
        </div>
      </NestedDialog>
    </ModalWrapper>
  );
}
