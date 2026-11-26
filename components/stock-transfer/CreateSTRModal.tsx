"use client";
import { toast } from "sonner";
import { getFutureDateError, getMaxFutureDateString, getTodayDateString } from "@/lib/date-limits";
import { Skeleton } from "@/components/ui/skeleton";
import { createRequest, getNextRequestNumber } from "@/app/actions/stock-transfer/requests";
import { suggestLots } from "@/app/actions/stock-transfer/lot-suggestions";
import { listFinishedProducts } from "@/app/actions/stock-transfer/products";
import { listLocations } from "@/app/actions/stock-transfer/locations";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, AlertCircle, Calendar } from "lucide-react";
import { FinishedProductOption, LocationOption, CreateSTRPrefill } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { StockTransferConfirmModal } from "./StockTransferConfirmModal";

export const STR_REASON_CHOICES = [
  "Branch Replenishment",
  "Safety Stock Buffer",
  "Upcoming Promotion / Event",
  "Emergency Restock",
  "Seasonal Demand Preparation",
  "Stock Rebalancing",
  "Damaged / Expired Goods Replacement",
  "Other",
] as const;

interface CreateSTRModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefill?: CreateSTRPrefill | null;
}

export interface AllocatedLotItem {
  lotId: number;
  lotCode: string;
  quantityRemaining: number;
  allocatedQuantity: number;
  expiryDate: string;
}

interface NewItemRow {
  productId: number | "";
  productName: string;
  variant: string;
  sku: string;
  requestedQuantity: number | "";
  availableQuantity: number;
  allocatedLots: AllocatedLotItem[];
  lotCode?: string;
  lotExpiry?: string;
  isChecking: boolean;
  notes: string;
}

function formatExpiryDisplay(raw?: string | null): string {
  if (!raw || raw === "No Expiry" || raw === "N/A") return "No expiry";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CreateSTRModal({ open, onClose, onSuccess, prefill = null }: CreateSTRModalProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<FinishedProductOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  // Form Fields
  const [requestNumber, setRequestNumber] = useState<string>("");
  const [prerequisitesReady, setPrerequisitesReady] = useState(false);
  const [prerequisitesLoading, setPrerequisitesLoading] = useState(false);
  const [toLocationId, setToLocationId] = useState<string>("");
  const [requiredDate, setRequiredDate] = useState<string>("");
  const [priority, setPriority] = useState<string>("Medium");
  const [reasonChoice, setReasonChoice] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [items, setItems] = useState<NewItemRow[]>([
    {
      productId: "",
      productName: "",
      variant: "",
      sku: "",
      requestedQuantity: "",
      availableQuantity: 0,
      allocatedLots: [],
      lotCode: "",
      lotExpiry: "",
      isChecking: false,
      notes: "",
    },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPrerequisites();
    }
  }, [open, prefill?.branchRequestId]);

  async function fetchPrerequisites() {
    setPrerequisitesLoading(true);
    setPrerequisitesReady(false);
    setFormError(null);
    try {
      const [reqNumRes, prodRes, locRes] = await Promise.all([
        actionResponse(getNextRequestNumber()),
        actionResponse(listFinishedProducts()),
        actionResponse(listLocations()),
      ]);

      if (reqNumRes.data?.success && reqNumRes.data?.data) {
        setRequestNumber(reqNumRes.data.data);
      }
      if (prodRes.data?.success) {
        setProducts(prodRes.data.data || []);
      }

      const allLocs: LocationOption[] = locRes.data?.success ? locRes.data.data || [] : [];
      const destinations = allLocs.filter(
        (l) => !l.isSystemLocation && !l.locationName.toLowerCase().includes("factory")
      );

      // Apply Branch Stock Request prefill when launched via "Transfer Now"
      if (prefill) {
        const normalizedBranchName = prefill.branchName.trim().toLowerCase();
        const exactIdInDest = destinations.find((l) => l.locationId === prefill.branchId);
        const byNameInDest = destinations.find(
          (l) => l.locationName.trim().toLowerCase() === normalizedBranchName
        );
        const inAllByName = allLocs.find(
          (l) => l.locationName.trim().toLowerCase() === normalizedBranchName
        );
        const inAllById = allLocs.find((l) => l.locationId === prefill.branchId);

        const resolvedLoc: LocationOption =
          (exactIdInDest && exactIdInDest.locationName.trim().toLowerCase() === normalizedBranchName
            ? exactIdInDest
            : null) ||
          byNameInDest ||
          exactIdInDest ||
          inAllByName ||
          inAllById || {
            locationId: prefill.branchId,
            locationName: prefill.branchName,
            locationType: "Branch",
            isSystemLocation: false,
          };

        const finalLocations = destinations.some((l) => l.locationId === resolvedLoc.locationId)
          ? destinations
          : [resolvedLoc, ...destinations];
        setLocations(finalLocations);

        const loadedProducts: FinishedProductOption[] = prodRes.data?.success ? prodRes.data.data || [] : [];
        const matchedProd = loadedProducts.find((p) => p.productId === prefill.productId);
        setToLocationId(String(resolvedLoc.locationId));
        setReasonChoice("Branch Replenishment");
        setItems([
          {
            productId: prefill.productId,
            productName: matchedProd?.itemName || prefill.productName,
            variant: matchedProd?.variant || prefill.variationName,
            sku: matchedProd?.sku || prefill.sku,
            requestedQuantity: prefill.remainingQuantity,
            availableQuantity: 0,
            allocatedLots: [],
            lotCode: "",
            lotExpiry: "",
            isChecking: true,
            notes: `POS Branch Request ${prefill.branchRequestNumber}`,
          },
        ]);
        await checkAvailability(0, prefill.productId, prefill.remainingQuantity);
      } else {
        setLocations(destinations);
      }

      setPrerequisitesReady(true);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unable to load products and destinations. Please retry.");
    } finally {
      setPrerequisitesLoading(false);
    }
  }

  const checkAvailability = async (index: number, prodId: number, qty: number) => {
    try {
      const res = await actionResponse(suggestLots(`productId=${prodId}&quantity=${qty || 1}`));
      if (res.data?.success) {
        const totalAvail = res.data.data.totalAvailable || 0;
        const suggestedLots: any[] = res.data.data.suggestedLots || [];

        const allocated: AllocatedLotItem[] = suggestedLots
          .filter((l) => Number(l.allocatedQuantity) > 0)
          .map((l) => ({
            lotId: l.lotId,
            lotCode: (l.lotCode || "").replace(/^FG-/i, ""),
            quantityRemaining: l.quantityRemaining,
            allocatedQuantity: l.allocatedQuantity,
            expiryDate: l.expiryDate || "No Expiry",
          }));

        const finalAllocated: AllocatedLotItem[] = allocated.length > 0
          ? allocated
          : (suggestedLots[0] ? [{
              lotId: suggestedLots[0].lotId,
              lotCode: (suggestedLots[0].lotCode || "").replace(/^FG-/i, ""),
              quantityRemaining: suggestedLots[0].quantityRemaining,
              allocatedQuantity: 0,
              expiryDate: suggestedLots[0].expiryDate || "No Expiry",
            }] : []);

        const firstLot = finalAllocated[0];

        setItems((prev) => {
          const next = [...prev];
          if (next[index]) {
            next[index].availableQuantity = totalAvail;
            next[index].allocatedLots = finalAllocated;
            next[index].lotCode = firstLot ? firstLot.lotCode : "No Lot";
            next[index].lotExpiry = firstLot ? firstLot.expiryDate : "No Lot";
            next[index].isChecking = false;
          }
          return next;
        });
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unable to check available stock. Please retry.");
      setItems((prev) => {
        const next = [...prev];
        if (next[index]) next[index].isChecking = false;
        return next;
      });
    }
  };

  const handleProductChange = (index: number, val: string) => {
    const prodId = parseInt(val, 10);
    const prod = products.find((p) => p.productId === prodId);
    if (!prod) return;

    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: prodId,
        productName: prod.itemName,
        variant: prod.variant,
        sku: prod.sku,
        isChecking: true,
      };
      return next;
    });

    const qty = typeof items[index].requestedQuantity === "number" ? items[index].requestedQuantity : 1;
    checkAvailability(index, prodId, Number(qty));
  };

  const handleQuantityChange = (index: number, val: string) => {
    const parsed = val === "" ? "" : parseFloat(val);
    setItems((prev) => {
      const next = [...prev];
      next[index].requestedQuantity = parsed;
      return next;
    });

    const row = items[index];
    if (typeof parsed === "number" && row.availableQuantity > 0 && parsed > row.availableQuantity) {
      setFormError(`Requested quantity (${parsed}) for "${row.productName || "product"}" exceeds available commissary stock (${row.availableQuantity}).`);
    } else {
      setFormError(null);
    }

    const prodId = items[index].productId;
    if (typeof prodId === "number" && typeof parsed === "number" && parsed > 0) {
      checkAvailability(index, prodId, parsed);
    }
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: "",
        productName: "",
        variant: "",
        sku: "",
        requestedQuantity: "",
        availableQuantity: 0,
        allocatedLots: [],
        lotCode: "",
        lotExpiry: "",
        isChecking: false,
        notes: "",
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !prerequisitesReady) return;
    setFormError(null);

    if (!toLocationId) {
      setFormError("Please select a destination branch.");
      return;
    }

    const dateError = getFutureDateError(requiredDate, "Required date");
    if (dateError) {
      setFormError(dateError);
      return;
    }

    if (!reasonChoice) {
      setFormError("Please select a reason for the transfer request.");
      return;
    }

    if (reasonChoice === "Other" && !customReason.trim()) {
      setFormError("Please specify the reason for the transfer request.");
      return;
    }

    const seenProductIds = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      if (!row.productId) {
        setFormError(`Please select a finished product for item row #${i + 1}.`);
        return;
      }
      if (seenProductIds.has(Number(row.productId))) {
        setFormError(`"${row.productName || "Product"}" is already added in another row. Duplicate products are not allowed.`);
        return;
      }
      seenProductIds.add(Number(row.productId));
      if (typeof row.requestedQuantity !== "number" || row.requestedQuantity <= 0) {
        setFormError(`Please enter a valid quantity greater than zero for row #${i + 1}.`);
        return;
      }
      if (row.availableQuantity <= 0) {
        setFormError(`"${row.productName || "Product"}" in row #${i + 1} is currently out of stock.`);
        return;
      }
      if (row.requestedQuantity > row.availableQuantity) {
        setFormError(
          `Requested quantity (${row.requestedQuantity}) for "${row.productName || "Product"}" in row #${i + 1} exceeds available commissary stock (${row.availableQuantity}).`
        );
        return;
      }
      if (prefill && row.requestedQuantity > prefill.remainingQuantity) {
        setFormError(
          `Requested quantity (${row.requestedQuantity}) exceeds the remaining approved quantity (${prefill.remainingQuantity}) for branch request ${prefill.branchRequestNumber}.`
        );
        return;
      }
    }

    setShowSubmitConfirm(true);
  };

  const doSubmit = async () => {
    setLoading(true);
    setFormError(null);
    try {
      const effectiveReason = reasonChoice === "Other" ? customReason.trim() : reasonChoice;
      const payload = {
        requestNumber: requestNumber || undefined,
        ...(prefill ? { branchRequestId: prefill.branchRequestId } : {}),
        toLocationId: parseInt(toLocationId, 10),
        requiredDate,
        priority,
        reason: effectiveReason,
        items: items.map((i) => ({
          productId: i.productId,
          requestedQuantity: Number(i.requestedQuantity),
          notes: i.notes || null,
        })),
      };

      const res = await actionResponse(createRequest(payload));
      if (res.data?.success) {
        toast.success("Transfer request created.");
        setShowSubmitConfirm(false);
        onSuccess();
        onClose();
      } else {
        setFormError(res.data?.message || "Failed to create transfer request.");
        setShowSubmitConfirm(false);
      }
    } catch (err: unknown) {
      setFormError((err instanceof Error ? err.message : null) || "Failed to create transfer request.");
      setShowSubmitConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper
      open={open}
      title="Create Stock Transfer Request"
      subtitle="Request finished goods replenishment from the commissary to a branch store."
      onClose={() => { if (!loading) onClose(); }}
      maxWidthPx={900}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden text-ink">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {prerequisitesLoading && (
            <div role="status" aria-label="Loading products and destinations" className="space-y-3">
              <Skeleton className="h-10 w-full rounded-control" />
              <Skeleton className="h-10 w-full rounded-control" />
            </div>
          )}
          {!prerequisitesLoading && !prerequisitesReady && (
            <button type="button" onClick={fetchPrerequisites} className="type-caption underline text-ink cursor-pointer">
              Retry loading products and destinations
            </button>
          )}
          {prefill && (
            <div className="rounded-control bg-status-purple-bg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-primary">
              <span className="type-body-secondary font-medium">
                Fulfilling Branch Stock Request {prefill.branchRequestNumber} · {prefill.branchName}
              </span>
              <span className="type-caption font-medium tabular-nums">
                {prefill.remainingQuantity} of {prefill.approvedQuantity} pcs remaining
              </span>
            </div>
          )}
          {formError && (
            <div className="rounded-control border border-notice-danger-border bg-notice-danger-bg px-3.5 py-2.5 type-body-secondary text-notice-danger-text flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
              <span role="alert">{formError}</span>
            </div>
          )}

          {/* Section 1: Request details (2-column clean inputs inside bordered section card) */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            <div className="space-y-0.5">
              <h3 className="type-subsection text-ink">Request details</h3>
              <p className="type-caption text-ink-muted">
                Select the destination branch, target date, and reason for transfer.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-4">
              {/* Request number */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Request number
                </label>
                <div className="flex items-center h-10 px-3 rounded-control border border-input bg-page type-body text-ink-secondary select-all">
                  {requestNumber || "Generating..."}
                </div>
              </div>

              {/* Destination branch */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Destination branch <span className="text-destructive">*</span>
                </label>
                <Select
                  value={toLocationId}
                  onValueChange={(val) => {
                    if (val || !prefill) setToLocationId(val);
                  }}
                  disabled={Boolean(prefill)}
                >
                  <SelectTrigger className="w-full h-10 px-3 rounded-control border-input bg-surface type-body text-ink">
                    <SelectValue placeholder={prefill?.branchName || "Select Destination Branch"} />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border text-ink">
                    {locations.map((loc) => (
                      <SelectItem key={loc.locationId} value={String(loc.locationId)} className="type-body">
                        {loc.locationName} ({loc.locationType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Required date */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Required date <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    min={getTodayDateString()}
                    max={getMaxFutureDateString()}
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full h-10 rounded-control border-input bg-surface px-3 pr-10 type-body text-ink cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="block type-label-field text-ink-strong">
                  Priority
                </label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-full h-10 px-3 rounded-control border-input bg-surface type-body text-ink">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    <SelectItem value="Low" className="type-body">Low</SelectItem>
                    <SelectItem value="Medium" className="type-body">Medium</SelectItem>
                    <SelectItem value="High" className="type-body">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason / Purpose */}
              <div className={reasonChoice === "Other" ? "space-y-1.5" : "space-y-1.5 sm:col-span-2"}>
                <label className="block type-label-field text-ink-strong">
                  Reason / Purpose <span className="text-destructive">*</span>
                </label>
                <Select
                  value={reasonChoice}
                  onValueChange={(val) => {
                    setReasonChoice(val);
                    setFormError(null);
                  }}
                >
                  <SelectTrigger className="w-full h-10 px-3 rounded-control border-input bg-surface type-body text-ink">
                    <SelectValue placeholder="Select Reason" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {STR_REASON_CHOICES.map((choice) => (
                      <SelectItem key={choice} value={choice} className="type-body">
                        {choice === "Other" ? "Other (Please specify)" : choice}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Reason if Other */}
              {reasonChoice === "Other" && (
                <div className="space-y-1.5">
                  <label className="block type-label-field text-ink-strong">
                    Specify reason <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="Please specify reason for stock transfer..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="h-10 rounded-control border-input bg-surface px-3 type-body text-ink"
                    maxLength={100}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Finished products to transfer (wide roomy table with separate Lot & Expiry columns) */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="type-subsection text-ink">
                  Finished products to transfer ({items.length})
                </h3>
                <p className="type-caption text-ink-muted">
                  The lot that expires first (FEFO) is assigned automatically.
                </p>
              </div>
              {!prefill && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItemRow}
                  disabled={products.length > 0 && items.length >= products.length}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-control border-border bg-surface type-label-button-sm text-primary hover:bg-subtle shadow-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add product
                </Button>
              )}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="border-b border-divider">
                  <tr className="whitespace-nowrap">
                    <th className="pb-2.5 pr-3 type-caption font-medium text-ink-muted min-w-[210px]">Product &amp; variant</th>
                    <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[100px]">SKU</th>
                    <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[125px]">Commissary</th>
                    <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[105px]">Lot</th>
                    <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[105px]">Expiry date</th>
                    <th className="pb-2.5 px-2.5 type-caption font-medium text-ink-muted min-w-[84px]">Qty</th>
                    <th className="pb-2.5 pl-1 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {items.map((row, idx) => {
                    const isInsufficient =
                      Boolean(row.productId) &&
                      typeof row.requestedQuantity === "number" &&
                      row.requestedQuantity > 0 &&
                      row.requestedQuantity > row.availableQuantity;

                    return (
                      <tr key={idx} className="align-middle">
                        <td className="py-2.5 pr-3">
                          <Select
                            value={row.productId ? String(row.productId) : ""}
                            onValueChange={(val) => handleProductChange(idx, val)}
                            disabled={Boolean(prefill)}
                          >
                            <SelectTrigger className="h-9 rounded-control border-input bg-surface type-body text-ink w-full">
                              <SelectValue placeholder="Select Finished Product" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 bg-surface border-border">
                              {products
                                .filter(
                                  (p) =>
                                    p.productId === row.productId ||
                                    !items.some((other, oIdx) => oIdx !== idx && other.productId === p.productId)
                                )
                                .map((p) => (
                                  <SelectItem key={p.productId} value={String(p.productId)} className="type-body-secondary">
                                    {p.itemName} ({p.variant || "Standard"})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </td>

                        <td className="py-2.5 px-2.5 type-body-secondary text-ink-secondary whitespace-nowrap">
                          {row.sku || "—"}
                        </td>

                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          {row.productId ? (
                            <div className="flex items-center gap-1.5">
                              <span className="type-body text-ink tabular-nums">
                                {row.availableQuantity}
                              </span>
                              {isInsufficient ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-status-red-bg text-status-red-fg type-caption font-medium">
                                  Shortage
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-status-green-bg text-status-green-fg type-caption font-medium">
                                  (In Stock)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="type-body text-ink-muted">—</span>
                          )}
                        </td>

                        {/* Separate Lot column */}
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          {row.productId ? (
                            row.isChecking ? (
                              <Skeleton aria-label="Checking stock" className="h-4 w-16" />
                            ) : row.allocatedLots && row.allocatedLots.length > 0 ? (
                              <div className="space-y-1">
                                {row.allocatedLots.map((al, aIdx) => (
                                  <div key={aIdx} className="type-body-secondary text-ink-secondary">
                                    {al.lotCode}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="type-body-secondary text-ink-muted">No lot</span>
                            )
                          ) : (
                            <span className="type-body-secondary text-ink-muted">—</span>
                          )}
                        </td>

                        {/* Separate Expiry date column */}
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          {row.productId ? (
                            row.isChecking ? (
                              <Skeleton aria-label="Checking expiry" className="h-4 w-20" />
                            ) : row.allocatedLots && row.allocatedLots.length > 0 ? (
                              <div className="space-y-1">
                                {row.allocatedLots.map((al, aIdx) => (
                                  <div key={aIdx} className="type-body text-ink">
                                    {formatExpiryDisplay(al.expiryDate)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="type-body-secondary text-ink-muted">—</span>
                            )
                          ) : (
                            <span className="type-body-secondary text-ink-muted">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-2.5">
                          <Input
                            type="number"
                            min="1"
                            max={
                              prefill
                                ? Math.min(
                                    prefill.remainingQuantity,
                                    row.availableQuantity > 0 ? row.availableQuantity : prefill.remainingQuantity
                                  )
                                : row.availableQuantity > 0
                                ? row.availableQuantity
                                : undefined
                            }
                            step="1"
                            value={row.requestedQuantity}
                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                            className={`h-9 rounded-control border bg-surface type-body text-ink tabular-nums w-20 ${
                              isInsufficient || (prefill && typeof row.requestedQuantity === "number" && row.requestedQuantity > prefill.remainingQuantity)
                                ? "border-destructive text-destructive focus-visible:ring-destructive"
                                : "border-input"
                            }`}
                          />
                          {isInsufficient && (
                            <p className="type-caption text-destructive mt-1">
                              Max {row.availableQuantity}
                            </p>
                          )}
                          {!isInsufficient &&
                            prefill &&
                            typeof row.requestedQuantity === "number" &&
                            row.requestedQuantity > prefill.remainingQuantity && (
                              <p className="type-caption text-destructive mt-1">
                                Max {prefill.remainingQuantity}
                              </p>
                            )}
                        </td>

                        <td className="py-2.5 pl-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length <= 1}
                            aria-label="Remove product row"
                            className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pinned #fafafa Footer Bar */}
        <div className="shrink-0 bg-page border-t border-topbar px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="type-caption text-ink-muted">
            Submitted requests go to Admin for approval before scheduling.
          </p>
          <div className="flex items-center gap-2">
            <ModalCloseButton
              type="button"
              variant="outline"
              disabled={loading}
              fallbackOnClose={onClose}
              className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none transition-colors cursor-pointer"
            >
              Cancel
            </ModalCloseButton>
            <Button
              type="submit"
              disabled={
                loading ||
                !prerequisitesReady ||
                items.some(
                  (row) =>
                    row.isChecking ||
                    !row.productId ||
                    typeof row.requestedQuantity !== "number" ||
                    row.requestedQuantity <= 0 ||
                    row.availableQuantity <= 0 ||
                    row.requestedQuantity > row.availableQuantity ||
                    Boolean(prefill && row.requestedQuantity > prefill.remainingQuantity)
                )
              }
              className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </form>

      {showSubmitConfirm && (
        <StockTransferConfirmModal
          open={showSubmitConfirm}
          title="Submit Stock Transfer Request"
          subtitle={requestNumber ? `Request No: ${requestNumber}` : undefined}
          description={`Are you sure you want to submit stock transfer request ${requestNumber || ""} for ${items.length} product(s) to ${locations.find((l) => String(l.locationId) === toLocationId)?.locationName || prefill?.branchName || "the branch"}? Once submitted, it will be routed to the Admin for approval.`}
          confirmText="Confirm & Submit"
          loading={loading}
          onCancel={() => {
            if (!loading) setShowSubmitConfirm(false);
          }}
          onConfirm={doSubmit}
        />
      )}
    </ModalWrapper>
  );
}
