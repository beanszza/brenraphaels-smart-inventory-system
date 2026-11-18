"use client";

import React, { useState } from "react";
import { Clock, User, ExternalLink } from "lucide-react";
import PaginationFooter from "@/components/pages/PaginationFooter";
import AuditLogDetailsModal, { getActivityIcon } from "@/components/pages/AuditLogDetailsModal";

export type LogEntry = {
  id: string;
  activity: string;
  entityName: string;
  timestamp: string;
  user: string;
};

interface AuditLogsTableProps {
  logs: LogEntry[];
  currentPage: number;
  setCurrentPage: (p: number) => void;
  itemsPerPage?: number;
  emptyMessage?: string;
}

export function summarizeActivity(activity: string): { label: string; full: string } {
  const lower = activity.toLowerCase();
  if (lower.includes("registered") && lower.includes("active")) {
    return { label: "Item Registered", full: activity };
  }
  if (lower.includes("status changed to inactive") || lower.includes("status updated to inactive")) {
    return { label: lower.includes("supplier") ? "Supplier Inactive" : "Item Inactive", full: activity };
  }
  if (lower.includes("restock purchase received") || lower.includes("received & verified")) {
    return { label: "Restock Received", full: activity };
  }
  if (lower.includes("stock onboarded") || lower.includes("initial raw material")) {
    return { label: "Stock Onboarded", full: activity };
  }
  if (lower.includes("supplier onboarded")) {
    return { label: "Supplier Onboarded", full: activity };
  }
  if (lower.includes("recipe/bom approved") || lower.includes("recipe approved")) {
    return { label: "Recipe Approved", full: activity };
  }
  if (lower.includes("recipe draft")) {
    return { label: "Recipe Draft", full: activity };
  }
  if (lower.includes("stock added")) {
    return { label: "Stock Added (+)", full: activity };
  }
  if (lower.includes("stock deducted")) {
    return { label: "Stock Deducted (-)", full: activity };
  }
  if (activity.includes(" / ")) {
    return { label: activity.split(" / ")[0].trim(), full: activity };
  }
  if (activity.length > 26) {
    return { label: activity.slice(0, 24) + "...", full: activity };
  }
  return { label: activity, full: activity };
}

export function parseEntitySummary(raw: string): { primary: string; secondary: string } {
  if (!raw) return { primary: "—", secondary: "" };

  if (raw.includes(" | ")) {
    const parts = raw.split(" | ").map((p) => p.trim());
    const primary = parts[0];
    // Pick the most informative secondary attribute (e.g. Category or Contact)
    const categoryPart = parts.find((p) => p.toLowerCase().startsWith("category:"));
    const contactPart = parts.find((p) => p.toLowerCase().startsWith("contact:") || p.toLowerCase().startsWith("vendor:"));
    const secondary = categoryPart || contactPart || parts[1] || "";
    return { primary, secondary };
  }

  return { primary: raw, secondary: "" };
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export default function AuditLogsTable({
  logs,
  currentPage,
  setCurrentPage,
  itemsPerPage = 10,
  emptyMessage = "No transaction log records match the selected filters.",
}: AuditLogsTableProps) {
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = logs.slice(startIdx, startIdx + itemsPerPage);

  return (
    <>
      <div className="rounded-panel border border-divider bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left type-table-cell border-collapse">
            <thead className="bg-surface-hover type-table-header uppercase tracking-wider text-text-muted border-b border-divider">
              <tr>
                <th className="sticky left-0 z-20 w-16 whitespace-nowrap px-4 py-3.5 text-center bg-surface-hover/95 backdrop-blur-xs border-r border-divider shadow-xs">#</th>
                <th className="whitespace-nowrap px-4 py-3.5 min-w-[200px]">Action &amp; Event Activity</th>
                <th className="whitespace-nowrap px-4 py-3.5">Target Entity &amp; Details</th>
                <th className="whitespace-nowrap px-4 py-3.5">Date &amp; Exact Time</th>
                <th className="whitespace-nowrap px-4 py-3.5">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, index) => {
                  const activitySummary = summarizeActivity(log.activity);
                  const entitySummary = parseEntitySummary(log.entityName);

                  return (
                    <tr
                      key={log.id || index}
                      className="hover:bg-surface-hover/50 transition-colors group"
                    >
                      {/* Row Number (#) */}
                      <td className="sticky left-0 z-10 w-16 whitespace-nowrap px-4 py-3.5 text-center font-mono type-caption font-semibold text-text-muted bg-surface group-hover:bg-surface-hover/50 transition-colors border-r border-divider shadow-xs">
                        {startIdx + index + 1}
                      </td>

                      {/* Action & Event Activity - Clickable Summarized Monochromatic Pill */}
                      <td className="whitespace-nowrap px-4 py-3.5 min-w-[200px]">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          title="Click to view full event details"
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-control type-caption font-semibold bg-surface-hover text-text-primary border border-divider hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer shadow-xs group/btn"
                        >
                          {getActivityIcon(log.activity)}
                          <span>{activitySummary.label}</span>
                          <ExternalLink
                            size={11}
                            className="opacity-40 group-hover/btn:opacity-100 transition-opacity ml-0.5"
                          />
                        </button>
                      </td>

                      {/* Summarized Target Entity & Details */}
                      <td className="px-4 py-3.5 max-w-md">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-text-primary type-body truncate">
                            {entitySummary.primary}
                          </span>
                          {entitySummary.secondary && (
                            <span className="type-caption text-text-muted truncate">
                              {entitySummary.secondary}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Timestamp (MM/DD/YYYY HH:MM:SS) */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-text-muted type-caption font-mono">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-text-muted" />
                          <span>{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* Performed By User */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-text-muted">
                        <div className="flex items-center gap-1.5 font-medium type-caption">
                          <User size={13} className="text-text-primary" />
                          <span className="text-text-primary font-medium">{log.user}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          totalItems={logs.length}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Full Audit Log Details Modal */}
      <AuditLogDetailsModal
        log={selectedLog}
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </>
  );
}
