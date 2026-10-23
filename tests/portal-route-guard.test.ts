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
