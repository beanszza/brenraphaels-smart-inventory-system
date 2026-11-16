"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, ClipboardCheck, Pencil, Truck, XCircle, Eye } from "lucide-react";
import { Order, OrderStatus } from "./types";

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
    <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-border bg-card">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="sticky left-0 z-20 min-w-[140px] w-36 px-3 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap bg-muted/95 backdrop-blur-xs">ORDER NO.</th>
            <th className="sticky left-[140px] z-20 min-w-[180px] w-48 px-3 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] bg-muted/95 backdrop-blur-xs">ITEM</th>
            <th className="px-3 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">SUPPLIER</th>
            <th className="px-3 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">QUANTITY</th>
            <th className="px-3 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">ORDER DATE</th>
            <th className="px-3 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">ETA</th>
            <th className="px-3 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">STATUS</th>
            <th className="px-3 py-3 text-center font-bold text-muted-foreground tracking-wider whitespace-nowrap">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-10 text-center text-sm font-semibold text-muted-foreground">
                No Results Found
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                <td className="sticky left-0 z-10 min-w-[140px] w-36 px-3 py-3 font-bold text-foreground whitespace-nowrap bg-card group-hover:bg-muted/40 transition-colors">{order.id}</td>
                <td className="sticky left-[140px] z-10 min-w-[180px] w-48 px-3 py-3 font-medium text-foreground whitespace-nowrap border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] bg-card group-hover:bg-muted/40 transition-colors">{order.item}</td>
                <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{order.supplier}</td>
                <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{order.quantity}</td>
                <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{order.orderDate}</td>
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{order.eta}</td>
                <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-3 py-3 text-center relative">
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
                    className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeDropdownPoId === order.poId && dropdownPosition && createPortal(
                    <>
                      <div className="fixed inset-0 z-[199]" onClick={(e) => { e.stopPropagation(); setActiveDropdownPoId(null); }} />
                      <div style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }} className="absolute w-44 rounded-xl border border-border bg-card shadow-xl z-[200] py-1.5 text-left">
                        {order.status === "Arrived" && (
                          <button type="button" onClick={() => { onQAInspection(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                            <ClipboardCheck size={14} className="shrink-0" /> Quality Assurance Inspection
                          </button>
                        )}
                        {order.status === "Pending" && (
                          <>
                            <button type="button" onClick={() => { onEdit(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                              <Pencil size={14} className="shrink-0" /> Edit Order
                            </button>
                            <button type="button" onClick={() => { onMarkArrived(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                              <Truck size={14} className="shrink-0" /> Mark Arrived
                            </button>
                            <button type="button" onClick={() => { onCancel(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                              <XCircle size={14} className="shrink-0" /> Cancel Order
                            </button>
                          </>
                        )}
                        {(order.status === "Completed" || order.status === "Cancelled" || order.status === "Rejected") && (
                          <button type="button" onClick={() => { onViewDetails(order); setActiveDropdownPoId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
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
