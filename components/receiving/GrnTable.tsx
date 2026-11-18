"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React from "react";
import { Eye, MoreHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GRN } from "./types";

interface GrnTableProps {
  grns: GRN[];
  loading: boolean;
  onSelectGrn: (grn: GRN) => void;
}

export default function GrnTable({ grns, loading, onSelectGrn }: GrnTableProps) {
  if (loading) {
    return <ReceivingSkeleton />;
  }

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead className="table-head-row border-b border-divider bg-surface-muted/30">
          <tr className="text-left table-th text-text-muted whitespace-nowrap">
            <th className="sticky left-0 z-20 bg-surface-muted px-4 py-4 min-w-[160px] w-48 whitespace-nowrap border-r border-divider shadow-sticky">Goods Receipt Note No.</th>
            <th className="px-4 py-4 whitespace-nowrap">Delivery #</th>
            <th className="px-4 py-4">Supplier</th>
            <th className="px-4 py-4">Received Date</th>
            <th className="px-4 py-4 text-center">Status</th>
            <th className="w-16 px-4 py-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {grns.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center type-body font-normal text-text-muted">
                No goods receipt notes found
              </td>
            </tr>
          ) : (
            grns.map((grn) => (
              <tr
                key={grn.grnId}
                onClick={() => onSelectGrn(grn)}
                className="table-row group hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface-hover px-4 py-4 table-td font-semibold text-text-primary whitespace-nowrap min-w-[160px] w-48 border-r border-divider shadow-sticky transition-colors">
                  {grn.grnNumber}
                </td>
                <td className="px-4 py-4 table-td text-text-muted whitespace-nowrap">
                  {grn.deliveryNumber || "—"}
                </td>
                <td className="px-4 py-4 table-td font-medium text-text-primary max-w-[180px] truncate" title={grn.supplierName}>
                  {grn.supplierName}
                </td>
                <td className="px-4 py-4 table-td text-text-muted whitespace-nowrap">
                  {new Date(grn.receivedDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-4 text-center whitespace-nowrap">
                  <StatusBadge status={grn.status} />
                </td>
                <td
                  className="w-16 px-4 py-4 text-center relative whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Record actions"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-control text-text-primary hover:bg-surface-hover transition-colors focus:outline-none cursor-pointer"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                      className="w-36 rounded-control border border-divider bg-surface shadow-modal py-1.5 text-left"
                    >
                      <DropdownMenuItem
                        onSelect={() => onSelectGrn(grn)}
                        className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover focus:bg-surface-hover cursor-pointer"
                      >
                        <Eye size={14} className="shrink-0" /> View Details
                      </DropdownMenuItem>
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
