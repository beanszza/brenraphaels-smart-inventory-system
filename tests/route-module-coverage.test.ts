/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Module } from "@/lib/portal/config";

// Denied requests must never touch IMS data, even if a handler catches the error.
const { dataAccess } = vi.hoisted(() => ({
  dataAccess: vi.fn(() => { throw new Error("Denied request reached IMS data"); }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: dataAccess }),
}));

// The only public handlers are the Portal handoff and sign-out plumbing.
const publicRoutes = new Set([
  "../app/api/portal/login/route.ts",
  "../app/api/portal/callback/route.ts",
  "../app/api/portal/logout/route.ts",
]);
const routes = import.meta.glob("../app/**/route.{ts,tsx,js,jsx}");
const modules: Record<string, Module> = {
  inventory: "Inventory",
  "cycle-counts": "Inventory",
  traceability: "Inventory",
  valuation: "Inventory",
  ProductionBatches: "Production & Quality",
  "production-requests": "Production & Quality",
  "production-qa": "Production & Quality",
  "material-issuances": "Production & Quality",
  "finished-products": "Production & Quality",
  "stock-transfer-requests": "Stock Transfer",
  "stock-transfers": "Stock Transfer",
};

beforeEach(() => {
  dataAccess.mockClear();
  vi.stubEnv("IMS_DEV_BYPASS", "false");
  vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

for (const [path, load] of Object.entries(routes)) {
  if (publicRoutes.has(path)) continue;
  describe(path, async () => {
    const route = await load() as Record<string, unknown>;
    const handlers = Object.entries(route).filter(([name]) =>
      /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(name),
    );
    const owningModule = modules[path.split("/")[3]];

    it("belongs to exactly one IMS Module and exposes handlers", () => {
      expect(owningModule, `Assign a Module to ${path}`).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    for (const [method, handler] of handlers) {
      it.each([
        ["unsigned", false, 401, "invalid"],
        ["expired session", true, 401, "invalid"],
        ["missing Module", true, 403, "denied"],
        ["Portal unavailable", true, 503, "unavailable"],
      ] as const)(`${method} denies %s before processing the request`, async (_, signed, status, error) => {
        const portal = vi.fn(async (_input: unknown, init?: RequestInit) => {
          expect(JSON.parse(String(init?.body)).module).toBe(owningModule);
          return Response.json({ error: status === 401 ? "invalid_handle" : "denied" }, { status });
        });
        vi.stubGlobal("fetch", portal);
        const request = new NextRequest(`https://localhost:3003${path.slice(6).replace(/\/route\.[^.]+$/, "")}`, { method });
        if (signed) request.cookies.set("ims_session", "opaque");
        // Deliberately omit route params and the body: authorization comes first.
        const response = await (handler as (request: NextRequest) => Promise<Response>)(request);
        expect(response.status).toBe(status);
        expect(await response.json()).toEqual({ error });
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(dataAccess).not.toHaveBeenCalled();
        expect(portal).toHaveBeenCalledTimes(signed ? 1 : 0);
      });
    }
  });
}
