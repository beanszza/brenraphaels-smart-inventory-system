"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  // Product Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  // Product Variants
  const [variants, setVariants] = useState<VariantRow[]>([
    { id: "var-1", variantName: "250g Container", unitCost: "150" },
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

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setProductName("");
      setDescription("");
      setPhotoFile(null);
      setPhotoPreview("");
      setVariants([
        { id: `var-${Date.now()}-1`, variantName: "250g Container", unitCost: "150" },
      ]);
    }
  }, [open]);

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: `var-${Date.now()}-${prev.length + 1}`,
        variantName: "",
        unitCost: "",
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
      const cost = parseFloat(v.unitCost);
      if (isNaN(cost) || cost < 0) {
        toast.error(`Variant ${i + 1} requires a valid Unit Cost (₱).`);
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
        variants: variants.map((v) => ({
          variantName: v.variantName.trim(),
          unitCost: parseFloat(v.unitCost),
          sellingPrice: parseFloat(v.unitCost),
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
    <ModalWrapper open={open} title="Add Finished Product" onClose={onClose} size="max-w-3xl">
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
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Product Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Ube Halaya Supreme"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm"
                required
              />
            </div>

            {/* Unit of Measurement: Jar, Container, or Pouch */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Unit of Measurement <span className="text-destructive">*</span>
              </label>
              <select
                value={uomId}
                onChange={(e) => setUomId(e.target.value)}
                disabled={loadingLookups}
                className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm"
              >
                {uoms.map((u) => (
                  <option key={u.uomId} value={String(u.uomId)}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Code / SKU */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Product Code / SKU
              </label>
              <Input
                type="text"
                value={
                  productName.trim()
                    ? buildBaseVariantSku(productName, "STD")
                    : "Auto-generated upon save"
                }
                readOnly
                disabled
                className="w-full rounded-xl border border-border bg-muted/40 text-muted-foreground px-3 py-2 text-sm font-mono cursor-not-allowed"
              />
            </div>

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

            {/* Optional Photo Upload */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Product Photo <span className="text-muted-foreground font-normal">(Optional)</span>
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
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="product-photo-upload"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer transition-colors shadow-xs"
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

        {/* ── Section 2: Product Variants ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Product Variants
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define packaging sizes, SKUs, and unit cost
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
              const previewSku = buildBaseVariantSku(
                productName || "PRD",
                v.variantName || `VAR-${index + 1}`
              );

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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Variant Name */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Variant Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. 250g Container, 300g Jar"
                        value={v.variantName}
                        onChange={(e) => handleUpdateVariant(v.id, "variantName", e.target.value)}
                        className="w-full rounded-xl border border-border bg-card text-foreground px-3 py-2 text-sm"
                        required
                      />
                    </div>

                    {/* Variant SKU */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Variant SKU
                      </label>
                      <Input
                        type="text"
                        value={previewSku}
                        readOnly
                        disabled
                        className="w-full rounded-xl border border-border bg-muted/40 text-muted-foreground px-3 py-2 text-sm font-mono cursor-not-allowed"
                      />
                    </div>

                    {/* Unit Cost */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Unit Cost (₱) <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          ₱
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={v.unitCost}
                          onChange={(e) => handleUpdateVariant(v.id, "unitCost", e.target.value)}
                          className="w-full rounded-xl border border-border bg-card text-foreground pl-7 pr-3 py-2 text-sm font-semibold"
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

        {/* ── Footer Actions (Exact SupplyModal pattern) ── */}
        <div className="flex justify-end gap-3 pt-5 pb-3 border-t border-border mt-6 mb-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/85 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving & Syncing POS..." : "Save Finished Product"}
          </Button>
        </div>
      </form>
    </ModalWrapper>
  );
}
