"use client";

import React from "react";
import { MoreHorizontal, Pencil, Eye } from "lucide-react";
import { Supplier } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SupplierTableProps {
  suppliers: Supplier[];
  currentPage: number;
  pageSize: number;
  canConfigure?: boolean;
  onEdit: (supplier: Supplier) => void;
  onView: (supplier: Supplier) => void;
}

export default function SupplierTable({
  suppliers,
  currentPage,
  pageSize,
  canConfigure = true,
  onEdit,
  onView,
}: SupplierTableProps) {

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="sticky left-0 z-20 bg-surface w-12 pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[200px]">Supplier Name</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Contact Person</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Email</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Phone</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {suppliers.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-12 text-center type-body font-normal text-ink-muted">
                No suppliers found.
              </td>
            </tr>
          ) : (
            suppliers.map((supplier, index) => (
              <tr key={supplier.supplierId} className="hover:bg-page transition-colors group">
                <td className="sticky left-0 z-10 bg-surface group-hover:bg-page transition-colors w-12 py-3 pr-4 type-body text-ink-muted whitespace-nowrap tabular-nums">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap min-w-[200px]">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <span className="cursor-default whitespace-nowrap">
                        {supplier.companyName}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72">
                      <div className="space-y-1.5">
                        <p className="type-caption font-semibold text-ink">{supplier.companyName}</p>
                        {supplier.supplierCode && (
                          <p className="type-caption font-mono text-ink-muted">No: {supplier.supplierCode}</p>
                        )}
                        <p className="type-caption text-ink-muted">Contact: {supplier.contactPerson}</p>
                        <p className="type-caption text-ink-muted">Email: {supplier.email}</p>
                        <div className="pt-1">
                          <StatusBadge status={supplier.isActive ? "Active" : "Inactive"} />
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </td>
                <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                  {supplier.contactPerson}
                </td>
                <td className="py-3 pr-4 type-body text-ink">
                  {supplier.email}
                </td>
                <td className="py-3 pr-4 type-body text-ink whitespace-nowrap tabular-nums">
                  {supplier.phone}
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <StatusBadge status={supplier.isActive ? "Active" : "Inactive"} />
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
                      <DropdownMenuItem
                        onClick={() => onView(supplier)}
                        className="cursor-pointer type-body-secondary"
                      >
                        <Eye size={14} className="shrink-0" /> View Details
                      </DropdownMenuItem>
                      {canConfigure && (
                        <DropdownMenuItem
                          onClick={() => onEdit(supplier)}
                          className="cursor-pointer type-body-secondary"
                        >
                          <Pencil size={14} className="shrink-0" /> Edit Supplier
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
