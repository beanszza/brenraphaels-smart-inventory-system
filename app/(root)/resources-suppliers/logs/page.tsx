import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuditLogsSkeleton } from "@/components/loading/audit-logs-skeleton";
import ViewTransactionalLogs from "@/components/pages/ViewTransactionalLogs";
import type { LogEntry } from "@/components/pages/AuditLogsTable";
import { auditActionLabel } from "@/lib/audit-actions";
import { readImsAuditEvents } from "@/lib/audit";
import type { Module } from "@/lib/portal/config";
import { requireModule } from "@/lib/portal/staff";
import { isAdminStaff } from "@/lib/auth-roles";

const MODULES_BY_TYPE: Record<string, Module[]> = {
  supply: ["Resources & Suppliers", "Orders & Procurement", "Goods Receiving"],
  production: ["Production & Quality"],
  inventory: ["Inventory"],
  distribution: ["Stock Transfer"],
};

const ENTITY_OPTIONS = ["All", "Categories", "Suppliers", "Supply", "BOM / Recipes"];

export default async function Page({ searchParams }: { searchParams?: Promise<{ type?: string }> } = {}) {
  const staff = await requireModule("Resources & Suppliers");
  if (staff?.username && !isAdminStaff(staff)) {
    redirect("/no-access");
  }

  const { type } = (await searchParams) ?? {};
  const selectedModules: Module[] = type && MODULES_BY_TYPE[type.toLowerCase()]
    ? MODULES_BY_TYPE[type.toLowerCase()]
    : ["Resources & Suppliers"];

  let logs: LogEntry[] = [];
  let unavailable = false;
  try {
    const events = await readImsAuditEvents({ modules: selectedModules });
    logs = events.map((event) => ({
      id: event.id,
      activity: `${event.outcome === "failure" ? "Failed: " : ""}${auditActionLabel(event.action)}: ${event.description}`,
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
      <ViewTransactionalLogs
        initialLogs={logs}
        unavailable={unavailable}
        entityOptions={ENTITY_OPTIONS}
        moduleTitle="Resources & Suppliers"
      />
    </Suspense>
  );
}
