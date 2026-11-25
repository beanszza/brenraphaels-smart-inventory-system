"use client";

import React, { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProductionImage } from "./ProductionImage";
import { FinishedProductItem } from "./types";
import { FILE_PLACEHOLDER } from "@/lib/files";

interface FinishedProductDetailsModalProps {
  open: boolean;
  product: FinishedProductItem | null;
  allProducts: FinishedProductItem[];
  photoVersion?: number;
  onClose: () => void;
  onEdit: (product: FinishedProductItem) => void;
  onDelete: (product: FinishedProductItem) => void;
}

export default function FinishedProductDetailsModal({
  open,
  product,
  allProducts,
  photoVersion = 0,
  onClose,
  onEdit,
  onDelete,
}: FinishedProductDetailsModalProps) {
  const productVariants = useMemo(() => {
    if (!product) return [];
    const key = (product.itemName || "").trim().toLowerCase();
    const matches = allProducts
      .filter((p) => (p.itemName || "").trim().toLowerCase() === key)
      .sort((a, b) => a.productId - b.productId);
    return matches.length > 0 ? matches : [product];
  }, [product, allProducts]);

  if (!open || !product) return null;

  const totalStock = productVariants.reduce((sum, v) => sum + (Number(v.currentStock) || 0), 0);
  const anyActive = productVariants.some((v) => v.isActive !== false);

  const directUrl =
    product.resolvedImageUrl ||
    (product.imageUrl &&
    (product.imageUrl.startsWith("http://") ||
      product.imageUrl.startsWith("https://") ||
      product.imageUrl.startsWith("data:image/"))
      ? product.imageUrl
      : "");

  const finalPhotoSrc =
    directUrl && photoVersion > 0 && !directUrl.startsWith("data:") && !directUrl.includes("?")
      ? `${directUrl}?v=${photoVersion}`
      : directUrl;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100020] bg-scrim animate-in fade-in duration-150" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[100021] flex max-h-[85vh] w-[calc(100%-2rem)] max-w-[620px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-modal border border-border bg-surface shadow-modal outline-none animate-in fade-in zoom-in-95 duration-150"
        >
          <Dialog.Title className="sr-only">{product.itemName}</Dialog.Title>

          {/* ── Sticky Header ── */}
          <div className="flex items-center gap-3.5 border-b border-topbar bg-surface px-6 py-4 shrink-0">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-inner border border-border bg-tint-selected flex items-center justify-center">
              {finalPhotoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={finalPhotoSrc}
                  alt={product.itemName}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    if (!e.currentTarget.src.endsWith(FILE_PLACEHOLDER)) {
                      e.currentTarget.src = FILE_PLACEHOLDER;
                    }
                  }}
                />
              ) : (
                <ProductionImage
                  kind="product"
                  id={product.productId}
                  alt={product.itemName}
                  className="h-full w-full object-cover"
                  version={photoVersion}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="type-modal-title text-ink truncate">{product.itemName}</h2>
                <StatusBadge status={anyActive ? "Active" : "Inactive"} />
              </div>
              <p className="mt-0.5 type-body-secondary text-ink-muted">
                {product.categoryName || "Finished Product"} · {productVariants.length}{" "}
                {productVariants.length === 1 ? "packaging variant" : "packaging variants"} configured
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-subtle hover:text-ink transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">
            {/* Overview Summary Card */}
            <div className="rounded-inner border border-input bg-page p-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="type-caption font-medium text-ink-muted">Category</p>
                  <p className="mt-0.5 type-body-strong text-ink">
                    {product.categoryName || "Finished Goods"}
                  </p>
                </div>
                <div>
                  <p className="type-caption font-medium text-ink-muted">Total Inventory Stock</p>
                  <p className="mt-0.5 type-body-strong text-ink tabular-nums">
                    {totalStock} {totalStock === 1 ? "unit" : "units"} across {productVariants.length}{" "}
                    {productVariants.length === 1 ? "variant" : "variants"}
                  </p>
                </div>
              </div>

              {product.description && (
                <div>
                  <p className="type-caption font-medium text-ink-muted">Description</p>
                  <p className="mt-0.5 type-body-secondary text-ink leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}
            </div>

            {/* Variants Table */}
            <div className="overflow-hidden rounded-inner border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="table-head-row border-b border-divider">
                      <th className="px-3.5 py-2.5 text-left type-table-header text-ink-muted">Variant</th>
                      <th className="px-3.5 py-2.5 text-left type-table-header text-ink-muted">SKU</th>
                      <th className="px-3.5 py-2.5 text-left type-table-header text-ink-muted">Min / Max</th>
                      <th className="px-3.5 py-2.5 text-left type-table-header text-ink-muted">Stock</th>
                      <th className="px-3.5 py-2.5 text-left type-table-header text-ink-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {productVariants.map((v) => {
                      const stock = Number(v.currentStock) || 0;
                      const isSelected = v.productId === product.productId;
                      return (
                        <tr
                          key={v.productId}
                          className={isSelected ? "bg-tint-selected/40" : "bg-surface"}
                        >
                          <td className="px-3.5 py-2.5 type-table-id text-ink whitespace-nowrap">
                            {v.variant || "Standard"}
                          </td>
                          <td className="px-3.5 py-2.5 type-caption text-ink-muted tabular-nums whitespace-nowrap">
                            {v.sku || "—"}
                          </td>
                          <td className="px-3.5 py-2.5 type-table-cell text-ink tabular-nums whitespace-nowrap">
                            {v.minStockLevel ?? 10} / {v.maxStockLevel ?? 100}
                          </td>
                          <td className="px-3.5 py-2.5 type-table-cell font-medium text-ink tabular-nums whitespace-nowrap">
                            {stock} {stock === 1 ? "unit" : "units"}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <StatusBadge status={v.isActive === false ? "Inactive" : "Active"} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Sticky Footer (Close, Delete beside Edit product) ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-topbar bg-page px-6 py-3.5 shrink-0">
            <p className="type-caption text-ink-muted">
              Products with inventory stock cannot be deleted.
            </p>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-control border border-border bg-surface px-3.5 type-label-button text-ink hover:bg-subtle transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => onDelete(product)}
                className="inline-flex h-9 items-center gap-1.5 rounded-control border border-notice-danger-border bg-notice-danger-bg px-3.5 type-label-button text-destructive hover:bg-status-red-bg transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="inline-flex h-9 items-center gap-1.5 rounded-control bg-primary px-3.5 type-label-button text-on-brand hover:bg-primary-hover transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit product
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
