"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";
import { receiving } from "@/lib/receiving/client";

import React, { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
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

  const hasAnyExpiry = lines.some((l) => Boolean(l.expiryDate));
  const totalUnitsToStock = lines.reduce((sum, l) => sum + (Number(l.quantityToStock) || 0), 0);
  const formattedReceivedDate = selectedGrn?.receivedDate
    ? (() => {
        const d = new Date(selectedGrn.receivedDate);
        return isNaN(d.getTime())
          ? selectedGrn.receivedDate
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      })()
    : "—";

  const footerHelperText = !selectedGrn
    ? "Step 1 of 2 · Select a Goods Receipt Note to continue."
    : loading
      ? "Loading Goods Receipt Note items..."
      : `Step 2 of 2 · ${lines.length} ${lines.length === 1 ? "item" : "items"} · ${totalUnitsToStock.toLocaleString()} total ${totalUnitsToStock === 1 ? "unit" : "units"} ready to commit.`;

  return (
    <ModalWrapper
      open={open}
      title="Create & Commit Stock-In"
      subtitle={
        selectedGrn
          ? "Review traceability lots, download QR labels, and commit accepted items to inventory."
          : "Select an eligible Goods Receipt Note to review accepted items and traceability lots."
      }
      onClose={onClose}
      maxWidthPx={selectedGrn ? 820 : 620}
      bodyClassName="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
    >
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

      {/* Scrollable Modal Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-4 custom-scrollbar text-ink">
        {error && (
          <div
            role="alert"
            className="rounded-inner border border-notice-danger-border bg-notice-danger-bg px-3.5 py-2.5 type-caption text-notice-danger-text flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
              <span className="font-medium">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="type-caption font-semibold text-notice-danger-text hover:underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* GRN Selection */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="create-stockin-grn-select"
              className="flex items-center gap-1 type-label-field text-ink-strong"
            >
              <span>Select Goods Receipt Note</span>
              <span className="text-destructive">*</span>
            </label>
            {!loading && (
              <span className="type-caption text-ink-muted tabular-nums">
                {grns.length} eligible {grns.length === 1 ? "GRN" : "GRNs"}
              </span>
            )}
          </div>
          <div className="relative">
            <select
              id="create-stockin-grn-select"
              value={selectedGrnId}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) handleSelectGrn(id);
              }}
              className={`w-full h-[38px] appearance-none rounded-control border border-input bg-surface pl-3 pr-9 type-body focus:outline-none focus:border-primary focus:ring-2 focus:ring-focus/30 transition-colors cursor-pointer ${
                selectedGrnId ? "text-ink" : "text-ink-disabled"
              }`}
            >
              <option value="" disabled>
                Select Goods Receipt Note...
              </option>
              {grns.map((g) => (
                <option key={g.grnId} value={g.grnId} className="text-ink">
                  {g.grnNumber} — {g.supplierName}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-ink-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {loading && <ReceivingSkeleton />}

        {/* Phase 1: Empty State (before a GRN is selected) */}
        {!selectedGrn && !loading && (
          <div className="rounded-inner border border-dashed border-input bg-page px-6 py-9 flex flex-col items-center justify-center text-center gap-2">
            <div className="size-10 rounded-pill bg-status-purple-bg text-primary flex items-center justify-center type-caption font-semibold">
              GRN
            </div>
            <p className="type-body-strong text-ink">
              {grns.length === 0
                ? "No eligible Goods Receipt Notes"
                : "No Goods Receipt Note selected yet"}
            </p>
            <p className="type-body-secondary text-ink-muted max-w-md">
              {grns.length === 0
                ? "There are currently no Quality Assurance completed or received Goods Receipt Notes awaiting stock-in."
                : "Choose an eligible Goods Receipt Note above to review accepted quantities, generated lot codes, and printable QR labels."}
            </p>
          </div>
        )}

        {/* Phase 2: Selected GRN Summary Strip, Items Table & Notes */}
        {selectedGrn && !loading && lines.length > 0 && (
          <div className="space-y-4">
            {/* GRN Summary Strip */}
            <div className="rounded-inner border border-topbar bg-page px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="min-w-0 space-y-1">
                <span className="block type-caption text-ink-muted">Supplier</span>
                <span
                  className="block type-body-strong text-ink truncate"
                  title={selectedGrn.supplierName || "—"}
                >
                  {selectedGrn.supplierName || "—"}
                </span>
              </div>

              <div className="min-w-0 space-y-1">
                <span className="block type-caption text-ink-muted">
                  Status &amp; received date
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge status={selectedGrn.status} />
                  <span className="type-caption text-ink-muted tabular-nums">
                    {formattedReceivedDate}
                  </span>
                </div>
              </div>

              <div className="min-w-0 space-y-1 sm:text-right">
                <span className="block type-caption text-ink-muted">Purchase order ref.</span>
                <span className="block type-body-strong text-ink tabular-nums">
                  {selectedGrn.poNumber || "—"}
                </span>
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="type-label-field text-ink-strong">
                      Items to commit to inventory
                    </span>
                    <span className="inline-flex items-center rounded-pill bg-status-purple-bg px-2 py-0.5 type-badge-compact text-primary tabular-nums">
                      {lines.length} {lines.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <p className="type-caption text-ink-muted">
                    Auto-generated traceability lots ready for put-away and QR tag printing.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadAllLabels}
                  className="inline-flex items-center gap-1.5 h-8 rounded-control border border-border bg-surface px-3 type-caption font-medium text-ink hover:bg-subtle transition-colors cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Download All QR Labels</span>
                </button>
              </div>

              <div className="rounded-inner border border-input bg-surface overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-page border-b border-topbar whitespace-nowrap">
                        <th className="px-3 py-2.5 type-table-header text-ink-muted">
                          Supply Name
                        </th>
                        <th className="px-3 py-2.5 type-table-header text-ink-muted">UOM</th>
                        <th className="px-3 py-2.5 type-table-header font-semibold text-ink-strong text-right">
                          Stock to Put In
                        </th>
                        <th className="px-3 py-2.5 type-table-header text-ink-muted text-right">
                          Current Stock
                        </th>
                        <th className="px-3 py-2.5 type-table-header text-ink-muted">Lot No.</th>
                        {hasAnyExpiry && (
                          <th className="px-3 py-2.5 type-table-header text-ink-muted">
                            Expiry Date
                          </th>
                        )}
                        <th className="px-3 py-2.5 type-table-header text-ink-muted text-right">
                          QR Label
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {lines.map((line, lineIndex) => (
                        <tr
                          key={`${line.grnItemId || line.itemId}-${lineIndex}`}
                          className="bg-surface hover:bg-page transition-colors"
                        >
                          <td className="px-3 py-2.5 type-table-cell font-medium text-ink whitespace-nowrap">
                            {line.itemName}
                          </td>
                          <td className="px-3 py-2.5 type-table-cell text-ink-muted whitespace-nowrap">
                            {line.purchaseUomName}
                          </td>
                          <td className="px-3 py-2.5 type-table-cell text-right font-semibold text-ink whitespace-nowrap tabular-nums">
                            {line.quantityToStock.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 type-table-cell text-right text-ink-muted whitespace-nowrap tabular-nums">
                            {line.currentStock.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center rounded-sm border border-divider bg-page px-2 py-0.5 font-mono type-caption text-ink-strong tabular-nums">
                              {line.lotCode}
                            </span>
                          </td>
                          {hasAnyExpiry && (
                            <td className="px-3 py-2.5 type-caption text-ink-muted whitespace-nowrap tabular-nums">
                              {line.expiryDate
                                ? new Date(line.expiryDate).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                  })
                                : "No Expiry"}
                            </td>
                          )}
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDownloadLabel(line, lineIndex)}
                              className="inline-flex items-center gap-1.5 h-7 rounded-control border border-border bg-surface px-2.5 type-caption font-medium text-ink hover:bg-subtle transition-colors cursor-pointer"
                              title="Download printable QR label"
                            >
                              <Download className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                              <span>Download</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* General Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="create-stockin-notes"
                  className="type-label-field text-ink-strong"
                >
                  Stock-In Notes / Storage Instructions
                </label>
                <span className="type-caption text-ink-disabled">(optional)</span>
              </div>
              <textarea
                id="create-stockin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Specify designated warehouse aisle, refrigeration, or special storage notes..."
                className="w-full rounded-control border border-input bg-surface px-3 py-2.5 type-body-secondary text-ink placeholder:text-ink-disabled focus:outline-none focus:border-primary focus:ring-2 focus:ring-focus/30 transition-colors resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Pinned Modal Footer */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-topbar bg-page px-6 py-3.5">
        <p className="type-caption text-ink-muted tabular-nums">{footerHelperText}</p>
        <div className="flex items-center gap-2 ml-auto">
          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            disabled={submitting}
            className="h-9 px-3.5 rounded-control border border-border bg-surface type-label-button-sm text-ink hover:bg-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Cancel
          </ModalNativeCloseButton>
          <button
            type="button"
            disabled={lines.length === 0 || submitting}
            onClick={handleTryCommit}
            className="h-9 px-4 rounded-control bg-primary type-label-button-sm text-on-brand hover:bg-primary-hover disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
        maxWidth={440}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="size-12 rounded-pill bg-subtle flex items-center justify-center mb-4 text-status-amber-fg">
            <AlertTriangle className="size-6" />
          </div>

          <h2 className="type-modal-title text-ink mb-1">
            Commit Stock-In to Inventory
          </h2>

          <p className="type-caption font-medium text-ink-muted mb-3 tabular-nums">
            GRN Reference:{" "}
            {grns.find((g) => g.grnId === Number(selectedGrnId))?.grnNumber || "N/A"}
          </p>

          <p className="type-body text-ink-secondary mb-6 leading-relaxed">
            Are you sure you want to commit this Stock-In with {lines.length} item
            {lines.length === 1 ? "" : "s"} directly to commissary inventory? Stock balances and
            traceability lots will be updated immediately, and QR labels will be ready for download.
          </p>

          <div className="flex justify-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="flex-1 h-10 px-4 type-label-button text-ink border border-input bg-surface hover:bg-subtle rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={executeCommit}
              className="flex-1 h-10 px-4 type-label-button bg-primary text-on-brand hover:bg-primary-hover rounded-control transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Committing…" : "Confirm & Commit"}
            </button>
          </div>
        </div>
      </NestedDialog>
    </ModalWrapper>
  );
}
