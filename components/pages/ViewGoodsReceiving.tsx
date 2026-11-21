import Link from "next/link";
import { History } from "lucide-react";
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
    <div className="page-container px-4 sm:px-8 w-full min-h-full space-y-5 animate-page-in">
      <PageHeader
        title="Goods Receiving & Inbound Logistics"
        description={
          isQa && !isAdmin
            ? "Receive inbound supplier deliveries, verify batch counts, and conduct Quality Assurance inspections."
            : "Review put-away stock, resolve delivery discrepancies, manage supplier returns, and handle inventory loss."
        }
      />
      <div className="flex items-center justify-between border-b border-divider gap-2">
        <nav aria-label="Goods Receiving" className="min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            {visibleTabs.map(([id, label]) => (
              <Link
                key={id}
                href={`/goods-receiving?tab=${id}`}
                prefetch={true}
                aria-current={activeTab === id ? "page" : undefined}
                className={`flex items-center gap-2 px-4 py-2.5 type-label-tab font-semibold uppercase border-b-2 transition-all cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary ${
                  activeTab === id
                    ? "border-primary text-primary -mb-px"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>
        {isAdmin && (
          <div className="pb-1.5 shrink-0">
            <Link
              href="/goods-receiving/logs"
              className="inline-flex items-center gap-1.5 h-9 rounded-control border border-border bg-surface px-3.5 py-2 type-label-button text-ink hover:bg-subtle transition-colors cursor-pointer"
            >
              <History size={15} />
              <span>Transaction History</span>
            </Link>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
