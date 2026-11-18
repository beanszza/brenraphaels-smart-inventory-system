"use client";

import React, { useState } from "react";
import { MoreHorizontal, Pencil, Eye } from "lucide-react";
import { SupplyItem } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface SupplyTableProps {
  items: SupplyItem[];
  currentPage: number;
  pageSize: number;
  canConfigure?: boolean;
  onEdit: (item: SupplyItem) => void;
  onView?: (item: SupplyItem) => void;
}

export default function SupplyTable({
  items,
  currentPage,
  pageSize,
  canConfigure = true,
  onEdit,
  onView,
}: SupplyTableProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
      <table className="w-full min-w-[900px]">
        <thead className="border-b border-divider bg-surface-muted table-head-row">
          <tr className="text-left type-table-header uppercase text-text-muted whitespace-nowrap">
            <th className="sticky left-0 z-20 w-16 px-4 py-3.5 table-th bg-surface-muted border-r border-divider shadow-sticky-col">No.</th>
            <th className="table-th px-4 py-3.5 min-w-[200px]">Name</th>
            <th className="table-th px-4 py-3.5">Category</th>
            <th className="table-th px-4 py-3.5">Unit</th>
            <th className="table-th px-4 py-3.5">Min Stock</th>
            <th className="table-th px-4 py-3.5">Max Stock</th>
            <th className="table-th px-4 py-3.5">Status</th>
            <th className="table-th px-4 py-3.5 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="table-td px-5 py-12 text-center type-body text-text-muted">
                No supplies found.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.itemId} className="table-row hover:bg-hover transition-colors group">
                <td className="sticky left-0 z-10 w-16 px-4 py-3 table-td text-text-muted whitespace-nowrap bg-surface group-hover:bg-hover transition-colors border-r border-divider shadow-sticky-col">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="table-td px-4 py-3 font-medium text-text-primary min-w-[200px]">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <span className="cursor-default whitespace-nowrap">
                        {item.itemName}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72">
                      <div className="space-y-1.5">
                        <p className="type-caption font-bold text-text-primary">{item.itemName}</p>
                        {item.itemCode && (
                          <p className="type-caption font-mono text-text-muted">No: {item.itemCode}</p>
                        )}
                        <p className="type-caption text-text-muted">Category: {item.categoryName}</p>
                        <p className="type-caption text-text-muted">UOM: {item.uomName}</p>
                        <div className="pt-1">
                          <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </td>
                <td className="table-td px-4 py-3">
                  <span className="rounded-pill bg-surface-muted text-text-primary border border-divider px-2.5 py-0.5 type-caption font-semibold">
                    {item.categoryName}
                  </span>
                </td>
                <td className="table-td px-4 py-3 text-text-muted">{item.uomName}</td>
                <td className="table-td px-4 py-3 text-text-muted">{item.minStockLevel}</td>
                <td className="table-td px-4 py-3 text-text-muted">{item.maxStockLevel}</td>
                <td className="table-td px-4 py-3">
                  <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
                </td>
                <td className="table-td px-4 py-3 text-center relative">
                  <button
                    type="button"
                    onClick={() => setActiveDropdownId(activeDropdownId === item.itemId ? null : item.itemId)}
                    aria-label="Record actions" className="p-1.5 rounded-control text-text-primary hover:bg-hover transition-colors focus:outline-none"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownId === item.itemId && (
                    <div className="absolute right-10 top-2 z-[100] w-36 rounded-menu border border-divider bg-surface shadow-menu py-1.5 text-left">
                      {onView && (
                        <button
                          type="button"
                          onClick={() => {
                            onView(item);
                            setActiveDropdownId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-hover transition-colors"
                        >
                          <Eye size={14} className="shrink-0" /> View Details
                        </button>
                      )}
                      {canConfigure && (
                        <button
                          type="button"
                          onClick={() => {
                            onEdit(item);
                            setActiveDropdownId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-hover transition-colors"
                        >
                          <Pencil size={14} className="shrink-0" /> Edit Supply
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
