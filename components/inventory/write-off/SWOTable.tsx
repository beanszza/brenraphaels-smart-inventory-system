"use client";

import React from "react";
import {
  Eye,
  MoreHorizontal,
  Ban,
  CheckCircle2,
  XCircle,
  PackageMinus,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SWOStatusBadge } from "./SWOStatusBadge";
import { downloadStockWriteOffPdf } from "./downloadStockWriteOffPdf";
import type { StockWriteOffDto } from "./types";

interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface SWOTableProps {
  writeOffs: StockWriteOffDto[];
  isAdmin: boolean;
  isImsManager: boolean;
  isRequestsTab?: boolean;
  onView: (swo: StockWriteOffDto) => void;
  onApprove?: (swo: StockWriteOffDto) => void;
  onReject?: (swo: StockWriteOffDto) => void;
  onCancel?: (swo: StockWriteOffDto) => void;
  onRemoveFromInventory?: (swo: StockWriteOffDto) => void;
}

export function SWOTable({
  writeOffs,
  isAdmin,
  isImsManager,
  isRequestsTab = false,
  onView,
  onApprove,
  onReject,
  onCancel,
  onRemoveFromInventory,
}: SWOTableProps) {
  const fmtDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const fmtMoney = (n: number) =>
    `₱${Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-border bg-surface">
      <table className="w-full">
        <thead>
          <tr className="table-head-row">
            <th className="sticky left-0 z-20 min-w-[160px] w-44 px-4 py-2.5 text-left table-th whitespace-nowrap bg-subtle border-r border-border shadow-sticky-col">
              WRITE-OFF NUMBER
            </th>
            <th className="px-4 py-2.5 text-left table-th whitespace-nowrap">
              REQUEST DATE
            </th>
            <th className="px-4 py-2.5 text-left table-th whitespace-nowrap">
              REQUESTED BY
            </th>
            <th className="px-4 py-2.5 text-left table-th whitespace-nowrap">
              ITEM
            </th>
            <th className="px-4 py-2.5 text-left table-th whitespace-nowrap">
              BATCH / LOT
            </th>
            <th className="px-4 py-2.5 text-left table-th whitespace-nowrap">
              REASONS
            </th>
            <th className="px-4 py-2.5 text-left table-th whitespace-nowrap">
              STATUS
            </th>
            <th className="px-4 py-2.5 text-center table-th whitespace-nowrap w-24">
              ACTIONS
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {writeOffs.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-5 py-8 text-center type-body text-ink-muted"
              >
                No stock write-off records found.
              </td>
            </tr>
          ) : (
            writeOffs.map((swo) => {
              const isPending = swo.status === "Pending Approval";
              const isApproved = swo.status === "Approved";
              const isRemoved = swo.status === "Removed";
              const totalLots = swo.items.reduce((acc, it) => acc + it.lines.length, 0);
              const distinctReasons = Array.from(
                new Set(
                  swo.items.flatMap((it) =>
                    it.lines.map((l) =>
                      l.reason === "Other" && l.reasonOther ? `Other (${l.reasonOther})` : l.reason
                    )
                  )
                )
              );

              const actions: ActionItem[] = [
                {
                  label: "View Details",
                  icon: <Eye className="w-4 h-4 text-ink" />,
                  onClick: () => onView(swo),
                },
              ];

              // Admin can ONLY approve/reject in the Requests tab (viewing only on all other tabs)
              if (isAdmin && isRequestsTab && isPending) {
                if (onApprove) {
                  actions.push({
                    label: "Approve",
                    icon: <CheckCircle2 className="w-4 h-4 text-ink" />,
                    onClick: () => onApprove(swo),
                  });
                }
                if (onReject) {
                  actions.push({
                    label: "Reject",
                    icon: <XCircle className="w-4 h-4 text-status-red" />,
                    onClick: () => onReject(swo),
                    destructive: true,
                  });
                }
              }

              // IMS Manager: Remove Items in Inventory on Approved SWO
              if (isImsManager && isApproved && onRemoveFromInventory) {
                actions.push({
                  label: "Remove Items in Inventory",
                  icon: <PackageMinus className="w-4 h-4 text-ink" />,
                  onClick: () => onRemoveFromInventory(swo),
                });
              }

              // IMS Manager: Cancel only while Pending Approval
              if (isImsManager && isPending && onCancel) {
                actions.push({
                  label: "Cancel Request",
                  icon: <Ban className="w-4 h-4 text-status-red" />,
                  onClick: () => onCancel(swo),
                  destructive: true,
                });
              }

              // Download PDF report strictly when completely removed in the Removed tab
              if (isRemoved) {
                actions.push({
                  label: "Download SWO Report (PDF)",
                  icon: <Download className="w-4 h-4 text-ink" />,
                  onClick: () => {
                    downloadStockWriteOffPdf(swo);
                  },
                });
              }

              return (
                <tr key={swo.writeOffId} className="table-row group">
                  {/* SWO Number */}
                  <td className="sticky left-0 z-10 min-w-[160px] w-44 px-4 py-3 table-td font-semibold text-ink whitespace-nowrap bg-surface group-hover:bg-subtle transition-colors border-r border-border shadow-sticky-col">
                    <button
                      type="button"
                      onClick={() => onView(swo)}
                      className="hover:underline text-left font-semibold text-ink cursor-pointer"
                    >
                      {swo.swoNumber}
                    </button>
                  </td>

                  {/* Request Date */}
                  <td className="table-td text-ink-muted whitespace-nowrap">
                    {fmtDate(swo.requestedAt)}
                  </td>

                  {/* Requested By */}
                  <td className="table-td text-ink whitespace-nowrap">
                    {swo.requestedByName || swo.requestedBy}
                  </td>

                  {/* Item */}
                  <td className="table-td text-ink">
                    <div className="font-medium text-ink">
                      {swo.items.map((it) => it.itemName).slice(0, 2).join(", ")}
                      {swo.items.length > 2 ? ` +${swo.items.length - 2} more` : ""}
                    </div>
                    {swo.items.length > 1 && (
                      <div className="type-caption text-ink-muted">
                        {swo.items.length} items
                      </div>
                    )}
                  </td>

                  {/* Batch / Lot */}
                  <td className="table-td text-ink whitespace-nowrap">
                    {(() => {
                      const allLots = swo.items.flatMap((it) => it.lines.map((l) => l.lotCode));
                      return (
                        <>
                          <div className="font-medium text-ink">
                            {allLots.slice(0, 2).join(", ") || "—"}
                            {allLots.length > 2 ? ` +${allLots.length - 2} more` : ""}
                          </div>
                          {allLots.length > 1 && (
                            <div className="type-caption text-ink-muted">
                              {allLots.length} lots
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>

                  {/* Reasons */}
                  <td className="table-td text-ink-muted">
                    <span className="line-clamp-1">
                      {distinctReasons.join(", ") || "—"}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="table-td whitespace-nowrap">
                    <SWOStatusBadge status={swo.status} />
                  </td>

                  {/* Actions */}
                  <td className="table-td text-center whitespace-nowrap">
                    {actions.length === 1 ? (
                      <button
                        type="button"
                        onClick={actions[0].onClick}
                        title="View Details"
                        className="inline-flex size-8 items-center justify-center rounded-control border border-border bg-surface text-ink hover:bg-subtle transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${swo.swoNumber}`}
                            className="inline-flex size-8 items-center justify-center rounded-control border border-border bg-surface text-ink hover:bg-subtle transition-colors cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-inner p-1.5 shadow-modal">
                          {actions.map((act, idx) => (
                            <DropdownMenuItem
                              key={idx}
                              onClick={act.onClick}
                              className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 type-body cursor-pointer ${
                                act.destructive
                                  ? "text-status-red focus:text-status-red"
                                  : "text-ink"
                              }`}
                            >
                              {act.icon}
                              <span>{act.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
