"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Plus,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Pagination from "@/components/Pagination";
import ResourceStatusTabs from "@/components/resources-suppliers/ResourceStatusTabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProductionSkeleton } from "./ProductionSkeleton";
import { FinishedProductItem } from "./types";
import AddFinishedProductModal from "./AddFinishedProductModal";
import { ProductionImage } from "./ProductionImage";
import { listFinishedProducts as productionListFinishedProducts } from "@/app/actions/production/products";
import { syncAllFinishedProductsToPos } from "@/app/actions/production/pos-sync";
import { actionResponse } from "@/lib/resources/action-response";
import { parseVariantComponents, formatVariantUomLabel } from "@/lib/production/sku";
import { toast } from "sonner";

const PACKAGING_FILTERS = ["All", "Jar", "Container", "Pouch"] as const;

let lastPosAutoSyncAt = 0;

export default function ConfigurationTab({
  initialRows,
}: {
  initialRows: FinishedProductItem[];
}) {
  const [products, setProducts] = useState<FinishedProductItem[]>(initialRows);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters & Pagination (Uniform with Resources & Suppliers)
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState<string>("All");
  const [packagingFilter, setPackagingFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [currentPage, setCurrentPage] = useState(1);

  // Add / Edit Finished Product Modal
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinishedProductItem | null>(null);

  const hasMountedSyncRef = useRef(false);

  // Automatic silent POS sync on mount / page refresh in Chrome
  const triggerSilentPosSync = (force = false) => {
    const now = Date.now();
    if (!force && now - lastPosAutoSyncAt < 30_000) return;
    lastPosAutoSyncAt = now;
    actionResponse(syncAllFinishedProductsToPos()).catch(() => {});
  };

  useEffect(() => {
    if (!hasMountedSyncRef.current) {
      hasMountedSyncRef.current = true;
      triggerSilentPosSync();
    }
  }, []);

  const fetchProducts = async (syncPos = false) => {
    try {
      setLoading(true);
      const res = await actionResponse(productionListFinishedProducts());
      const list = res.data?.data || res.data || [];
      setProducts(list);
      if (syncPos) {
        triggerSilentPosSync(true);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load finished products");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddProduct = () => {
    setEditingItem(null);
    setIsEditProductOpen(false);
    setIsAddProductOpen(true);
  };

  const handleOpenEditProduct = (prod: FinishedProductItem) => {
    setEditingItem(prod);
    setIsAddProductOpen(false);
    setIsEditProductOpen(true);
  };

  // Enrich rows with parsed variant fields if missing
  const enrichedProducts = products.map((p) => {
    const parsed = parseVariantComponents(p.variant, p.uomName);
    return {
      ...p,
      contentSize: p.contentSize || parsed.contentSize,
      contentUom: p.contentUom || parsed.uom,
      packagingType: p.packagingType || parsed.packagingType,
    };
  });

  // Distinct product names for the "All Products" filter dropdown
  const distinctProductNames = Array.from(
    new Set(
      enrichedProducts
        .map((p) => p.itemName?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );

  // Compute status counts after search + dropdown filters or across all records (matches SupplyTab pattern)
  const statusCounts = {
    all: enrichedProducts.length,
    active: enrichedProducts.filter((item) => item.isActive !== false).length,
    inactive: enrichedProducts.filter((item) => item.isActive === false).length,
  };

  // Filter records
  const filteredProducts = enrichedProducts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.itemName?.toLowerCase().includes(q) ||
      p.variant?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.productCode?.toLowerCase().includes(q) ||
      p.packagingType?.toLowerCase().includes(q);

    const matchesProduct =
      productFilter === "All" ||
      p.itemName?.trim().toLowerCase() === productFilter.trim().toLowerCase();

    const matchesPackaging =
      packagingFilter === "All" ||
      p.packagingType?.toLowerCase() === packagingFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && p.isActive !== false) ||
      (statusFilter === "Inactive" && p.isActive === false);

    return matchesSearch && matchesProduct && matchesPackaging && matchesStatus;
  });

  const pageSize = 10;
  const totalCount = filteredProducts.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  return (
    <div className="space-y-6 animate-page-in">
      {/* Top Header & Action Buttons (Matches Resources & Suppliers) */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Finished Products &amp; Variants
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage finished goods, content sizes, units of measurement, packaging types, and SKUs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchProducts(true)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors h-10 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            type="button"
            onClick={handleOpenAddProduct}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm h-10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar (Uniform with SupplyTab) */}
      <div className="mb-6 border border-border rounded-xl overflow-hidden bg-card">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
          <div className="flex items-center gap-3 flex-1">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search by product name, variant, packaging, or SKU..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 p-0 text-sm flex-1 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:pl-4 sm:border-l border-border/50 shrink-0">
            {/* Product Filter */}
            <Select
              value={productFilter}
              onValueChange={(val) => {
                setProductFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-10 min-w-[180px] w-auto rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent className="min-w-[180px]">
                <SelectItem value="All">All Products</SelectItem>
                {distinctProductNames.map((prodName) => (
                  <SelectItem key={prodName} value={prodName}>
                    {prodName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Packaging Type Filter */}
            <Select
              value={packagingFilter}
              onValueChange={(val) => {
                setPackagingFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-10 min-w-[165px] w-auto rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="All Packaging" />
              </SelectTrigger>
              <SelectContent className="min-w-[165px]">
                {PACKAGING_FILTERS.map((pkg) => (
                  <SelectItem key={pkg} value={pkg}>
                    {pkg === "All" ? "All Packaging" : pkg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Status Tabs (All / Active / Inactive with badge counts) */}
      <ResourceStatusTabs
        value={statusFilter}
        counts={statusCounts}
        onChange={(status) => {
          setStatusFilter(status);
          setCurrentPage(1);
        }}
      />

      {/* Products & Variants Table (Uniform with SupplyTable / CategoryTable) */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <ProductionSkeleton />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">
                <th className="px-4 py-3.5 w-14">No.</th>
                <th className="px-4 py-3.5 w-16">Photo</th>
                <th className="px-4 py-3.5">Product Name</th>
                <th className="px-4 py-3.5">Variant</th>
                <th className="px-4 py-3.5">Content Size</th>
                <th className="px-4 py-3.5">UOM</th>
                <th className="px-4 py-3.5">Packaging</th>
                <th className="px-4 py-3.5">Min Stock</th>
                <th className="px-4 py-3.5">Max Stock</th>
                <th className="px-4 py-3.5">Variant SKU</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-5 py-12 text-center text-sm font-normal text-muted-foreground"
                  >
                    {searchQuery || productFilter !== "All" || packagingFilter !== "All" || statusFilter !== "All"
                      ? "No finished product variants found matching your filters."
                      : "No finished products configured yet. Click 'Add New Product' to create one."}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, index) => (
                  <tr
                    key={product.productId}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* No. */}
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {index + 1 + (safeCurrentPage - 1) * pageSize}
                    </td>

                    {/* Photo */}
                    <td className="px-4 py-3">
                      <div className="w-9 h-9 rounded-md border border-border bg-muted/30 overflow-hidden flex items-center justify-center shrink-0">
                        <ProductionImage
                          kind="product"
                          id={product.productId}
                          alt={product.itemName}
                          className="w-full h-full object-cover"
                          version={photoVersion}
                        />
                      </div>
                    </td>

                    {/* Product Name */}
                    <td className="px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      {product.itemName}
                    </td>

                    {/* Variant */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="rounded-md bg-muted text-foreground border border-border px-2.5 py-0.5 text-xs font-semibold">
                        {product.variant || "Standard"}
                      </span>
                    </td>

                    {/* Content Size */}
                    <td className="px-4 py-3 text-sm text-foreground font-medium whitespace-nowrap">
                      {product.contentSize || "—"}
                    </td>

                    {/* UOM */}
                    <td className="px-4 py-3 text-sm text-muted-foreground font-medium whitespace-nowrap">
                      {formatVariantUomLabel(product.contentUom || product.uomName)}
                    </td>

                    {/* Packaging */}
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {product.packagingType || "Jar"}
                    </td>

                    {/* Min Stock */}
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {product.minStockLevel ?? 10}
                    </td>

                    {/* Max Stock */}
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {product.maxStockLevel ?? 100}
                    </td>

                    {/* Variant SKU */}
                    <td className="px-4 py-3 text-xs font-mono font-bold text-foreground whitespace-nowrap">
                      {product.sku || "—"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge
                        status={product.isActive === false ? "Inactive" : "Active"}
                      />
                    </td>

                    {/* Actions: Edit Product only (Delete removed per user requirement) */}
                    <td className="px-4 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none cursor-pointer"
                            aria-label="Record actions"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 z-[200]">
                          <DropdownMenuItem
                            onClick={() => handleOpenEditProduct(product)}
                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-foreground shrink-0" />
                            <span className="truncate text-foreground font-medium">
                              Edit Product
                            </span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination (Shared Resources & Suppliers Pagination component) */}
      <Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        itemsPerPage={pageSize}
        onPageChange={setCurrentPage}
      />

      {/* Unified Add / Edit Finished Product Modal */}
      <AddFinishedProductModal
        open={isAddProductOpen || isEditProductOpen}
        editingItem={isEditProductOpen ? editingItem : null}
        allProducts={products}
        onClose={() => {
          setIsAddProductOpen(false);
          setIsEditProductOpen(false);
          setEditingItem(null);
        }}
        onSuccess={() => {
          fetchProducts(false);
          setPhotoVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
