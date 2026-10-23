import { gatewayPort, WRITE_TIMEOUT_MS, type AuditEventRecord, type GatewayPort } from "@/lib/gateway/audit";
import type { Module } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";

/** Approvals and rejections are updates to the audit service; the meaning lives in the description. */
export type AuditChange = "created" | "updated" | "deleted" | "approved" | "rejected";

const ACTIONS = {
  created: "record.created",
  updated: "record.updated",
  deleted: "record.deleted",
  approved: "record.updated",
  rejected: "record.updated",
} as const;

export type AuditAction = {
  module: Module;
  change: AuditChange;
  target: { type: string; id: string | number; name: string };
  description: string;
};

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
    await gateway.writeAudit(
      {
        source: "IMS",
        module: action.module,
        action: ACTIONS[action.change],
        outcome: "success",
        actor: { type: "staff", id: staff.username, display_name: staff.name },
        target: { type: action.target.type, id: String(action.target.id), display_name: action.target.name },
        description: action.description,
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
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
}
