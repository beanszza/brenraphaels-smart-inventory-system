"use client";
import { ProductionSkeleton } from "./ProductionSkeleton";
import { listBatches as productionListBatches } from "@/app/actions/production/batches";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SearchInput } from "@/components/shared/SearchInput";
import { ProductionBatchEntity } from "./types";
import ProductionBatchDetailView from "./ProductionBatchDetailView";

interface ProductionTrackingTabProps {
  initialRows: ProductionBatchEntity[];
  initialBatchId?: number | null;
  onNavigateToBatches?: () => void;
  currentUser: string;
}

export default function ProductionTrackingTab({
  initialRows,
  initialBatchId,
  currentUser,
}: ProductionTrackingTabProps) {
  const [batches, setBatches] = useState<ProductionBatchEntity[]>(initialRows);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(initialBatchId ?? null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await actionResponse(productionListBatches());
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setBatches(list);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load production batches.");
    } finally {
      setLoading(false);
    }
  }, []);


  // Active Batches = Batches currently undergoing kitchen production or packaging
  // (Excluding rejected, completed, stocked in, for stock-in, or already sent to QA)
  const activeBatches = useMemo(() => {
    return batches.filter(
      (b) =>
        b.status !== "Rejected" &&
        b.status !== "Completed" &&
        b.status !== "Stocked In" &&
        b.status !== "For Stock-in" &&
        b.status !== "For QA" &&
        b.status !== "Cancelled"
    );
  }, [batches]);

  const displayedBatches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activeBatches;

    return activeBatches.filter(
      (b) =>
        b.batchNumber?.toLowerCase().includes(q) ||
        (b.reqNumber && b.reqNumber.toLowerCase().includes(q)) ||
        b.productName?.toLowerCase().includes(q) ||
        (b.assignedCook && b.assignedCook.toLowerCase().includes(q))
    );
  }, [activeBatches, searchQuery]);

  // If currently selected batch is no longer active (e.g. finished packaging -> moved to QA), clear selection
  useEffect(() => {
    if (selectedBatchId && !loading) {
      const stillActive = activeBatches.some((b) => b.batchId === selectedBatchId);
      if (!stillActive) {
        setSelectedBatchId(null);
      }
    }
  }, [activeBatches, selectedBatchId, loading]);

  return (
    <div className="space-y-6 animate-page-in">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-divider pb-4">
        <div>
          <h2 className="type-section-title text-text-primary">Production Tracking</h2>
          <p className="mt-1 type-body text-text-muted">
            Track active kitchen batches, advance cooking stages, complete packaging, and record batch outcomes.
          </p>
        </div>
        {!selectedBatchId && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBatches}
              className="type-body h-9 px-3.5 rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary font-semibold cursor-pointer"
            >
              Refresh
            </Button>
          </div>
        )}
      </div>

      {/* ── Slim Sidebar + Spacious Main Production Layout ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Left Column: Compact Active Batches Bar (w-full lg:w-64 shrink-0) */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="border border-divider rounded-card bg-surface p-3 space-y-3 shadow-card">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-1 border-b border-divider">
              <h3 className="type-table-header uppercase text-text-primary">Active Batches</h3>
              <span className="type-caption font-medium text-text-muted">
                {activeBatches.length} {activeBatches.length === 1 ? "Batch" : "Batches"}
              </span>
            </div>

            {/* Search Input */}
            <SearchInput
              containerClassName="h-9"
              placeholder="Search active batches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="type-caption"
            />

            {/* Batches List */}
            <div className="space-y-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
              {loading ? (
                <ProductionSkeleton />
              ) : displayedBatches.length === 0 ? (
                <div className="py-10 px-3 text-center type-caption text-text-muted">
                  No active batches in kitchen production.
                </div>
              ) : (
                displayedBatches.map((b) => {
                  const isSelected = b.batchId === selectedBatchId;
                  return (
                    <div
                      key={b.batchId}
                      onClick={() => setSelectedBatchId(b.batchId)}
                      className={`p-3 rounded-control border transition-all cursor-pointer text-left ${
                        isSelected
                          ? "border-brand bg-brand-light/30 ring-1 ring-brand shadow-xs"
                          : "border-divider bg-surface hover:border-brand/40 hover:bg-surface-hover"
                      }`}
                    >
                      <div className="min-w-0">
                        <span
                          className="font-semibold type-body text-text-primary block truncate"
                          title={b.batchNumber}
                        >
                          {b.batchNumber}
                        </span>
                        <span
                          className="type-caption text-text-muted block mt-0.5 truncate"
                          title={b.recipeName || b.productName}
                        >
                          {b.recipeName || b.productName}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-divider flex items-center justify-between type-caption">
                        <span className="font-medium text-text-primary bg-surface-secondary px-2 py-0.5 rounded-control border border-divider">
                          {b.currentStage || b.stage || "Pre-Production"}
                        </span>
                        <span className="font-semibold text-text-primary">
                          {b.estimatedQuantity} {b.yieldUom || "jars"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Waterfall Stage Progression & Packaging (flex-1) */}
        <div className="flex-1 min-w-0 w-full">
          {!selectedBatchId ? (
            <div className="rounded-card border border-divider bg-surface p-16 text-center shadow-card flex flex-col items-center justify-center min-h-[380px]">
              <p className="type-body text-text-muted">
                Select an active batch from the left to execute the waterfall stages.
              </p>
            </div>
          ) : (
            <ProductionBatchDetailView
              batchId={selectedBatchId}
              onBack={() => setSelectedBatchId(null)}
              currentUser={currentUser}
              onRefreshList={fetchBatches}
            />
          )}
        </div>
      </div>
    </div>
  );
}
