"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { PRTab } from "@/components/orders-procurement/pr/PRTab";
import { CreatePRForm } from "@/components/orders-procurement/pr/CreatePRForm";
import { PRDetailsView } from "@/components/orders-procurement/pr/PRDetailsModal";
import { PRActionModal, type PRActionType } from "@/components/orders-procurement/pr/PRActionModal";
import { POTab } from "@/components/orders-procurement/po/POTab";
import { CreatePOForm } from "@/components/orders-procurement/po/CreatePOModal";
import { DeliveryTab } from "@/components/orders-procurement/delivery/DeliveryTab";
import { CreateDeliveryForm } from "@/components/orders-procurement/delivery/CreateDeliveryModal";
import { DeliveryDetailsView } from "@/components/orders-procurement/delivery/DeliveryDetailsModal";
import { MarkArrivedView } from "@/components/orders-procurement/delivery/MarkArrivedModal";
import { CancelDeliveryModal } from "@/components/orders-procurement/delivery/CancelDeliveryModal";
import { procurement } from "@/lib/orders/client";
import { useStaff } from "@/context/StaffContext";
import { isAdminStaff } from "@/lib/auth-roles";

import type { PurchaseRequisition, PurchaseOrderPO, Delivery } from "@/components/orders-procurement/types";

export default function OrdersProcurementPage({
  data,
}: {
  data: { requisitions: PurchaseRequisition[]; orders: PurchaseOrderPO[]; deliveries: Delivery[] };
}) {
  const router = useRouter();
  const staff = useStaff();
  const isAdmin = isAdminStaff(staff);
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

  // Full-page Delivery states
  const [showCreateDelivery, setShowCreateDelivery] = useState(false);
  const [viewingDeliveryId, setViewingDeliveryId] = useState<number | null>(null);
  const [arrivingDeliveryState, setArrivingDeliveryState] = useState<{
    deliveryId: number;
    returnToDetails: boolean;
  } | null>(null);
  const [cancellingDelivery, setCancellingDelivery] = useState<Delivery | null>(null);

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
    toast.success("Status updated successfully.");
    setViewingPrId(null);
    router.refresh();
  };

  const resolvePoTotalAmount = (delivery: Delivery | null): number | null => {
    if (!delivery) return null;
    const matched = data.orders.find(
      (o) =>
        (delivery.poId && o.poId === delivery.poId) ||
        (delivery.poNumber && o.poNumber === delivery.poNumber)
    );
    return matched ? Number(matched.totalAmount ?? 0) : null;
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
          onCancel={(pr) => setPrActionModal({ pr, type: "cancel" })}
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
            toast.success("Purchase requisition saved successfully.");
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
              toast.info(`${poNumber} was not sent. You can create and send it again.`);
            }
          }}
          onSuccess={(created) => {
            setShowCreatePO(false);
            setCreatePOFromPR(undefined);
            toast.success(
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

  // Full-page Create Delivery Order view
  if (showCreateDelivery) {
    return (
      <div className="page-container px-4 sm:px-8 w-full min-h-full animate-page-in">
        <CreateDeliveryForm
          embedded
          onClose={() => setShowCreateDelivery(false)}
          onSuccess={() => {
            setShowCreateDelivery(false);
            toast.success("Delivery order scheduled successfully.");
            router.refresh();
          }}
        />
      </div>
    );
  }

  // Full-page Confirm Delivery Arrival view
  const arrivingDelivery = arrivingDeliveryState
    ? data.deliveries.find((d) => d.deliveryId === arrivingDeliveryState.deliveryId) ?? null
    : null;

  if (arrivingDelivery && arrivingDeliveryState) {
    return (
      <div className="page-container px-4 sm:px-8 w-full min-h-full animate-page-in">
        <MarkArrivedView
          embedded
          delivery={arrivingDelivery}
          poTotalAmount={resolvePoTotalAmount(arrivingDelivery)}
          backLabel={
            arrivingDeliveryState.returnToDetails
              ? arrivingDelivery.deliveryNumber
              : "Delivery shipments"
          }
          onClose={() => {
            if (arrivingDeliveryState.returnToDetails) {
              setViewingDeliveryId(arrivingDelivery.deliveryId);
            }
            setArrivingDeliveryState(null);
          }}
          onSuccess={() => {
            setArrivingDeliveryState(null);
            setViewingDeliveryId(null);
            toast.success("Delivery arrival confirmed successfully.");
            router.refresh();
          }}
        />
      </div>
    );
  }

  // Full-page Delivery Order Details view
  const viewingDelivery = viewingDeliveryId
    ? data.deliveries.find((d) => d.deliveryId === viewingDeliveryId) ?? null
    : null;

  if (viewingDelivery) {
    return (
      <div className="page-container px-4 sm:px-8 w-full min-h-full animate-page-in">
        <DeliveryDetailsView
          embedded
          delivery={viewingDelivery}
          isAdmin={isAdmin}
          poTotalAmount={resolvePoTotalAmount(viewingDelivery)}
          onClose={() => setViewingDeliveryId(null)}
          onArrive={(d) => {
            setViewingDeliveryId(null);
            setArrivingDeliveryState({ deliveryId: d.deliveryId, returnToDetails: true });
          }}
          onCancel={(d) => {
            setCancellingDelivery(d);
          }}
          onGrnCreated={() => {
            setViewingDeliveryId(null);
            router.refresh();
          }}
        />

        {cancellingDelivery && (
          <CancelDeliveryModal
            delivery={cancellingDelivery}
            onClose={() => setCancellingDelivery(null)}
            onSuccess={() => {
              setCancellingDelivery(null);
              setViewingDeliveryId(null);
              toast.success("Delivery order cancelled successfully.");
              router.refresh();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
      {/* Page Header */}
      <PageHeader
        title="Orders & Procurement"
        description="End-to-end procurement lifecycle: requisition requests, purchase orders, and delivery management."
      />

      {/* 3 Main Process Tabs */}
      <div className="border-b border-divider">
        <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setMainTab("pr")}
            className={`flex items-center gap-2 px-4 py-2.5 type-label-tab font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
              mainTab === "pr"
                ? "border-primary text-primary"
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
                ? "border-primary text-primary"
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
                ? "border-primary text-primary"
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
      {mainTab === "delivery" && (
        <DeliveryTab
          initialDeliveries={data.deliveries}
          orders={data.orders}
          onCreateDelivery={() => setShowCreateDelivery(true)}
          onViewDelivery={(d) => setViewingDeliveryId(d.deliveryId)}
          onArriveDelivery={(d) =>
            setArrivingDeliveryState({ deliveryId: d.deliveryId, returnToDetails: false })
          }
        />
      )}
    </div>
  );
}
