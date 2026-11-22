"use client";

import React from "react";
import {
  Eye,
  Pencil,
  ShoppingBag,
  MoreHorizontal,
  Ban,
  CheckCircle2,
  CornerUpLeft,
  XCircle,
} from "lucide-react";
import { PurchaseRequisition } from "../types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface PRTableProps {
  requisitions: PurchaseRequisition[];
  isAdmin?: boolean;
  isRequestsTab?: boolean;
  onView: (pr: PurchaseRequisition) => void;
  onEdit?: (pr: PurchaseRequisition) => void;
  onCancel?: (pr: PurchaseRequisition) => void;
  onApprove?: (pr: PurchaseRequisition) => void;
  onReject?: (pr: PurchaseRequisition) => void;
  onReturn?: (pr: PurchaseRequisition) => void;
  onCreatePo?: (pr: PurchaseRequisition) => void;
}

export function PRTable({
  requisitions,
  isAdmin = false,
  onView,
  onEdit,
  onCancel,
  onApprove,
  onReject,
  onReturn,
  onCreatePo,
}: PRTableProps) {
  const fmtDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full min-w-[780px] border-collapse">
        <thead>
          <tr className="border-b border-divider">
            <th className="sticky left-0 z-20 bg-surface pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[170px]">Purchase Requisition No.</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Request Date</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Requested By</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Department</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Required Date</th>
            <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
            <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {requisitions.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-12 text-center type-body text-ink-muted">
                No purchase requisitions found.
              </td>
            </tr>
          ) : (
            requisitions.map((pr) => {
              const isDraft = pr.status === "Draft";
              const isPending = pr.status === "Pending Approval" || (pr.status as string) === "Pending";
              const isReturned = pr.status === "Returned";
              const isApproved = pr.status === "Approved";
              const isCancellable = isDraft || isPending || isReturned;

              // Build list of actions
              const actions: ActionItem[] = [
                {
                  label: "View Details",
                  icon: <Eye className="w-4 h-4 text-ink" />,
                  onClick: () => onView(pr),
                },
              ];

              // If Admin: can Approve, Return for Revision, and Reject when Pending Approval
              if (isAdmin && isPending) {
                if (onApprove) {
                  actions.push({
                    label: "Approve",
                    icon: <CheckCircle2 className="w-4 h-4 text-ink" />,
                    onClick: () => onApprove(pr),
                  });
                }
                if (onReturn) {
                  actions.push({
                    label: "Return for Revision",
                    icon: <CornerUpLeft className="w-4 h-4 text-ink" />,
                    onClick: () => onReturn(pr),
                  });
                }
                if (onReject) {
                  actions.push({
                    label: "Reject",
                    icon: <XCircle className="w-4 h-4 text-destructive" />,
                    onClick: () => onReject(pr),
                  });
                }
              }

              // If NOT admin (Inventory Manager side):
              if (!isAdmin) {
                // Edit (Draft or Returned)
                if ((isDraft || isReturned) && onEdit) {
                  actions.push({
                    label: isReturned ? "Edit & Re-Submit" : "Edit Draft",
                    icon: <Pencil className="w-4 h-4 text-ink" />,
                    onClick: () => onEdit(pr),
                  });
                }

                // Cancel Requisition (Draft, Pending, Returned)
                if (isCancellable && onCancel) {
                  actions.push({
                    label: "Cancel Requisition",
                    icon: <Ban className="w-4 h-4 text-ink" />,
                    onClick: () => onCancel(pr),
                  });
                }

                // Create PO (Approved and still has un-ordered items)
                if (isApproved && !pr.isFullyConvertedToPo && onCreatePo) {
                  actions.push({
                    label: "Create Purchase Order",
                    icon: <ShoppingBag className="w-4 h-4 text-ink" />,
                    onClick: () => onCreatePo(pr),
                  });
                }
              }

              return (
                <tr
                  key={pr.prId}
                  className="group hover:bg-page transition-colors cursor-pointer"
                  onClick={() => onView(pr)}
                >
                  <td className="sticky left-0 z-10 bg-surface group-hover:bg-page transition-colors py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[170px]">
                    {pr.prNumber}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {fmtDate(pr.requestDate)}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {pr.requestedBy && pr.requestedBy !== "Unauthenticated"
                      ? pr.requestedBy
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {pr.department || "Inventory"}
                  </td>
                  <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                    {fmtDate(pr.requiredDate)}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <StatusBadge status={pr.status} />
                  </td>
                  <td
                    className="w-16 py-3 pl-4 text-center whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors focus:outline-none cursor-pointer"
                          aria-label="Actions menu"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {actions.map((action, idx) => (
                          <DropdownMenuItem
                            key={action.label + idx}
                            onClick={action.onClick}
                            className="cursor-pointer type-body-secondary"
                          >
                            <span className="shrink-0">{action.icon}</span>
                            <span className="truncate">{action.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
