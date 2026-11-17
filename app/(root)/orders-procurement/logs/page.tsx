import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuditLogsSkeleton } from "@/components/loading/audit-logs-skeleton";
import ViewTransactionalLogs from "@/components/pages/ViewTransactionalLogs";
import type { LogEntry } from "@/components/pages/AuditLogsTable";
import { auditActionLabel } from "@/lib/audit-actions";
import { readImsAuditEvents } from "@/lib/audit";
import { requireModule } from "@/lib/portal/staff";
import { isAdminStaff } from "@/lib/auth-roles";

const ENTITY_OPTIONS = ["All", "Purchase Orders", "Requisitions", "Deliveries"];

export default async function Page() {
  const staff = await requireModule("Orders & Procurement");
  if (!isAdminStaff(staff)) {
    redirect("/no-access");
  }

  let logs: LogEntry[] = [];
  let unavailable = false;
  try {
    const events = await readImsAuditEvents({ modules: ["Orders & Procurement"] });
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
        moduleTitle="Orders & Procurement"
      />
    </Suspense>
  );
}
