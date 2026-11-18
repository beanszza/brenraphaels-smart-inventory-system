"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import { receiving } from "@/lib/receiving/client";

import React, { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import { GRN, QAInspection } from "./types";

interface AddQaModalProps {
  open: boolean;
  onClose: () => void;
  onStartInspection: (inspection: QAInspection) => void;
}

export default function AddQaModal({ open, onClose, onStartInspection }: AddQaModalProps) {
  const [grns, setGrns] = useState<GRN[]>([]);
  const [selected, setSelected] = useState<GRN | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelected(null);
    setLoading(true);

    // Fetch posted GRNs with status = "Received" (awaiting QA)
    receiving.listReceipts()
      .then(({ data }) => {
        const all: GRN[] = Array.isArray(data?.data) ? data.data : [];
        // "Received" = posted GRN, QA not yet completed
        const eligible = all.filter((g) => g.status === "Received");
        setGrns(eligible);
      })
      .catch(() => setError("Unable to load Goods Receipt Notes. Please refresh and try again."))
      .finally(() => setLoading(false));
  }, [open]);

  const handleStartInspection = async () => {
    if (!selected) return;
    setSearching(true);
    setError(null);

    try {
      // Find the QA inspection created for this GRN
      const res = await receiving.listInspections();
      const allInspections: QAInspection[] = Array.isArray(res.data?.data) ? res.data.data : [];

      // Match by referenceId (grnId) and Pending status
      const match = allInspections.find(
        (i) =>
          i.referenceId === selected.grnId &&
          (i.status === "Pending" || i.status === "InInspection" || i.status === "InProgress" || i.status === "In Inspection")
      );

      if (!match) {
        setError(
          `No pending Quality Assurance inspection found for Goods Receipt Note ${selected.grnNumber}. It may have already been inspected or the inspection was not created yet. Please refresh the Goods Receipt Note list.`
        );
        return;
      }

      onStartInspection(match);
      onClose();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : err instanceof Error ? err.message : "Failed to find Quality Assurance inspection.";
      setError(msg || "Failed to find Quality Assurance inspection.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <ModalWrapper open={open} title="Add Quality Assurance Inspection" onClose={onClose} size="max-w-[560px]">
      <div className="space-y-6 text-text-primary">
        {error && (
          <div role="alert" className="rounded-control border border-status-red/30 bg-status-red/10 p-3 type-caption text-status-red">
            {error}
          </div>
        )}

        {/* Instructions */}
        <div className="flex items-start gap-3 rounded-control border border-divider bg-surface-muted/30 p-4">
          <Plus className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
          <div>
            <p className="type-body font-semibold text-text-primary">Select a Posted Goods Receipt Note to Inspect</p>
            <p className="type-caption text-text-muted mt-0.5">
              Only Goods Receipt Notes with status <strong>Received</strong> (posted, pending Quality Assurance) are shown below. Select the Goods Receipt Note you want to inspect.
            </p>
          </div>
        </div>

        {/* GRN Selection */}
        {loading ? (
          <ReceivingSkeleton />
        ) : grns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-divider rounded-card bg-surface-muted/10">
            <Package className="w-10 h-10 text-text-muted/40 mb-3" />
            <p className="type-body font-semibold text-text-muted">No Goods Receipt Notes awaiting Quality Assurance</p>
            <p className="type-caption text-text-muted/70 mt-1">
              Create and post a Goods Receipt Note first. Once posted, it will appear here for Quality Assurance inspection.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="type-label font-semibold text-text-primary block">Goods Receipt Note Number <span className="text-status-red">*</span></label>
            <select
              value={selected?.grnId || ""}
              onChange={(e) => {
                const grn = grns.find((g) => g.grnId === Number(e.target.value));
                setSelected(grn || null);
                setError(null);
              }}
              className="w-full rounded-control border border-divider bg-surface px-3 py-2.5 type-body text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={searching}
            >
              <option value="">Select a Goods Receipt Note to inspect</option>
              {grns.map((g) => (
                <option key={g.grnId} value={g.grnId}>
                  {g.grnNumber} · {g.deliveryNumber || "No Delivery"} · {g.supplierName} · {new Date(g.receivedDate).toLocaleDateString()}
                </option>
              ))}
            </select>

            {/* Selected GRN preview */}
            {selected && (
              <div className="mt-3 bg-surface-muted/30 border border-divider rounded-control p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="type-caption text-text-muted">Goods Receipt Note No.</div>
                  <div className="type-body font-semibold text-text-primary mt-0.5">{selected.grnNumber}</div>
                </div>
                <div>
                  <div className="type-caption text-text-muted">Purchase Order</div>
                  <div className="type-body font-semibold text-text-primary mt-0.5">{selected.poNumber}</div>
                </div>
                {selected.deliveryNumber && selected.deliveryNumber !== "—" && (
                  <div>
                    <div className="type-caption text-text-muted">Delivery No.</div>
                    <div className="type-body font-semibold text-text-primary mt-0.5">{selected.deliveryNumber}</div>
                  </div>
                )}
                <div>
                  <div className="type-caption text-text-muted">Supplier</div>
                  <div className="type-body font-semibold text-text-primary mt-0.5">{selected.supplierName}</div>
                </div>
                <div>
                  <div className="type-caption text-text-muted">Received Date</div>
                  <div className="type-body font-semibold text-text-primary mt-0.5">{new Date(selected.receivedDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="type-caption text-text-muted">Items</div>
                  <div className="type-body font-semibold text-text-primary mt-0.5">{selected.items?.length ?? "—"} line items</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 pt-4 border-t border-divider">
          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            disabled={searching}
            className="rounded-control border border-divider bg-surface px-5 py-2 type-label-button text-text-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Cancel
          </ModalNativeCloseButton>
          <button
            type="button"
            onClick={handleStartInspection}
            disabled={!selected || searching}
            className="inline-flex items-center gap-2 rounded-control bg-button-primary px-5 py-2 type-label-button text-text-inverse hover:bg-button-primary-hover transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {searching ? "Finding Inspection…" : "Start Quality Assurance Inspection"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
