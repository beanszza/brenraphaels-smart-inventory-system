"use client";

import React, { useState, useEffect, useRef } from "react";
import { Eye, CheckCircle, Receipt, Ban, MoreHorizontal } from "lucide-react";
import { Delivery } from "../types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface DeliveryTableProps {
  deliveries: Delivery[];
  onView: (delivery: Delivery) => void;
  onArrive?: (delivery: Delivery) => void;
  onCancel?: (delivery: Delivery) => void;
  onCreateGrn?: (delivery: Delivery) => void;
}

export function DeliveryTable({
  deliveries,
  onView,
  onArrive,
  onCancel,
  onCreateGrn,
}: DeliveryTableProps) {
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    if (openDropdownId !== null) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownId]);

  const fmtDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      : "—";

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
      <table className="w-full type-table-cell">
        <thead>
          <tr className="border-b border-divider bg-surface-muted table-head-row type-table-header">
            <th className="table-th sticky left-0 z-20 bg-surface-muted backdrop-blur-xs px-4 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap min-w-[160px] w-44 border-r border-divider shadow-sticky">DELIVERY NO.</th>
            <th className="table-th px-4 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">PURCHASE ORDER REF.</th>
            <th className="table-th px-4 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">SUPPLIER</th>
            <th className="table-th px-4 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">CARRIER</th>
            <th className="table-th px-4 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">EXPECTED DATE</th>
            <th className="table-th px-4 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">ITEMS</th>
            <th className="table-th px-4 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">STATUS</th>
            <th className="table-th px-4 py-3 text-center font-bold text-text-muted tracking-wider whitespace-nowrap w-24">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {deliveries.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-8 text-center type-body font-medium text-text-muted">
                No delivery shipments found.
              </td>
            </tr>
          ) : (
            deliveries.map((delivery) => {
              const isScheduled = delivery.status === "Scheduled";
              const isArrived = delivery.status === "Arrived";
              const isCancellable = isScheduled;

              const itemCount = delivery.items?.length || 0;

              const actions: ActionItem[] = [
                {
                  label: "View Details",
                  icon: <Eye className="w-4 h-4 text-text-primary" />,
                  onClick: () => {
                    setOpenDropdownId(null);
                    onView(delivery);
                  },
                },
              ];

              // Only inventory manager has actions; admin side just checks/views
              if (isScheduled && onArrive) {
                actions.push({
                  label: "Mark Arrived",
                  icon: <CheckCircle className="w-4 h-4 text-text-primary" />,
                  onClick: () => {
                    setOpenDropdownId(null);
                    onArrive(delivery);
                  },
                });
              }
              if (isArrived && !delivery.grnNumber && onCreateGrn) {
                actions.push({
                  label: "Create Goods Receipt Note",
                  icon: <Receipt className="w-4 h-4 text-text-primary" />,
                  onClick: () => {
                    setOpenDropdownId(null);
                    onCreateGrn(delivery);
                  },
                });
              }
              if (isCancellable && onCancel) {
                actions.push({
                  label: "Cancel Delivery",
                  icon: <Ban className="w-4 h-4 text-text-primary" />,
                  onClick: () => {
                    setOpenDropdownId(null);
                    onCancel(delivery);
                  },
                });
              }

              return (
                <tr
                  key={delivery.deliveryId}
                  className="group hover:bg-surface-hover transition-colors cursor-pointer table-row"
                  onClick={() => onView(delivery)}
                >
                  <td className="table-td sticky left-0 z-10 bg-surface group-hover:bg-surface-hover px-4 py-3.5 font-mono text-text-primary whitespace-nowrap font-medium min-w-[160px] w-44 border-r border-divider shadow-sticky transition-colors">
                    {delivery.deliveryNumber}
                  </td>
                  <td className="table-td px-4 py-3.5 font-mono text-text-muted whitespace-nowrap">
                    {delivery.poNumber || "—"}
                  </td>
                  <td className="table-td px-4 py-3.5 font-medium text-text-primary whitespace-nowrap max-w-[200px] truncate" title={delivery.supplierName}>
                    {delivery.supplierName || "—"}
                  </td>
                  <td className="table-td px-4 py-3.5 text-text-muted whitespace-nowrap">
                    {delivery.carrier || "In-House"}
                  </td>
                  <td className="table-td px-4 py-3.5 text-text-muted whitespace-nowrap">
                    {fmtDate(delivery.expectedArrivalDate || delivery.scheduledDate)}
                  </td>
                  <td className="table-td px-4 py-3.5 font-mono text-text-primary whitespace-nowrap">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </td>
                  <td className="table-td px-4 py-3.5 whitespace-nowrap">
                    <StatusBadge status={delivery.status} />
                  </td>
                  <td
                    className="table-td px-4 py-3.5 text-center whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-control border border-transparent text-text-primary hover:bg-surface-hover transition-all data-[state=open]:bg-surface-muted data-[state=open]:border-divider cursor-pointer"
                          aria-label="Actions menu"
                        >
                          <MoreHorizontal className="w-4 h-4 text-text-primary" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 z-[200] rounded-card border border-divider bg-surface shadow-modal">
                        {actions.map((action, idx) => (
                          <DropdownMenuItem
                            key={action.label + idx}
                            onClick={action.onClick}
                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer type-caption font-medium hover:bg-surface-hover text-text-primary"
                          >
                            <span className="shrink-0 text-text-primary">{action.icon}</span>
                            <span className="truncate text-text-primary">{action.label}</span>
                          </DropdownMenuItem>
                        ))}
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
