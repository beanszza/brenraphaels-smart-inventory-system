"use client";
import { ProductionSkeleton } from "./ProductionSkeleton";
import { listFinishedProducts as productionListFinishedProducts } from "@/app/actions/production/products";
import { createFinishedProduct as productionCreateFinishedProduct } from "@/app/actions/production/products";
import { updateFinishedProduct as productionUpdateFinishedProduct } from "@/app/actions/production/product-detail";
import { deleteFinishedProduct as productionDeleteFinishedProduct } from "@/app/actions/production/product-detail";
import {
  syncProductCatalogToPos,
  syncAllFinishedProductsToPos,
} from "@/app/actions/production/pos-sync";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Image as ImageIcon,
  MoreHorizontal,
  Pencil,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FinishedProductItem } from "./types";
import AddFinishedProductModal from "./AddFinishedProductModal";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { uploadProductionImage } from "@/lib/production/image-client";
import { ProductionImage } from "./ProductionImage";
import { toast } from "sonner";


const PACKAGING_TYPES = [
  "Tub",
  "Jar",
  "Pack",
  "Bottle",
  "Pouch",
  "Box",
  "Can",
  "Tin",
];

const PRODUCT_CATEGORIES = [
  "Jam & Preserves",
  "Spreads & Fillings",
  "Bakery Fillings",
  "Confectionery",
  "Dessert Base",
  "Finished Goods",
  "Other",
];

interface DraftVariant {
  packagingType: string;
  size: string;
  sku: string;
  price: number;
}

export default function ConfigurationTab({ initialRows }: { initialRows: FinishedProductItem[] }) {
  const [products, setProducts] = useState<FinishedProductItem[]>(initialRows);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [syncingPos, setSyncingPos] = useState(false);

  // ── Add Full Product Modal (with multiple variations) ──
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("Finished Goods");
  const [productPhotoFile, setProductPhotoFile] = useState<File | null>(null);
  const [productPhotoPreview, setProductPhotoPreview] = useState<string>("");
  const [variationsList, setVariationsList] = useState<DraftVariant[]>([
    { packagingType: "Tub", size: "250g", sku: "UBH-TUB-250G", price: 150 },
  ]);

  // Inline add variation in the full product modal
  const [newVarType, setNewVarType] = useState("Jar");
  const [newVarSize, setNewVarSize] = useState("");
  const [newVarSku, setNewVarSku] = useState("");
  const [newVarPrice, setNewVarPrice] = useState<number | "">(200);

  // ── Quick Add Single Variant Modal (to an existing or selected product) ──
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false);
  const [targetProductName, setTargetProductName] = useState("");
  const [quickVarType, setQuickVarType] = useState("Tub");
  const [quickVarSize, setQuickVarSize] = useState("");
  const [quickVarSku, setQuickVarSku] = useState("");
  const [quickVarPrice, setQuickVarPrice] = useState<number | "">(150);

  // ── Edit Single Variant Modal ──
  const [isEditVariantOpen, setIsEditVariantOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinishedProductItem | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editVariantStr, setEditVariantStr] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editPrice, setEditPrice] = useState<number | "">(0);
  const [editUnitCost, setEditUnitCost] = useState<number | "">(0);
  const [quickVarUnitCost, setQuickVarUnitCost] = useState<number | "">(0);

  const [submitting, setSubmitting] = useState(false);

  // File upload refs
  const fullProductFileRef = useRef<HTMLInputElement>(null);
  const rowFileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadProductId, setActiveUploadProductId] = useState<number | null>(null);

  // 3-dots dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await actionResponse(productionListFinishedProducts());
      const list = res.data?.data || res.data || [];
      setProducts(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load finished products");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAllToPos = async () => {
    try {
      setSyncingPos(true);
      toast.loading("Synchronizing products with Point-of-Sale (POS)...", { id: "pos-sync" });
      const res = await actionResponse(syncAllFinishedProductsToPos());
      if (res.data?.success) {
        toast.success(res.data.message || "All products synced to POS successfully!", { id: "pos-sync" });
      } else {
        toast.error(res.data?.message || "POS sync returned an error.", { id: "pos-sync" });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to communicate with POS service.", { id: "pos-sync" });
    } finally {
      setSyncingPos(false);
    }
  };


  // Distinct product names for the quick-add variant selector
  const distinctProductNames = Array.from(
    new Set(products.map((p) => p.itemName).filter(Boolean))
  );

  // Auto-generate canonical system SKU from product name, packaging type, and size
  const generateSku = (prodName: string, type: string, size: string) => {
    const cleanName = (prodName || "").trim().toLowerCase();

    // Check known product abbreviations
    let pCode = "";
    if (cleanName.includes("smooth")) {
      pCode = "UBH-SM";
    } else if (cleanName.includes("tidbit")) {
      pCode = "UBH-TB";
    } else if (cleanName.includes("ube") && cleanName.includes("halaya")) {
      pCode = "UBH";
    } else {
      const words = (prodName || "PRD").trim().split(/\s+/).filter(Boolean);
      pCode = words
        .map((w) => w[0])
        .join("")
        .slice(0, 4)
        .toUpperCase();
      if (!pCode) pCode = "PRD";
    }

    // Packaging Type Code
    const cleanType = (type || "").trim().toLowerCase();
    let tCode = "";
    if (cleanType.includes("tub")) tCode = "TUB";
    else if (cleanType.includes("jar")) tCode = "JAR";
    else if (cleanType.includes("pouch")) tCode = "POU";
    else if (cleanType.includes("bottle")) tCode = "BTL";
    else if (cleanType.includes("can")) tCode = "CAN";
    else if (cleanType.includes("box")) tCode = "BOX";
    else tCode = (type || "PKG").trim().slice(0, 3).toUpperCase();

    // Size Code
    const cleanSize = (size || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const sCode = cleanSize || "STD";

    if (pCode.includes("-")) {
      return `${pCode}-${sCode}`;
    }
    return `${pCode}-${tCode}-${sCode}`;
  };

  // ── Open Add Full Product Modal ──
  const handleOpenAddProduct = () => {
    setProductName("");
    setProductCategory("Finished Goods");
    setProductPhotoFile(null);
    setProductPhotoPreview("");
    setVariationsList([
      { packagingType: "Tub", size: "250g", sku: generateSku("Ube Halaya", "Tub", "250g"), price: 150 },
    ]);
    setNewVarType("Jar");
    setNewVarSize("500g");
    setNewVarSku(generateSku("Ube Halaya", "Jar", "500g"));
    setNewVarPrice(280);
    setIsAddProductOpen(true);
  };

  // Add draft variation to the list inside the full product modal
  const handleAddDraftVariation = () => {
    if (!newVarSize.trim()) {
      toast.error("Please enter a size (e.g. 500g, 1kg)");
      return;
    }
    const skuCode = generateSku(productName || "PRD", newVarType, newVarSize);
    const priceVal = Number(newVarPrice) || 0;

    setVariationsList((prev) => [
      ...prev,
      {
        packagingType: newVarType,
        size: newVarSize.trim(),
        sku: skuCode.toUpperCase(),
        price: priceVal,
      },
    ]);

    setNewVarSize("");
    setNewVarSku(generateSku(productName || "PRD", newVarType, ""));
    setNewVarPrice(150);
  };

  const handleRemoveDraftVariation = (index: number) => {
    setVariationsList((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit full product creation with multiple variations
  const handleSaveFullProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (variationsList.length === 0) {
      toast.error("Please add at least one variation (e.g. 250g Tub)");
      return;
    }

    try {
      setSubmitting(true);
      toast.loading("Creating product and variations...", { id: "save-prod" });

      const createdProductIds: number[] = [];

      // Create each variation via POST /api/FinishedProducts
      for (const v of variationsList) {
        const variantLabel = `${v.size} ${v.packagingType}`.trim();
        const res = await actionResponse(productionCreateFinishedProduct({
          productName: productName.trim(),
          variant: variantLabel,
          sellingPrice: v.price,
          sku: v.sku.toUpperCase(),
        }));
        const id = res.data?.data?.productId;
        if (id) createdProductIds.push(id);
      }

      // If a photo was selected, upload it to the created variants
      let photoFailure: string | null = null;
      if (productPhotoFile && createdProductIds.length > 0) {
        for (const pid of createdProductIds) {
          try {
            await uploadProductionImage("product", pid, productPhotoFile);
          } catch (err) {
            // The product is saved; only its photo is missing, so say so without failing the create.
            photoFailure = err instanceof Error ? err.message : "The photo could not be uploaded.";
          }
        }
      }

      toast.success(
        `Product "${productName.trim()}" created with ${variationsList.length} variation(s)!`,
        { id: "save-prod" }
      );
      if (photoFailure) toast.error(`The product photo was not saved: ${photoFailure}`);
      setIsAddProductOpen(false);
      setPhotoVersion((v) => v + 1);
      fetchProducts();

      // Automatically sync newly created product & variations with POS
      const targetName = productName.trim();
      actionResponse(syncProductCatalogToPos(targetName))
        .then((posRes) => {
          if (posRes.data?.success) {
            toast.success(`Synced "${targetName}" to POS catalog!`);
          }
        })
        .catch(() => {});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create product variations", {
        id: "save-prod",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open Quick Add Single Variant Modal ──
  const handleOpenAddVariant = (prefillProductName?: string) => {
    const prodName = prefillProductName || distinctProductNames[0] || "";
    setTargetProductName(prodName);
    setQuickVarType("Jar");
    setQuickVarSize("500g");
    setQuickVarSku(generateSku(prodName, "Jar", "500g"));
    setQuickVarPrice(250);
    setIsAddVariantOpen(true);
  };

  const handleSaveQuickVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProductName.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!quickVarSize.trim()) {
      toast.error("Variant size is required");
      return;
    }

    try {
      setSubmitting(true);
      const variantLabel = `${quickVarSize.trim()} ${quickVarType}`.trim();
      const skuVal = generateSku(targetProductName, quickVarType, quickVarSize);

      await actionResponse(productionCreateFinishedProduct({
        productName: targetProductName.trim(),
        variant: variantLabel,
        sellingPrice: Number(quickVarPrice) || 0,
        sku: skuVal.toUpperCase(),
      }));

      toast.success(`Variant "${variantLabel}" added to ${targetProductName}!`);
      setIsAddVariantOpen(false);
      fetchProducts();

      // Automatically sync updated variations with POS
      actionResponse(syncProductCatalogToPos(targetProductName.trim()))
        .then((posRes) => {
          if (posRes.data?.success) {
            toast.success(`Updated "${targetProductName.trim()}" variations in POS!`);
          }
        })
        .catch(() => {});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add variant");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open Edit Single Variant Modal ──
  const handleOpenEditVariant = (prod: FinishedProductItem) => {
    setEditingItem(prod);
    setEditProductName(prod.itemName);
    setEditVariantStr(prod.variant || "");
    setEditSku(prod.sku || "");
    setEditPrice(prod.sellingPrice || 0);
    setIsEditVariantOpen(true);
  };

  const handleSaveEditVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      setSubmitting(true);
      await actionResponse(productionUpdateFinishedProduct(editingItem.productId, {
        productName: editProductName.trim(),
        variant: editVariantStr.trim(),
        sellingPrice: Number(editPrice) || 0,
        sku: editSku.trim().toUpperCase(),
      }));

      toast.success("Variant details updated successfully");
      setIsEditVariantOpen(false);
      fetchProducts();

      // Automatically sync updated variant with POS
      actionResponse(syncProductCatalogToPos(editProductName.trim()))
        .then((posRes) => {
          if (posRes.data?.success) {
            toast.success(`Updated "${editProductName.trim()}" in POS!`);
          }
        })
        .catch(() => {});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update variant");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete Variant ──
  const handleDeleteVariant = async (productId: number, variantLabel: string) => {
    if (!confirm(`Are you sure you want to remove variant "${variantLabel}"?`)) return;

    try {
      await actionResponse(productionDeleteFinishedProduct(productId));
      toast.success("Variant removed successfully");
      fetchProducts();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Cannot delete variant because it may be linked to recipes or batches"
      );
    }
  };

  // ── Row Photo Upload Handler ──
  const handleRowUploadClick = (productId: number) => {
    setActiveUploadProductId(productId);
    rowFileInputRef.current?.click();
  };

  const handleRowFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadProductId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size exceeds 10MB limit");
      return;
    }

    try {
      toast.loading("Uploading photo...", { id: "upload-photo" });
      await uploadProductionImage("product", activeUploadProductId, file);
      toast.success("Product photo updated successfully", { id: "upload-photo" });
      setPhotoVersion((v) => v + 1);
      fetchProducts();
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload photo", {
        id: "upload-photo",
      });
    } finally {
      setActiveUploadProductId(null);
      if (rowFileInputRef.current) rowFileInputRef.current.value = "";
    }
  };

  // Filtered records
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.itemName?.toLowerCase().includes(q) ||
      p.variant?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Hidden file input for row photo uploads */}
      <input
        type="file"
        ref={rowFileInputRef}
        onChange={handleRowFileChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {/* Top Header & Add Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Finished Products &amp; Variants
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure finished goods, packaging types, sizes, SKUs, and selling prices
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProducts}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 rounded-xl border-border hover:bg-muted font-semibold text-xs text-foreground cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {/* Sync with POS button */}
          <Button
            variant="outline"
            size="sm"
            disabled={syncingPos}
            onClick={handleSyncAllToPos}
            className="flex items-center justify-center gap-1.5 h-9 rounded-xl border-border hover:bg-muted font-semibold text-xs text-foreground cursor-pointer shadow-sm"
            title="Sync all finished products and packaging variations with the Point-of-Sale (POS) system"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${syncingPos ? "animate-spin" : ""}`} />
            {syncingPos ? "Syncing POS..." : "Sync with POS"}
          </Button>

          {/* Dedicated "+ Add Variant" button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenAddVariant()}
            className="flex items-center justify-center gap-1.5 h-9 rounded-xl border-border hover:bg-muted font-semibold text-xs text-foreground cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-foreground" />
            Add Variant
          </Button>

          {/* "+ Add Product" button */}
          <Button
            onClick={handleOpenAddProduct}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Full-width Search Bar (Follows Orders & Procurement PRTab style) */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-muted/20">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by product name, variant, size, or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-sm flex-1 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium pl-1 hidden sm:inline">
            Showing {filteredProducts.length} variant record(s)
          </span>
        </div>
      </div>

      {/* Products & Variants Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        {loading ? (
          <ProductionSkeleton />
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-xs">
            {searchQuery
              ? `No products found matching "${searchQuery}".`
              : "No finished products configured yet. Click 'Add Product' to create one."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px] border-b border-border">
                <tr>
                  <th className="py-3 px-4 w-12">Photo</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Variant / Size</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((product) => {
                  const isOpen = openDropdownId === product.productId;

                  return (
                    <tr
                      key={product.productId}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Thumbnail */}
                      <td className="py-2.5 px-4">
                        <div className="w-9 h-9 rounded-md border border-border bg-muted/30 overflow-hidden flex items-center justify-center shrink-0">
                          <ProductionImage
                            kind="product" id={product.productId}
                            alt={product.itemName}
                            className="w-full h-full object-cover"
                            version={photoVersion}
                          />
                        </div>
                      </td>

                      {/* Product Name */}
                      <td className="py-2.5 px-4 font-semibold text-foreground">
                        {product.itemName}
                      </td>

                      {/* Variant / Size */}
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-muted text-foreground border border-border/60">
                          {product.variant || "Standard"}
                        </span>
                      </td>

                      {/* SKU */}
                      <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                        {product.sku || "—"}
                      </td>

                      {/* Price */}
                      <td className="py-2.5 px-4 font-mono font-semibold text-foreground">
                        ₱{Number(product.sellingPrice || 0).toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4">
                        <StatusBadge status="Active" />
                      </td>

                      {/* Actions: 3-dots Dropdown Menu (Pattern from PRTable.tsx) */}
                      <td className="py-2.5 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg border border-transparent text-foreground hover:bg-muted/80 transition-all data-[state=open]:bg-muted data-[state=open]:border-border data-[state=open]:shadow-sm cursor-pointer"
                              aria-label="Actions menu"
                            >
                              <MoreHorizontal className="w-4 h-4 text-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 z-[200]">
                            {/* Add Variant to this product */}
                            <DropdownMenuItem
                              onClick={() => handleOpenAddVariant(product.itemName)}
                              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-foreground shrink-0" />
                              <span className="truncate text-foreground">
                                Add Variant
                              </span>
                            </DropdownMenuItem>

                            {/* Edit Variant */}
                            <DropdownMenuItem
                              onClick={() => handleOpenEditVariant(product)}
                              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-foreground shrink-0" />
                              <span className="truncate text-foreground">
                                Edit Variant
                              </span>
                            </DropdownMenuItem>

                            {/* Upload Photo */}
                            <DropdownMenuItem
                              onClick={() => handleRowUploadClick(product.productId)}
                              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5 text-foreground shrink-0" />
                              <span className="truncate text-foreground">
                                Upload Photo
                              </span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Delete Variant */}
                            <DropdownMenuItem
                              onClick={() => handleDeleteVariant(
                                product.productId,
                                product.variant || product.itemName
                              )}
                              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                Delete Variant
                              </span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. ADD PRODUCT MODAL (WITH MULTIPLE VARIATIONS)
          ───────────────────────────────────────────────────────────── */}
      <AddFinishedProductModal
        open={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSuccess={() => {
          fetchProducts();
          setPhotoVersion((v) => v + 1);
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          2. QUICK ADD SINGLE VARIANT MODAL
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={isAddVariantOpen} onOpenChange={setIsAddVariantOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border p-6 shadow-2xl">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-base font-bold text-foreground">
              Add Variant to Product
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new size, packaging type, SKU, and price to a finished product
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveQuickVariant} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Target Product <span className="text-foreground">*</span>
              </label>
              {distinctProductNames.length > 0 ? (
                <Select
                  value={targetProductName}
                  onValueChange={(val) => {
                    setTargetProductName(val);
                    setQuickVarSku(generateSku(val, quickVarType, quickVarSize));
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {distinctProductNames.map((name) => (
                      <SelectItem key={name} value={name} className="text-xs">
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="e.g. Ube Halaya Supreme"
                  value={targetProductName}
                  onChange={(e) => setTargetProductName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Packaging Type <span className="text-foreground">*</span>
                </label>
                <Select
                  value={quickVarType}
                  onValueChange={(val) => {
                    setQuickVarType(val);
                    setQuickVarSku(generateSku(targetProductName, val, quickVarSize));
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGING_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Size / Net Weight <span className="text-foreground">*</span>
                </label>
                <Input
                  placeholder="e.g. 500g, 1kg"
                  value={quickVarSize}
                  onChange={(e) => {
                    setQuickVarSize(e.target.value);
                    setQuickVarSku(
                      generateSku(targetProductName, quickVarType, e.target.value)
                    );
                  }}
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">
                    SKU Code
                  </label>
                  <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-medium">
                    System Generated
                  </span>
                </div>
                <div className="relative">
                  <Input
                    readOnly
                    title="SKU is automatically generated by the system"
                    value={quickVarSku || generateSku(targetProductName, quickVarType, quickVarSize)}
                    className="h-9 text-xs font-mono bg-muted/40 text-muted-foreground cursor-not-allowed border-dashed select-none pr-12"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/70 pointer-events-none">
                    Locked
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Selling Price (₱) <span className="text-foreground">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="250.00"
                  value={quickVarPrice}
                  onChange={(e) =>
                    setQuickVarPrice(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddVariantOpen(false)}
                className="text-xs font-semibold border-border hover:bg-muted cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                {submitting ? "Adding..." : "Add Variant"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          3. EDIT SINGLE VARIANT MODAL
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={isEditVariantOpen} onOpenChange={setIsEditVariantOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border p-6 shadow-2xl">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-base font-bold text-foreground">
              Edit Product Variant
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update variant size, SKU code, or selling price
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditVariant} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Product Name
              </label>
              <Input
                value={editProductName}
                onChange={(e) => setEditProductName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Variant / Size &amp; Packaging <span className="text-foreground">*</span>
              </label>
              <Input
                placeholder="e.g. 500g Jar"
                value={editVariantStr}
                onChange={(e) => setEditVariantStr(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">
                    SKU Code
                  </label>
                  <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono font-medium">
                    System Identifier
                  </span>
                </div>
                <div className="relative">
                  <Input
                    readOnly
                    title="SKU is an immutable system identifier"
                    value={editSku}
                    className="h-9 text-xs font-mono bg-muted/40 text-muted-foreground cursor-not-allowed border-dashed select-none pr-12"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/70 pointer-events-none">
                    Locked
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Selling Price (₱) <span className="text-foreground">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="250.00"
                  value={editPrice}
                  onChange={(e) =>
                    setEditPrice(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditVariantOpen(false)}
                className="text-xs font-semibold border-border hover:bg-muted cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
