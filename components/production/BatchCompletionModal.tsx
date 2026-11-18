"use client";
import { completeBatch as productionCompleteBatch } from "@/app/actions/production/batch-complete";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useState } from "react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, PackageCheck, AlertCircle, Sparkles } from "lucide-react";
import { ProductionBatchEntity } from "./types";
import { getFutureDateError, getMaxFutureDateString, getTodayDateString } from "@/lib/date-limits";
import { getLotItemAbbreviation } from "@/lib/inventory/lot-code";
import ActionConfirmModal from "@/components/shared/ActionConfirmModal";

interface BatchCompletionModalProps {
  open: boolean;
  onClose: () => void;
  batch: ProductionBatchEntity | null;
  onSuccess: () => void;
}

export default function BatchCompletionModal({
  open,
  onClose,
  batch,
  onSuccess,
}: BatchCompletionModalProps) {
  const [actualQuantity, setActualQuantity] = useState<number>(batch?.estimatedQuantity || 100);
  const [packagedBy, setPackagedBy] = useState<string>(batch?.assignedCook || "Head Cook");
  const [expiryDate, setExpiryDate] = useState<string>(() => {
    // Default 6 months from now
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  });
  const [scrapQuantity, setScrapQuantity] = useState<number>(0);
  const [scrapReason, setScrapReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState<boolean>(false);

  if (!batch) return null;

  const yieldPercentage =
    batch.estimatedQuantity > 0 ? (actualQuantity / batch.estimatedQuantity) * 100 : 100;

  const itemAbbrev = getLotItemAbbreviation(batch.productName);
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const fgLotCode = batch.fgLotCode ? batch.fgLotCode.replace(/^FG-/i, "") : `${itemAbbrev}-${yy}${mm}${dd}-01`;

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actualQuantity <= 0) {
      toast.error("Actual output quantity must be greater than 0.");
      return;
    }
    const expiryErr = getFutureDateError(expiryDate, "Finished goods expiry date");
    if (expiryErr) {
      toast.error(expiryErr);
      return;
    }
    setConfirmCompleteOpen(true);
  };

  const executeCompleteBatch = async () => {
    setSubmitting(true);
    try {
      const res = await actionResponse(productionCompleteBatch(batch.batchId, {
        finalQuantity: Number(actualQuantity),
        packagedBy,
        expiryDate,
        scrapQuantity: Number(scrapQuantity) || 0,
        scrapReason,
        notes,
      }));

      if (res.data?.success) {
        toast.success(res.data.message || "Batch successfully completed and Finished Goods lot stocked in!");
        setConfirmCompleteOpen(false);
        onSuccess();
        onClose();
      } else {
        toast.error(res.data?.message || "Failed to complete batch.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      open={open}
      title={`Complete Batch: ${batch.batchNumber}`}
      onClose={onClose}
      size="max-w-[560px]"
    >
      <form onSubmit={handlePromptSubmit} className="space-y-6">
        {/* Banner summary */}
        <div className="flex items-start gap-3 p-4 rounded-control bg-surface-secondary/40 border border-divider">
          <PackageCheck className="w-5 h-5 text-text-primary shrink-0 mt-0.5" />
          <div className="flex-1 type-caption">
            <h4 className="type-body font-semibold text-text-primary">Packaging &amp; Finished Goods Stock-In</h4>
            <p className="text-text-muted mt-0.5">
              Finalizing will record the output volume, automatically create Finished Goods Lot{" "}
              <span className="font-semibold text-text-primary">{fgLotCode}</span>, and credit the Main Finished Goods inventory.
            </p>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="type-table-header text-text-primary">Actual Packaged Quantity</label>
            <Input
              type="number"
              min="0.1"
              step="any"
              value={actualQuantity}
              onChange={(e) => setActualQuantity(Number(e.target.value))}
              required
              className="h-10 type-body font-semibold rounded-control border-divider bg-surface text-text-primary"
            />
            <span className="type-caption text-text-muted">
              Estimated: {batch.estimatedQuantity} {batch.yieldUom}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="type-table-header text-text-primary">Finished Goods Expiry Date</label>
            <Input
              type="date"
              min={getTodayDateString()}
              max={getMaxFutureDateString()}
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
              className="h-10 type-body rounded-control border-divider bg-surface text-text-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="type-table-header text-text-primary">Packaged By</label>
            <Input
              type="text"
              value={packagedBy}
              onChange={(e) => setPackagedBy(e.target.value)}
              required
              className="h-10 type-body rounded-control border-divider bg-surface text-text-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="type-table-header text-text-primary">Scrap / Trim Quantity (Optional)</label>
            <Input
              type="number"
              min="0"
              step="any"
              value={scrapQuantity || ""}
              onChange={(e) => setScrapQuantity(Number(e.target.value))}
              placeholder="0"
              className="h-10 type-body rounded-control border-divider bg-surface text-text-primary"
            />
          </div>
        </div>

        {scrapQuantity > 0 && (
          <div className="space-y-1.5">
            <label className="type-table-header text-text-primary">Scrap Reason</label>
            <Input
              type="text"
              value={scrapReason}
              onChange={(e) => setScrapReason(e.target.value)}
              placeholder="e.g. Cooking trim, container residue"
              className="h-10 type-body rounded-control border-divider bg-surface text-text-primary"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="type-table-header text-text-primary">Batch Completion Notes</label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Standard consistency and aroma verified"
            className="h-10 type-body rounded-control border-divider bg-surface text-text-primary"
          />
        </div>

        {/* Calculated metrics */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-control border border-divider bg-surface text-center shadow-card">
          <div>
            <span className="type-caption text-text-muted block">Yield Efficiency</span>
            <span
              className={`type-body font-semibold ${
                yieldPercentage >= 95 ? "text-badge-success-text" : yieldPercentage < 80 ? "text-badge-warning-text" : "text-text-primary"
              }`}
            >
              {yieldPercentage.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="type-caption text-text-muted block">FG Lot Code</span>
            <span className="type-caption font-semibold text-text-primary truncate block">
              {fgLotCode}
            </span>
          </div>
          <div>
            <span className="type-caption text-text-muted block">Target Location</span>
            <span className="type-caption font-semibold text-text-primary">Finished Goods</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-divider">
          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            className="type-body font-semibold px-5 py-2.5 rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary cursor-pointer"
          >
            Cancel
          </ModalCloseButton>

          <Button
            type="submit"
            disabled={submitting}
            className="bg-button-primary text-text-inverse font-semibold type-body px-5 py-2.5 rounded-control hover:bg-button-primary-hover transition-colors shadow-card cursor-pointer"
          >
            {submitting ? "Finalizing..." : "Complete Batch & Stock In FG"}
          </Button>
        </div>
      </form>

      <ActionConfirmModal
        open={confirmCompleteOpen}
        title="Confirm Batch Completion"
        subtitle={`Batch No: ${batch.batchNumber} • FG Lot: ${fgLotCode}`}
        description={`Are you sure you want to complete batch ${batch.batchNumber} with ${actualQuantity} ${batch.yieldUom} (${yieldPercentage.toFixed(1)}% yield) and stock it into Finished Goods inventory?`}
        confirmText="Confirm & Complete"
        loading={submitting}
        loadingText="Finalizing..."
        onConfirm={executeCompleteBatch}
        onClose={() => setConfirmCompleteOpen(false)}
      />
    </ModalWrapper>
  );
}
