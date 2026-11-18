"use client";

import React, { useEffect, useState } from "react";
import ModalWrapper from "./ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import { SupplyItem } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Package, Truck, ShoppingCart, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { loadSupplyDetails } from "@/lib/resources-suppliers/actions";
import { Skeleton } from "@/components/ui/skeleton";

interface SupplyDetailsModalProps {
  item: SupplyItem | null;
  onClose: () => void;
  onEdit?: (item: SupplyItem) => void;
}

interface LinkedSupplier {
  supplierId: number;
  supplierName: string;
  supplierCode?: string;
  leadTimeDays?: number;
}

interface RecentOrder {
  poId: number;
  poNumber: string;
  orderDate: string;
  status: string;
  quantity: number;
  uomName: string;
}

export default function SupplyDetailsModal(props: SupplyDetailsModalProps) {
  return props.item ? <SupplyDetailsModalContent key={props.item.itemId} {...props} /> : null;
}

function SupplyDetailsModalContent({
  item,
  onClose,
  onEdit,
}: SupplyDetailsModalProps) {
  const [linkedSuppliers, setLinkedSuppliers] = useState<LinkedSupplier[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!item) return;
    loadSupplyDetails(item.itemId).then(data => {
      if (!cancelled) {
        setLinkedSuppliers(data.linkedSuppliers);
        setRecentOrders(data.recentOrders);
      }
    }).catch(() => {
      if (!cancelled) setError("Unable to load details. Close and reopen to try again.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [item]);

  if (!item) return null;

  const currentStock = item.currentStock ?? 0;
  const isLowStock = currentStock <= item.minStockLevel;
  const isOverStock = item.maxStockLevel > 0 && currentStock > item.maxStockLevel;

  const stockIcon = isLowStock
    ? <TrendingDown size={12} className="text-text-primary" />
    : isOverStock
    ? <TrendingUp size={12} className="text-text-primary" />
    : <Minus size={12} className="text-text-primary" />;

  const stockLabel = isLowStock ? "Low Stock" : isOverStock ? "Overstock" : "Normal";


  return (
    <ModalWrapper
      open={!!item}
      title="Supply Item Details"
      onClose={onClose}
      size="max-w-[640px]"
    >
      <div className="space-y-6">
        {error && <p role="alert" className="type-body text-status-red">{error}</p>}
        {/* Header Summary Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-card bg-surface-muted border border-divider">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-control bg-surface border border-divider flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="type-card-title text-text-primary">{item.itemName}</h3>
                <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
              </div>
              <p className="type-caption font-medium text-text-muted mt-0.5">
                {item.itemCode || `ITEM-${item.itemId}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-pill bg-surface text-text-primary border border-divider px-3 py-1 type-caption font-semibold">
              {item.categoryName || "Raw Materials"}
            </span>
          </div>
        </div>

        {/* Stock Status Cards — monochromatic */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-card border border-divider bg-surface space-y-1 shadow-card">
            <span className="type-caption font-medium text-text-muted">Current Stock</span>
            <div className="flex items-baseline gap-1.5">
              <span className="type-stat-value text-text-primary">{currentStock}</span>
              <span className="type-caption text-text-muted font-semibold">{item.uomName}</span>
            </div>
            <div className="flex items-center gap-1 pt-1 type-caption text-text-muted font-medium">
              {stockIcon}
              <span>{stockLabel}</span>
            </div>
          </div>

          <div className="p-4 rounded-card border border-divider bg-surface space-y-1 shadow-card">
            <span className="type-caption font-medium text-text-muted">Min Stock Threshold</span>
            <div className="flex items-baseline gap-1.5">
              <span className="type-stat-value text-text-primary">{item.minStockLevel}</span>
              <span className="type-caption text-text-muted font-semibold">{item.uomName}</span>
            </div>
            <p className="type-caption text-text-muted pt-1">Reorder trigger point</p>
          </div>

          <div className="p-4 rounded-card border border-divider bg-surface space-y-1 shadow-card">
            <span className="type-caption font-medium text-text-muted">Max Stock Capacity</span>
            <div className="flex items-baseline gap-1.5">
              <span className="type-stat-value text-text-primary">{item.maxStockLevel}</span>
              <span className="type-caption text-text-muted font-semibold">{item.uomName}</span>
            </div>
            <p className="type-caption text-text-muted pt-1">Maximum stock holding</p>
          </div>
        </div>

        {/* Specifications */}
        <div className="space-y-2">
          <h4 className="type-label font-bold uppercase tracking-wider text-text-muted">
            Item Specifications
          </h4>
          <div className="rounded-card border border-divider bg-surface divide-y divide-divider overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 type-caption">
              <span className="text-text-muted font-medium">Supply No</span>
              <span className="font-semibold text-text-primary">{item.itemCode || "-"}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 type-caption">
              <span className="text-text-muted font-medium">Category</span>
              <span className="font-semibold text-text-primary">{item.categoryName}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 type-caption">
              <span className="text-text-muted font-medium">Unit of Measure (UOM)</span>
              <span className="font-semibold text-text-primary">{item.uomName}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 type-caption">
              <span className="text-text-muted font-medium">Status</span>
              <span className="font-semibold text-text-primary">
                {item.isActive !== false ? "Active (In Circulation)" : "Inactive (Archived)"}
              </span>
            </div>
          </div>
        </div>

        {/* Linked Suppliers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="type-label font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Truck size={14} /> Linked Suppliers
            </h4>
            <span className="type-caption font-medium text-text-muted">
              {linkedSuppliers.length} supplier{linkedSuppliers.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="rounded-card border border-divider bg-surface overflow-hidden">
            {loading ? (
              <Skeleton aria-label="Loading details" className="m-4 h-16" />
            ) : linkedSuppliers.length === 0 ? (
              <div className="p-6 text-center space-y-1">
                <p className="type-caption font-semibold text-text-primary">No suppliers linked yet</p>
                <p className="type-caption text-text-muted">
                  Suppliers mapped to this item will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-divider">
                {linkedSuppliers.map((s) => (
                  <div key={s.supplierId} className="flex items-center justify-between p-3 type-caption">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-text-primary">{s.supplierName}</p>
                      {s.supplierCode && (
                        <p className="type-caption text-text-muted">{s.supplierCode}</p>
                      )}
                    </div>
                    <div className="text-right space-y-0.5">
                      {s.leadTimeDays != null && (
                        <p className="type-caption text-text-muted">
                          {s.leadTimeDays} days lead time
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h4 className="type-label font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <ShoppingCart size={14} /> Recent Orders
            </h4>
          </div>

          <div className="rounded-card border border-divider bg-surface overflow-hidden">
            {loading ? (
              <Skeleton aria-label="Loading details" className="m-4 h-16" />
            ) : recentOrders.length === 0 ? (
              <div className="p-6 text-center space-y-1">
                <p className="type-caption font-semibold text-text-primary">No orders found</p>
                <p className="type-caption text-text-muted">
                  Purchase orders for this item will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-divider bg-surface-muted table-head-row text-text-muted type-table-header uppercase">
                    <tr>
                      <th className="table-th px-3 py-2 text-left">PURCHASE ORDER NUMBER</th>
                      <th className="table-th px-3 py-2 text-left">DATE</th>
                      <th className="table-th px-3 py-2 text-left">STATUS</th>
                      <th className="table-th px-3 py-2 text-right">QTY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {recentOrders.map((order, i) => (
                      <tr key={`${order.poId}-${i}`} className="table-row hover:bg-hover transition-colors">
                        <td className="table-td px-3 py-2.5 font-semibold text-text-primary">{order.poNumber}</td>
                        <td className="table-td px-3 py-2.5 text-text-muted">
                          {new Date(order.orderDate).toLocaleDateString("en-PH", {
                            year: "numeric", month: "short", day: "numeric",
                          })}
                        </td>
                        <td className="table-td px-3 py-2.5">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="table-td px-3 py-2.5 text-right font-semibold text-text-primary">
                          {order.quantity} {order.uomName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-divider">
          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            className="rounded-control border border-divider bg-surface px-5 py-2 type-label-button text-text-primary hover:bg-hover transition-colors"
          >
            Close
          </ModalNativeCloseButton>
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(item);
              }}
              className="rounded-control bg-button-primary text-button-primary-foreground px-5 py-2 type-label-button hover:bg-button-primary-hover transition-colors"
            >
              Edit Item
            </button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
