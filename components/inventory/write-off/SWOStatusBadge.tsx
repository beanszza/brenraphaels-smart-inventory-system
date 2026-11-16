"use client";

import React from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { SwoStatus } from "./types";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  PackageMinus,
} from "lucide-react";

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
        <StatusBadge status="Pending Approval" className={`gap-1.5 ${className}`}>
          <Clock className="w-3.5 h-3.5" />
          Pending Approval
        </StatusBadge>
      );
    case "Approved":
      return (
        <StatusBadge status="Approved" className={`gap-1.5 ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Approved
        </StatusBadge>
      );
    case "Removed":
      return (
        <StatusBadge status="Removed" className={`gap-1.5 ${className}`}>
          <PackageMinus className="w-3.5 h-3.5" />
          Removed
        </StatusBadge>
      );
    case "Rejected":
      return (
        <StatusBadge status="Rejected" className={`gap-1.5 ${className}`}>
          <XCircle className="w-3.5 h-3.5" />
          Rejected
        </StatusBadge>
      );
    case "Cancelled":
      return (
        <StatusBadge status="Cancelled" className={`gap-1.5 ${className}`}>
          <Ban className="w-3.5 h-3.5" />
          Cancelled
        </StatusBadge>
      );
    default:
      return (
        <StatusBadge status={norm} className={`gap-1.5 ${className}`}>
          {status}
        </StatusBadge>
      );
  }
}
