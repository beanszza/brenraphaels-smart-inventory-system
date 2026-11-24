"use client";
import { Skeleton } from "@/components/ui/skeleton";

import { allPages } from "@/lib/orders/screen-data";
import { listOrders } from "@/app/actions/orders/orders";
import { listDeliveries } from "@/app/actions/orders/deliveries";
import { procurement } from "@/lib/orders/client";
import { uploadDeliveryAttachmentDirect } from "@/app/actions/orders/delivery-files";

import React, { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronLeft,
  FileText,
  Hash,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import ConfirmModal from "@/components/ConfirmModal";
import { getFutureDateError, getMaxFutureDateString, getTodayDateString } from "@/lib/date-limits";
import { PurchaseOrderPO, Delivery } from "../types";

export interface CreateDeliveryModalProps {
  open?: boolean;
  initialPo?: PurchaseOrderPO | null;
  backLabel?: string;
  embedded?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreateDeliveryBodyProps extends CreateDeliveryModalProps {
  variant: "page" | "modal";
}

interface ItemRow {
  poItemId: number;
  itemId: number;
  itemName: string;
  itemCode: string;
  purchaseUomName: string;
  poOrderedQuantity: number;
  poTotalReceivedQuantity: number;
  alreadyScheduledQuantity: number;
  availableToSchedule: number;
  orderQuantity: number;
}

function formatDisplayDate(raw?: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return "—";
  return `₱${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CreateDeliveryBody({
  open = true,
  initialPo,
  backLabel,
  embedded = false,
  onClose,
  onSuccess,
  variant,
}: CreateDeliveryBodyProps) {
  const [deliveryNumber, setDeliveryNumber] = useState(`DLV-${new Date().getFullYear()}-0001`);
  const [orderedPOs, setOrderedPOs] = useState<PurchaseOrderPO[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(initialPo?.poId ?? null);
  const [pendingPoId, setPendingPoId] = useState<number | null>(null);
  const [confirmPoChange, setConfirmPoChange] = useState(false);
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");

  const [loadingPOs, setLoadingPOs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form Fields
  const [paymentType, setPaymentType] = useState("Payable");
  const [plannedDispatchDate, setPlannedDispatchDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string>("");
  const [attachmentFileName, setAttachmentFileName] = useState("");

  // Items
  const [items, setItems] = useState<ItemRow[]>([]);
  const [existingDeliveries, setExistingDeliveries] = useState<Delivery[]>([]);

  // Helper to calculate total declared quantity across all active (non-cancelled) deliveries for a PO item
  const getActiveScheduledForPoItem = (
    deliveriesList: Delivery[],
    poId: number,
    poNumber?: string,
    poItemId?: number,
    itemId?: number
  ) => {
    let sum = 0;
    deliveriesList.forEach((d) => {
      const matchPo = (d.poId && d.poId === poId) || (poNumber && d.poNumber === poNumber);
      if (matchPo && ["Scheduled", "Arrived"].includes(d.status)) {
        (d.items || []).forEach((di) => {
          const matchItem =
            (poItemId && di.poItemId && di.poItemId === poItemId) ||
            (itemId && di.itemId && di.itemId === itemId);
          if (matchItem) {
            sum += Number(di.declaredQuantity) || 0;
          }
        });
      }
    });
    return sum;
  };

  // Fetch Delivery sequence for unique delivery number preview & Approved/Ordered POs
  useEffect(() => {
    if (!open) return;

    const fetchInitialData = async () => {
      try {
        setLoadingPOs(true);
        const [delivRes, poRes] = await Promise.allSettled([
          allPages(listDeliveries).then((items) => ({ data: { success: true, data: { items } } })),
          allPages(listOrders, "eligibleForDelivery=true").then((items) => ({ data: { success: true, data: { items } } })),
        ]);

        if (delivRes.status === "rejected" || poRes.status === "rejected") throw new Error("Data unavailable");
        let deliveryList: any[] = [];
        // Calculate next unique Delivery Number (uniform DLV-YYYY-XXXX format) & store deliveries
        if (delivRes.status === "fulfilled" && delivRes.value.data?.success) {
          deliveryList = delivRes.value.data.data?.items || delivRes.value.data.data || [];
          setExistingDeliveries(deliveryList);

          const year = new Date().getFullYear();
          let maxSeq = 0;
          deliveryList.forEach((d) => {
            if (d.deliveryNumber) {
              const match = String(d.deliveryNumber).match(/(?:DLV|DEL)-\d{4}-(\d+)/i);
              if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxSeq) maxSeq = num;
              }
            }
          });
          const nextSeq = String(maxSeq + 1).padStart(4, "0");
          setDeliveryNumber(`DLV-${year}-${nextSeq}`);
        }

        // Available POs (do NOT auto-select if initialPo is null)
        if (poRes.status === "fulfilled" && poRes.value.data?.success) {
          const raw: any[] = poRes.value.data.data?.items || poRes.value.data.data || [];
          const candidate = raw.filter(
            (p) =>
              p.status === "Ordered" ||
              p.status === "Approved" ||
              p.status === "Partially Delivered" ||
              p.status === "PartiallyDelivered"
          );

          const eligible: PurchaseOrderPO[] = [];
          await Promise.all(
            candidate.map(async (po) => {
              try {
                const outRes = await procurement.outstandingItems(po.poId);
                if (outRes.data?.success && Array.isArray(outRes.data.data) && outRes.data.data.length > 0) {
                  const hasRemaining = outRes.data.data.some(
                    (item: any) => Number(item.remainingQuantity ?? 0) > 0
                  );
                  if (hasRemaining) {
                    eligible.push(po);
                  }
                  return;
                }
                const poItems: any[] = po.items || [];
                const hasRemaining = poItems.some((item: any) => {
                  const ordered = Number(item.poOrderedQuantity ?? item.poItemQuantity ?? item.orderedQuantity) || 0;
                  const received = Number(item.poTotalReceivedQuantity ?? item.receivedQuantity) || 0;
                  const delivScheduled = getActiveScheduledForPoItem(
                    deliveryList,
                    po.poId,
                    po.poNumber,
                    item.poItemId,
                    item.itemId
                  );
                  return ordered - received - delivScheduled > 0;
                });
                if (hasRemaining) {
                  eligible.push(po);
                }
              } catch {
                // If endpoint check fails, check local PO items
                const hasRemaining = (po.items || []).some((item: any) => {
                  const ordered = Number(item.poItemQuantity || item.orderedQuantity) || 0;
                  const received = Number(item.receivedQuantity) || 0;
                  const delivScheduled = getActiveScheduledForPoItem(
                    deliveryList,
                    po.poId,
                    po.poNumber,
                    item.poItemId,
                    item.itemId
                  );
                  return ordered - received - delivScheduled > 0;
                });
                if (hasRemaining) {
                  eligible.push(po);
                }
              }
            })
          );
          eligible.sort((a, b) => b.poId - a.poId);
          setOrderedPOs(eligible);
        }
      } catch {
        setError("Purchase orders could not be loaded. Close and reopen the form to retry.");
      } finally {
        setLoadingPOs(false);
      }
    };

    if (initialPo) {
      setSelectedPoId(initialPo.poId);
      if (initialPo.paymentType === "Paid" || initialPo.paymentType === "Payable") {
        setPaymentType(initialPo.paymentType);
      }
    } else {
      setSelectedPoId(null);
      setItems([]);
      setAttachmentFile(null);
      setAttachmentPreviewUrl("");
      setAttachmentFileName("");
      setPaymentType("Payable");
      setPlannedDispatchDate(new Date().toISOString().slice(0, 10));
      setError(null);
      setFieldErrors({});
    }

    fetchInitialData();
  }, [open, initialPo]);

  // Current selected PO object
  const currentPO = useMemo(() => {
    if (!selectedPoId) return null;
    if (initialPo && initialPo.poId === selectedPoId) return initialPo;
    return orderedPOs.find((p) => p.poId === selectedPoId) || null;
  }, [initialPo, orderedPOs, selectedPoId]);

  // Sync payment type when PO changes
  useEffect(() => {
    if (currentPO?.paymentType === "Paid" || currentPO?.paymentType === "Payable") {
      setPaymentType(currentPO.paymentType);
    }
  }, [currentPO]);

  // Fetch PO items whenever selected PO changes
  useEffect(() => {
    if (!selectedPoId || !open) {
      setItems([]);
      return;
    }

    const fetchOutstanding = async () => {
      try {
        setLoadingItems(true);
        setError(null);
        const res = await procurement.outstandingItems(selectedPoId);
        if (res.data?.success && Array.isArray(res.data.data)) {
          const rows: ItemRow[] = res.data.data.map((i: any) => {
            const ordered = Number(i.poOrderedQuantity ?? i.orderedQuantity ?? i.poItemQuantity) || 0;
            const received = Number(i.poTotalReceivedQuantity ?? i.receivedQuantity) || 0;
            const inFlight = Number(i.inFlightQuantity ?? i.alreadyScheduledQuantity ?? 0);
            const available =
              i.remainingQuantity !== undefined && i.remainingQuantity !== null
                ? Math.max(0, Number(i.remainingQuantity))
                : Math.max(0, ordered - received - inFlight);
            const fallbackCode =
              i.itemCode ||
              currentPO?.items?.find((p: any) => p.itemId === i.itemId)?.itemCode ||
              `SPL-${String(i.itemId || 0).padStart(4, "0")}`;
            return {
              poItemId: i.poItemId,
              itemId: i.itemId,
              itemName: i.itemName,
              itemCode: fallbackCode,
              purchaseUomName: i.purchaseUomName || "Unit",
              poOrderedQuantity: ordered,
              poTotalReceivedQuantity: received,
              alreadyScheduledQuantity: inFlight,
              availableToSchedule: available,
              orderQuantity: available,
            };
          });
          setItems(rows);
        } else if (currentPO?.items) {
          setItems(
            currentPO.items.map((i) => {
              const ordered = Number(i.poItemQuantity) || 0;
              const received = Number(i.receivedQuantity) || 0;
              const delivScheduled = getActiveScheduledForPoItem(
                existingDeliveries,
                selectedPoId,
                currentPO?.poNumber,
                i.poItemId,
                i.itemId
              );
              const inFlight = delivScheduled;
              const available = Math.max(0, ordered - received - inFlight);
              return {
                poItemId: i.poItemId || 0,
                itemId: i.itemId,
                itemName: i.itemName,
                itemCode: i.itemCode || `SPL-${String(i.itemId || 0).padStart(4, "0")}`,
                purchaseUomName: i.purchaseUomName || "Unit",
                poOrderedQuantity: ordered,
                poTotalReceivedQuantity: received,
                alreadyScheduledQuantity: inFlight,
                availableToSchedule: available,
                orderQuantity: available,
              };
            })
          );
        }
      } catch (err) {
        console.error("Failed to load PO items:", err);
        setError("Failed to load purchase order items.");
      } finally {
        setLoadingItems(false);
      }
    };

    fetchOutstanding();
  }, [selectedPoId, open, currentPO, existingDeliveries]);

  // Handle PO selection change with discard confirmation
  const handlePoSelectionChange = (newPoId: number | null) => {
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.poId;
      return copy;
    });
    if (selectedPoId && newPoId !== selectedPoId) {
      setPendingPoId(newPoId);
      setConfirmPoChange(true);
    } else {
      setSelectedPoId(newPoId);
    }
  };

  const applyPoChange = () => {
    setSelectedPoId(pendingPoId);
    setPendingPoId(null);
    setConfirmPoChange(false);
    setError(null);
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.poId;
      return copy;
    });
  };

  const cancelPoChange = () => {
    setPendingPoId(null);
    setConfirmPoChange(false);
  };

  // Handle Order Quantity Input change
  const handleQuantityChange = (poItemId: number, value: string) => {
    const num = parseFloat(value);
    setItems((prev) =>
      prev.map((item) =>
        item.poItemId === poItemId
          ? {
              ...item,
              orderQuantity: isNaN(num) ? 0 : num,
            }
          : item
      )
    );
  };

  // Handle File Selection (uploaded directly to File Storage on submit)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB limit.");
      return;
    }

    setAttachmentFile(file);
    setAttachmentFileName(file.name);
    if (file.type.startsWith("image/")) {
      setAttachmentPreviewUrl(URL.createObjectURL(file));
    } else {
      setAttachmentPreviewUrl("");
    }
  };

  // Validation
  const validationErrors = useMemo(() => {
    const errs: Record<number, string> = {};
    items.forEach((item) => {
      if (item.availableToSchedule > 0) {
        if (item.orderQuantity < 0) {
          errs[item.poItemId] = "Order quantity cannot be negative.";
        } else if (item.orderQuantity > item.availableToSchedule) {
          errs[item.poItemId] = `Cannot exceed available balance (${item.availableToSchedule} ${item.purchaseUomName}).`;
        }
      }
    });
    return errs;
  }, [items]);

  const hasAnyOrderQty = items.some(
    (i) => i.availableToSchedule > 0 && i.orderQuantity > 0 && i.orderQuantity <= i.availableToSchedule
  );
  const hasErrors = Object.keys(validationErrors).length > 0;

  // Form Submission
  const handleSubmit = async () => {
    setError(null);

    const errs: Record<string, string> = {};
    if (!selectedPoId) {
      errs.poId = "Purchase Order selection is required.";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    if (items.length === 0) {
      setError("This Purchase Order has no items available for delivery.");
      return;
    }

    if (hasErrors || !hasAnyOrderQty) {
      setError("Please ensure order quantities are valid and do not exceed available balance.");
      return;
    }

    if (!plannedDispatchDate) {
      setError("Planned Dispatch Date is required.");
      return;
    }

    const dispatchDateErr = getFutureDateError(plannedDispatchDate, "Planned Dispatch Date", { allowToday: true });
    if (dispatchDateErr) {
      setError(dispatchDateErr);
      return;
    }

    const itemsToSchedule = items
      .filter((i) => i.availableToSchedule > 0 && i.orderQuantity > 0)
      .map((i) => ({
        poItemId: i.poItemId,
        declaredQuantity: Number(i.orderQuantity),
      }));

    if (itemsToSchedule.length === 0) {
      setError("Please enter a shipment order quantity for at least one item.");
      return;
    }

    try {
      setSubmitting(true);
      let uploadedFileId: string | null = null;
      if (attachmentFile) {
        const fd = new FormData();
        fd.append("file", attachmentFile);
        const upRes = await uploadDeliveryAttachmentDirect(fd);
        if (!upRes.success || !upRes.data?.fileId) {
          setError(upRes.message || "Failed to upload attachment to file storage.");
          setSubmitting(false);
          return;
        }
        uploadedFileId = upRes.data.fileId;
      }

      const payload = {
        poId: selectedPoId,
        paymentType,
        scheduledDate: plannedDispatchDate
          ? new Date(`${plannedDispatchDate}T12:00:00Z`).toISOString()
          : new Date().toISOString(),
        expectedArrivalDate: null,
        scheduledAttachmentBase64: uploadedFileId,
        attachmentUrl: uploadedFileId,
        carrier: null,
        driverName: null,
        vehiclePlateNumber: null,
        items: itemsToSchedule,
      };

      const res = await procurement.createDelivery(payload);
      if (res.data?.success) {
        onSuccess();
      } else {
        setError(res.data?.message || "Failed to schedule delivery order.");
      }
    } catch (err: any) {
      console.error("Failed to schedule delivery order:", err);
      setError(err?.response?.data?.message || "An unexpected error occurred while scheduling delivery.");
    } finally {
      setSubmitting(false);
    }
  };

  const validScheduledCount = items.filter(
    (i) => i.availableToSchedule > 0 && i.orderQuantity > 0 && i.orderQuantity <= i.availableToSchedule
  ).length;

  const footerHelperText = !selectedPoId
    ? "Step 1 of 2 · Select a purchase order to continue."
    : !attachmentFile
      ? `Step 2 of 2 · ${validScheduledCount} item${validScheduledCount === 1 ? "" : "s"} ready · Upload proof of receipt to continue.`
      : `Step 2 of 2 · ${validScheduledCount} item${validScheduledCount === 1 ? "" : "s"} ready · Proof attached.`;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isSubmitDisabled =
    submitting ||
    !selectedPoId ||
    hasErrors ||
    !hasAnyOrderQty ||
    !attachmentFile ||
    !plannedDispatchDate;

  const renderFormContent = () => (
    <>
      {error && (
        <div className="p-3.5 rounded-inner border border-notice-danger-border bg-notice-danger-bg text-notice-danger-text type-caption flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Card 1: Delivery details (2x2 grid with Payment Type dropdown, no redundant PO strip) */}
      <section className="rounded-card border border-border bg-surface p-5 space-y-4">
        <h2 className="type-subsection text-ink">Delivery details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Delivery Number */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 type-label-field text-ink-strong">
              <span>Delivery Number</span>
              <span className="type-caption text-ink-disabled">(auto-assigned)</span>
            </label>
            <div className="flex items-center gap-2 h-9.5 px-3 rounded-control border border-border bg-page type-body-secondary font-medium text-ink-secondary select-all tabular-nums">
              <Hash className="w-3.5 h-3.5 text-ink-disabled shrink-0" />
              <span>{deliveryNumber}</span>
            </div>
          </div>

          {/* Purchase Order Selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="delivery-po-select"
              className={`flex items-center gap-1 type-label-field ${
                fieldErrors.poId ? "text-destructive" : "text-ink-strong"
              }`}
            >
              <span>Purchase Order</span>
              <span className="text-destructive">*</span>
            </label>
            {initialPo ? (
              <div className="flex items-center h-9.5 px-3 rounded-control border border-border bg-page type-body-secondary font-medium text-ink-secondary tabular-nums">
                {initialPo.poNumber}
              </div>
            ) : (
              <>
                <div className="relative">
                  <select
                    id="delivery-po-select"
                    value={selectedPoId ?? ""}
                    onChange={(e) => handlePoSelectionChange(Number(e.target.value) || null)}
                    disabled={loadingPOs}
                    className={`w-full h-9.5 appearance-none rounded-control border ${
                      fieldErrors.poId
                        ? "border-destructive focus:ring-destructive"
                        : "border-input focus:border-primary focus:ring-focus/30"
                    } bg-surface pl-3 pr-8 type-body-secondary text-ink focus:outline-none focus:ring-2 transition-colors cursor-pointer disabled:opacity-60`}
                  >
                    <option value="">
                      {loadingPOs ? "Loading purchase orders..." : "Select purchase order..."}
                    </option>
                    {orderedPOs.map((p) => (
                      <option key={p.poId} value={p.poId}>
                        {p.poNumber}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-ink-muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
                {fieldErrors.poId && (
                  <p className="type-caption font-medium text-destructive animate-in fade-in-50">
                    {fieldErrors.poId}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Payment Type Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="delivery-payment-type"
              className="flex items-center gap-1 type-label-field text-ink-strong"
            >
              <span>Payment Type</span>
              <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <select
                id="delivery-payment-type"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full h-9.5 appearance-none rounded-control border border-input bg-surface pl-3 pr-8 type-body-secondary text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-focus/30 transition-colors cursor-pointer"
              >
                <option value="Payable">Payable</option>
                <option value="Paid">Paid</option>
              </select>
              <ChevronDown className="w-4 h-4 text-ink-muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Planned Dispatch Date */}
          <div className="space-y-1.5">
            <label
              htmlFor="planned-dispatch-date"
              className="flex items-center gap-1 type-label-field text-ink-strong"
            >
              <span>Planned Dispatch Date</span>
              <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                id="planned-dispatch-date"
                type="date"
                min={getTodayDateString()}
                max={getMaxFutureDateString()}
                value={plannedDispatchDate}
                onChange={(e) => setPlannedDispatchDate(e.target.value)}
                className="w-full h-9.5 rounded-control border border-input bg-surface px-3 pr-9 type-body-secondary text-ink cursor-pointer focus:outline-none focus:border-primary focus:ring-2 focus:ring-focus/30 transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Empty State vs Purchase Order Item Sections */}
      {!selectedPoId ? (
        <section className="rounded-card border border-dashed border-input bg-surface py-10 px-6 text-center flex flex-col items-center justify-center gap-2">
          <div className="size-10 rounded-pill bg-status-purple-bg text-status-purple-fg flex items-center justify-center type-label-field font-semibold">
            PO
          </div>
          <p className="type-body-strong text-ink">No purchase order selected yet</p>
          <p className="type-body-secondary text-ink-muted max-w-sm">
            Choose an eligible purchase order above to view items and schedule delivery.
          </p>
        </section>
      ) : (
        <>
          {/* Card 2: Purchase order items reference (compact rows, no abbreviations) */}
          <section className="rounded-card border border-border bg-surface p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="type-subsection text-ink">Purchase order items reference</h2>
                <p className="mt-0.5 type-caption text-ink-muted">
                  Read-only purchase order balance across previous deliveries.
                </p>
              </div>
              <span className="type-caption font-medium text-ink-muted">
                Read-only Purchase Order balance
              </span>
            </div>

            {loadingItems ? (
              <div className="p-3 rounded-inner border border-divider bg-page">
                <Skeleton className="h-14 w-full" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-6 text-center type-body-secondary text-ink-muted">
                No items found for this purchase order.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full type-table-cell text-left border-collapse">
                  <thead>
                    <tr className="border-b border-divider text-ink-muted type-table-header">
                      <th className="py-1.5 pr-3 w-8 text-center font-medium">#</th>
                      <th className="py-1.5 px-3 font-medium">Supply</th>
                      <th className="py-1.5 px-3 font-medium whitespace-nowrap">Supply Number</th>
                      <th className="py-1.5 px-3 font-medium whitespace-nowrap">Unit of Measure</th>
                      <th className="py-1.5 px-3 text-right font-medium">Ordered</th>
                      <th className="py-1.5 px-3 text-right font-medium">Received</th>
                      <th className="py-1.5 px-3 text-right font-medium">Scheduled</th>
                      <th className="py-1.5 pl-3 text-right font-semibold text-ink-strong">
                        Available
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {items.map((item, idx) => (
                      <tr
                        key={`ref-${item.poItemId || idx}`}
                        className="hover:bg-page transition-colors"
                      >
                        <td className="py-2 pr-3 text-center text-ink-muted">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-ink">{item.itemName}</td>
                        <td className="py-2 px-3 type-caption text-ink-muted whitespace-nowrap tabular-nums">
                          {item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`}
                        </td>
                        <td className="py-2 px-3 text-ink-muted whitespace-nowrap">
                          {item.purchaseUomName}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-ink-muted">
                          {item.poOrderedQuantity}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-ink-muted">
                          {item.poTotalReceivedQuantity}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-ink-muted">
                          {item.alreadyScheduledQuantity}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums font-semibold text-ink">
                          {item.availableToSchedule}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Card 3: Order quantities (compact rows, no abbreviations) */}
          <section className="rounded-card border border-border bg-surface p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-1 type-subsection text-ink">
                  <span>Order quantities</span>
                  <span className="text-destructive">*</span>
                </h2>
                <p className="mt-0.5 type-caption text-ink-muted">
                  Specify quantity being scheduled for this shipment.
                </p>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-ink-disabled pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full h-8.5 rounded-control border border-input bg-surface pl-8 pr-3 type-body-secondary text-ink placeholder:text-ink-disabled focus:outline-none focus:border-primary focus:ring-2 focus:ring-focus/30 transition-colors"
                />
              </div>
            </div>

            {items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full type-table-cell text-left border-collapse">
                  <thead>
                    <tr className="border-b border-divider text-ink-muted type-table-header">
                      <th className="py-1.5 pr-3 font-medium">Ingredient / Supply</th>
                      <th className="py-1.5 px-3 font-medium whitespace-nowrap">Supply Number</th>
                      <th className="py-1.5 px-3 text-right font-medium whitespace-nowrap">
                        Order Quantity
                      </th>
                      <th className="py-1.5 px-3 text-right font-medium whitespace-nowrap">
                        Left to Order
                      </th>
                      <th className="py-1.5 pl-3 text-right w-40 font-semibold text-ink-strong whitespace-nowrap">
                        Quantity to Order
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {items
                      .filter(
                        (item) =>
                          !itemSearch ||
                          item.itemName.toLowerCase().includes(itemSearch.toLowerCase()) ||
                          item.itemCode.toLowerCase().includes(itemSearch.toLowerCase())
                      )
                      .map((item) => {
                        const isExhausted = item.availableToSchedule <= 0;
                        const err = validationErrors[item.poItemId];

                        return (
                          <tr
                            key={`order-${item.poItemId}`}
                            className={`transition-colors ${
                              isExhausted ? "opacity-55 bg-page" : "hover:bg-page"
                            }`}
                          >
                            <td className="py-2 pr-3 font-medium text-ink">{item.itemName}</td>
                            <td className="py-2 px-3 type-caption text-ink-muted whitespace-nowrap tabular-nums">
                              {item.itemCode ||
                                `SPL-${String(item.itemId || 0).padStart(4, "0")}`}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-ink-muted">
                              {item.poOrderedQuantity}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-medium text-ink">
                              {item.availableToSchedule}
                            </td>
                            <td className="py-2 pl-3 text-right">
                              {isExhausted ? (
                                <span className="type-caption text-ink-disabled">
                                  Fully scheduled
                                </span>
                              ) : (
                                <div className="inline-flex flex-col items-end gap-1">
                                  <div
                                    className={`flex items-center justify-between gap-2 h-8.5 w-36 px-2.5 rounded-control border bg-surface transition-colors focus-within:ring-2 ${
                                      err
                                        ? "border-destructive bg-notice-danger-bg focus-within:ring-destructive/25"
                                        : "border-input focus-within:border-primary focus-within:ring-focus/30"
                                    }`}
                                  >
                                    <input
                                      type="number"
                                      min="0.01"
                                      max={item.availableToSchedule}
                                      step="any"
                                      aria-label={`Quantity to order for ${item.itemName}`}
                                      value={item.orderQuantity === 0 ? "" : item.orderQuantity}
                                      onChange={(e) =>
                                        handleQuantityChange(item.poItemId, e.target.value)
                                      }
                                      className="w-full bg-transparent type-body-secondary font-semibold text-ink tabular-nums focus:outline-none"
                                    />
                                    <span className="type-caption text-ink-disabled shrink-0 select-none">
                                      {item.purchaseUomName}
                                    </span>
                                  </div>
                                  {err && (
                                    <p className="type-caption text-destructive text-right font-medium animate-in fade-in-50">
                                      {err}
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Card 4: Proof of receipt / attachment */}
          <section className="rounded-card border border-border bg-surface p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1 type-subsection text-ink">
                <span>Proof of receipt / attachment</span>
                <span className="text-destructive">*</span>
              </h2>
              {!attachmentFile ? (
                <span className="type-caption font-medium text-destructive">
                  Required to schedule delivery
                </span>
              ) : (
                <span className="type-caption text-ink-disabled">
                  JPG, PNG, or PDF up to 10 MB
                </span>
              )}
            </div>

            {attachmentFile ? (
              <div className="rounded-inner border border-input bg-page p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-9 rounded-control bg-status-purple-bg text-status-purple-fg flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="type-body-secondary font-medium text-ink truncate">
                        {attachmentFileName || "Uploaded document"}
                      </p>
                      <p className="type-caption text-ink-muted">
                        {formatFileSize(attachmentFile.size)} · Ready to upload
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="cursor-pointer h-8 px-2.5 rounded-control border border-border bg-surface hover:bg-subtle type-caption font-medium text-ink transition-colors inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Change</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentFile(null);
                        setAttachmentFileName("");
                        if (attachmentPreviewUrl) {
                          URL.revokeObjectURL(attachmentPreviewUrl);
                        }
                        setAttachmentPreviewUrl("");
                      }}
                      className="h-8 px-2.5 rounded-control border border-notice-danger-border bg-surface text-destructive hover:bg-notice-danger-bg type-caption font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                {attachmentPreviewUrl && (
                  <div className="flex justify-center rounded-control border border-topbar bg-surface p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachmentPreviewUrl}
                      alt="Proof of receipt"
                      className="max-h-48 rounded-control object-contain"
                    />
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-inner border border-dashed border-input bg-page py-6 px-4 text-center hover:border-primary hover:bg-tint-selected/40 transition-colors cursor-pointer">
                <div className="size-9 rounded-pill border border-input bg-surface flex items-center justify-center text-ink-muted mb-2">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="type-body-secondary font-medium text-ink">
                  Click to upload receipt or proof photo
                </span>
                <span className="type-caption text-ink-muted mt-0.5">
                  JPG, PNG, or PDF up to 10 MB
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </section>
        </>
      )}
    </>
  );

  const renderSummarySidebar = () => (
    <aside className="xl:sticky xl:top-5">
      <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
        <h2 className="type-subsection text-ink">Delivery summary</h2>

        <div className="space-y-2.5 type-body-secondary">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Delivery Number</span>
            <span className="font-medium text-ink tabular-nums">{deliveryNumber}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Purchase Order</span>
            <span className="font-medium text-ink tabular-nums">
              {currentPO?.poNumber || "Not selected"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Supplier</span>
            <span className="font-medium text-ink text-right truncate max-w-[180px]">
              {currentPO?.supplierName || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Payment Type</span>
            <span className="font-medium text-ink">{paymentType}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Planned Dispatch</span>
            <span className="font-medium text-ink">{formatDisplayDate(plannedDispatchDate)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Items to schedule</span>
            <span className="font-medium text-ink tabular-nums">
              {validScheduledCount} {validScheduledCount === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Proof of Receipt</span>
            <span
              className={`font-medium ${
                attachmentFile ? "text-status-green-fg" : "text-destructive"
              }`}
            >
              {attachmentFile ? "Attached" : "Required"}
            </span>
          </div>
        </div>

        <div className="border-t border-divider pt-3 flex items-center justify-between gap-3">
          <span className="type-subsection text-ink">Total Purchase Order Amount</span>
          <span className="type-card-title font-bold text-primary tabular-nums">
            {currentPO?.totalAmount ? formatCurrency(currentPO.totalAmount) : "—"}
          </span>
        </div>
      </div>
    </aside>
  );

  const renderSharedModals = () => (
    <>
      {/* Discard Confirmation when changing selected PO */}
      {confirmPoChange && (
        <ConfirmModal
          message="Changing the Purchase Order will discard any entered delivery quantities and dates for the current Purchase Order. Do you wish to continue?"
          onConfirm={applyPoChange}
          onCancel={cancelPoChange}
        />
      )}

      {/* Close Confirmation when leaving New Delivery Order page */}
      <ActionConfirmModal
        open={confirmCloseOpen}
        title="Discard Delivery Order?"
        subtitle={`Delivery Number: ${deliveryNumber}`}
        description="Are you sure you want to close this form? Any unsaved delivery details will be discarded."
        confirmLabel="Yes, Close"
        cancelLabel="Stay on Page"
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          onClose();
        }}
      />

      {/* Single Confirmation Modal for Scheduling */}
      <ActionConfirmModal
        open={finalConfirmOpen}
        title="Schedule Delivery Order"
        subtitle={`Delivery Number: ${deliveryNumber} • Purchase Order: ${currentPO?.poNumber || "—"}`}
        description={`Are you sure you want to schedule delivery ${deliveryNumber} for Purchase Order ${currentPO?.poNumber || "—"} (${items.filter((item) => item.orderQuantity > 0).length} item(s))?`}
        confirmLabel="Confirm & Schedule"
        submitting={submitting}
        onCancel={() => setFinalConfirmOpen(false)}
        onConfirm={() => {
          setFinalConfirmOpen(false);
          void handleSubmit();
        }}
      />
    </>
  );

  if (variant === "page") {
    const containerClasses = embedded
      ? "space-y-5 pb-10 animate-page-in"
      : "page-container px-4 sm:px-8 w-full space-y-5 pb-10 animate-page-in";

    return (
      <>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFinalConfirmOpen(true);
          }}
          className={containerClasses}
        >
          {/* Top Breadcrumb & Page Header */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setConfirmCloseOpen(true)}
              className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{backLabel || (initialPo ? initialPo.poNumber : "Delivery shipments")}</span>
            </button>
            <h1 className="type-page-title text-ink">New delivery order</h1>
            <p className="type-body text-ink-muted">
              Select an eligible purchase order, specify shipment quantities, and attach proof of receipt.
            </p>
          </div>

          {/* 2-Column Layout matching Figma 123:21 */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
            <div className="min-w-0 space-y-4">{renderFormContent()}</div>
            {renderSummarySidebar()}
          </div>

          {/* Bottom Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-divider pt-4">
            <span className="type-caption text-ink-muted">{footerHelperText}</span>
            <div className="flex items-center gap-2.5 ml-auto shrink-0">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setConfirmCloseOpen(true)}
                className="h-9.5 rounded-control border border-border bg-surface px-4 type-label-button text-ink hover:bg-subtle transition-colors disabled:opacity-50 shadow-none cursor-pointer"
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={isSubmitDisabled}
                className="h-9.5 rounded-control bg-primary text-on-brand px-5 type-label-button hover:bg-primary-hover transition-colors disabled:opacity-45 shadow-none cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? "Scheduling..." : "Schedule order"}
              </Button>
            </div>
          </div>
        </form>

        {renderSharedModals()}
      </>
    );
  }

  // Backward-compatible Modal Wrapper
  return (
    <>
      <ModalWrapper
        open={open}
        title="Create delivery order"
        subtitle={
          selectedPoId
            ? "Review purchase order items, specify shipment quantities, and attach proof of receipt."
            : "Assign a delivery number and select an eligible purchase order to schedule."
        }
        onClose={onClose}
        maxWidthPx={selectedPoId ? 760 : 580}
        bodyClassName="min-h-0 w-full min-w-0 flex-1 flex flex-col overflow-hidden p-0"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFinalConfirmOpen(true);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-page px-6 py-5 space-y-4">
            {renderFormContent()}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-topbar bg-surface px-6 py-3.5">
            <span className="type-caption text-ink-muted">{footerHelperText}</span>
            <div className="flex items-center gap-2 shrink-0">
              <ModalCloseButton
                type="button"
                variant="outline"
                disabled={submitting}
                fallbackOnClose={onClose}
                className="h-9.5 rounded-control border border-border bg-surface px-3.5 type-label-button-sm text-ink hover:bg-subtle transition-colors disabled:opacity-50 cursor-pointer"
              >
                Close
              </ModalCloseButton>
              <Button
                type="submit"
                disabled={isSubmitDisabled}
                className="h-9.5 rounded-control bg-primary text-on-brand px-4 type-label-button-sm hover:bg-primary-hover transition-colors disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? "Scheduling..." : "Schedule order"}
              </Button>
            </div>
          </div>
        </form>
      </ModalWrapper>

      {renderSharedModals()}
    </>
  );
}

/**
 * Full-page Create Delivery Order view matching Figma Delivery · Full-Page Redesign (123:21).
 */
export function CreateDeliveryForm(props: CreateDeliveryModalProps) {
  return <CreateDeliveryBody {...props} open={props.open ?? true} variant="page" />;
}

/**
 * Backward-compatible modal wrapper for tests or standalone modal callers.
 */
export function CreateDeliveryModal(props: CreateDeliveryModalProps) {
  return <CreateDeliveryBody {...props} variant="modal" />;
}
