"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ShoppingCart } from "lucide-react";

interface SupplierOrdersModalProps {
  selectedSupplierModal: any;
  onClose: () => void;
}

export default function SupplierOrdersModal({
  selectedSupplierModal,
  onClose,
}: SupplierOrdersModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!selectedSupplierModal || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-[90vw] max-w-[90vw] sm:max-w-[80vw] md:max-w-[700px] lg:max-w-[900px] max-h-[90vh] overflow-y-auto p-md sm:p-lg rounded-lg sm:rounded-xl border border-border bg-card flex flex-col shadow-2xl text-foreground" onClick={e => e.stopPropagation()}>
        <div className="border-b border-border pb-3 mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart size={20} className="text-foreground" />
              Order Transactions: {selectedSupplierModal.supplierName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete history of purchase order transactions including pending and completed orders
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/50 border border-border">
            <div>
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-lg font-bold text-foreground">{selectedSupplierModal.totalOrdersPlaced}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">On-Time Deliveries</p>
              <p className="text-lg font-bold text-emerald-600">{selectedSupplierModal.onTimeDeliveries}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Late Deliveries</p>
              <p className="text-lg font-bold text-rose-600">{selectedSupplierModal.lateDeliveries}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vendor Grade</p>
              <p className="text-lg font-bold text-foreground">{selectedSupplierModal.overallVendorGrade}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-background/50 text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold text-center w-12">#</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Order Date</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Expected Arrival</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold text-center">Items Count</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold text-center">Order Status</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold text-center">QA Status</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold text-center">Inspection Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!selectedSupplierModal.orders || selectedSupplierModal.orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                      No purchase order transactions found for this supplier.
                    </td>
                  </tr>
                ) : (
                  selectedSupplierModal.orders.map((po: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/50 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3.5 text-center font-mono text-xs font-bold text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground font-medium">{po.orderDate}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{po.expectedArrivalDate}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-muted-foreground font-medium">{po.totalItemsCount} items</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          po.status?.toLowerCase().includes("completed") || po.status?.toLowerCase().includes("received")
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : po.status?.toLowerCase().includes("pending")
                              ? "bg-amber-50 text-amber-600 border border-amber-200"
                              : "bg-muted text-muted-foreground border border-border"
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          po.qaStatus?.toLowerCase().includes("pass")
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : po.qaStatus?.toLowerCase().includes("reject")
                              ? "bg-rose-50 text-rose-600 border border-rose-200"
                              : "bg-amber-50 text-amber-600 border border-amber-200"
                        }`}>
                          {po.qaStatus}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-xs text-muted-foreground">{po.inspectedDate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border bg-background/50 flex justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border bg-card text-foreground font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
