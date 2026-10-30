"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Image as ImageIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { actionResponse } from "@/lib/resources/action-response";
import {
  listProductFormLookups,
  createFinishedProductWithVariants,
} from "@/app/actions/production/products";
import { syncProductCatalogToPos } from "@/app/actions/production/pos-sync";
import { uploadProductionImage } from "@/lib/production/image-client";
import { buildBaseVariantSku } from "@/lib/production/sku";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";

interface VariantRow {
  id: string;
  variantName: string;
  unitCost: string;
  sellingPrice: string;
}

interface AddFinishedProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddFinishedProductModal({
  open,
  onClose,
  onSuccess,
}: AddFinishedProductModalProps) {
  // UOM Lookups (Jar, Container, Pouch)
  const [uoms, setUoms] = useState<{ uomId: number; name: string; abbreviation: string }[]>([
    { uomId: 1, name: "Jar", abbreviation: "jar" },
    { uomId: 2, name: "Container", abbreviation: "container" },
    { uomId: 3, name: "Pouch", abbreviation: "pouch" },
  ]);
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | undefined>(undefined);
  const [loadingLookups, setLoadingLookups] = useState(false);

  // Basic Information
  const [productName, setProductName] = useState("");
  const [uomId, setUomId] = useState<string>("1");
  const [description, setDescription] = useState("");

  // Pricing Information
  const [unitCost, setUnitCost] = useState<string>("");

  // Product Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  // Product Variants
  const [variants, setVariants] = useState<VariantRow[]>([
    { id: "var-1", variantName: "250g Container", unitCost: "", sellingPrice: "150" },
  ]);

  const [submitting, setSubmitting] = useState(false);

  // Load UOM lookup IDs whenever modal opens
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    async function load() {
      try {
        setLoadingLookups(true);
        const res = await actionResponse(listProductFormLookups());
        const payload: any = (res.data as any)?.data || res.data;
        if (isMounted && payload) {
          if (Array.isArray(payload.uoms) && payload.uoms.length > 0) {
            setUoms(payload.uoms);
            setUomId(String(payload.uoms[0].uomId));
          }
          if (payload.defaultCategoryId) {
            setDefaultCategoryId(payload.defaultCategoryId);
          }
        }
      } catch (err: any) {
        console.warn("Could not load packaging UOM list, using standard choices:", err);
      } finally {
        if (isMounted) setLoadingLookups(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [open]);

  // Reset form when modal closes or opens
  useEffect(() => {
    if (open) {
      setProductName("");
      setDescription("");
      setUnitCost("");
      setPhotoFile(null);
      setPhotoPreview("");
      setVariants([
        { id: `var-${Date.now()}-1`, variantName: "250g Container", unitCost: "", sellingPrice: "150" },
      ]);
    }
  }, [open]);

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: `var-${Date.now()}-${prev.length + 1}`,
        variantName: "",
        unitCost: unitCost || "",
        sellingPrice: "",
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

  const handleUpdateVariant = (id: string, field: keyof VariantRow, value: string) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB.");
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
    if (!uomId) {
      toast.error("Unit of Measurement is required.");
      return;
    }

    const prodUnitCost = parseFloat(unitCost);
    if (isNaN(prodUnitCost) || prodUnitCost < 0) {
      toast.error("Please enter a valid Unit Cost (₱) for manufacturing one unit.");
      return;
    }

    if (variants.length === 0) {
      toast.error("Please add at least one variant.");
      return;
    }

    // Validate variants
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.variantName.trim()) {
        toast.error(`Variant ${i + 1} requires a Variant Name (e.g. '250g Jar').`);
        return;
      }
      const sPrice = parseFloat(v.sellingPrice);
      if (isNaN(sPrice) || sPrice < 0) {
        toast.error(`Variant ${i + 1} requires a valid Selling Price.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      toast.loading("Creating finished product & generating SKUs...", { id: "save-prod" });

      const selectedUom = uoms.find((u) => String(u.uomId) === String(uomId));

      const payload = {
        productName: trimmedName,
        categoryId: defaultCategoryId,
        uomId: parseInt(uomId, 10),
        uomName: selectedUom?.name,
        description: description.trim() || undefined,
        unitCost: prodUnitCost,
        variants: variants.map((v) => ({
          variantName: v.variantName.trim(),
          unitCost: v.unitCost.trim() ? parseFloat(v.unitCost) : prodUnitCost,
          sellingPrice: parseFloat(v.sellingPrice),
        })),
      };

      const res = await actionResponse(createFinishedProductWithVariants(payload));
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to create product");
      }

      const createdVariants = res.data?.data?.variants || [];
      const createdIds = createdVariants.map((v: any) => v.productId).filter(Boolean);

      // Upload photo if provided
      if (photoFile && createdIds.length > 0) {
        for (const pid of createdIds) {
          try {
            await uploadProductionImage("product", pid, photoFile);
          } catch (uploadErr) {
            console.warn("Photo upload warning:", uploadErr);
          }
        }
      }

      toast.success(
        `Finished Product "${trimmedName}" created with ${createdVariants.length} variant(s)!`,
        { id: "save-prod" }
      );

      // Trigger automatic POS sync
      actionResponse(syncProductCatalogToPos(trimmedName))
        .then((posRes) => {
          if (posRes.data?.success) {
            toast.success(`Synced "${trimmedName}" to POS catalog!`);
          }
        })
        .catch((err) => {
          console.warn("POS sync deferred notice:", err?.message);
        });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save finished product", { id: "save-prod" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper open={open} title="Add Finished Product" onClose={onClose} size="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Section 1: Product Information ── */}
        <div className="space-y-4">
          <div className="border-b border-border-subtle pb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Product Information
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Basic product catalog metadata and identification
              </p>
            </div>
            <span className="text-[11px] font-medium bg-muted/60 text-muted-foreground px-2.5 py-1 rounded-md border border-border/50">
              Category: <strong className="text-foreground">Finished Product</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Product Name */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Product Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Ube Halaya Supreme"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="text-xs h-9"
                required
              />
            </div>

            {/* Unit of Measurement: Only Jar, Container, or Pouch */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Unit of Measurement <span className="text-destructive">*</span>
              </label>
              <Select value={uomId} onValueChange={setUomId} disabled={loadingLookups}>
                <SelectTrigger className="text-xs h-9 bg-background">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                  {uoms.map((u) => (
                    <SelectItem key={u.uomId} value={String(u.uomId)} className="text-xs">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Code / SKU (Read-only, System Generated) */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                <span>Product Code / SKU <span className="text-destructive">*</span></span>
                <span className="text-[10px] font-medium text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> System Generated
                </span>
              </label>
              <Input
                type="text"
                value={
                  productName.trim()
                    ? `FP-2026-XXXX (${buildBaseVariantSku(productName, "STD")})`
                    : "FP-2026-XXXX (Auto-generated on save)"
                }
                readOnly
                disabled
                className="text-xs h-9 bg-muted/60 text-muted-foreground cursor-not-allowed font-mono"
              />
            </div>

            {/* Product Description */}
            <div className="md:col-span-3">
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Product Description
              </label>
              <textarea
                rows={2}
                placeholder="Detailed description of finished product, ingredients summary, or production notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Optional Photo Attachment */}
            <div className="md:col-span-3">
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Product Photo <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0 text-muted-foreground">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    id="product-photo-upload"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="product-photo-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted cursor-pointer transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    {photoFile ? "Change Photo" : "Upload Photo"}
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    JPG, PNG, or WebP up to 5MB
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Pricing Information ── */}
        <div className="space-y-3 pt-2">
          <div className="border-b border-border-subtle pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Pricing Information
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Standard manufacturing unit cost
            </p>
          </div>

          <div className="max-w-xs">
            <label className="text-xs font-semibold text-foreground mb-1 block">
              Unit Cost (₱) <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                ₱
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="pl-7 text-xs h-9"
                required
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Cost to manufacture one unit.
            </p>
          </div>
        </div>

        {/* ── Section 3: Product Variants ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Product Variants
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define packaging sizes, SKUs, and retail prices (synchronized with POS)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddVariant}
              className="text-xs h-8 gap-1.5 cursor-pointer border-border hover:bg-muted"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Variant
            </Button>
          </div>

          <div className="space-y-3">
            {variants.map((v, index) => {
              const previewSku = buildBaseVariantSku(
                productName || "PRD",
                v.variantName || `VAR-${index + 1}`
              );

              return (
                <div
                  key={v.id}
                  className="p-4 rounded-xl border border-border bg-card/60 space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">
                        {index + 1}
                      </span>
                      Variant {index + 1}
                    </span>
                    {variants.length > 1 && (
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Variant Name */}
                    <div>
                      <label className="text-[11px] font-semibold text-foreground mb-1 block">
                        Variant Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. 250g Container, 300g Jar"
                        value={v.variantName}
                        onChange={(e) => handleUpdateVariant(v.id, "variantName", e.target.value)}
                        className="text-xs h-8"
                        required
                      />
                    </div>

                    {/* Variant SKU (System Generated Preview) */}
                    <div>
                      <label className="text-[11px] font-semibold text-foreground mb-1 flex items-center justify-between">
                        <span>Variant SKU</span>
                        <span className="text-[10px] text-primary">Auto</span>
                      </label>
                      <Input
                        type="text"
                        value={previewSku}
                        readOnly
                        disabled
                        className="text-xs h-8 bg-muted/60 text-muted-foreground font-mono cursor-not-allowed"
                      />
                    </div>

                    {/* Unit Cost */}
                    <div>
                      <label className="text-[11px] font-semibold text-foreground mb-1 block">
                        Unit Cost (₱)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          ₱
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={unitCost || "0.00"}
                          value={v.unitCost}
                          onChange={(e) => handleUpdateVariant(v.id, "unitCost", e.target.value)}
                          className="pl-6 text-xs h-8"
                        />
                      </div>
                    </div>

                    {/* Selling Price */}
                    <div>
                      <label className="text-[11px] font-semibold text-foreground mb-1 block">
                        Selling Price (₱) <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          ₱
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={v.sellingPrice}
                          onChange={(e) => handleUpdateVariant(v.id, "sellingPrice", e.target.value)}
                          className="pl-6 text-xs h-8 font-semibold"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="text-xs h-9 px-4 cursor-pointer border-border hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="text-xs h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer font-semibold"
          >
            {submitting ? "Saving & Syncing POS..." : "Save Finished Product"}
          </Button>
        </div>
      </form>
    </ModalWrapper>
  );
}
