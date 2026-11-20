"use client";
import { listFinishedProducts as productionListFinishedProducts } from "@/app/actions/production/products";
import { suggestRequestLots as productionSuggestRequestLots } from "@/app/actions/production/lot-suggestions";
import { createProductionRequest as productionCreateProductionRequest } from "@/app/actions/production/requests";
import { updateProductionRequest as productionUpdateProductionRequest } from "@/app/actions/production/request-detail";

import { listRecipes } from "@/app/actions/production/recipes";
import { actionResponse } from "@/lib/resources/action-response";


import React, { useState, useEffect, useMemo } from "react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
} from "lucide-react";
import { ProductionRequestEntity, LotSuggestionsResponse } from "./types";
import { ProductionActionModal, ProductionActionType } from "./ProductionActionModal";
import ActionConfirmModal from "@/components/shared/ActionConfirmModal";
import { useIsAdmin } from "@/context/StaffContext";
import { getFutureDateError, getMaxFutureDateString } from "@/lib/date-limits";
import { resolveStaffName } from "@/lib/orders/dto";

interface ProductionRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newPrData?: any) => void;
  initialRequest?: ProductionRequestEntity | null;
  prefillData?: {
    productId?: number;
    productName?: string;
    variant?: string;
    quantity?: number;
    priority?: "Low" | "Medium" | "High";
    reason?: string;
  } | null;
  onProceedToIssuance?: (prodReqId: number) => void;
  onViewPrSummary?: (prData: any) => void;
  onStartProduction?: (req: ProductionRequestEntity) => void;
}

interface ProductOption {
  productId: number;
  productName: string;
  sku: string;
  variant: string;
}

interface RecipeOption {
  recipeId: number;
  recipeName: string;
  productId: number;
  outputQuantity: number;
  yieldUom: string;
}

const REASON_OPTIONS = [
  "Regular Stock Replenishment",
  "Customer Order Fulfillment",
  "Buffer Stock Build-up",
  "Safety Stock Rebalance",
  "Event / Seasonal Demand",
  "Special Order",
  "Other",
];

const CUSTOM_REASON_MAX = 100;

export const HOURS_12 = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
export const MINUTES_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export function parse24HTo12H(time24: string): { hour: string; minute: string; period: "AM" | "PM" } {
  if (!time24 || !time24.includes(":")) {
    return { hour: "08", minute: "00", period: "AM" };
  }
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) h = 8;
  const minute = isNaN(m) ? "00" : String(m).padStart(2, "0");

  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const hour = String(h12).padStart(2, "0");

  return { hour, minute, period };
}

export function convert12HTo24H(hour: string, minute: string, period: "AM" | "PM"): string {
  let h = parseInt(hour, 10);
  if (isNaN(h) || h < 1 || h > 12) h = 8;
  const m = parseInt(minute, 10);
  const mStr = isNaN(m) || m < 0 || m > 59 ? "00" : String(m).padStart(2, "0");

  if (period === "AM") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return `${String(h).padStart(2, "0")}:${mStr}`;
}

let cachedProducts: ProductOption[] | null = null;
let cachedRecipes: RecipeOption[] | null = null;

export function formatTimeTo12Hour(timeStr?: string | null): string {
  if (!timeStr) return "—";
  if (/am|pm/i.test(timeStr)) return timeStr;
  const { hour, minute, period } = parse24HTo12H(timeStr);
  return `${hour}:${minute} ${period}`;
}

export default function ProductionRequestModal({
  open,
  onClose,
  onSuccess,
  initialRequest,
  prefillData,
  onProceedToIssuance,
  onViewPrSummary,
  onStartProduction,
}: ProductionRequestModalProps) {
  const isViewMode = Boolean(initialRequest);
  const isAdmin = useIsAdmin();

  // Form State
  const [selectedProductName, setSelectedProductName] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [recipeId, setRecipeId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(0);
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [requiredDate, setRequiredDate] = useState<string>("");
  const [requiredTime, setRequiredTime] = useState<string>("08:00");
  const [timeHour, setTimeHour] = useState<string>("08");
  const [timeMinute, setTimeMinute] = useState<string>("00");
  const [timePeriod, setTimePeriod] = useState<"AM" | "PM">("AM");
  const [selectedReasonOption, setSelectedReasonOption] = useState<string>("Regular Stock Replenishment");
  const [customReason, setCustomReason] = useState<string>("");
  const [timeError, setTimeError] = useState<string>("");

  // Action modal state (PR/PO confirmation style)
  const [actionModal, setActionModal] = useState<{ open: boolean; type: ProductionActionType } | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
  const [confirmCreatePrOpen, setConfirmCreatePrOpen] = useState<boolean>(false);

  // Data fetching
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<RecipeOption[]>([]);
  const [lotSuggestions, setLotSuggestions] = useState<LotSuggestionsResponse | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Today string for date input min validation (YYYY-MM-DD)
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Unique product names for Product select
  const uniqueProductNames = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.productName) set.add(p.productName);
    });
    return Array.from(set);
  }, [products]);

  // Available variants for the selected product
  const availableVariants = useMemo(() => {
    if (!selectedProductName) return [];
    const set = new Set<string>();
    products
      .filter((p) => p.productName === selectedProductName)
      .forEach((p) => {
        set.add(p.variant?.trim() || "Standard");
      });
    return Array.from(set);
  }, [products, selectedProductName]);

  // Initialize defaults
  useEffect(() => {
    if (open) {
      if (initialRequest) {
        setSelectedProductName(initialRequest.productName || "");
        setSelectedVariant(initialRequest.variant || "Standard");
        setProductId(String(initialRequest.productId));
        setRecipeId(String(initialRequest.recipeId));
        setQuantity(initialRequest.quantity);

        const rawP = initialRequest.priority;
        if (rawP === "High" || rawP === "Priority") {
          setPriority("High");
        } else if (rawP === "Low") {
          setPriority("Low");
        } else {
          setPriority("Medium");
        }

        setRequiredDate(initialRequest.requiredDate ? initialRequest.requiredDate.slice(0, 10) : "");
        const rawTime = initialRequest.requiredTime || "08:00";
        setRequiredTime(rawTime);
        const parsedTime = parse24HTo12H(rawTime);
        setTimeHour(parsedTime.hour);
        setTimeMinute(parsedTime.minute);
        setTimePeriod(parsedTime.period);

        const rawReason = initialRequest.reason || "Regular Stock Replenishment";
        if (REASON_OPTIONS.includes(rawReason)) {
          setSelectedReasonOption(rawReason);
          setCustomReason("");
        } else {
          setSelectedReasonOption("Other");
          setCustomReason(rawReason);
        }
      } else {
        // Reset form for new creation (or prefill from Inventory "Produce Now")
        setSelectedProductName(prefillData?.productName || "");
        setSelectedVariant(prefillData?.variant || "");
        setProductId(prefillData?.productId ? String(prefillData.productId) : "");
        setRecipeId("");
        setFilteredRecipes([]);
        setQuantity(prefillData?.quantity && prefillData.quantity > 0 ? prefillData.quantity : 100);
        setPriority(prefillData?.priority || "Medium");
        const tomorrowDate = new Date(Date.now() + 86400000);
        const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
        setRequiredDate(tomorrowStr);
        setRequiredTime("08:00");
        setTimeHour("08");
        setTimeMinute("00");
        setTimePeriod("AM");
        setSelectedReasonOption(prefillData?.reason || "Regular Stock Replenishment");
        setCustomReason("");
        setLotSuggestions(null);
      }
      setActionModal(null);
      setConfirmSubmitOpen(false);
      setConfirmCreatePrOpen(false);
      setTimeError("");
    }
  }, [open, initialRequest, prefillData]);

  // Load products and recipes (with instant memory cache)
  useEffect(() => {
    if (open) {
      if (cachedProducts) {
        setProducts(cachedProducts);
      }
      if (cachedRecipes) {
        setRecipes(cachedRecipes);
      }

      actionResponse(productionListFinishedProducts()).then((res: any) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          const prods = res.data.data
            .filter((p: any) => p.isActive !== false)
            .map((p: any) => ({
              productId: p.productId,
              productName: p.itemName || p.productName || "Product",
              sku: p.sku || "",
              variant: p.variant || "",
            }));
          cachedProducts = prods;
          setProducts(prods);
        }
      }).catch(console.error);

      actionResponse(listRecipes()).then((res: any) => {
        const rawRecipes = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        if (Array.isArray(rawRecipes)) {
          const recs = rawRecipes.map((r: any) => ({
            recipeId: r.recipeId,
            recipeName: r.recipeName,
            productId: r.productId,
            outputQuantity: Number(r.outputQuantity) > 0 ? Number(r.outputQuantity) : 100,
            yieldUom: r.yieldUom || "pcs",
          }));
          cachedRecipes = recs;
          setRecipes(recs);
        }
      }).catch(console.error);
    }
  }, [open]);

  // Handle Product Name selection
  const handleProductSelect = (name: string) => {
    setSelectedProductName(name);
    setSelectedVariant("");
    setProductId("");
    setRecipeId("");
    setFilteredRecipes([]);
    setLotSuggestions(null);
  };

  // Handle Variant selection
  const handleVariantSelect = (variant: string) => {
    setSelectedVariant(variant);
    const matchedProd = products.find(
      (p) => p.productName === selectedProductName && (p.variant?.trim() || "Standard") === variant
    );
    if (matchedProd) {
      setProductId(String(matchedProd.productId));
    } else {
      setProductId("");
    }
    setRecipeId("");
    setLotSuggestions(null);
  };

  // Filter recipes strictly by the selected Variant's productId
  useEffect(() => {
    if (productId) {
      const pId = Number(productId);
      const matched = recipes.filter((r) => Number(r.productId) === pId);
      setFilteredRecipes(matched);
      if (matched.length === 1) {
        setRecipeId(String(matched[0].recipeId));
        if (!prefillData?.quantity) {
          setQuantity(Number(matched[0].outputQuantity) || 0);
        }
      } else if (!matched.some((r) => String(r.recipeId) === recipeId)) {
        setRecipeId("");
        if (!prefillData?.quantity) {
          setQuantity(0);
        }
        setLotSuggestions(null);
      }
    } else {
      setFilteredRecipes([]);
      setRecipeId("");
      if (!prefillData?.quantity) {
        setQuantity(0);
      }
      setLotSuggestions(null);
    }
  }, [productId, recipes, recipeId, prefillData]);

  // Fetch live lot suggestions whenever recipeId or quantity changes
  useEffect(() => {
    if (!open) return;
    if (isViewMode && initialRequest) {
      // In view mode, fetch suggestions for the existing request
      setLoadingSuggestions(true);
      actionResponse(productionSuggestRequestLots(initialRequest.prodReqId))
        .then((res: any) => {
          if (res.data?.success) {
            setLotSuggestions(res.data.data);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSuggestions(false));
    } else if (!isViewMode && productId && recipeId && quantity > 0) {
      // In create mode, fetch preview only when both productId and recipeId are present
      setLoadingSuggestions(true);
      actionResponse(productionSuggestRequestLots("preview", `recipeId=${recipeId}&quantity=${quantity}`))
        .then((res: any) => {
          if (res.data?.success) {
            setLotSuggestions(res.data.data);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSuggestions(false));
    } else {
      setLotSuggestions(null);
      setLoadingSuggestions(false);
    }
  }, [open, isViewMode, initialRequest, productId, recipeId, quantity]);

  // Validation handlers for Date and Time
  const getCurrentTime24 = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const handleDateChange = (val: string) => {
    if (val && val < today) {
      toast.error("Required date cannot be in the past.");
      return;
    }
    setRequiredDate(val);
    if (val === today) {
      const now = new Date();
      const currentTimeStr = getCurrentTime24();
      if (requiredTime < currentTimeStr) {
        const nextTotalMins = Math.min(23 * 60 + 59, now.getHours() * 60 + Math.ceil((now.getMinutes() + 1) / 5) * 5);
        const nextH = String(Math.floor(nextTotalMins / 60)).padStart(2, "0");
        const nextM = String(nextTotalMins % 60).padStart(2, "0");
        const nextTimeStr = `${nextH}:${nextM}`;
        setRequiredTime(nextTimeStr);
        const parsed = parse24HTo12H(nextTimeStr);
        setTimeHour(parsed.hour);
        setTimeMinute(parsed.minute);
        setTimePeriod(parsed.period);
      }
      setTimeError("");
    } else {
      setTimeError("");
    }
  };

  const updateTime = (newHour: string, newMinute: string, newPeriod: "AM" | "PM") => {
    const time24 = convert12HTo24H(newHour, newMinute, newPeriod);
    setTimeHour(newHour);
    setTimeMinute(newMinute);
    setTimePeriod(newPeriod);
    setRequiredTime(time24);

    if (requiredDate === today) {
      const currentTimeStr = getCurrentTime24();
      if (time24 < currentTimeStr) {
        setTimeError(`Required time cannot be in the past (current: ${formatTimeTo12Hour(currentTimeStr)}).`);
        return;
      }
    }
    setTimeError("");
  };

  // Validate before opening Submit Confirmation Modal
  const handlePromptSubmit = () => {
    if (!productId || !recipeId || !quantity || quantity <= 0) {
      toast.error("Please select a product, variant, and recipe.");
      return;
    }

    const dateErr = getFutureDateError(requiredDate, "Required date");
    if (dateErr) {
      toast.error(dateErr);
      return;
    }

    if (requiredDate === today) {
      const currentTimeStr = getCurrentTime24();
      if (requiredTime < currentTimeStr) {
        const msg = `Required time cannot be in the past (current: ${formatTimeTo12Hour(currentTimeStr)}).`;
        setTimeError(msg);
        toast.error(msg);
        return;
      }
    }

    setConfirmSubmitOpen(true);
  };

  // Handle Save (Draft or Submit)
  const handleSubmit = async (submitForApproval: boolean) => {
    if (!productId || !recipeId || !quantity || quantity <= 0) {
      toast.error("Please select a product, variant, and recipe.");
      return;
    }

    const dateErr = getFutureDateError(requiredDate, "Required date");
    if (dateErr) {
      toast.error(dateErr);
      return;
    }

    if (requiredDate === today) {
      const currentTimeStr = getCurrentTime24();
      if (requiredTime < currentTimeStr) {
        const msg = `Required time cannot be in the past (current: ${formatTimeTo12Hour(currentTimeStr)}).`;
        setTimeError(msg);
        toast.error(msg);
        return;
      }
    }

    const finalReason = selectedReasonOption === "Other"
      ? (customReason.trim() || "Other")
      : selectedReasonOption;

    setSubmitting(true);
    try {
      const payload = {
        productId: Number(productId),
        recipeId: Number(recipeId),
        quantity: Number(quantity),
        priority,
        requiredDate,
        requiredTime,
        reason: finalReason,
        submitForApproval,
      };

      const res = await actionResponse(productionCreateProductionRequest(payload));

      if (res.data?.success) {
        const createdReq = res.data.data;

        // If shortfall detected, redirect to Purchase Requisition page with Create PR modal prefilled
        if (lotSuggestions?.hasAnyShortfall) {
          const shortfallItems = lotSuggestions.ingredients
            .filter((ing) => ing.hasShortfall || ing.shortfallQuantity > 0)
            .map((ing) => ({
              itemId: ing.itemId,
              itemCode: ing.itemCode,
              itemName: ing.itemName,
              uomName: ing.uomAbbr,
              currentStock: ing.totalAvailable,
              requestedQuantity: Math.ceil(ing.shortfallQuantity * 100) / 100,
            }));

          const prefillPR = {
            department: "Production",
            requestType: "Production Shortfall",
            priority: priority === "High" ? "Urgent" : "Normal",
            purpose: `Material shortfall replenishment for ${createdReq.reqNumber}`,
            notes: `Auto-generated for Production Request ${createdReq.reqNumber}. Required shortfall items: ${shortfallItems.map((s) => s.itemName).join(", ")}.`,
            items: shortfallItems,
            sourceProdReqId: createdReq.prodReqId,
          };

          sessionStorage.setItem("prefill_pr", JSON.stringify(prefillPR));
          toast.success(`Production Request ${createdReq.reqNumber} created. Opening Purchase Requisition form...`);
          onSuccess(createdReq);
          onClose();
          window.location.href = "/orders-procurement?tab=pr&create=true";
          return;
        }

        toast.success(`Production Request ${createdReq.reqNumber} submitted for approval!`);
        onSuccess(createdReq);
        onClose();
      } else {
        toast.error(res.data?.message || "Failed to create production request.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Status Actions (Submit Draft, Admin Approve, Admin Reject, Cancel)
  const handleStatusAction = async (action: "submit_approval" | "approve" | "reject" | "cancel", notes?: string) => {
    if (!initialRequest) return;

    setSubmitting(true);
    try {
      const payload: any = { action };
      if (action === "reject") {
        payload.rejectionReason = notes || rejectionReason;
      }
      if (action === "approve") {
        payload.adminNotes = notes || "Approved";
      }

      const res = await actionResponse(productionUpdateProductionRequest(initialRequest.prodReqId, payload));
      if (res.data?.success) {
        toast.success(
          action === "approve"
            ? "Production request approved!"
            : action === "reject"
            ? "Production request rejected."
            : action === "cancel"
            ? "Production request cancelled."
            : "Production request submitted for approval!"
        );
        onSuccess();
        onClose();
      } else {
        toast.error(res.data?.message || "Action failed.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create PR directly from View mode
  const handleCreatePrDirect = async () => {
    if (!initialRequest) return;
    const shortfallItems = (lotSuggestions?.ingredients || [])
      .filter((ing) => ing.hasShortfall || ing.shortfallQuantity > 0)
      .map((ing) => ({
        itemId: ing.itemId,
        itemCode: ing.itemCode,
        itemName: ing.itemName,
        uomName: ing.uomAbbr,
        currentStock: ing.totalAvailable,
        requestedQuantity: Math.ceil(ing.shortfallQuantity * 100) / 100,
      }));

    const prefillPR = {
      department: "Production",
      requestType: "Production Shortfall",
      priority: priority === "High" ? "Urgent" : "Normal",
      purpose: `Material shortfall replenishment for ${initialRequest.reqNumber}`,
      notes: `Auto-generated for Production Request ${initialRequest.reqNumber}. Required shortfall items: ${shortfallItems.map((s) => s.itemName).join(", ")}.`,
      items: shortfallItems,
      sourceProdReqId: initialRequest.prodReqId,
    };

    sessionStorage.setItem("prefill_pr", JSON.stringify(prefillPR));
    toast.success(`Opening Purchase Requisition form for shortfalls...`);
    onClose();
    window.location.href = "/orders-procurement?tab=pr&create=true";
  };

  return (
    <ModalWrapper
      open={open}
      title={isViewMode ? `Production Request: ${initialRequest?.reqNumber}` : "New Production Request"}
      onClose={onClose}
      size="max-w-5xl"
    >
      <div className="space-y-5 text-ink">
        {/* Informative Status Notification Banners for View Mode (single status header, no duplicate fields) */}
        {isViewMode && initialRequest?.status === "Rejected" && (
          <div className="p-4 rounded-control border border-border bg-subtle/60 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-status-red-fg shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="type-body-strong text-ink">Production Request Rejected</h4>
                <p className="type-body-secondary text-ink-muted">
                  Rejected by <strong className="text-ink">{resolveStaffName(initialRequest.rejectedBy) || "Admin"}</strong>
                  {initialRequest.rejectedAt ? ` on ${new Date(initialRequest.rejectedAt).toLocaleDateString()}` : ""}.
                  {initialRequest.rejectionReason && (
                    <span> Reason: &quot;{initialRequest.rejectionReason}&quot;.</span>
                  )}
                </p>
                <p className="type-caption text-ink-muted font-medium">
                  ✓ All reserved ingredient lots for this request have been released back to available inventory.
                </p>
              </div>
            </div>
            <StatusBadge status={initialRequest.status} />
          </div>
        )}

        {isViewMode && initialRequest?.status === "Approved" && (
          <div className="p-4 rounded-control border border-border bg-subtle/60 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-status-green-fg shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="type-body-strong text-ink">Production Request Approved &amp; Lots Finalized</h4>
                <p className="type-body-secondary text-ink-muted">
                  Approved by <strong className="text-ink">{resolveStaffName(initialRequest.approvedBy) || "Admin"}</strong>
                  {initialRequest.approvedAt ? ` on ${new Date(initialRequest.approvedAt).toLocaleDateString()}` : ""}.
                  The reserved ingredient lots shown below are locked for this request and will be consumed upon Material Issuance.
                </p>
              </div>
            </div>
            <StatusBadge status={initialRequest.status} />
          </div>
        )}

        {isViewMode && initialRequest?.status === "Pending Approval" && (
          <div className="p-4 rounded-control border border-border bg-subtle/60 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-ink shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="type-body-strong text-ink">Pending Approval — Lots Reserved</h4>
                <p className="type-body-secondary text-ink-muted">
                  The ingredient lots shown below are actively reserved for this request and cannot be assigned to other production requests.
                </p>
              </div>
            </div>
            <StatusBadge status={initialRequest.status} />
          </div>
        )}

        {isViewMode &&
          initialRequest &&
          initialRequest.status !== "Rejected" &&
          initialRequest.status !== "Approved" &&
          initialRequest.status !== "Pending Approval" && (
            <div className="flex items-center justify-end">
              <StatusBadge status={initialRequest.status} />
            </div>
          )}

        {/* Form Inputs (Organized Top Section matching SupplierModal formatting) */}
        <div className="space-y-4">
          {/* Row 1: Finished Product, Variant, Recipe / BOM */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            {/* Finished Product */}
            <div className="space-y-1.5">
              <label className="block type-label-field text-ink">Finished Product</label>
              {isViewMode ? (
                <div className="flex h-10 items-center px-3.5 rounded-control border border-border bg-surface type-body font-medium text-ink">
                  {initialRequest?.productName}
                </div>
              ) : (
                <Select value={selectedProductName} onValueChange={handleProductSelect}>
                  <SelectTrigger className="w-full h-10 px-3.5 type-body rounded-control border-border bg-surface text-ink">
                    <SelectValue placeholder="Select product..." />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {uniqueProductNames.map((name) => (
                      <SelectItem key={name} value={name} className="type-body">
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Variant */}
            <div className="space-y-1.5">
              <label className="block type-label-field text-ink">Variant</label>
              {isViewMode ? (
                <div className="flex h-10 items-center px-3.5 rounded-control border border-border bg-surface type-body font-medium text-ink">
                  {initialRequest?.variant || "Standard"}
                </div>
              ) : (
                <Select
                  value={selectedVariant}
                  onValueChange={handleVariantSelect}
                  disabled={!selectedProductName || availableVariants.length === 0}
                >
                  <SelectTrigger className="w-full h-10 px-3.5 type-body rounded-control border-border bg-surface text-ink">
                    <SelectValue
                      placeholder={
                        !selectedProductName
                          ? "Select product first"
                          : availableVariants.length === 0
                          ? "No variant"
                          : "Select variant..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {availableVariants.map((v) => (
                      <SelectItem key={v} value={v} className="type-body">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Recipe / BOM */}
            <div className="space-y-1.5">
              <label className="block type-label-field text-ink">Recipe / BOM</label>
              {isViewMode ? (
                <div className="flex h-10 items-center px-3.5 rounded-control border border-border bg-surface type-body font-medium text-ink">
                  {initialRequest?.recipeName}
                </div>
              ) : (
                <Select
                  value={recipeId}
                  onValueChange={(val) => {
                    setRecipeId(val);
                    const selected = filteredRecipes.find((r) => String(r.recipeId) === val);
                    if (selected && Number(selected.outputQuantity) > 0) {
                      setQuantity(Number(selected.outputQuantity));
                    } else {
                      setQuantity(0);
                    }
                  }}
                  disabled={!productId || filteredRecipes.length === 0}
                >
                  <SelectTrigger className="w-full h-10 px-3.5 type-body rounded-control border-border bg-surface text-ink">
                    <SelectValue
                      placeholder={
                        !selectedProductName
                          ? "Select product first"
                          : !productId
                          ? "Select variant first"
                          : filteredRecipes.length === 0
                          ? "No recipe for this variant"
                          : "Select recipe..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {filteredRecipes.length > 0 ? (
                      filteredRecipes.map((r) => (
                        <SelectItem key={r.recipeId} value={String(r.recipeId)} className="type-body">
                          {r.recipeName}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-3 type-body-secondary text-ink-muted text-center">
                        No recipe configured for this variant.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Row 2: Target Quantity, Priority Level, Required Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            {/* Target Output Quantity */}
            <div className="space-y-1.5">
              <label className="block type-label-field text-ink">Target Output Quantity</label>
              {isViewMode ? (
                <div className="flex h-10 items-center px-3.5 rounded-control border border-border bg-surface type-body-strong text-ink">
                  {initialRequest?.quantity} {initialRequest?.yieldUom}
                </div>
              ) : (
                <Input
                  type="number"
                  value={recipeId && quantity > 0 ? quantity : ""}
                  readOnly
                  disabled
                  tabIndex={-1}
                  className="h-10 w-full rounded-control border-border bg-subtle px-3.5 py-2 type-body font-medium text-ink placeholder:font-normal placeholder:text-ink-muted cursor-not-allowed opacity-90 select-none"
                  placeholder={recipeId ? String(quantity) : "Select recipe first"}
                />
              )}
            </div>

            {/* Priority Level: Low, Medium, High */}
            <div className="space-y-1.5">
              <label className="block type-label-field text-ink">Priority Level</label>
              {isViewMode ? (
                <div className="flex h-10 items-center px-3.5 rounded-control border border-border bg-surface type-body font-medium text-ink">
                  {priority}
                </div>
              ) : (
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger className="w-full h-10 px-3.5 type-body rounded-control border-border bg-surface text-ink font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    <SelectItem value="Low" className="type-body">
                      Low
                    </SelectItem>
                    <SelectItem value="Medium" className="type-body">
                      Medium
                    </SelectItem>
                    <SelectItem value="High" className="type-body">
                      High
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Required Date (Date left-aligned, calendar icon on far right end) */}
            <div className="space-y-1.5">
              <label className="block type-label-field text-ink">Required Date</label>
              {isViewMode ? (
                <div className="flex h-10 items-center px-3.5 rounded-control border border-border bg-surface type-body text-ink">
                  {initialRequest?.requiredDate ? new Date(initialRequest.requiredDate).toLocaleDateString() : "—"}
                </div>
              ) : (
                <div className="relative">
                  <Input
                    type="date"
                    min={today}
                    max={getMaxFutureDateString()}
                    value={requiredDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="h-10 w-full rounded-control border-border bg-surface px-3.5 pr-9 py-2 type-body text-ink [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Required Time + Reason / Batch Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            {/* Required Time (12-hour format with AM/PM) */}
            <div className="space-y-1.5">
              <label className="block type-label-field text-ink">Required Time</label>
              {isViewMode ? (
                <div className="h-10 px-3.5 rounded-control border border-border bg-surface type-body font-medium text-ink flex items-center justify-between">
                  <span>{formatTimeTo12Hour(initialRequest?.requiredTime || requiredTime)}</span>
                  <span className="type-caption px-2 py-0.5 rounded-pill bg-subtle text-ink-muted font-semibold uppercase">
                    {parse24HTo12H(initialRequest?.requiredTime || requiredTime).period}
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 h-10">
                    {/* Hour */}
                    <Select
                      value={timeHour}
                      onValueChange={(val) => updateTime(val, timeMinute, timePeriod)}
                    >
                      <SelectTrigger className={`h-10 flex-1 type-body font-medium rounded-control ${timeError ? "border-destructive" : "border-border"} bg-surface px-2.5 text-center text-ink`}>
                        <SelectValue placeholder="HH" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56 bg-surface border-border">
                        {HOURS_12.map((h) => {
                          const isPastHour =
                            requiredDate === today &&
                            convert12HTo24H(h, "59", timePeriod) < getCurrentTime24();
                          return (
                            <SelectItem key={h} value={h} disabled={isPastHour} className="type-body">
                              {h}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    <span className="text-ink-muted font-semibold type-body shrink-0">:</span>

                    {/* Minute */}
                    <Select
                      value={timeMinute}
                      onValueChange={(val) => updateTime(timeHour, val, timePeriod)}
                    >
                      <SelectTrigger className={`h-10 flex-1 type-body font-medium rounded-control ${timeError ? "border-destructive" : "border-border"} bg-surface px-2.5 text-center text-ink`}>
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56 bg-surface border-border">
                        {Array.from(new Set([...MINUTES_OPTIONS, timeMinute]))
                          .sort((a, b) => Number(a) - Number(b))
                          .map((m) => {
                            const isPastMinute =
                              requiredDate === today &&
                              convert12HTo24H(timeHour, m, timePeriod) < getCurrentTime24();
                            return (
                              <SelectItem key={m} value={m} disabled={isPastMinute} className="type-body">
                                {m}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>

                    {/* AM / PM Segmented Control */}
                    <div className={`flex rounded-control border ${timeError ? "border-destructive" : "border-border"} p-0.5 bg-subtle shrink-0 h-10 items-center`}>
                      <button
                        type="button"
                        disabled={requiredDate === today && new Date().getHours() >= 12}
                        onClick={() => updateTime(timeHour, timeMinute, "AM")}
                        className={`h-full px-2.5 type-caption font-semibold rounded-control transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          timePeriod === "AM"
                            ? "bg-primary text-primary-foreground shadow-card"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTime(timeHour, timeMinute, "PM")}
                        className={`h-full px-2.5 type-caption font-semibold rounded-control transition-colors cursor-pointer ${
                          timePeriod === "PM"
                            ? "bg-primary text-primary-foreground shadow-card"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  </div>
                  {timeError && (
                    <p role="alert" className="type-caption font-medium text-status-red-fg">
                      {timeError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Reason / Batch Purpose Dropdown */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block type-label-field text-ink">Reason / Batch Purpose</label>
              {isViewMode ? (
                <div className="flex h-10 items-center px-3.5 rounded-control border border-border bg-surface type-body text-ink truncate">
                  {initialRequest?.reason || "Regular Stock Replenishment"}
                </div>
              ) : (
                <div className="space-y-2">
                  <Select value={selectedReasonOption} onValueChange={setSelectedReasonOption}>
                    <SelectTrigger className="w-full h-10 px-3.5 type-body rounded-control border-border bg-surface text-ink">
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {REASON_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="type-body">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedReasonOption === "Other" && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="type-caption font-medium text-ink">Specify Other Reason</span>
                        <span className={`type-caption ${customReason.length >= CUSTOM_REASON_MAX ? "font-medium text-status-amber-fg" : "text-ink-muted"}`}>
                          {customReason.length}/{CUSTOM_REASON_MAX}
                        </span>
                      </div>
                      <Input
                        type="text"
                        value={customReason}
                        maxLength={CUSTOM_REASON_MAX}
                        onChange={(e) => setCustomReason(e.target.value.slice(0, CUSTOM_REASON_MAX))}
                        placeholder="Specify other reason..."
                        className="h-10 px-3.5 type-body rounded-control border-border bg-surface text-ink"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Shortfall Warning Banner */}
        {lotSuggestions?.hasAnyShortfall && (
          <div className="flex items-start justify-between gap-4 p-4 rounded-control border border-border bg-subtle/60">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-ink shrink-0 mt-0.5" />
              <div>
                <h4 className="type-body-strong text-ink">
                  Material Shortfall Detected
                </h4>
                <p className="type-caption text-ink-muted mt-0.5">
                  Available lot stock in inventory is insufficient for all required recipe ingredients. Submitting will generate a Purchase Requisition for the required shortfall quantities.
                </p>
              </div>
            </div>

            {isViewMode && !initialRequest?.linkedPrId && (
              <Button
                type="button"
                onClick={() => setConfirmCreatePrOpen(true)}
                disabled={submitting}
                className="bg-primary text-primary-foreground hover:bg-primary-hover font-semibold type-caption px-3.5 py-1.5 rounded-control transition-colors shrink-0 shadow-card cursor-pointer"
              >
                Create PR Now
              </Button>
            )}

            {isViewMode && initialRequest?.linkedPrId && (
              <div className="flex items-center gap-2">
                <span className="type-caption font-semibold text-ink">
                  PR: {initialRequest.linkedPrNumber}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onViewPrSummary && onViewPrSummary({ prNumber: initialRequest.linkedPrNumber })}
                  className="type-caption h-7 rounded-control border-border hover:bg-subtle"
                >
                  View PR
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Bill of Materials Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="type-nav-group text-ink-muted">
              Bill of Materials
            </h4>
            {loadingSuggestions && (
              <span className="type-caption text-ink-muted animate-pulse">Calculating available lots...</span>
            )}
          </div>

          <div className="table-card shadow-card">
            <div className="overflow-x-auto table-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="table-head-row border-b border-divider">
                  <tr className="text-left whitespace-nowrap">
                    <th className="table-th py-2.5 px-3">Supply No.</th>
                    <th className="table-th py-2.5 px-3">Ingredient Name</th>
                    <th className="table-th py-2.5 px-3">Unit of Measure</th>
                    <th className="table-th py-2.5 px-3 text-right">Required Quantity</th>
                    <th className="table-th py-2.5 px-3 text-right">Available in Stock</th>
                    <th className="table-th py-2.5 px-3 min-w-[140px]">
                      {isViewMode
                        ? initialRequest?.status === "Rejected"
                          ? "Released Lots"
                          : initialRequest?.status === "Approved"
                          ? "Confirmed Lots"
                          : "Reserved Lots"
                        : "Suggested Lots"}
                    </th>
                    {(lotSuggestions?.ingredients || []).some((ing: any) => {
                      const r = (ing.lots || []).filter((l: any) => l.isReleased);
                      const a = (ing.lots || []).filter((l: any) => Number(l.suggestedQuantity) > 0);
                      return (initialRequest?.status === "Rejected" && r.length > 0 ? r : a).some((l: any) => Boolean(l.expiryDate));
                    }) && (
                      <th className="table-th py-2.5 px-3 min-w-[110px]">Expiry Date</th>
                    )}
                    <th className="table-th py-2.5 px-3 text-center">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {(isViewMode || (productId && recipeId)) && lotSuggestions?.ingredients?.map((item) => {
                    const isRejected = initialRequest?.status === "Rejected";
                    const isApproved = initialRequest?.status === "Approved";
                    const isPending = initialRequest?.status === "Pending Approval";

                    // Active lots have suggested/reserved quantity > 0
                    const activeLots = (item.lots || []).filter((l: any) => Number(l.suggestedQuantity) > 0);
                    const releasedLots = (item.lots || []).filter((l: any) => l.isReleased);
                    const hasShortfall = item.hasShortfall || item.totalAvailable < item.requiredQuantity;

                    return (
                      <tr key={item.ingredientId} className="table-row hover:bg-subtle/50 transition-colors">
                        {/* Supply No. */}
                        <td className="py-3 px-3 table-td font-semibold text-ink whitespace-nowrap">
                          {item.itemCode || "—"}
                        </td>

                        {/* Ingredient Name */}
                        <td className="py-3 px-3 table-td font-semibold text-ink">
                          {item.itemName}
                        </td>

                        {/* Unit of Measure */}
                        <td className="py-3 px-3 table-td text-ink-muted whitespace-nowrap">
                          {item.uomAbbr || "units"}
                        </td>

                        {/* Required Quantity */}
                        <td className="py-3 px-3 table-td text-right font-semibold text-ink whitespace-nowrap">
                          {item.requiredQuantity.toFixed(2)}
                        </td>

                        {/* Available in Stock */}
                        <td className="py-3 px-3 table-td text-right font-semibold text-ink whitespace-nowrap">
                          {item.totalAvailable.toFixed(2)}
                        </td>

                        {/* Suggested / Reserved / Released Lots */}
                        <td className="py-3 px-3 table-td min-w-[140px]">
                          {isRejected ? (
                            releasedLots.length > 0 ? (
                              <div className="space-y-1.5">
                                {releasedLots.map((l: any) => (
                                  <div
                                    key={l.lotId}
                                    className="type-caption font-medium text-ink-muted bg-subtle px-2 py-0.5 rounded-control border border-divider inline-flex items-center gap-1.5 line-through opacity-80"
                                  >
                                    <span>{l.lotCode}</span>
                                    <span className="font-normal whitespace-nowrap">
                                      ({Number(l.releasedQuantity || 0).toFixed(2)} {item.uomAbbr} released)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="type-caption text-ink-muted italic">None (Released)</span>
                            )
                          ) : activeLots.length > 0 ? (
                            <div className="space-y-1.5">
                              {activeLots.map((l) => (
                                <div
                                  key={l.lotId}
                                  className="type-caption font-medium text-ink bg-subtle px-2 py-0.5 rounded-control border border-divider inline-flex items-center gap-1.5"
                                >
                                  <span>{l.lotCode}</span>
                                  <span className="text-ink-muted font-normal whitespace-nowrap">
                                    ({Number(l.suggestedQuantity).toFixed(2)} {item.uomAbbr})
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="type-caption text-ink-muted italic">None</span>
                          )}
                        </td>

                        {/* Expiry Date Column */}
                        {(lotSuggestions?.ingredients || []).some((ing: any) => {
                          const r = (ing.lots || []).filter((l: any) => l.isReleased);
                          const a = (ing.lots || []).filter((l: any) => Number(l.suggestedQuantity) > 0);
                          return (isRejected && r.length > 0 ? r : a).some((l: any) => Boolean(l.expiryDate));
                        }) && (
                          <td className="py-3 px-3 table-td min-w-[110px] whitespace-nowrap">
                            {(isRejected && releasedLots.length > 0 ? releasedLots : activeLots).length > 0 ? (
                              <div className="space-y-1.5">
                                {(isRejected && releasedLots.length > 0 ? releasedLots : activeLots).map((l: any) => (
                                  <div key={l.lotId} className="type-caption text-ink-muted py-0.5">
                                    {l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : "No Expiry"}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="type-caption text-ink-muted italic">—</span>
                            )}
                          </td>
                        )}

                        {/* Stock Status */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isRejected ? (
                            <StatusBadge status="Released">Released to Stock</StatusBadge>
                          ) : isApproved ? (
                            <StatusBadge status="Reserved">Reserved &amp; Confirmed</StatusBadge>
                          ) : isPending ? (
                            <StatusBadge status="Pending">Reserved (Pending)</StatusBadge>
                          ) : hasShortfall ? (
                            <StatusBadge status="Out of Stock">Shortfall: {item.shortfallQuantity.toFixed(2)} {item.uomAbbr}</StatusBadge>
                          ) : (
                            <StatusBadge status="Available">Available</StatusBadge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(!lotSuggestions || lotSuggestions.ingredients.length === 0 || (!isViewMode && (!productId || !recipeId))) && (
                    <tr>
                      <td
                        colSpan={
                          (lotSuggestions?.ingredients || []).some((ing: any) => {
                            const r = (ing.lots || []).filter((l: any) => l.isReleased);
                            const a = (ing.lots || []).filter((l: any) => Number(l.suggestedQuantity) > 0);
                            return (initialRequest?.status === "Rejected" && r.length > 0 ? r : a).some((l: any) => Boolean(l.expiryDate));
                          })
                            ? 8
                            : 7
                        }
                        className="py-8 text-center type-caption text-ink-muted"
                      >
                        Select a product and recipe to preview bill of materials and suggested lots.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons (matching SupplierModal footer) */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-5 pb-3 border-t border-divider mt-6 mb-2">
          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border border-border bg-surface px-5 py-2.5 type-label-button text-ink hover:bg-subtle transition-colors h-10 cursor-pointer"
          >
            {isViewMode ? "Close" : "Cancel"}
          </ModalCloseButton>

          {!isViewMode ? (
            <Button
              type="button"
              onClick={handlePromptSubmit}
              disabled={submitting || !productId || !recipeId || !quantity || quantity <= 0 || !requiredDate || Boolean(timeError)}
              className="rounded-control bg-primary text-primary-foreground px-5 py-2.5 type-label-button hover:bg-primary-hover transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed h-10 cursor-pointer"
            >
              {submitting
                ? "Processing..."
                : lotSuggestions?.hasAnyShortfall
                ? "Create Purchase Requisition"
                : "Submit for Approval"}
            </Button>
          ) : (
            <>
              {/* Admin Approval Actions (PR/PO style confirmation modal) */}
              {isAdmin && initialRequest?.status === "Pending Approval" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActionModal({ open: true, type: "reject" })}
                    disabled={submitting}
                    className="rounded-control border border-border bg-surface px-5 py-2.5 type-label-button text-ink hover:bg-subtle transition-colors h-10 cursor-pointer"
                  >
                    Reject Request
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setActionModal({ open: true, type: "approve" })}
                    disabled={submitting}
                    className="rounded-control bg-primary text-primary-foreground px-5 py-2.5 type-label-button hover:bg-primary-hover transition-colors shadow-xs h-10 cursor-pointer"
                  >
                    Approve Request
                  </Button>
                </>
              )}

              {/* Shortfall resolution shortcut in View Mode */}
              {lotSuggestions?.hasAnyShortfall && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmCreatePrOpen(true)}
                  className="rounded-control border border-border bg-surface px-5 py-2.5 type-label-button text-ink hover:bg-subtle transition-colors h-10 cursor-pointer"
                >
                  Create Purchase Requisition
                </Button>
              )}

              {/* Approved status -> Proceed to Material Issuance */}
              {initialRequest?.status === "Approved" && onProceedToIssuance && (
                <Button
                  type="button"
                  onClick={() => {
                    onProceedToIssuance(initialRequest.prodReqId);
                    onClose();
                  }}
                  className="rounded-control bg-primary text-primary-foreground px-5 py-2.5 type-label-button hover:bg-primary-hover transition-colors shadow-xs h-10 cursor-pointer"
                >
                  Proceed to Material Issuance
                </Button>
              )}

              {/* Ready for Production or Materials Issued -> Start Production */}
              {(initialRequest?.status === "Ready for Production" || initialRequest?.status === "Materials Issued") && onStartProduction && (
                <Button
                  type="button"
                  onClick={() => {
                    if (initialRequest) {
                      onStartProduction(initialRequest);
                    }
                  }}
                  className="rounded-control bg-primary text-primary-foreground px-5 py-2.5 type-label-button hover:bg-primary-hover transition-colors shadow-xs h-10 cursor-pointer"
                >
                  Start Production
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Admin Approve / Reject Confirmation Modal (PR/PO styled) */}
      {actionModal && initialRequest && (
        <ProductionActionModal
          open={actionModal.open}
          actionType={actionModal.type}
          reqNumber={initialRequest.reqNumber}
          onConfirm={async (notes) => {
            await handleStatusAction(actionModal.type, notes);
            setActionModal(null);
          }}
          onClose={() => setActionModal(null)}
        />
      )}

      {/* Submit New Production Request Confirmation Modal */}
      <ActionConfirmModal
        open={confirmSubmitOpen}
        title={lotSuggestions?.hasAnyShortfall ? "Confirm Request & Create Requisition" : "Submit Production Request"}
        subtitle={`${selectedProductName || "Product"} (${selectedVariant || "Standard"}) • Target: ${quantity} ${filteredRecipes.find((r) => String(r.recipeId) === recipeId)?.yieldUom || "units"}`}
        description={
          lotSuggestions?.hasAnyShortfall
            ? "Available stock is insufficient for all required ingredients. Submitting will create this production request and redirect you to create a Purchase Requisition for the shortfall items."
            : `Are you sure you want to submit this production request for ${selectedProductName} (${selectedVariant || "Standard"}) for approval? Suggested ingredient lots will be reserved.`
        }
        confirmText={lotSuggestions?.hasAnyShortfall ? "Confirm & Create PR" : "Confirm Submission"}
        loading={submitting}
        onConfirm={async () => {
          setConfirmSubmitOpen(false);
          await handleSubmit(true);
        }}
        onClose={() => setConfirmSubmitOpen(false)}
      />

      {/* Create Shortfall PR from View Mode Confirmation Modal */}
      <ActionConfirmModal
        open={confirmCreatePrOpen}
        title="Create Purchase Requisition"
        subtitle={initialRequest ? `Production Request No: ${initialRequest.reqNumber}` : undefined}
        description="Are you sure you want to open the Purchase Requisition form prefilled with the shortfall ingredients for this production request?"
        confirmText="Continue to PR"
        onConfirm={() => {
          setConfirmCreatePrOpen(false);
          handleCreatePrDirect();
        }}
        onClose={() => setConfirmCreatePrOpen(false)}
      />
    </ModalWrapper>
  );
}
