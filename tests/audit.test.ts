import { afterEach, describe, expect, it, vi } from "vitest";
import { readImsAuditEvents, recordAudit, auditVersion, auditContext, safeAuditMetadata } from "@/lib/audit";
import type { AuditEventInput, AuditEventRecord, GatewayPort } from "@/lib/gateway/audit";

const staff = { id: "u1", name: "Ana Cruz", username: "2026-AB-001", email: "ana@example.com" };
const at = new Date("2026-01-02T03:04:05.000Z");

function fakeGateway(overrides: Partial<GatewayPort> = {}) {
  const written: AuditEventInput[] = [];
  const gateway: GatewayPort = {
    writeAudit: async (event) => void written.push(event),
    listAudit: async () => [],
    ...overrides,
  };
  return { gateway, written };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("recordAudit", () => {
  it("sends the Staff member as actor, the record as target, the Module and source IMS", async () => {
    const { gateway, written } = fakeGateway();
    await recordAudit(
      staff,
      { module: "Inventory", action: "record.created", target: { type: "item", id: 7, name: "Flour" }, description: "Ana Cruz created item Flour" },
      gateway,
      () => at,
    );
    expect(written).toEqual([
      {
        source: "IMS",
        module: "Inventory",
        action: "record.created",
        outcome: "success",
        actor: { type: "user", id: "u1", display_name: "Ana Cruz" },
        target: { type: "item", id: "7", display_name: "Flour" },
        description: "Ana Cruz created item Flour",
        occurred_at: "2026-01-02T03:04:05.000Z",
        idempotency_key: "record.created:item:7:success:once",
      },
    ]);
  });

  it.each(["approved", "rejected"] as const)("sends a specific %s action", async (change) => {
    const { gateway, written } = fakeGateway();
    await recordAudit(staff, { module: "Orders & Procurement", action: `purchase_order.${change}`, target: { type: "purchase-order", id: "PO-1", name: "PO-1" }, description: `Ana Cruz ${change} PO-1` }, gateway);
    expect(written[0].action).toBe(`purchase_order.${change}`);
    expect(written[0].description).toContain(change);
  });

  it("maps deleted", async () => {
    const { gateway, written } = fakeGateway();
    await recordAudit(staff, { module: "Inventory", action: "record.deleted", target: { type: "item", id: 1, name: "x" }, description: "d" }, gateway);
    expect(written[0].action).toBe("record.deleted");
  });

  it("does not fail the caller when the gateway fails, and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { gateway } = fakeGateway({ writeAudit: async () => { throw new Error("down"); } });
    await expect(
      recordAudit(staff, { module: "Inventory", action: "record.updated", target: { type: "item", id: 1, name: "x" }, description: "d" }, gateway),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });

  it("gives a slow gateway a deadline and logs the timeout without failing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let signal: AbortSignal | undefined;
    const { gateway } = fakeGateway({
      writeAudit: (_event, s) => {
        signal = s;
        return new Promise((_, reject) => s.addEventListener("abort", () => reject(s.reason)));
      },
    });
    vi.useFakeTimers();
    const done = recordAudit(staff, { module: "Inventory", action: "record.updated", target: { type: "item", id: 1, name: "x" }, description: "d" }, gateway);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(done).resolves.toBeUndefined();
    vi.useRealTimers();
    expect(signal?.aborted).toBe(true);
    expect(log).toHaveBeenCalled();
  });
});

describe("readImsAuditEvents", () => {
  const event = (id: string, source: string, occurred_at: string): AuditEventRecord => ({
    id, source, module: "Inventory", action: "record.created", outcome: "success",
    actor: { type: "staff", id: "a", display_name: "A" }, target: { type: "item", id: "1", display_name: "X" },
    description: "d", occurred_at,
  });

  it("returns only IMS events, newest first", async () => {
    const { gateway } = fakeGateway({
      listAudit: async () => [
        event("old", "IMS", "2026-01-01T00:00:00Z"),
        event("crms", "CRMS", "2026-01-03T00:00:00Z"),
        event("new", "IMS", "2026-01-02T00:00:00Z"),
      ],
    });
    expect((await readImsAuditEvents({}, gateway)).map((e) => e.id)).toEqual(["new", "old"]);
  });
});

describe("gatewayPort", () => {
  it("reads with the read key and pins Source IMS", async () => {
    vi.stubEnv("IMS_GATEWAY_URL", "https://gw.test/");
    vi.stubEnv("IMS_GATEWAY_AUDIT_READ_CALLER_KEY", "read-key");
    const fetchMock = vi.fn(async () => Response.json({ events: [], next_cursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    const { gatewayPort } = await import("@/lib/gateway/audit");
    await gatewayPort.listAudit({ modules: ["Inventory"], limit: 50 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://gw.test/audit/events");
    expect(parsed.searchParams.get("source")).toBe("IMS");
    expect(parsed.searchParams.get("module")).toBe("Inventory");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer read-key");
  });
});


describe("IMS event identity and context", () => {
  const transition = { module: "Orders & Procurement" as const, action: "purchase_order.approved" as const,
    target: { type: "purchase-order", id: 42, name: "PO-42" }, description: "Ana approved PO-42", version: "revision-2", context: {} };

  it("retries use the same key despite different clocks and request ids", async () => {
    const { gateway, written } = fakeGateway();
    await recordAudit(staff, { ...transition, context: { request_id: "request-1" } }, gateway, () => at);
    await recordAudit(staff, { ...transition, context: { request_id: "request-2" } }, gateway);
    expect(written[0].idempotency_key).toBe(written[1].idempotency_key);
    await recordAudit(staff, { ...transition, version: "revision-3" }, gateway);
    expect(written[2].idempotency_key).not.toBe(written[0].idempotency_key);
  });

  it("includes a Portal subject and request context without trusting usernames", async () => {
    const { gateway, written } = fakeGateway();
    const context = auditContext(new Headers({ "x-request-id": "req-1", "x-real-ip": "192.0.2.1", "user-agent": "IMS test" }));
    await recordAudit(staff, { ...transition, subject: { id: "portal-requester", name: "Ben" }, context }, gateway);
    expect(written[0]).toMatchObject({ actor: { type: "user", id: "u1" },
      subject: { type: "user", id: "portal-requester", display_name: "Ben" },
      request_id: "req-1", ip_address: "192.0.2.1", user_agent: "IMS test" });
  });

  it("failure outcomes cannot collide with saved transitions", async () => {
    const { gateway, written } = fakeGateway();
    await recordAudit(staff, transition, gateway);
    await recordAudit(staff, { ...transition, outcome: "failure" }, gateway);
    expect(written[1].outcome).toBe("failure");
    expect(written[0].idempotency_key).not.toBe(written[1].idempotency_key);
  });

  it("strips forbidden keys at every metadata depth before sending", async () => {
    const { gateway, written } = fakeGateway();
    const metadata = { reason: "Reviewed", nested: { Password: "hidden", count: 2 },
      items: [{ access_token: "hidden", clientSecret: "hidden", Authorization: "hidden", cardNumber: "hidden", CVV: "hidden", safe: true }] };
    const expected = { reason: "Reviewed", nested: { count: 2 }, items: [{ safe: true }] };
    expect(safeAuditMetadata(metadata)).toEqual(expected);
    await recordAudit(staff, { ...transition, metadata }, gateway);
    expect(written[0].metadata).toEqual(expected);
  });

  it("fingerprints committed state deterministically", () => {
    expect(auditVersion({ b: 2, a: { d: 4, c: 3 } })).toBe(auditVersion({ a: { c: 3, d: 4 }, b: 2 }));
    expect(auditVersion({ status: "Approved" })).not.toBe(auditVersion({ status: "Rejected" }));
    expect(auditContext(new Headers()).request_id).toBeTruthy();
  });
});
