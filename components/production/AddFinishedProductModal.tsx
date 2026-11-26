"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Trash2, Package, Check, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { actionResponse } from "@/lib/resources/action-response";
import {
  listProductFormLookups,
  createFinishedProductWithVariants,
} from "@/app/actions/production/products";
import { updateFinishedProduct as productionUpdateFinishedProduct } from "@/app/actions/production/product-detail";
import { syncProductCatalogToPos } from "@/app/actions/production/pos-sync";
import {
  buildBaseVariantSku,
  composeVariantName,
  parseVariantComponents,
  type VariantContentUom,
  type VariantPackagingType,
} from "@/lib/production/sku";
import ActionConfirmModal from "@/components/shared/ActionConfirmModal";
import { FinishedProductItem } from "./types";

const PACKAGING_TYPES: VariantPackagingType[] = ["Jar", "Container", "Pouch"];

interface VariantRow {
  id: string;
  existingProductId?: number;
  existingSku?: string;
  existingStock?: number;
  contentSize: string;
  contentUom: VariantContentUom;
  packagingType: VariantPackagingType;
  sellingPrice: string;
  minStockLevel: string;
  maxStockLevel: string;
  variantName: string;
  isActive: boolean;
}

interface AddFinishedProductModalProps {
  open: boolean;
  editingItem?: FinishedProductItem | null;
  allProducts?: FinishedProductItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddFinishedProductModal({
  open,
  editingItem,
  allProducts = [],
  onClose,
  onSuccess,
}: AddFinishedProductModalProps) {
  const isEditing = Boolean(editingItem);

  const [defaultCategoryId, setDefaultCategoryId] = useState<number | undefined>(undefined);

  // Basic Information (Product level)
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Product Variants
  const [variants, setVariants] = useState<VariantRow[]>([
    {
      id: "var-1",
      contentSize: "250",
      contentUom: "ML",
      packagingType: "Jar",
      sellingPrice: "0",
      minStockLevel: "10",
      maxStockLevel: "100",
      variantName: composeVariantName("250", "ML", "Jar"),
      isActive: true,
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const allProductsRef = useRef<FinishedProductItem[]>(allProducts);
  allProductsRef.current = allProducts;

  // Live duplicate product name check (case-insensitive)
  const duplicateProductNameError = useMemo(() => {
    const trimmed = productName.trim().toLowerCase();
    if (!trimmed) return "";
    const originalName = (editingItem?.itemName || "").trim().toLowerCase();
    const exists = allProducts.some((p) => {
      const candidate = (p.itemName || "").trim().toLowerCase();
      if (!candidate) return false;
      if (isEditing && candidate === originalName) return false;
      return candidate === trimmed;
    });
    if (exists) {
      return `Product "${productName.trim()}" already exists. Please edit the existing product instead.`;
    }
    return "";
  }, [productName, allProducts, isEditing, editingItem]);

  // Load default category lookup when modal opens
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    async function load() {
      try {
        const res = await actionResponse(listProductFormLookups());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = (res.data as any)?.data || res.data;
        if (isMounted && payload?.defaultCategoryId) {
          setDefaultCategoryId(payload.defaultCategoryId);
        }
      } catch (err) {
        console.warn("Could not load product lookups:", err);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [open]);

  // Reset or prefill form when modal opens
  useEffect(() => {
    if (!open) return;

    if (editingItem) {
      const targetNameKey = (editingItem.itemName || "").trim().toLowerCase();
      const matchingProductVariants = allProductsRef.current
        .filter((p) => (p.itemName || "").trim().toLowerCase() === targetNameKey)
        .sort((a, b) => a.productId - b.productId);

      const sourceVariants =
        matchingProductVariants.length > 0 ? matchingProductVariants : [editingItem];

      setProductName(editingItem.itemName || "");
      setDescription(editingItem.description || "");
      setIsActive(editingItem.isActive !== false);

      setVariants(
        sourceVariants.map((item) => {
          const parsed = parseVariantComponents(item.variant, item.uomName);
          const sizeVal = item.contentSize || parsed.contentSize || "250";
          const uomVal = (item.contentUom as VariantContentUom) || parsed.uom || "ML";
          const pkgVal = (item.packagingType as VariantPackagingType) || parsed.packagingType || "Jar";
          const priceVal =
            item.sellingPrice !== undefined && item.sellingPrice > 0
              ? String(item.sellingPrice)
              : "0";
          const minVal =
            item.minStockLevel !== undefined && item.minStockLevel > 0
              ? String(item.minStockLevel)
              : "10";
          const maxVal =
            item.maxStockLevel !== undefined && item.maxStockLevel > 0
              ? String(item.maxStockLevel)
              : "100";

          return {
            id: `existing-${item.productId}`,
            existingProductId: item.productId,
            existingSku: item.sku,
            existingStock: Number(item.currentStock) || 0,
            contentSize: sizeVal,
            contentUom: uomVal,
            packagingType: pkgVal,
            sellingPrice: priceVal,
            minStockLevel: minVal,
            maxStockLevel: maxVal,
            variantName: composeVariantName(sizeVal, uomVal, pkgVal),
            isActive: item.isActive !== false,
          };
        })
      );
    } else {
      setProductName("");
      setDescription("");
      setIsActive(true);
      setVariants([
        {
          id: `var-${Date.now()}-1`,
          contentSize: "250",
          contentUom: "ML",
          packagingType: "Jar",
          sellingPrice: "0",
          minStockLevel: "10",
          maxStockLevel: "100",
          variantName: composeVariantName("250", "ML", "Jar"),
          isActive: true,
        },
      ]);
    }
  }, [open, editingItem]);

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: `var-${Date.now()}-${prev.length + 1}`,
        contentSize: "350",
        contentUom: "ML",
        packagingType: "Jar",
        sellingPrice: "0",
        minStockLevel: "10",
        maxStockLevel: "100",
        variantName: composeVariantName("350", "ML", "Jar"),
        isActive,
      },
    ]);
  };

  const handleRemoveVariant = (id: string) => {
    if (variants.length <= 1) {
      toast.error("At least one product variant is required.");
      return;
    }
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleUpdateVariantField = (
    id: string,
    field: "contentSize" | "contentUom" | "packagingType" | "sellingPrice" | "minStockLevel" | "maxStockLevel",
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const next = { ...v, [field]: value } as VariantRow;
        if (field === "contentSize" || field === "contentUom" || field === "packagingType") {
          next.existingSku = undefined;
        }
        next.variantName = composeVariantName(next.contentSize, next.contentUom, next.packagingType);
        return next;
      })
    );
  };

  const handleTopLevelStatusChange = (nextActive: boolean) => {
    setIsActive(nextActive);
    setVariants((prev) => prev.map((v) => ({ ...v, isActive: nextActive })));
  };

  const handleVariantStatusChange = (id: string, nextActive: boolean) => {
    setVariants((prev) => {
      const updated = prev.map((v) => (v.id === id ? { ...v, isActive: nextActive } : v));
      const anyActive = updated.some((v) => v.isActive);
      setIsActive(anyActive);
      return updated;
    });
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = productName.trim();
    if (!trimmedName) {
      toast.error("Product Name is required.");
      return;
    }

    if (duplicateProductNameError) {
      toast.error(duplicateProductNameError);
      return;
    }

    if (variants.length === 0) {
      toast.error("Please add at least one variant.");
      return;
    }

    const seenVariantNames = new Set<string>();
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const numericSize = parseFloat(v.contentSize);
      if (!v.contentSize.trim() || isNaN(numericSize) || numericSize <= 0) {
        toast.error(`Variant ${i + 1} requires a valid Content Size (e.g. 250, 350).`);
        return;
      }
      const minStockNum = parseFloat(v.minStockLevel);
      const maxStockNum = parseFloat(v.maxStockLevel);
      if (isNaN(minStockNum) || minStockNum <= 0) {
        toast.error(`Variant ${i + 1} requires a Min Stock Level greater than 0.`);
        return;
      }
      if (isNaN(maxStockNum) || maxStockNum <= 0) {
        toast.error(`Variant ${i + 1} requires a Max Stock Level greater than 0.`);
        return;
      }
      if (maxStockNum < minStockNum) {
        toast.error(`Variant ${i + 1}: Max Stock Level cannot be less than Min Stock Level.`);
        return;
      }
      const composed = composeVariantName(v.contentSize, v.contentUom, v.packagingType);
      const key = composed.toLowerCase();
      if (seenVariantNames.has(key)) {
        toast.error(`Duplicate variant "${composed}". Each variant must be unique.`);
        return;
      }
      seenVariantNames.add(key);
    }

    setConfirmSaveOpen(true);
  };

  const executeSaveProduct = async () => {
    const trimmedName = productName.trim();

    try {
      setSubmitting(true);

      if (isEditing && editingItem) {
        const existingVariantRows = variants.filter((v) => Boolean(v.existingProductId));
        const newVariantRows = variants.filter((v) => !v.existingProductId);

        for (const v of existingVariantRows) {
          const composedName = composeVariantName(v.contentSize, v.contentUom, v.packagingType);
          const res = await actionResponse(
            productionUpdateFinishedProduct(v.existingProductId!, {
              productName: trimmedName,
              variant: composedName,
              contentSize: v.contentSize.trim(),
              contentUom: v.contentUom,
              packagingType: v.packagingType,
              // Omit sellingPrice on edit so existing DB/POS price is preserved untouched
              minStockLevel: parseFloat(v.minStockLevel) || 10,
              maxStockLevel: parseFloat(v.maxStockLevel) || 100,
              sku: v.existingSku,
              isActive: v.isActive,
            })
          );

          if (!res.data?.success) {
            throw new Error(res.data?.message || "Failed to update finished product variant");
          }
        }

        if (newVariantRows.length > 0) {
          const createRes = await actionResponse(
            createFinishedProductWithVariants({
              productName: trimmedName,
              categoryId: defaultCategoryId,
              description: description.trim() || undefined,
              allowExistingProduct: true,
              variants: newVariantRows.map((v) => ({
                variantName: composeVariantName(v.contentSize, v.contentUom, v.packagingType),
                contentSize: v.contentSize.trim(),
                contentUom: v.contentUom,
                packagingType: v.packagingType,
                minStockLevel: parseFloat(v.minStockLevel) || 10,
                maxStockLevel: parseFloat(v.maxStockLevel) || 100,
                sellingPrice: 0,
              })),
            })
          );
          if (!createRes.data?.success) {
            throw new Error(createRes.data?.message || "Failed to add new variant to product");
          }
        }

        syncProductCatalogToPos(trimmedName, { isNewCreation: false }).catch(() => { });

        toast.success("Finished product updated successfully!");
        onSuccess();
        onClose();
      } else {
        const payload = {
          productName: trimmedName,
          categoryId: defaultCategoryId,
          description: description.trim() || undefined,
          variants: variants.map((v) => {
            const composedName = composeVariantName(v.contentSize, v.contentUom, v.packagingType);
            return {
              variantName: composedName,
              contentSize: v.contentSize.trim(),
              contentUom: v.contentUom,
              packagingType: v.packagingType,
              minStockLevel: parseFloat(v.minStockLevel) || 10,
              maxStockLevel: parseFloat(v.maxStockLevel) || 100,
              sellingPrice: 0,
            };
          }),
        };

        const res = await actionResponse(createFinishedProductWithVariants(payload));
        if (!res.data?.success) {
          throw new Error(res.data?.message || "Failed to create product");
        }

        syncProductCatalogToPos(trimmedName, { isNewCreation: true }).catch(() => { });

        toast.success("Finished product created successfully!");
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save finished product";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100020] bg-scrim animate-in fade-in duration-150" />
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => {
            if (submitting) e.preventDefault();
          }}
          className="fixed left-1/2 top-1/2 z-[100021] flex max-h-[88vh] w-[calc(100%-2rem)] max-w-[600px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-modal border border-border bg-surface shadow-modal outline-none animate-in fade-in zoom-in-95 duration-150"
        >
          <Dialog.Title className="sr-only">
            {isEditing ? "Edit finished product" : "New finished product"}
          </Dialog.Title>

          {/* ── Sticky Header (Supplier-inspired clean header) ── */}
          <div className="flex items-start justify-between gap-3 border-b border-topbar bg-surface px-6 pt-5 pb-4 shrink-0">
            <div className="min-w-0">
              <h2 className="type-modal-title text-ink">
                {isEditing ? "Edit finished product" : "New finished product"}
              </h2>
              <p className="mt-0.5 type-body-secondary text-ink-muted">
                {isEditing
                  ? "Update product details, status, and packaging variants."
                  : "Add a finished product you produce and configure its packaging variants."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!submitting) onClose();
              }}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-subtle hover:text-ink transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Form with Scrollable Body + Sticky Footer ── */}
          <form onSubmit={handlePromptSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-[18px]">
              {/* Product Name (+ Status in Edit mode) */}
              <div className={isEditing ? "grid grid-cols-1 sm:grid-cols-2 gap-3.5" : ""}>
                <div>
                  <label className="mb-1.5 block type-label-field text-ink-strong">
                    Product name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="text"
                      placeholder="e.g. Ube Halaya Smooth"
                      value={productName}
                      onChange={(e) => {
                        setProductName(e.target.value);
                        setVariants((prev) => prev.map((v) => ({ ...v, existingSku: undefined })));
                      }}
                      aria-invalid={Boolean(duplicateProductNameError)}
                      className={`h-10 w-full rounded-control border ${duplicateProductNameError
                        ? "border-destructive focus:ring-destructive"
                        : "border-input focus:border-primary"
                        } bg-surface pl-9 pr-3 type-body text-ink placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-focus/30 transition-colors`}
                      required
                    />
                  </div>
                  {duplicateProductNameError && (
                    <p className="mt-1.5 type-caption font-medium text-destructive">
                      {duplicateProductNameError}
                    </p>
                  )}
                </div>

                {isEditing && (
                  <div>
                    <label className="mb-1.5 block type-label-field text-ink-strong">Status</label>
                    <div className="relative">
                      <select
                        value={isActive ? "true" : "false"}
                        onChange={(e) => handleTopLevelStatusChange(e.target.value === "true")}
                        className="h-10 w-full appearance-none rounded-control border border-input bg-surface pl-3 pr-9 type-body text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus/30 transition-colors cursor-pointer"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    </div>
                  </div>
                )}
              </div>

              {/* Description (optional) */}
              <div>
                <label className="mb-1.5 block type-label-field text-ink-strong">
                  Description <span className="font-normal text-ink-disabled">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ingredients summary, flavor notes, or production instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-control border border-input bg-surface px-3 py-2.5 type-body text-ink placeholder:text-ink-disabled focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus/30 transition-colors resize-none"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-divider" />

              {/* Packaging Variants Section */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="type-subsection text-ink">Packaging variants</h3>
                    <p className="mt-0.5 type-caption text-ink-muted">
                      Variant name and SKU are generated automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control bg-tint-selected px-3 type-label-button-sm text-primary hover:bg-tint-soft transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add variant
                  </button>
                </div>

                <div className="space-y-3">
                  {variants.map((v, index) => {
                    const composedVariantName = composeVariantName(
                      v.contentSize,
                      v.contentUom,
                      v.packagingType
                    );
                    const previewSku = v.existingSku
                      ? v.existingSku
                      : buildBaseVariantSku(productName || "PRD", composedVariantName);

                    return (
                      <div
                        key={v.id}
                        className="rounded-inner border border-input bg-page p-4 space-y-3.5"
                      >
                        {/* Variant Header Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="type-label-field font-semibold text-ink">
                              Variant {index + 1}
                            </span>
                            <span className="type-body-secondary text-ink-muted truncate">
                              · {composedVariantName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isEditing && v.existingProductId && (
                              <span
                                className={`rounded-pill px-2.5 py-0.5 type-badge ${(v.existingStock ?? 0) > 0
                                  ? "bg-status-green-bg text-status-green-fg"
                                  : "bg-status-gray-bg text-status-gray-fg"
                                  }`}
                              >
                                {v.existingStock ?? 0} in stock
                              </span>
                            )}
                            {isEditing && v.existingProductId && variants.length > 1 && (
                              <div className="relative">
                                <select
                                  aria-label={`Variant ${index + 1} Status`}
                                  value={v.isActive ? "true" : "false"}
                                  onChange={(e) =>
                                    handleVariantStatusChange(v.id, e.target.value === "true")
                                  }
                                  className="h-7 appearance-none rounded-control border border-input bg-surface pl-2.5 pr-7 type-caption font-medium text-ink focus:border-primary focus:outline-none cursor-pointer"
                                >
                                  <option value="true">Active</option>
                                  <option value="false">Inactive</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-muted" />
                              </div>
                            )}
                            {!v.existingProductId && variants.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveVariant(v.id)}
                                className="inline-flex h-7 items-center gap-1 rounded-control px-2 type-caption font-medium text-destructive hover:bg-notice-danger-bg transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Packaging Type — Supplier-style selectable pill chips */}
                        <div>
                          <label className="mb-1.5 block type-label-field text-ink-strong">
                            Packaging type <span className="text-destructive">*</span>
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            {PACKAGING_TYPES.map((pkg) => {
                              const selected = v.packagingType === pkg;
                              return (
                                <button
                                  key={pkg}
                                  type="button"
                                  onClick={() => handleUpdateVariantField(v.id, "packagingType", pkg)}
                                  aria-pressed={selected}
                                  className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 type-label-button-sm transition-colors cursor-pointer ${selected
                                    ? "border-border-selected bg-tint-selected text-primary"
                                    : "border-input bg-surface text-ink-strong hover:bg-subtle"
                                    }`}
                                >
                                  {selected && <Check className="h-3.5 w-3.5 stroke-[2.4]" />}
                                  {pkg}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Row 1: Content Size + UOM + Variant SKU (auto) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="mb-1.5 block type-label-field text-ink-strong">
                              Content size &amp; UOM <span className="text-destructive">*</span>
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                placeholder="e.g. 250"
                                value={v.contentSize}
                                onChange={(e) =>
                                  handleUpdateVariantField(v.id, "contentSize", e.target.value)
                                }
                                className="h-10 min-w-0 flex-1 rounded-control border border-input bg-surface px-3 type-body text-ink tabular-nums placeholder:text-ink-disabled focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus/30 transition-colors"
                                required
                              />
                              <div className="relative shrink-0">
                                <select
                                  aria-label={`Variant ${index + 1} UOM`}
                                  value={v.contentUom}
                                  onChange={(e) =>
                                    handleUpdateVariantField(v.id, "contentUom", e.target.value)
                                  }
                                  className="h-10 appearance-none rounded-control border border-input bg-surface pl-3 pr-8 type-body font-medium text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus/30 transition-colors cursor-pointer"
                                >
                                  <option value="G">Grams (g)</option>
                                  <option value="KG">Kilograms (kg)</option>
                                  <option value="ML">Milliliters (mL)</option>
                                  <option value="L">Liters (L)</option>
                                  <option value="OZ">Ounces (oz)</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="mb-1.5 block type-label-field text-ink-strong">
                              Variant SKU
                            </label>
                            <input
                              type="text"
                              value={previewSku}
                              readOnly
                              disabled
                              className="h-10 w-full rounded-control border border-input bg-subtle/60 px-3 type-body text-ink-muted tabular-nums cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Row 2: Min Stock Level + Max Stock Level */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="mb-1.5 block type-label-field text-ink-strong">
                              Min stock level <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                placeholder="10"
                                value={v.minStockLevel}
                                onChange={(e) =>
                                  handleUpdateVariantField(v.id, "minStockLevel", e.target.value)
                                }
                                className="h-10 w-full rounded-control border border-input bg-surface pl-3 pr-14 type-body text-ink tabular-nums placeholder:text-ink-disabled focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus/30 transition-colors"
                                required
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 type-body-secondary text-ink-muted">
                                units
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="mb-1.5 block type-label-field text-ink-strong">
                              Max stock level <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                placeholder="100"
                                value={v.maxStockLevel}
                                onChange={(e) =>
                                  handleUpdateVariantField(v.id, "maxStockLevel", e.target.value)
                                }
                                className="h-10 w-full rounded-control border border-input bg-surface pl-3 pr-14 type-body text-ink tabular-nums placeholder:text-ink-disabled focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus/30 transition-colors"
                                required
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 type-body-secondary text-ink-muted">
                                units
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Sticky Footer (Supplier-inspired #fafafa bar) ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-topbar bg-page px-6 py-3.5 shrink-0">
              <p className="type-caption text-ink-muted">
                {isEditing
                  ? "Updates sync to POS. Existing prices are preserved."
                  : "Add a recipe next so this product can be produced."}
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (!submitting) onClose();
                  }}
                  disabled={submitting}
                  className="h-9 rounded-control border border-border bg-surface px-4 type-label-button text-ink hover:bg-subtle transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || Boolean(duplicateProductNameError)}
                  className="h-9 rounded-control bg-primary px-4 type-label-button text-on-brand hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : isEditing ? "Save changes" : "Save product"}
                </button>
              </div>
            </div>
          </form>

          <ActionConfirmModal
            open={confirmSaveOpen}
            title={isEditing ? "Save Finished Product Changes" : "Create Finished Product"}
            subtitle={`Product: ${productName.trim() || "—"} • ${variants.length} Variant(s)`}
            description={
              isEditing
                ? `Are you sure you want to save the updates to "${productName.trim()}" and its ${variants.length} variant(s)?`
                : `Are you sure you want to create "${productName.trim()}" with ${variants.length} variant(s)?`
            }
            confirmText={isEditing ? "Save Changes" : "Confirm & Create"}
            loading={submitting}
            loadingText="Saving..."
            onConfirm={async () => {
              await executeSaveProduct();
              setConfirmSaveOpen(false);
            }}
            onClose={() => setConfirmSaveOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
