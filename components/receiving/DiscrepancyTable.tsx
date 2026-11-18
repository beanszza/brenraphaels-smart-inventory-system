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
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead className="border-b border-divider bg-surface-secondary">
          <tr className="table-head-row text-left whitespace-nowrap">
            <th className="sticky left-0 z-20 bg-surface-secondary table-th px-4 py-3 min-w-[150px] w-40 whitespace-nowrap border-r border-divider shadow-sticky">Discrepancy No.</th>
            <th className="table-th px-4 py-3 whitespace-nowrap">Type</th>
            <th className="table-th px-4 py-3">Item Name</th>
            <th className="table-th px-4 py-3 text-right">Variance</th>
            <th className="table-th px-4 py-3">Resolution</th>
            <th className="table-th px-4 py-3 text-center">Status</th>
            <th className="table-th w-16 px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {discrepancies.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center type-body text-text-muted">
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
                  className="table-row group hover:bg-surface-secondary/50 transition-colors cursor-pointer"
                >
                  <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface-secondary/50 px-4 py-3 table-td font-semibold text-text-primary whitespace-nowrap min-w-[150px] w-40 border-r border-divider shadow-sticky transition-colors">
                    {d.discrepancyNumber}
                  </td>
                  <td className="px-4 py-3 table-td whitespace-nowrap">
                    <span className="type-caption font-semibold px-2.5 py-0.5 rounded-control bg-surface-secondary border border-divider text-text-primary">
                      {isShort ? "Shortage" : isOver ? "Over Supply" : "Rejected"}
                    </span>
                  </td>
                  <td className="px-4 py-3 table-td font-medium text-text-primary max-w-[200px] truncate" title={d.itemName}>
                    {d.itemName}
                  </td>
                  <td className="px-4 py-3 table-td text-right font-semibold text-text-primary whitespace-nowrap">
                    {isOver ? "+" : "-"}
                    {d.discrepancyQuantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 table-td text-text-muted whitespace-nowrap">
                    {d.resolutionType ? (
                      <span className="font-semibold text-text-primary">{d.resolutionType}</span>
                    ) : (
                      <span className="text-text-muted italic">
                        Pending Action
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <StatusBadge status={d.status} />
                  </td>
                  <td
                    className="w-16 px-4 py-3 text-center whitespace-nowrap relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Record actions"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-control text-text-primary hover:bg-surface-secondary transition-colors focus:outline-none cursor-pointer"
                          title="Actions"
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
                          onSelect={() => onSelectDiscrepancy(d)}
                          className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-secondary focus:bg-surface-secondary cursor-pointer"
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
