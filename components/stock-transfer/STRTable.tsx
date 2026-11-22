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
  footer?: React.ReactNode;
}

const SHOW_COURIER_TABS = new Set(["Scheduled", "Dispatched"]);

export function STRTable({
  requests,
  loading,
  activeStatusTab = "All",
  onView,
  footer,
}: STRTableProps) {
  const showCourier = SHOW_COURIER_TABS.has(activeStatusTab);

  if (loading) return <TransferSkeleton />;

  if (requests.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-12 text-center type-body text-ink-muted">
        No stock transfers found matching your filter criteria.
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-divider">
            <tr>
              <th className="sticky left-0 z-20 bg-surface py-3 pr-4 text-left type-table-header text-ink-muted whitespace-nowrap">Request No.</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Destination</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Product</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Variant</th>
              <th className="pl-4 pr-6 py-3 text-right type-table-header text-ink-muted whitespace-nowrap">Qty</th>
              {showCourier && (
                <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Courier / Driver</th>
              )}
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Status</th>
              <th className="pl-4 py-3 text-center type-table-header text-ink-muted whitespace-nowrap w-16">Actions</th>
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
                  className="group hover:bg-page transition-colors cursor-pointer"
                  onClick={() => onView(req)}
                >
                  {/* Request No */}
                  <td className="sticky left-0 z-10 bg-surface group-hover:bg-page transition-colors py-3 pr-4 type-body font-medium text-primary whitespace-nowrap">
                    <span className="hover:underline">{req.requestNumber}</span>
                  </td>

                  {/* Destination */}
                  <td className="px-4 py-3 type-body text-ink whitespace-nowrap">
                    {req.toLocationName}
                  </td>

                  {/* Product */}
                  <td className="px-4 py-3 type-body font-medium text-ink whitespace-nowrap">
                    {firstItem ? (
                      <div>
                        <span>{firstItem.productName}</span>
                        {req.items && req.items.length > 1 && (
                          <span className="ml-1 type-caption text-ink-muted font-normal">
                            (+{req.items.length - 1} more)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>

                  {/* Variant */}
                  <td className="px-4 py-3 type-body text-ink whitespace-nowrap">
                    {firstItem?.variant ? (
                      <span>{firstItem.variant}</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>

                  {/* Qty */}
                  <td className="pl-4 pr-6 py-3 text-right type-body font-medium tabular-nums text-ink whitespace-nowrap">
                    {totalQty}
                  </td>

                  {/* Courier / Driver */}
                  {showCourier && (
                    <td className="px-4 py-3 type-body text-ink whitespace-nowrap">
                      <div>{courierDriver}</div>
                      {transferRef?.vehiclePlate && (
                        <span className="type-caption text-ink-muted">
                          [{transferRef.vehiclePlate}]
                        </span>
                      )}
                    </td>
                  )}

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={hasScheduledTransfer ? "Scheduled" : req.status} />
                  </td>

                  {/* Actions (Three dots Menu - View Details only) */}
                  <td
                    className="pl-4 py-3 text-center whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
                          aria-label="Actions menu"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 bg-surface border border-border text-ink">
                        <DropdownMenuItem
                          onClick={() => onView(req)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer type-body hover:bg-subtle"
                        >
                          <Eye className="w-4 h-4 text-ink-muted" />
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
      {footer}
    </div>
  );
}
