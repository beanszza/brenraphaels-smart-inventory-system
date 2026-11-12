"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React from "react";
import { Eye, MoreHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QAInspection } from "./types";

interface QaTableProps {
  inspections: QAInspection[];
  loading: boolean;
  onSelectInspection: (inspection: QAInspection) => void;
  pendingView: boolean;
}

export default function QaTable({ inspections, loading, onSelectInspection, pendingView }: QaTableProps) {
  if (loading) {
    return <ReceivingSkeleton />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
            <th className="px-4 py-4">{pendingView ? "Goods Receipt Note No." : "Inspection No."}</th>
            <th className="px-4 py-4">{pendingView ? "Supplier" : "Goods Receipt Note No."}</th>
            {!pendingView && <th className="px-4 py-4">Supplier</th>}
            <th className="px-4 py-4">Date</th>
            {!pendingView && <>
              <th className="px-4 py-4 text-right">Received</th>
              <th className="px-4 py-4 text-right">Passed</th>
              <th className="px-4 py-4 text-right">Rejected</th>
            </>}
            <th className="px-4 py-4 text-center">Status</th>
            <th className="w-16 px-4 py-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {inspections.length === 0 ? (
            <tr>
              <td colSpan={pendingView ? 5 : 8} className="px-4 py-12 text-center text-sm font-normal text-muted-foreground">
                No quality inspections found
              </td>
            </tr>
          ) : (
            inspections.map((qc) => {
            const isReady =
              qc.status === "Pending" ||
              qc.status === "InInspection" ||
              qc.status === "InProgress" ||
              qc.status === "In Inspection";

            return (
              <tr
                key={qc.inspectionId}
                onClick={() => onSelectInspection(qc)}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <td className="px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                  {pendingView ? (qc.referenceNumber || qc.grnNumber) : qc.inspectionNumber}
                </td>
                <td className="px-4 py-4 text-sm font-medium text-foreground max-w-[180px] truncate" title={qc.supplierName}>
                  {pendingView ? (qc.supplierName || "—") : (qc.referenceNumber || qc.grnNumber)}
                </td>
                {!pendingView && <td className="px-4 py-4 text-sm font-medium text-foreground max-w-[180px] truncate" title={qc.supplierName}>{qc.supplierName || "—"}</td>}
                <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(qc.inspectionDate).toLocaleDateString()}
                </td>
                {!pendingView && <>
                  <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">{qc.totalReceivedQuantity.toLocaleString()}</td>
                  <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">{qc.totalAcceptedQuantity.toLocaleString()}</td>
                  <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">{qc.totalRejectedQuantity.toLocaleString()}</td>
                </>}
                <td className="px-4 py-4 text-center whitespace-nowrap">
                  <StatusBadge status={qc.status} />
                </td>
                <td
                  className="w-16 px-4 py-4 text-center whitespace-nowrap relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Record actions"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none cursor-pointer"
                        title="Actions"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                      className="w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left"
                    >
                      <DropdownMenuItem
                        onSelect={() => onSelectInspection(qc)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted cursor-pointer"
                      >
                        <Eye size={14} className="shrink-0" /> {isReady ? "Inspect" : "View Details"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}
