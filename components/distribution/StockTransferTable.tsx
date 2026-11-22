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
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse">
          <thead className="border-b border-divider">
            <tr>
              <th className="sticky left-0 z-20 bg-surface py-3 pr-4 text-left type-table-header text-ink-muted whitespace-nowrap">Transfer ID</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Product</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Source</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Destination</th>
              <th className="pl-4 pr-6 py-3 text-right type-table-header text-ink-muted whitespace-nowrap">Qty</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Status</th>
              <th className="pl-4 py-3 text-center type-table-header text-ink-muted whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center type-body text-ink-muted">
                  No Results Found
                </td>
              </tr>
            ) : (
              transfers.map((item) => (
                <tr key={item.id} className="group hover:bg-page transition-colors">
                  <td className="sticky left-0 z-10 bg-surface group-hover:bg-page transition-colors py-3 pr-4 type-body font-medium text-primary whitespace-nowrap">{item.id}</td>
                  <td className="px-4 py-3 type-body font-medium text-ink whitespace-nowrap">{item.product}</td>
                  <td className="px-4 py-3 type-body text-ink whitespace-nowrap">{item.from}</td>
                  <td className="px-4 py-3 type-body text-ink whitespace-nowrap">{item.to}</td>
                  <td className="pl-4 pr-6 py-3 text-right type-body font-medium tabular-nums text-ink whitespace-nowrap">{item.quantity}</td>
                  <td className="px-4 py-3 type-body text-ink-muted whitespace-nowrap">{item.date}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="pl-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 bg-surface border border-border text-ink">
                        {["Pending", "Scheduled"].includes(item.status) && (
                          <>
                            <DropdownMenuItem onClick={() => onDispatch(item)} className="flex items-center gap-2 cursor-pointer type-body hover:bg-subtle">
                              <Truck size={14} className="shrink-0" /> Dispatch
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onCancel(item)} className="flex items-center gap-2 cursor-pointer type-body text-destructive focus:text-destructive focus:bg-destructive/10">
                              <XCircle size={14} className="shrink-0" /> Cancel
                            </DropdownMenuItem>
                          </>
                        )}
                        {["In Transit", "Dispatched"].includes(item.status) && (
                          <DropdownMenuItem onClick={() => onReceive(item)} className="flex items-center gap-2 cursor-pointer type-body hover:bg-subtle">
                            <Check size={14} className="shrink-0" /> Mark Received
                          </DropdownMenuItem>
                        )}
                        {["Completed", "Received"].includes(item.status) && (
                          <div className="px-3 py-2 type-caption text-ink-muted">Transfer completed</div>
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
    </div>
  );
}
