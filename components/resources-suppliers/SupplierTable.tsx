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
  onEdit: (supplier: Supplier) => void;
  onView: (supplier: Supplier) => void;
}

export default function SupplierTable({ suppliers, currentPage, pageSize, onEdit, onView }: SupplierTableProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[900px]">
        <thead className="border-b border-border bg-card">
          <tr className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
            <th className="px-4 py-3">No.</th>
            <th className="px-4 py-3">Supplier Name</th>
            <th className="px-4 py-3">Contact Person</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {suppliers.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-5 py-10 text-center text-sm font-semibold text-muted-foreground">
                No Results Found
              </td>
            </tr>
          ) : (
            suppliers.map((supplier, index) => (
              <tr key={supplier.supplierId} className="hover:bg-card transition-colors">
                <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                  {index + 1 + (currentPage - 1) * pageSize}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-foreground">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <span className="cursor-default whitespace-nowrap">
                        {supplier.companyName}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72">
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-foreground">{supplier.companyName}</p>
                        {supplier.supplierCode && (
                          <p className="text-xs font-mono text-muted-foreground">No: {supplier.supplierCode}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Contact: {supplier.contactPerson}</p>
                        <p className="text-xs text-muted-foreground">Email: {supplier.email}</p>
                        <div className="pt-1">
                          <StatusBadge status={supplier.isActive ? "Active" : "Inactive"} />
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{supplier.contactPerson}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{supplier.email}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{supplier.phone}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={supplier.isActive ? "Active" : "Inactive"} />
                </td>
                <td className="px-4 py-3 text-center relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDropdownId(activeDropdownId === supplier.supplierId ? null : supplier.supplierId)
                    }
                    aria-label="Record actions" className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownId === supplier.supplierId && (
                    <div className="absolute right-10 top-2 z-[100] w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          onView(supplier);
                          setActiveDropdownId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Eye size={14} className="shrink-0" /> View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(supplier);
                          setActiveDropdownId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil size={14} className="shrink-0" /> Edit Supplier
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
