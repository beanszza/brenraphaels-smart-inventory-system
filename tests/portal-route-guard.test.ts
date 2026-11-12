import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireRouteModule } from "@/lib/portal/staff";

const audit = vi.hoisted(() => ({ events: [] as import("@/lib/gateway/audit").AuditEventInput[] }));
vi.mock("@/lib/gateway/audit", () => ({ WRITE_TIMEOUT_MS: 3000, gatewayPort: {
  writeAudit: async (event: import("@/lib/gateway/audit").AuditEventInput) => { audit.events.push(event); },
} }));
beforeEach(() => {
  audit.events = [];
  vi.stubEnv("IMS_DEV_BYPASS", "false");
  vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each([
  [401, { error: "invalid_handle" }, 401],
  [403, { error: "access_denied" }, 403],
  [503, { error: "temporarily_unavailable" }, 503],
])("returns a deny response for Portal %i", async (status, body, expected) => {
  vi.stubGlobal("fetch", async () => Response.json(body, { status }));
  const request = new NextRequest("https://localhost:3003/api/items");
  request.cookies.set("ims_session", "forged-or-expired");
  const result = await requireRouteModule(request, "Inventory");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.response.status).toBe(expected);
});

it("returns only the Portal identity after validation", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({
      active: true,
      user_id: "staff-1",
      system: "IMS",
      module: "Inventory",
      staff: { name: "Ada", username: "2026-AB-001", email: "ada@example.com" },
    }),
  );
  const request = new NextRequest(
    "https://localhost:3003/api/items?username=spoofed",
  );
  request.cookies.set("ims_session", "opaque");
  expect(await requireRouteModule(request, "Inventory")).toEqual({
    ok: true,
    staff: {
      id: "staff-1",
      name: "Ada",
      username: "2026-AB-001",
      email: "ada@example.com",
    },
  });
});


it("records denied Module access with a verified Portal identity and request context", async () => {
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const { module } = JSON.parse(String(init.body));
    if (module !== "Orders & Procurement") return Response.json({ error: "access_denied" }, { status: 403 });
    return Response.json({ active: true, user_id: "portal-1", system: "IMS", module,
      staff: { name: "Ada", username: "ada", email: "ada@example.com" } });
  });
  const request = new NextRequest("https://localhost:3003/api/items", { headers: { "x-request-id": "req-denied", "user-agent": "IMS test" } });
  request.cookies.set("ims_session", "opaque");
  const result = await requireRouteModule(request, "Inventory");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.response.status).toBe(403);
  expect(audit.events).toHaveLength(1);
  expect(audit.events[0]).toMatchObject({ module: null, action: "ims.access_denied", outcome: "failure",
    actor: { type: "user", id: "portal-1" }, target: { type: "module", id: "Inventory" }, request_id: "req-denied", user_agent: "IMS test" });
});
