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
  onEdit: (item: SupplyItem) => void;
  onView?: (item: SupplyItem) => void;
}

export default function SupplyTable({ items, currentPage, pageSize, onEdit, onView }: SupplyTableProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[900px]">
        <thead className="border-b border-border bg-card">
          <tr className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
            <th className="px-4 py-3">No.</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Unit</th>
            <th className="px-4 py-3">Min Stock</th>
            <th className="px-4 py-3">Max Stock</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-10 text-center text-sm font-semibold text-muted-foreground">
                No Results Found
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.itemId} className="hover:bg-card transition-colors">
                <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
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
