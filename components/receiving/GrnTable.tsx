"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React, { useState } from "react";
import { Eye, MoreHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GRN } from "./types";

interface GrnTableProps {
  grns: GRN[];
  loading: boolean;
  onSelectGrn: (grn: GRN) => void;
}

export default function GrnTable({ grns, loading, onSelectGrn }: GrnTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  if (loading) {
    return (
      <ReceivingSkeleton />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm overflow-visible">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
            <th className="px-5 py-4">Goods Receipt Note No.</th>
            <th className="px-5 py-4">Delivery #</th>
            <th className="px-5 py-4">Supplier</th>
            <th className="px-5 py-4">Received Date</th>
            <th className="px-5 py-4">Status</th>
            <th className="px-5 py-4 text-center w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {grns.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-xs text-muted-foreground">
                No goods receipt notes found
              </td>
            </tr>
          ) : (
            grns.map((grn) => (
              <tr
                key={grn.grnId}
                onClick={() => onSelectGrn(grn)}
                className="hover:bg-muted/20 transition-colors cursor-pointer"
              >
                <td className="px-5 py-4 font-mono font-semibold text-foreground whitespace-nowrap">
                  {grn.grnNumber}
                </td>
                <td className="px-5 py-4 font-mono text-muted-foreground whitespace-nowrap">
                  {grn.deliveryNumber || "—"}
                </td>
                <td className="px-5 py-4 font-medium text-foreground max-w-[180px] truncate" title={grn.supplierName}>
                  {grn.supplierName}
                </td>
                <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                  {new Date(grn.receivedDate).toLocaleDateString()}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <StatusBadge status={grn.status} />
                </td>
                <td className="px-5 py-4 text-center relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenuId(activeMenuId === grn.grnId ? null : grn.grnId)}
                    className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeMenuId === grn.grnId && (
                    <div className="absolute right-6 top-2 z-[100] w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectGrn(grn);
                          setActiveMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Eye size={14} className="shrink-0" /> View Details
                      </button>
                    </div>
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
