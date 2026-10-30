"use client";
import { createIssuance } from "@/app/actions/production/issuances";

import React, { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ProductionTab } from "@/lib/production/screen-data";
// The action boundary preserves the existing serializable production DTOs.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useStaff, useIsAdmin, useIsImsManager, useIsHeadCook, useIsQa } from "@/context/StaffContext";
import { PageHeader } from "@/components/shared/PageHeader";
import ProductionRequestsTab from "@/components/production/ProductionRequestsTab";
import MaterialIssuanceTab from "@/components/production/MaterialIssuanceTab";
import ProductionTrackingTab from "@/components/production/ProductionTrackingTab";
import ProductionQaTab from "@/components/production/ProductionQaTab";
import ProductionStockInTab from "@/components/production/ProductionStockInTab";
import ConfigurationTab from "@/components/production/ConfigurationTab";
import LossTab from "@/components/production/LossTab";
import { ProductionSkeleton } from "@/components/production/ProductionSkeleton";

const TABS = [
  { key: "requests", label: "Production Requests" },
  { key: "issuance", label: "Material Issuance" },
  { key: "tracking", label: "Production Tracking" },
  { key: "qa", label: "Quality Assurance" },
  { key: "stockin", label: "Stock-In" },
  { key: "configuration", label: "Configuration" },
  { key: "loss", label: "Loss" },
];

export default function ProductionPage({ activeTab, initialRows, initialItems, initialBatchId, initialIssuanceId }: {
  activeTab: ProductionTab; initialRows: any[]; initialItems: any[];
  initialBatchId: number | null; initialIssuanceId: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = (href: string) => startTransition(() => router.push(href));
  const staff = useStaff();
  const isAdmin = useIsAdmin();
  const isIms = useIsImsManager();
  const isCook = useIsHeadCook();
  const isQa = useIsQa();

  // Role-based tab visibility
  const allowedTabs = React.useMemo(() => {
    if (isAdmin) {
      return TABS; // Admin can view all tabs
    }
    if (isQa) {
      return TABS.filter((t) => t.key === "qa");
    }
    if (isCook) {
      return TABS.filter((t) => ["requests", "tracking"].includes(t.key));
    }
    if (isIms) {
      return TABS.filter((t) => ["requests", "issuance", "stockin", "configuration", "loss"].includes(t.key));
    }
    return TABS;
  }, [isAdmin, isQa, isCook, isIms]);

  // Gracefully redirect if current activeTab is not in user's allowed tabs
  React.useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some((t) => t.key === activeTab)) {
      navigate(`/production-quality?tab=${allowedTabs[0].key}`);
    }
  }, [allowedTabs, activeTab]);

  // Navigate from Production Requests -> Material Issuance
  const handleNavigateToIssuance = async (prodReqId?: number) => {
    if (prodReqId) {
      try {
        const data = await createIssuance({ prodReqId });
        if (data?.success && data?.data) {
          navigate(`/production-quality?tab=issuance&issuance=${data.data.issuanceId}`);
          return;
        } else {
          toast.error(data?.message || "Failed to open material issuance.");
          return;
        }
      } catch (err) {
        console.error("Failed to auto-open issuance session:", err);
        toast.error("Failed to open material issuance.");
        return;
      }
    }
    navigate("/production-quality?tab=issuance");
  };

  // Navigate from Production Requests (Start Batch) -> Production Tracking
  const handleStartBatchAndTrack = (batchId: number) => {
    navigate(`/production-quality?tab=tracking&batch=${batchId}`);
  };

  return (
    <div className="w-full min-h-full py-6 px-4 sm:px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Production & Quality"
        description="End-to-end production management, material lot reservations, sequential stage tracking, and quality assurance."
      />

      {/* Main Tab Bar matching Resources & Suppliers styling */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          {allowedTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/production-quality?tab=${tab.key}`}
                onClick={(event) => { event.preventDefault(); navigate(`/production-quality?tab=${tab.key}`); }}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label.toUpperCase()}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {pending ? <ProductionSkeleton /> : <>
      {activeTab === "requests" && (
        <ProductionRequestsTab initialRows={initialRows}
          onNavigateToIssuance={handleNavigateToIssuance}
          onStartBatchAndTrack={handleStartBatchAndTrack}
          currentUser={staff.username}
        />
      )}

      {activeTab === "issuance" && (
        <MaterialIssuanceTab initialRows={initialRows} initialIssuanceId={initialIssuanceId} />
      )}

      {activeTab === "tracking" && (
        <ProductionTrackingTab initialRows={initialRows}
          initialBatchId={initialBatchId}
          onNavigateToBatches={() => router.push("/production-quality")}
          currentUser={staff.username}
        />
      )}

      {activeTab === "qa" && <ProductionQaTab initialRows={initialRows} currentUser={staff.username} />}

      {activeTab === "stockin" && (
        <ProductionStockInTab initialRows={initialRows} initialItems={initialItems} currentUser={staff.username} />
      )}

      {activeTab === "configuration" && <ConfigurationTab initialRows={initialRows} />}

      {activeTab === "loss" && <LossTab initialRows={initialRows} />}
      </>}
    </div>
  );
}
