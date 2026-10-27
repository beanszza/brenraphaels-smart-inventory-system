"use client";

import React, { useState } from "react";
import { MoreHorizontal, Pencil } from "lucide-react";
import { CategoryItem } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface CategoryTableProps {
  items: CategoryItem[];
  currentPage: number;
  pageSize: number;
  onEdit: (item: CategoryItem) => void;
}

export default function CategoryTable({
  items,
  currentPage,
  pageSize,
  onEdit,
}: CategoryTableProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[700px]">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
            <th className="px-5 py-4">No.</th>
            <th className="px-5 py-4">Category Name</th>
            <th className="px-5 py-4">Description</th>
            <th className="px-5 py-4">Linked Items</th>
            <th className="px-5 py-4">Status</th>
            <th className="px-5 py-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-5 py-12 text-center text-sm font-normal text-muted-foreground"
              >
                No categories found.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.categoryId} className="hover:bg-muted/30 transition-colors">
                <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="px-5 py-4 text-sm font-medium text-foreground whitespace-nowrap">
                  <span className="rounded-md bg-muted text-foreground border border-border px-2.5 py-1 text-xs font-semibold">
                    {item.categoryName}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground max-w-[280px] truncate">
                  {item.description || "-"}
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
                  {item.itemCount !== undefined ? `${item.itemCount} item(s)` : "-"}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
                </td>
                <td className="px-5 py-4 text-center relative whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdownId(
                        activeDropdownId === item.categoryId ? null : item.categoryId
                      )
                    }
                    className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownId === item.categoryId && (
                    <div className="absolute right-10 top-2 z-[100] w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(item);
                          setActiveDropdownId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil size={14} className="shrink-0" /> Edit Category
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
