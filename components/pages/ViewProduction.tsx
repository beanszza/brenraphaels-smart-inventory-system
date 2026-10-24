"use client";
import { createIssuance } from "@/app/actions/production/issuances";

import React, { useState } from "react";
import { useStaff } from "@/context/StaffContext";
import { PageHeader } from "@/components/shared/PageHeader";
import ProductionRequestsTab from "@/components/production/ProductionRequestsTab";
import MaterialIssuanceTab from "@/components/production/MaterialIssuanceTab";
import ProductionTrackingTab from "@/components/production/ProductionTrackingTab";
import ProductionQaTab from "@/components/production/ProductionQaTab";
import ProductionStockInTab from "@/components/production/ProductionStockInTab";
import ConfigurationTab from "@/components/production/ConfigurationTab";
import LossTab from "@/components/production/LossTab";

const TABS = [
  { key: "requests", label: "Production Requests" },
  { key: "issuance", label: "Material Issuance" },
  { key: "tracking", label: "Production Tracking" },
  { key: "qa", label: "Quality Assurance" },
  { key: "stockin", label: "Stock-In" },
  { key: "configuration", label: "Configuration" },
  { key: "loss", label: "Loss" },
];

export default function ProductionPage() {
  const staff = useStaff();
  const [activeTab, setActiveTab] = useState<string>("requests");

  // Cross-tab state
  const [targetIssuanceId, setTargetIssuanceId] = useState<number | null>(null);
  const [trackingBatchId, setTrackingBatchId] = useState<number | null>(null);

  // Navigate from Production Requests -> Material Issuance
  const handleNavigateToIssuance = async (prodReqId?: number) => {
    if (prodReqId) {
      try {
        const data = await createIssuance({ prodReqId });
        if (data?.success && data?.data) {
          setTargetIssuanceId(data.data.issuanceId);
        }
      } catch (err) {
        console.error("Failed to auto-open issuance session:", err);
      }
    }
    setActiveTab("issuance");
  };

  // Navigate from Production Requests (Start Batch) -> Production Tracking
  const handleStartBatchAndTrack = (batchId: number) => {
    setTrackingBatchId(batchId);
    setActiveTab("tracking");
  };

  return (
    <div className="w-full min-h-full py-8 px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Production & Quality"
        description="End-to-end production management, material lot reservations, sequential stage tracking, and quality assurance."
      />

      {/* Main Tab Bar matching Resources & Suppliers styling */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "requests" && (
        <ProductionRequestsTab
          onNavigateToIssuance={handleNavigateToIssuance}
          onStartBatchAndTrack={handleStartBatchAndTrack}
          currentUser={staff.username}
        />
      )}

      {activeTab === "issuance" && (
        <MaterialIssuanceTab initialIssuanceId={targetIssuanceId} />
      )}

      {activeTab === "tracking" && (
        <ProductionTrackingTab
          initialBatchId={trackingBatchId}
          onNavigateToBatches={() => setActiveTab("requests")}
          currentUser={staff.username}
        />
      )}

      {activeTab === "qa" && <ProductionQaTab currentUser={staff.name} />}

      {activeTab === "stockin" && (
        <ProductionStockInTab currentUser={staff.username} />
      )}

      {activeTab === "configuration" && <ConfigurationTab />}

      {activeTab === "loss" && <LossTab />}
    </div>
  );
}
