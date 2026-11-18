"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, ClipboardCheck, Pencil, Truck, XCircle, Eye } from "lucide-react";
import { Order } from "./types";

interface ProcurementTableProps {
  orders: Order[];
  onQAInspection: (order: Order) => void;
  onEdit: (order: Order) => void;
  onMarkArrived: (order: Order) => void;
  onCancel: (order: Order) => void;
  onViewDetails: (order: Order) => void;
}

import { StatusBadge } from "@/components/shared/StatusBadge";

export default function ProcurementTable({
  orders,
  onQAInspection,
  onEdit,
  onMarkArrived,
  onCancel,
  onViewDetails,
}: ProcurementTableProps) {
  const [activeDropdownPoId, setActiveDropdownPoId] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface">
      <table className="w-full type-table-cell">
        <thead>
          <tr className="table-head-row border-b border-divider">
            <th className="table-th sticky left-0 z-20 min-w-[140px] w-36 px-3 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap bg-surface-muted backdrop-blur-xs border-r border-divider shadow-sticky">ORDER NO.</th>
            <th className="table-th px-3 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">ITEM</th>
            <th className="table-th px-3 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">SUPPLIER</th>
            <th className="table-th px-3 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">QUANTITY</th>
            <th className="table-th px-3 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">ORDER DATE</th>
            <th className="table-th px-3 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">ETA</th>
            <th className="table-th px-3 py-3 text-left font-bold text-text-muted tracking-wider whitespace-nowrap">STATUS</th>
            <th className="table-th px-3 py-3 text-center font-bold text-text-muted tracking-wider whitespace-nowrap">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {orders.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-10 text-center type-body font-semibold text-text-muted">
                No Results Found
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="hover:bg-surface-hover transition-colors group table-row">
                <td className="table-td sticky left-0 z-10 min-w-[140px] w-36 px-3 py-3 font-bold text-text-primary whitespace-nowrap bg-surface group-hover:bg-surface-hover transition-colors border-r border-divider shadow-sticky">{order.id}</td>
                <td className="table-td px-3 py-3 font-medium text-text-primary whitespace-nowrap">{order.item}</td>
                <td className="table-td px-3 py-3 text-text-muted whitespace-nowrap">{order.supplier}</td>
                <td className="table-td px-3 py-3 text-text-muted whitespace-nowrap">{order.quantity}</td>
                <td className="table-td px-3 py-3 text-text-muted whitespace-nowrap">{order.orderDate}</td>
                <td className="table-td px-3 py-3 whitespace-nowrap text-text-muted">{order.eta}</td>
                <td className="table-td px-3 py-3"><StatusBadge status={order.status} /></td>
                <td className="table-td px-3 py-3 text-center relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeDropdownPoId === order.poId) setActiveDropdownPoId(null);
                      else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setDropdownPosition({ top: rect.bottom + window.scrollY, left: Math.max(8, rect.right - 176 + window.scrollX) });
                        setActiveDropdownPoId(order.poId);
                      }
                    }}
                    className="p-1.5 rounded-control text-text-primary hover:bg-surface-hover transition-colors focus:outline-none cursor-pointer"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownPoId === order.poId && dropdownPosition && createPortal(
                    <>
                      <div className="fixed inset-0 z-[199]" onClick={(e) => { e.stopPropagation(); setActiveDropdownPoId(null); }} />
                      <div style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }} className="absolute w-44 rounded-card border border-divider bg-surface shadow-modal z-[200] py-1.5 text-left">
                        {order.status === "Arrived" && (
                          <button type="button" onClick={() => { onQAInspection(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover transition-colors cursor-pointer">
                            <ClipboardCheck size={14} className="shrink-0" /> Quality Assurance Inspection
                          </button>
                        )}
                        {order.status === "Pending" && (
                          <>
                            <button type="button" onClick={() => { onEdit(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover transition-colors cursor-pointer">
                              <Pencil size={14} className="shrink-0" /> Edit Order
                            </button>
                            <button type="button" onClick={() => { onMarkArrived(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover transition-colors cursor-pointer">
                              <Truck size={14} className="shrink-0" /> Mark Arrived
                            </button>
                            <button type="button" onClick={() => { onCancel(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover transition-colors cursor-pointer">
                              <XCircle size={14} className="shrink-0" /> Cancel Order
                            </button>
                          </>
                        )}
                        {(order.status === "Completed" || order.status === "Cancelled" || order.status === "Rejected") && (
                          <button type="button" onClick={() => { onViewDetails(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover transition-colors cursor-pointer">
                            <Eye size={14} className="shrink-0" /> View Details
                          </button>
                        )}
                      </div>
                    </>,
                    document.body
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
