import { createHash, randomUUID } from "node:crypto";
import type { ImsAuditAction } from "@/lib/audit-actions";
import { gatewayPort, WRITE_TIMEOUT_MS, type AuditEventRecord, type GatewayPort } from "@/lib/gateway/audit";
import type { Module } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

export type AuditAction = {
  module: Module | null;
  action: ImsAuditAction;
  target: { type: string; id: string | number; name: string };
  description: string;
  subject?: { id: string; name?: string };
  subjectUsername?: string;
  version?: string | number;
  outcome?: "success" | "failure";
  context?: AuditContext;
  metadata?: Record<string, unknown>;
};

export type AuditContext = { request_id?: string; ip_address?: string; user_agent?: string };
export function auditContext(headers: Headers): AuditContext {
  return {
    request_id: headers.get("x-request-id") || randomUUID(),
    ip_address: headers.get("x-real-ip") ?? undefined,
    user_agent: headers.get("user-agent") ?? undefined,
  };
}

/** Recursively omit service-forbidden keys, including keys inside arrays. */
export function safeAuditMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const clean = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(clean);
    if (entry && typeof entry === "object") return Object.fromEntries(
      Object.entries(entry).filter(([key]) => !/password|token|secret|authorization|card|cvv/i.test(key)).map(([key, child]) => [key, clean(child)]),
    );
    return entry;
  };
  return clean(value) as Record<string, unknown>;
}

/** Stable across object key ordering and gateway retries. Never includes request time. */
export function auditVersion(value: unknown): string {
  const canonical = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(canonical);
    if (entry instanceof Date) return entry.toISOString();
    if (entry && typeof entry === "object") return Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
    return typeof entry === "bigint" ? String(entry) : entry;
  };
  return createHash("sha256").update(JSON.stringify(canonical(value)) ?? "null").digest("hex");
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
    let context = action.context;
    if (!context) {
      try { context = auditContext(await (await import("next/headers")).headers()); } catch { /* No request scope, e.g. jobs. */ }
    }
    let subject = action.subject;
    if (!subject && action.subjectUsername) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const row = await prisma.knownStaff.findFirst({ where: { Username: action.subjectUsername } });
        if (row) subject = { id: row.StaffId, name: row.Name };
      } catch (error) { console.error("Audit subject could not be resolved", error); }
    }
    const outcome = action.outcome ?? "success";
    // <action>:<target type>:<target id>:<outcome>:<transition version>.
    // One-shot transitions use "once"; repeatable edits supply a persisted revision
    // or a fingerprint of the committed result, never a fresh timestamp or UUID.
    const version = action.version ?? "once";
    await gateway.writeAudit(
      {
        source: "IMS",
        module: action.module,
        action: action.action,
        outcome,
        actor: { type: "user", id: staff.id, display_name: staff.name },
        target: { type: action.target.type, id: String(action.target.id), display_name: action.target.name },
        description: action.description,
        occurred_at: now().toISOString(),
        idempotency_key: `${action.action}:${action.target.type}:${action.target.id}:${outcome}:${version}`,
        ...(subject && subject.id !== staff.id ? { subject: { type: "user" as const, id: subject.id, display_name: subject.name } } : {}),
        ...context,
        ...(action.metadata ? { metadata: safeAuditMetadata(action.metadata) } : {}),
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
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, options.limit ?? 500);
}
