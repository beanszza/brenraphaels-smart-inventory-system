"use client";
import { ProductionSkeleton } from "./ProductionSkeleton";
import { listBatches as productionListBatches } from "@/app/actions/production/batches";
import { commitBatchInventory as productionCommitBatchInventory } from "@/app/actions/production/batch-add-to-inventory";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listItems } from "@/app/actions/production/lookups";
import { actionResponse } from "@/lib/resources/action-response";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Eye, ArrowDownToLine, X, AlertTriangle } from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";
import { useIsAdmin } from "@/context/StaffContext";
import { useConfirmedClose } from "@/components/shared/ModalCloseContext";

interface ProductionStockInTabProps {
  initialRows: any[];
  initialItems: any[];
  currentUser?: string;
}

export default function ProductionStockInTab({ initialRows, initialItems,  currentUser = "Inventory Manager" }: ProductionStockInTabProps) {
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState<boolean>(false);
  const [batches, setBatches] = useState<any[]>(initialRows);
  const [inventoryItems, setInventoryItems] = useState<any[]>(initialItems);
  const [loading, setLoading] = useState<boolean>(false);

  // Filter & Search states (matching Resources & Suppliers layout)
  const [subTab, setSubTab] = useState<"all" | "pending" | "history">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("All");

  // Dropdown row action state
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  // Modal State: "Create Stock-In Report"
  const [isStockInModalOpen, setIsStockInModalOpen] = useState<boolean>(false);
  const [modalSelectedBatchId, setModalSelectedBatchId] = useState<number | "">("");
  const [stockInNotes, setStockInNotes] = useState<string>("");
  const [committing, setCommitting] = useState<boolean>(false);
  const [confirmCommitModal, setConfirmCommitModal] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close row dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".action-menu-container")) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch batches & inventory reference
  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const [batchesRes, invRes] = await Promise.all([
        actionResponse(productionListBatches()),
        actionResponse(listItems()),
      ]);

      const batchList = Array.isArray(batchesRes.data)
        ? batchesRes.data
        : Array.isArray(batchesRes.data?.data)
        ? batchesRes.data.data
        : [];
      setBatches(batchList);

      const invList = Array.isArray(invRes.data?.data?.items)
        ? invRes.data.data.items
        : Array.isArray(invRes.data?.data)
        ? invRes.data.data
        : [];
      setInventoryItems(invList);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load batches for stock-in.");
    } finally {
      setLoading(false);
    }
  }, []);


  // Derived unique product names for dropdown filter
  const uniqueProducts = useMemo(() => {
    return Array.from(new Set(batches.map((b) => b.productName).filter(Boolean)));
  }, [batches]);

  // Status Filter splits
  const pendingBatches = useMemo(() => {
    return batches.filter((b) => b.status === "For Stock-in");
  }, [batches]);

  const historyBatches = useMemo(() => {
    return batches.filter((b) => b.status === "Stocked In" || b.status === "Completed");
  }, [batches]);

  const allBatches = useMemo(() => {
    return batches.filter(
      (b) => b.status === "For Stock-in" || b.status === "Stocked In" || b.status === "Completed"
    );
  }, [batches]);

  // Filtered batches according to subTab, search, and product filter
  const displayedBatches = useMemo(() => {
    let list = subTab === "all" ? allBatches : subTab === "pending" ? pendingBatches : historyBatches;

    if (productFilter !== "All") {
      list = list.filter((b) => b.productName === productFilter);
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;

    return list.filter(
      (b) =>
        b.batchNumber?.toLowerCase().includes(q) ||
        (b.reqNumber && b.reqNumber.toLowerCase().includes(q)) ||
        b.productName?.toLowerCase().includes(q) ||
        (b.fgLotCode && b.fgLotCode.toLowerCase().includes(q))
    );
  }, [subTab, allBatches, pendingBatches, historyBatches, productFilter, searchQuery]);

  // Currently selected batch inside the modal
  const selectedBatchInModal = useMemo(() => {
    if (!modalSelectedBatchId) return null;
    return batches.find((b) => b.batchId === Number(modalSelectedBatchId)) || null;
  }, [batches, modalSelectedBatchId]);

  // Get current stock for the selected batch product
  const currentStockForSelected = useMemo(() => {
    if (!selectedBatchInModal) return 0;
    const match = inventoryItems.find(
      (i) => i.itemName?.toLowerCase() === selectedBatchInModal.productName?.toLowerCase()
    );
    return match ? Number(match.currentStock ?? 0) : 0;
  }, [selectedBatchInModal, inventoryItems]);

  // Eligible finished goods lots for the dropdown:
  // Strictly finished batches ready for stock in (plus the active one if viewing details)
  const availableLotsForDropdown = useMemo(() => {
    if (selectedBatchInModal && !pendingBatches.some((b) => b.batchId === selectedBatchInModal.batchId)) {
      return [selectedBatchInModal, ...pendingBatches];
    }
    return pendingBatches;
  }, [pendingBatches, selectedBatchInModal]);

  const { requestClose: requestCloseStockInModal, confirmModal: stockInCloseConfirm } = useConfirmedClose(() =>
    setIsStockInModalOpen(false)
  );

  // Open modal from Header button: start empty (not pre-filled)
  const handleOpenCreateModal = () => {
    setModalSelectedBatchId("");
    setStockInNotes("");
    setIsStockInModalOpen(true);
  };

  // Open modal from row "View Details" or "Commit"
  const handleOpenForBatch = (b: any) => {
    setModalSelectedBatchId(b.batchId);
    setStockInNotes("");
    setIsStockInModalOpen(true);
    setActiveDropdownId(null);
  };

  // Commit Stock-In Handler
  const handleCommitStockIn = async () => {
    if (!selectedBatchInModal) {
      toast.error("Please select a finished goods lot first.");
      return;
    }

    if (selectedBatchInModal.status !== "For Stock-in") {
      toast.error(`Batch is currently in status "${selectedBatchInModal.status}". Only batches in "For Stock-in" can be committed.`);
      return;
    }

    setCommitting(true);
    try {
      const res = await actionResponse(productionCommitBatchInventory(selectedBatchInModal.batchId, {
        notes: stockInNotes.trim(),
      }));

      if (res.data?.success) {
        toast.success(
          `Stock-in committed! ${res.data.data?.quantityAdded ?? selectedBatchInModal.finalQuantity ?? selectedBatchInModal.actualQuantity} units added under lot ${res.data.data?.lotCode || selectedBatchInModal.fgLotCode}.`
        );
        setIsStockInModalOpen(false);
        setModalSelectedBatchId("");
        setStockInNotes("");
        await fetchBatches();
      } else {
        toast.error(res.data?.message || "Failed to commit stock-in.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "An error occurred during stock-in.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-page-in">
      {/* ── Header (Matching Resources & Suppliers Header) ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Finished Goods Stock-In</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review completed batches passed by Quality Assurance and commit finished products into active inventory.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBatches}
            className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Refresh
          </Button>
          {!isAdmin && (
            <Button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={16} /> Create Stock-In
            </Button>
          )}
        </div>
      </div>

      {/* ── Search & Filter Bar (Matching Resources & Suppliers Card) ── */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-3">
          <SearchInput
            containerClassName="flex-1"
            placeholder="Search by name, lot, or batch (e.g. UJ-261008-02)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs"
          />
          <div className="flex items-center gap-2 shrink-0">
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="h-9 min-w-[200px] w-auto rounded-xl border border-border bg-card px-3.5 text-xs font-medium text-foreground shadow-xs">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent className="min-w-[200px]">
                <SelectItem value="All">All Products</SelectItem>
                {uniqueProducts.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Status Pills (Matching Resources & Suppliers Pill Tabs) ── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab("all")}
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            subTab === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border/80 bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <span>All</span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
              subTab === "all" ? "bg-background text-foreground font-bold" : "bg-muted text-muted-foreground"
            }`}
          >
            {allBatches.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("pending")}
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            subTab === "pending"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border/80 bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <span>Ready for Stock-In</span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
              subTab === "pending" ? "bg-background text-foreground font-bold" : "bg-muted text-muted-foreground"
            }`}
          >
            {pendingBatches.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("history")}
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            subTab === "history"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border/80 bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <span>Stock-In History</span>
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
              subTab === "history" ? "bg-background text-foreground font-bold" : "bg-muted text-muted-foreground"
            }`}
          >
            {historyBatches.length}
          </span>
        </button>
      </div>

      {/* ── Table (Matching SupplyTable layout: No QA Status, No Variant Under Name) ── */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <ProductionSkeleton />
        ) : displayedBatches.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {subTab === "pending"
                ? "No finished goods batches waiting for stock-in."
                : "No stock-in records found."}
            </p>
            <p className="text-xs text-muted-foreground">
              Batches cleared by Quality Assurance will appear here ready to commit to inventory.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
                <th className="px-4 py-4">Finished Goods Lot</th>
                <th className="px-4 py-4">Product Name</th>
                <th className="px-4 py-4">Batch Number</th>
                <th className="px-4 py-4 text-right">Units to Stock</th>
                <th className="px-4 py-4">Expiry Date</th>
                <th className="w-16 px-4 py-4 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedBatches.map((b) => (
                <tr key={b.batchId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                    {(b.fgLotCode || "").replace(/^FG-/i, "") || "Pending Lot"}
                  </td>
                  <td className="px-4 py-4 text-sm text-foreground whitespace-nowrap">
                    {b.productName}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                    {b.batchNumber}
                  </td>
                  <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">
                    {Number(b.finalQuantity || b.actualQuantity).toLocaleString()} {b.yieldUom || "jars"}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                    {b.expiryDate
                      ? new Date(b.expiryDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="w-16 px-4 py-4 text-center relative whitespace-nowrap action-menu-container" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDropdownId(activeDropdownId === b.batchId ? null : b.batchId)
                      }
                      className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors cursor-pointer focus:outline-none"
                      title="Actions"
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {activeDropdownId === b.batchId && (
                      <div className="absolute right-4 top-10 z-[100] w-40 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left animate-in fade-in">
                        <button
                          type="button"
                          onClick={() => handleOpenForBatch(b)}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                          <Eye size={14} className="shrink-0" />
                          <span>View Details</span>
                        </button>
                        {!isAdmin && b.status === "For Stock-in" && (
                          <button
                            type="button"
                            onClick={() => handleOpenForBatch(b)}
                            className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer border-t border-border/60"
                          >
                            <ArrowDownToLine size={14} className="shrink-0" />
                            <span>Commit Stock-In</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal: Create Stock-In Report ── */}
      {mounted && isStockInModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="font-sans fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 sm:p-6 animate-in fade-in duration-150"
        >
          {stockInCloseConfirm}
          <div
            style={{ width: "100%", maxWidth: "980px" }}
            className="w-full max-h-[90vh] p-6 rounded-2xl border border-border bg-card flex flex-col shadow-2xl shrink-0 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Create Stock-In Report</h2>
              <button
                type="button"
                onClick={requestCloseStockInModal}
                className="text-foreground/60 hover:text-foreground hover:bg-muted p-1 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-5">
              {/* Select Finished Goods Lot (Not pre-filled) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Select Finished Goods Lot
                </label>
                <div>
                  <select
                    value={modalSelectedBatchId}
                    onChange={(e) => setModalSelectedBatchId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full sm:w-96 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="">
                      Select Finished Goods Lot
                    </option>
                    {availableLotsForDropdown.map((b) => (
                      <option key={b.batchId} value={b.batchId}>
                        {(b.fgLotCode || "").replace(/^FG-/i, "") || b.batchNumber} — {b.productName} ({b.finalQuantity || b.actualQuantity} {b.yieldUom || "jars"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table when batch selected (Matching User Image 2: No variant under product name) */}
              {selectedBatchInModal && (
                <div className="space-y-3 animate-in fade-in">
                  <span className="font-semibold text-xs uppercase text-muted-foreground block">
                    Items
                  </span>

                  <div className="rounded-xl border border-border bg-card overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="border-b border-border bg-muted/30">
                        <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
                          <th className="px-4 py-4 whitespace-nowrap">Supply Name</th>
                          <th className="px-4 py-4 text-center whitespace-nowrap">Unit of Measure</th>
                          <th className="px-4 py-4 text-right whitespace-nowrap">Stock to Put In</th>
                          <th className="px-4 py-4 text-right whitespace-nowrap">Current Stock</th>
                          <th className="px-4 py-4 whitespace-nowrap">Lot No.</th>
                          <th className="px-4 py-4 text-center whitespace-nowrap">Expiry Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                            {selectedBatchInModal.productName}
                          </td>
                          <td className="px-4 py-4 text-sm text-center text-muted-foreground whitespace-nowrap">
                            {selectedBatchInModal.yieldUom || "jars"}
                          </td>
                          <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">
                            {Number(
                              selectedBatchInModal.finalQuantity || selectedBatchInModal.actualQuantity
                            ).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-sm text-right text-muted-foreground whitespace-nowrap">
                            {currentStockForSelected.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                            {(selectedBatchInModal.fgLotCode || "").replace(/^FG-/i, "") || selectedBatchInModal.batchNumber}
                          </td>
                          <td className="px-4 py-4 text-sm text-center text-muted-foreground whitespace-nowrap">
                            {selectedBatchInModal.expiryDate
                              ? new Date(selectedBatchInModal.expiryDate).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Stock-In Notes / Storage Instructions */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-semibold text-foreground block">
                      Stock-In Notes / Storage Instructions
                    </label>
                    <Textarea
                      rows={2}
                      value={stockInNotes}
                      onChange={(e) => setStockInNotes(e.target.value)}
                      placeholder="Specify designated warehouse aisle, refrigeration, or special storage notes..."
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={requestCloseStockInModal}
                  className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </Button>
                {selectedBatchInModal && !isAdmin && (
                  <Button
                    type="button"
                    disabled={committing || selectedBatchInModal.status !== "For Stock-in"}
                    onClick={() => setConfirmCommitModal(true)}
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {committing
                      ? "Committing..."
                      : selectedBatchInModal.status === "For Stock-in"
                      ? "Commit to Inventory"
                      : "Already Stocked In"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Confirmation Modal for Commit to Inventory (Matching PO / PR Confirmation Format) ── */}
      {mounted && confirmCommitModal && selectedBatchInModal && typeof document !== "undefined" && createPortal(
        <div
          className="pointer-events-auto font-sans fixed inset-0 z-[100002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            style={{ width: "100%", maxWidth: "440px" }}
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center justify-center text-center">
              {/* Circular Alert Icon */}
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
                <AlertTriangle className="w-6 h-6" />
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-foreground mb-1">
                Confirm Stock-In
              </h2>

              {/* Subtitle */}
              <p className="text-xs font-semibold text-muted-foreground mb-3">
                Lot: {(selectedBatchInModal.fgLotCode || "").replace(/^FG-/i, "") || selectedBatchInModal.batchNumber}
              </p>

              {/* Message */}
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                You are about to commit <strong className="text-foreground">{Number(selectedBatchInModal.finalQuantity || selectedBatchInModal.actualQuantity).toLocaleString()} {selectedBatchInModal.yieldUom || "jars"}</strong> of <strong className="text-foreground">{selectedBatchInModal.productName}</strong> to active inventory. This action is permanent.
              </p>

              {/* Buttons matching PO / PR Confirmation format */}
              <div className="flex justify-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setConfirmCommitModal(false)}
                  disabled={committing}
                  className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmCommitModal(false);
                    await handleCommitStockIn();
                  }}
                  disabled={committing}
                  className="flex-1 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/85 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {committing ? "Committing..." : "Confirm & Commit"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
