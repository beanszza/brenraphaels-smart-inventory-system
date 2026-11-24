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
import { Plus, Trash2, AlertCircle, Package, Calendar } from "lucide-react";
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
  }, [open]);

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
      if (locRes.data?.success) {
        // Exclude commissary / system locations from destination options
        const allLocs: LocationOption[] = locRes.data.data || [];
        const destinations = allLocs.filter(
          (l) => !l.isSystemLocation && !l.locationName.toLowerCase().includes("factory")
        );
        setLocations(destinations);
      }

      // Apply Branch Stock Request prefill when launched via "Transfer Now"
      if (prefill) {
        const loadedProducts: FinishedProductOption[] = prodRes.data?.success ? prodRes.data.data || [] : [];
        const matchedProd = loadedProducts.find((p) => p.productId === prefill.productId);
        setToLocationId(String(prefill.branchId));
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

        // Identify lots allocated according to FEFO order
        const allocated: AllocatedLotItem[] = suggestedLots
          .filter((l) => Number(l.allocatedQuantity) > 0)
          .map((l) => ({
            lotId: l.lotId,
            lotCode: (l.lotCode || "").replace(/^FG-/i, ""),
            quantityRemaining: l.quantityRemaining,
            allocatedQuantity: l.allocatedQuantity,
            expiryDate: l.expiryDate || "No Expiry",
          }));

        // If none allocated (e.g. qty is 0), fall back to first lot
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
      onClose={() => { if (!loading) onClose(); }}
      size="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-ink">
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
            <span className="type-body-secondary font-semibold">
              Fulfilling Branch Stock Request {prefill.branchRequestNumber} · {prefill.branchName}
            </span>
            <span className="type-caption font-semibold tabular-nums">
              {prefill.remainingQuantity} of {prefill.approvedQuantity} pcs remaining
            </span>
          </div>
        )}
        {formError && (
          <div className="rounded-control border border-destructive/40 bg-destructive/10 p-3.5 type-caption text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span role="alert">{formError}</span>
          </div>
        )}

        {/* Form Top Grid - Request No, Destination, Required Date, Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* Request Number (Auto-assigned, visible immediately) */}
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink">
              Request Number
            </label>
            <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-subtle type-body-secondary font-mono font-semibold text-ink select-all">
              {requestNumber || "Generating..."}
            </div>
          </div>

          {/* Destination Branch */}
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink">
              Destination Branch <span className="text-destructive">*</span>
            </label>
            <Select value={toLocationId} onValueChange={setToLocationId} disabled={Boolean(prefill)}>
              <SelectTrigger className="w-full h-10 px-3.5 rounded-control border-border bg-surface type-body text-ink">
                <SelectValue placeholder="Select Destination Branch" />
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

          {/* Required Fulfillment Date with far-right calendar icon */}
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink">
              Required Date <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type="date"
                min={getTodayDateString()}
                max={getMaxFutureDateString()}
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full h-10 rounded-control border-border bg-surface px-3.5 pr-10 type-body text-ink cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="block type-label-field text-ink">
              Priority
            </label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-full h-10 px-3.5 rounded-control border-border bg-surface type-body font-medium text-ink">
                <SelectValue placeholder="Select Priority" />
              </SelectTrigger>
              <SelectContent className="bg-surface border-border">
                <SelectItem value="Low" className="type-body">Low</SelectItem>
                <SelectItem value="Medium" className="type-body">Medium</SelectItem>
                <SelectItem value="High" className="type-body">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason / Purpose Dropdown */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
            <label className="block type-label-field text-ink">
              Reason / Purpose <span className="text-destructive">*</span>
            </label>
            <Select
              value={reasonChoice}
              onValueChange={(val) => {
                setReasonChoice(val);
                setFormError(null);
              }}
            >
              <SelectTrigger className="w-full h-10 px-3.5 rounded-control border-border bg-surface type-body text-ink">
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

          {/* If 'Other' chosen: Specify Reason field */}
          {reasonChoice === "Other" && (
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <label className="block type-label-field text-ink">
                Specify Reason <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="Please specify reason for stock transfer..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="h-10 rounded-control border-border bg-surface px-3.5 type-body text-ink"
                maxLength={100}
              />
            </div>
          )}
        </div>

        {/* Dynamic Items Table */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="type-subsection text-ink flex items-center gap-2">
              <Package className="w-4 h-4 text-ink-muted" />
              Finished Products to Transfer ({items.length})
            </h3>
            {!prefill && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItemRow}
                disabled={products.length > 0 && items.length >= products.length}
                className="flex items-center gap-1.5 px-3.5 h-9 rounded-control border-border bg-surface type-label-button-sm text-ink hover:bg-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product
              </Button>
            )}
          </div>

          <div className="table-card shadow-card">
            <div className="overflow-x-auto table-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="table-head-row border-b border-divider">
                  <tr className="text-left whitespace-nowrap">
                    <th className="table-th py-2.5 px-3 min-w-[220px]">Product &amp; Variant</th>
                    <th className="table-th py-2.5 px-3 min-w-[100px] whitespace-nowrap">SKU</th>
                    <th className="table-th py-2.5 px-3 min-w-[120px] whitespace-nowrap">Commissary Stock</th>
                    <th className="table-th py-2.5 px-3 min-w-[190px]">Expiry Date &amp; Lots</th>
                    <th className="table-th py-2.5 px-3 min-w-[96px] whitespace-nowrap">Quantity</th>
                    <th className="table-th py-2.5 px-2 w-10 text-center"></th>
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
                      <tr key={idx} className="table-row hover:bg-subtle/40 transition-colors">
                        <td className="px-3 py-3 table-td">
                          <Select
                            value={row.productId ? String(row.productId) : ""}
                            onValueChange={(val) => handleProductChange(idx, val)}
                            disabled={Boolean(prefill)}
                          >
                            <SelectTrigger className="h-9 rounded-control border-border bg-surface type-body-secondary font-medium text-ink w-full">
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

                        <td className="px-3 py-3 table-td text-ink-muted whitespace-nowrap">
                          {row.sku || "—"}
                        </td>

                        <td className="px-3 py-3 table-td font-medium whitespace-nowrap">
                          {row.productId ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-ink">
                                {row.availableQuantity}
                              </span>
                              {isInsufficient ? (
                                <span className="type-caption text-destructive font-semibold">
                                  (Shortage)
                                </span>
                              ) : (
                                <span className="type-caption text-ink font-semibold">
                                  (In Stock)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>

                        <td className="px-3 py-3 table-td text-ink-muted">
                          {row.productId ? (
                            row.isChecking ? (
                              <Skeleton aria-label="Checking stock" className="h-4 w-16" />
                            ) : row.allocatedLots && row.allocatedLots.length > 0 ? (
                              <div className="space-y-1.5 py-0.5">
                                {row.allocatedLots.map((al, aIdx) => (
                                  <div key={aIdx} className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-ink type-caption">
                                        {al.expiryDate && al.expiryDate !== "No Expiry" && al.expiryDate !== "N/A"
                                          ? (() => {
                                              try {
                                                const d = new Date(al.expiryDate);
                                                return isNaN(d.getTime()) ? al.expiryDate : d.toLocaleDateString();
                                              } catch {
                                                return al.expiryDate;
                                              }
                                            })()
                                          : "No Expiry"}
                                      </span>
                                    </div>
                                    <div className="type-caption text-ink-muted font-mono">
                                      Lot: {al.lotCode}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-ink-muted type-caption">No lot</span>
                            )
                          ) : (
                            <span className="text-ink-muted type-caption">—</span>
                          )}
                        </td>

                        <td className="px-3 py-3 table-td">
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
                            className={`h-9 rounded-control border bg-surface type-body-secondary text-ink font-semibold w-24 ${
                              isInsufficient || (prefill && typeof row.requestedQuantity === "number" && row.requestedQuantity > prefill.remainingQuantity)
                                ? "border-destructive text-destructive focus-visible:ring-destructive"
                                : "border-border"
                            }`}
                          />
                          {isInsufficient && (
                            <p className="type-caption text-destructive font-semibold mt-1">
                              Exceeds stock ({row.availableQuantity})
                            </p>
                          )}
                          {!isInsufficient &&
                            prefill &&
                            typeof row.requestedQuantity === "number" &&
                            row.requestedQuantity > prefill.remainingQuantity && (
                              <p className="type-caption text-destructive font-semibold mt-1">
                                Exceeds remaining ({prefill.remainingQuantity})
                              </p>
                            )}
                        </td>

                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length <= 1}
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

        {/* Form Actions Footer (matching SupplierModal) */}
        <div className="flex items-center justify-end gap-3 pt-5 pb-3 border-t border-divider mt-6 mb-2">
          <ModalCloseButton
            type="button"
            variant="outline"
            disabled={loading}
            fallbackOnClose={onClose}
            className="rounded-control border border-border bg-surface px-5 py-2.5 type-label-button text-ink hover:bg-subtle transition-colors h-10 cursor-pointer"
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
            className="rounded-control bg-primary text-primary-foreground px-5 py-2.5 type-label-button hover:bg-primary-hover transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed h-10 cursor-pointer"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </form>

      {showSubmitConfirm && (
        <StockTransferConfirmModal
          open={showSubmitConfirm}
          title="Submit Stock Transfer Request"
          subtitle={requestNumber ? `Request No: ${requestNumber}` : undefined}
          description={`Are you sure you want to submit stock transfer request ${requestNumber || ""} for ${items.length} product(s) to ${locations.find((l) => String(l.locationId) === toLocationId)?.locationName || "the branch"}? Once submitted, it will be routed to the Admin for approval.`}
          confirmText="Confirm & Submit"
          loading={loading}
          onCancel={() => setShowSubmitConfirm(false)}
          onConfirm={doSubmit}
        />
      )}
    </ModalWrapper>
  );
}
