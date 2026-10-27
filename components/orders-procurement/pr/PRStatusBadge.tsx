"use client";

import React from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PRStatus } from "../types";
import { 
  FileEdit, 
  Clock, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  ArrowRightCircle, 
  Ban, 
  Lock 
} from "lucide-react";

interface PRStatusBadgeProps {
  status: PRStatus | string;
  className?: string;
}

export function PRStatusBadge({ status, className = "" }: PRStatusBadgeProps) {
  const norm = status?.trim() || "Draft";

  switch (norm) {
    case "Draft":
      return (
        <StatusBadge status={norm} className={`gap-1.5 ${className}`}>
          <FileEdit className="w-3.5 h-3.5" />
          Draft
        </StatusBadge>
      );
    case "Pending Approval":
    case "Pending":
      return (
        <StatusBadge status={norm} className={`gap-1.5 ${className}`}>
          <Clock className="w-3.5 h-3.5" />
          Pending Approval
        </StatusBadge>
      );
    case "Returned":
      return (
        <StatusBadge status={norm} className={`gap-1.5 ${className}`}>
          <RotateCcw className="w-3.5 h-3.5" />
          Returned
        </StatusBadge>
      );
    case "Approved":
      return (
        <StatusBadge status={norm} className={`gap-1.5 ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Approved
        </StatusBadge>
      );
    case "Rejected":
      return (
        <StatusBadge status={norm} className={`gap-1.5 ${className}`}>
          <XCircle className="w-3.5 h-3.5" />
          Rejected
        </StatusBadge>
      );
    case "Converted to PO":
    case "Converted":
      return (
        <StatusBadge status={norm} className={`gap-1.5 ${className}`}>
          <ArrowRightCircle className="w-3.5 h-3.5" />
          Converted to Purchase Order
        </StatusBadge>
      );
    case "Cancelled":
      return (
        <StatusBadge status={norm} className={`gap-1.5 ${className}`}>
          <Ban className="w-3.5 h-3.5" />
          Cancelled
        </StatusBadge>
      );
    case "Closed":
      return (
        <StatusBadge status={norm} className={`gap-1.5 ${className}`}>
          <Lock className="w-3.5 h-3.5" />
          Closed
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
