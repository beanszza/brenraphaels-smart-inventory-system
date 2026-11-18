"use client";

import React, { useState, useEffect, useRef } from "react";
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
  const [openDropdownPrId, setOpenDropdownPrId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownPrId(null);
      }
    }
    if (openDropdownPrId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdownPrId]);

  const fmtDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-card border border-divider bg-surface shadow-card">
      <table className="w-full">
        <thead className="border-b border-divider bg-surface-muted table-head-row">
          <tr className="border-b border-divider bg-surface-muted table-head-row">
            <th className="sticky left-0 z-20 bg-surface-muted px-4 py-3 text-left type-table-header uppercase text-text-muted tracking-wider whitespace-nowrap min-w-[160px] w-44 border-r border-divider shadow-sticky-col table-th">PURCHASE REQUISITION NUMBER</th>
            <th className="px-4 py-3 text-left type-table-header uppercase text-text-muted tracking-wider whitespace-nowrap table-th">REQUEST DATE</th>
            <th className="px-4 py-3 text-left type-table-header uppercase text-text-muted tracking-wider whitespace-nowrap table-th">REQUESTED BY</th>
            <th className="px-4 py-3 text-left type-table-header uppercase text-text-muted tracking-wider whitespace-nowrap table-th">DEPARTMENT</th>
            <th className="px-4 py-3 text-left type-table-header uppercase text-text-muted tracking-wider whitespace-nowrap table-th">REQUIRED DATE</th>
            <th className="px-4 py-3 text-left type-table-header uppercase text-text-muted tracking-wider whitespace-nowrap table-th">STATUS</th>
            <th className="px-4 py-3 text-center type-table-header uppercase text-text-muted tracking-wider whitespace-nowrap w-24 table-th">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {requisitions.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-5 py-8 text-center type-body text-text-muted">
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
                  icon: <Eye className="w-4 h-4 text-text-primary" />,
                  onClick: () => {
                    setOpenDropdownPrId(null);
                    onView(pr);
                  },
                },
              ];

                            // If Admin: can Approve, Return for Revision, and Reject when Pending Approval
              if (isAdmin && isPending) {
                if (onApprove) {
                  actions.push({
                    label: "Approve",
                    icon: <CheckCircle2 className="w-4 h-4 text-text-primary" />,
                    onClick: () => {
                      setOpenDropdownPrId(null);
                      onApprove(pr);
                    },
                  });
                }
                if (onReturn) {
                  actions.push({
                    label: "Return for Revision",
                    icon: <CornerUpLeft className="w-4 h-4 text-text-primary" />,
                    onClick: () => {
                      setOpenDropdownPrId(null);
                      onReturn(pr);
                    },
                  });
                }
                if (onReject) {
                  actions.push({
                    label: "Reject",
                    icon: <XCircle className="w-4 h-4 text-status-red" />,
                    onClick: () => {
                      setOpenDropdownPrId(null);
                      onReject(pr);
                    },
                  });
                }
              }

              // If NOT admin (Inventory Manager side):
              if (!isAdmin) {
                // Edit (Draft or Returned)
                if ((isDraft || isReturned) && onEdit) {
                  actions.push({
                    label: isReturned ? "Edit & Re-Submit" : "Edit Draft",
                    icon: <Pencil className="w-4 h-4 text-text-primary" />,
                    onClick: () => {
                      setOpenDropdownPrId(null);
                      onEdit(pr);
                    },
                  });
                }

                // Cancel Requisition (Draft, Pending, Returned)
                if (isCancellable && onCancel) {
                  actions.push({
                    label: "Cancel Requisition",
                    icon: <Ban className="w-4 h-4 text-text-primary" />,
                    onClick: () => {
                      setOpenDropdownPrId(null);
                      onCancel(pr);
                    },
                  });
                }

                // Create PO (Approved and still has un-ordered items)
                if (isApproved && !pr.isFullyConvertedToPo && onCreatePo) {
                  actions.push({
                    label: "Create Purchase Order",
                    icon: <ShoppingBag className="w-4 h-4 text-text-primary" />,
                    onClick: () => {
                      setOpenDropdownPrId(null);
                      onCreatePo(pr);
                    },
                  });
                }
              }

              return (
                <tr
                  key={pr.prId}
                  className="group hover:bg-hover transition-colors cursor-pointer table-row"
                  onClick={() => onView(pr)}
                >
                  <td className="sticky left-0 z-10 bg-surface group-hover:bg-hover px-4 py-3.5 font-mono text-text-primary whitespace-nowrap font-medium min-w-[160px] w-44 border-r border-divider shadow-sticky-col transition-colors table-td">
                    {pr.prNumber}
                  </td>
                  <td className="px-4 py-3.5 text-text-muted whitespace-nowrap table-td">
                    {fmtDate(pr.requestDate)}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-text-primary whitespace-nowrap table-td">
                    {pr.requestedBy && pr.requestedBy !== "Unauthenticated"
                      ? pr.requestedBy
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-text-muted whitespace-nowrap table-td">
                    {pr.department || "Inventory"}
                  </td>
                  <td className="px-4 py-3.5 text-text-muted whitespace-nowrap table-td">
                    {fmtDate(pr.requiredDate)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap table-td">
                    <StatusBadge status={pr.status} />
                  </td>
                  <td
                    className="px-4 py-3.5 text-center whitespace-nowrap table-td"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-control border border-transparent text-text-primary hover:bg-hover transition-all data-[state=open]:bg-surface-muted data-[state=open]:border-divider data-[state=open]:shadow-sm"
                          aria-label="Actions menu"
                        >
                          <MoreHorizontal className="w-4 h-4 text-text-primary" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 z-[200] rounded-menu border border-divider bg-surface shadow-menu">
                        {actions.map((action, idx) => (
                          <DropdownMenuItem
                            key={action.label + idx}
                            onClick={action.onClick}
                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer type-caption text-text-primary hover:bg-hover"
                          >
                            <span className="shrink-0 text-text-primary">{action.icon}</span>
                            <span className="truncate text-text-primary">{action.label}</span>
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
