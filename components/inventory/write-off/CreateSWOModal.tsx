"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Plus,
  Trash2,
  Upload,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { useStaff } from "@/context/StaffContext";
import { inventory } from "@/lib/inventory/client";
import type { InventoryItem } from "@/components/inventory/types";
import type { LotItem } from "@/components/lots/types";
import {
  SWO_MAX_ITEMS,
  SWO_MAX_PHOTOS_PER_ITEM,
  SWO_REMARKS_MAX,
  SWO_OTHER_MAX,
  SWO_GENERAL_REMARKS_MAX,
  SWO_REASONS,
  SWO_DISPOSITIONS,
  validateSwoInput,
  hasAnySwoErrors,
  firstSwoErrorMessage,
  isCountUom,
  type SwoValidationErrors,
  type LotAvailabilityMap,
} from "@/lib/inventory/write-off-validation";
import { MAX_FILE_BYTES } from "@/lib/files";
import type {
  StockWriteOffDto,
  WriteOffFormData,
  WriteOffFormItemOption,
  WriteOffFormLotOption,
} from "./types";

interface DraftLotForm {
  lotId: number;
  quantity: string;
  reason: string;
  reasonOther: string;
  disposition: string;
  dispositionOther: string;
  remarks: string;
}

interface DraftPhotoFile {
  file: File;
  previewUrl: string;
}

interface DraftItemForm {
  itemType: string;
  itemKey: string;
  lots: DraftLotForm[];
  photos: DraftPhotoFile[];
  photoError?: string;
}

function createEmptyLot(): DraftLotForm {
  return {
    lotId: 0,
    quantity: "",
    reason: "",
    reasonOther: "",
    disposition: "",
    dispositionOther: "",
    remarks: "",
  };
}

function createEmptyItem(): DraftItemForm {
  return {
    itemType: "",
    itemKey: "",
    lots: [createEmptyLot()],
    photos: [],
  };
}

function buildFallbackFormData(
  initialLots: LotItem[],
  initialCategories: { categoryId: number; categoryName: string }[],
  initialWriteOffs: StockWriteOffDto[],
  initialInventories: InventoryItem[]
): WriteOffFormData {
  const year = new Date().getFullYear();
  let maxSeq = 0;
  for (const swo of initialWriteOffs) {
    const match = swo.swoNumber?.match(/SWO-\d{4}-(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  const nextSwoNumberPreview = `SWO-${year}-${String(maxSeq + 1).padStart(4, "0")}`;

  const pendingByLot = new Map<number, number>();
  for (const swo of initialWriteOffs) {
    if (swo.status === "Pending Approval" || swo.status === "Approved") {
      for (const item of swo.items) {
        for (const line of item.lines) {
          pendingByLot.set(
            line.lotId,
            (pendingByLot.get(line.lotId) || 0) + Number(line.quantity || 0)
          );
        }
      }
    }
  }

  const invByItemId = new Map<number, InventoryItem>();
  for (const inv of initialInventories) {
    invByItemId.set(inv.itemId, inv);
  }

  const itemTypesMap = new Map<string, boolean>();
  for (const cat of initialCategories) {
    if (cat.categoryName.toLowerCase().includes("finished")) continue;
    itemTypesMap.set(cat.categoryName, true);
  }
  for (const inv of initialInventories) {
    if (inv.categoryName && !inv.categoryName.toLowerCase().includes("finished")) {
      if (!itemTypesMap.has(inv.categoryName)) {
        itemTypesMap.set(inv.categoryName, true);
      }
    }
  }
  itemTypesMap.set("Finished Goods", true);

  const itemsMap = new Map<string, WriteOffFormItemOption>();
  const now = new Date();

  for (const lot of initialLots) {
    if (
      typeof lot.lotCode === "string" &&
      (lot.lotCode.startsWith("LOT-UJH-2026-") || lot.lotCode.startsWith("LOT-UBH-2026-"))
    ) {
      continue;
    }
    const remaining = Number(lot.quantityRemaining || 0);
    const reserved = Number(lot.reservedQuantity || 0);
    const pending = pendingByLot.get(lot.lotId) || 0;
    const available = Number(Math.max(0, remaining - reserved - pending).toFixed(3));
    if (available <= 0) continue;

    const inv = invByItemId.get(lot.itemId);
    const rawCat = inv?.categoryName || "Raw Materials";
    const isFinishedGood = rawCat.toLowerCase().includes("finished");
    const itemType = isFinishedGood ? "Finished Goods" : rawCat;
    const itemKey = `item:${lot.itemId}`;
    const uomName = lot.uomName || inv?.uomAbbreviation || inv?.uomName || "Unit";
    const itemCode = inv?.itemCode || `SPL-${String(lot.itemId).padStart(4, "0")}`;
    const displayLabel = lot.itemName;
    const expiryDate = lot.expiryDate || null;
    const isExpired = expiryDate ? new Date(expiryDate).getTime() < now.getTime() : false;

    const lotOpt: WriteOffFormLotOption = {
      lotId: lot.lotId,
      lotCode: lot.lotCode,
      itemId: lot.itemId,
      productId: null,
      variantName: "",
      expiryDate,
      quantityRemaining: remaining,
      reservedQuantity: reserved,
      pendingWriteOffQuantity: pending,
      availableQuantity: available,
      unitCost: Number(lot.unitCost || 0),
      uomId: 1,
      uomName,
      isExpired,
    };

    const existing = itemsMap.get(itemKey);
    if (existing) {
      existing.lots.push(lotOpt);
    } else {
      itemsMap.set(itemKey, {
        key: itemKey,
        itemId: lot.itemId,
        productId: null,
        itemType,
        itemName: lot.itemName,
        itemCode,
        variantName: "",
        displayLabel,
        uomId: 1,
        uomName,
        hasExpiry: Boolean(expiryDate),
        lots: [lotOpt],
      });
    }
  }

  return {
    nextSwoNumberPreview,
    itemTypes: Array.from(itemTypesMap.entries()).map(([name, hasExpiry]) => ({
      name,
      hasExpiry,
    })),
    items: Array.from(itemsMap.values()).sort((a, b) =>
      a.displayLabel.localeCompare(b.displayLabel)
    ),
  };
}

export interface CreateSWOFormProps {
  onClose: () => void;
  onSuccess: (message?: string) => void;
  initialWriteOffs?: StockWriteOffDto[];
  initialInventories?: InventoryItem[];
  initialLots?: LotItem[];
  initialCategories?: { categoryId: number; categoryName: string }[];
  embedded?: boolean;
}

export interface CreateSWOModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  initialWriteOffs?: StockWriteOffDto[];
  initialInventories?: InventoryItem[];
  initialLots?: LotItem[];
  initialCategories?: { categoryId: number; categoryName: string }[];
}

interface SWOFormBodyProps {
  active: boolean;
  variant: "page" | "modal";
  embedded?: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  initialWriteOffs?: StockWriteOffDto[];
  initialInventories?: InventoryItem[];
  initialLots?: LotItem[];
  initialCategories?: { categoryId: number; categoryName: string }[];
}

function SWOFormBody({
  active,
  variant,
  embedded = false,
  onClose,
  onSuccess,
  initialWriteOffs = [],
  initialInventories = [],
  initialLots = [],
  initialCategories = [],
}: SWOFormBodyProps) {
  const staff = useStaff();

  const fallbackFormData = useMemo(
    () =>
      buildFallbackFormData(
        initialLots,
        initialCategories,
        initialWriteOffs,
        initialInventories
      ),
    [initialLots, initialCategories, initialWriteOffs, initialInventories]
  );

  const [formData, setFormData] = useState<WriteOffFormData>(fallbackFormData);
  const [loadingData, setLoadingData] = useState(false);

  const [items, setItems] = useState<DraftItemForm[]>([createEmptyItem()]);
  const [generalRemarks, setGeneralRemarks] = useState("");
  const [errors, setErrors] = useState<SwoValidationErrors>({ items: {} });
  const [submitBannerError, setSubmitBannerError] = useState("");
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requestDateDisplay = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    []
  );

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData(fallbackFormData);
    setItems([createEmptyItem()]);
    setGeneralRemarks("");
    setErrors({ items: {} });
    setSubmitBannerError("");
    setLoadingData(true);

    inventory
      .getWriteOffFormData()
      .then((res) => {
        if (!mounted) return;
        if (res.data?.success && res.data.data) {
          setFormData(res.data.data);
        }
      })
      .catch(() => {
        // Fallback data from page props is already populated
      })
      .finally(() => {
        if (mounted) setLoadingData(false);
      });

    return () => {
      mounted = false;
    };
  }, [active, fallbackFormData]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((it) => it.photos.forEach((p) => URL.revokeObjectURL(p.previewUrl)));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemsByKey = useMemo(() => {
    const map = new Map<string, WriteOffFormItemOption>();
    (formData?.items || []).forEach((it) => map.set(it.key, it));
    return map;
  }, [formData]);

  const lotMapForValidation = useMemo<LotAvailabilityMap>(() => {
    const map: LotAvailabilityMap = {};
    (formData?.items || []).forEach((it) => {
      it.lots.forEach((l) => {
        map[l.lotId] = {
          availableQuantity: l.availableQuantity,
          uomName: l.uomName,
          lotCode: l.lotCode,
          itemId: l.itemId,
          productId: l.productId,
        };
      });
    });
    return map;
  }, [formData]);

  const selectedLotIds = useMemo(() => {
    const set = new Set<number>();
    items.forEach((it) =>
      it.lots.forEach((l) => {
        if (l.lotId > 0) set.add(l.lotId);
      })
    );
    return set;
  }, [items]);

  const buildPayload = () => ({
    generalRemarks: generalRemarks.trim() || null,
    items: items.map((it) => {
      const opt = itemsByKey.get(it.itemKey);
      return {
        itemType: it.itemType,
        itemId: opt?.itemId ?? 0,
        productId: opt?.productId ?? null,
        lots: it.lots.map((l) => ({
          lotId: Number(l.lotId) || 0,
          quantity: Number(l.quantity),
          reason: l.reason,
          reasonOther: l.reason === "Other" ? l.reasonOther : null,
          disposition: l.disposition,
          dispositionOther: l.disposition === "Other" ? l.dispositionOther : null,
          remarks: l.remarks,
        })),
      };
    }),
  });

  const handleItemTypeChange = (itemIdx: number, newType: string) => {
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === itemIdx
          ? {
              ...it,
              itemType: newType,
              itemKey: "",
              lots: [createEmptyLot()],
            }
          : it
      )
    );
    setSubmitBannerError("");
  };

  const handleItemKeyChange = (itemIdx: number, newKey: string) => {
    const itemOpt = itemsByKey.get(newKey);
    const firstAvailableLot = itemOpt?.lots.find((l) => !selectedLotIds.has(l.lotId));
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === itemIdx
          ? {
              ...it,
              itemKey: newKey,
              lots: [
                {
                  ...createEmptyLot(),
                  lotId: firstAvailableLot?.lotId ?? 0,
                  reason: firstAvailableLot?.isExpired ? "Expired" : "",
                },
              ],
            }
          : it
      )
    );
    setSubmitBannerError("");
  };

  const handleAddItem = () => {
    if (items.length >= SWO_MAX_ITEMS) return;
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (itemIdx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => {
      const removed = prev[itemIdx];
      removed?.photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return prev.filter((_, idx) => idx !== itemIdx);
    });
  };

  const handleLotChange = (
    itemIdx: number,
    lotIdx: number,
    patch: Partial<DraftLotForm>
  ) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        const nextLots = it.lots.map((lot, lIdx) =>
          lIdx === lotIdx ? { ...lot, ...patch } : lot
        );
        return { ...it, lots: nextLots };
      })
    );
    setSubmitBannerError("");
  };

  const handlePhotoUploadChange = (
    itemIdx: number,
    fileList: FileList | null
  ) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        let photoError = "";
        const nextPhotos = [...it.photos];
        for (const f of files) {
          if (nextPhotos.length >= SWO_MAX_PHOTOS_PER_ITEM) {
            photoError = `Maximum of ${SWO_MAX_PHOTOS_PER_ITEM} photos per item allowed.`;
            break;
          }
          const ct = (f.type || "").toLowerCase();
          if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(ct)) {
            photoError = "Only JPG, PNG, or WebP image files are allowed.";
            continue;
          }
          if (f.size <= 0 || f.size > MAX_FILE_BYTES) {
            photoError = "Each photo must be 10 MB or smaller.";
            continue;
          }
          nextPhotos.push({
            file: f,
            previewUrl: URL.createObjectURL(f),
          });
        }
        return { ...it, photos: nextPhotos, photoError };
      })
    );
  };

  const handleRemovePhoto = (itemIdx: number, photoIdx: number) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        const target = it.photos[photoIdx];
        if (target) URL.revokeObjectURL(target.previewUrl);
        return {
          ...it,
          photos: it.photos.filter((_, pIdx) => pIdx !== photoIdx),
          photoError: "",
        };
      })
    );
  };

  const runValidation = (): boolean => {
    const payload = buildPayload();
    const validation = validateSwoInput(payload, lotMapForValidation);
    setErrors(validation);
    if (hasAnySwoErrors(validation)) {
      const msg =
        firstSwoErrorMessage(validation) ||
        "Please fix the highlighted errors before submitting.";
      setSubmitBannerError(msg);
      toast.error(msg);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return false;
    }
    setSubmitBannerError("");
    return true;
  };

  const executeCreate = async () => {
    if (!runValidation()) return;
    setSubmitting(true);
    setSubmitBannerError("");
    try {
      const payload = buildPayload();
      const res = await inventory.createWriteOff(payload);
      if (!res.data?.success || !res.data.data) {
        const msg =
          res.data?.message || "Unable to submit the Stock Write-Off request.";
        setSubmitBannerError(msg);
        toast.error(msg);
        return;
      }

      const createdSwo = res.data.data;

      // Upload optional supporting photos per item if any were attached
      let failedPhotos = 0;
      for (let i = 0; i < items.length; i++) {
        const draftItem = items[i];
        const savedItem = createdSwo.items[i];
        if (!savedItem || draftItem.photos.length === 0) continue;
        for (const photo of draftItem.photos) {
          try {
            const fd = new FormData();
            fd.append("file", photo.file);
            const upRes = await inventory.uploadWriteOffPhotoDirect(
              savedItem.writeOffItemId,
              fd
            );
            if (!upRes.data?.success) {
              failedPhotos++;
            }
          } catch {
            failedPhotos++;
          }
        }
      }

      const successMessage =
        failedPhotos > 0
          ? `Stock Write-Off ${createdSwo.swoNumber} submitted for approval (${failedPhotos} photo(s) could not be uploaded).`
          : `Stock Write-Off ${createdSwo.swoNumber} submitted for approval.`;
      onSuccess(successMessage);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : "Unable to submit Stock Write-Off request.");
      setSubmitBannerError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestCancel = () => {
    if (variant === "modal") {
      onClose();
      return;
    }
    setConfirmDiscardOpen(true);
  };

  // Summary metrics derived live from current form state
  const totalLotsCount = items.reduce((acc, it) => acc + it.lots.length, 0);
  const configuredItemsCount = items.filter((it) => Boolean(it.itemKey)).length;
  const selectedLotsCount = items.reduce(
    (acc, it) => acc + it.lots.filter((l) => Number(l.lotId) > 0).length,
    0
  );
  const totalPhotosCount = items.reduce((acc, it) => acc + it.photos.length, 0);

  const summaryReasons = useMemo(() => {
    const list = Array.from(
      new Set(
        items
          .flatMap((it) =>
            it.lots.map((l) =>
              l.reason === "Other" && l.reasonOther.trim()
                ? `Other (${l.reasonOther.trim()})`
                : l.reason
            )
          )
          .filter(Boolean)
      )
    );
    return list;
  }, [items]);

  const summaryDispositions = useMemo(() => {
    const list = Array.from(
      new Set(
        items
          .flatMap((it) =>
            it.lots.map((l) =>
              l.disposition === "Other" && l.dispositionOther.trim()
                ? `Other (${l.dispositionOther.trim()})`
                : l.disposition
            )
          )
          .filter(Boolean)
      )
    );
    return list;
  }, [items]);

  const summaryTotalLabel = useMemo(() => {
    const validQtyRows = items
      .map((it) => {
        const opt = itemsByKey.get(it.itemKey);
        const lot = it.lots[0];
        const q = Number(lot?.quantity);
        if (!opt || !Number.isFinite(q) || q <= 0) return null;
        return { qty: q, uom: opt.uomName };
      })
      .filter((x): x is { qty: number; uom: string } => Boolean(x));

    const itemCount = configuredItemsCount || items.length;
    const itemWord = itemCount === 1 ? "item" : "items";
    if (validQtyRows.length === 1) {
      return `${itemCount} ${itemWord} (${validQtyRows[0].qty.toLocaleString()} ${validQtyRows[0].uom})`;
    }
    if (validQtyRows.length > 1) {
      const sameUom = validQtyRows.every((r) => r.uom === validQtyRows[0].uom);
      if (sameUom) {
        const sum = validQtyRows.reduce((s, r) => s + r.qty, 0);
        return `${itemCount} ${itemWord} (${sum.toLocaleString()} ${validQtyRows[0].uom})`;
      }
    }
    return `${configuredItemsCount} ${configuredItemsCount === 1 ? "item" : "items"}`;
  }, [items, itemsByKey, configuredItemsCount]);

  const fmtDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const swoPreviewNumber = formData?.nextSwoNumberPreview || "SWO-2026-0001";

  const containerClasses =
    variant === "page"
      ? embedded
        ? "space-y-5 pb-10 animate-page-in"
        : "page-container px-4 sm:px-8 w-full space-y-5 pb-10 animate-page-in"
      : "space-y-5";

  return (
    <>
      <div className={containerClasses}>
        {/* Top Back Link, Page Title & Top-Right Action Buttons (Page Mode) */}
        {variant === "page" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleRequestCancel}
              className="inline-flex items-center gap-1 type-breadcrumb text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Stock write-offs</span>
            </button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h1 className="type-page-title text-ink">New stock write-off</h1>
                <p className="type-body text-ink-muted">
                  Record expired, damaged, spoiled, or lost inventory items per batch / lot for approval.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRequestCancel}
                  disabled={submitting}
                  className="rounded-control border border-border bg-surface px-4 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={submitting || loadingData}
                  onClick={() => {
                    if (runValidation()) {
                      setConfirmSubmitOpen(true);
                    }
                  }}
                  className="rounded-control bg-primary text-on-brand px-4 h-9 type-label-button hover:bg-primary-hover shadow-none disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit for Approval"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Submit / Validation Error Banner */}
        {submitBannerError && (
          <div
            role="alert"
            className="rounded-inner border border-notice-danger-border bg-notice-danger-bg p-3.5 type-body-secondary font-medium text-notice-danger-text flex items-center justify-between gap-2 animate-in fade-in-50"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitBannerError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitBannerError("")}
              className="type-caption font-semibold underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main 2-Column Layout (Matching Figma Stock Write-Off · Redesign & PR Redesign) */}
        <div
          className={
            variant === "page"
              ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start"
              : "space-y-5"
          }
        >
          {/* Left Column: Write-off details, Write-off items, General remarks */}
          <div className="min-w-0 space-y-5">
            {/* Card 1: Write-off details */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-4">
              <h2 className="type-subsection text-ink">Write-off details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                    Write-Off Number
                  </label>
                  <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary select-all tabular-nums">
                    {swoPreviewNumber}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                    Request Date
                  </label>
                  <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary">
                    {requestDateDisplay}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                    Requested By
                  </label>
                  <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary select-none truncate">
                    {staff.name || staff.username}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Write-off items */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="type-subsection text-ink">
                    Write-off items <span className="text-destructive">*</span>
                  </h2>
                  <p className="mt-0.5 type-caption text-ink-muted">
                    Select inventory items, batch / lot, and condition to write off (up to {SWO_MAX_ITEMS} items per request).
                  </p>
                </div>
                <span className="type-caption font-medium text-ink-muted tabular-nums whitespace-nowrap">
                  {items.length} / {SWO_MAX_ITEMS} {items.length === 1 ? "item" : "items"} · {totalLotsCount} {totalLotsCount === 1 ? "lot" : "lots"}
                </span>
              </div>

              {errors.formError && (
                <p className="type-caption font-medium text-destructive">{errors.formError}</p>
              )}

              <div className="space-y-4">
                {items.map((draftItem, itemIdx) => {
                  const itemErr = errors.items[itemIdx] || { lots: {} };
                  const selectedItemOpt = itemsByKey.get(draftItem.itemKey);
                  const isFinishedGood =
                    draftItem.itemType.trim().toLowerCase() === "finished goods" ||
                    draftItem.itemType.trim().toLowerCase() === "finished product" ||
                    Boolean(selectedItemOpt?.productId);
                  const hasExpiry = selectedItemOpt
                    ? selectedItemOpt.hasExpiry
                    : formData?.itemTypes.find((t) => t.name === draftItem.itemType)?.hasExpiry ?? true;

                  const itemsForSelectedType = (formData?.items || []).filter(
                    (it) =>
                      draftItem.itemType &&
                      it.itemType.toLowerCase() === draftItem.itemType.toLowerCase()
                  );

                  const draftLot = draftItem.lots[0] || createEmptyLot();
                  const lotIdx = 0;
                  const lotErr = itemErr.lots?.[0] || {};
                  const lotOptions: WriteOffFormLotOption[] = selectedItemOpt?.lots || [];
                  const selectedLotOpt = lotOptions.find(
                    (l) => l.lotId === Number(draftLot.lotId)
                  );

                  const numericQty = Number(draftLot.quantity);
                  const liveExceedsAvailable =
                    selectedLotOpt &&
                    draftLot.quantity.trim() !== "" &&
                    Number.isFinite(numericQty) &&
                    numericQty > selectedLotOpt.availableQuantity + 1e-9;
                  const liveCountUomError =
                    selectedLotOpt &&
                    draftLot.quantity.trim() !== "" &&
                    Number.isFinite(numericQty) &&
                    isCountUom(selectedLotOpt.uomName) &&
                    !Number.isInteger(numericQty);

                  const quantityErrorMsg = liveExceedsAvailable
                    ? `Affected quantity (${numericQty}) cannot exceed available lot quantity (${selectedLotOpt.availableQuantity} ${selectedLotOpt.uomName}).`
                    : liveCountUomError
                    ? `Quantity for ${selectedLotOpt.uomName} must be a whole number.`
                    : lotErr.quantity;

                  const showExpiryField =
                    hasExpiry && (!selectedLotOpt || Boolean(selectedLotOpt.expiryDate));

                  return (
                    <div
                      key={itemIdx}
                      className="rounded-inner border border-border bg-surface p-4 space-y-3.5"
                    >
                      {/* Item Sub-Card Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-divider">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-status-purple-bg text-primary type-badge-compact font-semibold">
                            Item {itemIdx + 1}
                          </span>
                          {selectedItemOpt && (
                            <span className="type-caption font-medium text-ink-secondary truncate">
                              {selectedItemOpt.displayLabel}
                              {selectedLotOpt ? ` · ${selectedLotOpt.lotCode}` : ""}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {selectedLotOpt?.isExpired && (
                            <span className="type-badge-compact font-semibold text-destructive">
                              Expired lot
                            </span>
                          )}
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(itemIdx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control border border-border type-caption font-medium text-destructive hover:bg-notice-danger-bg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Row 1: Item Type, Item Name, (Unit of Measurement for non-finished goods) */}
                      <div
                        className={`grid grid-cols-1 ${
                          isFinishedGood ? "sm:grid-cols-2" : "sm:grid-cols-3"
                        } gap-3`}
                      >
                        {/* Item Type */}
                        <div className="min-w-0">
                          <label
                            className={`mb-1.5 block type-label-field ${
                              itemErr.itemType ? "text-destructive" : "text-ink"
                            }`}
                          >
                            Item Type <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <select
                              aria-label={`Item ${itemIdx + 1} type`}
                              value={draftItem.itemType}
                              onChange={(e) => handleItemTypeChange(itemIdx, e.target.value)}
                              className={`w-full h-9 appearance-none rounded-control border bg-surface pl-3 pr-8 type-body-secondary ${
                                draftItem.itemType ? "text-ink" : "text-ink-muted"
                              } focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none cursor-pointer transition-colors truncate ${
                                itemErr.itemType ? "border-destructive" : "border-border"
                              }`}
                            >
                              <option value="">Select item type</option>
                              {(formData?.itemTypes || []).map((t) => (
                                <option key={t.name} value={t.name}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                          </div>
                          {itemErr.itemType && (
                            <p className="mt-1 type-caption text-destructive font-medium">
                              {itemErr.itemType}
                            </p>
                          )}
                        </div>

                        {/* Item Name */}
                        <div className="min-w-0">
                          <label
                            className={`mb-1.5 block type-label-field ${
                              itemErr.itemId ? "text-destructive" : "text-ink"
                            }`}
                          >
                            Item Name <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <select
                              aria-label={`Item ${itemIdx + 1} name`}
                              value={draftItem.itemKey}
                              disabled={!draftItem.itemType}
                              onChange={(e) => handleItemKeyChange(itemIdx, e.target.value)}
                              className={`w-full h-9 appearance-none rounded-control border bg-surface pl-3 pr-8 type-body-secondary ${
                                draftItem.itemKey ? "text-ink" : "text-ink-muted"
                              } focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors truncate ${
                                itemErr.itemId ? "border-destructive" : "border-border"
                              }`}
                            >
                              <option value="">
                                {!draftItem.itemType
                                  ? "Select item type first"
                                  : itemsForSelectedType.length === 0
                                  ? "No items with available stock"
                                  : "Select inventory item"}
                              </option>
                              {itemsForSelectedType.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                  {opt.displayLabel}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                          </div>
                          {itemErr.itemId && (
                            <p className="mt-1 type-caption text-destructive font-medium">
                              {itemErr.itemId}
                            </p>
                          )}
                        </div>

                        {/* Unit of Measurement (non-finished goods) */}
                        {!isFinishedGood && (
                          <div className="min-w-0">
                            <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                              Unit of Measurement
                            </label>
                            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary truncate">
                              {selectedItemOpt?.uomName || "—"}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Row 2: Batch / Lot Number, Expiration Date, Available Quantity, Affected Quantity */}
                      <div
                        className={`grid grid-cols-1 sm:grid-cols-2 ${
                          showExpiryField
                            ? "lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
                            : "lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)]"
                        } gap-3 items-start`}
                      >
                        {/* Batch / Lot Number */}
                        <div className="min-w-0">
                          <label
                            className={`mb-1.5 block type-label-field whitespace-nowrap ${
                              lotErr.lotId ? "text-destructive" : "text-ink"
                            }`}
                          >
                            Batch / Lot Number <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <select
                              aria-label={`Item ${itemIdx + 1} batch or lot`}
                              value={draftLot.lotId || ""}
                              disabled={!selectedItemOpt}
                              onChange={(e) => {
                                const newLotId = Number(e.target.value) || 0;
                                const picked = lotOptions.find((l) => l.lotId === newLotId);
                                handleLotChange(itemIdx, lotIdx, {
                                  lotId: newLotId,
                                  ...(picked?.isExpired && !draftLot.reason
                                    ? { reason: "Expired" }
                                    : {}),
                                });
                              }}
                              className={`w-full h-9 appearance-none rounded-control border bg-surface pl-3 pr-8 type-body-secondary tabular-nums ${
                                draftLot.lotId ? "text-ink" : "text-ink-muted"
                              } focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors truncate ${
                                lotErr.lotId ? "border-destructive" : "border-border"
                              }`}
                            >
                              <option value="">
                                {!selectedItemOpt
                                  ? "Select item first"
                                  : "Select batch / lot"}
                              </option>
                              {lotOptions.map((l) => {
                                const usedElsewhere =
                                  selectedLotIds.has(l.lotId) &&
                                  Number(draftLot.lotId) !== l.lotId;
                                return (
                                  <option
                                    key={l.lotId}
                                    value={l.lotId}
                                    disabled={usedElsewhere}
                                  >
                                    {l.lotCode}
                                    {usedElsewhere ? " (already selected)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                          </div>
                          {lotErr.lotId && (
                            <p className="mt-1 type-caption text-destructive font-medium">
                              {lotErr.lotId}
                            </p>
                          )}
                        </div>

                        {/* Expiration Date */}
                        {showExpiryField && (
                          <div className="min-w-0">
                            <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                              Expiration Date
                            </label>
                            <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary">
                              <span
                                className={
                                  selectedLotOpt?.isExpired
                                    ? "font-semibold text-destructive"
                                    : "text-ink-secondary"
                                }
                              >
                                {selectedLotOpt ? fmtDate(selectedLotOpt.expiryDate) : "—"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Available Quantity */}
                        <div className="min-w-0">
                          <label className="mb-1.5 block type-label-field text-ink whitespace-nowrap">
                            Available Quantity
                          </label>
                          <div className="flex items-center h-9 px-3 rounded-control border border-border bg-page type-body-secondary text-ink-secondary tabular-nums truncate">
                            {selectedLotOpt
                              ? `${selectedLotOpt.availableQuantity.toLocaleString()}${
                                  isFinishedGood ? "" : ` ${selectedLotOpt.uomName}`
                                }`
                              : "—"}
                          </div>
                          {selectedLotOpt && selectedLotOpt.reservedQuantity > 0 && (
                            <p className="mt-1 type-caption text-ink-muted leading-tight">
                              {selectedLotOpt.reservedQuantity}
                              {isFinishedGood ? "" : ` ${selectedLotOpt.uomName}`} reserved excl.
                            </p>
                          )}
                        </div>

                        {/* Affected Quantity */}
                        <div className="min-w-0">
                          <label
                            className={`mb-1.5 block type-label-field whitespace-nowrap ${
                              quantityErrorMsg ? "text-destructive" : "text-ink"
                            }`}
                          >
                            Affected Quantity <span className="text-destructive">*</span>
                          </label>
                          <Input
                            aria-label={`Item ${itemIdx + 1} affected quantity`}
                            type="number"
                            min={0}
                            max={selectedLotOpt?.availableQuantity}
                            step={
                              selectedLotOpt && isCountUom(selectedLotOpt.uomName)
                                ? "1"
                                : "any"
                            }
                            disabled={!selectedLotOpt}
                            placeholder="Enter qty"
                            value={draftLot.quantity}
                            onChange={(e) =>
                              handleLotChange(itemIdx, lotIdx, {
                                quantity: e.target.value,
                              })
                            }
                            aria-invalid={!!quantityErrorMsg}
                            className={`h-9 rounded-control bg-surface px-3 type-body-secondary font-semibold text-ink tabular-nums shadow-none focus:ring-1 focus:ring-ring ${
                              quantityErrorMsg ? "border-destructive" : "border-border"
                            }`}
                          />
                          {quantityErrorMsg && (
                            <p className="mt-1 type-caption text-destructive font-medium leading-tight">
                              {quantityErrorMsg}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Row 3: Write-Off Reason & Disposition Method */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Write-Off Reason */}
                        <div className="space-y-2 min-w-0">
                          <div>
                            <label
                              className={`mb-1.5 block type-label-field ${
                                lotErr.reason ? "text-destructive" : "text-ink"
                              }`}
                            >
                              Write-Off Reason <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                              <select
                                aria-label={`Item ${itemIdx + 1} write-off reason`}
                                value={draftLot.reason}
                                onChange={(e) =>
                                  handleLotChange(itemIdx, lotIdx, {
                                    reason: e.target.value,
                                  })
                                }
                                className={`w-full h-9 appearance-none rounded-control border bg-surface pl-3 pr-8 type-body-secondary ${
                                  draftLot.reason ? "text-ink" : "text-ink-muted"
                                } focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none cursor-pointer transition-colors truncate ${
                                  lotErr.reason ? "border-destructive" : "border-border"
                                }`}
                              >
                                <option value="">Select reason</option>
                                {SWO_REASONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                            </div>
                            {lotErr.reason && (
                              <p className="mt-1 type-caption text-destructive font-medium">
                                {lotErr.reason}
                              </p>
                            )}
                          </div>

                          {draftLot.reason === "Other" && (
                            <div>
                              <Input
                                type="text"
                                maxLength={SWO_OTHER_MAX}
                                placeholder="Specify other write-off reason..."
                                value={draftLot.reasonOther}
                                onChange={(e) =>
                                  handleLotChange(itemIdx, lotIdx, {
                                    reasonOther: e.target.value,
                                  })
                                }
                                aria-invalid={!!lotErr.reasonOther}
                                className={`h-9 rounded-control bg-surface px-3 type-body-secondary text-ink shadow-none ${
                                  lotErr.reasonOther ? "border-destructive" : "border-border"
                                }`}
                              />
                              {lotErr.reasonOther && (
                                <p className="mt-1 type-caption text-destructive font-medium">
                                  {lotErr.reasonOther}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Disposition Method */}
                        <div className="space-y-2 min-w-0">
                          <div>
                            <label
                              className={`mb-1.5 block type-label-field ${
                                lotErr.disposition ? "text-destructive" : "text-ink"
                              }`}
                            >
                              Disposition Method <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                              <select
                                aria-label={`Item ${itemIdx + 1} disposition method`}
                                value={draftLot.disposition}
                                onChange={(e) =>
                                  handleLotChange(itemIdx, lotIdx, {
                                    disposition: e.target.value,
                                  })
                                }
                                className={`w-full h-9 appearance-none rounded-control border bg-surface pl-3 pr-8 type-body-secondary ${
                                  draftLot.disposition ? "text-ink" : "text-ink-muted"
                                } focus:border-primary focus:ring-1 focus:ring-ring focus:outline-none cursor-pointer transition-colors truncate ${
                                  lotErr.disposition ? "border-destructive" : "border-border"
                                }`}
                              >
                                <option value="">Select disposition method</option>
                                {SWO_DISPOSITIONS.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                            </div>
                            {lotErr.disposition && (
                              <p className="mt-1 type-caption text-destructive font-medium">
                                {lotErr.disposition}
                              </p>
                            )}
                          </div>

                          {draftLot.disposition === "Other" && (
                            <div>
                              <Input
                                type="text"
                                maxLength={SWO_OTHER_MAX}
                                placeholder="Specify other disposition method..."
                                value={draftLot.dispositionOther}
                                onChange={(e) =>
                                  handleLotChange(itemIdx, lotIdx, {
                                    dispositionOther: e.target.value,
                                  })
                                }
                                aria-invalid={!!lotErr.dispositionOther}
                                className={`h-9 rounded-control bg-surface px-3 type-body-secondary text-ink shadow-none ${
                                  lotErr.dispositionOther ? "border-destructive" : "border-border"
                                }`}
                              />
                              {lotErr.dispositionOther && (
                                <p className="mt-1 type-caption text-destructive font-medium">
                                  {lotErr.dispositionOther}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Row 4: Item Remarks */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className={`type-label-field ${
                              lotErr.remarks ? "text-destructive" : "text-ink"
                            }`}
                          >
                            Item Remarks <span className="text-destructive">*</span>
                          </label>
                          <span className="type-caption text-ink-muted tabular-nums">
                            {draftLot.remarks.length}/{SWO_REMARKS_MAX}
                          </span>
                        </div>
                        <Textarea
                          aria-label={`Item ${itemIdx + 1} remarks`}
                          rows={2}
                          maxLength={SWO_REMARKS_MAX}
                          placeholder="Describe the condition of this inventory and explain why it needs to be written off..."
                          value={draftLot.remarks}
                          onChange={(e) =>
                            handleLotChange(itemIdx, lotIdx, {
                              remarks: e.target.value,
                            })
                          }
                          aria-invalid={!!lotErr.remarks}
                          className={`w-full rounded-control bg-surface px-3 py-2 type-body-secondary text-ink shadow-none focus:ring-1 focus:ring-ring resize-none ${
                            lotErr.remarks ? "border-destructive" : "border-border"
                          }`}
                        />
                        {lotErr.remarks && (
                          <p className="mt-1 type-caption text-destructive font-medium">
                            {lotErr.remarks}
                          </p>
                        )}
                      </div>

                      {/* Row 5: Item Supporting Evidence (Compact dashed strip) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="type-label-field text-ink">
                            Item Supporting Evidence{" "}
                            <span className="type-caption font-normal text-ink-muted">(Optional)</span>
                          </label>
                          <span className="type-caption text-ink-muted tabular-nums">
                            {draftItem.photos.length}/{SWO_MAX_PHOTOS_PER_ITEM} photos
                          </span>
                        </div>

                        {draftItem.photos.length > 0 ? (
                          <div className="rounded-control border border-dashed border-border bg-page p-3 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                              {draftItem.photos.map((p, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="flex flex-col p-2.5 bg-surface rounded-control border border-border"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={p.previewUrl}
                                    alt={p.file.name}
                                    className="h-28 w-full rounded-control object-contain bg-page border border-border"
                                  />
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <span className="type-caption text-ink-secondary truncate">
                                      {p.file.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePhoto(itemIdx, pIdx)}
                                      className="p-1 rounded-control text-ink-muted hover:text-destructive hover:bg-notice-danger-bg transition-colors cursor-pointer shrink-0"
                                      title="Remove photo"
                                      aria-label={`Remove ${p.file.name}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {draftItem.photos.length < SWO_MAX_PHOTOS_PER_ITEM && (
                              <label className="inline-flex items-center gap-1.5 type-label-button-sm text-primary hover:underline cursor-pointer">
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add more photos</span>
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp"
                                  multiple
                                  onChange={(e) => {
                                    handlePhotoUploadChange(itemIdx, e.target.files);
                                    e.target.value = "";
                                  }}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-3 rounded-control border border-dashed border-border bg-page px-4 py-3.5 cursor-pointer hover:bg-subtle transition-colors">
                            <Upload className="w-4 h-4 text-ink-muted shrink-0" />
                            <div className="text-left">
                              <div className="type-body-secondary font-medium text-ink">
                                Click to upload item condition photo
                              </div>
                              <div className="type-caption text-ink-muted">
                                JPG, PNG, WebP up to 10 MB · Up to {SWO_MAX_PHOTOS_PER_ITEM} photos per item
                              </div>
                            </div>
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.webp"
                              multiple
                              onChange={(e) => {
                                handlePhotoUploadChange(itemIdx, e.target.files);
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </label>
                        )}

                        {draftItem.photoError && (
                          <p className="type-caption text-destructive font-medium">
                            {draftItem.photoError}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Another Item Button (Matching PR Redesign "+ Add item") */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={items.length >= SWO_MAX_ITEMS}
                  className="inline-flex items-center gap-1.5 type-label-button-sm text-primary hover:underline transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add another item</span>
                </button>
              </div>
            </div>

            {/* Card 3: General remarks (Full width of left column) */}
            <div className="rounded-card border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="type-subsection text-ink">
                  General remarks{" "}
                  <span className="type-caption font-normal text-ink-muted">(Optional)</span>
                </h2>
                <span className="type-caption text-ink-muted tabular-nums">
                  {generalRemarks.length}/{SWO_GENERAL_REMARKS_MAX}
                </span>
              </div>
              <Textarea
                rows={3}
                maxLength={SWO_GENERAL_REMARKS_MAX}
                placeholder="Enter additional remarks (optional)..."
                value={generalRemarks}
                onChange={(e) => setGeneralRemarks(e.target.value)}
                className="w-full rounded-control border border-border bg-surface px-3 py-2.5 type-body-secondary text-ink shadow-none focus:ring-1 focus:ring-ring resize-none"
              />
              {errors.generalRemarks && (
                <p className="type-caption text-destructive font-medium">
                  {errors.generalRemarks}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Write-off Summary Card (Page Mode) */}
          {variant === "page" && (
            <div className="space-y-5">
              <div className="rounded-card border border-border bg-surface p-5 space-y-3.5">
                <h2 className="type-subsection text-ink">Write-off summary</h2>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Write-Off No.</span>
                    <span className="font-medium text-ink tabular-nums">
                      {swoPreviewNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Status</span>
                    <span className="font-medium text-ink">Pending Submission</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Request Date</span>
                    <span className="font-medium text-ink">{requestDateDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Requested By</span>
                    <span className="font-medium text-ink truncate max-w-[180px]">
                      {staff.name || staff.username}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Items Listed</span>
                    <span className="font-medium text-ink tabular-nums">
                      {configuredItemsCount} / {SWO_MAX_ITEMS} items
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Batches / Lots</span>
                    <span className="font-medium text-ink tabular-nums">
                      {selectedLotsCount} {selectedLotsCount === 1 ? "lot" : "lots"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted shrink-0">Primary Reason</span>
                    <span className="font-medium text-ink text-right break-words">
                      {summaryReasons.length > 0 ? summaryReasons.join(", ") : "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted shrink-0">Disposition</span>
                    <span className="font-medium text-ink text-right break-words">
                      {summaryDispositions.length > 0 ? summaryDispositions.join(", ") : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 type-body-secondary">
                    <span className="text-ink-muted">Evidence Photos</span>
                    <span className="font-medium text-ink tabular-nums">
                      {totalPhotosCount} attached
                    </span>
                  </div>
                </div>

                <div className="border-t border-divider pt-3 flex items-center justify-between gap-3">
                  <span className="type-subsection text-ink">Total items to write off</span>
                  <span className="type-card-title text-primary tabular-nums text-right">
                    {summaryTotalLabel}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Info Bar (Page mode shows helper text only; actions are in top-right header) */}
        {variant === "page" ? (
          <div className="border-t border-divider pt-4">
            <p className="type-caption text-ink-muted">
              Submitted write-off requests are sent to Admin for approval before inventory quantities are deducted.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-3 pt-5 pb-3 border-t border-divider mt-6 mb-2">
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              className="rounded-control border border-border bg-surface px-5 h-9 type-label-button text-ink hover:bg-subtle shadow-none cursor-pointer"
            >
              Cancel
            </ModalCloseButton>
            <Button
              type="button"
              disabled={submitting || loadingData}
              onClick={() => {
                if (runValidation()) {
                  setConfirmSubmitOpen(true);
                }
              }}
              className="rounded-control bg-primary text-on-brand px-5 h-9 type-label-button hover:bg-primary-hover shadow-none disabled:opacity-50 cursor-pointer"
            >
              Submit for Approval
            </Button>
          </div>
        )}
      </div>

      {/* Discard / Leave Confirmation Modal */}
      <ActionConfirmModal
        open={confirmDiscardOpen}
        title="Discard Unsaved Changes?"
        subtitle={`Write-Off No: ${swoPreviewNumber}`}
        description="Are you sure you want to leave this page? Any unsaved Stock Write-Off details will be discarded."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        onCancel={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          onClose();
        }}
      />

      {/* Submit Confirmation Modal */}
      <ActionConfirmModal
        open={confirmSubmitOpen}
        title="Submit Stock Write-Off Request"
        subtitle={`Write-Off No: ${swoPreviewNumber} • ${items.length} item(s) • ${totalLotsCount} lot(s)`}
        description="Are you sure you want to submit this Stock Write-Off request for administrator approval?"
        confirmLabel="Confirm & Submit"
        submitting={submitting}
        onCancel={() => setConfirmSubmitOpen(false)}
        onConfirm={async () => {
          setConfirmSubmitOpen(false);
          await executeCreate();
        }}
      />
    </>
  );
}

/**
 * Full-page Create Stock Write-Off form matching Figma Stock Write-Off · Redesign.
 */
export function CreateSWOForm(props: CreateSWOFormProps) {
  return <SWOFormBody {...props} active={true} variant="page" />;
}

/**
 * Backward-compatible modal wrapper for Create Stock Write-Off.
 */
export function CreateSWOModal({ open, ...rest }: CreateSWOModalProps) {
  return (
    <ModalWrapper
      open={open}
      title="Create Stock Write-Off Request"
      onClose={rest.onClose}
      size="max-w-5xl"
      confirmOnClose={true}
      confirmMessage="Are you sure you want to close? Any unsaved Stock Write-Off details will be discarded."
    >
      <SWOFormBody {...rest} active={open} variant="modal" />
    </ModalWrapper>
  );
}
