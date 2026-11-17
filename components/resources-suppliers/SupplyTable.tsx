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
    <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[900px]">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">
            <th className="sticky left-0 z-20 w-16 px-4 py-3.5 bg-muted/95 backdrop-blur-xs border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">No.</th>
            <th className="px-4 py-3.5 min-w-[200px]">Name</th>
            <th className="px-4 py-3.5">Category</th>
            <th className="px-4 py-3.5">Unit</th>
            <th className="px-4 py-3.5">Min Stock</th>
            <th className="px-4 py-3.5">Max Stock</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-12 text-center text-sm font-normal text-muted-foreground">
                No supplies found.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.itemId} className="hover:bg-muted/20 transition-colors group">
                <td className="sticky left-0 z-10 w-16 px-4 py-3 text-sm text-muted-foreground whitespace-nowrap bg-card group-hover:bg-muted/40 transition-colors border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-foreground min-w-[200px]">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <span className="cursor-default whitespace-nowrap">
                        {item.itemName}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72">
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-foreground">{item.itemName}</p>
                        {item.itemCode && (
                          <p className="text-xs font-mono text-muted-foreground">No: {item.itemCode}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Category: {item.categoryName}</p>
                        <p className="text-xs text-muted-foreground">UOM: {item.uomName}</p>
                        <div className="pt-1">
                          <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-muted text-foreground border border-border px-2.5 py-0.5 text-xs font-semibold">
                    {item.categoryName}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.uomName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.minStockLevel}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.maxStockLevel}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
                </td>
                <td className="px-4 py-3 text-center relative">
                  <button
                    type="button"
                    onClick={() => setActiveDropdownId(activeDropdownId === item.itemId ? null : item.itemId)}
                    aria-label="Record actions" className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownId === item.itemId && (
                    <div className="absolute right-10 top-2 z-[100] w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left">
                      {onView && (
                        <button
                          type="button"
                          onClick={() => {
                            onView(item);
                            setActiveDropdownId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
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
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
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
