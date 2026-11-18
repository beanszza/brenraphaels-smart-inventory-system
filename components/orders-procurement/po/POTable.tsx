"use client";

import React, { useState, useEffect, useRef } from "react";
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

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
      <table className="w-full">
        <thead className="border-b border-divider bg-surface-muted table-head-row">
          <tr className="border-b border-divider bg-surface-muted table-head-row uppercase text-text-muted type-table-header">
            <th className="sticky left-0 z-20 bg-surface-muted px-4 py-3 text-left type-table-header text-text-muted tracking-wider whitespace-nowrap min-w-[160px] w-44 border-r border-divider shadow-sticky-col table-th">PURCHASE ORDER NUMBER</th>
            <th className="px-4 py-3 text-left type-table-header text-text-muted tracking-wider whitespace-nowrap table-th">SUPPLIER</th>
            <th className="px-4 py-3 text-left type-table-header text-text-muted tracking-wider whitespace-nowrap table-th">ORDER DATE</th>
            <th className="px-4 py-3 text-left type-table-header text-text-muted tracking-wider whitespace-nowrap table-th">REQUESTED BY</th>
            <th className="px-4 py-3 text-left type-table-header text-text-muted tracking-wider whitespace-nowrap table-th">TOTAL AMOUNT</th>
            <th className="px-4 py-3 text-left type-table-header text-text-muted tracking-wider whitespace-nowrap table-th">STATUS</th>
            <th className="px-4 py-3 text-center type-table-header text-text-muted tracking-wider whitespace-nowrap w-24 table-th">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {orders.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-5 py-8 text-center type-body text-text-muted">
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
                  icon: <Eye className="w-4 h-4 text-text-primary" />,
                  onClick: () => { setOpenDropdownId(null); onView(po); },
                },
              ];

              // Inventory Manager actions only
              if (!isAdmin) {
                if ((isDraft || isReturned) && onEdit) {
                  actions.push({
                    label: isReturned ? "Edit & Re-Submit" : "Resend via Gmail",
                    icon: <Pencil className="w-4 h-4 text-text-primary" />,
                    onClick: () => { setOpenDropdownId(null); onEdit(po); },
                  });
                }
                if (isDraft && onDiscardDraft) {
                  actions.push({
                    label: "Discard Draft",
                    icon: <Trash2 className="w-4 h-4 text-status-red" />,
                    onClick: () => { setOpenDropdownId(null); onDiscardDraft(po); },
                  });
                }
                if (!isDraft && isCancellable && onCancel) {
                  actions.push({
                    label: "Cancel Purchase Order",
                    icon: <Ban className="w-4 h-4 text-text-primary" />,
                    onClick: () => { setOpenDropdownId(null); onCancel(po); },
                  });
                }
              }

              const fmtDate = (d: string) =>
                d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

              const fmtCurrency = (n: number) =>
                new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(n);

              return (
                <tr key={po.poId} className="group hover:bg-hover transition-colors cursor-pointer table-row" onClick={() => onView(po)}>
                  <td className="sticky left-0 z-10 bg-surface group-hover:bg-hover px-4 py-3.5 font-mono text-text-primary whitespace-nowrap font-medium min-w-[160px] w-44 border-r border-divider shadow-sticky-col transition-colors table-td">
                    {po.poNumber}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-text-primary whitespace-nowrap table-td">
                    {po.supplierName || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-text-muted whitespace-nowrap table-td">
                    {fmtDate(po.orderDate)}
                  </td>
                  <td className="px-4 py-3.5 text-text-muted whitespace-nowrap table-td">
                    {po.requestedBy || "—"}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-semibold text-text-primary whitespace-nowrap table-td">
                    {fmtCurrency(po.totalAmount || 0)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap table-td">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="px-4 py-3.5 text-center whitespace-nowrap table-td" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-control border border-transparent text-text-primary hover:bg-hover transition-all data-[state=open]:bg-surface-muted data-[state=open]:border-divider data-[state=open]:shadow-sm"
                          aria-label="Actions menu"
                        >
                          <MoreHorizontal className="w-4 h-4 text-text-primary" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 z-[200] rounded-menu border border-divider bg-surface shadow-menu">
                        {actions.map((action, idx) => (
                          <DropdownMenuItem
                            key={action.label + idx}
                            onClick={action.onClick}
                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer type-caption text-text-primary hover:bg-hover"
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
