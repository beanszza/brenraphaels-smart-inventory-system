"use client";

import React, { useState } from "react";
import { MoreHorizontal, Truck, Check, XCircle } from "lucide-react";
import { TransferItem } from "./types";

interface StockTransferTableProps {
  transfers: TransferItem[];
  onDispatch: (item: TransferItem) => void;
  onReceive: (item: TransferItem) => void;
  onCancel: (item: TransferItem) => void;
}

import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function StockTransferTable({
  transfers,
  onDispatch,
  onReceive,
  onCancel,
}: StockTransferTableProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-panel border border-divider bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-divider bg-surface-hover">
            <th className="sticky left-0 z-20 min-w-[130px] w-36 px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap bg-surface-hover backdrop-blur-xs border-r border-divider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">TRANSFER ID</th>
            <th className="px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">PRODUCT</th>
            <th className="px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">SOURCE</th>
            <th className="px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">DESTINATION</th>
            <th className="px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">QTY</th>
            <th className="px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">DATE</th>
            <th className="px-3 py-3 text-left font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">STATUS</th>
            <th className="px-3 py-3 text-center font-semibold text-text-muted type-table-header tracking-wider whitespace-nowrap">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {transfers.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-10 text-center type-body font-semibold text-text-muted">
                No Results Found
              </td>
            </tr>
          ) : (
            transfers.map((item) => (
              <tr key={item.id} className="hover:bg-surface-hover/60 transition-colors group">
                <td className="sticky left-0 z-10 min-w-[130px] w-36 px-3 py-3 font-semibold font-mono text-text-primary type-table-cell whitespace-nowrap bg-surface group-hover:bg-surface-hover transition-colors border-r border-divider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">{item.id}</td>
                <td className="px-3 py-3 font-medium text-text-primary type-table-cell whitespace-nowrap">{item.product}</td>
                <td className="px-3 py-3 text-text-muted type-table-cell whitespace-nowrap">{item.from}</td>
                <td className="px-3 py-3 text-text-muted type-table-cell whitespace-nowrap">{item.to}</td>
                <td className="px-3 py-3 text-text-muted type-table-cell whitespace-nowrap">{item.quantity}</td>
                <td className="px-3 py-3 text-text-muted type-table-cell whitespace-nowrap">{item.date}</td>
                <td className="px-3 py-3"><StatusBadge status={item.status} /></td>
                <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-control border border-transparent text-text-primary hover:bg-surface-hover transition-all data-[state=open]:bg-surface-hover data-[state=open]:border-divider data-[state=open]:shadow-xs cursor-pointer"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 z-[100] bg-surface border-divider text-text-primary">
                      {["Pending", "Scheduled"].includes(item.status) && (
                        <>
                          <DropdownMenuItem onClick={() => onDispatch(item)} className="flex items-center gap-2 cursor-pointer type-caption hover:bg-surface-hover">
                            <Truck size={14} className="shrink-0" /> Dispatch
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCancel(item)} className="flex items-center gap-2 cursor-pointer type-caption text-destructive focus:text-destructive focus:bg-destructive/10">
                            <XCircle size={14} className="shrink-0" /> Cancel
                          </DropdownMenuItem>
                        </>
                      )}
                      {["In Transit", "Dispatched"].includes(item.status) && (
                        <DropdownMenuItem onClick={() => onReceive(item)} className="flex items-center gap-2 cursor-pointer type-caption hover:bg-surface-hover">
                          <Check size={14} className="shrink-0" /> Mark Received
                        </DropdownMenuItem>
                      )}
                      {["Completed", "Received"].includes(item.status) && (
                        <div className="px-3 py-2 type-caption text-text-muted">Transfer completed</div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
