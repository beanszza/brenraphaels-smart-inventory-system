import { afterEach, describe, expect, it, vi } from "vitest";
import { auditContext, auditVersion, readImsAuditEvents, recordAudit } from "@/lib/audit";
import type { AuditEventInput, AuditEventRecord, GatewayPort } from "@/lib/gateway/audit";

const knownStaffLookup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { knownStaff: { findFirst: knownStaffLookup } } }));

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
    expect(written).toMatchObject([
      {
        source: "IMS",
        module: "Inventory",
        action: "record.created",
        outcome: "success",
        actor: { type: "user", id: "u1", display_name: "Ana Cruz" },
        target: { type: "item", id: "7", display_name: "Flour" },
        description: "Ana Cruz created item Flour",
        occurred_at: "2026-01-02T03:04:05.000Z",
      },
    ]);
  });

  it.each(["approved", "rejected"] as const)("sends %s as an update", async (change) => {
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


describe("audit contract", () => {
  const action = { module: "Inventory" as const, action: "stock_in.approved" as const,
    target: { type: "stock-in", id: 1, name: "SI-1" }, description: "Approved SI-1", version: auditVersion({ revision: 7 }) };
  it("deduplicates equivalent retries and distinguishes failure and new revisions", async () => {
    const { gateway, written } = fakeGateway();
    await recordAudit(staff, action, gateway);
    await recordAudit(staff, action, gateway);
    await recordAudit(staff, { ...action, outcome: "failure" }, gateway);
    await recordAudit(staff, { ...action, version: auditVersion({ revision: 8 }) }, gateway);
    expect(written[0].idempotency_key).toBe(written[1].idempotency_key);
    expect(new Set(written.map(e => e.idempotency_key)).size).toBe(3);
    expect(auditVersion({ b: 2, a: 1 })).toBe(auditVersion({ a: 1, b: 2 }));
  });
  it("includes another Portal user as subject and accepts explicit context", async () => {
    const { gateway, written } = fakeGateway();
    const context = await auditContext(new Headers({ "x-request-id": "req-1", "x-real-ip": "2001:db8::1", "user-agent": "Test browser" }));
    await recordAudit(staff, { ...action, context, subject: { id: "u2", display_name: "Ben" } }, gateway);
    expect(written[0]).toMatchObject({ actor: { type: "user", id: "u1" }, subject: { type: "user", id: "u2" }, ...context });
  });
  it("restores compat list actions without changing historical records", async () => {
    const { gateway } = fakeGateway({ listAudit: async () => [{ id: "1", source: "IMS", action: "record.updated", description: "[stock_in.approved] Approved SI-1", occurred_at: at.toISOString() } as AuditEventRecord] });
    expect(await readImsAuditEvents({}, gateway)).toMatchObject([{ action: "stock_in.approved", description: "Approved SI-1" }]);
  });
  it.each([true, false])("writes against a strict gateway with compatibility=%s", async legacy => {
    vi.stubEnv("IMS_GATEWAY_URL", "https://gateway.test");
    vi.stubEnv("IMS_GATEWAY_CALLER_KEY", "write-key");
    vi.stubEnv("IMS_AUDIT_LEGACY_ACTIONS", String(legacy));
    const sent: AuditEventInput[] = [];
    vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
      const event = JSON.parse(String(init.body)); sent.push(event);
      const allowed = legacy ? ["record.created", "record.updated", "record.deleted", "record.viewed"] : ["stock_in.approved"];
      return Response.json({ id: "e1" }, { status: allowed.includes(event.action) ? 201 : 400 });
    });
    const { gatewayPort } = await import("@/lib/gateway/audit");
    await recordAudit(staff, action, gatewayPort);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ action: legacy ? "record.updated" : "stock_in.approved", actor: { type: "user", id: "u1" }, idempotency_key: expect.stringContaining("stock_in.approved:") });
    if (legacy) expect(sent[0]).toMatchObject({ description: "[stock_in.approved] Approved SI-1", metadata: { ims_action: "stock_in.approved" } });
  });
});

it("resolves historical requester usernames to Portal IDs without guessing unknown users", async () => {
  const { gateway, written } = fakeGateway();
  const action = { module: "Inventory" as const, action: "stock_in.approved" as const, target: { type: "stock-in", id: 1, name: "SI-1" }, description: "Approved SI-1", subjectUsername: "requester" };
  knownStaffLookup.mockResolvedValueOnce({ StaffId: "portal-requester", Name: "Requester" }).mockResolvedValueOnce(null);
  await recordAudit(staff, action, gateway);
  await recordAudit(staff, action, gateway);
  expect(written[0].subject).toEqual({ type: "user", id: "portal-requester", display_name: "Requester" });
  expect(written[1].subject).toBeUndefined();
});
