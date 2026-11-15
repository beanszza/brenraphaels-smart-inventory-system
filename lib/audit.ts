import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { auditText, parseCompatEvent, safeAuditMetadata, type ImsAuditAction } from "@/lib/audit-actions";
import { gatewayPort, WRITE_TIMEOUT_MS, type AuditEventRecord, type GatewayPort } from "@/lib/gateway/audit";
import type { Module } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

export type AuditAction = {
  module: Module | null;
  action: ImsAuditAction;
  target: { type: string; id: string | number; name: string };
  description: string;
  outcome?: "success" | "failure";
  subject?: { type?: "user"; id: string; display_name: string };
  subjectUsername?: string | null;
  version?: string;
  context?: AuditContext;
  metadata?: Record<string, unknown>;
};
export type AuditContext = { request_id: string; ip_address?: string; user_agent?: string };

/** Stable across retries; sort object keys so equivalent snapshots have the same version. */
export function auditVersion(value: unknown): string {
  const stable = (v: unknown): unknown => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)]));
    return typeof v === "bigint" ? String(v) : v;
  };
  return createHash("sha256").update(JSON.stringify(stable(value)) ?? "null").digest("hex");
}
export async function auditContext(requestHeaders?: Headers): Promise<AuditContext> {
  let h = requestHeaders;
  if (!h) {
    try { h = await (await import("next/headers")).headers(); } catch { /* Outside a request, such as a job. */ }
  }
  const ip = h?.get("x-real-ip")?.trim();
  return {
    request_id: auditText(h?.get("x-request-id") || randomUUID()),
    ...(ip && isIP(ip) ? { ip_address: ip } : {}),
    ...(h?.get("user-agent") ? { user_agent: auditText(h.get("user-agent")!) } : {}),
  };
}

/**
 * Call after a state-changing action has been saved. Best effort: a failing or slow
 * gateway is logged on the server and never reaches the caller.
 */
export async function recordAudit(
  staff: Staff,
  action: AuditAction,
  gateway: GatewayPort = gatewayPort,
  now: () => Date = () => new Date(),
): Promise<void> {
  try {
    const context = action.context ?? await auditContext();
    let subject = action.subject;
    if (!subject && action.subjectUsername && action.subjectUsername !== staff.username) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const known = await prisma.knownStaff.findFirst({ where: { Username: action.subjectUsername } });
        if (known?.StaffId) subject = { id: known.StaffId, display_name: known.Name || action.subjectUsername };
      } catch (error) { console.error("Audit subject could not be resolved", error); }
    }
    const outcome = action.outcome ?? "success";
    await gateway.writeAudit(
      {
        source: "IMS",
        module: action.module,
        action: action.action,
        outcome,
        actor: { type: "user", id: auditText(staff.id), display_name: auditText(staff.name) },
        target: { type: auditText(action.target.type), id: auditText(String(action.target.id)), display_name: auditText(action.target.name) },
        description: auditText(action.description),
        idempotency_key: `${action.action}:${auditText(action.target.type)}:${auditText(String(action.target.id))}:${outcome}:${action.version ?? auditVersion({ description: action.description, metadata: action.metadata })}`,
        ...context,
        ...(subject && subject.id !== staff.id ? { subject: { type: "user", id: auditText(subject.id), display_name: auditText(subject.display_name) } } : {}),
        metadata: safeAuditMetadata(action.metadata),
        occurred_at: now().toISOString(),
      },
      AbortSignal.timeout(WRITE_TIMEOUT_MS),
    );
  } catch (error) {
    console.error("Audit event could not be sent", error);
  }
}

/** The logs page's read path: only events of Source IMS, newest first. */
export async function readImsAuditEvents(
  options: { modules?: Module[]; limit?: number } = {},
  gateway: GatewayPort = gatewayPort,
): Promise<AuditEventRecord[]> {
  const events = await gateway.listAudit({ modules: options.modules, limit: options.limit ?? 500 });
  return events
    .filter((event) => event.source === "IMS")
    .map(parseCompatEvent)
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, options.limit ?? 500);
}
