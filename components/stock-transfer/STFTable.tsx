"use client";

import React from "react";
import { Eye, Truck, X } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StockTransfer } from "./types";
import { useAuth } from "@/context/AuthContext";

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
  const { isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground animate-pulse">
        Loading formal stock transfers...
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
        No formal stock transfers found matching your filter criteria.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
            <tr>
              <th className="px-5 py-3.5">Transfer No.</th>
              <th className="px-5 py-3.5">STR Ref</th>
              <th className="px-5 py-3.5">Product & Variant</th>
              <th className="px-5 py-3.5">Destination</th>
              <th className="px-5 py-3.5 text-right">Transfer Qty</th>
              <th className="px-5 py-3.5">Scheduled Date</th>
              <th className="px-5 py-3.5">Driver / Courier</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transfers.map((st) => {
              const isScheduled = st.status === "Scheduled";

              return (
                <tr
                  key={st.transferId}
                  className="hover:bg-muted/20 transition-colors cursor-pointer group"
                  onClick={() => onView(st)}
                >
                  <td className="px-5 py-4 font-mono font-bold text-foreground">
                    <span className="hover:underline">{st.transferNumber}</span>
                  </td>

                  <td className="px-5 py-4 font-mono text-muted-foreground">
                    {st.requestNumber || "—"}
                  </td>

                  <td className="px-5 py-4 font-semibold text-foreground">
                    <div>{st.productName}</div>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      {st.variant || "Standard"}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-foreground">
                    {st.destLocationName}
                  </td>

                  <td className="px-5 py-4 text-right font-extrabold text-foreground">
                    {st.transferQuantity}
                  </td>

                  <td className="px-5 py-4 text-muted-foreground">
                    {st.scheduledDate ? new Date(st.scheduledDate).toLocaleDateString() : "—"}
                  </td>

                  <td className="px-5 py-4 text-muted-foreground">
                    <div>{st.driverName || "—"}</div>
                    {st.vehiclePlate && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        [{st.vehiclePlate}]
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={st.status} />
                  </td>

                  <td
                    className="px-5 py-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Inventory Manager Actions (Admin has NO write access here!) */}
                      {!isAdmin && isScheduled && (
                        <>
                          {onDispatch && (
                            <button
                              type="button"
                              onClick={() => onDispatch(st)}
                              title="Dispatch Transfer"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/85 transition-colors shadow-xs"
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
                              className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                        className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
