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
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[170px]">Goods Receipt Note No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Delivery #</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Supplier</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Received Date</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {grns.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-12 text-center type-body text-ink-muted">
                No goods receipt notes found
              </td>
            </tr>
          ) : (
            grns.map((grn) => (
              <tr
                key={grn.grnId}
                onClick={() => onSelectGrn(grn)}
                className="group hover:bg-page transition-colors cursor-pointer"
              >
                <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[170px]">
                  {grn.grnNumber}
                </td>
                <td className="py-3 pr-4 type-body text-ink whitespace-nowrap tabular-nums">
                  {grn.deliveryNumber || "—"}
                </td>
                <td className="py-3 pr-4 type-body text-ink max-w-[200px] truncate" title={grn.supplierName}>
                  {grn.supplierName}
                </td>
                <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                  {new Date(grn.receivedDate).toLocaleDateString()}
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <StatusBadge status={grn.status} />
                </td>
                <td
                  className="w-16 py-3 pl-4 text-center whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Record actions"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                      className="w-40"
                    >
                      <DropdownMenuItem
                        onSelect={() => onSelectGrn(grn)}
                        className="cursor-pointer type-body-secondary"
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
