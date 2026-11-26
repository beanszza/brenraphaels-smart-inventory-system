"use client";

import React, { useState, useEffect, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Package, Check, X, ChevronDown } from "lucide-react";
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

interface AddFinishedProductModalProps {
  open: boolean;
  editingItem?: FinishedProductItem | null;
  allProducts?: FinishedProductItem[];
  onClose: () => void;
  onSuccess: () => void;
}

/** "Ube Tidbits" + "500 Grams Container" in the one canonical, case-insensitive form the server also compares. */
function productKey(name: string, variant: string | undefined, fallbackUom?: string): string {
  const parsed = parseVariantComponents(variant, fallbackUom);
  return `${name.trim().toLowerCase()}|${composeVariantName(parsed.contentSize, parsed.uom, parsed.packagingType).toLowerCase()}`;
}

/**
 * Creates or edits ONE finished product: a name plus one size and packaging (e.g. "Ube Tidbits · 500 Grams Container").
 * Another size of the same product is created separately under the same name. Editing changes only the row being edited.
 */
export default function AddFinishedProductModal({
  open,
  editingItem,
  allProducts = [],
  onClose,
  onSuccess,
}: AddFinishedProductModalProps) {
  const isEditing = Boolean(editingItem);

  const [defaultCategoryId, setDefaultCategoryId] = useState<number | undefined>(undefined);

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [contentSize, setContentSize] = useState("250");
  const [contentUom, setContentUom] = useState<VariantContentUom>("G");
  const [packagingType, setPackagingType] = useState<VariantPackagingType>("Container");
  const [minStockLevel, setMinStockLevel] = useState("10");
  const [maxStockLevel, setMaxStockLevel] = useState("100");
  /** The saved SKU, kept while the name, size and packaging are unchanged. */
  const [existingSku, setExistingSku] = useState<string | undefined>(undefined);

  const [submitting, setSubmitting] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const composedVariantName = composeVariantName(contentSize, contentUom, packagingType);
  const displayLabel = `${productName.trim() || "—"} · ${composedVariantName}`;
  const previewSku = existingSku || buildBaseVariantSku(productName || "PRD", composedVariantName);

  // Existing product names, so another size can reuse the exact same name.
  const nameSuggestions = useMemo(() => {
    const names = new Map<string, string>();
    for (const p of allProducts) {
      const name = (p.itemName || "").trim();
      if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    }
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
  }, [allProducts]);

  // The same name + size + packaging may exist only once (the row being edited excluded).
  const duplicateError = useMemo(() => {
    const trimmed = productName.trim();
    if (!trimmed || !contentSize.trim()) return "";
    const key = productKey(trimmed, composedVariantName);
    const exists = allProducts.some(
      (p) =>
        p.productId !== editingItem?.productId &&
        productKey(p.itemName || "", p.variant, p.uomName) === key
    );
    return exists ? `"${trimmed} · ${composedVariantName}" already exists.` : "";
  }, [productName, contentSize, composedVariantName, allProducts, editingItem]);

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

  // Reset, or prefill from the one row being edited, each time the modal opens (adjusting state during render, not in an effect).
  const formKey = open ? String(editingItem?.productId ?? "new") : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (formKey !== loadedKey) {
    setLoadedKey(formKey);
    if (formKey !== null) prefill();
  }

  function prefill() {
    if (editingItem) {
      const parsed = parseVariantComponents(editingItem.variant, editingItem.uomName);
      setProductName(editingItem.itemName || "");
      setDescription(editingItem.description || "");
      setIsActive(editingItem.isActive !== false);
      setContentSize(editingItem.contentSize || parsed.contentSize || "250");
      setContentUom((editingItem.contentUom as VariantContentUom) || parsed.uom || "ML");
      setPackagingType((editingItem.packagingType as VariantPackagingType) || parsed.packagingType || "Jar");
      setMinStockLevel(
        editingItem.minStockLevel !== undefined && editingItem.minStockLevel > 0 ? String(editingItem.minStockLevel) : "10"
      );
      setMaxStockLevel(
        editingItem.maxStockLevel !== undefined && editingItem.maxStockLevel > 0 ? String(editingItem.maxStockLevel) : "100"
      );
      setExistingSku(editingItem.sku || undefined);
    } else {
      setProductName("");
      setDescription("");
      setIsActive(true);
      setContentSize("250");
      setContentUom("G");
      setPackagingType("Container");
      setMinStockLevel("10");
      setMaxStockLevel("100");
      setExistingSku(undefined);
    }
  }

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim()) {
      toast.error("Product Name is required.");
      return;
    }
    const numericSize = parseFloat(contentSize);
    if (!contentSize.trim() || isNaN(numericSize) || numericSize <= 0) {
      toast.error("Enter a valid Content Size (e.g. 250, 500).");
      return;
    }
    const minStockNum = parseFloat(minStockLevel);
    const maxStockNum = parseFloat(maxStockLevel);
    if (isNaN(minStockNum) || minStockNum <= 0) {
      toast.error("Min Stock Level must be greater than 0.");
      return;
    }
    if (isNaN(maxStockNum) || maxStockNum <= 0) {
      toast.error("Max Stock Level must be greater than 0.");
      return;
    }
    if (maxStockNum < minStockNum) {
      toast.error("Max Stock Level cannot be less than Min Stock Level.");
      return;
    }
    if (duplicateError) {
      toast.error(duplicateError);
      return;
    }

    setConfirmSaveOpen(true);
  };

  const executeSaveProduct = async () => {
    const trimmedName = productName.trim();
    const minStock = parseFloat(minStockLevel) || 10;
    const maxStock = parseFloat(maxStockLevel) || 100;

    try {
      setSubmitting(true);

      if (isEditing && editingItem) {
        const res = await actionResponse(
          productionUpdateFinishedProduct(editingItem.productId, {
            productName: trimmedName,
            variant: composedVariantName,
            contentSize: contentSize.trim(),
            contentUom,
            packagingType,
            // Omit sellingPrice on edit so existing DB/POS price is preserved untouched
            minStockLevel: minStock,
            maxStockLevel: maxStock,
            sku: existingSku,
            isActive,
          })
        );
        if (!res.data?.success) {
          throw new Error(res.data?.message || "Failed to update finished product");
        }

        // POS groups sizes by name: a renamed row leaves its old product and joins the new one, so sync both.
        const previousName = (editingItem.itemName || "").trim();
        syncProductCatalogToPos(trimmedName, { isNewCreation: false }).catch(() => { });
        if (previousName && previousName.toLowerCase() !== trimmedName.toLowerCase()) {
          syncProductCatalogToPos(previousName, { isNewCreation: false }).catch(() => { });
        }

        toast.success(`Updated ${trimmedName} · ${composedVariantName}.`);
      } else {
        const res = await actionResponse(
          createFinishedProductWithVariants({
            productName: trimmedName,
            categoryId: defaultCategoryId,
            description: description.trim() || undefined,
            // Another size of an existing product is allowed; the server still refuses an exact duplicate.
            allowExistingProduct: true,
            variants: [
              {
                variantName: composedVariantName,
                contentSize: contentSize.trim(),
                contentUom,
                packagingType,
                minStockLevel: minStock,
                maxStockLevel: maxStock,
                sellingPrice: 0,
              },
            ],
          })
        );
        if (!res.data?.success) {
          throw new Error(res.data?.message || "Failed to create product");
        }

        syncProductCatalogToPos(trimmedName, { isNewCreation: true }).catch(() => { });

        toast.success(`Created ${trimmedName} · ${composedVariantName}.`);
      }
      onSuccess();
      onClose();
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

          {/* ── Sticky Header ── */}
          <div className="flex items-start justify-between gap-3 border-b border-topbar bg-surface px-6 pt-5 pb-4 shrink-0">
            <div className="min-w-0">
              <h2 className="type-modal-title text-ink">
                {isEditing ? "Edit finished product" : "New finished product"}
              </h2>
              <p className="mt-0.5 type-body-secondary text-ink-muted">
                {isEditing
                  ? "Changes apply only to this product and size."
                  : "Add one product with its size and packaging. Add another size as its own product with the same name."}
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
                  <label htmlFor="finished-product-name" className="mb-1.5 block type-label-field text-ink-strong">
                    Product name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      id="finished-product-name"
                      type="text"
                      list="finished-product-name-suggestions"
                      autoComplete="off"
                      placeholder="e.g. Ube Tidbits"
                      value={productName}
                      onChange={(e) => {
                        setProductName(e.target.value);
                        setExistingSku(undefined);
                      }}
                      className="h-10 w-full rounded-control border border-input focus:border-primary bg-surface pl-9 pr-3 type-body text-ink placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-focus/30 transition-colors"
                      required
                    />
                    <datalist id="finished-product-name-suggestions">
                      {nameSuggestions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>
                  <p className="mt-1.5 type-caption text-ink-muted">
                    Pick an existing name to add another size of that product.
                  </p>
                </div>

                {isEditing && (
                  <div>
                    <label className="mb-1.5 block type-label-field text-ink-strong">Status</label>
                    <div className="relative">
                      <select
                        aria-label="Status"
                        value={isActive ? "true" : "false"}
                        onChange={(e) => setIsActive(e.target.value === "true")}
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

              <div className="border-t border-divider" />

              {/* Size & packaging */}
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="type-subsection text-ink">Size &amp; packaging</h3>
                    <p className="mt-0.5 type-caption text-ink-muted truncate">{displayLabel}</p>
                  </div>
                  {isEditing && (
                    <span
                      className={`rounded-pill px-2.5 py-0.5 type-badge ${(editingItem?.currentStock ?? 0) > 0
                        ? "bg-status-green-bg text-status-green-fg"
                        : "bg-status-gray-bg text-status-gray-fg"
                        }`}
                    >
                      {editingItem?.currentStock ?? 0} in stock
                    </span>
                  )}
                </div>

                {/* Packaging Type — selectable pill chips */}
                <div>
                  <label className="mb-1.5 block type-label-field text-ink-strong">
                    Packaging type <span className="text-destructive">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {PACKAGING_TYPES.map((pkg) => {
                      const selected = packagingType === pkg;
                      return (
                        <button
                          key={pkg}
                          type="button"
                          onClick={() => {
                            setPackagingType(pkg);
                            setExistingSku(undefined);
                          }}
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

                {/* Content Size + UOM + SKU (auto) */}
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
                        aria-label="Content size"
                        value={contentSize}
                        onChange={(e) => {
                          setContentSize(e.target.value);
                          setExistingSku(undefined);
                        }}
                        className="h-10 min-w-0 flex-1 rounded-control border border-input bg-surface px-3 type-body text-ink tabular-nums placeholder:text-ink-disabled focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus/30 transition-colors"
                        required
                      />
                      <div className="relative shrink-0">
                        <select
                          aria-label="UOM"
                          value={contentUom}
                          onChange={(e) => {
                            setContentUom(e.target.value as VariantContentUom);
                            setExistingSku(undefined);
                          }}
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
                    <label className="mb-1.5 block type-label-field text-ink-strong">SKU</label>
                    <input
                      type="text"
                      aria-label="SKU"
                      value={previewSku}
                      readOnly
                      disabled
                      className="h-10 w-full rounded-control border border-input bg-subtle/60 px-3 type-body text-ink-muted tabular-nums cursor-not-allowed"
                    />
                  </div>
                </div>

                {duplicateError && (
                  <p role="alert" className="type-caption font-medium text-destructive">
                    {duplicateError}
                  </p>
                )}

                {/* Min / Max Stock Level */}
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
                        aria-label="Min stock level"
                        value={minStockLevel}
                        onChange={(e) => setMinStockLevel(e.target.value)}
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
                        aria-label="Max stock level"
                        value={maxStockLevel}
                        onChange={(e) => setMaxStockLevel(e.target.value)}
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
            </div>

            {/* ── Sticky Footer ── */}
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
                  disabled={submitting || Boolean(duplicateError)}
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
            subtitle={displayLabel}
            description={
              isEditing
                ? `Are you sure you want to save the changes to "${displayLabel}"? Other sizes are not changed.`
                : `Are you sure you want to create "${displayLabel}"?`
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
