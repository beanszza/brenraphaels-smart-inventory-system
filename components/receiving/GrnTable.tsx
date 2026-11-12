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
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
            <th className="px-4 py-4">Goods Receipt Note No.</th>
            <th className="px-4 py-4">Delivery #</th>
            <th className="px-4 py-4">Supplier</th>
            <th className="px-4 py-4">Received Date</th>
            <th className="px-4 py-4 text-center">Status</th>
            <th className="w-16 px-4 py-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {grns.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm font-normal text-muted-foreground">
                No goods receipt notes found
              </td>
            </tr>
          ) : (
            grns.map((grn) => (
              <tr
                key={grn.grnId}
                onClick={() => onSelectGrn(grn)}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <td className="px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                  {grn.grnNumber}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                  {grn.deliveryNumber || "—"}
                </td>
                <td className="px-4 py-4 text-sm font-medium text-foreground max-w-[180px] truncate" title={grn.supplierName}>
                  {grn.supplierName}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
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
                        className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none cursor-pointer"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                      className="w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left"
                    >
                      <DropdownMenuItem
                        onSelect={() => onSelectGrn(grn)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted cursor-pointer"
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
