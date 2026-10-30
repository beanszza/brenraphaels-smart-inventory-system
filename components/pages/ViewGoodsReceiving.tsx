import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/PageHeader";

export type ReceivingTab = "grn" | "discrepancies" | "stockin" | "rtv" | "loss";
export type ReceivingCounts = Record<ReceivingTab, number>;
const tabs = [
  ["grn", "Goods receipt notes / Receive"],
  ["discrepancies", "Discrepancies"],
  ["stockin", "Stock in"],
  ["rtv", "Supplier returns"],
  ["loss", "Loss / Disposal"],
] as const;

export default function ViewGoodsReceiving({
  counts: _counts,
  activeTab,
  isQa = false,
  isManager = false,
  isAdmin = false,
  children,
}: {
  counts?: ReceivingCounts;
  activeTab: ReceivingTab;
  isQa?: boolean;
  isManager?: boolean;
  isAdmin?: boolean;
  children: ReactNode;
}) {
  const visibleTabs = tabs.filter(([id]) => {
    if (isQa && !isAdmin) {
      return id === "grn";
    }
    if (isManager && !isAdmin) {
      return id !== "grn";
    }
    return true;
  });

  return (
    <div className="w-full min-h-full py-7 px-4 sm:px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="Goods Receiving & Inbound Logistics"
        description={
          isQa && !isAdmin
            ? "Receive inbound supplier deliveries, verify batch counts, and conduct Quality Assurance inspections."
            : "Review put-away stock, resolve delivery discrepancies, manage supplier returns, and handle inventory loss."
        }
      />
      <nav aria-label="Goods Receiving" className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto">
          {visibleTabs.map(([id, label]) => (
            <Link
              key={id}
              href={`/goods-receiving?tab=${id}`}
              prefetch={true}
              aria-current={activeTab === id ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase border-b-2 transition-all cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary ${
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
      {children}
      <Toaster />
    </div>
  );
}
