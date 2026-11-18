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
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead className="table-head-row border-b border-divider bg-surface-muted/30">
          <tr className="text-left table-th text-text-muted whitespace-nowrap">
            <th className="sticky left-0 z-20 bg-surface-muted px-4 py-4 min-w-[150px] w-44 whitespace-nowrap border-r border-divider shadow-sticky">Delivery No.</th>
            <th className="px-4 py-4 whitespace-nowrap">Supplier</th>
            <th className="px-4 py-4">Arrival Date</th>
            <th className="px-4 py-4">Carrier</th>
            <th className="px-4 py-4 text-center">Status</th>
            <th className="w-16 px-4 py-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {deliveries.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center type-body font-normal text-text-muted">
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
                  className="table-row group hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface-hover px-4 py-4 table-td font-semibold text-text-primary whitespace-nowrap min-w-[150px] w-44 border-r border-divider shadow-sticky transition-colors">
                    {del.deliveryNumber}
                  </td>
                  <td className="px-4 py-4 table-td font-medium text-text-primary truncate" title={del.supplierName}>
                    {del.supplierName}
                  </td>
                  <td className="px-4 py-4 table-td text-text-muted whitespace-nowrap">
                    {formattedArrival}
                  </td>
                  <td className="px-4 py-4 table-td text-text-muted whitespace-nowrap">
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
                          className="p-1.5 rounded-control text-text-primary hover:bg-surface-hover transition-colors focus:outline-none cursor-pointer"
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
                          onSelect={() => onViewDelivery(del)}
                          className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover focus:bg-surface-hover cursor-pointer"
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
