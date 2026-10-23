"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";

import { useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Eye, Pencil, Truck, XCircle, CheckCircle } from "lucide-react";

type Transfer = {
  id: string;
  displayId?: string;
  productId?: number;
  product: string;
  from: string;
  destLocationId?: number;
  to: string;
  quantity: number;
  date: string;
  rawDate?: string;
  status: "Completed" | "In Transit" | "Pending" | "Cancelled";
};

interface StockTransferTableProps {
  transfers: Transfer[];
  onDispatchClick: (transfer: Transfer) => void;
  onCompleteClick: (id: string) => void;
  onCancelClick?: (transfer: Transfer) => void;
  onEditClick?: (transfer: Transfer) => void;
  onViewClick?: (transfer: Transfer) => void;
}

export default function StockTransferTable({ transfers, onDispatchClick, onCompleteClick, onCancelClick, onEditClick, onViewClick }: StockTransferTableProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["TRANSFER NO.", "PRODUCT", "FROM", "TO", "QUANTITY", "TRANSFER DATE", "STATUS", "ACTIONS"].map(h => (
                <th key={h} className={`px-4 py-3 ${h === "ACTIONS" ? "text-center" : "text-left"} font-bold text-muted-foreground tracking-wider whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm font-semibold text-muted-foreground">
                  No Results Found
                </td>
              </tr>
            ) : (
              transfers.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-bold text-foreground">{t.displayId || t.id}</td>
                <td className="px-4 py-3 text-foreground">{t.product}</td>
                <td className="px-4 py-3 text-foreground">{t.from}</td>
                <td className="px-4 py-3 text-foreground">{t.to}</td>
                <td className="px-4 py-3 text-foreground">{t.quantity}</td>
                <td className="px-4 py-3 text-foreground">{t.date}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-center relative">
                  <div className="relative inline-block text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeDropdownId === t.id) {
                          setActiveDropdownId(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const leftPos = rect.right - 176 + window.scrollX;
                          setDropdownPosition({
                            top: rect.bottom + window.scrollY,
                            left: Math.max(8, leftPos)
                          });
                          setActiveDropdownId(t.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                    >
                      <MoreHorizontal size={18} className="text-foreground" />
                    </button>

                    {activeDropdownId === t.id && dropdownPosition && createPortal(
                      <>
                        <div
                          className="fixed inset-0 z-[199] cursor-default"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(null);
                          }}
                        />
                        <div
                          style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}
                          className="absolute w-44 rounded-xl border border-border bg-card shadow-xl z-[200] py-1.5 focus:outline-none text-left"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onViewClick?.(t);
                              setActiveDropdownId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
                          >
                            <Eye size={14} className="text-foreground shrink-0" />
                            View
                          </button>
                          {t.status === "Pending" && (
                            <button
                              type="button"
                              onClick={() => {
                                onEditClick?.(t);
                                setActiveDropdownId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
                            >
                              <Pencil size={14} className="text-foreground shrink-0" />
                              Edit
                            </button>
                          )}
                          {t.status === "Pending" && (
                            <button
                              type="button"
                              onClick={() => {
                                onDispatchClick(t);
                                setActiveDropdownId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
                            >
                              <Truck size={14} className="text-foreground shrink-0" />
                              Dispatch
                            </button>
                          )}
                          {t.status === "In Transit" && (
                            <button
                              type="button"
                              onClick={() => {
                                onCompleteClick(t.id);
                                setActiveDropdownId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
                            >
                              <CheckCircle size={14} className="text-foreground shrink-0" />
                              Complete
                            </button>
                          )}
                          {t.status === "Pending" && (
                            <button
                              type="button"
                              onClick={() => {
                                onCancelClick?.(t);
                                setActiveDropdownId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors text-left"
                            >
                              <XCircle size={14} className="text-foreground shrink-0" />
                              Cancel
                            </button>
                          )}
                        </div>
                      </>,
                      document.body
                    )}
                  </div>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}