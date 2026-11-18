"use client";
import { Skeleton } from "@/components/ui/skeleton";

import { allPages } from "@/lib/orders/screen-data";
import { listOrders } from "@/app/actions/orders/orders";
import { listDeliveries } from "@/app/actions/orders/deliveries";
import { procurement } from "@/lib/orders/client";
import { uploadDeliveryAttachmentDirect } from "@/app/actions/orders/delivery-files";

import React, { useState, useEffect, useMemo } from "react";
import { AlertCircle, ArrowLeft, Calendar, Upload, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/shared/SearchInput";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ConfirmModal from "@/components/ConfirmModal";
import { getFutureDateError, getMaxFutureDateString, getTodayDateString } from "@/lib/date-limits";
import { PurchaseOrderPO, Delivery } from "../types";

interface CreateDeliveryModalProps {
  open: boolean;
  initialPo?: PurchaseOrderPO | null;
  onClose: () => void;
  onSuccess: () => void;
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

export function CreateDeliveryModal({
  open,
  initialPo,
  onClose,
  onSuccess,
}: CreateDeliveryModalProps) {
  const [deliveryNumber, setDeliveryNumber] = useState(`DLV-${new Date().getFullYear()}-0001`);
  const [orderedPOs, setOrderedPOs] = useState<PurchaseOrderPO[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(initialPo?.poId ?? null);
  const [pendingPoId, setPendingPoId] = useState<number | null>(null);
  const [confirmPoChange, setConfirmPoChange] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
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
          allPages(listDeliveries).then(items => ({ data: { success: true, data: { items } } })),
          allPages(listOrders, "eligibleForDelivery=true").then(items => ({ data: { success: true, data: { items } } })),
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
                  return (ordered - received - delivScheduled) > 0;
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
                  return (ordered - received - delivScheduled) > 0;
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
      } catch (err) {
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
      // Prompt confirmation to discard current PO details
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
        scheduledDate: plannedDispatchDate ? new Date(`${plannedDispatchDate}T12:00:00Z`).toISOString() : new Date().toISOString(),
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

  return (
    <>
      <ModalWrapper
        open={open}
        title="Create Delivery Order"
        onClose={onClose}
        size="max-w-[640px]"
      >
        <form onSubmit={(e) => { e.preventDefault(); setConfirmModal(true); }} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-card border border-status-red bg-status-red-bg text-status-red type-caption flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Top Form Fields Card: Clean responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-card bg-surface-muted border border-divider">
            {/* Delivery Number */}
            <div>
              <label className="mb-1.5 block type-label font-semibold text-text-primary">
                Delivery Number
              </label>
              <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-muted select-all">
                {deliveryNumber}
              </div>
            </div>

            {/* Purchase Order Selector */}
            <div>
              <label className={`mb-1.5 block type-label font-semibold ${fieldErrors.poId ? "text-status-red" : "text-text-primary"}`}>
                Purchase Order <span className="text-status-red">*</span>
              </label>
              {initialPo ? (
                <div className="flex items-center h-10 px-3.5 rounded-control border border-divider bg-surface type-body text-text-primary">
                  {initialPo.poNumber}
                </div>
              ) : (
                <>
                  <select
                    value={selectedPoId ?? ""}
                    onChange={(e) =>
                      handlePoSelectionChange(Number(e.target.value) || null)
                    }
                    disabled={loadingPOs}
                    className={`w-full h-10 rounded-control border ${
                      fieldErrors.poId ? "border-status-red focus:ring-status-red" : "border-divider"
                    } bg-surface px-3 py-2 type-body text-text-primary focus:outline-none focus:ring-1 focus:ring-primary`}
                  >
                    <option value="">Select Purchase Order...</option>
                    {orderedPOs.map((p) => (
                      <option key={p.poId} value={p.poId}>
                        {p.poNumber}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.poId && (
                    <p className="mt-1 type-caption font-medium text-status-red animate-in fade-in-50">
                      {fieldErrors.poId}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* If NO PO is selected, show instructional prompt */}
          {!selectedPoId ? (
            <div className="py-12 text-center type-body text-text-muted border border-dashed border-divider rounded-card bg-surface">
              Please select a Purchase Order above to view items and configure delivery order.
            </div>
          ) : (
            <>
              {/* PO Details Summary Card */}
              {currentPO && (
                <div className="rounded-card border border-divider bg-surface-muted p-3.5 type-caption grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-text-muted block type-caption">Supplier:</span>
                    <span className="font-semibold text-text-primary type-body">{currentPO.supplierName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block type-caption">Purchase Order Status / Date:</span>
                    <span className="font-medium text-text-primary type-body">
                      {currentPO.status} {currentPO.orderDate ? `• ${new Date(currentPO.orderDate).toLocaleDateString()}` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted block type-caption">Total Purchase Order Amount:</span>
                    <span className="font-semibold text-text-primary type-body">
                      {currentPO.totalAmount ? `₱${Number(currentPO.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                    </span>
                  </div>
                </div>
              )}

              {/* Table 1: PO Items Reference (Read-Only Reference) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block type-label font-semibold text-text-primary">
                    Purchase Order Items Reference
                  </label>
                  <span className="type-caption text-text-muted">Read-only Purchase Order reference</span>
                </div>

                {loadingItems ? (
                  <div className="py-6 text-center type-body text-text-muted rounded-card border border-divider bg-surface">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-6 text-center type-body text-text-muted rounded-card border border-divider bg-surface">
                    No items found for this purchase order.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-card border border-divider">
                    <table className="w-full type-table-cell text-left">
                      <thead>
                        <tr className="border-b border-divider bg-surface-muted text-text-muted font-semibold type-table-header table-head-row">
                          <th className="table-th px-3 py-2.5 w-10 text-center">#</th>
                          <th className="table-th px-3 py-2.5">Supply</th>
                          <th className="table-th px-3 py-2.5">Supply No</th>
                          <th className="table-th px-3 py-2.5">Unit of Measure</th>
                          <th className="table-th px-3 py-2.5 text-right">Purchase Order Quantity</th>
                          <th className="table-th px-3 py-2.5 text-right">Previously Received</th>
                          <th className="table-th px-3 py-2.5 text-right">Already Scheduled</th>
                          <th className="table-th px-3 py-2.5 text-right font-semibold text-text-primary">Available to Schedule</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-divider">
                        {items.map((item, idx) => (
                          <tr key={`ref-${item.poItemId || idx}`} className="hover:bg-surface-hover table-row">
                            <td className="table-td px-3 py-2.5 text-center text-text-muted">{idx + 1}</td>
                            <td className="table-td px-3 py-2.5 font-medium text-text-primary">{item.itemName}</td>
                            <td className="table-td px-3 py-2.5 type-caption font-semibold text-text-muted">
                              {item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`}
                            </td>
                            <td className="table-td px-3 py-2.5 text-text-muted">{item.purchaseUomName}</td>
                            <td className="table-td px-3 py-2.5 text-right text-text-muted">{item.poOrderedQuantity}</td>
                            <td className="table-td px-3 py-2.5 text-right text-text-muted">{item.poTotalReceivedQuantity}</td>
                            <td className="table-td px-3 py-2.5 text-right text-text-muted">{item.alreadyScheduledQuantity}</td>
                            <td className="table-td px-3 py-2.5 text-right font-semibold text-text-primary">
                              {item.availableToSchedule}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Table 2: Actual Order Quantity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block type-label font-semibold text-text-primary">
                      Order Quantities <span className="text-status-red">*</span>
                    </label>
                    <span className="type-caption text-text-muted">
                      Specify quantity being ordered for this shipment
                    </span>
                  </div>
                  <SearchInput
                    containerClassName="w-60 flex-none h-9"
                    placeholder="Search items..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="type-body"
                  />
                </div>

                {items.length > 0 && (
                  <div className="overflow-x-auto rounded-card border border-divider">
                    <table className="w-full type-table-cell text-left">
                      <thead>
                        <tr className="border-b border-divider bg-surface-muted text-text-muted font-semibold type-table-header table-head-row">
                          <th className="table-th px-3.5 py-2.5">Ingredient / Supply</th>
                          <th className="table-th px-3.5 py-2.5">Supply No</th>
                          <th className="table-th px-3.5 py-2.5">Unit of Measure</th>
                          <th className="table-th px-3.5 py-2.5 text-right">Purchase Order Quantity</th>
                          <th className="table-th px-3.5 py-2.5 text-right font-medium">Left to Order</th>
                          <th className="table-th px-3.5 py-2.5 text-right w-44 font-semibold text-text-primary">Quantity to Order</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-divider">
                        {items
                          .filter((item) =>
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
                              className={`hover:bg-surface-hover transition-colors table-row ${
                                isExhausted ? "opacity-50 bg-surface-muted/20" : ""
                              }`}
                            >
                              <td className="table-td px-3.5 py-2.5 font-medium text-text-primary">
                                {item.itemName}
                              </td>
                              <td className="table-td px-3.5 py-2.5 type-caption font-semibold text-text-muted">
                                {item.itemCode || `SPL-${String(item.itemId || 0).padStart(4, "0")}`}
                              </td>
                              <td className="table-td px-3.5 py-2.5 text-text-muted">
                                {item.purchaseUomName}
                              </td>
                              <td className="table-td px-3.5 py-2.5 text-right text-text-muted">
                                {item.poOrderedQuantity}
                              </td>
                              <td className="table-td px-3.5 py-2.5 text-right font-medium text-text-primary">
                                {item.availableToSchedule}
                              </td>
                              <td className="table-td px-3.5 py-2.5 text-right">
                                {isExhausted ? (
                                  <span className="type-caption text-text-muted italic">
                                    Fully Scheduled
                                  </span>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Input
                                        type="number"
                                        min="0.01"
                                        max={item.availableToSchedule}
                                        step="any"
                                        value={item.orderQuantity === 0 ? "" : item.orderQuantity}
                                        onChange={(e) =>
                                          handleQuantityChange(item.poItemId, e.target.value)
                                        }
                                        className={`w-28 text-right type-body rounded-control h-8 px-2 bg-surface text-text-primary ${
                                          err
                                            ? "border-status-red focus-visible:ring-status-red"
                                            : "border-divider"
                                        }`}
                                      />
                                      <span className="type-caption text-text-muted w-8 text-left truncate">
                                        {item.purchaseUomName}
                                      </span>
                                    </div>
                                    {err && (
                                      <p className="type-caption text-status-red text-right font-medium animate-in fade-in-50">
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
              </div>

              {/* Payment Type & Planned Dispatch Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-card bg-surface-muted border border-divider">
                <div>
                  <label className="mb-1.5 block type-label font-semibold text-text-primary">
                    Payment Type <span className="text-status-red">*</span>
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="w-full h-10 rounded-control border border-divider bg-surface px-3 py-2 type-body text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Payable">Payable</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block type-label font-semibold text-text-primary">
                    Planned Dispatch Date <span className="text-status-red">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="date"
                      min={getTodayDateString()}
                      max={getMaxFutureDateString()}
                      value={plannedDispatchDate}
                      onChange={(e) => setPlannedDispatchDate(e.target.value)}
                      className="w-full h-10 rounded-control border border-divider bg-surface px-3.5 py-2 pr-10 type-body text-text-primary cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Row 4: Proof of Receipt / Attachment (Required + Photo Preview) */}
              <div>
                <label className="mb-1.5 block type-label font-semibold text-text-primary flex items-center justify-between">
                  <span>
                    Proof of Receipt / Attachment <span className="text-status-red">*</span>
                  </span>
                  {!attachmentFile && (
                    <span className="type-caption text-status-red font-normal">
                      Required to schedule delivery
                    </span>
                  )}
                </label>
                <div className="rounded-card border border-dashed border-divider bg-surface p-4 transition-colors">
                  {attachmentFile ? (
                    <div className="space-y-3">
                      <div className="relative flex flex-col items-center justify-center p-3 bg-surface-muted rounded-control border border-divider">
                        {attachmentPreviewUrl ? (
                          <img
                            src={attachmentPreviewUrl}
                            alt="Proof of receipt"
                            className="max-h-56 rounded-control object-contain border border-divider shadow-xs"
                          />
                        ) : (
                          <div className="flex items-center gap-2.5 p-4 type-body font-medium text-text-primary">
                            <FileText className="w-8 h-8 text-text-muted shrink-0" />
                            <span className="truncate">{attachmentFileName || "Uploaded document"}</span>
                          </div>
                        )}
                        <p className="mt-2 type-caption text-text-muted truncate max-w-xs text-center">
                          {attachmentFileName}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <label className="cursor-pointer type-caption font-semibold px-3 py-1.5 rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary transition-colors flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          Change File
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
                            if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
                            setAttachmentPreviewUrl("");
                          }}
                          className="type-caption font-semibold px-3 py-1.5 rounded-control border border-status-red text-status-red hover:bg-status-red-bg transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer py-4 hover:bg-surface-hover rounded-control transition-colors">
                      <Upload className="w-6 h-6 text-text-muted mb-2" />
                      <span className="type-body font-medium text-text-primary">
                        Click to upload receipt or proof photo <span className="text-status-red">*</span>
                      </span>
                      <span className="type-caption text-text-muted mt-0.5">
                        JPG, PNG, PDF up to 8MB
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-5 pb-3 border-t border-divider mt-6 mb-2">
            <ModalCloseButton
              type="button"
              variant="outline"
              disabled={submitting}
              fallbackOnClose={onClose}
              className="rounded-control border border-divider bg-surface px-5 py-2.5 h-auto type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              Close
            </ModalCloseButton>
            <Button
              type="submit"
              disabled={submitting || !selectedPoId || hasErrors || !hasAnyOrderQty || !attachmentFile || !plannedDispatchDate}
              className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 h-auto type-label-button font-semibold hover:bg-button-primary-hover transition-colors shadow-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? "Scheduling..." : "Schedule Order"}
            </Button>
          </div>
        </form>
      </ModalWrapper>

      {/* Discard Confirmation when changing selected PO */}
      {confirmPoChange && (
        <ConfirmModal
          message="Changing the Purchase Order will discard any entered delivery quantities and dates for the current Purchase Order. Do you wish to continue?"
          onConfirm={applyPoChange}
          onCancel={cancelPoChange}
        />
      )}

      {/* Review Modal for Submission using Radix Dialog */}
      <Dialog open={confirmModal} onOpenChange={(open) => { if (!open) setConfirmModal(false); }} confirmOnClose={false}>
        <DialogContent className="sm:max-w-[640px] bg-surface border-divider p-6 shadow-modal rounded-card">
          <DialogHeader>
            <DialogTitle className="type-card-title font-semibold text-text-primary">Review Delivery Schedule</DialogTitle>
            <DialogDescription className="type-body text-text-muted">
              Please review the details below before scheduling this delivery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 type-body text-text-primary mt-4">
            <div className="grid grid-cols-2 gap-4 bg-surface-muted p-4 rounded-control border border-divider">
              <div>
                <span className="text-text-muted block type-caption mb-1">Delivery No</span>
                <span className="font-semibold type-body text-text-primary">{deliveryNumber}</span>
              </div>
              <div>
                <span className="text-text-muted block type-caption mb-1">Purchase Order</span>
                <span className="font-semibold type-body text-text-primary">{currentPO?.poNumber || "—"}</span>
              </div>
              <div>
                <span className="text-text-muted block type-caption mb-1">Supplier</span>
                <span className="font-semibold type-body text-text-primary">{currentPO?.supplierName || "—"}</span>
              </div>
              <div>
                <span className="text-text-muted block type-caption mb-1">Payment Type</span>
                <span className="font-semibold type-body text-text-primary">{paymentType || "—"}</span>
              </div>
              <div>
                <span className="text-text-muted block type-caption mb-1">Planned Dispatch Date</span>
                <span className="font-semibold type-body text-text-primary">{plannedDispatchDate || "—"}</span>
              </div>
            </div>

            <div className="mt-4 border border-divider rounded-control overflow-hidden bg-surface">
              <table className="w-full type-table-cell">
                <thead className="bg-surface-muted border-b border-divider table-head-row">
                  <tr>
                    <th className="table-th px-3 py-2.5 text-left font-semibold text-text-muted type-table-header">ITEM NAME</th>
                    <th className="table-th px-3 py-2.5 text-left font-semibold text-text-muted type-table-header">SUPPLY NO</th>
                    <th className="table-th px-3 py-2.5 text-left font-semibold text-text-muted type-table-header">Unit of Measure</th>
                    <th className="table-th px-3 py-2.5 text-right font-semibold text-text-muted type-table-header">DELIVERY QTY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {items.filter(item => item.orderQuantity > 0).map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-hover table-row">
                      <td className="table-td px-3 py-2.5 font-medium text-text-primary">{item.itemName}</td>
                      <td className="table-td px-3 py-2.5 text-text-muted">{item.itemCode}</td>
                      <td className="table-td px-3 py-2.5 text-text-muted">{item.purchaseUomName || "Unit"}</td>
                      <td className="table-td px-3 py-2.5 text-right font-semibold text-text-primary">{item.orderQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-divider">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmModal(false)}
              disabled={submitting}
              className="rounded-control px-5 py-2.5 h-auto type-label-button font-semibold cursor-pointer border-divider bg-surface text-text-primary hover:bg-surface-hover"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Edit
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => setFinalConfirmOpen(true)}
              className="rounded-control px-6 py-2.5 h-auto type-label-button font-semibold shadow-sm bg-button-primary text-text-inverse hover:bg-button-primary-hover cursor-pointer"
            >
              {submitting ? "Scheduling..." : "Confirm & Schedule Delivery"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ActionConfirmModal
        open={finalConfirmOpen}
        title="Schedule Delivery Order"
        subtitle={`Delivery No: ${deliveryNumber} • PO: ${currentPO?.poNumber || "—"}`}
        description={`Are you sure you want to schedule delivery ${deliveryNumber} for Purchase Order ${currentPO?.poNumber || "—"} (${items.filter((item) => item.orderQuantity > 0).length} item(s))?`}
        confirmLabel="Confirm & Schedule"
        submitting={submitting}
        onCancel={() => setFinalConfirmOpen(false)}
        onConfirm={() => {
          setFinalConfirmOpen(false);
          setConfirmModal(false);
          void handleSubmit();
        }}
      />
    </>
  );
}
