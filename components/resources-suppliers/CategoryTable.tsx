"use client";

import React, { useState } from "react";
import { MoreHorizontal, Pencil } from "lucide-react";
import { CategoryItem } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";

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
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-border bg-surface">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="table-head-row">
            <th className="sticky left-0 z-20 w-16 px-5 py-2.5 bg-subtle table-th border-r border-border shadow-sticky-col">No.</th>
            <th className="px-5 py-2.5 table-th min-w-[180px]">Category Name</th>
            <th className="px-5 py-2.5 table-th">Description</th>
            <th className="px-5 py-2.5 table-th">Linked Items</th>
            <th className="px-5 py-2.5 table-th">Expiry</th>
            <th className="px-5 py-2.5 table-th">Status</th>
            {canConfigure && <th className="px-5 py-2.5 text-center table-th">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={canConfigure ? 7 : 6}
                className="px-5 py-12 text-center type-body font-normal text-ink-muted"
              >
                No categories found.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.categoryId} className="table-row group">
                <td className="sticky left-0 z-10 w-16 px-5 py-3 table-td text-ink-muted whitespace-nowrap bg-surface group-hover:bg-subtle transition-colors border-r border-border shadow-sticky-col tabular-nums">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="table-td text-ink whitespace-nowrap min-w-[180px]">
                  <span className="rounded-pill bg-subtle text-ink border border-border px-2.5 py-0.5 type-caption font-semibold">
                    {item.categoryName}
                  </span>
                </td>
                <td className="table-td text-ink-muted max-w-[280px] truncate">
                  {item.description || "-"}
                </td>
                <td className="table-td text-ink-muted whitespace-nowrap">
                  {item.itemCount !== undefined ? `${item.itemCount} item(s)` : "-"}
                </td>
                <td className="table-td whitespace-nowrap">
                  <StatusBadge status={item.hasExpiry !== false ? "Yes" : "No"}>
                    {item.hasExpiry !== false ? "Has Expiry" : "No Expiry"}
                  </StatusBadge>
                </td>
                <td className="table-td whitespace-nowrap">
                  <StatusBadge status={item.isActive !== false ? "Active" : "Inactive"} />
                </td>
                {canConfigure && (
                  <td className="table-td text-center relative whitespace-nowrap">
                    <button
                      type="button"
                      aria-label="Record actions"
                      onClick={() =>
                        setActiveDropdownId(
                          activeDropdownId === item.categoryId ? null : item.categoryId
                        )
                      }
                      className="p-1.5 rounded-control text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {activeDropdownId === item.categoryId && (
                      <div className="absolute right-10 top-2 z-[100] w-36 rounded-inner border border-border bg-surface shadow-modal py-1.5 text-left">
                        <button
                          type="button"
                          onClick={() => {
                            onEdit(item);
                            setActiveDropdownId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 type-body text-ink hover:bg-subtle transition-colors cursor-pointer"
                        >
                          <Pencil size={14} className="shrink-0" /> Edit Category
                        </button>
                      </div>
                    )}
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
