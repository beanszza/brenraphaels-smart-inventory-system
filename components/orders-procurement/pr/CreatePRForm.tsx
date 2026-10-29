"use client";

import { listRequisitions, createRequisition, updateRequisition } from "@/app/actions/orders/requisitions";

import { requisitionSupplies } from "@/app/actions/orders/screens";
import { actionResponse } from "@/lib/resources/action-response";


import { StatusBadge } from "@/components/shared/StatusBadge";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PurchaseRequisition, PRItem } from "../types";
import { useStaff } from "@/context/StaffContext";
import ConfirmModal from "@/components/ConfirmModal";

export const PR_PURPOSE_CHOICES = [
  "Stock Replenishment",
  "Safety Stock Buffer",
  "Upcoming Production Schedule",
  "Emergency Restock",
  "Seasonal Demand Preparation",
  "Trial / New Product",
  "Supplier Minimum Order Fulfilment",
  "Damaged / Expired Goods Replacement",
  "Other",
] as const;

export interface CreatePRModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSupplies?: SupplyOption[];
  initialData?: PurchaseRequisition;
  isEdit?: boolean;
}

export interface SupplyOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  uomName: string;
  currentStock: number;
  purchaseUomId: number;
}

export function CreatePRModal({
  open,
  onClose,
  onSuccess,
  initialSupplies,
  initialData,
  isEdit = false,
}: CreatePRModalProps) {
  const router = useRouter();
  const staff = useStaff();

  // Supplies list
  const [suppliesList, setSuppliesList] = useState<SupplyOption[]>(initialSupplies ?? []);
  const [loadingSupplies, setLoadingSupplies] = useState(!initialSupplies);

  // De-duplicated supplies
  const uniqueSupplies = useMemo(() => {
    const seen = new Set<number>();
    return suppliesList.filter((s) => {
      if (seen.has(s.itemId)) return false;
      seen.add(s.itemId);
      return true;
    });
  }, [suppliesList]);

  // Form State
  const [prNumber, setPrNumber] = useState(initialData?.prNumber || "Assigned on save");
  const [requestDate, setRequestDate] = useState(
    initialData?.requestDate
      ? new Date(initialData.requestDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
  );
  const defaultAccountName = staff.name;
  const detectedDepartment = "Inventory";

  const [requestedBy, setRequestedBy] = useState(
    initialData?.requestedBy && initialData.requestedBy !== "Unauthenticated"
      ? initialData.requestedBy
      : ""
  );

  const [department, setDepartment] = useState(initialData?.department || "");
  const [purpose, setPurpose] = useState(initialData?.purpose || initialData?.requestType || PR_PURPOSE_CHOICES[0]);
  const [priority, setPriority] = useState(initialData?.priority || "Low");
  const [requiredDate, setRequiredDate] = useState(
    initialData?.requiredDate
      ? new Date(initialData.requiredDate).toISOString().split("T")[0]
      : ""
  );
  const [statusText, setStatusText] = useState(initialData?.status || "Draft");

  // Items table (starts completely empty when creating new)
  const [items, setItems] = useState<PRItem[]>(
    initialData?.items?.map((it) => ({
      ...it,
      requestedQuantity: it.requestedQuantity || 1,
    })) || []
  );

  // Notes
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [itemSearch, setItemSearch] = useState("");

  // Validation & Modal State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewAction, setReviewAction] = useState<"draft" | "submit">("submit");
  const [submitting, setSubmitting] = useState(false);

  // Reset or populate on open
  useEffect(() => {
    if (open) {
      if (initialData) {
        if (initialData.prNumber) setPrNumber(initialData.prNumber);
        if (initialData.requestDate) {
          setRequestDate(
            new Date(initialData.requestDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          );
        }
        setRequestedBy(
          initialData.requestedBy && initialData.requestedBy !== "Unauthenticated"
            ? initialData.requestedBy
            : defaultAccountName || ""
        );
        setDepartment(initialData.department || "");
        setPurpose(initialData.purpose || initialData.requestType || PR_PURPOSE_CHOICES[0]);
        setPriority(initialData.priority || "Low");
        setRequiredDate(
          initialData.requiredDate
            ? new Date(initialData.requiredDate).toISOString().split("T")[0]
            : ""
        );
        setStatusText(initialData.status || "Draft");
        setNotes(initialData.notes || "");
        setItems(
          initialData.items?.map((it) => ({
            ...it,
            requestedQuantity: it.requestedQuantity || 1,
          })) || []
        );
        setErrors({});
      } else {
        // Default purpose and priority to match the first dropdown options
        setRequestDate(
          new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        );
        setRequestedBy(defaultAccountName || "Inventory Manager");
        setDepartment(detectedDepartment);
        setPurpose(PR_PURPOSE_CHOICES[0]);
        setPriority("Low");
        setRequiredDate("");
        setStatusText("Draft");
        setNotes("");
        setItems([]);
        setErrors({});
      }
    }
  }, [open, initialData, defaultAccountName, detectedDepartment]);

  // Fetch supplies and next PR number
  useEffect(() => {
    if (!open || initialSupplies) return;

    const fetchSuppliesAndNumber = async () => {
      try {
        setLoadingSupplies(true);
        const [itemsRes, prRes] = await Promise.all([
          actionResponse(requisitionSupplies()), actionResponse(listRequisitions()),
        ]);
        setSuppliesList(itemsRes.data.data);

        // Preview PR number if creating new
        if (!initialData?.prNumber) {
          if (prRes.data?.success) {
            const list: any[] = prRes.data.data || [];
            const year = new Date().getFullYear();
            let maxSeq = 0;
            list.forEach((pr) => {
              if (pr.prNumber) {
                const match = pr.prNumber.match(/PR-\d{4}-(\d+)/);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxSeq) maxSeq = num;
                }
              }
            });
            const nextSeq = String(maxSeq + 1).padStart(4, "0");
            setPrNumber(`PR-${year}-${nextSeq}`);
          }
        }
      } catch (err) {
        setErrors(prev => ({ ...prev, submit: "Supplies could not be loaded. Close and reopen the form to retry." }));
      } finally {
        setLoadingSupplies(false);
      }
    };

    fetchSuppliesAndNumber();
  }, [open, initialData, initialSupplies]);

  // Add Item (prevents duplicates)
  const handleAddItem = () => {
    if (uniqueSupplies.length === 0) return;
    const unused = uniqueSupplies.find((s) => !items.some((it) => it.itemId === s.itemId));
    if (!unused) return; // All supplies already added
    setItems((prev) => [
      ...prev,
      {
        prItemId: 0,
        purchaseUomId: unused.purchaseUomId,
        itemId: unused.itemId,
        itemCode: unused.itemCode,
        itemName: unused.itemName,
        uomName: unused.uomName,
        actualInventory: unused.currentStock,
        requestedQuantity: 1,
      },
    ]);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.items;
      return copy;
    });
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Select Item in Dropdown
  const handleSelectSupply = (index: number, itemId: number) => {
    const sup = uniqueSupplies.find((s) => s.itemId === itemId);
    if (!sup) return;
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        purchaseUomId: sup.purchaseUomId,
        itemId: sup.itemId,
        itemCode: sup.itemCode,
        itemName: sup.itemName,
        uomName: sup.uomName,
        actualInventory: sup.currentStock,
      };
      return copy;
    });
  };

  // Change Quantity - enforce positive (>0)
  const handleQuantityChange = (index: number, val: string) => {
    const cleanVal = val.replace(/[-+e]/gi, "");
    const num = parseFloat(cleanVal);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        requestedQuantity: isNaN(num) ? 0 : Math.max(0, num),
      };
      return copy;
    });
  };

  // Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!requestedBy.trim()) newErrors.requestedBy = "Requester name is required.";
    if (!department.trim()) newErrors.department = "Department is required.";
    if (!purpose.trim()) newErrors.purpose = "Purpose is required.";
    if (!priority.trim()) newErrors.priority = "Priority is required.";
    if (!requiredDate) {
      newErrors.requiredDate = "Required date is required.";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sel = new Date(requiredDate);
      if (sel <= today) {
        newErrors.requiredDate = "Required date must be a future date.";
      }
    }

    if (items.length === 0) {
      newErrors.items = "At least one item must be requested.";
    } else {
      const duplicateIds = new Set<number>();
      const seenIds = new Set<number>();
      items.forEach((item) => {
        if (seenIds.has(item.itemId)) duplicateIds.add(item.itemId);
        seenIds.add(item.itemId);
      });
      if (duplicateIds.size > 0) {
        newErrors.items = "Duplicate items must be consolidated before saving.";
      }
      items.forEach((it, idx) => {
        if (!it.requestedQuantity || it.requestedQuantity <= 0) {
          newErrors[`item_qty_${idx}`] = "Quantity must be greater than 0.";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = useMemo(() => {
    if (!requestedBy.trim() || !department.trim() || !purpose.trim() || !priority.trim() || !requiredDate) {
      return false;
    }
    if (items.length === 0) return false;
    return items.every((it) => it.itemId > 0 && it.requestedQuantity > 0);
  }, [requestedBy, department, purpose, priority, requiredDate, items]);

  // Execution
  const executeSave = async (submitForApproval: boolean) => {
    try {
      setSubmitting(true);
      setErrors((prev) => {
        const c = { ...prev };
        delete c.submit;
        return c;
      });
      const payload = {
        department: department.trim(),
        requestedBy: requestedBy.trim(),
        requestType: purpose.trim(),
        priority: priority.trim(),
        requiredDate: new Date(requiredDate).toISOString(),
        purpose: purpose.trim(),
        notes: notes.trim() || null,
        submitForApproval,
        items: items.map((it) => ({
          itemId: it.itemId,
          requestedQuantity: it.requestedQuantity,
          purchaseUomId: it.purchaseUomId || 1, // Fallback if missing
          estimatedUnitPrice: it.estimatedUnitPrice || 0,
          suggestedSupplierId: (it as any).suggestedSupplierId || null,
        })),
      };

      if (isEdit && initialData?.prId) {
        await actionResponse(updateRequisition(initialData.prId, payload));
      } else {
        await actionResponse(createRequisition(payload));
      }

      router.refresh();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/orders-procurement");
      }
    } catch (err: any) {
      console.error("Failed to save PR:", err);
      setErrors((prev) => ({
        ...prev,
        submit: err?.response?.data?.message || "An error occurred while saving the requisition.",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ModalWrapper
        open={open}
        title={isReviewing ? "Review Purchase Requisition" : (isEdit ? "Edit Purchase Requisition" : "Create Purchase Requisition")}
        onClose={() => {
          setIsReviewing(false);
          onClose();
        }}
        size={isReviewing ? "max-w-3xl" : "max-w-5xl"}
      >
        {isReviewing ? (
          /* Review Step */
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
              Please review the details below before {reviewAction === "submit" ? "submitting for approval" : "saving as draft"}.
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 p-4 rounded-xl bg-muted/20 border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Department</span>
                <span className="font-semibold text-foreground">{department}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Requested By</span>
                <span className="font-semibold text-foreground">{requestedBy}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Purpose</span>
                <span className="font-semibold text-foreground">{purpose}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Priority</span>
                <span className="font-semibold text-foreground">{priority}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Required Date</span>
                <span className="font-semibold text-foreground">{requiredDate}</span>
              </div>
            </div>

            {notes && (
              <div className="p-4 rounded-xl bg-muted/20 border border-border text-xs">
                <span className="text-muted-foreground block text-[11px] mb-1">Notes</span>
                <span className="font-medium text-foreground leading-relaxed">{notes}</span>
              </div>
            )}

            <div className="border border-border rounded-xl overflow-x-auto bg-card">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold">ITEM NAME</th>
                    <th className="px-4 py-2.5 text-left font-bold">Unit of Measure</th>
                    <th className="px-4 py-2.5 text-right font-bold">QUANTITY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => {
                    const sup = uniqueSupplies.find((s) => s.itemId === item.itemId);
                    return (
                      <tr key={idx} className="hover:bg-muted/10">
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {item.itemName || sup?.itemName}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {item.uomName || sup?.uomName || "Unit"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">
                          {item.requestedQuantity}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Review Footer Buttons */}
            <div className="flex justify-end gap-3 pt-5 border-t border-border mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReviewing(false)}
                disabled={submitting}
                className="rounded-xl px-6 font-semibold cursor-pointer border-border bg-card hover:bg-muted text-foreground"
              >
                Back to Edit
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  await executeSave(reviewAction === "submit");
                }}
                className="rounded-xl px-6 font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/85 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Submitting..." : `Confirm & ${reviewAction === "submit" ? "Submit" : "Save"}`}
              </Button>
            </div>
          </div>
        ) : (
          /* Main Form Step */
          <div className="space-y-4">
            {errors.submit && (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between animate-in fade-in-50">
                <span role="alert" className="font-medium">{errors.submit}</span>
                <button
                  type="button"
                  onClick={() =>
                    setErrors((prev) => {
                      const c = { ...prev };
                      delete c.submit;
                      return c;
                    })
                  }
                  className="font-bold underline ml-2 shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
            {/* Top Form Fields: Clean, modern 3-column responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border">
              {/* PR Number */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Purchase Requisition Number
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 font-mono text-xs text-muted-foreground select-all">
                  {prNumber || "PR-XXXX-XXXX"}
                </div>
              </div>

              {/* Request Date */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Request Date
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                  {requestDate}
                </div>
              </div>

              {/* Required Date */}
              <div>
                <label className={`mb-1.5 block text-xs font-semibold ${errors.requiredDate ? "text-destructive" : "text-foreground"}`}>
                  Required Date <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={requiredDate}
                    onChange={(e) => {
                      setRequiredDate(e.target.value);
                      setErrors((prev) => {
                        const c = { ...prev };
                        delete c.requiredDate;
                        return c;
                      });
                    }}
                    className={`w-full h-10 rounded-xl border ${
                      errors.requiredDate ? "!border-destructive focus-visible:!ring-destructive" : "border-border"
                    } bg-card px-3.5 py-2 pr-10 text-xs text-foreground transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                  />
                  <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.requiredDate && (
                  <p className="mt-1 text-[11px] font-medium text-destructive animate-in fade-in-50">{errors.requiredDate}</p>
                )}
              </div>

              {/* Requested By (Read-Only from Account) */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Requested By
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground select-none">
                  {requestedBy || "Loading..."}
                </div>
              </div>

              {/* Department (Read-Only from Account) */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Department
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground select-none">
                  {department || "Inventory"}
                </div>
              </div>

              {/* Purpose (Dropdown Selection) */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Purpose <span className="text-destructive">*</span>
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3.5 py-2 text-xs text-foreground transition-colors cursor-pointer focus:ring-1 focus:ring-ring"
                >
                  {PR_PURPOSE_CHOICES.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Priority <span className="text-destructive">*</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3.5 py-2 text-xs text-foreground transition-colors cursor-pointer focus:ring-1 focus:ring-ring"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Requested Supplies & Ingredients Section */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Requested Items <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {items.length} item(s) selected
                </span>
              </div>

              {errors.items && (
                <p className="text-xs text-destructive">{errors.items}</p>
              )}

              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-muted/40 uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">SUPPLY NAME</th>
                      <th className="px-3 py-2.5 text-left font-semibold">SUPPLY NO.</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Unit of Measure</th>
                      <th className="px-3 py-2.5 text-right font-semibold">ACTUAL INVENTORY</th>
                      <th className="px-3 py-2.5 text-right font-semibold">QUANTITY (TO ORDER)</th>
                      <th className="px-3 py-2.5 text-center font-semibold w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                          No items added yet. Click &quot;+ Add Item&quot; below to add raw materials or ingredients.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const selectedSupply = uniqueSupplies.find((s) => s.itemId === item.itemId);
                        const supplyNo = item.itemCode || selectedSupply?.itemCode || (item.itemId ? `SPL-${item.itemId}` : "—");
                        const actualInv = selectedSupply ? selectedSupply.currentStock : (item.actualInventory || 0);

                        return (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            {/* Supply Name (Dropdown) */}
                            <td className="px-3 py-2 min-w-[200px]">
                              <select
                                value={item.itemId || ""}
                                onChange={(e) => handleSelectSupply(idx, Number(e.target.value))}
                                className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-ring"
                              >
                                {uniqueSupplies.map((sup) => {
                                  const isAlreadySelected = items.some((other, otherIdx) => otherIdx !== idx && other.itemId === sup.itemId);
                                  return (
                                    <option
                                      key={sup.itemId}
                                      value={sup.itemId}
                                      disabled={isAlreadySelected}
                                    >
                                      {sup.itemName} {isAlreadySelected ? "(already added)" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>

                            {/* Supply No. */}
                            <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                              {supplyNo}
                            </td>

                            {/* Unit of Measure */}
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {item.uomName || selectedSupply?.uomName || "Unit"}
                            </td>

                            {/* Actual Inventory */}
                            <td className="px-3 py-2 text-right font-mono text-muted-foreground whitespace-nowrap">
                              {Number(actualInv).toLocaleString()}
                            </td>

                            {/* Quantity (To Order) */}
                            <td className="px-3 py-2 text-right w-36">
                              <Input
                                type="number"
                                min={1}
                                step="any"
                                value={item.requestedQuantity || ""}
                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                className="h-8 w-28 text-right font-mono text-xs font-bold border-border bg-card ml-auto"
                              />
                            </td>

                            {/* Remove Row */}
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                                title="Remove"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                disabled={loadingSupplies || uniqueSupplies.length === 0 || items.length >= uniqueSupplies.length}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-foreground bg-card border border-border rounded-xl hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            {/* Bottom Section: Notes (Optional) on bottom left */}
            <div className="flex flex-col sm:flex-row justify-start pt-3 border-t border-border">
              <div className="w-full sm:w-1/2 lg:w-5/12 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground">{notes.length}/300</span>
                </div>
                <Textarea
                  rows={3}
                  maxLength={300}
                  placeholder="Enter additional notes (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-ring resize-none"
                >
                </Textarea>
              </div>
            </div>

            {/* Modal Footer: Matching Resources & Suppliers Modals */}
            <div className="flex flex-wrap justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting || !isFormValid}
                onClick={() => {
                  if (validateForm()) {
                    setReviewAction("draft");
                    setIsReviewing(true);
                  }
                }}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                disabled={submitting || !isFormValid}
                onClick={() => {
                  if (validateForm()) {
                    setReviewAction("submit");
                    setIsReviewing(true);
                  }
                }}
                className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                Submit for Approval
              </Button>
            </div>
          </div>
        )}
      </ModalWrapper>
    </>
  );
}

export interface CreatePRFormProps {
  initialSupplies?: SupplyOption[];
  initialData?: PurchaseRequisition;
  isEdit?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export function CreatePRForm({
  initialSupplies,
  initialData,
  isEdit = false,
  onClose,
  onSuccess,
}: CreatePRFormProps) {
  const router = useRouter();

  const handleClose = () => {
    if (onClose) onClose();
    else router.push("/orders-procurement");
  };

  const handleSuccess = () => {
    if (onSuccess) onSuccess();
    else router.push("/orders-procurement");
  };

  return (
    <CreatePRModal
      open={true}
      onClose={handleClose}
      onSuccess={handleSuccess}
      initialSupplies={initialSupplies}
      initialData={initialData}
      isEdit={isEdit}
    />
  );
}
