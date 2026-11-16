"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  Upload,
  X,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import { useStaff } from "@/context/StaffContext";
import { inventory } from "@/lib/inventory/client";
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
  itemKey: string; // e.g. "item:12" or "fg:5"
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

interface CreateSWOModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
}

export function CreateSWOModal({ open, onClose, onSuccess }: CreateSWOModalProps) {
  const staff = useStaff();

  const [formData, setFormData] = useState<WriteOffFormData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

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
    setLoadingData(true);
    setLoadError("");
    setItems([createEmptyItem()]);
    setGeneralRemarks("");
    setErrors({ items: {} });
    setSubmitBannerError("");

    inventory
      .getWriteOffFormData()
      .then((res) => {
        if (!active) return;
        if (res.data?.success && res.data.data) {
          setFormData(res.data.data);
        } else {
          setLoadError(res.data?.message || "Failed to load inventory items and lots.");
        }
      })
      .catch(() => {
        if (active) setLoadError("Failed to load inventory items and lots.");
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

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

  // Used item keys across cards (to disable duplicate item selection)
  const selectedItemKeys = useMemo(
    () => new Set(items.map((it) => it.itemKey).filter(Boolean)),
    [items]
  );

  // Used lot IDs across all items & rows
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

  const handleAddLot = (itemIdx: number) => {
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === itemIdx ? { ...it, lots: [...it.lots, createEmptyLot()] } : it
      )
    );
  };

  const handleRemoveLot = (itemIdx: number, lotIdx: number) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx || it.lots.length <= 1) return it;
        return {
          ...it,
          lots: it.lots.filter((_, lIdx) => lIdx !== lotIdx),
        };
      })
    );
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
          const fd = new FormData();
          fd.append("file", photo.file);
          const upRes = await inventory.uploadWriteOffPhotoDirect(
            savedItem.writeOffItemId,
            fd
          );
          if (!upRes.data?.success) {
            failedPhotos++;
          }
        }
      }

      const successMessage =
        failedPhotos > 0
          ? `Stock Write-Off ${createdSwo.swoNumber} submitted for approval (${failedPhotos} photo(s) could not be uploaded).`
          : `Stock Write-Off ${createdSwo.swoNumber} submitted for approval.`;
      onSuccess(successMessage);
    } catch (err) {
      setSubmitBannerError(
        err instanceof Error ? err.message : "Unable to submit Stock Write-Off request."
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
          {loadError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-medium text-destructive flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {submitBannerError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-medium text-destructive flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitBannerError}</span>
            </div>
          )}

          {/* Section 1: Stock Write-Off Information */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-foreground">
              Stock Write-Off Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Write-Off Number
                </label>
                <div className="flex items-center justify-between h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs font-semibold text-foreground">
                  <span>{formData?.nextSwoNumberPreview || "SWO-2026-0001"}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    Auto-generated
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Request Date
                </label>
                <div className="flex items-center justify-between h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                  <span>{requestDateDisplay}</span>
                  <span className="text-[10px]">Auto-generated</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Requested By
                </label>
                <div className="flex items-center justify-between h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                  <span className="truncate font-medium text-foreground">
                    {staff.name || staff.username}
                  </span>
                  <span className="text-[10px] shrink-0">Logged-in User</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Write-Off Items (Max 5 items, multiple lots per item) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Write-Off Items ({items.length}/{SWO_MAX_ITEMS})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Add the inventory items that need to be written off (up to {SWO_MAX_ITEMS} items per request). You can select one or more batches / lots per item.
                </p>
              </div>
            </div>

            {items.map((draftItem, itemIdx) => {
              const itemErr = errors.items[itemIdx] || { lots: {} };
              const selectedItemOpt = itemsByKey.get(draftItem.itemKey);
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
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                        Item {itemIdx + 1}
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Required
                      </span>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(itemIdx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove Item
                      </button>
                    )}
                  </div>

                  {/* Inventory Details Row: Item Type, Item Name, UOM */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Inventory Details
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* Item Type */}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">
                          Item Type <span className="text-destructive">*</span>
                        </label>
                        <select
                          value={draftItem.itemType}
                          disabled={loadingData}
                          onChange={(e) => handleItemTypeChange(itemIdx, e.target.value)}
                          className={`w-full h-10 rounded-xl border bg-card px-3 text-xs text-foreground focus:ring-1 focus:ring-ring ${
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
                          disabled={!draftItem.itemType || loadingData}
                          onChange={(e) => handleItemKeyChange(itemIdx, e.target.value)}
                          className={`w-full h-10 rounded-xl border bg-card px-3 text-xs text-foreground focus:ring-1 focus:ring-ring disabled:opacity-50 ${
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
                          {itemsForSelectedType.map((opt) => {
                            const usedInOtherCard =
                              selectedItemKeys.has(opt.key) && draftItem.itemKey !== opt.key;
                            return (
                              <option
                                key={opt.key}
                                value={opt.key}
                                disabled={usedInOtherCard}
                              >
                                {opt.displayLabel}
                                {usedInOtherCard ? " (already selected)" : ""}
                              </option>
                            );
                          })}
                        </select>
                        {itemErr.itemId && (
                          <p className="mt-1 text-[11px] text-destructive font-medium">
                            {itemErr.itemId}
                          </p>
                        )}
                      </div>

                      {/* Unit of Measurement (Auto-retrieved) */}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-foreground">
                          Unit of Measurement
                        </label>
                        <div className="flex items-center justify-between h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {selectedItemOpt?.uomName || "—"}
                          </span>
                          <span className="text-[10px]">Auto-retrieved</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Batch / Lot Sub-Cards for this Item */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Batch / Lot & Write-Off Details ({draftItem.lots.length}{" "}
                        {draftItem.lots.length === 1 ? "Lot" : "Lots"})
                      </div>
                      {selectedItemOpt &&
                        draftItem.lots.length < selectedItemOpt.lots.length && (
                          <button
                            type="button"
                            onClick={() => handleAddLot(itemIdx)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Another Lot
                          </button>
                        )}
                    </div>

                    {itemErr.lotsError && (
                      <p className="text-[11px] text-destructive font-medium">
                        {itemErr.lotsError}
                      </p>
                    )}

                    {draftItem.lots.map((draftLot, lotIdx) => {
                      const lotErr = itemErr.lots?.[lotIdx] || {};
                      const lotOptions: WriteOffFormLotOption[] = selectedItemOpt?.lots || [];
                      const selectedLotOpt = lotOptions.find(
                        (l) => l.lotId === Number(draftLot.lotId)
                      );

                      // Live inline check if user enters quantity > available
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

                      return (
                        <div
                          key={lotIdx}
                          className="rounded-xl border border-border bg-muted/15 p-3.5 space-y-3.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">
                              Lot Entry #{lotIdx + 1}
                            </span>
                            {draftItem.lots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLot(itemIdx, lotIdx)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive hover:underline cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" /> Remove Lot
                              </button>
                            )}
                          </div>

                          {/* Row 1: Batch/Lot Number, Expiration Date (only if category HasExpiry & lot has expiry), Available Quantity, Affected Quantity */}
                          <div
                            className={`grid grid-cols-1 sm:grid-cols-2 ${
                              hasExpiry && (!selectedLotOpt || Boolean(selectedLotOpt.expiryDate))
                                ? "lg:grid-cols-4"
                                : "lg:grid-cols-3"
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
                                className={`w-full h-10 rounded-xl border bg-card px-3 text-xs text-foreground focus:ring-1 focus:ring-ring disabled:opacity-50 ${
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
                                      {l.lotCode} — Avail: {l.availableQuantity} {l.uomName}
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

                            {/* Expiration Date (Hidden when category has no expiry or lot has no expiry date) */}
                            {hasExpiry && (!selectedLotOpt || Boolean(selectedLotOpt.expiryDate)) && (
                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                                  Expiration Date
                                </label>
                                <div className="flex items-center justify-between h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                                  <span
                                    className={
                                      selectedLotOpt?.isExpired
                                        ? "font-bold text-destructive"
                                        : "font-medium text-foreground"
                                    }
                                  >
                                    {selectedLotOpt
                                      ? fmtDate(selectedLotOpt.expiryDate)
                                      : "—"}
                                  </span>
                                  <span className="text-[10px]">Auto-retrieved</span>
                                </div>
                              </div>
                            )}

                            {/* Available Quantity (Unreserved) */}
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                                Available Quantity
                              </label>
                              <div className="flex items-center justify-between h-10 px-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
                                <span className="font-bold text-foreground">
                                  {selectedLotOpt
                                    ? `${selectedLotOpt.availableQuantity.toLocaleString()} ${selectedLotOpt.uomName}`
                                    : "—"}
                                </span>
                                <span className="text-[10px]">Auto-retrieved</span>
                              </div>
                              {selectedLotOpt && selectedLotOpt.reservedQuantity > 0 && (
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  ({selectedLotOpt.reservedQuantity} {selectedLotOpt.uomName} reserved for production excluded)
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

                          {/* Row 2: Write-Off Reason & Disposition Method */}
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
                                  className={`w-full h-10 rounded-xl border bg-card px-3 text-xs text-foreground focus:ring-1 focus:ring-ring ${
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
                                    className={`h-9 rounded-xl bg-card text-xs ${
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
                                  className={`w-full h-10 rounded-xl border bg-card px-3 text-xs text-foreground focus:ring-1 focus:ring-ring ${
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
                                    className={`h-9 rounded-xl bg-card text-xs ${
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

                          {/* Row 3: Item Remarks */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-foreground">
                                Item Remarks <span className="text-destructive">*</span>
                              </label>
                              <span className="text-[10px] text-muted-foreground">
                                {draftLot.remarks.length}/{SWO_REMARKS_MAX} (min {SWO_REMARKS_MIN})
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
                    })}
                  </div>

                  {/* Supporting Evidence Photo Upload (Optional) */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-semibold text-foreground">
                          Item Supporting Evidence{" "}
                          <span className="text-muted-foreground font-normal">(Optional)</span>
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Upload clear photo(s) showing the condition of this specific inventory item. JPG, PNG · Multiple photos allowed (up to {SWO_MAX_PHOTOS_PER_ITEM}).
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Item Photo</span>
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

                    {draftItem.photoError && (
                      <p className="text-[11px] text-destructive font-medium">
                        {draftItem.photoError}
                      </p>
                    )}

                    {draftItem.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {draftItem.photos.map((p, pIdx) => (
                          <div
                            key={pIdx}
                            className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.previewUrl}
                              alt={p.file.name}
                              className="w-10 h-10 rounded-lg object-cover border border-border"
                            />
                            <div className="max-w-[140px]">
                              <div className="text-xs font-medium text-foreground truncate">
                                {p.file.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {Math.max(1, Math.round(p.file.size / 1024))} KB
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(itemIdx, pIdx)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer"
                              title="Remove photo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Another Item Button (Max 5 items) */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={items.length >= SWO_MAX_ITEMS}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-foreground bg-card border border-border rounded-xl hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> Add Another Item
              </button>
              <span className="text-xs text-muted-foreground">
                {items.length >= SWO_MAX_ITEMS
                  ? `Maximum of ${SWO_MAX_ITEMS} items reached.`
                  : "Add another inventory item to this write-off request."}
              </span>
            </div>
          </div>

          {/* Section 3: General Remarks (Optional) */}
          <div className="flex flex-col sm:flex-row justify-start pt-3 border-t border-border">
            <div className="w-full sm:w-2/3 lg:w-1/2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  General Remarks{" "}
                  <span className="text-muted-foreground font-normal">
                    (Optional. Additional information regarding the overall write-off request.)
                  </span>
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {generalRemarks.length}/{SWO_GENERAL_REMARKS_MAX}
                </span>
              </div>
              <Textarea
                rows={3}
                maxLength={SWO_GENERAL_REMARKS_MAX}
                placeholder="Enter additional remarks..."
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

          {/* Modal Footer */}
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
        description={`Are you sure you want to submit this Stock Write-Off request for administrator approval?`}
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
