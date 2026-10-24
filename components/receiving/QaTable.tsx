"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import React from "react";
import { ClipboardCheck, Eye, MoreHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { QAInspection } from "./types";
import { Button } from "@/components/ui/button";

interface QaTableProps {
  inspections: QAInspection[];
  loading: boolean;
  onSelectInspection: (inspection: QAInspection) => void;
  pendingView: boolean;
}

export default function QaTable({ inspections, loading, onSelectInspection, pendingView }: QaTableProps) {
  const [activeMenuId, setActiveMenuId] = React.useState<number | null>(null);

  if (loading) {
    return (
      <ReceivingSkeleton />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm min-h-[300px]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">{pendingView ? "GOODS RECEIPT NOTE NO." : "INSPECTION NO."}</th>
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">{pendingView ? "SUPPLIER" : "GOODS RECEIPT NOTE NO."}</th>
            {!pendingView && <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">SUPPLIER</th>}
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">DATE</th>
            {!pendingView && <>
              <th className="px-4 py-3 text-right font-bold text-muted-foreground tracking-wider whitespace-nowrap">RECEIVED</th>
              <th className="px-4 py-3 text-right font-bold text-muted-foreground tracking-wider whitespace-nowrap">PASSED</th>
              <th className="px-4 py-3 text-right font-bold text-muted-foreground tracking-wider whitespace-nowrap">REJECTED</th>
            </>}
            <th className="px-4 py-3 text-center font-bold text-muted-foreground tracking-wider whitespace-nowrap">STATUS</th>
            <th className="px-4 py-3 text-center font-bold text-muted-foreground tracking-wider whitespace-nowrap w-28">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {inspections.length === 0 ? (
            <tr>
              <td colSpan={pendingView ? 5 : 8} className="px-4 py-8 text-center text-xs text-muted-foreground">
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
                <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                  {pendingView ? (qc.referenceNumber || qc.grnNumber) : qc.inspectionNumber}
                </td>
                <td className="px-4 py-3 font-medium text-foreground max-w-[180px] truncate" title={qc.supplierName}>
                  {pendingView ? (qc.supplierName || "—") : (qc.referenceNumber || qc.grnNumber)}
                </td>
                {!pendingView && <td className="px-4 py-3 font-medium text-foreground max-w-[180px] truncate" title={qc.supplierName}>{qc.supplierName || "—"}</td>}
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(qc.inspectionDate).toLocaleDateString()}
                </td>
                {!pendingView && <>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground whitespace-nowrap">{qc.totalReceivedQuantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground whitespace-nowrap">{qc.totalAcceptedQuantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground whitespace-nowrap">{qc.totalRejectedQuantity.toLocaleString()}</td>
                </>}
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <StatusBadge status={qc.status} />
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap relative">
                  <button
                    type="button"
                    onClick={() => setActiveMenuId(activeMenuId === qc.inspectionId ? null : qc.inspectionId)}
                    className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none"
                    title="Actions"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {activeMenuId === qc.inspectionId && (
                    <div className="absolute right-6 top-2 z-[100] w-36 rounded-xl border border-border bg-card shadow-xl py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectInspection(qc);
                          setActiveMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Eye size={14} className="shrink-0" /> {isReady ? "Inspect" : "View Details"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}
