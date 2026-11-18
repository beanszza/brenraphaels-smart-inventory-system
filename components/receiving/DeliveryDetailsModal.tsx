"use client";
import { ReceivingSkeleton } from "./ReceivingSkeleton";

import { getDeliveryForReceiving } from "@/app/actions/receiving/procurement-reads";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useEffect, useState } from "react";
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
      size="max-w-[640px]"
    >
      <div className="space-y-6 text-text-primary">
        {error && (
          <div role="alert" className="rounded-control border border-status-red/30 bg-status-red/10 p-3 type-caption text-status-red">
            {error}
          </div>
        )}

        {loading ? (
          <ReceivingSkeleton />
        ) : detail ? (
          <>
            {/* Header Summary */}
            <div className="bg-surface-muted/30 border border-divider rounded-control p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div>
                <div className="type-caption text-text-muted">Delivery No.</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{detail.deliveryNumber}</div>
              </div>
              <div>
                <div className="type-caption text-text-muted">Purchase Order</div>
                <div className="type-body font-semibold text-text-primary mt-0.5">{detail.poNumber}</div>
              </div>
              {detail.prNumber && (
                <div>
                  <div className="type-caption text-text-muted">Purchase Requisition Ref.</div>
                  <div className="type-body font-semibold text-text-primary mt-0.5">{detail.prNumber}</div>
                </div>
              )}
              <div>
                <div className="type-caption text-text-muted">Supplier</div>
                <div className="type-body font-semibold text-text-primary mt-0.5 truncate" title={detail.supplierName}>{detail.supplierName}</div>
              </div>
              <div>
                <div className="type-caption text-text-muted">Status</div>
                <div className="mt-1"><StatusBadge status={detail.status} /></div>
              </div>
            </div>

            {/* Secondary details */}
            {(detail.carrier || detail.trackingNumber || detail.estimatedArrival || detail.actualArrival) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {detail.carrier && (
                  <div>
                    <div className="type-caption text-text-muted">Carrier / Truck</div>
                    <div className="type-body font-semibold text-text-primary mt-0.5">{detail.carrier}</div>
                  </div>
                )}
                {detail.trackingNumber && (
                  <div>
                    <div className="type-caption text-text-muted">Tracking No.</div>
                    <div className="type-body font-semibold text-text-primary mt-0.5">{detail.trackingNumber}</div>
                  </div>
                )}
                {detail.estimatedArrival && (
                  <div>
                    <div className="type-caption text-text-muted">Estimated Arrival</div>
                    <div className="type-body font-semibold text-text-primary mt-0.5">
                      {new Date(detail.estimatedArrival).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {detail.actualArrival && (
                  <div>
                    <div className="type-caption text-text-muted">Actual Arrival</div>
                    <div className="type-body font-semibold text-text-primary mt-0.5">
                      {new Date(detail.actualArrival).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Line Items */}
            <div className="border-t border-divider pt-4 space-y-3">
              <div className="type-table-header uppercase text-text-muted">
                Delivery Line Items
              </div>
              <div className="overflow-x-auto rounded-control border border-divider bg-surface shadow-card">
                <table className="w-full border-collapse">
                  <thead className="table-head-row border-b border-divider bg-surface-muted/30">
                    <tr className="text-left table-th text-text-muted whitespace-nowrap">
                      <th className="px-4 py-4">Item Name</th>
                      <th className="px-4 py-4 text-right">Declared Qty</th>
                      <th className="px-4 py-4">Unit of Measure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {(detail.items || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-12 text-center type-body font-normal text-text-muted">
                          No line items found for this delivery.
                        </td>
                      </tr>
                    ) : (
                      detail.items.map((item) => (
                        <tr key={item.deliveryItemId} className="table-row hover:bg-surface-hover transition-colors">
                          <td className="px-4 py-4 table-td font-semibold text-text-primary whitespace-nowrap">{item.itemName}</td>
                          <td className="px-4 py-4 table-td text-right font-semibold text-text-primary whitespace-nowrap">
                            {item.declaredQuantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 table-td text-text-muted whitespace-nowrap">
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
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-divider mt-2">
          <ModalNativeCloseButton
            fallbackOnClose={onClose}
            disabled={loading}
            className="rounded-control border border-divider bg-surface px-5 py-2 type-label-button text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
            className="rounded-control bg-button-primary px-5 py-2 type-label-button text-text-inverse hover:bg-button-primary-hover transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Create Goods Receipt Note for this Delivery
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
