import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { portalClient } from "@/lib/portal/client";

beforeEach(() => {
  vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret");
  vi.stubEnv("IMS_APP_URL", "https://localhost:3003");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each([
  [401, { error: "invalid_handle" }, "invalid"],
  [401, { error: "invalid_client" }, "unavailable"],
  [403, { error: "access_denied" }, "denied"],
  [503, { error: "temporarily_unavailable" }, "unavailable"],
  [200, { active: true }, "unavailable"],
  [200, { active: false }, "unavailable"],
])("denies Portal HTTP %i with %j", async (status, body, decision) => {
  vi.stubGlobal("fetch", async () => Response.json(body, { status }));
  expect(await portalClient.validate("handle", "Inventory")).toEqual({
    decision,
  });
});
it("denies malformed JSON and network failures", async () => {
  vi.stubGlobal("fetch", async () => new Response("broken"));
  expect(await portalClient.validate("handle", "Inventory")).toEqual({
    decision: "unavailable",
  });
  vi.stubGlobal("fetch", async () => {
    throw new Error("network");
  });
  expect(await portalClient.validate("handle", "Inventory")).toEqual({
    decision: "unavailable",
  });
});
it.each([0, -1, 28801, "28800", null])(
  "rejects invalid session lifetime %s",
  async (expires_in) => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ handle: "handle", expires_in }),
    );
    expect(
      await portalClient.exchange({
        code: "code",
        state: "state",
        codeVerifier: "verifier",
      }),
    ).toEqual({ ok: false, reason: "rejected" });
  },
);
