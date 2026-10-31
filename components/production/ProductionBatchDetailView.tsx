"use client";
import { ProductionSkeleton } from "./ProductionSkeleton";
import { getBatch as productionGetBatch } from "@/app/actions/production/batch-detail";
import { completeBatchStage as productionCompleteBatchStage } from "@/app/actions/production/batch-stages-complete";
import { advanceBatchStage as productionAdvanceBatchStage } from "@/app/actions/production/batch-stage";
import { rejectBatch as productionRejectBatch } from "@/app/actions/production/batch-reject";
import { packageBatch as productionPackageBatch } from "@/app/actions/production/batch-packaging";
import { actionResponse } from "@/lib/resources/action-response";

import { StatusBadge } from "@/components/shared/StatusBadge";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Package, AlertTriangle, ArrowLeft, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useIsAdmin, useStaff } from "@/context/StaffContext";
import { ProductionBatchEntity } from "./types";

import { BatchProofField } from "./BatchProofField";

export const COOKING_STAGES = [
  "Steaming",
  "Peeling",
  "Grinding",
  "Mixing",
  "Cooking",
  "Cooling",
] as const;

export const WORKFLOW_STEPS = [
  "Production",
  "Packaging",
] as const;

export function formatTo12Hour(timeStr?: string): string {
  if (!timeStr) return "";
  if (/am|pm/i.test(timeStr)) return timeStr.toUpperCase();
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].slice(0, 2);
    if (isNaN(hours)) return timeStr;
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours.toString().padStart(2, "0")}:${minutes} ${period}`;
  }
  return timeStr;
}

export function getCurrent12HourTime(): { hour: string; minute: string; period: "AM" | "PM" } {
  const now = new Date();
  let hours = now.getHours();
  const period: "AM" | "PM" = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const minutes = now.getMinutes();
  return {
    hour: hours.toString().padStart(2, "0"),
    minute: minutes.toString().padStart(2, "0"),
    period,
  };
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toTimestampFrom12H(dateStr: string, hour12: string, minStr: string, period: "AM" | "PM"): number {
  let h = parseInt(hour12, 10);
  if (isNaN(h)) h = 8;
  h = h % 12;
  if (period === "PM") h += 12;
  const m = parseInt(minStr, 10) || 0;

  const [yearStr, monthStr, dayStr] = (dateStr || getTodayDateString()).split("-");
  const y = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10) - 1;
  const d = parseInt(dayStr, 10);
  const dt = new Date(y, mon, d, h, m, 0, 0);
  return dt.getTime();
}

export function parseStageLogToTimestamp(logTimeStr?: string, fallbackDateStr: string = getTodayDateString()): number | null {
  if (!logTimeStr) return null;
  const str = logTimeStr.trim();

  // 1. Match "YYYY-MM-DD HH:MM AM/PM" or "YYYY-MM-DD HH:MM"
  const fullMatch = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (fullMatch) {
    const [, datePart, hStr, mStr, period] = fullMatch;
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (period) {
      h = (h % 12) + (period.toUpperCase() === "PM" ? 12 : 0);
    }
    const [y, mon, d] = datePart.split("-").map(Number);
    const dateObj = new Date(y, mon - 1, d, h, m, 0, 0);
    return isNaN(dateObj.getTime()) ? null : dateObj.getTime();
  }

  // 2. Match "HH:MM AM/PM" or "HH:MM"
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (timeMatch) {
    const [, hStr, mStr, period] = timeMatch;
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (period) {
      h = (h % 12) + (period.toUpperCase() === "PM" ? 12 : 0);
    }
    const [y, mon, d] = fallbackDateStr.split("-").map(Number);
    const dateObj = new Date(y, mon - 1, d, h, m, 0, 0);
    return isNaN(dateObj.getTime()) ? null : dateObj.getTime();
  }

  // 3. Fallback standard Date parse
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed.getTime();
}

interface ProductionBatchDetailViewProps {
  batchId: number;
  onBack: () => void;
  currentUser?: string;
  onRefreshList?: () => void;
}

export default function ProductionBatchDetailView({
  batchId,
  onBack,
  currentUser = "Head Cook",
  onRefreshList,
}: ProductionBatchDetailViewProps) {
  const isAdmin = useIsAdmin();
  const staff = useStaff();
  const packerDisplayName = staff?.name || currentUser || "Bianca Dela Peña";

  const [mounted, setMounted] = useState<boolean>(false);
  const [batch, setBatch] = useState<ProductionBatchEntity | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Active cooking stage inputs (date and 12-hour time)
  const [stageDate, setStageDate] = useState<string>(getTodayDateString());
  const [stageHour, setStageHour] = useState<string>("08");
  const [stageMinute, setStageMinute] = useState<string>("00");
  const [stagePeriod, setStagePeriod] = useState<"AM" | "PM">("AM");
  const [stageNotes, setStageNotes] = useState<string>("");
  const [stageLoading, setStageLoading] = useState<boolean>(false);
  const [confirmStageModal, setConfirmStageModal] = useState<boolean>(false);

  // Packaging form state
  const [pkgDate, setPkgDate] = useState<string>(getTodayDateString());
  const [pkgHour, setPkgHour] = useState<string>("08");
  const [pkgMinute, setPkgMinute] = useState<string>("00");
  const [pkgPeriod, setPkgPeriod] = useState<"AM" | "PM">("AM");
  const [pkgExpiryDate, setPkgExpiryDate] = useState<string>("");
  const [pkgProofUrl, setPkgProofUrl] = useState<string>("");
  const [pkgQuantity, setPkgQuantity] = useState<number>(0);
  const [pkgNotes, setPkgNotes] = useState<string>("");
  const [pkgLoading, setPkgLoading] = useState<boolean>(false);
  const [confirmPackagingModal, setConfirmPackagingModal] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    setStageDate(getTodayDateString());
    setPkgDate(getTodayDateString());
    const cur = getCurrent12HourTime();
    setStageHour(cur.hour);
    setStageMinute(cur.minute);
    setStagePeriod(cur.period);
    setPkgHour(cur.hour);
    setPkgMinute(cur.minute);
    setPkgPeriod(cur.period);
  }, []);

  // Reject Batch modal state (Kitchen production only)
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [rejectCook, setRejectCook] = useState<string>(packerDisplayName);
  const [rejectProofUrl, setRejectProofUrl] = useState<string>("");
  const [rejectNotes, setRejectNotes] = useState<string>("");
  const [rejectLoading, setRejectLoading] = useState<boolean>(false);

  // Fetch single batch detail
  const fetchBatchDetail = async (isBackground = false) => {
    if (!isBackground && !batch) setLoading(true);
    try {
      const res = await actionResponse(productionGetBatch(batchId));
      if (res.data?.success && res.data.data) {
        const b = res.data.data;
        setBatch(b);

        // Prepopulate packaging defaults if empty
        if (!pkgQuantity && b.estimatedQuantity) {
          setPkgQuantity(b.estimatedQuantity);
        }
        if (!pkgExpiryDate) {
          const exp = new Date();
          exp.setFullYear(exp.getFullYear() + 1);
          setPkgExpiryDate(exp.toISOString().slice(0, 10));
        }
      } else {
        toast.error("Failed to load batch details.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error loading batch details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchDetail();
  }, [batchId]);

  // Derived current stage and step index
  const currentStage = batch?.currentStage || batch?.stage || "Steaming";
  const status = batch?.status || "In Production";

  // Parse stage logs from batch.notes
  const stageLogs = useMemo(() => {
    const sLogs: Record<string, { endTime: string; by: string; notes?: string }> = {};
    const notesStr = batch?.notes || "";
    const lines = notesStr.split("\n");

    for (const line of lines) {
      const stageMatch = line.match(/\[STAGE:([^|]+)\|END:([^|]+)\|BY:([^|\]]+)(?:\|NOTES:([^\]]+))?\]/);
      if (stageMatch) {
        sLogs[stageMatch[1]] = {
          endTime: stageMatch[2],
          by: stageMatch[3],
          notes: stageMatch[4],
        };
      }
    }
    return sLogs;
  }, [batch?.notes]);

  // Determine stage progression in cooking
  const currentCookingStageIndex = COOKING_STAGES.indexOf(currentStage as any);
  const isCookingComplete =
    currentCookingStageIndex === -1 &&
    (currentStage === "Packaging" || status === "For QA" || status === "For Stock-in" || status === "Stocked In");

  // Stepper current active index calculation for kitchen lifecycle:
  // 0: Production (Cooking Stages) | 1: Packaging
  const currentStepIndex = useMemo(() => {
    if (
      currentStage === "Packaging" ||
      status === "For QA" ||
      status === "For Stock-in" ||
      status === "Stocked In" ||
      status === "Completed"
    ) {
      return 1;
    }
    return 0;
  }, [status, currentStage]);

  const formattedStageEndTime = `${stageHour}:${stageMinute} ${stagePeriod}`;

  // Validate that completion date and time are not earlier than previous stage, nor in the past
  const validateStageDateTime = (): string | null => {
    const todayStr = getTodayDateString();
    if (!stageDate) {
      return "Please select a completion date.";
    }
    if (stageDate < todayStr) {
      return "Completion date cannot be in the past.";
    }

    const currentSelectedTimestamp = toTimestampFrom12H(stageDate, stageHour, stageMinute, stagePeriod);

    // 1. Sequential stage check: completion cannot be earlier than previous stage!
    if (currentCookingStageIndex > 0) {
      const prevStageName = COOKING_STAGES[currentCookingStageIndex - 1];
      const prevLog = stageLogs[prevStageName];
      if (prevLog?.endTime) {
        const prevTimestamp = parseStageLogToTimestamp(prevLog.endTime, stageDate);
        if (prevTimestamp && currentSelectedTimestamp < prevTimestamp) {
          return `Completion time cannot be earlier than previous stage (${prevStageName} completed on ${formatTo12Hour(prevLog.endTime)}).`;
        }
      }
    }

    // 2. Cannot be in the past for today's date
    if (stageDate === todayStr) {
      const now = new Date();
      let hour24 = parseInt(stageHour, 10) % 12;
      if (stagePeriod === "PM") hour24 += 12;
      const min = parseInt(stageMinute, 10);
      const curHour = now.getHours();
      const curMin = now.getMinutes();
      if (hour24 < curHour || (hour24 === curHour && min < curMin)) {
        const cur = getCurrent12HourTime();
        return `Completion time cannot be in the past for today (current time: ${cur.hour}:${cur.minute} ${cur.period}).`;
      }
    }

    return null;
  };

  // Validate packaging date and time: cannot be earlier than latest completed stage nor in past
  const validatePackagingDateTime = (): string | null => {
    const todayStr = getTodayDateString();
    if (!pkgDate) {
      return "Please select a packaging date.";
    }
    if (pkgDate < todayStr) {
      return "Packaging date cannot be in the past.";
    }

    const pkgTimestamp = toTimestampFrom12H(pkgDate, pkgHour, pkgMinute, pkgPeriod);

    // Find the latest completed cooking stage
    for (let i = COOKING_STAGES.length - 1; i >= 0; i--) {
      const stName = COOKING_STAGES[i];
      const log = stageLogs[stName];
      if (log?.endTime) {
        const stageEndTs = parseStageLogToTimestamp(log.endTime, pkgDate);
        if (stageEndTs && pkgTimestamp < stageEndTs) {
          return `Packaging time cannot be earlier than ${stName} completion (${formatTo12Hour(log.endTime)}).`;
        }
        break;
      }
    }

    // Cannot be in the past for today
    if (pkgDate === todayStr) {
      const now = new Date();
      let hour24 = parseInt(pkgHour, 10) % 12;
      if (pkgPeriod === "PM") hour24 += 12;
      const min = parseInt(pkgMinute, 10);
      const curHour = now.getHours();
      const curMin = now.getMinutes();
      if (hour24 < curHour || (hour24 === curHour && min < curMin)) {
        const cur = getCurrent12HourTime();
        return `Packaging time cannot be in the past for today (current time: ${cur.hour}:${cur.minute} ${cur.period}).`;
      }
    }

    return null;
  };

  const handleOpenCompleteModal = () => {
    const errorMsg = validateStageDateTime();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }
    setConfirmStageModal(true);
  };

  // Handle Complete Stage
  const handleCompleteCurrentStage = async () => {
    const stageToComplete =
      currentCookingStageIndex >= 0 ? COOKING_STAGES[currentCookingStageIndex] : COOKING_STAGES[0];

    const errorMsg = validateStageDateTime();
    if (errorMsg) {
      toast.error(errorMsg);
      setConfirmStageModal(false);
      return;
    }

    setStageLoading(true);
    try {
      const res = await actionResponse(productionCompleteBatchStage(batchId, {
        stage: stageToComplete,
        endDate: stageDate,
        endTime: formattedStageEndTime,
        notes: stageNotes,
        completedBy: packerDisplayName,
      }));

      if (res.data?.success) {
        toast.success(`Stage ${stageToComplete} completed successfully!`);
        setStageDate(getTodayDateString());
        const cur = getCurrent12HourTime();
        setStageHour(cur.hour);
        setStageMinute(cur.minute);
        setStagePeriod(cur.period);
        setStageNotes("");
        setConfirmStageModal(false);
        await fetchBatchDetail(true);
        if (onRefreshList) onRefreshList();
      } else {
        toast.error(res.data?.message || "Failed to complete stage.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "An error occurred.");
    } finally {
      setStageLoading(false);
    }
  };

  // Handle Advance Stage (for non-cooking advance if needed)
  const handleAdvanceStage = async () => {
    setStageLoading(true);
    try {
      const res = await actionResponse(productionAdvanceBatchStage(batchId));
      if (res.data?.success) {
        toast.success(res.data.message || "Stage advanced successfully!");
        await fetchBatchDetail(true);
        if (onRefreshList) onRefreshList();
      } else {
        toast.error(res.data?.message || "Failed to advance stage.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "An error occurred.");
    } finally {
      setStageLoading(false);
    }
  };

  // Handle Reject Batch (Kitchen production only)
  const handleRejectBatch = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejecting this batch.");
      return;
    }

    setRejectLoading(true);
    try {
      const res = await actionResponse(productionRejectBatch(batchId, {
        reason: rejectReason.trim(),
        assignedCook: rejectCook.trim(),
        proofImageUrl: rejectProofUrl.trim(),
        notes: rejectNotes.trim(),
      }));

      if (res.data?.success) {
        toast.error(`Batch rejected. Loss Report ${res.data.data.lossReportNumber} generated.`);
        setShowRejectModal(false);
        if (onRefreshList) onRefreshList();
        onBack();
      } else {
        toast.error(res.data?.message || "Failed to reject batch.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "An error occurred.");
    } finally {
      setRejectLoading(false);
    }
  };

  // Handle Finish Packaging
  const handleFinishPackaging = async () => {
    const pkgError = validatePackagingDateTime();
    if (pkgError) {
      toast.error(pkgError);
      return;
    }
    if (!pkgProofUrl.trim()) {
      toast.error("Proof of packaging photo is required.");
      return;
    }
    if (pkgQuantity <= 0) {
      toast.error("Please enter a valid packed quantity greater than zero.");
      return;
    }
    if (!pkgExpiryDate) {
      toast.error("Please enter the product expiry date.");
      return;
    }

    setPkgLoading(true);
    try {
      const pkgIsoDate = new Date(toTimestampFrom12H(pkgDate, pkgHour, pkgMinute, pkgPeriod)).toISOString();
      const res = await actionResponse(productionPackageBatch(batchId, {
        packageDate: pkgIsoDate,
        expiryDate: pkgExpiryDate,
        packedBy: packerDisplayName,
        proofImageUrl: pkgProofUrl.trim(),
        finalQuantity: pkgQuantity,
        notes: pkgNotes.trim(),
      }));

      if (res.data?.success) {
        toast.success(`Packaging completed! Lot ${res.data.data.fgLotCode} forwarded to QA.`);
        setConfirmPackagingModal(false);
        if (onRefreshList) onRefreshList();
        onBack();
      } else {
        toast.error(res.data?.message || "Failed to complete packaging.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "An error occurred.");
    } finally {
      setPkgLoading(false);
    }
  };

  if (loading && !batch) {
    return <ProductionSkeleton />;
  }

  if (!batch) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-border">
        <p className="text-sm text-destructive font-medium">Batch not found or failed to load.</p>
        <Button variant="outline" size="sm" onClick={onBack} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const reqQty = batch.requestedQty || batch.estimatedQuantity || 0;
  const isRejected = batch.status === "Rejected";

  const isCookingPhase = currentStepIndex === 0 && !isRejected;
  const isPackagingActive = currentStepIndex === 1 && currentStage === "Packaging" && status !== "For QA" && status !== "For Stock-in" && status !== "Stocked In" && !isRejected;
  const isQaPhase = status === "For QA";
  const isPostQaPhase = status === "For Stock-in" || status === "Stocked In" || status === "Completed";

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Active Batches
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="font-mono text-xs font-bold text-foreground">
            {batch.batchNumber}
          </span>
          <StatusBadge status={batch.status} />
          {batch.fgLotCode && (
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              Lot: {batch.fgLotCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Reject Batch Button (strictly visible during Production cooking stages only, NOT packaging) */}
          {isCookingPhase && !isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRejectModal(true)}
              className="text-xs font-semibold border-destructive/40 text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer"
            >
              Reject Batch
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fetchBatchDetail(true)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-foreground">{batch.productName}</h2>
              {batch.variant && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                  {batch.variant}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
              <span>Recipe: <strong className="text-foreground">{batch.recipeName}</strong></span>
              <span>•</span>
              <span>Request qty: <strong className="text-foreground">{reqQty.toLocaleString()} {batch.yieldUom || "units"}</strong></span>
              {batch.requestedBy && (
                <>
                  <span>•</span>
                  <span>Requested by <strong className="text-foreground">{batch.requestedBy}</strong></span>
                </>
              )}
              {batch.approvedBy && (
                <>
                  <span>•</span>
                  <span>Approved by <strong className="text-foreground">{batch.approvedBy}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2-Step Sequential Kitchen Stepper */}
        <div className="pt-2 border-t border-border">
          <p className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase mb-3">
            Workflow
          </p>
          <div className="flex items-center gap-3">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isPast = currentStepIndex > idx;
              const isCurrentStep = currentStepIndex === idx;

              return (
                <React.Fragment key={step}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isPast
                          ? "bg-primary text-primary-foreground"
                          : isCurrentStep
                          ? "bg-foreground text-background ring-2 ring-foreground/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isCurrentStep
                          ? "text-foreground font-bold"
                          : isPast
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60"
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="flex-1 max-w-[80px] h-0.5 bg-border rounded-full" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Execution View: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Stages / Actions (2 cols span) */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── PHASE 1: COOKING WATERFALL STAGES ── */}
          {isCookingPhase && (
            <div className="p-6 rounded-2xl border border-border bg-card space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Kitchen Production Stages</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Follow sequential kitchen stages to produce the batch.
                  </p>
                </div>
              </div>

              {/* Waterfall Stages List */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Stages for this product
                </p>

                <div className="space-y-2.5">
                  {COOKING_STAGES.map((stName, idx) => {
                    const isDone = Boolean(stageLogs[stName]?.endTime);
                    const isCurrent = currentStage === stName;

                    return (
                      <div
                        key={stName}
                        className={`p-4 rounded-xl border transition-all ${
                          isCurrent
                            ? "border-foreground bg-muted/20"
                            : isDone
                            ? "border-border bg-card"
                            : "border-border/60 bg-muted/10 opacity-70"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-muted-foreground">
                              {idx + 1}.
                            </span>
                            <span className="text-xs font-bold text-foreground">{stName}</span>
                          </div>
                          <div>
                            {isDone ? (
                              <span className="text-[11px] font-mono text-muted-foreground">
                                ✓ Done ({formatTo12Hour(stageLogs[stName].endTime)})
                              </span>
                            ) : isCurrent ? (
                              <StatusBadge status="In Progress">Current Stage</StatusBadge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">• Waiting</span>
                            )}
                          </div>
                        </div>

                        {/* Interactive inputs only for Current active stage */}
                        {isCurrent && (
                          <div className="mt-4 pt-4 border-t border-border/70 space-y-4 animate-in fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* 1. Dedicated Date Field */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-foreground">
                                  Completion Date <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                  type="date"
                                  min={getTodayDateString()}
                                  value={stageDate}
                                  onChange={(e) => setStageDate(e.target.value)}
                                  className="h-10 text-xs border-border bg-card rounded-xl font-mono px-3 text-foreground"
                                />
                              </div>

                              {/* 2. Dedicated Time Field (12-Hour) */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-semibold text-foreground">
                                    Completion Time (12-Hour) <span className="text-destructive">*</span>
                                  </Label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStageDate(getTodayDateString());
                                      const cur = getCurrent12HourTime();
                                      setStageHour(cur.hour);
                                      setStageMinute(cur.minute);
                                      setStagePeriod(cur.period);
                                    }}
                                    className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                                  >
                                    Set to Now
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 h-10">
                                  {/* Hour Selector */}
                                  <select
                                    value={stageHour}
                                    onChange={(e) => setStageHour(e.target.value)}
                                    className="h-10 flex-1 px-3 text-xs border border-border rounded-xl bg-card text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                  >
                                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0")).map((h) => (
                                      <option key={h} value={h}>{h}</option>
                                    ))}
                                  </select>

                                  <span className="font-bold text-muted-foreground text-sm shrink-0">:</span>

                                  {/* Minute Selector */}
                                  <select
                                    value={stageMinute}
                                    onChange={(e) => setStageMinute(e.target.value)}
                                    className="h-10 flex-1 px-3 text-xs border border-border rounded-xl bg-card text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                  >
                                    {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0")).map((m) => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>

                                  {/* AM / PM Segmented Control */}
                                  <div className="flex rounded-xl border border-border p-1 bg-muted/40 h-10 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setStagePeriod("AM")}
                                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                        stagePeriod === "AM"
                                          ? "bg-primary text-primary-foreground shadow-xs"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      AM
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setStagePeriod("PM")}
                                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                        stagePeriod === "PM"
                                          ? "bg-primary text-primary-foreground shadow-xs"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      PM
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 3. Stage Notes (Full Width) */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-foreground">
                                Stage Notes / Observations <span className="text-muted-foreground font-normal">(Optional)</span>
                              </Label>
                              <Input
                                placeholder="Chef observations, temperature, consistency..."
                                value={stageNotes}
                                onChange={(e) => setStageNotes(e.target.value)}
                                className="h-10 text-xs border-border bg-card rounded-xl text-foreground placeholder:text-muted-foreground"
                              />
                            </div>

                            {/* Bottom Controls with Live Validation Status */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/60">
                              <div className="text-xs text-muted-foreground">
                                {validateStageDateTime() ? (
                                  <span className="text-destructive font-medium flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{validateStageDateTime()}</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground flex items-center gap-1.5">
                                    <span>Recorded End:</span>
                                    <strong className="text-foreground font-mono">{stageDate} at {stageHour}:{stageMinute} {stagePeriod}</strong>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-end">
                                {!isAdmin ? (
                                  <Button
                                    type="button"
                                    onClick={handleOpenCompleteModal}
                                    disabled={stageLoading || Boolean(validateStageDateTime())}
                                    className="h-10 px-5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{stageLoading ? "Completing..." : `Complete ${stName}`}</span>
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">
                                    Admin View-Only Mode (Kitchen stages operated by Head Cook)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── PHASE 2: PACKAGING STAGE FORM ── */}
          {isPackagingActive && (
            <div className="p-6 rounded-2xl border border-border bg-card space-y-6 animate-in fade-in">
              <div>
                <h3 className="text-base font-bold text-foreground">Packaging Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Record packaging results, inspect final counts, and register Finished Goods lot.
                </p>
              </div>

              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Production Start Date</p>
                  <p className="text-xs font-bold text-foreground">
                    {batch.startedAt
                      ? new Date(batch.startedAt).toLocaleString("en-US", { hour12: true })
                      : new Date().toLocaleDateString()}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Target Request Quantity</p>
                  <p className="text-xs font-bold text-foreground">
                    {reqQty.toLocaleString()} {batch.yieldUom || "jars"}
                  </p>
                </div>
              </div>

              {/* Packaging Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Packaging Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Packaging Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    min={getTodayDateString()}
                    value={pkgDate}
                    onChange={(e) => setPkgDate(e.target.value)}
                    className="h-10 text-xs border-border bg-card rounded-xl font-mono px-3 text-foreground"
                  />
                </div>

                {/* 2. Packaging Time (12-Hour) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">
                      Packaging Time (12-Hour) <span className="text-destructive">*</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setPkgDate(getTodayDateString());
                        const cur = getCurrent12HourTime();
                        setPkgHour(cur.hour);
                        setPkgMinute(cur.minute);
                        setPkgPeriod(cur.period);
                      }}
                      className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                    >
                      Set to Now
                    </button>
                  </div>
                  <div className="flex items-center gap-2 h-10">
                    <select
                      value={pkgHour}
                      onChange={(e) => setPkgHour(e.target.value)}
                      className="h-10 flex-1 px-3 text-xs border border-border rounded-xl bg-card text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0")).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>

                    <span className="font-bold text-muted-foreground text-sm shrink-0">:</span>

                    <select
                      value={pkgMinute}
                      onChange={(e) => setPkgMinute(e.target.value)}
                      className="h-10 flex-1 px-3 text-xs border border-border rounded-xl bg-card text-foreground font-mono font-bold focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0")).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>

                    <div className="flex rounded-xl border border-border p-1 bg-muted/40 h-10 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPkgPeriod("AM")}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          pkgPeriod === "AM"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setPkgPeriod("PM")}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          pkgPeriod === "PM"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Product Expiry Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Product Expiry Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    min={pkgDate || getTodayDateString()}
                    value={pkgExpiryDate}
                    onChange={(e) => setPkgExpiryDate(e.target.value)}
                    className="h-10 text-xs border-border bg-card rounded-xl font-mono px-3 text-foreground"
                  />
                </div>

                {/* 4. Assigned to Pack (Packer) - Read-only display of Account Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Assigned to Pack (Packer) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    readOnly
                    disabled
                    value={packerDisplayName}
                    className="h-10 text-xs border-border bg-muted/40 text-foreground font-semibold rounded-xl px-3 cursor-not-allowed"
                  />
                </div>

                {/* 5. Packed Quantity */}
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Packed Quantity ({batch.yieldUom || "jars"}) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={pkgQuantity || ""}
                    onChange={(e) => setPkgQuantity(Number(e.target.value))}
                    className="h-10 text-xs border-border bg-card rounded-xl font-mono font-bold px-3 text-foreground max-w-sm"
                  />
                  {reqQty > 0 && pkgQuantity > 0 && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Yield: {((pkgQuantity / reqQty) * 100).toFixed(1)}% of requested ({reqQty} {batch.yieldUom || "jars"})
                    </p>
                  )}
                </div>

                {/* 6. Proof of Packaging via FileUploadField (same as delivery) */}
                <div className="sm:col-span-2">
                  <BatchProofField
                    batchId={batchId}
                    label="Proof of Packaging / Photo Verification *"
                    onChange={setPkgProofUrl}
                  />
                </div>

                {/* 7. Packaging Remarks */}
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Packaging Remarks (Optional)</Label>
                  <Textarea
                    placeholder="Packaging notes, cap condition, label alignment, seals..."
                    rows={2}
                    value={pkgNotes}
                    onChange={(e) => setPkgNotes(e.target.value)}
                    className="text-xs border-border bg-card rounded-xl text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Bottom Packaging Controls with Live Validation Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/60">
                <div className="text-xs text-muted-foreground">
                  {validatePackagingDateTime() ? (
                    <span className="text-destructive font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{validatePackagingDateTime()}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <span>Recorded Packaging:</span>
                      <strong className="text-foreground font-mono">{pkgDate} at {pkgHour}:{pkgMinute} {pkgPeriod}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  {!isAdmin ? (
                    <Button
                      type="button"
                      onClick={() => {
                        const err = validatePackagingDateTime();
                        if (err) {
                          toast.error(err);
                          return;
                        }
                        setConfirmPackagingModal(true);
                      }}
                      disabled={pkgLoading || Boolean(validatePackagingDateTime()) || !pkgProofUrl || pkgQuantity <= 0}
                      className="h-10 px-5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Finish Packaging & Send to QA</span>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      Admin View-Only Mode (Packaging operated by Head Cook)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PHASE 3: PACKAGING COMPLETED & SUBMITTED TO QA ── */}
          {(isQaPhase || isPostQaPhase) && (
            <div className="p-6 rounded-2xl border border-border bg-card space-y-5 animate-in fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Packaging Completed & Forwarded to QA
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Finished goods lot registered. Batch is awaiting Quality Assurance inspection.
                    </p>
                  </div>
                </div>
                <StatusBadge status={batch.status} />
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/20 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">Finished Lot</p>
                  <p className="text-xs font-bold font-mono text-foreground mt-0.5">
                    {batch.fgLotCode || "Pending"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Packed Quantity</p>
                  <p className="text-xs font-bold font-mono text-foreground mt-0.5">
                    {(batch.finalQuantity ?? batch.actualQuantity ?? 0).toLocaleString()} {batch.yieldUom || "jars"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Packaged By</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {batch.packagedBy || "Head Cook"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Expiry Date</p>
                  <p className="text-xs font-bold font-mono text-foreground mt-0.5">
                    {batch.expiryDate ? batch.expiryDate.slice(0, 10) : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Reserved Materials & BOM Verification */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Reserved Materials
              </h3>
              <span className="text-[11px] font-mono text-muted-foreground">
                BOM Verification
              </span>
            </div>

            <div className="space-y-2.5">
              {(batch.reservations && batch.reservations.length > 0
                ? batch.reservations
                : batch.consumptions || []
              ).map((m: any, idx: number) => (
                <div
                  key={m.reservationId || m.consumptionId || idx}
                  className="p-3 rounded-xl border border-border/80 bg-muted/10 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">{m.itemName}</p>
                    {m.lotCode && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Lot: {m.lotCode}
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-semibold text-foreground text-xs">
                    {Number(m.reservedQuantity ?? m.quantityUsed ?? m.requiredQuantity)} {m.uomAbbr || "kg"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Confirmation Modal: Complete Stage ── */}
      {mounted && confirmStageModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => { if (!stageLoading) setConfirmStageModal(false); }}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-6 text-foreground outline-none animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
                <AlertTriangle className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">
                Confirm Stage Completion
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to mark{" "}
                <strong className="text-foreground">
                  {currentCookingStageIndex >= 0 ? COOKING_STAGES[currentCookingStageIndex] : "Current Stage"}
                </strong>{" "}
                as complete on <strong className="text-foreground">{stageDate}</strong> at{" "}
                <strong className="text-foreground">{formattedStageEndTime}</strong>? This action cannot be reversed.
              </p>
              <div className="flex justify-center gap-3 w-full pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmStageModal(false)}
                  disabled={stageLoading}
                  className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCompleteCurrentStage}
                  disabled={stageLoading}
                  className="flex-1 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/85 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  {stageLoading ? "Confirming..." : "Confirm & Proceed"}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Confirmation Modal: Finish Packaging ── */}
      {mounted && confirmPackagingModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => { if (!pkgLoading) setConfirmPackagingModal(false); }}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-6 text-foreground outline-none animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
                <AlertTriangle className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">
                Confirm Packaging Finish
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to finalize packaging of{" "}
                <strong className="text-foreground">
                  {pkgQuantity.toLocaleString()} {batch?.yieldUom || "jars"}
                </strong>
                ? This will register the Finished Goods lot and advance the batch to{" "}
                <strong className="text-foreground">Quality Assurance</strong>.
              </p>
              <div className="flex justify-center gap-3 w-full pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmPackagingModal(false)}
                  disabled={pkgLoading}
                  className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleFinishPackaging}
                  disabled={pkgLoading}
                  className="flex-1 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/85 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  {pkgLoading ? "Submitting..." : "Confirm & Send to QA"}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Reject Batch Modal ── */}
      {mounted && showRejectModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => { if (!rejectLoading) setShowRejectModal(false); }}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-6 text-foreground outline-none animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">
                Reject Production Batch
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Record reason and details for batch rejection. A loss report will be generated.
              </p>

              <div className="space-y-3 w-full text-left mb-6">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Reason for Rejection <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g., Burned during cooking, foreign smell, broken seal"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="h-10 text-xs border-border bg-card rounded-xl text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Assigned Cook / In-Charge <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    readOnly
                    disabled
                    value={rejectCook}
                    className="h-10 text-xs border-border bg-muted/40 text-foreground font-semibold rounded-xl cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">Additional Notes</Label>
                  <Textarea
                    placeholder="Detailed notes regarding incident..."
                    rows={2}
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    className="text-xs border-border bg-card rounded-xl text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-center gap-3 w-full pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRejectModal(false)}
                  disabled={rejectLoading}
                  className="flex-1 px-5 py-2.5 text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleRejectBatch}
                  disabled={rejectLoading || !rejectReason.trim()}
                  className="flex-1 px-5 py-2.5 text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  {rejectLoading ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
