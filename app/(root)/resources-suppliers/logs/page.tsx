import React, { Suspense } from "react";
import { AuditLogsSkeleton } from "@/components/loading/audit-logs-skeleton";
import ViewTransactionalLogs from "@/components/pages/ViewTransactionalLogs";
import type { LogEntry } from "@/components/pages/AuditLogsTable";
import { readImsAuditEvents } from "@/lib/audit";
import type { Module } from "@/lib/portal/config";
import { requireModule } from "@/lib/portal/staff";

const MODULES_BY_TYPE: Record<string, Module[]> = {
  supply: ["Resources & Suppliers", "Orders & Procurement", "Goods Receiving"],
  production: ["Production & Quality"],
  inventory: ["Inventory"],
  distribution: ["Stock Transfer"],
};

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireModule("Resources & Suppliers");
  const { type } = await searchParams;

  let logs: LogEntry[] = [];
  let unavailable = false;
  try {
    const events = await readImsAuditEvents({ modules: MODULES_BY_TYPE[(type ?? "supply").toLowerCase()] });
    logs = events.map((event) => ({
      id: event.id,
      activity: event.description,
      entityName: event.target.display_name,
      timestamp: event.occurred_at,
      user: event.actor.display_name,
    }));
  } catch (error) {
    console.error("Audit events could not be read", error);
    unavailable = true;
  }

  return (
    <Suspense fallback={<AuditLogsSkeleton />}>
      <ViewTransactionalLogs initialLogs={logs} unavailable={unavailable} />
    </Suspense>
  );
}
