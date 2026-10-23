import { expect, it } from "vitest";
import { devBypassEnabled } from "@/lib/portal/dev-bypass";

it("only permits explicitly enabled local development", () => {
  const env = {
    IMS_DEV_BYPASS: "true",
    NODE_ENV: "development",
    IMS_APP_URL: "https://localhost:3003",
  };
  expect(devBypassEnabled("https://localhost:3003", env)).toBe(true);
  for (const bad of [
    { NODE_ENV: "production" },
    { VERCEL: "1" },
    { VERCEL_ENV: "preview" },
    { VERCEL_URL: "preview.vercel.app" },
    { IMS_APP_URL: "https://br-sims.vercel.app" },
  ]) {
    expect(() =>
      devBypassEnabled("https://localhost:3003", { ...env, ...bad }),
    ).toThrow();
  }
  expect(() => devBypassEnabled("https://attacker.example", env)).toThrow();
  expect(devBypassEnabled("https://br-sims.vercel.app", {})).toBe(false);
});
