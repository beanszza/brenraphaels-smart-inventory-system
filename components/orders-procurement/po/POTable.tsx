"use client";

import React from "react";
import { Eye, Pencil, MoreHorizontal, Ban, Trash2 } from "lucide-react";
import { PurchaseOrderPO } from "../types";
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

interface POTableProps {
  orders: PurchaseOrderPO[];
  isAdmin?: boolean;
  onView: (po: PurchaseOrderPO) => void;
  onEdit?: (po: PurchaseOrderPO) => void;
  onCancel?: (po: PurchaseOrderPO) => void;
  onDiscardDraft?: (po: PurchaseOrderPO) => void;
}

export function POTable({ orders, isAdmin = false, onView, onEdit, onCancel, onDiscardDraft }: POTableProps) {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[780px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="sticky left-0 z-20 bg-surface pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[160px]">Purchase Order No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Supplier</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Order Date</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Requested By</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Total Amount</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {orders.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-12 text-center type-body text-ink-muted">
                No purchase orders found.
              </td>
            </tr>
          ) : (
            orders.map((po) => {
              const isDraft = po.status === "Draft";
              const isReturned = po.status === "Returned";
              const isCancellable = po.status === "Draft" || po.status === "Pending Approval" || po.status === "Returned";

              const actions: ActionItem[] = [
                {
                  label: "View Details",
                  icon: <Eye className="w-4 h-4 text-ink" />,
                  onClick: () => onView(po),
                },
              ];

              // Inventory Manager actions only
              if (!isAdmin) {
                if ((isDraft || isReturned) && onEdit) {
                  actions.push({
                    label: isReturned ? "Edit & Re-Submit" : "Resend via Gmail",
                    icon: <Pencil className="w-4 h-4 text-ink" />,
                    onClick: () => onEdit(po),
                  });
                }
                if (isDraft && onDiscardDraft) {
                  actions.push({
                    label: "Discard Draft",
                    icon: <Trash2 className="w-4 h-4 text-destructive" />,
                    onClick: () => onDiscardDraft(po),
                  });
                }
                if (!isDraft && isCancellable && onCancel) {
                  actions.push({
                    label: "Cancel Purchase Order",
                    icon: <Ban className="w-4 h-4 text-ink" />,
                    onClick: () => onCancel(po),
                  });
                }
              }

              const fmtDate = (d: string) =>
                d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

              const fmtCurrency = (n: number) =>
                new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(n);

              return (
                <tr key={po.poId} className="group hover:bg-page transition-colors cursor-pointer" onClick={() => onView(po)}>
                  <td className="sticky left-0 z-10 bg-surface group-hover:bg-page transition-colors py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[160px]">
                    {po.poNumber}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {po.supplierName || "—"}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {fmtDate(po.orderDate)}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {po.requestedBy || "—"}
                  </td>
                  <td className="py-3 pr-4 type-body font-medium text-ink whitespace-nowrap tabular-nums">
                    {fmtCurrency(po.totalAmount || 0)}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="w-16 py-3 pl-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                      <DropdownMenuContent align="end" className="w-48">
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
