import { expect, it } from "vitest";
import { challengeFor, newState, newVerifier } from "@/lib/portal/pkce";
it("matches the RFC 7636 S256 test vector", () => {
  expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
  expect(newVerifier()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(newState()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  expect(newState()).not.toBe(newState());
});
