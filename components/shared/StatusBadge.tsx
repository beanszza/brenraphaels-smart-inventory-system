import React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";

// Normalize API spellings without changing the label supplied by callers.
const STATUS_VARIANTS: Record<string, NonNullable<BadgeProps["variant"]>> = {};
const STATUS_GROUPS = {
  success: ["Approved", "Completed", "Released", "Materials Issued", "Ready for Production", "Inventory Added", "Transferred", "Committed", "Reconciled", "Inspected", "Accepted", "QaCompleted", "Active", "Enabled", "Active2", "Yes", "In Stock", "Available", "Delivered", "Passed", "Normal", "Resolved", "Verified", "Success"],
  warning: ["Pending", "Open", "QaPending", "Pending Approval", "Low Stock", "Quarantine", "Quarantined", "Overstock", "On Hold", "Partially Reserved", "For QA", "For Stock-in", "High"],
  destructive: ["Rejected", "Cancelled", "Canceled", "QaFailed", "Non-Conforming", "Out of Stock", "Expired", "Failed", "No", "Critical", "Shortage"],
  info: ["Submitted", "InReview", "Received", "PartiallyReceived", "In Production", "In Progress", "In Transit", "Arrived", "Pending Dispatch", "Dispatched"],
  purple: ["Draft", "Closed", "Inactive", "Disabled", "Simulated", "Scheduled", "Consumed", "Disposed", "Reserved", "None", "Preferred"],
  orange: ["Returned"],
  teal: ["Credited"],
  indigo: ["Converted", "Converted to PO"],
} as const;

function normalizeStatus(status: string) {
  return status.toLowerCase().replace(/[\s_-]/g, "");
}

for (const [variant, statuses] of Object.entries(STATUS_GROUPS)) {
  for (const status of statuses) {
    STATUS_VARIANTS[normalizeStatus(status)] = variant as NonNullable<BadgeProps["variant"]>;
  }
}

interface StatusBadgeProps {
  status: string;
  className?: string;
  children?: React.ReactNode;
}

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  const variant = STATUS_VARIANTS[normalizeStatus(status)] ?? "purple";
  const displayStatus = normalizeStatus(status) === "qacompleted"
    ? "Completed"
    : status.replace(/([a-z])([A-Z])/g, "$1 $2");

  return <Badge variant={variant} className={className}>{children ?? displayStatus}</Badge>;
}

export default StatusBadge;
