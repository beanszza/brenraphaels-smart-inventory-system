"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PRTab } from "@/components/orders-procurement/pr/PRTab";
import { POTab } from "@/components/orders-procurement/po/POTab";
import { CreatePOModal } from "@/components/orders-procurement/po/CreatePOModal";
import { DeliveryTab } from "@/components/orders-procurement/delivery/DeliveryTab";

import type { PurchaseRequisition, PurchaseOrderPO, Delivery } from "@/components/orders-procurement/types";

export default function OrdersProcurementPage({ data }: { data: { requisitions: PurchaseRequisition[]; orders: PurchaseOrderPO[]; deliveries: Delivery[] } }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [mainTab, setMainTab] = useState<"pr" | "po" | "delivery">("pr");

  // Cross-tab PO creation — triggered from PR details "Create PO" button
  const [createPOFromPR, setCreatePOFromPR] = useState<number | undefined>(undefined);
  const [showCreatePO, setShowCreatePO] = useState(false);

  const handleCreatePoFromPR = (prId: number) => {
    setCreatePOFromPR(prId);
    setShowCreatePO(true);
    setMainTab("po");
  };

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
      {mainTab === "pr" && <PRTab initialRequisitions={data.requisitions} onCreatePo={handleCreatePoFromPR} />}

      {/* MAIN TAB 2: PRODUCT ORDER (new PO approval workflow) */}
      {mainTab === "po" && <POTab initialOrders={data.orders} />}

      {/* MAIN TAB 3: DELIVERY */}
      {mainTab === "delivery" && <DeliveryTab initialDeliveries={data.deliveries} />}

      {/* Global CreatePO Modal — opened from PR details "Create PO" button */}
      {showCreatePO && (
        <CreatePOModal
          open={showCreatePO}
          initialPrId={createPOFromPR}
          onClose={() => { setShowCreatePO(false); setCreatePOFromPR(undefined); }}
          onSuccess={() => { setShowCreatePO(false); setCreatePOFromPR(undefined); setNotice("Purchase order saved successfully."); router.refresh(); }}
        />
      )}
    </div>
  );
}