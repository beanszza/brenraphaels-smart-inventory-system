"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { actionResponse } from "@/lib/resources/action-response";
import {
  reviewBranchRequest,
  retryBranchRequestPosSync,
} from "@/app/actions/stock-transfer/branch-requests";
import { useIsAdmin, useIsImsManager } from "@/context/StaffContext";
import type { BranchRequestsScreen } from "@/lib/stock-transfer/screen-data";
import type { BranchStockRequest } from "./types";
import { BranchRequestsTab } from "./BranchRequestsTab";
import {
  BranchRequestActionModal,
  type BranchRequestActionType,
} from "./BranchRequestActionModal";
import { BranchRequestDetailsModal } from "./BranchRequestDetailsModal";

export default function BranchRequestsModule({ branchRequests }: BranchRequestsScreen) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isImsManager = useIsImsManager();
  const canOperate = !isAdmin;
  const canReview = isAdmin || isImsManager || canOperate;
  const [loading, startTransition] = useTransition();
  const refreshAll = () => startTransition(() => router.refresh());

  const [selectedBranchReq, setSelectedBranchReq] = useState<BranchStockRequest | null>(null);
  const [branchReqAction, setBranchReqAction] = useState<{
    request: BranchStockRequest;
    type: BranchRequestActionType;
  } | null>(null);

  const pendingCount = useMemo(
    () => branchRequests.filter((r) => r.subtab === "requests").length,
    [branchRequests]
  );

  const handleActionConfirm = async (payload: { approvedQuantity?: number; remarks?: string }) => {
    if (!branchReqAction) return;
    const { request, type } = branchReqAction;
    const res = await actionResponse(
      reviewBranchRequest(request.branchRequestId, {
        action: type === "approve" ? "Approve" : "Reject",
        approvedQuantity: payload.approvedQuantity,
        remarks: payload.remarks,
      })
    );
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Unable to update branch stock request.");
    }
    toast.success(
      res.data?.message ||
        (type === "approve"
          ? `Approved ${request.requestNumber} and notified POS.`
          : `Rejected ${request.requestNumber} and notified POS.`)
    );
    refreshAll();
  };

  const handleRetrySync = async (req: BranchStockRequest) => {
    startTransition(async () => {
      try {
        const res = await actionResponse(retryBranchRequestPosSync(req.branchRequestId));
        if (!res.data?.success) {
          toast.error(res.data?.message || "Unable to sync decision to POS.");
          return;
        }
        toast.success(res.data?.message || `Synced ${req.requestNumber} to POS.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to sync decision to POS.");
      }
    });
  };

  const handleTransferNow = (req: BranchStockRequest) => {
    if (req.totalRemaining <= 0) {
      toast.error("No remaining approved quantity available to transfer.");
      return;
    }
    startTransition(() => {
      router.push(`/stock-transfer?branchRequestId=${req.branchRequestId}`);
    });
  };

  return (
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
      <PageHeader
        title="Branch Stock Requests"
        description={
          pendingCount > 0
            ? `Incoming stock replenishment requests from POS branches · ${pendingCount} waiting for review`
            : "Incoming stock replenishment requests from POS branches"
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={loading}
            className="h-9 px-3.5 py-2 rounded-control gap-1.5 bg-surface border border-border type-button text-ink hover:bg-subtle shadow-none cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        }
      />

      <BranchRequestsTab
        branchRequests={branchRequests}
        loading={loading}
        canReview={canReview}
        canTransfer={canOperate}
        onView={(req) => setSelectedBranchReq(req)}
        onApprove={(req) => setBranchReqAction({ request: req, type: "approve" })}
        onReject={(req) => setBranchReqAction({ request: req, type: "reject" })}
        onTransferNow={handleTransferNow}
        onRetrySync={handleRetrySync}
      />

      <BranchRequestDetailsModal
        request={selectedBranchReq}
        open={Boolean(selectedBranchReq)}
        canReview={canReview}
        canTransfer={canOperate}
        onClose={() => setSelectedBranchReq(null)}
        onApprove={(req) => setBranchReqAction({ request: req, type: "approve" })}
        onReject={(req) => setBranchReqAction({ request: req, type: "reject" })}
        onTransferNow={handleTransferNow}
        onRetrySync={handleRetrySync}
      />

      {branchReqAction && (
        <BranchRequestActionModal
          actionType={branchReqAction.type}
          request={branchReqAction.request}
          onConfirm={handleActionConfirm}
          onClose={() => setBranchReqAction(null)}
        />
      )}
    </div>
  );
}
