"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "./ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { Supplier } from "./types";
import { loadSupplierDetails } from "@/lib/resources-suppliers/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Clock, ShoppingCart } from "lucide-react";

interface CatalogItem {
  itemId: number;
  itemName: string;
  supplierSku: string | null;
  unitPrice: number;
  currency: string;
  purchaseUomName: string;
  packSize: number;
  leadTimeDays: number;
  isPreferred: boolean;
}

interface RecentOrder {
  poId: number;
  poNumber: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  itemCount: number;
}

interface SupplierDetailsModalProps {
  supplier: Supplier | null;
  onClose: () => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export default function SupplierDetailsModal(props: SupplierDetailsModalProps) {
  return props.supplier ? <SupplierDetailsModalContent key={props.supplier.supplierId} {...props} /> : null;
}

function SupplierDetailsModalContent({
  supplier,
  onClose,
}: SupplierDetailsModalProps) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!supplier) return;
    loadSupplierDetails(supplier.supplierId).then(data => {
      if (!cancelled) {
        setCatalog(data.catalog);
        setRecentOrders(data.recentOrders);
      }
    }).catch(() => {
      if (!cancelled) setError("Unable to load details. Close and reopen to try again.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [supplier]);

  if (!supplier) return null;


  return (
    <ModalWrapper
      open={!!supplier}
      title={`Supplier Profile - ${supplier.companyName}`}
      onClose={onClose}
      size="max-w-[640px]"
    >
      <div className="space-y-6">
        {error && <p role="alert" className="type-body text-status-red">{error}</p>}
        {/* Header */}
        {supplier.supplierCode && (
          <div className="flex items-center justify-end pb-3 border-b border-divider">
            <span className="type-caption text-ink-muted bg-subtle border border-border px-3 py-1 rounded-pill">
              Supplier No: {supplier.supplierCode}
            </span>
          </div>
        )}

        {/* Contact Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-inner border border-border bg-surface p-4 type-body">
          <div>
            <p className="type-label text-ink-muted">Contact Person</p>
            <p className="type-body font-semibold text-ink mt-0.5">{supplier.contactPerson}</p>
          </div>
          <div>
            <p className="type-label text-ink-muted">Email Address</p>
            <p className="type-body font-semibold text-ink mt-0.5">{supplier.email}</p>
          </div>
          <div>
            <p className="type-label text-ink-muted">Phone Number</p>
            <p className="type-body font-semibold text-ink mt-0.5">{supplier.phone}</p>
          </div>
          <div>
            <p className="type-label text-ink-muted">Physical Address</p>
            <p className="type-body font-semibold text-ink mt-0.5">{supplier.address}</p>
          </div>
        </div>

        {/* Supplied Items (no prices) */}
        <div className="rounded-card border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-divider pb-2">
            <Package size={16} className="text-ink" />
            <h3 className="type-subsection font-semibold text-ink uppercase tracking-wider">
              Linked Supplies
            </h3>
          </div>

          {loading ? (
            <Skeleton aria-label="Loading details" className="m-4 h-16 rounded-control" />
          ) : catalog.length === 0 ? (
            <div className="py-6 text-center type-caption text-ink-muted">
              No items linked to this supplier.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-2.5 py-2 text-left table-th">ITEM NAME</th>
                    <th className="px-2.5 py-2 text-left table-th">VENDOR SKU</th>
                    <th className="px-2.5 py-2 text-left table-th">PACK SIZE</th>
                    <th className="px-2.5 py-2 text-left table-th">LEAD TIME</th>
                    <th className="px-2.5 py-2 text-left table-th">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {catalog.map((ci) => (
                    <tr key={ci.itemId} className="table-row">
                      <td className="px-2.5 py-2.5 table-td font-semibold text-ink">{ci.itemName}</td>
                      <td className="px-2.5 py-2.5 table-td text-ink-muted">{ci.supplierSku || "-"}</td>
                      <td className="px-2.5 py-2.5 table-td text-ink-muted">
                        {ci.packSize > 1 ? `${ci.packSize} units/pack` : "Standard"}
                      </td>
                      <td className="px-2.5 py-2.5 table-td text-ink-muted flex items-center gap-1 mt-2">
                        <Clock size={11} /> {ci.leadTimeDays} days
                      </td>
                      <td className="px-2.5 py-2.5 table-td">
                        {ci.isPreferred && (
                          <StatusBadge status="Preferred" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="rounded-card border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-divider pb-2">
            <ShoppingCart size={16} className="text-ink" />
            <h3 className="type-subsection font-semibold text-ink uppercase tracking-wider">
              Recent Orders
            </h3>
          </div>

          {loading ? (
            <Skeleton aria-label="Loading details" className="m-4 h-16 rounded-control" />
          ) : recentOrders.length === 0 ? (
            <div className="py-6 text-center type-caption text-ink-muted">
              No purchase orders found for this supplier.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-2.5 py-2 text-left table-th">PURCHASE ORDER NUMBER</th>
                    <th className="px-2.5 py-2 text-left table-th">DATE</th>
                    <th className="px-2.5 py-2 text-left table-th">STATUS</th>
                    <th className="px-2.5 py-2 text-right table-th">QUANTITY</th>
                    <th className="px-2.5 py-2 text-right table-th">TOTAL AMOUNT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOrders.map((order) => (
                    <tr key={order.poId} className="table-row">
                      <td className="px-2.5 py-2.5 table-td font-semibold text-ink">{order.poNumber}</td>
                      <td className="px-2.5 py-2.5 table-td text-ink-muted">{formatDate(order.orderDate)}</td>
                      <td className="px-2.5 py-2.5 table-td">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-2.5 py-2.5 table-td text-right text-ink-muted tabular-nums">
                        {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                      </td>
                      <td className="px-2.5 py-2.5 table-td text-right font-semibold text-ink tabular-nums">
                        ₱{Number(order.totalAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-divider">
          <ModalCloseButton
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border border-border bg-surface px-5 py-2.5 type-label-button text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            Close
          </ModalCloseButton>
        </div>
      </div>
    </ModalWrapper>
  );
}
