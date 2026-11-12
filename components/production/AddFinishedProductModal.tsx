"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { actionResponse } from "@/lib/resources/action-response";
import {
  listProductFormLookups,
  createFinishedProductWithVariants,
} from "@/app/actions/production/products";
import { updateFinishedProduct as productionUpdateFinishedProduct } from "@/app/actions/production/product-detail";
import { syncProductCatalogToPos } from "@/app/actions/production/pos-sync";
import { uploadProductionImage, resolveProductionImage } from "@/lib/production/image-client";
import { FILE_PLACEHOLDER } from "@/lib/files";
import {
  buildBaseVariantSku,
  composeVariantName,
  parseVariantComponents,
  type VariantContentUom,
  type VariantPackagingType,
} from "@/lib/production/sku";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { FinishedProductItem } from "./types";

const CONTENT_UOM_OPTIONS: { value: VariantContentUom; label: string }[] = [
  { value: "ML", label: "Milliliter (mL)" },
  { value: "G", label: "Gram (g)" },
  { value: "KG", label: "Kilogram (kg)" },
  { value: "L", label: "Liter (L)" },
];
const PACKAGING_TYPES: VariantPackagingType[] = ["Jar", "Container", "Pouch"];

interface VariantRow {
  id: string;
  existingProductId?: number;
  existingSku?: string;
  contentSize: string;
  contentUom: VariantContentUom;
  packagingType: VariantPackagingType;
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

  // Product Photo (1 per product)
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  // Product Variants
  const [variants, setVariants] = useState<VariantRow[]>([
    {
      id: "var-1",
      contentSize: "250",
      contentUom: "ML",
      packagingType: "Jar",
      minStockLevel: "10",
      maxStockLevel: "100",
      variantName: composeVariantName("250", "ML", "Jar"),
      isActive: true,
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
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
        const payload: any = (res.data as any)?.data || res.data;
        if (isMounted && payload?.defaultCategoryId) {
          setDefaultCategoryId(payload.defaultCategoryId);
        }
      } catch (err: any) {
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
    let isMounted = true;

    if (editingItem) {
      const targetNameKey = (editingItem.itemName || "").trim().toLowerCase();
      // Gather all variants belonging to this product name (sorted by productId ascending)
      const matchingProductVariants = allProductsRef.current
        .filter((p) => (p.itemName || "").trim().toLowerCase() === targetNameKey)
        .sort((a, b) => a.productId - b.productId);

      const sourceVariants =
        matchingProductVariants.length > 0 ? matchingProductVariants : [editingItem];

      setProductName(editingItem.itemName || "");
      setDescription(editingItem.description || "");
      setIsActive(editingItem.isActive !== false);
      setPhotoFile(null);
      setPhotoPreview(editingItem.imageUrl || "");

      // Resolve actual image URL for preview if not already set
      if (!editingItem.imageUrl) {
        resolveProductionImage("product", editingItem.productId).then((resolvedUrl) => {
          if (isMounted && resolvedUrl && resolvedUrl !== FILE_PLACEHOLDER) {
            setPhotoPreview(resolvedUrl);
          }
        });
      }

      setVariants(
        sourceVariants.map((item) => {
          const parsed = parseVariantComponents(item.variant, item.uomName);
          const sizeVal = item.contentSize || parsed.contentSize || "250";
          const uomVal = (item.contentUom as VariantContentUom) || parsed.uom || "ML";
          const pkgVal = (item.packagingType as VariantPackagingType) || parsed.packagingType || "Jar";
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
            contentSize: sizeVal,
            contentUom: uomVal,
            packagingType: pkgVal,
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
      setPhotoFile(null);
      setPhotoPreview("");
      setVariants([
        {
          id: `var-${Date.now()}-1`,
          contentSize: "250",
          contentUom: "ML",
          packagingType: "Jar",
          minStockLevel: "10",
          maxStockLevel: "100",
          variantName: composeVariantName("250", "ML", "Jar"),
          isActive: true,
        },
      ]);
    }

    return () => {
      isMounted = false;
    };
  }, [open, editingItem]);

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: `var-${Date.now()}-${prev.length + 1}`,
        contentSize: "350",
        contentUom: "ML",
        packagingType: "Jar",
        minStockLevel: "10",
        maxStockLevel: "100",
        variantName: composeVariantName("350", "ML", "Jar"),
        isActive: isActive,
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
    field: "contentSize" | "contentUom" | "packagingType" | "minStockLevel" | "maxStockLevel",
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
      // Sync top-level status indicator if all variants share the same state
      const anyActive = updated.some((v) => v.isActive);
      setIsActive(anyActive);
      return updated;
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be under 10MB.");
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    // Validate variants
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

    try {
      setSubmitting(true);

      if (isEditing && editingItem) {
        // ── EDIT FLOW (Updates all existing variants of the product + creates any newly added variants) ──
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
                unitCost: 0,
                sellingPrice: 0,
              })),
            })
          );
          if (!createRes.data?.success) {
            throw new Error(createRes.data?.message || "Failed to add new variant to product");
          }
        }

        // Upload photo before closing modal so user sees updated thumbnail immediately
        if (photoFile) {
          try {
            await uploadProductionImage("product", editingItem.productId, photoFile);
          } catch (photoErr: any) {
            toast.error(photoErr?.message || "Product updated, but photo upload failed.");
          }
        }

        // Automatically sync with POS in background (without overwriting POS price)
        syncProductCatalogToPos(trimmedName, { isNewCreation: false }).catch(() => {});

        toast.success("Finished product updated successfully!");
        onSuccess();
        onClose();
      } else {
        // ── CREATE FLOW ──
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
              unitCost: 0,
              sellingPrice: 0,
            };
          }),
        };

        const res = await actionResponse(createFinishedProductWithVariants(payload));
        if (!res.data?.success) {
          throw new Error(res.data?.message || "Failed to create product");
        }

        const createdVariants = res.data?.data?.variants || [];
        const createdIds = createdVariants.map((v: any) => v.productId).filter(Boolean);

        // Upload photo once to the first variant (productImage.save automatically shares it across all variants of the product)
        if (photoFile && createdIds.length > 0) {
          try {
            await uploadProductionImage("product", createdIds[0], photoFile);
          } catch (photoErr: any) {
            toast.error(photoErr?.message || "Product created, but photo upload failed.");
          }
        }

        // Automatically sync newly created product to POS with initial price 0
        syncProductCatalogToPos(trimmedName, { isNewCreation: true }).catch(() => {});

        toast.success("Finished product created successfully!");
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save finished product");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper
      open={open}
      title={isEditing ? "Edit Finished Product" : "Add Finished Product"}
      onClose={onClose}
      size="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Section 1: Product Information ── */}
        <div className="space-y-4">
          <div className="border-b border-border pb-2 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Product Information
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Basic product details and catalog classification
              </p>
            </div>
            <span className="text-xs font-semibold bg-muted px-2.5 py-1 rounded-lg border border-border text-foreground">
              Category: Finished Product
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Name */}
            <div className={isEditing ? "" : "md:col-span-2"}>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Product Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Ube Halaya"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                aria-invalid={Boolean(duplicateProductNameError)}
                className={`w-full rounded-xl border ${
                  duplicateProductNameError
                    ? "!border-destructive focus-visible:!ring-destructive"
                    : "border-border"
                } bg-card text-foreground px-3 py-2 text-sm`}
                required
              />
              {duplicateProductNameError && (
                <p className="mt-1.5 text-xs font-medium text-destructive">
                  {duplicateProductNameError}
                </p>
              )}
            </div>

            {/* Status (Shown ONLY when editing) */}
            {isEditing && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Status
                </label>
                <select
                  value={isActive ? "true" : "false"}
                  onChange={(e) => handleTopLevelStatusChange(e.target.value === "true")}
                  className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm h-9"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}

            {/* Product Description */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Product Description
              </label>
              <textarea
                rows={2}
                placeholder="Detailed description of finished product, ingredients summary, or production notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Optional Photo Upload (1 per product) */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Product Photo <span className="text-muted-foreground font-normal">(Optional — Shared across product variants)</span>
              </label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-border shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl border border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0 text-muted-foreground">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    id="product-photo-upload"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="product-photo-upload"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer transition-colors shadow-xs"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    {photoFile || photoPreview ? "Change Photo" : "Upload Photo"}
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    JPG, PNG, or WebP up to 10MB
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Product Variants ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Product Variants
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure Content Size, Unit of Measurement, and Packaging Type to auto-generate Variant Name &amp; SKU
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddVariant}
              className="rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Variant
            </Button>
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
                  className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">
                        {index + 1}
                      </span>
                      Variant {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {isEditing && v.existingProductId && variants.length > 1 && (
                        <select
                          aria-label={`Variant ${index + 1} Status`}
                          value={v.isActive ? "true" : "false"}
                          onChange={(e) =>
                            handleVariantStatusChange(v.id, e.target.value === "true")
                          }
                          className="rounded-lg border border-border bg-card text-foreground px-2.5 py-1 text-xs font-medium h-7"
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      )}
                      {!v.existingProductId && variants.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveVariant(v.id)}
                          className="text-xs h-7 text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Row 1: Variant Name (Auto, Read-Only) & Variant SKU (Auto, Read-Only) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Variant Name <span className="text-muted-foreground font-normal">(Auto-generated)</span>
                      </label>
                      <Input
                        type="text"
                        value={composedVariantName}
                        readOnly
                        disabled
                        className="w-full rounded-xl border border-border bg-muted/40 text-foreground px-3 py-2 text-sm font-semibold cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Variant SKU <span className="text-muted-foreground font-normal">(Unique)</span>
                      </label>
                      <Input
                        type="text"
                        value={previewSku}
                        readOnly
                        disabled
                        className="w-full rounded-xl border border-border bg-muted/40 text-muted-foreground px-3 py-2 text-sm cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Row 2: Content Size, Unit of Measurement, Packaging Type */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Content Size */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Content Size <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="e.g. 250, 350"
                        value={v.contentSize}
                        onChange={(e) =>
                          handleUpdateVariantField(v.id, "contentSize", e.target.value)
                        }
                        className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm"
                        required
                      />
                    </div>

                    {/* Unit of Measurement (Name + Abbreviation like Supply creation) */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Unit of Measurement <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={v.contentUom}
                        onChange={(e) =>
                          handleUpdateVariantField(v.id, "contentUom", e.target.value)
                        }
                        className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm h-9"
                      >
                        {CONTENT_UOM_OPTIONS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Packaging Type (Jar, Container, Pouch) */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Packaging Type <span className="text-destructive">*</span>
                      </label>
                      <select
                        value={v.packagingType}
                        onChange={(e) =>
                          handleUpdateVariantField(v.id, "packagingType", e.target.value)
                        }
                        className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm h-9"
                      >
                        {PACKAGING_TYPES.map((pkg) => (
                          <option key={pkg} value={pkg}>
                            {pkg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Min Stock Level & Max Stock Level (Per Variant, matches SupplyModal) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Min Stock Level <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="e.g. 10"
                        value={v.minStockLevel}
                        onChange={(e) =>
                          handleUpdateVariantField(v.id, "minStockLevel", e.target.value)
                        }
                        className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Max Stock Level <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="e.g. 100"
                        value={v.maxStockLevel}
                        onChange={(e) =>
                          handleUpdateVariantField(v.id, "maxStockLevel", e.target.value)
                        }
                        className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer Actions (Exact SupplyModal pattern) ── */}
        <div className="flex justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
          <ModalCloseButton
            type="button"
            variant="outline"
            fallbackOnClose={onClose}
            disabled={submitting}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
          >
            Cancel
          </ModalCloseButton>
          <Button
            type="submit"
            disabled={submitting || Boolean(duplicateProductNameError)}
            className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : isEditing ? "Save Changes" : "Save Finished Product"}
          </Button>
        </div>
      </form>
    </ModalWrapper>
  );
}
