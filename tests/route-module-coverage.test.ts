/// <reference types="vite/client" />
import { expect, it } from "vitest";

// Business Modules use guarded server actions. Only Portal session plumbing
// and authorized external inter-service integration routes (POS / SCMS)
// should expose HTTP handlers; each handler undergoes authorization review.
const routes = import.meta.glob("../app/**/route.{ts,tsx,js,jsx}");

it("only Portal plumbing remains as route handlers", () => {
  expect(Object.keys(routes).sort()).toEqual([
    "../app/api/StockTransfers/[transferId]/status/route.ts",
    "../app/api/portal/callback/route.ts",
    "../app/api/portal/login/route.ts",
    "../app/api/portal/logout/route.ts",
    "../app/api/pos/locations/sync/route.ts",
    "../app/api/scms/locations/sync/route.ts",
    "../app/api/scms/transfers/[transferId]/receive-confirmation/route.ts",
  ]);
});
