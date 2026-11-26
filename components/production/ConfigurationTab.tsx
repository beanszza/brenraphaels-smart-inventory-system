"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/SearchInput";
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
import FinishedProductDetailsModal from "./FinishedProductDetailsModal";
import ActionConfirmModal from "@/components/shared/ActionConfirmModal";
import { listFinishedProducts as productionListFinishedProducts } from "@/app/actions/production/products";
import { deleteFinishedProduct } from "@/app/actions/production/product-detail";
import { syncAllFinishedProductsToPos } from "@/app/actions/production/pos-sync";
import { actionResponse } from "@/lib/resources/action-response";
import { parseVariantComponents } from "@/lib/production/sku";
import { toast } from "sonner";

const PACKAGING_FILTERS = ["All", "Jar", "Container", "Pouch"] as const;

let lastPosAutoSyncAt = 0;

export default function ConfigurationTab({
  initialRows,
}: {
  initialRows: FinishedProductItem[];
}) {
  const [products, setProducts] = useState<FinishedProductItem[]>(initialRows);
  const [loading, setLoading] = useState(false);

  // Filters & Pagination (Uniform with Resources & Suppliers)
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState<string>("All");
  const [packagingFilter, setPackagingFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [currentPage, setCurrentPage] = useState(1);

  // View / Add / Edit Finished Product Modals
  const [viewingItem, setViewingItem] = useState<FinishedProductItem | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinishedProductItem | null>(null);

  // Delete Finished Product Confirmation Modal
  const [deletingItem, setDeletingItem] = useState<FinishedProductItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasMountedSyncRef = useRef(false);

  // Automatic silent POS sync on mount / page refresh in Chrome
  const triggerSilentPosSync = (force = false) => {
    const now = Date.now();
    if (!force && now - lastPosAutoSyncAt < 30_000) return;
    lastPosAutoSyncAt = now;
    actionResponse(syncAllFinishedProductsToPos()).catch(() => { });
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e?.response?.data?.message || e?.message || "Failed to load finished products");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenViewProduct = (prod: FinishedProductItem) => {
    setViewingItem(prod);
  };

  const handleOpenAddProduct = () => {
    setViewingItem(null);
    setEditingItem(null);
    setIsEditProductOpen(false);
    setIsAddProductOpen(true);
  };

  const handleOpenEditProduct = (prod: FinishedProductItem) => {
    setViewingItem(null);
    setEditingItem(prod);
    setIsAddProductOpen(false);
    setIsEditProductOpen(true);
  };

  const handleOpenDeleteProduct = (prod: FinishedProductItem) => {
    setViewingItem(null);
    setDeleteError(null);
    setDeletingItem(prod);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deletingItem) return;
    if ((deletingItem.currentStock ?? 0) > 0) {
      setDeleteError(
        `Cannot delete "${deletingItem.itemName}" because it currently has ${deletingItem.currentStock} unit(s) in inventory.`
      );
      return;
    }

    try {
      setDeleting(true);
      setDeleteError(null);
      const res = await actionResponse(deleteFinishedProduct(deletingItem.productId));
      if (!res.data?.success) {
        const msg = res.data?.message || "Failed to delete finished product.";
        setDeleteError(msg);
        toast.error(msg);
        return;
      }
      toast.success(`Deleted "${deletingItem.itemName}" (${deletingItem.variant || "Standard"}).`);
      setDeletingItem(null);
      fetchProducts(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = e?.response?.data?.message || e?.message || "Failed to delete finished product.";
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
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
      {/* Top Header & Action Buttons */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-page-title text-text-primary">
            Finished Products
          </h2>
          <p className="mt-1 type-body text-text-muted">
            Each row is one product with its own size, packaging, SKU and stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchProducts(true)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-control bg-surface border border-divider px-4 py-2 type-body font-semibold text-text-primary hover:bg-surface-secondary transition-colors h-10 cursor-pointer shadow-card"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            type="button"
            onClick={handleOpenAddProduct}
            className="flex items-center justify-center gap-2 rounded-control bg-button-primary px-5 py-2.5 type-body font-semibold text-text-inverse hover:bg-button-primary/85 transition-colors shadow-card h-10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-6 rounded-card border border-divider bg-surface p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            containerClassName="flex-1"
            placeholder="Search by product name, variant, packaging, or SKU..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Product Filter */}
            <Select
              value={productFilter}
              onValueChange={(val) => {
                setProductFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-10 min-w-[180px] w-auto rounded-control border border-divider bg-surface px-3.5 type-body font-medium text-text-primary shadow-card focus:border-border-focus">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent className="min-w-[180px] bg-surface border-divider type-caption">
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
              <SelectTrigger className="h-10 min-w-[165px] w-auto rounded-control border border-divider bg-surface px-3.5 type-body font-medium text-text-primary shadow-card focus:border-border-focus">
                <SelectValue placeholder="All Packaging" />
              </SelectTrigger>
              <SelectContent className="min-w-[165px] bg-surface border-divider type-caption">
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

      {/* Status Tabs */}
      <ResourceStatusTabs
        value={statusFilter}
        counts={statusCounts}
        onChange={(status) => {
          setStatusFilter(status);
          setCurrentPage(1);
        }}
      />

      {/* Products & Variants Table */}
      {loading ? (
        <div className="rounded-card border border-divider bg-surface overflow-hidden shadow-card">
          <ProductionSkeleton />
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
          <table className="w-full min-w-[800px] border-collapse">
            <thead className="border-b border-divider bg-surface-secondary">
              <tr className="table-head-row text-left whitespace-nowrap">
                <th className="sticky left-0 z-20 bg-surface-secondary table-th w-14 px-4 py-3 text-center whitespace-nowrap border-r border-divider shadow-sticky">No.</th>
                <th className="table-th px-4 py-3 min-w-[180px] whitespace-nowrap">Product Name</th>
                <th className="table-th px-4 py-3">Variant</th>
                <th className="table-th px-4 py-3">Packaging</th>
                <th className="table-th px-4 py-3">Variant SKU</th>
                <th className="table-th px-4 py-3 text-center">Status</th>
                <th className="table-th w-16 px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center type-body text-text-muted"
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
                    onClick={() => handleOpenViewProduct(product)}
                    className="table-row group hover:bg-surface-secondary/50 transition-colors cursor-pointer"
                  >
                    {/* No. */}
                    <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface-secondary/50 w-14 px-4 py-3 table-td text-center text-text-muted whitespace-nowrap border-r border-divider shadow-sticky transition-colors">
                      {index + 1 + (safeCurrentPage - 1) * pageSize}
                    </td>

                    {/* Product Name */}
                    <td className="px-4 py-3 table-td font-semibold text-text-primary whitespace-nowrap min-w-[180px]">
                      {product.itemName}
                    </td>

                    {/* Variant */}
                    <td className="px-4 py-3 table-td text-text-muted whitespace-nowrap">
                      <span className="rounded-control bg-surface-secondary text-text-primary border border-divider px-2.5 py-0.5 type-caption font-semibold">
                        {product.variant || "Standard"}
                      </span>
                    </td>

                    {/* Packaging */}
                    <td className="px-4 py-3 table-td text-text-muted whitespace-nowrap">
                      {product.packagingType || "Jar"}
                    </td>

                    {/* Variant SKU */}
                    <td className="px-4 py-3 table-td text-text-muted tabular-nums whitespace-nowrap">
                      {product.sku || "—"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <StatusBadge
                        status={product.isActive === false ? "Inactive" : "Active"}
                      />
                    </td>

                    {/* Actions: Edit / Delete Product */}
                    <td className="w-16 px-4 py-3 text-center relative whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 rounded-control text-text-primary hover:bg-surface-secondary transition-colors focus:outline-none cursor-pointer"
                              title="Actions"
                              aria-label="Actions"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-control border border-divider bg-surface shadow-modal p-1.5 text-left z-[100]">
                            <DropdownMenuItem
                              onClick={() => handleOpenViewProduct(product)}
                              className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary focus:text-text-primary cursor-pointer rounded-control transition-colors outline-none"
                            >
                              <Eye size={14} className="shrink-0 text-text-muted" />
                              <span>View Details</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenEditProduct(product)}
                              className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary focus:text-text-primary cursor-pointer rounded-control transition-colors outline-none"
                            >
                              <Pencil size={14} className="shrink-0 text-text-muted" />
                              <span>Edit Product</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenDeleteProduct(product)}
                              className="flex w-full items-center gap-2.5 px-3 py-2 type-caption font-medium text-status-danger hover:bg-status-danger/10 focus:bg-status-danger/10 focus:text-status-danger cursor-pointer rounded-control transition-colors outline-none"
                            >
                              <Trash2 size={14} className="shrink-0" />
                              <span>Delete Product</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        itemsPerPage={pageSize}
        onPageChange={setCurrentPage}
      />

      {/* View Finished Product Details Modal */}
      <FinishedProductDetailsModal
        open={Boolean(viewingItem)}
        product={viewingItem}
        allProducts={products}
        onClose={() => setViewingItem(null)}
        onEdit={(prod) => handleOpenEditProduct(prod)}
        onDelete={(prod) => handleOpenDeleteProduct(prod)}
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
        }}
      />

      {/* Delete Finished Product Confirmation Modal */}
      <ActionConfirmModal
        open={Boolean(deletingItem)}
        title="Delete Finished Product"
        subtitle={
          deletingItem
            ? `${deletingItem.itemName} • ${deletingItem.variant || "Standard"} (${deletingItem.sku || "No SKU"})`
            : undefined
        }
        description={
          deletingItem && (deletingItem.currentStock ?? 0) > 0 ? (
            <>
              Cannot delete <strong>{deletingItem.itemName}</strong> ({deletingItem.variant || "Standard"}) because it currently has{" "}
              <strong>{deletingItem.currentStock}</strong> unit(s) in inventory. Clear or transfer all remaining stock first.
            </>
          ) : (
            <>
              Are you sure you want to delete <strong>{deletingItem?.itemName}</strong> ({deletingItem?.variant || "Standard"})? This action cannot be undone.
            </>
          )
        }
        confirmText="Delete Product"
        loading={deleting}
        loadingText="Deleting..."
        confirmDisabled={Boolean(deletingItem && (deletingItem.currentStock ?? 0) > 0)}
        errorMessage={deleteError}
        onConfirm={handleConfirmDeleteProduct}
        onClose={() => {
          if (!deleting) {
            setDeletingItem(null);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
}
