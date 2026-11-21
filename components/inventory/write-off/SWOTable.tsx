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
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[160px]">
              Write-Off No.
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              Request Date
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              Requested By
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              Item
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              Batch / Lot
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              Reasons
            </th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">
              Status
            </th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {writeOffs.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="py-12 text-center type-body text-ink-muted"
              >
                No stock write-off records found.
              </td>
            </tr>
          ) : (
            writeOffs.map((swo) => {
              const isPending = swo.status === "Pending Approval";
              const isApproved = swo.status === "Approved";
              const isRemoved = swo.status === "Removed";
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
                    icon: <XCircle className="w-4 h-4 text-destructive" />,
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
                  icon: <Ban className="w-4 h-4 text-destructive" />,
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
                <tr key={swo.writeOffId} className="hover:bg-page transition-colors group">
                  {/* SWO Number */}
                  <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[160px]">
                    <button
                      type="button"
                      onClick={() => onView(swo)}
                      className="hover:underline text-left font-medium text-primary cursor-pointer"
                    >
                      {swo.swoNumber}
                    </button>
                  </td>

                  {/* Request Date */}
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {fmtDate(swo.requestedAt)}
                  </td>

                  {/* Requested By */}
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {swo.requestedByName || swo.requestedBy}
                  </td>

                  {/* Item */}
                  <td className="py-3 pr-4 type-body text-ink">
                    <div className="text-ink">
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
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {(() => {
                      const allLots = swo.items.flatMap((it) => it.lines.map((l) => l.lotCode));
                      return (
                        <>
                          <div className="text-ink tabular-nums">
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
                  <td className="py-3 pr-4 type-body text-ink-muted">
                    <span className="line-clamp-1">
                      {distinctReasons.join(", ") || "—"}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <SWOStatusBadge status={swo.status} />
                  </td>

                  {/* Actions */}
                  <td className="w-16 py-3 pl-4 text-center whitespace-nowrap">
                    {actions.length === 1 ? (
                      <button
                        type="button"
                        onClick={actions[0].onClick}
                        title="View Details"
                        className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
                      >
                        <Eye size={18} />
                      </button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${swo.swoNumber}`}
                            className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {actions.map((act, idx) => (
                            <DropdownMenuItem
                              key={idx}
                              onClick={act.onClick}
                              className={`cursor-pointer type-body-secondary ${
                                act.destructive
                                  ? "text-destructive focus:text-destructive"
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
