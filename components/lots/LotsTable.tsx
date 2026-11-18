"use client";

import React from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LotItem } from "./types";

interface LotsTableProps {
  items: LotItem[];
  currentPage: number;
  pageSize: number;
}


function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export default function LotsTable({ items, currentPage, pageSize }: LotsTableProps) {
  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-border bg-surface">
      <table className="w-full">
        <thead>
          <tr className="table-head-row">
            <th className="sticky left-0 z-20 min-w-[150px] w-44 px-3 py-2.5 text-left table-th whitespace-nowrap bg-subtle border-r border-border shadow-sticky-col">LOT CODE</th>
            <th className="px-3 py-2.5 text-left table-th whitespace-nowrap">ITEM</th>
            <th className="px-3 py-2.5 text-left table-th whitespace-nowrap">LOCATION</th>
            <th className="px-3 py-2.5 text-left table-th whitespace-nowrap">SUPPLIER</th>
            <th className="px-3 py-2.5 text-left table-th whitespace-nowrap">RECEIVED</th>
            {items.some((lot) => Boolean(lot.expiryDate)) && (
              <th className="px-3 py-2.5 text-left table-th whitespace-nowrap">EXPIRY</th>
            )}
            <th className="px-3 py-2.5 text-right table-th whitespace-nowrap">QTY REMAINING</th>
            <th className="px-3 py-2.5 text-right table-th whitespace-nowrap">RESERVED</th>
            <th className="px-3 py-2.5 text-center table-th whitespace-nowrap">STATUS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.length === 0 ? (
            <tr>
              <td colSpan={items.some((lot) => Boolean(lot.expiryDate)) ? 9 : 8} className="px-5 py-10 text-center type-body text-ink-muted">
                No Results Found
              </td>
            </tr>
          ) : (
            items.map((lot, idx) => {
              const resQty = Number(lot.reservedQuantity || 0);

              let badgeLabel = lot.status;
              // eslint-disable-next-line react-hooks/purity
              if (lot.isExpired || lot.status === "Expired" || (lot.expiryDate && new Date(lot.expiryDate).getTime() < Date.now())) {
                badgeLabel = "Expired";
              } else if (resQty >= lot.quantityRemaining && lot.quantityRemaining > 0) {
                badgeLabel = "Reserved";
              } else if (resQty > 0) {
                badgeLabel = "Partially Reserved";
              }

              return (
                <tr key={lot.lotId} className="table-row group">
                  <td className="sticky left-0 z-10 min-w-[150px] w-44 px-3 py-3 table-td font-semibold text-ink whitespace-nowrap font-mono bg-surface group-hover:bg-subtle transition-colors border-r border-border shadow-sticky-col">
                    {lot.lotCode}
                  </td>
                  <td className="table-td text-ink">
                    <div className="font-semibold text-ink">{lot.itemName}</div>
                  </td>
                  <td className="table-td text-ink-muted">{lot.locationName}</td>
                  <td className="table-td text-ink-muted">
                    {lot.supplierName || "-"}
                    {lot.supplierLotNo && <span className="type-caption ml-1">({lot.supplierLotNo})</span>}
                  </td>
                  <td className="table-td text-ink-muted">{formatDate(lot.receivedDate)}</td>
                  {items.some((l) => Boolean(l.expiryDate)) && (
                    <td className="table-td">
                      {lot.expiryDate ? (
                        <span className={lot.isExpired ? "text-status-red font-semibold" : "text-ink"}>
                          {formatDate(lot.expiryDate)}
                          {lot.isExpired && " (exp)"}
                        </span>
                      ) : (
                        <span className="text-ink-muted">No Expiry</span>
                      )}
                    </td>
                  )}
                  <td className="table-td font-mono font-semibold text-ink text-right whitespace-nowrap tabular-nums">
                    {lot.quantityRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {lot.uomName}
                  </td>
                  <td className="table-td text-right font-mono font-semibold text-ink whitespace-nowrap tabular-nums">
                    {resQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {lot.uomName}
                  </td>
                  <td className="table-td text-center whitespace-nowrap">
                    <StatusBadge status={badgeLabel} />
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