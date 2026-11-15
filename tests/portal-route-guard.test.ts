import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireRouteModule } from "@/lib/portal/staff";

beforeEach(() => {
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

it("audits a module denial only after independently resolving the Portal identity", async () => {
  vi.stubEnv("IMS_GATEWAY_URL", "https://gateway.test");
  vi.stubEnv("IMS_GATEWAY_CALLER_KEY", "test-key");
  const events: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (url.startsWith("https://gateway.test")) { events.push(body); return Response.json({ id: "1" }, { status: 201 }); }
    return body.module === "Inventory" ? Response.json({ error: "access_denied" }, { status: 403 }) : Response.json({ active: true, user_id: "staff-1", system: "IMS", module: body.module, staff: { name: "Ada", username: "ada", email: "ada@example.test" } });
  });
  const request = new NextRequest("https://localhost:3003/api/items", { headers: { "x-request-id": "denial-1", "x-real-ip": "127.0.0.1", "user-agent": "Test" } });
  request.cookies.set("ims_session", "opaque");
  expect((await requireRouteModule(request, "Inventory")).ok).toBe(false);
  expect(events).toMatchObject([{ actor: { type: "user", id: "staff-1" }, module: null, outcome: "failure", metadata: { ims_action: "ims.access_denied" }, request_id: "denial-1", target: { type: "module", id: "Inventory" } }]);
});
