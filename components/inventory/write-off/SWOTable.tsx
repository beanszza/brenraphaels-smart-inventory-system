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
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">
              WRITE-OFF NUMBER
            </th>
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">
              REQUEST DATE
            </th>
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">
              REQUESTED BY
            </th>
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">
              ITEMS & LOTS
            </th>
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">
              REASONS
            </th>
            <th className="px-4 py-3 text-left font-bold text-muted-foreground tracking-wider whitespace-nowrap">
              STATUS
            </th>
            <th className="px-4 py-3 text-center font-bold text-muted-foreground tracking-wider whitespace-nowrap w-24">
              ACTIONS
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {writeOffs.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-5 py-8 text-center text-xs font-medium text-muted-foreground"
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
                  icon: <Eye className="w-4 h-4 text-foreground" />,
                  onClick: () => onView(swo),
                },
              ];

              // Admin can ONLY approve/reject in the Requests tab (viewing only on all other tabs)
              if (isAdmin && isRequestsTab && isPending) {
                if (onApprove) {
                  actions.push({
                    label: "Approve",
                    icon: <CheckCircle2 className="w-4 h-4 text-foreground" />,
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
                  icon: <PackageMinus className="w-4 h-4 text-foreground" />,
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
                  icon: <Download className="w-4 h-4 text-foreground" />,
                  onClick: () => {
                    downloadStockWriteOffPdf(swo);
                  },
                });
              }

              return (
                <tr key={swo.writeOffId} className="hover:bg-muted/20 transition-colors">
                  {/* SWO Number */}
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onView(swo)}
                      className="hover:underline text-left font-semibold text-foreground cursor-pointer"
                    >
                      {swo.swoNumber}
                    </button>
                  </td>

                  {/* Request Date */}
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {fmtDate(swo.requestedAt)}
                  </td>

                  {/* Requested By */}
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">
                    {swo.requestedByName || swo.requestedBy}
                  </td>

                  {/* Items & Lots Summary */}
                  <td className="px-4 py-3 text-foreground">
                    <div className="font-medium text-foreground">
                      {swo.items.map((it) => it.itemName).slice(0, 2).join(", ")}
                      {swo.items.length > 2 ? ` +${swo.items.length - 2} more` : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {swo.items.length} {swo.items.length === 1 ? "item" : "items"} ·{" "}
                      {totalLots} {totalLots === 1 ? "lot" : "lots"}
                    </div>
                  </td>

                  {/* Reasons */}
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="line-clamp-1">
                      {distinctReasons.join(", ") || "—"}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <SWOStatusBadge status={swo.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {actions.length === 1 ? (
                      <button
                        type="button"
                        onClick={actions[0].onClick}
                        title="View Details"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${swo.swoNumber}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                          {actions.map((act, idx) => (
                            <DropdownMenuItem
                              key={idx}
                              onClick={act.onClick}
                              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer ${
                                act.destructive
                                  ? "text-destructive focus:text-destructive"
                                  : "text-foreground"
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
