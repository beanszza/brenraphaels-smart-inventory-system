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
import { CheckCircle2, Package, AlertTriangle, ArrowLeft, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useIsAdmin, useStaff } from "@/context/StaffContext";
import { ProductionBatchEntity } from "./types";

import { BatchProofField } from "./BatchProofField";
import { getMaxFutureDateString } from "@/lib/date-limits";
import { resolveStaffName } from "@/lib/orders/dto";
import { getLotItemAbbreviation } from "@/lib/inventory/lot-code";

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
  const [selectedWorkflowStep, setSelectedWorkflowStep] = useState<0 | 1>(0);
  const [stageDate, setStageDate] = useState<string>(getTodayDateString());
  const initialCurTime = getCurrent12HourTime();
  const [stageHour, setStageHour] = useState<string>(initialCurTime.hour);
  const [stageMinute, setStageMinute] = useState<string>(initialCurTime.minute);
  const [stagePeriod, setStagePeriod] = useState<"AM" | "PM">(initialCurTime.period);
  const [stageNotes, setStageNotes] = useState<string>("");
  const [stageLoading, setStageLoading] = useState<boolean>(false);
  const [confirmStageModal, setConfirmStageModal] = useState<boolean>(false);

  // Packaging form state
  const [pkgDate, setPkgDate] = useState<string>(getTodayDateString());
  const [pkgHour, setPkgHour] = useState<string>(initialCurTime.hour);
  const [pkgMinute, setPkgMinute] = useState<string>(initialCurTime.minute);
  const [pkgPeriod, setPkgPeriod] = useState<"AM" | "PM">(initialCurTime.period);
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
    setBatch(null);
    setLoading(true);
    fetchBatchDetail();
    const cur = getCurrent12HourTime();
    setStageDate(getTodayDateString());
    setStageHour(cur.hour);
    setStageMinute(cur.minute);
    setStagePeriod(cur.period);
  }, [batchId]);

  const status = batch?.status || "In Production";

  // Parse stage logs from batch.notes
  const stageLogs = useMemo(() => {
    const sLogs: Record<string, { endTime: string; by: string; notes?: string }> = {};
    const notesStr = batch?.notes || "";
    const lines = notesStr.split("\n");

    for (const line of lines) {
      const stageMatch = line.match(/\[STAGE:([^|]+)\|END:([^|]+)\|BY:([^\]|]+)(?:\|NOTES:([^\]]+))?\]/);
      if (stageMatch) {
        const stageName = stageMatch[1].trim();
        if (COOKING_STAGES.includes(stageName as any)) {
          sLogs[stageName] = {
            endTime: stageMatch[2].trim(),
            by: stageMatch[3].trim(),
            notes: stageMatch[4]?.trim(),
          };
        }
      }
    }
    return sLogs;
  }, [batch?.notes]);

  // True ONLY if all 6 cooking stages have been recorded in stageLogs
  const allCookingStagesDone = useMemo(() => {
    return COOKING_STAGES.every((st) => Boolean(stageLogs[st]?.endTime));
  }, [stageLogs]);

  // Derive active cooking stage: sequentially find the FIRST cooking stage not yet logged
  const activeCookingStage = useMemo(() => {
    for (const st of COOKING_STAGES) {
      if (!stageLogs[st]?.endTime) {
        return st;
      }
    }
    return "Packaging";
  }, [stageLogs]);

  const currentStage = activeCookingStage;
  const currentCookingStageIndex = COOKING_STAGES.indexOf(activeCookingStage as any);

  // Determine if this batch has reached packaging lifecycle
  const isAtPackagingPhase = useMemo(() => {
    return (
      allCookingStagesDone ||
      batch?.currentStage === "Packaging" ||
      batch?.stage === "Packaging" ||
      status === "For QA" ||
      status === "For Stock-in" ||
      status === "Stocked In" ||
      status === "Completed"
    );
  }, [allCookingStagesDone, batch?.currentStage, batch?.stage, status]);

  // Synchronize default workflow tab with batch progression
  useEffect(() => {
    if (isAtPackagingPhase) {
      setSelectedWorkflowStep(1);
    } else {
      setSelectedWorkflowStep(0);
    }
  }, [isAtPackagingPhase]);

  const currentStepIndex = selectedWorkflowStep;
  const isCookingComplete = isAtPackagingPhase;

  const formattedStageEndTime = `${stageHour}:${stageMinute} ${stagePeriod}`;

    // Validate that completion date and time are not earlier than previous stage
  const validateStageDateTime = (): string | null => {
    const todayStr = getTodayDateString();
    if (!stageDate) {
      return "Please select a completion date.";
    }
    if (stageDate < todayStr) {
      return "Completion date cannot be in the past.";
    }

    const currentSelectedTimestamp = toTimestampFrom12H(stageDate, stageHour, stageMinute, stagePeriod);

    // Sequential stage check: completion cannot be earlier than previous stage!
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
      activeCookingStage && activeCookingStage !== "Packaging"
        ? activeCookingStage
        : COOKING_STAGES[0];

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
          <ArrowLeft className="w-3.5 h-3.5" />
          Go Back
        </Button>
      </div>
    );
  }

  const reqQty = batch.requestedQty || batch.estimatedQuantity || 0;
  const isRejected = batch.status === "Rejected";

  const isCookingPhase = currentStepIndex === 0 && !isRejected;
  const isPackagingActive =
    currentStepIndex === 1 &&
    isAtPackagingPhase &&
    status !== "For QA" &&
    status !== "For Stock-in" &&
    status !== "Stocked In" &&
    !isRejected;
  const isQaPhase = status === "For QA";
  const isPostQaPhase = status === "For Stock-in" || status === "Stocked In" || status === "Completed";
  const canReject = !isRejected && !isQaPhase && !isPostQaPhase;

  const startDateTime = batch.startedAt ? new Date(batch.startedAt) : null;
  const startDateFormatted = startDateTime
    ? startDateTime.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "—";
  const startTimeFormatted = startDateTime
    ? startDateTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "—";

  const itemAbbrev = getLotItemAbbreviation(batch.productName);
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const previewFgLotCode = batch.fgLotCode || `FG-${itemAbbrev}-${yy}${mm}${dd}-01`;

  return (
    <div className="space-y-5 min-w-0">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold rounded-xl border-border hover:bg-muted h-9 px-3 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Active Batches</span>
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <StatusBadge status={batch.status} />
          {batch.fgLotCode && (
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-md font-medium">
              Lot: {batch.fgLotCode}
            </span>
          )}
        </div>
      </div>

      {/* 2-Step Sequential Kitchen Stepper */}
      <div className="p-3.5 px-4 rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
            Workflow
          </span>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-3">
            {WORKFLOW_STEPS.map((step, idx) => {
              const isPast = isAtPackagingPhase && idx === 0;
              const isCurrentStep = selectedWorkflowStep === idx;
              const canClick = idx === 0 || isAtPackagingPhase;

              return (
                <React.Fragment key={step}>
                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => {
                      if (canClick) setSelectedWorkflowStep(idx as 0 | 1);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-xl transition-all text-left ${
                      canClick ? "cursor-pointer hover:bg-muted/40" : "cursor-not-allowed opacity-50"
                    }`}
                    title={!canClick ? "Complete all 6 kitchen production stages first" : undefined}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${
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
                  </button>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="w-12 h-0.5 bg-border rounded-full" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Execution View: 2 Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-3 gap-5 items-start">
        {/* Left Column: Interactive Stages / Actions (Expanded) */}
        <div className="xl:col-span-3 lg:col-span-2 space-y-6">
          {/* ── PHASE 1: COOKING WATERFALL STAGES ── */}
          {isCookingPhase && (
            <div className="p-5 rounded-2xl border border-border bg-card space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Kitchen Production Stages</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Follow sequential kitchen stages to produce the batch.
                  </p>
                </div>
              </div>

              {/* Waterfall Stages List */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Stages for this product
                </p>

                <div className="space-y-2.5">
                  {COOKING_STAGES.map((stName, idx) => {
                    const isDone = Boolean(stageLogs[stName]?.endTime);
                    const isCurrent = !isDone && activeCookingStage === stName && currentStepIndex === 0;

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
                            <span className="text-sm font-semibold text-muted-foreground">
                              {idx + 1}.
                            </span>
                            <span className="text-sm font-semibold text-foreground">{stName}</span>
                          </div>
                          <div>
                            {isDone ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span>Done</span>
                              </span>
                            ) : isCurrent ? (
                              <StatusBadge status="In Progress">Current Stage</StatusBadge>
                            ) : (
                              <span className="text-xs text-muted-foreground">• Waiting</span>
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
                                <div className="relative">
                                  <Input
                                    type="date"
                                    min={getTodayDateString()}
                                    max={getMaxFutureDateString()}
                                    value={stageDate}
                                    onChange={(e) => setStageDate(e.target.value)}
                                    className="h-10 w-full rounded-xl border-border bg-card px-3 pr-9 py-2 text-sm text-foreground [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                                  />
                                  <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                </div>
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
                                    className="text-xs font-medium text-primary hover:underline cursor-pointer"
                                  >
                                    Set to Now
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 h-10">
                                  {/* Hour Selector */}
                                  <select
                                    value={stageHour}
                                    onChange={(e) => setStageHour(e.target.value)}
                                    className="h-10 flex-1 px-3 text-sm border border-border rounded-xl bg-card text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                  >
                                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0")).map((h) => (
                                      <option key={h} value={h}>{h}</option>
                                    ))}
                                  </select>

                                  <span className="font-semibold text-muted-foreground text-sm shrink-0">:</span>

                                  {/* Minute Selector */}
                                  <select
                                    value={stageMinute}
                                    onChange={(e) => setStageMinute(e.target.value)}
                                    className="h-10 flex-1 px-3 text-sm border border-border rounded-xl bg-card text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
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
                                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
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
                                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
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
                                className="h-10 text-sm border-border bg-card rounded-xl px-3 text-foreground placeholder:text-muted-foreground"
                              />
                            </div>

                            {/* Bottom Controls with Live Validation Status */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/60">
                              <div className="text-xs text-muted-foreground">
                                {validateStageDateTime() && (
                                  <span className="text-destructive font-medium flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{validateStageDateTime()}</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-end">
                                {!isAdmin ? (
                                  <Button
                                    type="button"
                                    onClick={handleOpenCompleteModal}
                                    disabled={stageLoading || Boolean(validateStageDateTime())}
                                    className="h-10 px-5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
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

                {allCookingStagesDone && (
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span>All 6 kitchen production stages completed! Proceed to packaging.</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSelectedWorkflowStep(1)}
                      className="text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer"
                    >
                      Proceed to Packaging →
                    </Button>
                  </div>
                )}
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

              {/* A. Production Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">A. Production Information</h4>
                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">Batch No.</span>
                      <span className="text-sm font-semibold text-foreground">{batch.batchNumber}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">Product</span>
                      <span className="text-sm font-semibold text-foreground">{batch.productName}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">Product Variant</span>
                      <span className="text-sm font-semibold text-foreground">{batch.variant || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">Target Request Quantity</span>
                      <span className="text-sm font-semibold text-foreground">
                        {reqQty.toLocaleString()} {batch.yieldUom || "jars"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">Production Start Date</span>
                      <span className="text-sm font-semibold text-foreground">{startDateFormatted}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">Production Start Time</span>
                      <span className="text-sm font-semibold text-foreground">{startTimeFormatted}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">Requested By</span>
                      <span className="text-sm font-semibold text-foreground">
                        {resolveStaffName(batch.requestedBy) || batch.requestedBy || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">Approved By</span>
                      <span className="text-sm font-semibold text-foreground">
                        {resolveStaffName(batch.approvedBy) || batch.approvedBy || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* B. Packaging Schedule */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-foreground">B. Packaging Schedule</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Packaging Date */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Packaging Date <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type="date"
                        min={getTodayDateString()}
                        max={getMaxFutureDateString()}
                        value={pkgDate}
                        onChange={(e) => setPkgDate(e.target.value)}
                        className="h-10 w-full rounded-xl border-border bg-card px-3 pr-9 py-2 text-sm text-foreground [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                      />
                      <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Packaging Time (12-Hour) */}
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
                        className="text-xs font-medium text-primary hover:underline cursor-pointer"
                      >
                        Set to Now
                      </button>
                    </div>
                    <div className="flex items-center gap-2 h-10">
                      <select
                        value={pkgHour}
                        onChange={(e) => setPkgHour(e.target.value)}
                        className="h-10 flex-1 px-3 text-sm border border-border rounded-xl bg-card text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0")).map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>

                      <span className="font-bold text-muted-foreground text-sm shrink-0">:</span>

                      <select
                        value={pkgMinute}
                        onChange={(e) => setPkgMinute(e.target.value)}
                        className="h-10 flex-1 px-3 text-sm border border-border rounded-xl bg-card text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                      >
                        {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0")).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      <div className="flex rounded-xl border border-border p-1 bg-muted/40 h-10 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPkgPeriod("AM")}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
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
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
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

                  {/* Product Expiry Date */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Product Expiry Date <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type="date"
                        min={pkgDate || getTodayDateString()}
                        max={getMaxFutureDateString()}
                        value={pkgExpiryDate}
                        onChange={(e) => setPkgExpiryDate(e.target.value)}
                        className="h-10 w-full rounded-xl border-border bg-card px-3 pr-9 py-2 text-sm text-foreground [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                      />
                      <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Assigned Packer */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Assigned Packer <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      readOnly
                      disabled
                      value={packerDisplayName}
                      className="h-10 text-sm border-border bg-muted/40 text-foreground font-semibold rounded-xl px-3 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* C. Packaging Results */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-foreground">C. Packaging Results</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Actual Packed Quantity (pieces) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={pkgQuantity || ""}
                      onChange={(e) => setPkgQuantity(Number(e.target.value))}
                      className="h-10 text-sm border-border bg-card rounded-xl font-semibold px-3 text-foreground"
                    />
                    {reqQty > 0 && pkgQuantity > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Yield: {((pkgQuantity / reqQty) * 100).toFixed(1)}% of requested ({reqQty} pieces)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* D. Batch Registration & Quality Control */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-semibold text-foreground">D. Batch Registration & Quality Control</h4>

                {/* Finished Goods Lot No. */}
                <div className="space-y-1.5 max-w-sm">
                  <Label className="text-xs font-semibold text-foreground">
                    Finished Goods Lot No.
                  </Label>
                  <div className="h-10 px-3 rounded-xl border border-border bg-muted/30 flex items-center font-semibold text-sm text-foreground">
                    {previewFgLotCode}
                  </div>
                </div>

                {/* Proof of Packaging via FileUploadField */}
                <div>
                  <BatchProofField
                    batchId={batchId}
                    label="Proof of Packaging / Photo Verification *"
                    onChange={setPkgProofUrl}
                  />
                </div>

                {/* Packaging Remarks / Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Remarks / Notes</Label>
                  <Textarea
                    placeholder="Additional observations, packaging issues, or inspection findings..."
                    rows={2}
                    value={pkgNotes}
                    onChange={(e) => setPkgNotes(e.target.value)}
                    className="text-sm border-border bg-card rounded-xl text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Bottom Packaging Controls */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                {!isAdmin ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRejectModal(true)}
                      disabled={pkgLoading}
                      className="h-10 px-5 text-sm font-semibold border-destructive/40 text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer"
                    >
                      Reject Batch
                    </Button>
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
                      className="h-10 px-6 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Finish Packaging
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Admin View-Only Mode (Packaging operated by Head Cook)
                  </span>
                )}
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
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {batch.fgLotCode || "Pending"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Packed Quantity</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">
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
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {batch.expiryDate ? batch.expiryDate.slice(0, 10) : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Reserved Materials & BOM Verification */}
        <div className="xl:col-span-1 lg:col-span-1 space-y-6">
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Reserved Materials
              </h3>
              <span className="text-xs text-muted-foreground">
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
                      <p className="text-[10px] text-muted-foreground">
                        Lot: {m.lotCode}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-foreground text-xs">
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
          className="font-sans fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm Stage Completion"
            style={{ width: "100%", maxWidth: "440px" }}
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0 outline-none animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                Confirm Stage Completion
              </h2>
              <p className="text-xs font-semibold text-muted-foreground mb-3">
                Batch No: {batch.batchNumber}
              </p>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Are you sure you want to mark{" "}
                <strong className="text-foreground">
                  {activeCookingStage !== "Packaging" ? activeCookingStage : "Current Stage"}
                </strong>{" "}
                as complete on <strong className="text-foreground">{stageDate}</strong> at{" "}
                <strong className="text-foreground">{formattedStageEndTime}</strong>? This action cannot be reversed.
              </p>
              <div className="flex justify-center gap-3 w-full">
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
          className="font-sans fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm Packaging Finish"
            style={{ width: "100%", maxWidth: "440px" }}
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col p-6 text-foreground shrink-0 outline-none animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-foreground">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                Confirm Packaging Finish
              </h2>
              <p className="text-xs font-semibold text-muted-foreground mb-3">
                Batch No: {batch.batchNumber}
              </p>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Are you sure you want to finalize packaging of{" "}
                <strong className="text-foreground">
                  {pkgQuantity.toLocaleString()} {batch?.yieldUom || "jars"}
                </strong>
                ? This will register the Finished Goods lot and advance the batch to{" "}
                <strong className="text-foreground">Quality Assurance</strong>.
              </p>
              <div className="flex justify-center gap-3 w-full">
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
          className="font-sans fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
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
