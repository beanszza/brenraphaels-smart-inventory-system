"use client";

import React from "react";
import { MoreHorizontal, Pencil, Eye } from "lucide-react";
import { SupplyItem } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[780px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="sticky left-0 z-20 bg-surface w-12 pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[200px]">Name</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Category</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Unit</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Min Stock</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Max Stock</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center type-body text-ink-muted">
                No supplies found.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.itemId} className="hover:bg-page transition-colors group">
                <td className="sticky left-0 z-10 bg-surface group-hover:bg-page transition-colors w-12 py-3 pr-4 type-body text-ink-muted whitespace-nowrap tabular-nums">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap min-w-[200px]">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <span className="cursor-default whitespace-nowrap">
                        {item.itemName}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72">
                      <div className="space-y-1.5">
                        <p className="type-caption font-semibold text-ink">{item.itemName}</p>
                        {item.itemCode && (
                          <p className="type-caption font-mono text-ink-muted">No: {item.itemCode}</p>
                        )}
                        <p className="type-caption text-ink-muted">Category: {item.categoryName}</p>
                        <p className="type-caption text-ink-muted">UOM: {item.uomName}</p>
                        <div className="pt-1">
                          <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </td>
                <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                  {item.categoryName}
                </td>
                <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">{item.uomName}</td>
                <td className="py-3 pr-4 type-body text-ink whitespace-nowrap tabular-nums">{item.minStockLevel}</td>
                <td className="py-3 pr-4 type-body text-ink whitespace-nowrap tabular-nums">{item.maxStockLevel}</td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
                </td>
                <td className="w-16 py-3 pl-4 text-center whitespace-nowrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Record actions"
                        className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {onView && (
                        <DropdownMenuItem
                          onClick={() => onView(item)}
                          className="cursor-pointer type-body-secondary"
                        >
                          <Eye size={14} className="shrink-0" /> View Details
                        </DropdownMenuItem>
                      )}
                      {canConfigure && (
                        <DropdownMenuItem
                          onClick={() => onEdit(item)}
                          className="cursor-pointer type-body-secondary"
                        >
                          <Pencil size={14} className="shrink-0" /> Edit Supply
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
