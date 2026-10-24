"use client";

import { getReceivingCounts } from "@/app/actions/receiving/lookups";

import { actionResponse } from "@/lib/resources/action-response";

import React, { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import GrnTab from "@/components/receiving/GrnTab";
import DiscrepancyTab from "@/components/receiving/DiscrepancyTab";
import StockInTab from "@/components/receiving/StockInTab";
import RtvTab from "@/components/receiving/RtvTab";
import LossReportTab from "@/components/receiving/LossReportTab";

type MainTabId = "grn" | "discrepancies" | "stockin" | "rtv" | "loss";

type Counts = { grn: number; discrepancies: number; stockin: number; rtv: number; loss: number };

export default function ViewGoodsReceiving({ initialCounts }: { initialCounts: Counts }) {
  const [activeTab, setActiveTab] = useState<MainTabId>("grn");
  const [counts, setCounts] = useState(initialCounts);

  const loadTabCounts = async () => {
    try {
      const { data } = await actionResponse(getReceivingCounts());
      setCounts(data.data);
    } catch (error) { console.error("Failed to refresh receiving counts", error); }
  };

  const tabs: { id: MainTabId; label: string; badgeCount?: number }[] = [
    { id: "grn", label: "GOODS RECEIPT NOTE / RECEIVE", badgeCount: counts.grn },
    { id: "discrepancies", label: "DISCREPANCIES", badgeCount: counts.discrepancies },
    { id: "stockin", label: "STOCK IN", badgeCount: counts.stockin },
    { id: "rtv", label: "SUPPLIER RETURNS", badgeCount: counts.rtv },
    { id: "loss", label: "LOSS / DISPOSAL", badgeCount: counts.loss },
  ];

  return (
    <div className="w-full min-h-full py-8 px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Goods Receiving & Inbound Logistics"
        description="End-to-end receipt verification: Purchase Order physical counts & Quality Assurance inspection, automated discrepancy logging, and stock-in approval into inventory."
      />

      {/* Process Tabs */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Content */}
      <div>
        {activeTab === "grn" && (
          <GrnTab
            onPosted={() => {
              setActiveTab("stockin");
              loadTabCounts();
            }}
          />
        )}
        {activeTab === "discrepancies" && <DiscrepancyTab />}
        {activeTab === "stockin" && <StockInTab />}
        {activeTab === "rtv" && <RtvTab />}
        {activeTab === "loss" && <LossReportTab />}
      </div>
    </div>
  );
}
