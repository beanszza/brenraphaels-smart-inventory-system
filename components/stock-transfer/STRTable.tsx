"use client";

import React from "react";
import { Eye, Check, X, Truck, MoreHorizontal, Ban, Send, Package } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransferRequest, StockTransfer } from "./types";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface STRTableProps {
  requests: StockTransferRequest[];
  loading: boolean;
  onView: (req: StockTransferRequest) => void;
  onApprove?: (req: StockTransferRequest) => void;
  onReject?: (req: StockTransferRequest) => void;
  onSchedule?: (req: StockTransferRequest) => void;
  onDispatch?: (req: StockTransferRequest) => void;
  onCancel?: (req: StockTransferRequest) => void;
}

export function STRTable({
  requests,
  loading,
  onView,
  onApprove,
  onReject,
  onSchedule,
  onDispatch,
  onCancel,
}: STRTableProps) {
  const { isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground animate-pulse">
        Loading stock transfers...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
        No stock transfers found matching your filter criteria.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
            <tr>
              <th className="px-5 py-3.5 whitespace-nowrap">REQUEST NO.</th>
              <th className="px-5 py-3.5 whitespace-nowrap">TRANSFER NO.</th>
              <th className="px-5 py-3.5 whitespace-nowrap">DESTINATION</th>
              <th className="px-5 py-3.5 whitespace-nowrap">PRODUCTS & VARIANT</th>
              <th className="px-5 py-3.5 text-right whitespace-nowrap">QTY</th>
              <th className="px-5 py-3.5 whitespace-nowrap">TARGET DATE</th>
              <th className="px-5 py-3.5 whitespace-nowrap">COURIER / DRIVER</th>
              <th className="px-5 py-3.5 whitespace-nowrap">STATUS</th>
              <th className="px-5 py-3.5 text-center whitespace-nowrap w-16">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requests.map((req) => {
              const isPending = req.status === "Pending Approval";
              const isApproved = req.status === "Approved";
              const isScheduled = req.status === "Scheduled";
              const isDispatched = req.status === "Dispatched" || req.status === "Completed";
              const isCancelled = req.status === "Cancelled" || req.status === "Rejected";

              const transferRef = req.transfers && req.transfers.length > 0 ? req.transfers[0] : null;
              const transferNo = transferRef?.transferNumber || null;

              const totalQty = req.items?.reduce((sum, i) => sum + i.requestedQuantity, 0) || 0;
              const firstItem = req.items?.[0];

              const targetDate = transferRef?.scheduledDate
                ? new Date(transferRef.scheduledDate).toLocaleDateString()
                : req.requiredDate
                ? new Date(req.requiredDate).toLocaleDateString()
                : "—";

              const courierDriver = transferRef?.courierName
                ? transferRef.courierName
                : transferRef?.driverName
                ? transferRef.driverName
                : "—";

              return (
                <tr
                  key={req.requestId}
                  className="hover:bg-muted/20 transition-colors cursor-pointer group"
                  onClick={() => onView(req)}
                >
                  {/* Request No */}
                  <td className="px-5 py-4 font-mono font-bold text-foreground whitespace-nowrap">
                    <span className="hover:underline">{req.requestNumber}</span>
                  </td>

                  {/* Transfer No */}
                  <td className="px-5 py-4 font-mono text-foreground font-semibold whitespace-nowrap">
                    {transferNo ? (
                      <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border">
                        {transferNo}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Destination */}
                  <td className="px-5 py-4 font-semibold text-foreground whitespace-nowrap">
                    {req.toLocationName}
                  </td>

                  {/* Products & Variant */}
                  <td className="px-5 py-4 max-w-[220px]">
                    {firstItem ? (
                      <div>
                        <div className="font-semibold text-foreground truncate">
                          {firstItem.productName}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-normal truncate">
                          {firstItem.variant || "Standard"}
                          {req.items.length > 1 && ` (+${req.items.length - 1} more)`}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Qty */}
                  <td className="px-5 py-4 text-right font-extrabold text-foreground text-sm whitespace-nowrap">
                    {totalQty}
                  </td>

                  {/* Target Date */}
                  <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                    {targetDate}
                  </td>

                  {/* Courier / Driver */}
                  <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                    <div>{courierDriver}</div>
                    {transferRef?.vehiclePlate && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        [{transferRef.vehiclePlate}]
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <StatusBadge status={req.status} />
                  </td>

                  {/* Actions (Three dots Menu) */}
                  <td
                    className="px-5 py-4 text-center whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg border border-transparent text-foreground hover:bg-muted transition-all cursor-pointer"
                          aria-label="Actions menu"
                        >
                          <MoreHorizontal className="w-4 h-4 text-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 z-[200]">
                        {/* View Details */}
                        <DropdownMenuItem
                          onClick={() => onView(req)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-medium"
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                          <span>View Details</span>
                        </DropdownMenuItem>

                        {/* Admin-only Approve / Reject */}
                        {isAdmin && isPending && (
                          <>
                            {onApprove && (
                              <DropdownMenuItem
                                onClick={() => onApprove(req)}
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-semibold text-foreground"
                              >
                                <Check className="w-4 h-4 text-foreground" />
                                <span>Approve Request</span>
                              </DropdownMenuItem>
                            )}
                            {onReject && (
                              <DropdownMenuItem
                                onClick={() => onReject(req)}
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-semibold text-destructive"
                              >
                                <X className="w-4 h-4 text-destructive" />
                                <span>Reject Request</span>
                              </DropdownMenuItem>
                            )}
                          </>
                        )}

                        {/* Inventory Manager: Schedule Transfer */}
                        {!isAdmin && isApproved && onSchedule && (
                          <DropdownMenuItem
                            onClick={() => onSchedule(req)}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-semibold text-foreground"
                          >
                            <Truck className="w-4 h-4 text-foreground" />
                            <span>Schedule Transfer</span>
                          </DropdownMenuItem>
                        )}

                        {/* Inventory Manager: Dispatch Transfer */}
                        {!isAdmin && isScheduled && onDispatch && (
                          <DropdownMenuItem
                            onClick={() => onDispatch(req)}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-semibold text-foreground"
                          >
                            <Send className="w-4 h-4 text-foreground" />
                            <span>Dispatch Transfer</span>
                          </DropdownMenuItem>
                        )}

                        {/* Cancel (only if not dispatched / not cancelled) */}
                        {!isAdmin && !isDispatched && !isCancelled && onCancel && (
                          <DropdownMenuItem
                            onClick={() => onCancel(req)}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer text-xs font-medium text-muted-foreground hover:text-destructive"
                          >
                            <Ban className="w-4 h-4" />
                            <span>Cancel Request</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
