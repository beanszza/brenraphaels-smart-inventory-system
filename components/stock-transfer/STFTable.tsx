"use client";

import React from "react";
import { TransferSkeleton } from "./TransferSkeleton";
import { Eye, Truck, X } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransfer } from "./types";

interface STFTableProps {
  transfers: StockTransfer[];
  loading: boolean;
  onView: (transfer: StockTransfer) => void;
  onDispatch?: (transfer: StockTransfer) => void;
  onCancel?: (transfer: StockTransfer) => void;
}

export function STFTable({
  transfers,
  loading,
  onView,
  onDispatch,
  onCancel,
}: STFTableProps) {

  if (loading) return <TransferSkeleton />;

  if (transfers.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-12 text-center type-body text-ink-muted">
        No formal stock transfers found matching your filter criteria.
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-divider">
            <tr>
              <th className="py-3 pr-4 text-left type-table-header text-ink-muted whitespace-nowrap">Transfer No.</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">STR Ref</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Product &amp; Variant</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Destination</th>
              <th className="pl-4 pr-6 py-3 text-right type-table-header text-ink-muted whitespace-nowrap">Transfer Qty</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Scheduled Date</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Driver / Courier</th>
              <th className="px-4 py-3 text-left type-table-header text-ink-muted whitespace-nowrap">Status</th>
              <th className="pl-4 py-3 text-right type-table-header text-ink-muted whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {transfers.map((st) => {
              const isScheduled = st.status === "Scheduled";

              return (
                <tr
                  key={st.transferId}
                  className="hover:bg-page transition-colors cursor-pointer"
                  onClick={() => onView(st)}
                >
                  <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap">
                    <span className="hover:underline">{st.transferNumber}</span>
                  </td>

                  <td className="px-4 py-3 type-body text-ink-muted whitespace-nowrap">
                    {st.requestNumber || "—"}
                  </td>

                  <td className="px-4 py-3 type-body font-medium text-ink">
                    <div>{st.productName}</div>
                    <span className="type-caption text-ink-muted font-normal">
                      {st.variant || "Standard"}
                    </span>
                  </td>

                  <td className="px-4 py-3 type-body text-ink">
                    {st.destLocationName}
                  </td>

                  <td className="pl-4 pr-6 py-3 text-right type-body font-medium tabular-nums text-ink">
                    {st.transferQuantity}
                  </td>

                  <td className="px-4 py-3 type-body text-ink-muted whitespace-nowrap">
                    {st.scheduledDate ? new Date(st.scheduledDate).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" }) : "—"}
                  </td>

                  <td className="px-4 py-3 type-body text-ink">
                    <div>{st.driverName || "—"}</div>
                    {st.vehiclePlate && (
                      <span className="type-caption text-ink-muted">
                        [{st.vehiclePlate}]
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <StatusBadge status={st.status} />
                  </td>

                  <td
                    className="pl-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Inventory Manager Actions (Admin has NO write access here!) */}
                      {isScheduled && (
                        <>
                          {onDispatch && (
                            <button
                              type="button"
                              onClick={() => onDispatch(st)}
                              title="Dispatch Transfer"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-control bg-primary text-on-brand type-button hover:bg-primary-hover transition-colors cursor-pointer"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Dispatch</span>
                            </button>
                          )}
                          {onCancel && (
                            <button
                              type="button"
                              onClick={() => onCancel(st)}
                              title="Cancel Transfer"
                              className="p-1.5 rounded-control border border-border bg-surface text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}

                      {/* View Details Icon button */}
                      <button
                        type="button"
                        onClick={() => onView(st)}
                        title="View Details"
                        className="p-1.5 rounded-control border border-border bg-surface text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
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
