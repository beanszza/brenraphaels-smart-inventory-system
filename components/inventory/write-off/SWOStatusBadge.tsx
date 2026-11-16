"use client";

import React from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { SwoStatus } from "./types";

interface SWOStatusBadgeProps {
  status: SwoStatus | string;
  className?: string;
}

export function SWOStatusBadge({ status, className = "" }: SWOStatusBadgeProps) {
  const norm = status?.trim() || "Pending Approval";

  switch (norm) {
    case "Pending Approval":
    case "Pending":
      return (
        <StatusBadge status="Pending Approval" className={className}>
          Pending Approval
        </StatusBadge>
      );
    case "Approved":
      return (
        <StatusBadge status="Approved" className={className}>
          Approved
        </StatusBadge>
      );
    case "Removed":
      return (
        <StatusBadge status="Removed" className={className}>
          Removed
        </StatusBadge>
      );
    case "Rejected":
      return (
        <StatusBadge status="Rejected" className={className}>
          Rejected
        </StatusBadge>
      );
    case "Cancelled":
      return (
        <StatusBadge status="Cancelled" className={className}>
          Cancelled
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
