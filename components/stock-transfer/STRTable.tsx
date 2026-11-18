"use client";

import React from "react";
import { TransferSkeleton } from "./TransferSkeleton";
import { Eye, MoreHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransferRequest } from "./types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface STRTableProps {
  requests: StockTransferRequest[];
  loading: boolean;
  isAdmin?: boolean;
  activeStatusTab?: string;
  onView: (req: StockTransferRequest) => void;
  onApprove?: (req: StockTransferRequest) => void;
  onReject?: (req: StockTransferRequest) => void;
  onSchedule?: (req: StockTransferRequest) => void;
  onDispatch?: (req: StockTransferRequest) => void;
  onCancel?: (req: StockTransferRequest) => void;
}

const SHOW_COURIER_TABS = new Set(["Scheduled", "Dispatched"]);

export function STRTable({
  requests,
  loading,
  activeStatusTab = "All",
  onView,
}: STRTableProps) {
  const showCourier = SHOW_COURIER_TABS.has(activeStatusTab);

  if (loading) return <TransferSkeleton />;

  if (requests.length === 0) {
    return (
      <div className="rounded-panel border border-divider bg-surface p-12 text-center type-body text-text-muted">
        No stock transfers found matching your filter criteria.
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-divider bg-surface overflow-hidden shadow-xs">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse text-left">
          <thead className="bg-surface-hover text-text-muted type-table-header border-b border-divider">
            <tr>
              <th className="sticky left-0 z-20 min-w-[150px] w-44 px-5 py-3.5 whitespace-nowrap bg-surface-hover backdrop-blur-xs border-r border-divider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">REQUEST NO.</th>
              <th className="px-5 py-3.5 whitespace-nowrap">DESTINATION</th>
              <th className="px-5 py-3.5 whitespace-nowrap">PRODUCT</th>
              <th className="px-5 py-3.5 whitespace-nowrap">VARIANT</th>
              <th className="px-5 py-3.5 text-right whitespace-nowrap">QTY</th>
              {showCourier && (
                <th className="px-5 py-3.5 whitespace-nowrap">COURIER / DRIVER</th>
              )}
              <th className="px-5 py-3.5 whitespace-nowrap">STATUS</th>
              <th className="px-5 py-3.5 text-center whitespace-nowrap w-16">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {requests.map((req) => {
              const hasScheduledTransfer = req.transfers?.some((t) => t.status === "Scheduled") ?? false;

              const transferRef = req.transfers && req.transfers.length > 0 ? req.transfers[0] : null;

              const totalQty = req.items?.reduce((sum, i) => sum + i.requestedQuantity, 0) || 0;
              const firstItem = req.items?.[0];

              const courierDriver = transferRef?.courierName
                ? transferRef.courierName
                : transferRef?.driverName
                ? transferRef.driverName
                : "—";

              return (
                <tr
                  key={req.requestId}
                  className="hover:bg-surface-hover/60 transition-colors cursor-pointer group"
                  onClick={() => onView(req)}
                >
                  {/* Request No */}
                  <td className="sticky left-0 z-10 min-w-[150px] w-44 px-5 py-4 font-mono font-semibold type-table-cell text-text-primary whitespace-nowrap bg-surface group-hover:bg-surface-hover transition-colors border-r border-divider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                    <span className="hover:underline">{req.requestNumber}</span>
                  </td>

                  {/* Destination */}
                  <td className="px-5 py-4 font-semibold type-table-cell text-text-primary whitespace-nowrap">
                    {req.toLocationName}
                  </td>

                  {/* Product */}
                  <td className="px-5 py-4 font-semibold type-table-cell text-text-primary whitespace-nowrap">
                    {firstItem ? (
                      <div>
                        <span>{firstItem.productName}</span>
                        {req.items && req.items.length > 1 && (
                          <span className="ml-1 type-caption text-text-muted font-normal">
                            (+{req.items.length - 1} more)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-muted font-mono">—</span>
                    )}
                  </td>

                  {/* Variant */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {firstItem?.variant ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-control type-caption font-semibold bg-surface-hover border border-divider text-text-primary">
                        {firstItem.variant}
                      </span>
                    ) : (
                      <span className="text-text-muted font-mono">—</span>
                    )}
                  </td>

                  {/* Qty */}
                  <td className="px-5 py-4 text-right font-semibold text-text-primary type-table-cell whitespace-nowrap">
                    {totalQty}
                  </td>

                  {/* Courier / Driver */}
                  {showCourier && (
                    <td className="px-5 py-4 text-text-muted type-table-cell whitespace-nowrap">
                      <div>{courierDriver}</div>
                      {transferRef?.vehiclePlate && (
                        <span className="type-caption font-mono text-text-muted">
                          [{transferRef.vehiclePlate}]
                        </span>
                      )}
                    </td>
                  )}

                  {/* Status */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <StatusBadge status={hasScheduledTransfer ? "Scheduled" : req.status} />
                  </td>

                  {/* Actions (Three dots Menu - View Details only) */}
                  <td
                    className="px-5 py-4 text-center whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-control border border-transparent text-text-primary hover:bg-surface-hover transition-all cursor-pointer"
                          aria-label="Actions menu"
                        >
                          <MoreHorizontal className="w-4 h-4 text-text-primary" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 z-[200] bg-surface border-divider text-text-primary">
                        <DropdownMenuItem
                          onClick={() => onView(req)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer type-caption font-medium hover:bg-surface-hover"
                        >
                          <Eye className="w-4 h-4 text-text-muted" />
                          <span>View Details</span>
                        </DropdownMenuItem>
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
