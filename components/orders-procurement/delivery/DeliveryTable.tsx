"use client";

import React from "react";
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
  const fmtDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      : "—";

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[150px]">Delivery No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Purchase Order Ref.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Supplier</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Carrier</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Expected Date</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Items</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {deliveries.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center type-body text-ink-muted">
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
                  icon: <Eye className="w-4 h-4 text-ink" />,
                  onClick: () => onView(delivery),
                },
              ];

              // Only inventory manager has actions; admin side just checks/views
              if (isScheduled && onArrive) {
                actions.push({
                  label: "Mark Arrived",
                  icon: <CheckCircle className="w-4 h-4 text-ink" />,
                  onClick: () => onArrive(delivery),
                });
              }
              if (isArrived && !delivery.grnNumber && onCreateGrn) {
                actions.push({
                  label: "Create Goods Receipt Note",
                  icon: <Receipt className="w-4 h-4 text-ink" />,
                  onClick: () => onCreateGrn(delivery),
                });
              }
              if (isCancellable && onCancel) {
                actions.push({
                  label: "Cancel Delivery",
                  icon: <Ban className="w-4 h-4 text-ink" />,
                  onClick: () => onCancel(delivery),
                });
              }

              return (
                <tr
                  key={delivery.deliveryId}
                  className="group hover:bg-page transition-colors cursor-pointer"
                  onClick={() => onView(delivery)}
                >
                  <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[150px]">
                    {delivery.deliveryNumber}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap tabular-nums">
                    {delivery.poNumber || "—"}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap max-w-[200px] truncate" title={delivery.supplierName}>
                    {delivery.supplierName || "—"}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {delivery.carrier || "In-House"}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {fmtDate(delivery.expectedArrivalDate || delivery.scheduledDate)}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap tabular-nums">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <StatusBadge status={delivery.status} />
                  </td>
                  <td
                    className="w-16 py-3 pl-4 text-center whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                          aria-label="Actions menu"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {actions.map((action, idx) => (
                          <DropdownMenuItem
                            key={action.label + idx}
                            onClick={action.onClick}
                            className="cursor-pointer type-body-secondary"
                          >
                            <span className="shrink-0">{action.icon}</span>
                            <span className="truncate">{action.label}</span>
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
