"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React from "react";
import { MoreHorizontal, Eye } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Discrepancy } from "./types";

interface DiscrepancyTableProps {
  discrepancies: Discrepancy[];
  loading: boolean;
  onSelectDiscrepancy: (item: Discrepancy) => void;
}

export default function DiscrepancyTable({
  discrepancies,
  loading,
  onSelectDiscrepancy,
}: DiscrepancyTableProps) {
  if (loading) {
    return <ReceivingSkeleton />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
            <th className="px-4 py-4">Discrepancy No.</th>
            <th className="px-4 py-4">Type</th>
            <th className="px-4 py-4">Item Name</th>
            <th className="px-4 py-4 text-right">Variance</th>
            <th className="px-4 py-4">Resolution</th>
            <th className="px-4 py-4 text-center">Status</th>
            <th className="w-16 px-4 py-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {discrepancies.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-sm font-normal text-muted-foreground">
                No discrepancies found
              </td>
            </tr>
          ) : (
            discrepancies.map((d) => {
              const isOpen = d.status === "Open";
              const isShort = d.discrepancyType === "PartialShort" || d.discrepancyType === "Short";
              const isOver = d.discrepancyType === "OverSupply" || d.discrepancyType === "Over";

              return (
                <tr
                  key={d.discrepancyId}
                  onClick={() => onSelectDiscrepancy(d)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                    {d.discrepancyNumber}
                  </td>
                  <td className="px-4 py-4 text-sm whitespace-nowrap">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-muted border border-border text-foreground">
                      {isShort ? "Shortage" : isOver ? "Over Supply" : "Rejected"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-foreground max-w-[200px] truncate" title={d.itemName}>
                    {d.itemName}
                  </td>
                  <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">
                    {isOver ? "+" : "-"}
                    {d.discrepancyQuantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                    {d.resolutionType ? (
                      <span className="font-semibold text-foreground">{d.resolutionType}</span>
                    ) : (
                      <span className="text-muted-foreground italic">
                        Pending Action
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <StatusBadge status={d.status} />
                  </td>
                  <td
                    className="w-16 px-4 py-4 text-center whitespace-nowrap relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Record actions"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none cursor-pointer"
                          title="Actions"
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
                          onSelect={() => onSelectDiscrepancy(d)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted cursor-pointer"
                        >
                          <Eye size={14} className="shrink-0" /> {isOpen ? "Resolve" : "View Details"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
