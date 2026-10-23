"use client";

import React from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { Order } from "./types";

interface OrderDetailsModalProps {
  order: Order | null;
  onClose: () => void;
}


export default function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
  if (!order) return null;

  return (
    <ModalWrapper open={!!order} title={`Order Details - ${order.id}`} onClose={onClose} size="max-w-2xl">
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <StatusBadge status={order.status} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Item</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{order.item}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Supplier</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{order.supplier}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Quantity Ordered</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{order.quantity} {order.unit}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Order Date</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{order.orderDate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected Arrival (ETA)</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{order.eta}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment Type</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{order.payment}</p>
          </div>
        </div>

        {order.status === "Completed" && (
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-bold text-foreground">Quality Assurance Inspection Record</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Arrival Date:</span> <span className="font-semibold text-foreground">{order.arrivalDate || "N/A"}</span></div>
              <div><span className="text-muted-foreground">Inspected By:</span> <span className="font-semibold text-foreground">{order.inspectedBy || "N/A"}</span></div>
              <div><span className="text-muted-foreground">Quality Assurance Status:</span> <span className="font-semibold text-foreground">{order.qaStatus || "Passed"}</span></div>
              <div><span className="text-muted-foreground">Quality Assurance Approved Quantity:</span> <span className="font-semibold text-foreground">{order.qaApproved ?? order.quantity}</span></div>
            </div>
            {order.qaNotes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">Notes: <span className="text-foreground">{order.qaNotes}</span></p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-border">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Close
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
}
