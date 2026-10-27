"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React from "react";
import { MoreHorizontal, Eye } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
  const [activeMenuId, setActiveMenuId] = React.useState<number | null>(null);
  if (loading) {
    return (
      <ReceivingSkeleton />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm min-h-[300px]">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">Discrepancy No.</th>
            <th className="px-3 py-3">Type</th>
            <th className="px-4 py-3">Item Name</th>
            <th className="px-3 py-3 text-right">Variance</th>
            <th className="px-4 py-3">Resolution</th>
            <th className="px-3 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-center w-24">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {discrepancies.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
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
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-foreground whitespace-nowrap">
                    {d.discrepancyNumber}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-muted border border-border text-foreground">
                      {isShort ? "Shortage" : isOver ? "Over Supply" : "Rejected"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate" title={d.itemName}>
                    {d.itemName}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                    {isOver ? "+" : "-"}
                    {d.discrepancyQuantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {d.resolutionType ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground text-xs">{d.resolutionType}</span>
                        {d.lossReportNumber && (
                          <span className="bg-muted border border-border px-1.5 py-0.5 rounded font-mono text-[10px] text-foreground">
                            {d.lossReportNumber}
                          </span>
                        )}
                        {d.rtvNumber && (
                          <span className="bg-muted border border-border px-1.5 py-0.5 rounded font-mono text-[10px] text-foreground">
                            {d.rtvNumber}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">
                        Pending Action
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(activeMenuId === d.discrepancyId ? null : d.discrepancyId)}
                      className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                      title="Actions"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {activeMenuId === d.discrepancyId && (
                      <div className="absolute right-6 top-2 z-[100] w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDiscrepancy(d);
                            setActiveMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          <Eye size={14} className="shrink-0" /> {isOpen ? "Resolve" : "View Details"}
                        </button>
                      </div>
                    )}
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
