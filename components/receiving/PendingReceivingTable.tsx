"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React from "react";
import { Eye, MoreHorizontal } from "lucide-react";
import { ArrivedDelivery } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PendingReceivingTableProps {
  deliveries: ArrivedDelivery[];
  loading: boolean;
  onViewDelivery: (delivery: ArrivedDelivery) => void;
}

export default function PendingReceivingTable({
  deliveries,
  loading,
  onViewDelivery,
}: PendingReceivingTableProps) {
  if (loading) {
    return <ReceivingSkeleton />;
  }

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
            <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-xs px-4 py-4 min-w-[160px] w-44 whitespace-nowrap">Delivery No.</th>
            <th className="sticky left-[160px] z-20 bg-muted/95 backdrop-blur-xs px-4 py-4 min-w-[180px] border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap">Supplier</th>
            <th className="px-4 py-4">Arrival Date</th>
            <th className="px-4 py-4">Carrier</th>
            <th className="px-4 py-4 text-center">Status</th>
            <th className="w-16 px-4 py-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {deliveries.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm font-normal text-muted-foreground">
                No deliveries pending receiving
              </td>
            </tr>
          ) : (
            deliveries.map((del) => {
              const arrivalRaw =
                (del as any).actualArrivalDate ||
                del.actualArrival ||
                (del as any).scheduledDate ||
                del.estimatedArrival;
              const formattedArrival = arrivalRaw ? new Date(arrivalRaw).toLocaleDateString() : "—";

              return (
                <tr
                  key={del.deliveryId}
                  onClick={() => onViewDelivery(del)}
                  className="group hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/40 px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap min-w-[160px] w-44 transition-colors">
                    {del.deliveryNumber}
                  </td>
                  <td className="sticky left-[160px] z-10 bg-card group-hover:bg-muted/40 px-4 py-4 text-sm font-medium text-foreground min-w-[180px] border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] truncate transition-colors" title={del.supplierName}>
                    {del.supplierName}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                    {formattedArrival}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                    {del.carrier || "—"}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <StatusBadge status={del.status} />
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
                          onSelect={() => onViewDelivery(del)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted cursor-pointer"
                        >
                          <Eye size={14} className="shrink-0" /> View Details
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
