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
import { createPortal } from "react-dom";
import { X, Plus, Trash2, AlertCircle, Package, Calendar } from "lucide-react";
import { FinishedProductOption, LocationOption } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmedClose } from "@/components/shared/ModalCloseContext";

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

export function CreateSTRModal({ open, onClose, onSuccess }: CreateSTRModalProps) {
  const [mounted, setMounted] = useState(false);
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
      requestedQuantity: 1,
      availableQuantity: 0,
      allocatedLots: [],
      lotCode: "",
      lotExpiry: "",
      isChecking: false,
      notes: "",
    },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      fetchPrerequisites();
      return () => {
        document.body.style.overflow = original;
      };
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
        requestedQuantity: 1,
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

  const handleSubmit = async (e: React.FormEvent) => {
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

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      if (!row.productId) {
        setFormError(`Please select a finished product for item row #${i + 1}.`);
        return;
      }
      if (typeof row.requestedQuantity !== "number" || row.requestedQuantity <= 0) {
        setFormError(`Please enter a valid quantity greater than zero for row #${i + 1}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const effectiveReason = reasonChoice === "Other" ? customReason.trim() : reasonChoice;
      const payload = {
        requestNumber: requestNumber || undefined,
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
        onSuccess();
        onClose();
      } else {
        setFormError(res.data?.message || "Failed to create transfer request.");
      }
    } catch (err: unknown) {
      setFormError((err instanceof Error ? err.message : null) || "Failed to create transfer request.");
    } finally {
      setLoading(false);
    }
  };

  const { requestClose, confirmModal } = useConfirmedClose(onClose);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="font-sans fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 sm:p-6 animate-in fade-in duration-150"
    >
      {confirmModal}
      <div
        style={{ width: "100%", maxWidth: "1050px" }}
        className="w-full max-h-[92vh] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col text-foreground shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">
                Create Stock Transfer Request
              </h2>
              {requestNumber && (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-muted border border-border text-foreground font-mono font-bold tracking-wide">
                  {requestNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submit a transfer request to distribute finished goods to a branch
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {prerequisitesLoading && <div role="status" aria-label="Loading products and destinations" className="space-y-3">
            <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
          </div>}
          {!prerequisitesLoading && !prerequisitesReady && <button type="button" onClick={fetchPrerequisites} className="text-sm underline">Retry loading products and destinations</button>}
          {formError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span role="alert">{formError}</span>
            </div>
          )}

          {/* Form Top Grid - Request No, Destination, Required Date, Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Request Number (Auto-assigned, visible immediately) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Request Number
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs font-mono font-bold text-foreground select-all">
                {requestNumber || "Generating..."}
              </div>
            </div>

            {/* Destination Branch */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Destination Branch <span className="text-destructive">*</span>
              </label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger className="h-10 rounded-xl border border-border bg-card text-xs font-medium text-foreground">
                  <SelectValue placeholder="Select Destination Branch" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.locationId} value={String(loc.locationId)}>
                      {loc.locationName} ({loc.locationType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Required Fulfillment Date with far-right calendar icon */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Required Date <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type="date"
                  min={getTodayDateString()}
                  max={getMaxFutureDateString()}
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3.5 pr-10 text-xs text-foreground cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Priority
              </label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-10 rounded-xl border border-border bg-card text-xs font-medium text-foreground">
                  <SelectValue placeholder="Select Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason / Purpose Dropdown matching Destination Branch column width */}
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-semibold text-foreground">
                Reason / Purpose <span className="text-destructive">*</span>
              </label>
              <Select
                value={reasonChoice}
                onValueChange={(val) => {
                  setReasonChoice(val);
                  setFormError(null);
                }}
              >
                <SelectTrigger className="h-10 rounded-xl border border-border bg-card text-xs font-medium text-foreground">
                  <SelectValue placeholder="Select Reason" />
                </SelectTrigger>
                <SelectContent>
                  {STR_REASON_CHOICES.map((choice) => (
                    <SelectItem key={choice} value={choice}>
                      {choice === "Other" ? "Other (Please specify)" : choice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* If 'Other' chosen: Specify Reason field */}
            {reasonChoice === "Other" && (
              <div className="space-y-1.5 sm:col-span-3">
                <label className="text-xs font-semibold text-foreground">
                  Specify Reason <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Please specify reason for stock transfer..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-card text-xs text-foreground"
                  maxLength={100}
                />
              </div>
            )}
          </div>

          {/* Dynamic Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                Finished Products to Transfer ({items.length})
              </h3>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="px-4 py-3 min-w-[220px]">Product & Variant</th>
                      <th className="px-4 py-3 min-w-[130px] whitespace-nowrap">SKU</th>
                      <th className="px-4 py-3 min-w-[125px] whitespace-nowrap">Commissary Stock</th>
                      <th className="px-4 py-3 min-w-[130px] whitespace-nowrap">Expiry Date</th>
                      <th className="px-4 py-3 min-w-[100px] whitespace-nowrap">Quantity</th>
                      <th className="px-4 py-3 min-w-[160px]">Notes</th>
                      <th className="px-3 py-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((row, idx) => {
                      const isInsufficient =
                        typeof row.requestedQuantity === "number" &&
                        row.requestedQuantity > row.availableQuantity;

                      return (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <Select
                              value={row.productId ? String(row.productId) : ""}
                              onValueChange={(val) => handleProductChange(idx, val)}
                            >
                              <SelectTrigger className="h-9 rounded-xl border border-border bg-card text-xs font-medium text-foreground w-full">
                                <SelectValue placeholder="Select Finished Product" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {products.map((p) => (
                                  <SelectItem key={p.productId} value={String(p.productId)}>
                                    {p.itemName} ({p.variant || "Standard"})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>

                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {row.sku || "—"}
                          </td>

                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            {row.productId ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-foreground">
                                  {row.availableQuantity}
                                </span>
                                {isInsufficient ? (
                                  <span className="text-[10px] text-destructive font-semibold">
                                    (Shortage)
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-foreground font-semibold">
                                    (In Stock)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {row.productId ? (
                              row.isChecking ? (
                                <Skeleton aria-label="Checking stock" className="h-4 w-16" />
                              ) : row.allocatedLots && row.allocatedLots.length > 0 ? (
                                <div className="space-y-1.5 py-0.5">
                                  {row.allocatedLots.map((al, aIdx) => (
                                    <div key={aIdx} className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-foreground text-xs">
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
                                        {al.allocatedQuantity > 0 && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground border border-border">
                                            {al.allocatedQuantity} pcs
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground font-mono">
                                        Lot: {al.lotCode}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">No lot</span>
                              )
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={row.requestedQuantity}
                              onChange={(e) => handleQuantityChange(idx, e.target.value)}
                              className="h-9 rounded-xl border border-border bg-card text-xs text-foreground font-semibold w-24"
                            />
                          </td>

                          <td className="px-4 py-3">
                            <Input
                              type="text"
                              placeholder="Notes / instructions..."
                              value={row.notes}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItems((prev) => {
                                  const next = [...prev];
                                  next[idx].notes = val;
                                  return next;
                                });
                              }}
                              className="h-9 rounded-xl border border-border bg-card text-xs text-foreground"
                            />
                          </td>

                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              disabled={items.length <= 1}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer"
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

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={requestClose}
              disabled={loading}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !prerequisitesReady || items.some(row => row.isChecking)}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
