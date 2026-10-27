import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/PageHeader";

export type ReceivingTab = "grn" | "discrepancies" | "stockin" | "rtv" | "loss";
export type ReceivingCounts = Record<ReceivingTab, number>;
const tabs = [
  ["grn", "Goods receipt notes / Receive"], ["discrepancies", "Discrepancies"],
  ["stockin", "Stock in"], ["rtv", "Supplier returns"], ["loss", "Loss / Disposal"],
] as const;

export default function ViewGoodsReceiving({ counts, activeTab, children }: {
  counts: ReceivingCounts; activeTab: ReceivingTab; children: ReactNode;
}) {
  return <div className="min-w-0 space-y-6 p-4 sm:p-8">
    <PageHeader title="Goods Receiving & Inbound Logistics"
      description="Receive deliveries, verify quantities, resolve discrepancies and approve stock into inventory." />
    <nav aria-label="Goods Receiving" className="flex gap-2 overflow-x-auto border-b border-border pb-2">
      {tabs.map(([id, label]) => <Link key={id} href={`/goods-receiving?tab=${id}`}
        aria-current={activeTab === id ? "page" : undefined}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary ${activeTab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
        {label}<span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{counts[id]}</span>
      </Link>)}
    </nav>
    {children}
    <Toaster />
  </div>;
}
