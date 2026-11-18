"use client";

import React from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { Order } from "./types";

interface OrderDetailsModalProps {
  order: Order | null;
  onClose: () => void;
}

export default function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
  if (!order) return null;

  return (
    <ModalWrapper open={!!order} title={`Order Details - ${order.id}`} onClose={onClose} size="max-w-[560px]">
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-divider">
          <StatusBadge status={order.status} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="type-caption text-text-muted">Item</p>
            <p className="type-body font-semibold text-text-primary mt-0.5">{order.item}</p>
          </div>
          <div>
            <p className="type-caption text-text-muted">Supplier</p>
            <p className="type-body font-semibold text-text-primary mt-0.5">{order.supplier}</p>
          </div>
          <div>
            <p className="type-caption text-text-muted">Quantity Ordered</p>
            <p className="type-body font-semibold text-text-primary mt-0.5">{order.quantity} {order.unit}</p>
          </div>
          <div>
            <p className="type-caption text-text-muted">Order Date</p>
            <p className="type-body font-semibold text-text-primary mt-0.5">{order.orderDate}</p>
          </div>
          <div>
            <p className="type-caption text-text-muted">Expected Arrival (ETA)</p>
            <p className="type-body font-semibold text-text-primary mt-0.5">{order.eta}</p>
          </div>
          <div>
            <p className="type-caption text-text-muted">Payment Type</p>
            <p className="type-body font-semibold text-text-primary mt-0.5">{order.payment}</p>
          </div>
        </div>

        {order.status === "Completed" && (
          <div className="rounded-card border border-divider bg-surface-muted p-4 space-y-3">
            <p className="type-label font-semibold text-text-primary">Quality Assurance Inspection Record</p>
            <div className="grid grid-cols-2 gap-2 type-caption">
              <div><span className="text-text-muted">Arrival Date:</span> <span className="font-semibold text-text-primary">{order.arrivalDate || "N/A"}</span></div>
              <div><span className="text-text-muted">Inspected By:</span> <span className="font-semibold text-text-primary">{order.inspectedBy || "N/A"}</span></div>
              <div><span className="text-text-muted">Quality Assurance Status:</span> <span className="font-semibold text-text-primary">{order.qaStatus || "Passed"}</span></div>
              <div><span className="text-text-muted">Quality Assurance Approved Quantity:</span> <span className="font-semibold text-text-primary">{order.qaApproved ?? order.quantity}</span></div>
            </div>
            {order.qaNotes && (
              <div className="pt-2 border-t border-divider">
                <p className="type-caption text-text-muted">Notes: <span className="text-text-primary">{order.qaNotes}</span></p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-divider">
          <ModalCloseButton
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border border-divider bg-surface px-5 py-2.5 h-auto type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Close
          </ModalCloseButton>
        </div>
      </div>
    </ModalWrapper>
  );
}
