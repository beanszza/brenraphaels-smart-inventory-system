"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React, { useState } from "react";
import { Truck, Eye, MoreHorizontal } from "lucide-react";
import { ArrivedDelivery } from "./types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

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
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  if (loading) {
    return (
      <ReceivingSkeleton />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">DELIVERY NO.</th>
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">SUPPLIER</th>
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">ARRIVAL DATE</th>
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">CARRIER</th>
            <th className="px-4 py-3 text-center font-bold text-muted-foreground tracking-wider whitespace-nowrap">STATUS</th>
            <th className="px-4 py-3 text-center font-bold text-muted-foreground tracking-wider whitespace-nowrap w-24">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {deliveries.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-xs text-muted-foreground">
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
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-foreground whitespace-nowrap">
                    {del.deliveryNumber}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate" title={del.supplierName}>
                    {del.supplierName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formattedArrival}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {del.carrier || "—"}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <StatusBadge status={del.status} />
                  </td>
                  <td
                    className="px-4 py-3 text-center whitespace-nowrap relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(activeMenuId === del.deliveryId ? null : del.deliveryId)}
                      className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none cursor-pointer"
                      title="Actions"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {activeMenuId === del.deliveryId && (
                      <>
                        <div
                          className="fixed inset-0 z-[40]"
                          onClick={() => setActiveMenuId(null)}
                        />
                        <div className="absolute right-4 top-10 z-[50] w-36 rounded-xl border border-border bg-card shadow-xl py-1 text-left animate-in fade-in-50 duration-100">
                          <button
                            type="button"
                            onClick={() => {
                              onViewDelivery(del);
                              setActiveMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View Details
                          </button>
                        </div>
                      </>
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
