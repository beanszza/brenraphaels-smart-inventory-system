"use client";

import { listRequisitions, createRequisition, updateRequisition } from "@/app/actions/orders/requisitions";
import { requisitionSupplies } from "@/app/actions/orders/screens";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, Plus, Trash2, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PurchaseRequisition, PRItem } from "../types";
import { useStaff } from "@/context/StaffContext";
import { normalizePrPriority } from "@/lib/orders/requisition-lifecycle";
import { getFutureDateError, getMaxFutureDateString, getTodayDateString } from "@/lib/date-limits";

const PURPOSE_OTHER_MAX = 50;

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

export interface SupplyOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  uomName: string;
  currentStock: number;
  purchaseUomId: number;
}

export interface CreatePRFormProps {
  initialSupplies?: SupplyOption[];
  initialData?: PurchaseRequisition;
  isEdit?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  /** When true, omits outer page-container padding (e.g. when embedded inside ViewOrdersProcurement). */
  embedded?: boolean;
}

export interface CreatePRModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSupplies?: SupplyOption[];
  initialData?: PurchaseRequisition;
  isEdit?: boolean;
}

function formatSummaryDate(raw?: string | null): string {
  if (!raw) return "Not set";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function createEmptyItemRow(): PRItem {
  return {
    prItemId: 0,
    purchaseUomId: 0,
    itemId: 0,
    itemCode: "",
    itemName: "",
    uomName: "",
    actualInventory: 0,
    requestedQuantity: 1,
  };
}

function resolveInitialPurpose(raw?: string | null) {
  const val = (raw ?? "").trim();
  if (!val) return { choice: PR_PURPOSE_CHOICES[0] as string, custom: "" };
  if ((PR_PURPOSE_CHOICES as readonly string[]).includes(val) && val !== "Other") {
    return { choice: val, custom: "" };
  }
  return { choice: "Other", custom: val === "Other" ? "" : val.slice(0, PURPOSE_OTHER_MAX) };
}

interface PRFormBodyProps {
  active: boolean;
  initialSupplies?: SupplyOption[];
  initialData?: PurchaseRequisition;
  isEdit?: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
  variant: "page" | "modal";
  embedded?: boolean;
}

function PRFormBody({
  active,
  initialSupplies,
  initialData,
  isEdit = false,
  onCancel,
  onSuccess,
  variant,
  embedded = false,
}: PRFormBodyProps) {
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
      : defaultAccountName || "Inventory Manager"
  );

  const initialPurpose = resolveInitialPurpose(initialData?.purpose || initialData?.requestType);
  const [department, setDepartment] = useState(initialData?.department || detectedDepartment);
  const [purposeChoice, setPurposeChoice] = useState<string>(initialPurpose.choice);
  const [customPurpose, setCustomPurpose] = useState<string>(initialPurpose.custom);
  const [customPurposeWarning, setCustomPurposeWarning] = useState("");
  const [priority, setPriority] = useState(
    initialData?.priority ? normalizePrPriority(initialData.priority) : "Low"
  );
  const [requiredDate, setRequiredDate] = useState(
    initialData?.requiredDate
      ? new Date(initialData.requiredDate).toISOString().split("T")[0]
      : ""
  );
  const [statusText, setStatusText] = useState(initialData?.status || "Draft");

  // Items rows (starts with 1 clean row ready to select, matching Figma & RecipeFormPage)
  const [items, setItems] = useState<PRItem[]>(() =>
    initialData?.items && initialData.items.length > 0
      ? initialData.items.map((it) => ({
          ...it,
          requestedQuantity: it.requestedQuantity || 1,
        }))
      : [createEmptyItemRow()]
  );

  // Notes
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Validation & Confirmation State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<"draft" | "submit">("submit");
  const [submitting, setSubmitting] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // Reset or populate when active / initialData changes
  useEffect(() => {
    if (!active) return;
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          : defaultAccountName || "Inventory Manager"
      );
      setDepartment(initialData.department || detectedDepartment);
      const nextPurpose = resolveInitialPurpose(initialData.purpose || initialData.requestType);
      setPurposeChoice(nextPurpose.choice);
      setCustomPurpose(nextPurpose.custom);
      setCustomPurposeWarning("");
      setPriority(initialData.priority ? normalizePrPriority(initialData.priority) : "Low");
      setRequiredDate(
        initialData.requiredDate
          ? new Date(initialData.requiredDate).toISOString().split("T")[0]
          : ""
      );
      setStatusText(initialData.status || "Draft");
      setNotes(initialData.notes || "");
      setItems(
        initialData.items && initialData.items.length > 0
          ? initialData.items.map((it) => ({
              ...it,
              requestedQuantity: it.requestedQuantity || 1,
            }))
          : [createEmptyItemRow()]
      );
      setErrors({});
    } else {
      setRequestDate(
        new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
      setRequestedBy(defaultAccountName || "Inventory Manager");
      setDepartment(detectedDepartment);
      setPurposeChoice(PR_PURPOSE_CHOICES[0]);
      setCustomPurpose("");
      setCustomPurposeWarning("");
      setPriority("Low");
      setRequiredDate("");
      setStatusText("Draft");
      setNotes("");
      setItems([createEmptyItemRow()]);
      setErrors({});
    }
  }, [active, initialData, defaultAccountName, detectedDepartment]);

  // Fetch supplies and next PR number preview
  useEffect(() => {
    if (!active || initialSupplies) return;

    const fetchSuppliesAndNumber = async () => {
      try {
        setLoadingSupplies(true);
        const [itemsRes, prRes] = await Promise.all([
          actionResponse(requisitionSupplies()),
          actionResponse(listRequisitions()),
        ]);
        setSuppliesList(itemsRes.data.data);

        if (!initialData?.prNumber) {
          if (prRes.data?.success) {
            const list: { prNumber?: string }[] = prRes.data.data || [];
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
      } catch {
        setErrors((prev) => ({
          ...prev,
          submit: "Supplies could not be loaded. Reload the page to retry.",
        }));
      } finally {
        setLoadingSupplies(false);
      }
    };

    fetchSuppliesAndNumber();
  }, [active, initialData, initialSupplies]);

  // Add Item (adds a clean selectable row, matching Figma & RecipeFormPage)
  const handleAddItem = () => {
    if (uniqueSupplies.length > 0 && items.length >= uniqueSupplies.length) return;
    setItems((prev) => [...prev, createEmptyItemRow()]);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.items;
      return copy;
    });
  };

  // Remove Item (resets if only 1 row remains so the Figma row layout stays visible)
  const handleRemoveItem = (index: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return [createEmptyItemRow()];
      return prev.filter((_, idx) => idx !== index);
    });
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

  const resolvedPurpose = purposeChoice === "Other" ? customPurpose.trim() : purposeChoice.trim();
  const selectedItems = useMemo(() => items.filter((it) => it.itemId > 0), [items]);

  // Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!requestedBy.trim()) newErrors.requestedBy = "Requester name is required.";
    if (!department.trim()) newErrors.department = "Department is required.";
    if (!resolvedPurpose) {
      newErrors.purpose =
        purposeChoice === "Other"
          ? "Please specify a purpose (max 50 characters)."
          : "Purpose is required.";
    } else if (purposeChoice === "Other" && resolvedPurpose.length > PURPOSE_OTHER_MAX) {
      newErrors.purpose = `Purpose cannot exceed ${PURPOSE_OTHER_MAX} characters.`;
    }
    if (!priority.trim()) newErrors.priority = "Priority is required.";
    const dateError = getFutureDateError(requiredDate, "Required date", { allowToday: false });
    if (dateError) newErrors.requiredDate = dateError;

    if (selectedItems.length === 0) {
      newErrors.items = "At least one item must be requested.";
    } else {
      const duplicateIds = new Set<number>();
      const seenIds = new Set<number>();
      selectedItems.forEach((item) => {
        if (seenIds.has(item.itemId)) duplicateIds.add(item.itemId);
        seenIds.add(item.itemId);
      });
      if (duplicateIds.size > 0) {
        newErrors.items = "Duplicate items must be consolidated before saving.";
      }
      items.forEach((it, idx) => {
        if (it.itemId > 0 && (!it.requestedQuantity || it.requestedQuantity <= 0)) {
          newErrors[`item_qty_${idx}`] = "Quantity must be greater than 0.";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const todayDate = getTodayDateString();
  const maxFutureDate = getMaxFutureDateString();

  const isFormValid = useMemo(() => {
    if (!requestedBy.trim() || !department.trim() || !resolvedPurpose || !priority.trim() || !requiredDate) {
      return false;
    }
    if (getFutureDateError(requiredDate, "Required date", { allowToday: false })) return false;
    if (purposeChoice === "Other" && resolvedPurpose.length > PURPOSE_OTHER_MAX) return false;
    if (selectedItems.length === 0) return false;
    return selectedItems.every((it) => it.itemId > 0 && it.requestedQuantity > 0);
  }, [requestedBy, department, resolvedPurpose, purposeChoice, priority, requiredDate, selectedItems]);

  // Save / Submit execution (unchanged backend actions)
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
        requestType: resolvedPurpose,
        priority: normalizePrPriority(priority),
        requiredDate: new Date(requiredDate).toISOString(),
        purpose: resolvedPurpose,
        notes: notes.trim() || null,
        submitForApproval,
        items: selectedItems.map((it) => ({
          itemId: it.itemId,
          requestedQuantity: it.requestedQuantity,
          purchaseUomId: it.purchaseUomId || 1,
          estimatedUnitPrice: it.estimatedUnitPrice || 0,
          suggestedSupplierId:
            (it as { suggestedSupplierId?: number | null }).suggestedSupplierId || null,
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
    } catch (err: unknown) {
      console.error("Failed to save PR:", err);
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setErrors((prev) => ({
        ...prev,
        submit:
          e?.response?.data?.message ||
          e?.message ||
          "An error occurred while saving the requisition.",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestAction = (action: "draft" | "submit") => {
    if (!validateForm()) return;
    setPendingAction(action);
    setConfirmSaveOpen(true);
  };

  const handleRequestCancel = () => {
    if (variant === "modal") {
      onCancel();
      return;
    }
    setConfirmDiscardOpen(true);
  };

  const containerClasses =
    variant === "page"
      ? embedded
        ? "space-y-5 pb-10 animate-page-in"
        : "page-container px-4 sm:px-8 w-full space-y-5 pb-10 animate-page-in"
      : "space-y-4";

  return (
    <>
      <div className={containerClasses}>
        {/* Top Back Link & Page Title (Page Mode) */}
        {variant === "page" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleRequestCancel}
              className="inline-flex items-center gap-1 type-body text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Purchase requisitions</span>
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="type-page-title text-ink">
                {isEdit ? "Edit purchase requisition" : "New purchase requisition"}
              </h1>
              {isEdit && <StatusBadge status={statusText} />}
            </div>
            <p className="type-body text-ink-muted">
              Request raw materials, ingredients, or tools to replenish warehouse stock.
            </p>
          </div>
        )}

        {/* Submit / Load Error Alert */}
        {errors.submit && (
          <div
            role="alert"
            className="rounded-control border border-status-red-border bg-status-red-bg p-3 type-caption text-status-red flex items-center justify-between animate-in fade-in-50"
          >
            <span role="alert" className="font-medium">
              {errors.submit}
            </span>
            <button
              type="button"
              onClick={() =>
                setErrors((prev) => {
                  const c = { ...prev };
                  delete c.submit;
                  return c;
                })
              }
              className="font-semibold underline ml-2 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main 2-Column Layout (Matching Figma Form · New purchase requisition) */}
        <div
          className={
            variant === "page"
              ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start"
              : "space-y-4"
          }
        >
          {/* Left Column: Requisition Details, Requested Items, Notes */}
          <div className="min-w-0 space-y-5">
            {/* Card 1: Requisition details */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-4">
              <h2 className="type-card-title text-ink">Requisition details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                {/* Purchase Requisition Number */}
                <div>
                  <label className="mb-1.5 block type-label text-ink whitespace-nowrap">
                    Purchase Requisition No.
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body text-ink-secondary select-all">
                    {prNumber || "PR-XXXX-XXXX"}
                  </div>
                </div>

                {/* Request Date */}
                <div>
                  <label className="mb-1.5 block type-label text-ink whitespace-nowrap">
                    Request Date
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body text-ink-secondary">
                    {requestDate}
                  </div>
                </div>

                {/* Required Date */}
                <div>
                  <label
                    className={`mb-1.5 block type-label whitespace-nowrap ${
                      errors.requiredDate ? "text-destructive" : "text-ink"
                    }`}
                  >
                    Required Date <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="date"
                      min={todayDate}
                      max={maxFutureDate}
                      value={requiredDate}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        setRequiredDate(nextVal);
                        const errMsg = nextVal
                          ? getFutureDateError(nextVal, "Required date", { allowToday: false })
                          : "";
                        setErrors((prev) => {
                          const c = { ...prev };
                          if (errMsg) c.requiredDate = errMsg;
                          else delete c.requiredDate;
                          return c;
                        });
                      }}
                      className={`w-full h-10 rounded-control border ${
                        errors.requiredDate
                          ? "!border-destructive focus-visible:!ring-destructive"
                          : "border-input"
                      } bg-surface px-3.5 py-2 pr-10 type-body text-ink shadow-none transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                    />
                    <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                  </div>
                  {errors.requiredDate && (
                    <p className="mt-1 type-caption font-medium text-destructive animate-in fade-in-50">
                      {errors.requiredDate}
                    </p>
                  )}
                </div>

                {/* Requested By (Read-Only from Account) */}
                <div>
                  <label className="mb-1.5 block type-label text-ink whitespace-nowrap">
                    Requested By
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body text-ink-secondary select-none truncate">
                    {requestedBy || "Loading..."}
                  </div>
                </div>

                {/* Department (Read-Only from Account) */}
                <div>
                  <label className="mb-1.5 block type-label text-ink whitespace-nowrap">
                    Department
                  </label>
                  <div className="flex items-center h-10 px-3.5 rounded-control border border-border bg-page type-body text-ink-secondary select-none">
                    {department || "Inventory"}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="mb-1.5 block type-label text-ink whitespace-nowrap">
                    Priority <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={priority}
                      onChange={(e) => setPriority(normalizePrPriority(e.target.value))}
                      className="w-full h-10 appearance-none rounded-control border border-input bg-surface pl-3.5 pr-9 py-2 type-body text-ink transition-colors cursor-pointer focus:ring-1 focus:ring-ring focus:outline-none"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  </div>
                </div>

                {/* Purpose (+ Specify Reason when "Other") */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <div
                    className={`grid grid-cols-1 gap-4 ${
                      purposeChoice === "Other" ? "sm:grid-cols-2" : ""
                    }`}
                  >
                    <div>
                      <label
                        className={`mb-1.5 block type-label ${
                          errors.purpose ? "text-destructive" : "text-ink"
                        }`}
                      >
                        Purpose <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={purposeChoice}
                          onChange={(e) => {
                            const next = e.target.value;
                            setPurposeChoice(next);
                            if (next !== "Other") {
                              setCustomPurpose("");
                              setCustomPurposeWarning("");
                            }
                            setErrors((prev) => {
                              const c = { ...prev };
                              delete c.purpose;
                              return c;
                            });
                          }}
                          className="w-full h-10 appearance-none rounded-control border border-input bg-surface pl-3.5 pr-9 py-2 type-body text-ink transition-colors cursor-pointer focus:ring-1 focus:ring-ring focus:outline-none"
                        >
                          {PR_PURPOSE_CHOICES.map((choice) => (
                            <option key={choice} value={choice}>
                              {choice}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                      </div>
                    </div>

                    {purposeChoice === "Other" && (
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label
                            className={`block type-label ${
                              errors.purpose ? "text-destructive" : "text-ink"
                            }`}
                          >
                            Specify Reason <span className="text-destructive">*</span>
                          </label>
                          <span
                            className={`type-caption tabular-nums ${
                              customPurpose.length >= PURPOSE_OTHER_MAX
                                ? "font-medium text-status-amber"
                                : "text-ink-muted"
                            }`}
                          >
                            {customPurpose.length}/{PURPOSE_OTHER_MAX}
                          </span>
                        </div>
                        <Input
                          type="text"
                          value={customPurpose}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const exceeded = raw.length > PURPOSE_OTHER_MAX;
                            const val = raw.slice(0, PURPOSE_OTHER_MAX);
                            setCustomPurpose(val);
                            if (exceeded) {
                              setCustomPurposeWarning(
                                `Purpose is limited to ${PURPOSE_OTHER_MAX} characters.`
                              );
                            } else if (val.length === PURPOSE_OTHER_MAX) {
                              setCustomPurposeWarning(
                                `Maximum limit of ${PURPOSE_OTHER_MAX} characters reached.`
                              );
                            } else {
                              setCustomPurposeWarning("");
                            }
                            setErrors((prev) => {
                              const c = { ...prev };
                              delete c.purpose;
                              return c;
                            });
                          }}
                          placeholder="Enter custom purpose (max 50 chars)..."
                          aria-invalid={!!errors.purpose}
                          className={`w-full h-10 rounded-control border ${
                            errors.purpose
                              ? "!border-destructive focus-visible:!ring-destructive"
                              : "border-input"
                          } bg-surface px-3.5 py-2 type-body text-ink shadow-none transition-colors`}
                        />
                        {errors.purpose ? (
                          <p className="mt-1 type-caption font-medium text-destructive animate-in fade-in-50">
                            {errors.purpose}
                          </p>
                        ) : customPurposeWarning ? (
                          <p className="mt-1 type-caption font-medium text-status-amber animate-in fade-in-50">
                            {customPurposeWarning}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Requested items */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="type-card-title text-ink">
                    Requested items <span className="text-destructive">*</span>
                  </h2>
                  <p className="mt-0.5 type-caption text-ink-muted">
                    Select raw materials, ingredients, or supplies and enter the quantity to order.
                  </p>
                </div>
                <span className="type-caption font-medium text-ink-muted tabular-nums">
                  {selectedItems.length} item(s) selected
                </span>
              </div>

              {errors.items && (
                <p className="type-caption font-medium text-destructive">{errors.items}</p>
              )}

              {/* Clean Figma Items Grid (Spacious columns, zero crowding or clipping) */}
              <div className="overflow-x-auto custom-scrollbar -mx-1 px-1 py-0.5">
                <div className="min-w-[700px] space-y-3">
                  <div className="grid grid-cols-[minmax(200px,2fr)_124px_104px_104px_124px_32px] gap-4 items-center pb-1">
                    <div className="type-caption font-medium text-ink-muted">
                      Supply Name
                    </div>
                    <div className="type-caption font-medium text-ink-muted whitespace-nowrap">
                      Supply No.
                    </div>
                    <div className="type-caption font-medium text-ink-muted whitespace-nowrap">
                      Unit of Measure
                    </div>
                    <div className="type-caption font-medium text-ink-muted text-right whitespace-nowrap">
                      Actual Inventory
                    </div>
                    <div className="type-caption font-medium text-ink-muted text-right whitespace-nowrap">
                      Quantity (To Order)
                    </div>
                    <div />
                  </div>

                  {items.map((item, idx) => {
                    const selectedSupply = uniqueSupplies.find(
                      (s) => s.itemId === item.itemId
                    );
                    const hasItem = item.itemId > 0;
                    const supplyNo = hasItem
                      ? item.itemCode || selectedSupply?.itemCode || `SPL-${item.itemId}`
                      : "—";
                    const uomDisplay = hasItem
                      ? item.uomName || selectedSupply?.uomName || "Unit"
                      : "—";
                    const actualInv = hasItem
                      ? Number(
                          selectedSupply ? selectedSupply.currentStock : item.actualInventory || 0
                        ).toLocaleString()
                      : "—";
                    const qtyError = errors[`item_qty_${idx}`];

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="grid grid-cols-[minmax(200px,2fr)_124px_104px_104px_124px_32px] gap-4 items-center">
                          {/* Supply Name (Dropdown) */}
                          <div className="relative">
                            <select
                              aria-label={`Supply item row ${idx + 1}`}
                              value={item.itemId || ""}
                              onChange={(e) =>
                                handleSelectSupply(idx, Number(e.target.value))
                              }
                              className={`h-9 w-full appearance-none rounded-control border border-border bg-surface pl-3 pr-9 type-body-secondary ${
                                hasItem ? "text-ink" : "text-ink-muted"
                              } focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none cursor-pointer transition-colors`}
                            >
                              <option value="" disabled>
                                Select supply
                              </option>
                              {uniqueSupplies.map((sup) => {
                                const isAlreadySelected = items.some(
                                  (other, otherIdx) =>
                                    otherIdx !== idx && other.itemId === sup.itemId
                                );
                                return (
                                  <option
                                    key={sup.itemId}
                                    value={sup.itemId}
                                    disabled={isAlreadySelected}
                                  >
                                    {sup.itemName}{" "}
                                    {isAlreadySelected ? "(already added)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                          </div>

                          {/* Supply No. */}
                          <div className="type-body-secondary text-ink-secondary whitespace-nowrap tabular-nums">
                            {supplyNo}
                          </div>

                          {/* Unit of Measure */}
                          <div className="type-body-secondary text-ink-secondary truncate">
                            {uomDisplay}
                          </div>

                          {/* Actual Inventory */}
                          <div className="type-body-secondary font-medium text-ink-secondary text-right tabular-nums">
                            {actualInv}
                          </div>

                          {/* Quantity (To Order) */}
                          <div>
                            <Input
                              aria-label={`Quantity row ${idx + 1}`}
                              type="number"
                              min={1}
                              step="any"
                              placeholder="0"
                              value={item.requestedQuantity || ""}
                              onChange={(e) =>
                                handleQuantityChange(idx, e.target.value)
                              }
                              className={`h-9 w-full text-right type-body-secondary font-semibold ${
                                qtyError ? "border-destructive" : "border-border"
                              } bg-surface text-ink rounded-control shadow-none focus:ring-1 focus:ring-ring tabular-nums`}
                            />
                          </div>

                          {/* Remove Row */}
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 rounded-control text-ink-muted hover:text-destructive hover:bg-subtle transition-colors cursor-pointer"
                              title="Remove"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {qtyError && (
                          <p className="type-caption text-destructive text-right pr-10">
                            {qtyError}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={
                    loadingSupplies ||
                    (uniqueSupplies.length > 0 && items.length >= uniqueSupplies.length)
                  }
                  className="inline-flex items-center gap-1.5 type-body font-medium text-primary hover:underline transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add item</span>
                </button>
              </div>
            </div>

            {/* Card 3: Notes (Optional) */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="type-card-title text-ink">
                  Notes <span className="type-caption font-normal text-ink-muted">(Optional)</span>
                </h2>
                <span className="type-caption text-ink-muted tabular-nums">
                  {notes.length}/300
                </span>
              </div>
              <Textarea
                rows={3}
                maxLength={300}
                placeholder="Enter additional notes (optional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-control border border-input bg-surface px-3.5 py-2.5 type-body text-ink shadow-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
          </div>

          {/* Right Column: Requisition Summary Card (Page Mode) */}
          {variant === "page" && (
            <div className="space-y-5">
              <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
                <h2 className="type-card-title text-ink">Requisition summary</h2>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 type-body">
                    <span className="text-ink-muted">Requisition No.</span>
                    <span className="font-medium text-ink tabular-nums">
                      {prNumber || "Assigned on save"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body">
                    <span className="text-ink-muted">Status</span>
                    <span className="font-medium text-ink">{statusText}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body">
                    <span className="text-ink-muted">Request Date</span>
                    <span className="font-medium text-ink">{requestDate}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body">
                    <span className="text-ink-muted">Required Date</span>
                    <span className="font-medium text-ink">
                      {formatSummaryDate(requiredDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body">
                    <span className="text-ink-muted">Requested By</span>
                    <span className="font-medium text-ink truncate max-w-[190px]">
                      {requestedBy || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body">
                    <span className="text-ink-muted">Department</span>
                    <span className="font-medium text-ink">{department || "Inventory"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body">
                    <span className="text-ink-muted">Priority</span>
                    <span className="font-medium text-ink">{priority}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3 type-body">
                    <span className="text-ink-muted shrink-0">Purpose</span>
                    <span className="font-medium text-ink text-right break-words">
                      {resolvedPurpose || "—"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-divider pt-3 flex items-center justify-between gap-3">
                  <span className="type-label text-ink">Total items requested</span>
                  <span className="type-card-title text-primary tabular-nums">
                    {selectedItems.length} {selectedItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar (Non-sticky, matching RecipeFormPage so it never blocks form fields) */}
        <div
          className={
            variant === "page"
              ? "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-divider pt-4"
              : "flex flex-wrap justify-end gap-3 pt-5 pb-3 border-t border-divider mt-4"
          }
        >
          {variant === "page" && (
            <p className="type-caption text-ink-muted">
              Submitted requisitions are sent to Admin for approval before a Purchase Order can be created.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleRequestCancel}
              disabled={submitting}
              className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting || !isFormValid}
              onClick={() => handleRequestAction("draft")}
              className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-ink hover:bg-subtle shadow-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              disabled={submitting || !isFormValid}
              onClick={() => handleRequestAction("submit")}
              className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit for Approval"}
            </Button>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      <ActionConfirmModal
        open={confirmDiscardOpen}
        title="Discard Unsaved Changes?"
        subtitle={prNumber && prNumber !== "Assigned on save" ? `Requisition: ${prNumber}` : undefined}
        description="Are you sure you want to leave this page? Any unsaved changes to this purchase requisition will be lost."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        onCancel={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          onCancel();
        }}
      />

      {/* Save / Submit Confirmation Modal */}
      <ActionConfirmModal
        open={confirmSaveOpen}
        title={
          pendingAction === "submit"
            ? "Submit Purchase Requisition"
            : "Save Purchase Requisition Draft"
        }
        subtitle={`Requisition No: ${prNumber || "PR-XXXX-XXXX"} • ${selectedItems.length} item(s)`}
        description={
          pendingAction === "submit"
            ? `Are you sure you want to submit ${prNumber || "this purchase requisition"} for approval?`
            : `Are you sure you want to save ${prNumber || "this purchase requisition"} as a draft?`
        }
        confirmLabel={pendingAction === "submit" ? "Confirm & Submit" : "Confirm & Save"}
        submitting={submitting}
        onCancel={() => setConfirmSaveOpen(false)}
        onConfirm={async () => {
          setConfirmSaveOpen(false);
          await executeSave(pendingAction === "submit");
        }}
      />
    </>
  );
}

/**
 * Full-page Purchase Requisition form (matching Figma Form · New purchase requisition).
 */
export function CreatePRForm({
  initialSupplies,
  initialData,
  isEdit = false,
  onClose,
  onSuccess,
  embedded = false,
}: CreatePRFormProps) {
  const router = useRouter();

  const handleCancel = () => {
    if (onClose) onClose();
    else router.push("/orders-procurement");
  };

  const handleSuccess = () => {
    if (onSuccess) onSuccess();
    else router.push("/orders-procurement");
  };

  return (
    <PRFormBody
      active={true}
      initialSupplies={initialSupplies}
      initialData={initialData}
      isEdit={isEdit}
      onCancel={handleCancel}
      onSuccess={handleSuccess}
      variant="page"
      embedded={embedded}
    />
  );
}

/**
 * Backward-compatible modal wrapper for tests or modal triggers.
 */
export function CreatePRModal({
  open,
  onClose,
  onSuccess,
  initialSupplies,
  initialData,
  isEdit = false,
}: CreatePRModalProps) {
  return (
    <ModalWrapper
      open={open}
      title={isEdit ? "Edit Purchase Requisition" : "Create Purchase Requisition"}
      onClose={onClose}
      size="max-w-[780px]"
    >
      <PRFormBody
        active={open}
        initialSupplies={initialSupplies}
        initialData={initialData}
        isEdit={isEdit}
        onCancel={onClose}
        onSuccess={onSuccess}
        variant="modal"
      />
    </ModalWrapper>
  );
}
