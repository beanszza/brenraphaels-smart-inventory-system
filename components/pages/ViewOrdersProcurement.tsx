"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PRTab } from "@/components/orders-procurement/pr/PRTab";
import { CreatePRForm } from "@/components/orders-procurement/pr/CreatePRForm";
import { PRDetailsView } from "@/components/orders-procurement/pr/PRDetailsModal";
import { PRActionModal, type PRActionType } from "@/components/orders-procurement/pr/PRActionModal";
import { POTab } from "@/components/orders-procurement/po/POTab";
import { CreatePOForm } from "@/components/orders-procurement/po/CreatePOModal";
import { DeliveryTab } from "@/components/orders-procurement/delivery/DeliveryTab";
import { procurement } from "@/lib/orders/client";
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";

import type { PurchaseRequisition, PurchaseOrderPO, Delivery } from "@/components/orders-procurement/types";

export default function OrdersProcurementPage({ data }: { data: { requisitions: PurchaseRequisition[]; orders: PurchaseOrderPO[]; deliveries: Delivery[] } }) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);
  const [notice, setNotice] = useState("");
  const [mainTab, setMainTab] = useState<"pr" | "po" | "delivery">("pr");

  // Full-page Purchase Requisition form state (create / edit / prefill)
  const [prFormState, setPrFormState] = useState<{
    isEdit: boolean;
    initialData?: PurchaseRequisition;
  } | null>(null);

  // Full-page Purchase Requisition view state (all PR sub-tabs)
  const [viewingPrId, setViewingPrId] = useState<number | null>(null);
  const [prActionModal, setPrActionModal] = useState<{
    pr: PurchaseRequisition;
    type: PRActionType;
  } | null>(null);

  // Check for prefilled PR data from Inventory "Order Now" or Production Shortfall
  useEffect(() => {
    const rawPrefill = sessionStorage.getItem("prefill_pr");
    if (rawPrefill) {
      try {
        const parsed = JSON.parse(rawPrefill);
        sessionStorage.removeItem("prefill_pr");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMainTab("pr");
        setPrFormState({ isEdit: false, initialData: parsed as PurchaseRequisition });
      } catch (e) {
        console.error("Failed to parse prefill_pr:", e);
      }
    }
  }, []);

  // Cross-tab PO creation — triggered from PR details "Create PO" button
  const [createPOFromPR, setCreatePOFromPR] = useState<number | undefined>(undefined);
  const [showCreatePO, setShowCreatePO] = useState(false);

  const handleCreatePoFromPR = (prId: number) => {
    setViewingPrId(null);
    setCreatePOFromPR(prId);
    setShowCreatePO(true);
    setMainTab("po");
  };

  const handlePrStatusUpdate = async (prId: number, status: string, notes?: string) => {
    await procurement.setRequisitionStatus(prId, {
      status,
      adminNotes: notes || null,
    });
    setNotice("Status updated successfully.");
    setViewingPrId(null);
    router.refresh();
  };

  const viewingPR = viewingPrId
    ? data.requisitions.find((r) => r.prId === viewingPrId) ?? null
    : null;

  if (viewingPR) {
    return (
      <div className="page-container px-4 sm:px-8 w-full min-h-full animate-page-in">
        <PRDetailsView
          embedded
          pr={viewingPR}
          isAdmin={isAdmin}
          onClose={() => setViewingPrId(null)}
          onApprove={(pr) => setPrActionModal({ pr, type: "approve" })}
          onReject={(pr) => setPrActionModal({ pr, type: "reject" })}
          onReturn={(pr) => setPrActionModal({ pr, type: "return" })}
          onCreatePo={(pr) => handleCreatePoFromPR(pr.prId)}
        />

        {prActionModal && (
          <PRActionModal
            actionType={prActionModal.type}
            prNumber={prActionModal.pr.prNumber}
            onClose={() => setPrActionModal(null)}
            onConfirm={async (notes) => {
              const { pr, type } = prActionModal;
              if (type === "approve") {
                await handlePrStatusUpdate(pr.prId, "Approved", notes);
              } else if (type === "reject") {
                await handlePrStatusUpdate(pr.prId, "Rejected", notes);
              } else if (type === "return") {
                await handlePrStatusUpdate(pr.prId, "Returned", notes);
              } else if (type === "cancel") {
                await handlePrStatusUpdate(pr.prId, "Cancelled", notes);
              }
            }}
          />
        )}
      </div>
    );
  }

  if (prFormState) {
    return (
      <div className="page-container px-4 sm:px-8 w-full min-h-full animate-page-in">
        <CreatePRForm
          key={prFormState.initialData?.prId ?? "new"}
          embedded
          isEdit={prFormState.isEdit}
          initialData={prFormState.initialData}
          onClose={() => setPrFormState(null)}
          onSuccess={() => {
            setPrFormState(null);
            setNotice("Purchase requisition saved successfully.");
            router.refresh();
          }}
        />
      </div>
    );
  }

  if (showCreatePO) {
    return (
      <div className="page-container px-4 sm:px-8 w-full min-h-full animate-page-in">
        <CreatePOForm
          embedded
          initialPrId={createPOFromPR}
          onClose={() => {
            setShowCreatePO(false);
            setCreatePOFromPR(undefined);
          }}
          onDraftDiscarded={(poNumber) => {
            setShowCreatePO(false);
            setCreatePOFromPR(undefined);
            router.refresh();
            if (poNumber) {
              setNotice(`${poNumber} was not sent. You can create and send it again.`);
            }
          }}
          onSuccess={(created) => {
            setShowCreatePO(false);
            setCreatePOFromPR(undefined);
            setNotice(
              created?.poNumber
                ? `${created.poNumber} marked as sent — awaiting supplier confirmation.`
                : "Purchase order saved successfully."
            );
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
      {notice && <p role="status" className="type-body text-primary">{notice}</p>}
      {/* Page Header */}
      <PageHeader
        title="Orders & Procurement"
        description="End-to-end procurement lifecycle: requisition requests, purchase orders, and delivery management."
      />

      {/* 3 Main Process Tabs */}
      <div className="border-b border-divider">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMainTab("pr")}
            className={`flex items-center gap-2 px-4 py-2.5 type-label-tab font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
              mainTab === "pr"
                ? "border-primary text-primary -mb-px"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span>PURCHASE REQUISITION</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab("po")}
            className={`flex items-center gap-2 px-4 py-2.5 type-label-tab font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
              mainTab === "po"
                ? "border-primary text-primary -mb-px"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span>PURCHASE ORDER</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab("delivery")}
            className={`flex items-center gap-2 px-4 py-2.5 type-label-tab font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
              mainTab === "delivery"
                ? "border-primary text-primary -mb-px"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span>DELIVERY</span>
          </button>
        </div>
      </div>

      {/* MAIN TAB 1: PRODUCT REQUISITION */}
      {mainTab === "pr" && (
        <PRTab
          initialRequisitions={data.requisitions}
          onCreatePo={handleCreatePoFromPR}
          onCreateNew={() => setPrFormState({ isEdit: false })}
          onEditPr={(pr) => setPrFormState({ isEdit: true, initialData: pr })}
          onViewPr={(pr) => setViewingPrId(pr.prId)}
        />
      )}

      {/* MAIN TAB 2: PRODUCT ORDER (new PO approval workflow) */}
      {mainTab === "po" && <POTab initialOrders={data.orders} />}

      {/* MAIN TAB 3: DELIVERY */}
      {mainTab === "delivery" && <DeliveryTab initialDeliveries={data.deliveries} />}
    </div>
  );
}
