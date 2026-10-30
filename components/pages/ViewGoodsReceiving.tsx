"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { PageHeader } from "@/components/shared/PageHeader";

export type ReceivingTab = "grn" | "discrepancies" | "stockin" | "rtv" | "loss";
export type ReceivingCounts = Record<ReceivingTab, number>;
export const RECEIVING_TABS = [
  ["grn", "Goods receipt notes / Receive"],
  ["discrepancies", "Discrepancies"],
  ["stockin", "Stock in"],
  ["rtv", "Supplier returns"],
  ["loss", "Loss / Disposal"],
] as const;

interface ViewGoodsReceivingProps {
  counts?: ReceivingCounts;
  activeTab: ReceivingTab;
  children?: ReactNode;
  panels?: Record<ReceivingTab, ReactNode>;
}

export default function ViewGoodsReceiving({
  activeTab: initialTab,
  children,
  panels,
}: ViewGoodsReceivingProps) {
  const [currentTab, setCurrentTab] = useState<ReceivingTab>(initialTab);

  useEffect(() => {
    setCurrentTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const onSwitchTab = (e: Event) => {
      const detail = (e as CustomEvent<ReceivingTab>).detail;
      if (detail) {
        setCurrentTab(detail);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("tab", detail);
          window.history.replaceState(null, "", url.toString());
        }
      }
    };
    window.addEventListener("receiving:switch-tab", onSwitchTab);
    return () => window.removeEventListener("receiving:switch-tab", onSwitchTab);
  }, []);

  const handleSelectTab = (id: ReceivingTab) => {
    setCurrentTab(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(null, "", url.toString());
    }
  };

  return (
    <div className="w-full min-h-full py-7 px-4 sm:px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Goods Receiving & Inbound Logistics"
        description="Receive deliveries, verify quantities, resolve discrepancies and commit stock into inventory."
      />
      <nav aria-label="Goods Receiving" className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          {RECEIVING_TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectTab(id)}
              aria-current={currentTab === id ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase border-b-2 transition-all cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary ${
                currentTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
      {panels ? (
        <div>
          {RECEIVING_TABS.map(([id]) => (
            <div key={id} className={currentTab === id ? "block" : "hidden"}>
              {panels[id]}
            </div>
          ))}
        </div>
      ) : (
        children
      )}
      <Toaster />
    </div>
  );
}
