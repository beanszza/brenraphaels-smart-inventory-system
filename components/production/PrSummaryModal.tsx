"use client";

import React from "react";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ExternalLink, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface PrSummaryModalProps {
  open: boolean;
  onClose: () => void;
  prData: {
    prId: number;
    prNumber: string;
    status: string;
    estimatedTotal: number;
    items: Array<{
      itemId: number;
      itemName: string;
      requestedQuantity: number;
      estimatedUnitPrice: number;
    }>;
  } | null;
}

export default function PrSummaryModal({ open, onClose, prData }: PrSummaryModalProps) {
  if (!prData) return null;

  return (
    <ModalWrapper open={open} title="Purchase Requisition Summary" onClose={onClose} size="max-w-[560px]">
      <div className="space-y-6 text-text-primary">
        <div className="flex items-start gap-4 p-4 rounded-control bg-surface-secondary/40 border border-divider">
          <CheckCircle2 className="w-6 h-6 text-brand shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-text-primary type-body">
              Purchase Requisition Successfully Generated
            </h3>
            <p className="type-caption text-text-muted mt-0.5">
              An automated requisition was created to replenish the material shortfalls required for this production batch.
            </p>
          </div>
          <StatusBadge status={prData.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-control border border-divider bg-surface">
          <div>
            <span className="type-caption text-text-muted block font-medium">Requisition No.</span>
            <span className="type-body font-semibold text-text-primary">{prData.prNumber}</span>
          </div>
          <div>
            <span className="type-caption text-text-muted block font-medium">Department</span>
            <span className="type-body font-semibold text-text-primary">Production</span>
          </div>
          <div>
            <span className="type-caption text-text-muted block font-medium">Estimated Total</span>
            <span className="type-body font-semibold text-text-primary">
              PHP {prData.estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div>
          <h4 className="type-overline uppercase font-semibold text-text-muted tracking-wider mb-2">
            Requisitioned Shortfall Items ({prData.items.length})
          </h4>
          <div className="border border-divider rounded-control overflow-hidden">
            <table className="w-full text-left border-collapse type-caption">
              <thead className="bg-surface-secondary border-b border-divider">
                <tr className="table-head-row">
                  <th className="table-th py-2.5 px-4">Item Name</th>
                  <th className="table-th py-2.5 px-4 text-right">Requested Qty</th>
                  <th className="table-th py-2.5 px-4 text-right">Est. Unit Price</th>
                  <th className="table-th py-2.5 px-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {prData.items.map((item, idx) => {
                  const subtotal = item.requestedQuantity * item.estimatedUnitPrice;
                  return (
                    <tr key={idx} className="table-row hover:bg-surface-secondary/50">
                      <td className="py-3 px-4 table-td font-medium text-text-primary">{item.itemName}</td>
                      <td className="py-3 px-4 table-td text-right font-semibold text-text-primary">
                        {item.requestedQuantity}
                      </td>
                      <td className="py-3 px-4 table-td text-right text-text-muted">
                        PHP {item.estimatedUnitPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 table-td text-right font-semibold text-text-primary">
                        PHP {subtotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-divider">
          <Link
            href="/orders-procurement?tab=pr"
            className="flex items-center gap-1.5 type-caption font-semibold text-text-primary hover:underline"
          >
            <span>View All Requisitions</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <ModalCloseButton
            type="button"
            fallbackOnClose={onClose}
            className="bg-button-primary text-text-inverse font-semibold type-caption px-5 py-2 rounded-control hover:bg-button-primary/85 transition-colors shadow-card cursor-pointer"
          >
            Done
          </ModalCloseButton>
        </div>
      </div>
    </ModalWrapper>
  );
}
