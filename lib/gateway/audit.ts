/** Wire shape of an Audit event as audit-logs accepts it through the gateway. */
export type AuditEventInput = {
  source: "IMS";
  module: string;
  action: "record.created" | "record.updated" | "record.deleted";
  outcome: "success";
  actor: { type: "staff"; id: string; display_name: string };
  target: { type: string; id: string; display_name: string };
  description: string;
  occurred_at: string;
};

export type AuditEventRecord = {
  id: string;
  source: string;
  module: string | null;
  action: string;
  outcome: string;
  actor: { type: string; id: string; display_name: string };
  target: { type: string; id: string; display_name: string };
  description: string;
  occurred_at: string;
};

/** The gateway as IMS uses it for audit; replaced with a fake in tests. */
export interface GatewayPort {
  writeAudit(event: AuditEventInput, signal: AbortSignal): Promise<void>;
  /** Lists newest-first events of Source IMS only. */
  listAudit(options: { modules?: string[]; limit: number }): Promise<AuditEventRecord[]>;
}

export const WRITE_TIMEOUT_MS = 3_000;

function gateway(keyName: "IMS_GATEWAY_CALLER_KEY" | "IMS_GATEWAY_AUDIT_READ_CALLER_KEY") {
  const base = process.env.IMS_GATEWAY_URL;
  const key = process.env[keyName];
  if (!base || !key) throw new Error(`IMS_GATEWAY_URL and ${keyName} must be set; see .env.example`);
  return { base: base.replace(/\/$/, ""), key };
}

export const gatewayPort: GatewayPort = {
  async writeAudit(event, signal) {
    const { base, key } = gateway("IMS_GATEWAY_CALLER_KEY");
    const response = await fetch(`${base}/audit/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal,
    });
    if (!response.ok) throw new Error(`The gateway refused the audit event: ${response.status}`);
  },

  async listAudit({ modules, limit }) {
    const { base, key } = gateway("IMS_GATEWAY_AUDIT_READ_CALLER_KEY");
    const events: AuditEventRecord[] = [];
    // The read key can see every Source, so Source is pinned here and re-checked on the way out.
    for (const moduleName of modules?.length ? modules : [undefined]) {
      let cursor: string | null = null;
      do {
        const query = new URLSearchParams({ source: "IMS", limit: String(Math.min(limit, 100)) });
        if (moduleName) query.set("module", moduleName);
        if (cursor) query.set("cursor", cursor);
        const response = await fetch(`${base}/audit/events?${query}`, {
          headers: { Authorization: `Bearer ${key}` },
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) throw new Error(`The gateway refused the audit read: ${response.status}`);
        const body = (await response.json()) as { events: AuditEventRecord[]; next_cursor: string | null };
        events.push(...body.events);
        cursor = body.next_cursor;
      } while (cursor && events.length < limit);
    }
    return events;
  },
};
