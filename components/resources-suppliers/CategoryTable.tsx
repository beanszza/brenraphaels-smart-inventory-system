"use client";

import React from "react";
import { MoreHorizontal, Pencil } from "lucide-react";
import { CategoryItem } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CategoryTableProps {
  items: CategoryItem[];
  currentPage: number;
  pageSize: number;
  canConfigure?: boolean;
  onEdit: (item: CategoryItem) => void;
}

export default function CategoryTable({
  items,
  currentPage,
  pageSize,
  canConfigure = true,
  onEdit,
}: CategoryTableProps) {

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[700px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="w-12 pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[180px]">Category Name</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Description</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Linked Items</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Expiry</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            {canConfigure && <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={canConfigure ? 7 : 6}
                className="py-12 text-center type-body font-normal text-ink-muted"
              >
                No categories found.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.categoryId} className="hover:bg-page transition-colors group">
                <td className="w-12 py-3 pr-4 type-body text-ink-muted whitespace-nowrap tabular-nums">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap min-w-[180px]">
                  {item.categoryName}
                </td>
                <td className="py-3 pr-4 type-body text-ink-muted max-w-[280px] truncate">
                  {item.description || "-"}
                </td>
                <td className={`py-3 pr-4 type-body whitespace-nowrap tabular-nums ${item.itemCount ? "text-ink" : "text-ink-muted"}`}>
                  {item.itemCount !== undefined ? `${item.itemCount} item(s)` : "-"}
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <StatusBadge status={item.hasExpiry !== false ? "Yes" : "No"}>
                    {item.hasExpiry !== false ? "Has Expiry" : "No Expiry"}
                  </StatusBadge>
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
                </td>
                {canConfigure && (
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
                        <DropdownMenuItem
                          onClick={() => onEdit(item)}
                          className="cursor-pointer type-body-secondary"
                        >
                          <Pencil size={14} className="shrink-0" /> Edit Category
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
