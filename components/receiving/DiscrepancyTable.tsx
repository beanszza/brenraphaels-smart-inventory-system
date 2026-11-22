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
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[740px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="sticky left-0 z-20 bg-surface pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[150px]">Discrepancy No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Type</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Item Name</th>
            <th className="pb-2.5 pt-1 pr-6 type-table-header text-ink-muted text-right whitespace-nowrap">Variance</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Resolution</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {discrepancies.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-12 text-center type-body text-ink-muted">
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
                  className="group hover:bg-page transition-colors cursor-pointer"
                >
                  <td className="sticky left-0 z-10 bg-surface group-hover:bg-page transition-colors py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[150px]">
                    {d.discrepancyNumber}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {isShort ? "Shortage" : isOver ? "Over Supply" : "Rejected"}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink max-w-[200px] truncate" title={d.itemName}>
                    {d.itemName}
                  </td>
                  <td className="py-3 pr-6 type-body font-medium text-ink text-right whitespace-nowrap tabular-nums">
                    {isOver ? "+" : "-"}
                    {d.discrepancyQuantity.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 type-body whitespace-nowrap">
                    {d.resolutionType ? (
                      <span className="text-ink">{d.resolutionType}</span>
                    ) : (
                      <span className="text-ink-muted">Pending Action</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <StatusBadge status={d.status} />
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
                          title="Actions"
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
                          onSelect={() => onSelectDiscrepancy(d)}
                          className="cursor-pointer type-body-secondary"
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
