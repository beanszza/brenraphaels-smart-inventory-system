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
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[700px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[150px]">Delivery No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Supplier</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Arrival Date</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Carrier</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {deliveries.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-12 text-center type-body text-ink-muted">
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
                  className="group hover:bg-page transition-colors cursor-pointer"
                >
                  <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[150px]">
                    {del.deliveryNumber}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink truncate max-w-[220px]" title={del.supplierName}>
                    {del.supplierName}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {formattedArrival}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {del.carrier || "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <StatusBadge status={del.status} />
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
                          onSelect={() => onViewDelivery(del)}
                          className="cursor-pointer type-body-secondary"
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
