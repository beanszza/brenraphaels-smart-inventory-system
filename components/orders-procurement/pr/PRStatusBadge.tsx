"use client";

import React from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PRStatus } from "../types";

interface PRStatusBadgeProps {
  status: PRStatus | string;
  className?: string;
}

export function PRStatusBadge({ status, className = "" }: PRStatusBadgeProps) {
  const norm = status?.trim() || "Draft";

  switch (norm) {
    case "Draft":
      return (
        <StatusBadge status={norm} className={className}>
          Draft
        </StatusBadge>
      );
    case "Pending Approval":
    case "Pending":
      return (
        <StatusBadge status={norm} className={className}>
          Pending Approval
        </StatusBadge>
      );
    case "Returned":
      return (
        <StatusBadge status={norm} className={className}>
          Returned
        </StatusBadge>
      );
    case "Approved":
      return (
        <StatusBadge status={norm} className={className}>
          Approved
        </StatusBadge>
      );
    case "Rejected":
      return (
        <StatusBadge status={norm} className={className}>
          Rejected
        </StatusBadge>
      );
    case "Converted to PO":
    case "Converted":
      return (
        <StatusBadge status={norm} className={className}>
          Converted to Purchase Order
        </StatusBadge>
      );
    case "Cancelled":
      return (
        <StatusBadge status={norm} className={className}>
          Cancelled
        </StatusBadge>
      );
    case "Closed":
      return (
        <StatusBadge status={norm} className={className}>
          Closed
        </StatusBadge>
      );
    default:
      return (
        <StatusBadge status={norm} className={className}>
          {status}
        </StatusBadge>
      );
  }
}
