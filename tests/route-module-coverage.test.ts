/// <reference types="vite/client" />
import { expect, it } from "vitest";

// Business Modules use guarded server actions. Only Portal session plumbing
// should expose HTTP handlers; a new handler needs its own authorization review.
const routes = import.meta.glob("../app/**/route.{ts,tsx,js,jsx}");

it("only Portal plumbing remains as route handlers", () => {
  expect(Object.keys(routes).sort()).toEqual([
    "../app/api/portal/callback/route.ts",
    "../app/api/portal/login/route.ts",
    "../app/api/portal/logout/route.ts",
  ]);
});
