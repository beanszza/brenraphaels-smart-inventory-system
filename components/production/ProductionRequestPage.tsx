"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listFinishedProducts as productionListFinishedProducts } from "@/app/actions/production/products";
import { suggestRequestLots as productionSuggestRequestLots } from "@/app/actions/production/lot-suggestions";
import { createProductionRequest as productionCreateProductionRequest } from "@/app/actions/production/requests";
import { updateProductionRequest as productionUpdateProductionRequest } from "@/app/actions/production/request-detail";
import { createIssuance } from "@/app/actions/production/issuances";
import { createBatch as productionCreateBatch } from "@/app/actions/production/batches";
import { listRecipes } from "@/app/actions/production/recipes";
import { actionResponse } from "@/lib/resources/action-response";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/shared/StatusBadge";
import ActionConfirmModal from "@/components/shared/ActionConfirmModal";
import { ProductionActionModal, ProductionActionType } from "./ProductionActionModal";
import PrSummaryModal from "./PrSummaryModal";
import {
  HOURS_12,
  MINUTES_OPTIONS,
  parse24HTo12H,
  convert12HTo24H,
  formatTimeTo12Hour,
} from "./ProductionRequestModal";
import { ProductionRequestEntity, LotSuggestionsResponse } from "./types";
import { useStaff, useIsAdmin } from "@/context/StaffContext";
import { getFutureDateError, getMaxFutureDateString } from "@/lib/date-limits";
import { resolveStaffName } from "@/lib/orders/dto";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  XCircle,
} from "lucide-react";

export interface ProductionRequestPrefill {
  productId?: number;
  productName?: string;
  variant?: string;
  quantity?: number;
  priority?: "Low" | "Medium" | "High";
  reason?: string;
}

interface ProductionRequestPageProps {
  mode: "create" | "view";
  initialRequest?: ProductionRequestEntity | null;
  prefillData?: ProductionRequestPrefill | null;
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
  isActive?: boolean;
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

let cachedProducts: ProductOption[] | null = null;
let cachedRecipes: RecipeOption[] | null = null;

function formatDisplayDate(raw?: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PriorityPill({ priority }: { priority: string }) {
  const isHigh = priority === "High" || priority === "Priority";
  const isLow = priority === "Low";
  const label = isHigh ? "High" : isLow ? "Low" : "Medium";
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-pill px-2.5 py-[3px] type-badge ${
        isHigh
          ? "bg-status-amber-bg text-status-amber-fg"
          : isLow
            ? "bg-status-gray-bg text-status-gray-fg"
            : "bg-status-blue-bg text-status-blue-fg"
      }`}
    >
      {label}
    </span>
  );
}

export default function ProductionRequestPage({
  mode,
  initialRequest = null,
  prefillData = null,
}: ProductionRequestPageProps) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = useIsAdmin();
  const isViewMode = mode === "view" && Boolean(initialRequest);

  // Form state (identical data model & defaults to ProductionRequestModal)
  const [selectedProductName, setSelectedProductName] = useState<string>(() =>
    initialRequest ? initialRequest.productName || "" : prefillData?.productName || ""
  );
  const [selectedVariant, setSelectedVariant] = useState<string>(() =>
    initialRequest ? initialRequest.variant || "Standard" : prefillData?.variant || ""
  );
  const [productId, setProductId] = useState<string>(() =>
    initialRequest
      ? String(initialRequest.productId)
      : prefillData?.productId
        ? String(prefillData.productId)
        : ""
  );
  const [recipeId, setRecipeId] = useState<string>(() =>
    initialRequest ? String(initialRequest.recipeId) : ""
  );
  const [quantity, setQuantity] = useState<number>(() =>
    initialRequest
      ? initialRequest.quantity
      : prefillData?.quantity && prefillData.quantity > 0
        ? prefillData.quantity
        : 100
  );
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">(() => {
    const rawP = initialRequest?.priority || prefillData?.priority;
    if (rawP === "High" || rawP === "Priority") return "High";
    if (rawP === "Low") return "Low";
    return "Medium";
  });

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [requiredDate, setRequiredDate] = useState<string>(() => {
    if (initialRequest) {
      return initialRequest.requiredDate ? initialRequest.requiredDate.slice(0, 10) : "";
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const initialParsedTime = useMemo(
    () => parse24HTo12H(initialRequest?.requiredTime || "08:00"),
    [initialRequest?.requiredTime]
  );

  const [requiredTime, setRequiredTime] = useState<string>(
    () => initialRequest?.requiredTime || "08:00"
  );
  const [timeHour, setTimeHour] = useState<string>(initialParsedTime.hour);
  const [timeMinute, setTimeMinute] = useState<string>(initialParsedTime.minute);
  const [timePeriod, setTimePeriod] = useState<"AM" | "PM">(initialParsedTime.period);
  const [timePopoverOpen, setTimePopoverOpen] = useState<boolean>(false);
  const [timeError, setTimeError] = useState<string>("");

  const [selectedReasonOption, setSelectedReasonOption] = useState<string>(() => {
    const raw = initialRequest?.reason || prefillData?.reason || "Regular Stock Replenishment";
    return REASON_OPTIONS.includes(raw) ? raw : "Other";
  });
  const [customReason, setCustomReason] = useState<string>(() => {
    const raw = initialRequest?.reason || prefillData?.reason || "";
    return raw && !REASON_OPTIONS.includes(raw) ? raw : "";
  });

  // Confirmation & action modals
  const [actionModal, setActionModal] = useState<{ open: boolean; type: ProductionActionType } | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
  const [confirmCreatePrOpen, setConfirmCreatePrOpen] = useState<boolean>(false);
  const [confirmStartProdOpen, setConfirmStartProdOpen] = useState<boolean>(false);
  const [prSummaryData, setPrSummaryData] = useState<any | null>(null);

  // Data fetching state
  const [products, setProducts] = useState<ProductOption[]>(cachedProducts ?? []);
  const [recipes, setRecipes] = useState<RecipeOption[]>(cachedRecipes ?? []);
  const [filteredRecipes, setFilteredRecipes] = useState<RecipeOption[]>([]);
  const [lotSuggestions, setLotSuggestions] = useState<LotSuggestionsResponse | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const uniqueProductNames = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.productName) set.add(p.productName);
    });
    return Array.from(set);
  }, [products]);

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

  const selectedRecipeObj = useMemo(
    () => filteredRecipes.find((r) => String(r.recipeId) === recipeId) || null,
    [filteredRecipes, recipeId]
  );

  // Load products and recipes in create mode
  useEffect(() => {
    if (isViewMode) return;
    let active = true;

    actionResponse(productionListFinishedProducts())
      .then((res: any) => {
        if (!active) return;
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
      })
      .catch(console.error);

    actionResponse(listRecipes())
      .then((res: any) => {
        if (!active) return;
        const rawRecipes = Array.isArray(res.data) ? res.data : res.data?.data || [];
        if (Array.isArray(rawRecipes)) {
          const recs = rawRecipes.map((r: any) => ({
            recipeId: r.recipeId,
            recipeName: r.recipeName,
            productId: r.productId,
            outputQuantity: Number(r.outputQuantity) > 0 ? Number(r.outputQuantity) : 100,
            yieldUom: r.yieldUom || "pcs",
            isActive: r.isActive !== false,
          }));
          cachedRecipes = recs;
          setRecipes(recs);
        }
      })
      .catch(console.error);

    return () => {
      active = false;
    };
  }, [isViewMode]);

  const handleProductSelect = (name: string) => {
    setSelectedProductName(name);
    setSelectedVariant("");
    setProductId("");
    setRecipeId("");
    setFilteredRecipes([]);
    setLotSuggestions(null);
  };

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

  // Filter recipes by selected variant's productId
  useEffect(() => {
    if (isViewMode) return;
    if (productId) {
      const pId = Number(productId);
      const matched = recipes.filter(
        (r) => Number(r.productId) === pId && r.isActive !== false
      );
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
  }, [isViewMode, productId, recipes, recipeId, prefillData]);

  // Fetch FEFO lot suggestions
  useEffect(() => {
    let active = true;
    if (isViewMode && initialRequest) {
      setLoadingSuggestions(true);
      actionResponse(productionSuggestRequestLots(initialRequest.prodReqId))
        .then((res: any) => {
          if (active && res.data?.success) {
            setLotSuggestions(res.data.data);
          }
        })
        .catch(console.error)
        .finally(() => {
          if (active) setLoadingSuggestions(false);
        });
    } else if (!isViewMode && productId && recipeId && quantity > 0) {
      setLoadingSuggestions(true);
      actionResponse(productionSuggestRequestLots("preview", `recipeId=${recipeId}&quantity=${quantity}`))
        .then((res: any) => {
          if (active && res.data?.success) {
            setLotSuggestions(res.data.data);
          }
        })
        .catch(console.error)
        .finally(() => {
          if (active) setLoadingSuggestions(false);
        });
    } else {
      setLotSuggestions(null);
      setLoadingSuggestions(false);
    }
    return () => {
      active = false;
    };
  }, [isViewMode, initialRequest, productId, recipeId, quantity]);

  // Date & time validation helpers
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
        const nextTotalMins = Math.min(
          23 * 60 + 59,
          now.getHours() * 60 + Math.ceil((now.getMinutes() + 1) / 5) * 5
        );
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

    const finalReason =
      selectedReasonOption === "Other"
        ? customReason.trim() || "Other"
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
          window.location.href = "/orders-procurement?tab=pr&create=true";
          return;
        }

        toast.success(`Production Request ${createdReq.reqNumber} submitted for approval!`);
        router.push("/production-quality?tab=requests");
        router.refresh();
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

  // Admin Approve / Reject from View page
  const handleStatusAction = async (
    action: "submit_approval" | "approve" | "reject" | "cancel",
    notes?: string
  ) => {
    if (!initialRequest) return;
    setSubmitting(true);
    try {
      const payload: any = { action };
      if (action === "reject") {
        payload.rejectionReason = notes || "Requirements not met";
      }
      if (action === "approve") {
        payload.adminNotes = notes || "Approved";
      }

      const res = await actionResponse(
        productionUpdateProductionRequest(initialRequest.prodReqId, payload)
      );
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
        router.push("/production-quality?tab=requests");
        router.refresh();
      } else {
        toast.error(res.data?.message || "Action failed.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // Create Shortfall PR from View mode
  const handleCreatePrDirect = () => {
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
    toast.success("Opening Purchase Requisition form for shortfalls...");
    window.location.href = "/orders-procurement?tab=pr&create=true";
  };

  // Proceed to Material Issuance (Approved state)
  const handleProceedToIssuance = async () => {
    if (!initialRequest) return;
    setSubmitting(true);
    try {
      const data = await createIssuance({ prodReqId: initialRequest.prodReqId });
      if (data?.success && data?.data) {
        router.push(`/production-quality?tab=issuance&issuance=${data.data.issuanceId}`);
        return;
      }
      toast.error(data?.message || "Failed to open material issuance.");
    } catch (err) {
      console.error("Failed to auto-open issuance session:", err);
      toast.error("Failed to open material issuance.");
    } finally {
      setSubmitting(false);
    }
  };

  // Start Production (Ready for Production / Materials Issued state)
  const handleStartProduction = async () => {
    if (!initialRequest) return;
    setSubmitting(true);
    try {
      const res = await actionResponse(
        productionCreateBatch({
          prodReqId: initialRequest.prodReqId,
          assignedCook: staff.username,
          notes: `Started from Request ${initialRequest.reqNumber}`,
        })
      );
      if (res.data?.success && res.data.data) {
        toast.success(`Production batch ${res.data.data.batchNumber} started!`);
        setConfirmStartProdOpen(false);
        if (res.data.data.batchId) {
          router.push(`/production-quality?tab=tracking&batch=${res.data.data.batchId}`);
        } else {
          router.push("/production-quality?tab=tracking");
        }
        router.refresh();
      } else {
        toast.error(res.data?.message || "Failed to start batch.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start batch.");
    } finally {
      setSubmitting(false);
    }
  };

  // Computed BOM display flags
  const hasExpiryColumn = useMemo(() => {
    return (lotSuggestions?.ingredients || []).some((ing: any) => {
      const r = (ing.lots || []).filter((l: any) => l.isReleased);
      const a = (ing.lots || []).filter((l: any) => Number(l.suggestedQuantity) > 0);
      return (initialRequest?.status === "Rejected" && r.length > 0 ? r : a).some((l: any) =>
        Boolean(l.expiryDate)
      );
    });
  }, [lotSuggestions, initialRequest?.status]);

  const ingredientCount = lotSuggestions?.ingredients?.length || 0;
  const shortfallCount = useMemo(
    () =>
      (lotSuggestions?.ingredients || []).filter(
        (ing) => ing.hasShortfall || ing.totalAvailable < ing.requiredQuantity
      ).length,
    [lotSuggestions]
  );

  const yieldUomDisplay = isViewMode
    ? initialRequest?.yieldUom || "units"
    : selectedRecipeObj?.yieldUom || "units";

  const formattedSchedule = requiredDate
    ? `${formatDisplayDate(requiredDate)} · ${formatTimeTo12Hour(requiredTime)}`
    : "—";

  const isReadyForProd =
    initialRequest?.status === "Ready for Production" ||
    initialRequest?.status === "Materials Issued";

  return (
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-4 animate-page-in text-ink">
      {/* Page Header: Back Breadcrumb + Title + Top-Right Action Buttons */}
      <div className="space-y-1.5">
        <Link
          href="/production-quality?tab=requests"
          className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Production Requests</span>
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="type-page-title text-ink">
                {isViewMode ? initialRequest?.reqNumber : "New Production Request"}
              </h1>
              {isViewMode && initialRequest && <StatusBadge status={initialRequest.status} />}
            </div>
            <p className="type-body-secondary text-ink-muted">
              {isViewMode && initialRequest
                ? `${initialRequest.productName} · ${initialRequest.variant || "Standard"} · Required ${formatDisplayDate(initialRequest.requiredDate)} at ${formatTimeTo12Hour(initialRequest.requiredTime)}`
                : "Configure product output, schedule, and review automated FEFO lot reservations before submitting for approval."}
            </p>
          </div>

          {/* Top-Right Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!isViewMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/production-quality?tab=requests")}
                  disabled={submitting}
                  className="rounded-control border border-border bg-surface px-4 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-10 cursor-pointer shadow-none"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handlePromptSubmit}
                  disabled={
                    submitting ||
                    !productId ||
                    !recipeId ||
                    !quantity ||
                    quantity <= 0 ||
                    !requiredDate ||
                    Boolean(timeError)
                  }
                  className="rounded-control bg-primary text-primary-foreground px-4 py-2 type-label-button hover:bg-primary-hover transition-colors shadow-none disabled:opacity-50 disabled:cursor-not-allowed h-10 cursor-pointer"
                >
                  {submitting
                    ? "Processing..."
                    : lotSuggestions?.hasAnyShortfall
                      ? "Create Purchase Requisition"
                      : "Submit for Approval"}
                </Button>
              </>
            ) : (
              <>
                {isAdmin && initialRequest?.status === "Pending Approval" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActionModal({ open: true, type: "reject" })}
                      disabled={submitting}
                      className="rounded-control border border-border bg-surface px-4 py-2 type-label-button text-status-red-fg hover:bg-subtle transition-colors h-10 cursor-pointer shadow-none"
                    >
                      Reject Request
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setActionModal({ open: true, type: "approve" })}
                      disabled={submitting}
                      className="rounded-control bg-primary text-primary-foreground px-4 py-2 type-label-button hover:bg-primary-hover transition-colors shadow-none h-10 cursor-pointer"
                    >
                      Approve Request
                    </Button>
                  </>
                )}

                {lotSuggestions?.hasAnyShortfall && !initialRequest?.linkedPrId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmCreatePrOpen(true)}
                    disabled={submitting}
                    className="rounded-control border border-border bg-surface px-4 py-2 type-label-button text-ink hover:bg-subtle transition-colors h-10 cursor-pointer shadow-none"
                  >
                    Create Purchase Requisition
                  </Button>
                )}

                {initialRequest?.status === "Approved" && (
                  <Button
                    type="button"
                    onClick={handleProceedToIssuance}
                    disabled={submitting}
                    className="rounded-control bg-primary text-primary-foreground px-4 py-2 type-label-button hover:bg-primary-hover transition-colors shadow-none h-10 cursor-pointer"
                  >
                    {submitting ? "Opening..." : "Proceed to Material Issuance"}
                  </Button>
                )}

                {isReadyForProd && (
                  <Button
                    type="button"
                    onClick={() => setConfirmStartProdOpen(true)}
                    disabled={submitting}
                    className="rounded-control bg-primary text-primary-foreground px-4 py-2 type-label-button hover:bg-primary-hover transition-colors shadow-none h-10 cursor-pointer"
                  >
                    Start Production
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status Notification Banners (View Mode) */}
      {isViewMode && initialRequest?.status === "Pending Approval" && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-inner border border-notice-warning-border bg-notice-warning-bg text-notice-warning-text">
          <Clock className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h2 className="type-body-strong">Pending Approval — Lots Reserved</h2>
            <p className="type-body-secondary">
              The ingredient lots shown below are actively reserved for this request and cannot be assigned to other production requests.
            </p>
          </div>
        </div>
      )}

      {isViewMode && initialRequest?.status === "Approved" && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-inner border border-status-green-fg/20 bg-status-green-bg/60 text-status-green-fg">
          <CheckCircle2 className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h2 className="type-body-strong">Production Request Approved &amp; Lots Finalized</h2>
            <p className="type-body-secondary">
              Approved by <strong className="font-semibold">{resolveStaffName(initialRequest.approvedBy) || "Admin"}</strong>
              {initialRequest.approvedAt ? ` on ${new Date(initialRequest.approvedAt).toLocaleDateString()}` : ""}.
              {" "}The reserved ingredient lots shown below are locked for this request and will be consumed upon Material Issuance.
            </p>
          </div>
        </div>
      )}

      {isViewMode && initialRequest?.status === "Rejected" && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-inner border border-notice-danger-border bg-notice-danger-bg text-notice-danger-text">
          <XCircle className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="type-body-strong">Production Request Rejected</h2>
            <p className="type-body-secondary">
              Rejected by <strong className="font-semibold">{resolveStaffName(initialRequest.rejectedBy) || "Admin"}</strong>
              {initialRequest.rejectedAt ? ` on ${new Date(initialRequest.rejectedAt).toLocaleDateString()}` : ""}.
              {initialRequest.rejectionReason && (
                <span> Reason: &quot;{initialRequest.rejectionReason}&quot;.</span>
              )}
            </p>
            <p className="type-caption font-medium">
              ✓ All reserved ingredient lots for this request have been released back to available inventory.
            </p>
          </div>
        </div>
      )}

      {/* Shortfall Warning Banner (Create & View) */}
      {lotSuggestions?.hasAnyShortfall && (
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-3.5 rounded-inner border border-notice-warning-border bg-notice-warning-bg text-notice-warning-text">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-[18px] h-[18px] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h2 className="type-body-strong">Material Shortfall Detected</h2>
              <p className="type-body-secondary">
                Available lot stock in inventory is insufficient for all required recipe ingredients. Submitting will generate a Purchase Requisition for the required shortfall quantities.
              </p>
            </div>
          </div>

          {isViewMode && !initialRequest?.linkedPrId && (
            <Button
              type="button"
              onClick={() => setConfirmCreatePrOpen(true)}
              disabled={submitting}
              className="rounded-control bg-primary text-primary-foreground hover:bg-primary-hover px-3.5 py-1.5 type-label-button-sm h-8 shrink-0 cursor-pointer shadow-none"
            >
              Create PR Now
            </Button>
          )}

          {isViewMode && initialRequest?.linkedPrId && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="type-caption font-semibold">
                PR: {initialRequest.linkedPrNumber}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPrSummaryData({ prNumber: initialRequest.linkedPrNumber })
                }
                className="type-caption h-7 rounded-control border-border bg-surface text-ink hover:bg-subtle cursor-pointer shadow-none"
              >
                View PR
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Top 2-Column Section: Request Details (Main) + Request Summary (360px Rail) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-stretch">
        {/* Card 1: Request Details (2-Column Form / Read-Only Details) */}
        <section className="rounded-card border border-border bg-surface px-5 py-[18px] flex flex-col gap-3.5">
          <div>
            <h2 className="type-card-title text-ink">Request Details</h2>
            {!isViewMode && (
              <p className="mt-0.5 type-caption text-ink-muted">
                Select the finished product, variant, recipe, and required production schedule.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-3.5">
            {/* 1. Finished Product */}
            <div className="space-y-1.5">
              <label className={`block ${isViewMode ? "type-caption font-medium text-ink-muted" : "type-label-field text-ink"}`}>
                Finished Product
              </label>
              {isViewMode ? (
                <div className="type-body font-medium text-ink">
                  {initialRequest?.productName || "—"}
                </div>
              ) : (
                <Select value={selectedProductName} onValueChange={handleProductSelect}>
                  <SelectTrigger className="w-full h-10 px-3 type-body rounded-control border-input bg-surface text-ink shadow-none">
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

            {/* 2. Variant */}
            <div className="space-y-1.5">
              <label className={`block ${isViewMode ? "type-caption font-medium text-ink-muted" : "type-label-field text-ink"}`}>
                Variant
              </label>
              {isViewMode ? (
                <div className="type-body font-medium text-ink">
                  {initialRequest?.variant || "Standard"}
                </div>
              ) : (
                <Select
                  value={selectedVariant}
                  onValueChange={handleVariantSelect}
                  disabled={!selectedProductName || availableVariants.length === 0}
                >
                  <SelectTrigger className="w-full h-10 px-3 type-body rounded-control border-input bg-surface text-ink shadow-none">
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

            {/* 3. Recipe / BOM */}
            <div className="space-y-1.5">
              <label className={`block ${isViewMode ? "type-caption font-medium text-ink-muted" : "type-label-field text-ink"}`}>
                Recipe / BOM
              </label>
              {isViewMode ? (
                <div className="type-body font-medium text-ink">
                  {initialRequest?.recipeName || "—"}
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
                  <SelectTrigger className="w-full h-10 px-3 type-body rounded-control border-input bg-surface text-ink shadow-none">
                    <SelectValue
                      placeholder={
                        !selectedProductName
                          ? "Select product first"
                          : !productId
                            ? "Select variant first"
                            : filteredRecipes.length === 0
                              ? "No active recipe for this variant"
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
                        No active recipe configured for this variant.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 4. Target Output Quantity */}
            <div className="space-y-1.5">
              <label className={`block ${isViewMode ? "type-caption font-medium text-ink-muted" : "type-label-field text-ink"}`}>
                Target Output Quantity
              </label>
              {isViewMode ? (
                <div className="type-body font-medium text-ink tabular-nums">
                  {initialRequest?.quantity} {initialRequest?.yieldUom}
                </div>
              ) : (
                <Input
                  type="text"
                  value={
                    recipeId && quantity > 0
                      ? `${quantity} ${yieldUomDisplay}`
                      : ""
                  }
                  readOnly
                  disabled
                  tabIndex={-1}
                  className="h-10 w-full rounded-control border-border bg-subtle px-3 py-2 type-body font-medium text-ink-secondary placeholder:font-normal placeholder:text-ink-muted cursor-not-allowed opacity-100 select-none shadow-none"
                  placeholder="Select recipe first"
                />
              )}
            </div>

            {/* 5. Priority Level */}
            <div className="space-y-1.5">
              <label className={`block ${isViewMode ? "type-caption font-medium text-ink-muted" : "type-label-field text-ink"}`}>
                Priority Level
              </label>
              {isViewMode ? (
                <div>
                  <PriorityPill priority={priority} />
                </div>
              ) : (
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger className="w-full h-10 px-3 type-body rounded-control border-input bg-surface text-ink shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    <SelectItem value="Low" className="type-body">Low</SelectItem>
                    <SelectItem value="Medium" className="type-body">Medium</SelectItem>
                    <SelectItem value="High" className="type-body">High</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 6. Required Date */}
            <div className="space-y-1.5">
              <label className={`block ${isViewMode ? "type-caption font-medium text-ink-muted" : "type-label-field text-ink"}`}>
                Required Date
              </label>
              {isViewMode ? (
                <div className="type-body font-medium text-ink">
                  {formatDisplayDate(initialRequest?.requiredDate)}
                </div>
              ) : (
                <div className="relative">
                  <Input
                    type="date"
                    min={today}
                    max={getMaxFutureDateString()}
                    value={requiredDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="h-10 w-full rounded-control border-input bg-surface px-3 pr-9 py-2 type-body text-ink shadow-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                </div>
              )}
            </div>

            {/* 7. Required Time (Clean single bordered control matching Required Date) */}
            <div className="space-y-1.5">
              <label className={`block ${isViewMode ? "type-caption font-medium text-ink-muted" : "type-label-field text-ink"}`}>
                Required Time
              </label>
              {isViewMode ? (
                <div className="type-body font-medium text-ink">
                  {formatTimeTo12Hour(initialRequest?.requiredTime || requiredTime)}
                </div>
              ) : (
                <div className="space-y-1">
                  <Popover open={timePopoverOpen} onOpenChange={setTimePopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Required Time"
                        className={`h-10 w-full rounded-control border ${
                          timeError ? "border-destructive" : "border-input"
                        } bg-surface px-3 flex items-center justify-between type-body text-ink hover:border-border-selected/60 focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer`}
                      >
                        <span className="tabular-nums">
                          {timeHour}:{timeMinute} {timePeriod}
                        </span>
                        <Clock className="h-4 w-4 text-ink-muted shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[260px] p-3 bg-surface border-border rounded-card shadow-modal space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="type-caption font-medium text-ink-muted">Select Time</span>
                        <span className="type-caption font-semibold text-primary tabular-nums">
                          {timeHour}:{timeMinute} {timePeriod}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {/* Hour */}
                        <div className="space-y-1">
                          <span className="block type-caption text-ink-muted">Hour</span>
                          <Select
                            value={timeHour}
                            onValueChange={(val) => updateTime(val, timeMinute, timePeriod)}
                          >
                            <SelectTrigger className="h-9 w-full rounded-control border-input bg-surface px-2 type-body-secondary text-ink shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-52 bg-surface border-border">
                              {HOURS_12.map((h) => {
                                const isPastHour =
                                  requiredDate === today &&
                                  convert12HTo24H(h, "59", timePeriod) < getCurrentTime24();
                                return (
                                  <SelectItem key={h} value={h} disabled={isPastHour} className="type-body-secondary">
                                    {h}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Minute */}
                        <div className="space-y-1">
                          <span className="block type-caption text-ink-muted">Minute</span>
                          <Select
                            value={timeMinute}
                            onValueChange={(val) => updateTime(timeHour, val, timePeriod)}
                          >
                            <SelectTrigger className="h-9 w-full rounded-control border-input bg-surface px-2 type-body-secondary text-ink shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-52 bg-surface border-border">
                              {Array.from(new Set([...MINUTES_OPTIONS, timeMinute]))
                                .sort((a, b) => Number(a) - Number(b))
                                .map((m) => {
                                  const isPastMinute =
                                    requiredDate === today &&
                                    convert12HTo24H(timeHour, m, timePeriod) < getCurrentTime24();
                                  return (
                                    <SelectItem key={m} value={m} disabled={isPastMinute} className="type-body-secondary">
                                      {m}
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Period */}
                        <div className="space-y-1">
                          <span className="block type-caption text-ink-muted">Period</span>
                          <Select
                            value={timePeriod}
                            onValueChange={(val: "AM" | "PM") => updateTime(timeHour, timeMinute, val)}
                          >
                            <SelectTrigger className="h-9 w-full rounded-control border-input bg-surface px-2 type-body-secondary text-ink shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-surface border-border">
                              <SelectItem
                                value="AM"
                                disabled={requiredDate === today && new Date().getHours() >= 12}
                                className="type-body-secondary"
                              >
                                AM
                              </SelectItem>
                              <SelectItem value="PM" className="type-body-secondary">
                                PM
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setTimePopoverOpen(false)}
                          className="h-8 rounded-control bg-primary text-primary-foreground hover:bg-primary-hover px-3 type-label-button-sm cursor-pointer shadow-none"
                        >
                          Done
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {timeError && (
                    <p role="alert" className="type-caption font-medium text-status-red-fg">
                      {timeError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 8. Reason / Batch Purpose */}
            <div className="space-y-1.5">
              <label className={`block ${isViewMode ? "type-caption font-medium text-ink-muted" : "type-label-field text-ink"}`}>
                Reason / Batch Purpose
              </label>
              {isViewMode ? (
                <div className="type-body font-medium text-ink">
                  {initialRequest?.reason || "Regular Stock Replenishment"}
                </div>
              ) : (
                <Select value={selectedReasonOption} onValueChange={setSelectedReasonOption}>
                  <SelectTrigger className="w-full h-10 px-3 type-body rounded-control border-input bg-surface text-ink shadow-none">
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
              )}
            </div>

            {/* Conditional Specify Other Reason (full width below Row 4) */}
            {!isViewMode && selectedReasonOption === "Other" && (
              <div className="sm:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="type-label-field text-ink">Specify Other Reason</label>
                  <span
                    className={`type-caption tabular-nums ${
                      customReason.length >= CUSTOM_REASON_MAX
                        ? "font-medium text-status-amber-fg"
                        : "text-ink-muted"
                    }`}
                  >
                    {customReason.length}/{CUSTOM_REASON_MAX}
                  </span>
                </div>
                <Input
                  type="text"
                  value={customReason}
                  maxLength={CUSTOM_REASON_MAX}
                  onChange={(e) => setCustomReason(e.target.value.slice(0, CUSTOM_REASON_MAX))}
                  placeholder="Specify other reason..."
                  className="h-10 px-3 type-body rounded-control border-input bg-surface text-ink shadow-none"
                />
              </div>
            )}
          </div>
        </section>

        {/* Card 2: Request Summary Rail (360px, read-only derived summary) */}
        <aside className="rounded-card border border-border bg-surface px-5 py-[18px] flex flex-col gap-3.5">
          <h2 className="type-card-title text-ink">Request Summary</h2>

          <div className="space-y-3">
            {isViewMode && initialRequest ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Request Number</span>
                  <span className="type-body-secondary font-semibold text-ink tabular-nums">
                    {initialRequest.reqNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Status</span>
                  <StatusBadge status={initialRequest.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Target Output</span>
                  <span className="type-body-secondary font-semibold text-ink tabular-nums">
                    {initialRequest.quantity} {initialRequest.yieldUom}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Priority</span>
                  <PriorityPill priority={priority} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Lot Reservation</span>
                  <span className="type-body-secondary font-medium text-ink">
                    {initialRequest.status === "Rejected"
                      ? "Released to Stock"
                      : initialRequest.status === "Approved"
                        ? "Confirmed & Locked"
                        : initialRequest.status === "Pending Approval"
                          ? "Reserved (Pending)"
                          : "Processed"}
                  </span>
                </div>

                <div className="h-px bg-divider my-1" />

                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Requested By</span>
                  <span className="type-body-secondary font-medium text-ink truncate">
                    {resolveStaffName(initialRequest.requestedBy) || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Submitted On</span>
                  <span className="type-body-secondary font-medium text-ink">
                    {formatDisplayDate(initialRequest.createdAt)}
                  </span>
                </div>
                {initialRequest.approvedBy && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="type-body-secondary text-ink-muted">Approved By</span>
                    <span className="type-body-secondary font-medium text-ink truncate">
                      {resolveStaffName(initialRequest.approvedBy)}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Finished Product</span>
                  <span className="type-body-secondary font-medium text-ink truncate max-w-[190px]">
                    {selectedProductName || "Not selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Variant</span>
                  <span className="type-body-secondary font-medium text-ink truncate max-w-[190px]">
                    {selectedVariant || "Not selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Recipe / BOM</span>
                  <span className="type-body-secondary font-medium text-ink truncate max-w-[190px]">
                    {selectedRecipeObj?.recipeName || "Not selected"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Target Output</span>
                  <span className="type-body-secondary font-semibold text-ink tabular-nums">
                    {recipeId && quantity > 0 ? `${quantity} ${yieldUomDisplay}` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Priority Level</span>
                  <PriorityPill priority={priority} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Required Schedule</span>
                  <span className="type-body-secondary font-medium text-ink tabular-nums">
                    {formattedSchedule}
                  </span>
                </div>

                <div className="h-px bg-divider my-1" />

                <div className="flex items-center justify-between gap-2">
                  <span className="type-body-secondary text-ink-muted">Material Readiness</span>
                  {!recipeId ? (
                    <span className="type-caption text-ink-muted">Select recipe</span>
                  ) : loadingSuggestions ? (
                    <span className="type-caption text-ink-muted animate-pulse">Checking...</span>
                  ) : lotSuggestions?.hasAnyShortfall ? (
                    <span className="inline-flex h-[22px] items-center rounded-pill px-2.5 type-badge bg-status-amber-bg text-status-amber-fg">
                      {shortfallCount} Shortfall
                    </span>
                  ) : ingredientCount > 0 ? (
                    <span className="inline-flex h-[22px] items-center rounded-pill px-2.5 type-badge bg-status-green-bg text-status-green-fg">
                      All {ingredientCount} Available
                    </span>
                  ) : (
                    <span className="type-caption text-ink-muted">—</span>
                  )}
                </div>

                <div className="rounded-control border border-ai-border bg-ai-panel px-3 py-2.5 type-caption text-ink-secondary leading-[16px]">
                  Submitting reserves the suggested FEFO lots and sends this request for Admin Approval.
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Full-Width Card 3: Bill of Materials & Lots */}
      <section className="rounded-card border border-border bg-surface px-5 py-[18px] space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="type-card-title text-ink">
              {isViewMode ? "Bill of Materials & Reserved Lots" : "Bill of Materials & Suggested Lots"}
            </h2>
            <p className="mt-0.5 type-caption text-ink-muted">
              {isViewMode
                ? "Inventory lots associated with this production request."
                : "Ingredients are automatically matched to earliest-expiring (FEFO) available inventory lots."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loadingSuggestions && (
              <span className="type-caption text-ink-muted animate-pulse">
                Calculating available lots...
              </span>
            )}
            {ingredientCount > 0 && (
              <span className="inline-flex h-[22px] items-center rounded-pill px-2.5 type-badge bg-status-gray-bg text-status-gray-fg tabular-nums">
                {ingredientCount} {ingredientCount === 1 ? "Ingredient" : "Ingredients"}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-inner border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[780px] text-left border-collapse">
              <thead className="bg-page border-b border-divider">
                <tr className="whitespace-nowrap">
                  <th className="py-2.5 px-3 type-table-header text-ink-muted text-left">Supply No.</th>
                  <th className="py-2.5 px-3 type-table-header text-ink-muted text-left">Ingredient Name</th>
                  <th className="py-2.5 px-3 type-table-header text-ink-muted text-left">Unit</th>
                  <th className="py-2.5 px-3 type-table-header text-ink-muted text-right">Required Qty</th>
                  <th className="py-2.5 px-3 type-table-header text-ink-muted text-right">Available</th>
                  <th className="py-2.5 px-3 type-table-header text-ink-muted text-left">
                    {isViewMode
                      ? initialRequest?.status === "Rejected"
                        ? "Released Lots"
                        : initialRequest?.status === "Approved"
                          ? "Confirmed Lots"
                          : "Reserved Lots"
                      : "Suggested Lots"}
                  </th>
                  {hasExpiryColumn && (
                    <th className="py-2.5 px-3 type-table-header text-ink-muted text-left">Expiry Date</th>
                  )}
                  <th className="py-2.5 px-3 type-table-header text-ink-muted text-center">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {(isViewMode || (productId && recipeId)) &&
                  lotSuggestions?.ingredients?.map((item) => {
                    const isRejected = initialRequest?.status === "Rejected";
                    const isApproved = initialRequest?.status === "Approved";
                    const isPending = initialRequest?.status === "Pending Approval";

                    const activeLots = (item.lots || []).filter((l: any) => Number(l.suggestedQuantity) > 0);
                    const releasedLots = (item.lots || []).filter((l: any) => l.isReleased);
                    const hasShortfall = item.hasShortfall || item.totalAvailable < item.requiredQuantity;

                    return (
                      <tr key={item.ingredientId} className="hover:bg-page/60 transition-colors">
                        <td className="py-3 px-3 type-table-cell font-semibold text-ink whitespace-nowrap tabular-nums">
                          {item.itemCode || "—"}
                        </td>
                        <td className="py-3 px-3 type-table-cell font-semibold text-ink">
                          {item.itemName}
                        </td>
                        <td className="py-3 px-3 type-table-cell text-ink-muted whitespace-nowrap">
                          {item.uomAbbr || "units"}
                        </td>
                        <td className="py-3 px-3 type-table-cell text-right font-semibold text-ink whitespace-nowrap tabular-nums">
                          {item.requiredQuantity.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 type-table-cell text-right font-semibold text-ink whitespace-nowrap tabular-nums">
                          {item.totalAvailable.toFixed(2)}
                        </td>

                        {/* Clean plain-text Lot Codes (no highlight pill, no duplicate required qty) */}
                        <td className="py-3 px-3 type-table-cell whitespace-nowrap">
                          {isRejected ? (
                            releasedLots.length > 0 ? (
                              <div className="space-y-1">
                                {releasedLots.map((l: any) => (
                                  <div
                                    key={l.lotId}
                                    className="type-table-cell font-medium text-ink-muted line-through tabular-nums"
                                  >
                                    {l.lotCode}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="type-table-cell text-ink-muted">None (Released)</span>
                            )
                          ) : activeLots.length > 0 ? (
                            <div className="space-y-1">
                              {activeLots.map((l) => (
                                <div
                                  key={l.lotId}
                                  className="type-table-cell font-medium text-ink tabular-nums"
                                >
                                  {l.lotCode}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="type-table-cell text-ink-muted">None</span>
                          )}
                        </td>

                        {hasExpiryColumn && (
                          <td className="py-3 px-3 type-table-cell text-ink-muted whitespace-nowrap tabular-nums">
                            {(isRejected && releasedLots.length > 0 ? releasedLots : activeLots).length > 0 ? (
                              <div className="space-y-1">
                                {(isRejected && releasedLots.length > 0 ? releasedLots : activeLots).map(
                                  (l: any) => (
                                    <div key={l.lotId}>
                                      {l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : "No Expiry"}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                        )}

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isRejected ? (
                            <StatusBadge status="Released">Released to Stock</StatusBadge>
                          ) : isApproved ? (
                            <StatusBadge status="Reserved">Reserved &amp; Confirmed</StatusBadge>
                          ) : isPending ? (
                            <StatusBadge status="Pending">Reserved (Pending)</StatusBadge>
                          ) : hasShortfall ? (
                            <StatusBadge status="Out of Stock">
                              Shortfall: {item.shortfallQuantity.toFixed(2)} {item.uomAbbr}
                            </StatusBadge>
                          ) : (
                            <StatusBadge status="Available">Available</StatusBadge>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {(!lotSuggestions ||
                  lotSuggestions.ingredients.length === 0 ||
                  (!isViewMode && (!productId || !recipeId))) && (
                  <tr>
                    <td
                      colSpan={hasExpiryColumn ? 8 : 7}
                      className="py-10 text-center type-body-secondary text-ink-muted"
                    >
                      {loadingSuggestions
                        ? "Calculating available lots..."
                        : "Select a product and recipe to preview bill of materials and suggested lots."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Admin Approve / Reject Confirmation Modal */}
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
        title={
          lotSuggestions?.hasAnyShortfall
            ? "Confirm Request & Create Requisition"
            : "Submit Production Request"
        }
        subtitle={`${selectedProductName || "Product"} (${selectedVariant || "Standard"}) • Target: ${quantity} ${yieldUomDisplay}`}
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

      {/* Start Production Confirmation Modal (View Mode) */}
      <ActionConfirmModal
        open={confirmStartProdOpen}
        title="Confirm Start Production"
        subtitle={initialRequest ? `Production Request No: ${initialRequest.reqNumber}` : undefined}
        description={
          initialRequest
            ? `Are you sure you want to start a kitchen production batch for ${initialRequest.productName} (${initialRequest.variant || "Standard"}) with a target output of ${initialRequest.quantity} ${initialRequest.yieldUom}?`
            : ""
        }
        confirmText="Start Production"
        loading={submitting}
        loadingText="Starting..."
        onConfirm={handleStartProduction}
        onClose={() => setConfirmStartProdOpen(false)}
      />

      {/* Linked PR Summary Modal */}
      <PrSummaryModal
        open={Boolean(prSummaryData)}
        onClose={() => setPrSummaryData(null)}
        prData={prSummaryData}
      />
    </div>
  );
}
