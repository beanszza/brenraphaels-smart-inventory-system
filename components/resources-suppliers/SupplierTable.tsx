"use client";

import React, { useState } from "react";
import { MoreHorizontal, Pencil, Eye } from "lucide-react";
import { Supplier } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

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
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-border bg-surface">
      <table className="w-full">
        <thead>
          <tr className="table-head-row">
            <th className="sticky left-0 z-20 w-16 px-4 py-2.5 text-center bg-subtle table-th border-r border-border shadow-sticky-col">No.</th>
            <th className="px-4 py-2.5 table-th min-w-[200px]">Supplier Name</th>
            <th className="px-4 py-2.5 table-th">Contact Person</th>
            <th className="px-4 py-2.5 table-th">Email</th>
            <th className="px-4 py-2.5 table-th whitespace-nowrap">Phone</th>
            <th className="px-4 py-2.5 text-center table-th whitespace-nowrap">Status</th>
            <th className="w-16 px-4 py-2.5 text-center table-th whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {suppliers.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center type-body font-normal text-ink-muted">
                No suppliers found.
              </td>
            </tr>
          ) : (
            suppliers.map((supplier, index) => (
              <tr key={supplier.supplierId} className="table-row group">
                <td className="sticky left-0 z-10 w-16 px-4 py-3 table-td text-center text-ink-muted whitespace-nowrap bg-surface group-hover:bg-subtle transition-colors border-r border-border shadow-sticky-col tabular-nums">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="table-td font-semibold text-ink whitespace-nowrap min-w-[200px]">
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
                <td className="table-td text-ink-muted whitespace-nowrap">
                  {supplier.contactPerson}
                </td>
                <td className="table-td text-ink-muted">
                  {supplier.email}
                </td>
                <td className="table-td text-ink-muted whitespace-nowrap">
                  {supplier.phone}
                </td>
                <td className="table-td text-center whitespace-nowrap">
                  <StatusBadge status={supplier.isActive ? "Active" : "Inactive"} />
                </td>
                <td className="w-16 table-td text-center relative whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdownId(activeDropdownId === supplier.supplierId ? null : supplier.supplierId)
                    }
                    aria-label="Record actions"
                    className="p-1.5 rounded-control text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownId === supplier.supplierId && (
                    <div className="absolute right-10 top-2 z-[100] w-36 rounded-inner border border-border bg-surface shadow-modal py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          onView(supplier);
                          setActiveDropdownId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 type-body text-ink hover:bg-subtle transition-colors cursor-pointer"
                      >
                        <Eye size={14} className="shrink-0" /> View Details
                      </button>
                      {canConfigure && (
                        <button
                          type="button"
                          onClick={() => {
                            onEdit(supplier);
                            setActiveDropdownId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 type-body text-ink hover:bg-subtle transition-colors cursor-pointer"
                        >
                          <Pencil size={14} className="shrink-0" /> Edit Supplier
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
