"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import { getDeliveryForReceiving } from "@/app/actions/receiving/procurement-reads";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useEffect, useState } from "react";
import { Truck, Package } from "lucide-react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalNativeCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArrivedDelivery } from "./types";

interface DeliveryDetailsModalProps {
  delivery: ArrivedDelivery | null;
  open: boolean;
  onClose: () => void;
  onCreateGrn: (deliveryId: number) => void;
}

interface DeliveryDetail {
  deliveryId: number;
  deliveryNumber: string;
  poNumber: string;
  prNumber?: string;
  supplierName: string;
  carrier?: string;
  trackingNumber?: string;
  status: string;
  estimatedArrival?: string;
  actualArrival?: string;
  items: {
    deliveryItemId: number;
    itemId: number;
    itemName: string;
    poItemId: number;
    declaredQuantity: number;
    purchaseUomName?: string;
    uomName?: string;
  }[];
}

export default function DeliveryDetailsModal({
  delivery,
  open,
  onClose,
  onCreateGrn,
}: DeliveryDetailsModalProps) {
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !delivery) return;
    setLoading(true);
    setError(null);
    actionResponse(getDeliveryForReceiving(delivery.deliveryId))
      .then(({ data }) => {
        setDetail(data?.data || null);
      })
      .catch(() => setError("Unable to load delivery details."))
      .finally(() => setLoading(false));
  }, [open, delivery]);

  if (!delivery) return null;

  return (
    <ModalWrapper
      open={open}
      title={`Delivery Details — ${delivery.deliveryNumber}`}
      onClose={onClose}
      size="max-w-4xl"
    >
      <div className="space-y-6 text-foreground">
        {error && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <ReceivingSkeleton />
        ) : detail ? (
          <>
            {/* Header Summary */}
            <div className="bg-muted/20 border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Delivery No.</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{detail.deliveryNumber}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Purchase Order</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{detail.poNumber}</div>
              </div>
              {detail.prNumber && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Purchase Requisition Ref.</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">{detail.prNumber}</div>
                </div>
              )}
              <div>
                <div className="text-xs font-medium text-muted-foreground">Supplier</div>
                <div className="text-sm font-semibold text-foreground mt-0.5 truncate" title={detail.supplierName}>{detail.supplierName}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Status</div>
                <div className="mt-1"><StatusBadge status={detail.status} /></div>
              </div>
            </div>

            {/* Secondary details */}
            {(detail.carrier || detail.trackingNumber || detail.estimatedArrival || detail.actualArrival) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {detail.carrier && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Carrier / Truck</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">{detail.carrier}</div>
                  </div>
                )}
                {detail.trackingNumber && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Tracking No.</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">{detail.trackingNumber}</div>
                  </div>
                )}
                {detail.estimatedArrival && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Estimated Arrival</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">
                      {new Date(detail.estimatedArrival).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {detail.actualArrival && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Actual Arrival</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">
                      {new Date(detail.actualArrival).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Line Items */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Delivery Line Items
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/30">
                    <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
                      <th className="px-4 py-4">Item Name</th>
                      <th className="px-4 py-4 text-right">Declared Qty</th>
                      <th className="px-4 py-4">Unit of Measure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(detail.items || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-12 text-center text-sm font-normal text-muted-foreground">
                          No line items found for this delivery.
                        </td>
                      </tr>
                    ) : (
                      detail.items.map((item) => (
                        <tr key={item.deliveryItemId} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap">{item.itemName}</td>
                          <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">
                            {item.declaredQuantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                            {item.purchaseUomName || item.uomName || "Unit"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-2">
          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            disabled={loading}
            className="rounded-xl border border-border bg-card px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Close
          </ModalNativeCloseButton>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              onClose();
              onCreateGrn(delivery.deliveryId);
            }}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Create Goods Receipt Note for this Delivery
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
