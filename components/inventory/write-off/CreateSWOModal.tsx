"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  Upload,
  AlertCircle,
} from "lucide-react";
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
  SWO_REMARKS_MIN,
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

interface CreateSWOModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  initialWriteOffs?: StockWriteOffDto[];
  initialInventories?: InventoryItem[];
  initialLots?: LotItem[];
  initialCategories?: { categoryId: number; categoryName: string }[];
}

export function CreateSWOModal({
  open,
  onClose,
  onSuccess,
  initialWriteOffs = [],
  initialInventories = [],
  initialLots = [],
  initialCategories = [],
}: CreateSWOModalProps) {
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
    if (!open) return;
    let active = true;
    setFormData(fallbackFormData);
    setItems([createEmptyItem()]);
    setGeneralRemarks("");
    setErrors({ items: {} });
    setSubmitBannerError("");
    setLoadingData(true);

    inventory
      .getWriteOffFormData()
      .then((res) => {
        if (!active) return;
        if (res.data?.success && res.data.data) {
          setFormData(res.data.data);
        }
      })
      .catch(() => {
        // Fallback data from page props is already populated
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [open, fallbackFormData]);

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

  const selectedItemKeys = useMemo(
    () => new Set(items.map((it) => it.itemKey).filter(Boolean)),
    [items]
  );

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
            photoError = "Only JPG or PNG image files are allowed.";
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
      setSubmitBannerError(
        firstSwoErrorMessage(validation) || "Please fix the highlighted errors before submitting."
      );
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
        setSubmitBannerError(
          res.data?.message || "Unable to submit the Stock Write-Off request."
        );
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
    } catch (err: any) {
      setSubmitBannerError(
        err?.response?.data?.message ||
          (err instanceof Error ? err.message : "Unable to submit Stock Write-Off request.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const totalLotsCount = items.reduce((acc, it) => acc + it.lots.length, 0);

  const fmtDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <>
      <ModalWrapper
        open={open}
        title="Create Stock Write-Off Request"
        onClose={onClose}
        size="max-w-5xl"
        confirmOnClose={true}
        confirmMessage="Are you sure you want to close? Any unsaved Stock Write-Off details will be discarded."
      >
        <div className="space-y-6">
          {submitBannerError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-medium text-destructive flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitBannerError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSubmitBannerError("")}
                className="font-bold underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Section 1: Stock Write-Off Information (Matches CreatePRForm read-only fields) */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-foreground">
              Stock Write-Off Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Write-Off Number
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground select-all">
                  {formData?.nextSwoNumberPreview || "SWO-2026-0001"}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Request Date
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                  {requestDateDisplay}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Requested By
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground select-none">
                  {staff.name || staff.username}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Write-Off Items (Max 5 items, multiple lots per item) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Write-Off Items
                </h3>
                <p className="text-xs text-muted-foreground">
                  Add the inventory items that need to be written off (up to {SWO_MAX_ITEMS} items per request). You can select one or more batches / lots per item.
                </p>
              </div>
            </div>

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

              return (
                <div
                  key={itemIdx}
                  className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-xs"
                >
                  {/* Item Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <span className="text-sm font-bold text-foreground">
                      Item {itemIdx + 1}
                    </span>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(itemIdx)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-destructive/30 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove Item
                      </button>
                    )}
                  </div>

                  {/* Item Details Row: Item Type, Item Name, (UOM for non-finished goods) */}
                  <div
                    className={`grid grid-cols-1 ${
                      isFinishedGood ? "sm:grid-cols-2" : "sm:grid-cols-3"
                    } gap-3.5`}
                  >
                    {/* Item Type */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Item Type <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={draftItem.itemType}
                        onChange={(e) => handleItemTypeChange(itemIdx, e.target.value)}
                        className={`w-full h-10 rounded-xl border bg-card px-3.5 text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer ${
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
                      {itemErr.itemType && (
                        <p className="mt-1 text-[11px] text-destructive font-medium">
                          {itemErr.itemType}
                        </p>
                      )}
                    </div>

                    {/* Item Name */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Item Name <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={draftItem.itemKey}
                        disabled={!draftItem.itemType}
                        onChange={(e) => handleItemKeyChange(itemIdx, e.target.value)}
                        className={`w-full h-10 rounded-xl border bg-card px-3.5 text-xs text-foreground focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer ${
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
                      {itemErr.itemId && (
                        <p className="mt-1 text-[11px] text-destructive font-medium">
                          {itemErr.itemId}
                        </p>
                      )}
                    </div>

                    {/* Unit of Measurement (Shown only for non-finished goods) */}
                    {!isFinishedGood && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">
                          Unit of Measurement
                        </label>
                        <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                          {selectedItemOpt?.uomName || "—"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lot & Write-Off Details (1 lot per item) */}
                  {(() => {
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
                      <div className="space-y-3.5 pt-2 border-t border-border">
                        {/* Row: Batch/Lot Number, Expiration Date, Available Quantity, Affected Quantity */}
                        <div
                          className={`grid grid-cols-1 sm:grid-cols-2 ${
                            showExpiryField ? "lg:grid-cols-4" : "lg:grid-cols-3"
                          } gap-3`}
                        >
                          {/* Batch / Lot Number */}
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-foreground">
                              Batch / Lot Number <span className="text-destructive">*</span>
                            </label>
                            <select
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
                              className={`w-full h-10 rounded-xl border bg-card px-3.5 text-xs text-foreground focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer ${
                                lotErr.lotId ? "border-destructive" : "border-border"
                              }`}
                            >
                              <option value="">
                                {!selectedItemOpt
                                  ? "Select item first"
                                  : "Select batch / lot number"}
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
                                    {l.isExpired ? " (EXPIRED)" : ""}
                                    {usedElsewhere ? " (already selected)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                            {lotErr.lotId && (
                              <p className="mt-1 text-[11px] text-destructive font-medium">
                                {lotErr.lotId}
                              </p>
                            )}
                          </div>

                          {/* Expiration Date */}
                          {showExpiryField && (
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                                Expiration Date
                              </label>
                              <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                                <span
                                  className={
                                    selectedLotOpt?.isExpired
                                      ? "font-bold text-destructive"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {selectedLotOpt
                                    ? fmtDate(selectedLotOpt.expiryDate)
                                    : "—"}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Available Quantity (Unreserved) */}
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-foreground">
                              Available Quantity
                            </label>
                            <div className="flex items-center h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                              {selectedLotOpt
                                ? `${selectedLotOpt.availableQuantity.toLocaleString()}${isFinishedGood ? "" : ` ${selectedLotOpt.uomName}`}`
                                : "—"}
                            </div>
                            {selectedLotOpt && selectedLotOpt.reservedQuantity > 0 && (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                ({selectedLotOpt.reservedQuantity}{isFinishedGood ? "" : ` ${selectedLotOpt.uomName}`} reserved excluded)
                              </p>
                            )}
                          </div>

                          {/* Affected Quantity */}
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-foreground">
                              Affected Quantity <span className="text-destructive">*</span>
                            </label>
                            <Input
                              type="number"
                              min={0}
                              max={selectedLotOpt?.availableQuantity}
                              step={
                                selectedLotOpt && isCountUom(selectedLotOpt.uomName)
                                  ? "1"
                                  : "any"
                              }
                              disabled={!selectedLotOpt}
                              placeholder="Enter quantity"
                              value={draftLot.quantity}
                              onChange={(e) =>
                                handleLotChange(itemIdx, lotIdx, {
                                  quantity: e.target.value,
                                })
                              }
                              className={`h-10 rounded-xl bg-card text-xs font-semibold ${
                                quantityErrorMsg
                                  ? "border-destructive focus-visible:ring-destructive"
                                  : "border-border"
                              }`}
                            />
                            {quantityErrorMsg && (
                              <p className="mt-1 text-[11px] text-destructive font-medium">
                                {quantityErrorMsg}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Row: Write-Off Reason & Disposition Method */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Write-Off Reason */}
                          <div className="space-y-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                                Write-Off Reason <span className="text-destructive">*</span>
                              </label>
                              <select
                                value={draftLot.reason}
                                onChange={(e) =>
                                  handleLotChange(itemIdx, lotIdx, {
                                    reason: e.target.value,
                                  })
                                }
                                className={`w-full h-10 rounded-xl border bg-card px-3.5 text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer ${
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
                              {lotErr.reason && (
                                <p className="mt-1 text-[11px] text-destructive font-medium">
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
                                  className={`h-10 rounded-xl bg-card text-xs ${
                                    lotErr.reasonOther
                                      ? "border-destructive"
                                      : "border-border"
                                  }`}
                                />
                                {lotErr.reasonOther && (
                                  <p className="mt-1 text-[11px] text-destructive font-medium">
                                    {lotErr.reasonOther}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Disposition Method */}
                          <div className="space-y-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                                Disposition Method <span className="text-destructive">*</span>
                              </label>
                              <select
                                value={draftLot.disposition}
                                onChange={(e) =>
                                  handleLotChange(itemIdx, lotIdx, {
                                    disposition: e.target.value,
                                  })
                                }
                                className={`w-full h-10 rounded-xl border bg-card px-3.5 text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer ${
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
                              {lotErr.disposition && (
                                <p className="mt-1 text-[11px] text-destructive font-medium">
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
                                  className={`h-10 rounded-xl bg-card text-xs ${
                                    lotErr.dispositionOther
                                      ? "border-destructive"
                                      : "border-border"
                                  }`}
                                />
                                {lotErr.dispositionOther && (
                                  <p className="mt-1 text-[11px] text-destructive font-medium">
                                    {lotErr.dispositionOther}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Row: Item Remarks */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-foreground">
                              Item Remarks <span className="text-destructive">*</span>
                            </label>
                            <span className="text-[10px] text-muted-foreground">
                              {draftLot.remarks.length}/{SWO_REMARKS_MAX}
                            </span>
                          </div>
                          <Textarea
                            rows={2}
                            maxLength={SWO_REMARKS_MAX}
                            placeholder="Describe the condition of this inventory and explain why it needs to be written off..."
                            value={draftLot.remarks}
                            onChange={(e) =>
                              handleLotChange(itemIdx, lotIdx, {
                                remarks: e.target.value,
                              })
                            }
                            className={`w-full rounded-xl bg-card px-3 py-2 text-xs text-foreground resize-none ${
                              lotErr.remarks ? "border-destructive" : "border-border"
                            }`}
                          />
                          {lotErr.remarks && (
                            <p className="mt-1 text-[11px] text-destructive font-medium">
                              {lotErr.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Supporting Evidence Photo Upload (Matches CreateDeliveryModal dashed dropzone UI) */}
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        Item Supporting Evidence{" "}
                        <span className="text-muted-foreground font-normal">(Optional)</span>
                      </label>
                      {draftItem.photos.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {draftItem.photos.length}/{SWO_MAX_PHOTOS_PER_ITEM} photo(s)
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl border border-dashed border-border bg-card p-4 transition-colors">
                      {draftItem.photos.length > 0 ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {draftItem.photos.map((p, pIdx) => (
                              <div
                                key={pIdx}
                                className="relative flex flex-col items-center justify-center p-3 bg-muted/20 rounded-xl border border-border"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p.previewUrl}
                                  alt={p.file.name}
                                  className="max-h-44 w-full rounded-lg object-contain border border-border shadow-xs bg-card"
                                />
                                <p className="mt-2 text-[11px] text-muted-foreground truncate max-w-xs text-center">
                                  {p.file.name}
                                </p>
                                <div className="mt-2 flex justify-end w-full">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhoto(itemIdx, pIdx)}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {draftItem.photos.length < SWO_MAX_PHOTOS_PER_ITEM && (
                            <div className="flex justify-end pt-2 border-t border-border/50">
                              <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1.5">
                                <Upload className="w-3.5 h-3.5" />
                                Upload More Photos
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
                            </div>
                          )}
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center cursor-pointer py-4 hover:bg-muted/30 rounded-xl transition-colors">
                          <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                          <span className="text-xs font-medium text-foreground">
                            Click to upload item condition photo
                          </span>
                          <span className="text-[11px] text-muted-foreground mt-0.5">
                            JPG, PNG, WebP up to 10MB · Multiple photos allowed
                          </span>
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

                    {draftItem.photoError && (
                      <p className="text-[11px] text-destructive font-medium">
                        {draftItem.photoError}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Another Item Button (Matches CreatePRForm "+ Add Item" button) */}
            <button
              type="button"
              onClick={handleAddItem}
              disabled={items.length >= SWO_MAX_ITEMS}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-foreground bg-card border border-border rounded-xl hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> Add Another Item
            </button>
          </div>

          {/* Section 3: General Remarks (Matches CreatePRForm bottom left Notes section) */}
          <div className="flex flex-col sm:flex-row justify-start pt-3 border-t border-border">
            <div className="w-full sm:w-1/2 lg:w-5/12 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  General Remarks <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {generalRemarks.length}/{SWO_GENERAL_REMARKS_MAX}
                </span>
              </div>
              <Textarea
                rows={3}
                maxLength={SWO_GENERAL_REMARKS_MAX}
                placeholder="Enter additional remarks (optional)..."
                value={generalRemarks}
                onChange={(e) => setGeneralRemarks(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-ring resize-none"
              />
              {errors.generalRemarks && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.generalRemarks}
                </p>
              )}
            </div>
          </div>

          {/* Modal Footer (Matches CreatePRForm footer) */}
          <div className="flex flex-wrap justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
            <ModalCloseButton
              type="button"
              variant="outline"
              fallbackOnClose={onClose}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
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
              className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              Submit for Approval
            </Button>
          </div>
        </div>
      </ModalWrapper>

      {/* Submit Confirmation Modal */}
      <ActionConfirmModal
        open={confirmSubmitOpen}
        title="Submit Stock Write-Off Request"
        subtitle={`Write-Off No: ${formData?.nextSwoNumberPreview || "SWO-2026-0001"} • ${items.length} item(s) • ${totalLotsCount} lot(s)`}
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
