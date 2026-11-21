"use client";

import React, { useState } from "react";
import { InventoryItem } from "./types";
import { LotItem } from "../lots/types";
import { listItemLots } from "@/app/actions/inventory/item-lots";
import { InventorySkeleton } from "./InventorySkeleton";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface InventoryTableProps {
  items: InventoryItem[];
  currentPage: number;
  pageSize: number;
  onOrderNow?: (item: InventoryItem) => void;
  isFinishedGoods?: boolean;
  showActions?: boolean;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const INVENTORY_STATUS_BADGE_CLASSES: Record<"In Stock" | "Low Stock" | "Out of Stock", string> = {
  "In Stock":
    "min-w-[96px] justify-center whitespace-nowrap border-transparent bg-badge-success text-badge-success-foreground",
  "Low Stock":
    "min-w-[96px] justify-center whitespace-nowrap border-transparent bg-badge-warning text-badge-warning-foreground",
  "Out of Stock":
    "min-w-[96px] justify-center whitespace-nowrap border-transparent bg-badge-destructive text-badge-destructive-foreground",
};

function getExpiryDisplay(lot: LotItem) {
  if (!lot.expiryDate) {
    return <span className="text-muted-foreground">No Expiry</span>;
  }
  const exp = new Date(lot.expiryDate);
  const now = new Date();
  const diffDays = Math.ceil(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const formattedDate = formatDate(lot.expiryDate);

  if (diffDays < 0) {
    return (
      <span className="font-semibold text-foreground">
        {formattedDate} <span className="type-caption text-muted-foreground">(Expired)</span>
      </span>
    );
  }
  if (diffDays <= 30) {
    return (
      <span className="font-medium text-foreground">
        {formattedDate} <span className="type-caption text-muted-foreground">({diffDays}d left)</span>
      </span>
    );
  }
  return <span className="text-foreground">{formattedDate}</span>;
}

export default function InventoryTable({
  items,
  currentPage,
  pageSize,
  onOrderNow,
  isFinishedGoods,
  showActions = true,
}: InventoryTableProps) {
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [itemLots, setItemLots] = useState<Record<string, LotItem[]>>({});
  const [lotErrors, setLotErrors] = useState<Record<string, string>>({});
  const [loadingLots, setLoadingLots] = useState<Record<string, boolean>>({});

  const canShowActions = showActions;
  const totalColumns = canShowActions ? 9 : 8;

  const toggleRow = async (item: InventoryItem) => {
    const key = item.productId ? `fp-${item.productId}` : String(item.itemId);
    const isExpanded = !!expandedItemIds[key];
    const nextState = !isExpanded;
    setExpandedItemIds((prev) => ({ ...prev, [key]: nextState }));

    if (nextState && !itemLots[key] && !loadingLots[key]) {
      setLoadingLots((prev) => ({ ...prev, [key]: true }));
      try {
        setLotErrors((prev) => ({ ...prev, [key]: "" }));
        const result = await listItemLots(item.itemId, item.productId);
        if (!result.success) throw new Error(result.message || "Lots could not be loaded.");
        setItemLots((prev) => ({ ...prev, [key]: result.data }));
      } catch (error) {
        setLotErrors((prev) => ({
          ...prev,
          [key]: error instanceof Error ? error.message : "Lots could not be loaded.",
        }));
      } finally {
        setLoadingLots((prev) => ({ ...prev, [key]: false }));
      }
    }
  };

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="w-8 pb-2.5 pt-1 pr-2 text-center"></th>
            <th className="w-12 pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              No.
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[200px]">
              Item Name
            </th>
            {isFinishedGoods ? (
              <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
                Variant
              </th>
            ) : (
              <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
                UOM
              </th>
            )}
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              Current Stock
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              Reserved
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[180px]">
              Stock Level
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              Status
            </th>
            {canShowActions && (
              <th className="pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={totalColumns}
                className="py-12 text-center type-body text-ink-muted"
              >
                No Inventory Records Found
              </td>
            </tr>
          ) : (
            items.map((item, idx) => {
              const rowKey = item.productId ? `fp-${item.productId}` : String(item.itemId);
              const isExpanded = !!expandedItemIds[rowKey];
              const rawLots = itemLots[rowKey] || [];
              const availableLots = rawLots.filter(
                (lot) =>
                  lot.status === "Available" ||
                  lot.status === "Active" ||
                  (lot.reservedQuantity && lot.reservedQuantity > 0)
              );
              const isLoading = !!loadingLots[rowKey];

              const isLow =
                item.isLowStock || item.currentStock <= item.minStockLevel;
              const maxStock =
                item.maxStockLevel > 0
                  ? item.maxStockLevel
                  : Math.max(item.minStockLevel * 2, item.currentStock, 10);
              const percentage = Math.min(
                Math.round((item.currentStock / maxStock) * 100),
                100
              );

              const statusText =
                item.currentStock === 0
                  ? "Out of Stock"
                  : isLow
                  ? "Low Stock"
                  : "In Stock";

              const barColorClass =
                statusText === "Out of Stock"
                  ? "bg-destructive"
                  : statusText === "Low Stock"
                  ? "bg-warning"
                  : "bg-success";

              return (
                <React.Fragment key={item.inventoryId}>
                  <tr
                    onClick={() => toggleRow(item)}
                    className="hover:bg-page transition-colors cursor-pointer select-none group"
                  >
                    <td className="w-8 py-3 pr-2 text-center text-ink-muted group-hover:text-ink">
                      <button
                        type="button"
                        aria-label={`Show lots for ${item.itemName}`}
                        aria-expanded={isExpanded}
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleRow(item);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown size={14} className="text-ink" />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                    </td>
                    <td className="w-12 py-3 pr-4 type-body text-ink-muted whitespace-nowrap tabular-nums">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="py-3 pr-4 type-body font-medium text-primary min-w-[200px] whitespace-nowrap">
                      {item.itemName}
                    </td>
                    {isFinishedGoods ? (
                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                        {item.variantName ? (
                          <span>{item.variantName}</span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                    ) : (
                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                        {item.uomName || "—"}
                      </td>
                    )}
                    <td className="py-3 pr-4 type-body font-medium text-ink tabular-nums whitespace-nowrap">
                      {item.currentStock.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 pr-4 type-body text-ink tabular-nums whitespace-nowrap">
                      {Number(item.reservedStock || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="w-36 space-y-1">
                        <div className="flex items-center justify-between type-caption">
                          <span className="font-medium text-ink tabular-nums">
                            {percentage}%
                          </span>
                          <span className="type-caption text-ink-muted tabular-nums">
                            Max: {item.maxStockLevel}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-subtle rounded-pill overflow-hidden">
                          <div
                            className={`h-full ${barColorClass} rounded-pill transition-all duration-300`}
                            style={{ width: `${Math.max(percentage, item.currentStock === 0 ? 3 : 0)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <StatusBadge
                        status={statusText}
                        className={INVENTORY_STATUS_BADGE_CLASSES[statusText]}
                      />
                    </td>
                    {canShowActions && (
                      <td className="py-3 pl-4 text-center whitespace-nowrap">
                        {isLow ? (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOrderNow?.(item);
                            }}
                            className="h-7 px-3 type-label-button-sm font-medium bg-primary text-on-brand hover:bg-primary-hover transition-colors cursor-pointer rounded-control shadow-none"
                          >
                            {isFinishedGoods ? "Produce Now" : "Order Now"}
                          </Button>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* Expandable Lot Detail Row */}
                  {isExpanded && (
                    <tr className="bg-page/70 border-b border-divider">
                      <td colSpan={totalColumns} className="p-4 sm:p-5">
                        <div className="rounded-card border border-border bg-surface p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-divider pb-2">
                            <span className="type-subsection text-ink font-semibold">
                              Available Lots Breakdown ({item.itemName}
                              {item.variantName ? ` - ${item.variantName}` : ""})
                            </span>
                            <span className="type-caption text-ink-muted">
                              Showing active lots and reserved quantities
                            </span>
                          </div>

                          {isLoading ? (
                            <InventorySkeleton compact />
                          ) : lotErrors[rowKey] ? (
                            <div role="alert" className="space-y-2">
                              <p>{lotErrors[rowKey]}</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setExpandedItemIds((prev) => ({
                                    ...prev,
                                    [rowKey]: false,
                                  }));
                                }}
                              >
                                Close and retry
                              </Button>
                            </div>
                          ) : availableLots.length === 0 ? (
                            <div className="py-5 text-center type-caption text-ink-muted">
                              No active lots found for this item.
                            </div>
                          ) : (() => {
                            const hasAnyExpiry = availableLots.some((lot) => Boolean(lot.expiryDate));
                            return (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="border-b border-divider">
                                    <th className="pb-2 pt-1 pr-3 text-left type-table-header text-ink-muted">
                                      Lot Code
                                    </th>
                                    <th className="pb-2 pt-1 pr-3 text-left type-table-header text-ink-muted">
                                      {isFinishedGoods ? "Production Date" : "Delivered Date"}
                                    </th>
                                    {hasAnyExpiry && (
                                      <th className="pb-2 pt-1 pr-3 text-left type-table-header text-ink-muted">
                                        Expiry Date
                                      </th>
                                    )}
                                    <th className="pb-2 pt-1 pr-3 text-right type-table-header text-ink-muted">
                                      Qty Remaining
                                    </th>
                                    <th className="pb-2 pt-1 pr-3 text-right type-table-header text-ink-muted">
                                      Reserved
                                    </th>
                                    <th className="pb-2 pt-1 pr-3 text-left type-table-header text-ink-muted">
                                      % Share
                                    </th>
                                    <th className="pb-2 pt-1 pl-3 text-center type-table-header text-ink-muted">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-divider">
                                  {availableLots.map((lot) => {
                                    const resQty = Number(lot.reservedQuantity || 0);
                                    const sharePercent =
                                      lot.sharePercent !== null &&
                                      lot.sharePercent !== undefined
                                        ? Number(lot.sharePercent)
                                        : item.currentStock > 0
                                        ? Math.round(
                                            (lot.quantityRemaining /
                                              item.currentStock) *
                                              100
                                          )
                                        : 0;

                                    return (
                                      <tr
                                        key={lot.lotId}
                                        className="hover:bg-page transition-colors"
                                      >
                                        <td className="py-2.5 pr-3 type-table-cell font-medium text-primary tabular-nums">
                                          {lot.lotCode}
                                        </td>
                                        <td className="py-2.5 pr-3 type-table-cell text-ink">
                                          {formatDate(lot.receivedDate)}
                                        </td>
                                        {hasAnyExpiry && (
                                          <td className="py-2.5 pr-3 type-table-cell">
                                            {getExpiryDisplay(lot)}
                                          </td>
                                        )}
                                        <td className="py-2.5 pr-3 text-right type-table-cell font-medium text-ink tabular-nums">
                                          {lot.quantityRemaining.toLocaleString(
                                            undefined,
                                            {
                                              minimumFractionDigits: 0,
                                              maximumFractionDigits: 2,
                                            }
                                          )}
                                          {!isFinishedGoods && lot.uomName && (
                                            <span className="type-caption font-normal text-ink-muted">
                                              {" "}{lot.uomName}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2.5 pr-3 text-right type-table-cell text-ink tabular-nums">
                                          {resQty.toLocaleString(undefined, {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 2,
                                          })}
                                        </td>
                                        <td className="py-2.5 pr-3">
                                          <div className="space-y-1 w-24">
                                            <div className="flex justify-between type-caption text-ink-muted tabular-nums">
                                              <span>{sharePercent}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-subtle rounded-pill overflow-hidden">
                                              <div
                                                className="h-full bg-primary rounded-pill transition-all duration-300"
                                                style={{
                                                  width: `${Math.min(
                                                    sharePercent,
                                                    100
                                                  )}%`,
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-2.5 pl-3 text-center whitespace-nowrap">
                                          <StatusBadge status={lot.status} />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
