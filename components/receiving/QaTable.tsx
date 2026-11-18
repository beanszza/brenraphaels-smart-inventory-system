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
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead className="table-head-row border-b border-divider bg-surface-muted/30">
          <tr className="text-left table-th text-text-muted whitespace-nowrap">
            <th className="sticky left-0 z-20 bg-surface-muted px-4 py-4 min-w-[160px] w-48 whitespace-nowrap border-r border-divider shadow-sticky">{pendingView ? "Goods Receipt Note No." : "Inspection No."}</th>
            <th className="px-4 py-4 whitespace-nowrap">{pendingView ? "Supplier" : "Goods Receipt Note No."}</th>
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
        <tbody className="divide-y divide-divider">
          {inspections.length === 0 ? (
            <tr>
              <td colSpan={pendingView ? 5 : 8} className="px-4 py-12 text-center type-body font-normal text-text-muted">
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
                className="table-row group hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <td className="sticky left-0 z-10 bg-surface group-hover:bg-surface-hover px-4 py-4 table-td font-semibold text-text-primary whitespace-nowrap min-w-[160px] w-48 border-r border-divider shadow-sticky transition-colors">
                  {pendingView ? (qc.referenceNumber || qc.grnNumber) : qc.inspectionNumber}
                </td>
                <td className="px-4 py-4 table-td font-medium text-text-primary truncate" title={qc.supplierName}>
                  {pendingView ? (qc.supplierName || "—") : (qc.referenceNumber || qc.grnNumber)}
                </td>
                {!pendingView && <td className="px-4 py-4 table-td font-medium text-text-primary max-w-[180px] truncate" title={qc.supplierName}>{qc.supplierName || "—"}</td>}
                <td className="px-4 py-4 table-td text-text-muted whitespace-nowrap">
                  {new Date(qc.inspectionDate).toLocaleDateString()}
                </td>
                {!pendingView && <>
                  <td className="px-4 py-4 table-td text-right font-semibold text-text-primary whitespace-nowrap">{qc.totalReceivedQuantity.toLocaleString()}</td>
                  <td className="px-4 py-4 table-td text-right font-semibold text-text-primary whitespace-nowrap">{qc.totalAcceptedQuantity.toLocaleString()}</td>
                  <td className="px-4 py-4 table-td text-right font-semibold text-text-primary whitespace-nowrap">{qc.totalRejectedQuantity.toLocaleString()}</td>
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
                        className="p-1.5 rounded-control text-text-primary hover:bg-surface-hover transition-colors focus:outline-none cursor-pointer"
                        title="Actions"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                      className="w-36 rounded-control border border-divider bg-surface shadow-modal py-1.5 text-left"
                    >
                      <DropdownMenuItem
                        onSelect={() => onSelectInspection(qc)}
                        className="flex w-full items-center gap-2 px-3 py-2 type-caption font-medium text-text-primary hover:bg-surface-hover focus:bg-surface-hover cursor-pointer"
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
